import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { neon, neonConfig } from '@neondatabase/serverless';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { PGlite } from '@electric-sql/pglite';
import * as schema from '@/db/schema';
import { makeTestDb, type TestDb } from '@/db/test-db';
import {
  ACCOUNT_DELETION_COVERAGE,
  DELETION_ORDER,
  SHARED_TABLES,
  purgeUserData,
} from '@/lib/account/deletion';

/**
 * SPEC-036 CA-7, por el camino que corre en PRODUCCIÓN — cierra R-1.
 *
 * El cliente de datos es intercambiable por `DB_DRIVER` (`src/db/client.ts`,
 * ADR-001): `neon-http` en producción, PGlite en los tests unitarios y postgres-js
 * en el e2e. `purgeUserData` elige el primitivo atómico **por capacidad** —`batch()`
 * si existe, `transaction()` si no— porque `drizzle-orm/neon-http` lanza a propósito
 * en `transaction()`: cada consulta es una petición HTTP y no hay transacción
 * interactiva que valga. Consecuencia incómoda: el resto de la suite (PGlite,
 * postgres-js) ejercita SOLO la otra rama, y la operación más destructiva de la app
 * corría en producción por un camino que ningún test tocaba.
 *
 * Este fichero lo tapa sin un Neon en CI y sin red: usa el driver de verdad
 * —`drizzle-orm/neon-http` sobre `@neondatabase/serverless`— y le interpone un doble
 * en `neonConfig.fetchFunction`, que es el único punto por el que ese driver sale al
 * mundo. Lo que se observa es el contrato completo del lado que depende de ESTE
 * repositorio: qué rama se toma, qué sale por el cable, en qué orden, con qué
 * parámetros, y qué pasa cuando el servidor dice que no.
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * EL LÍMITE DE ESTE TEST, dicho para que nadie lo lea como una garantía mayor:
 *
 *   Aquí se comprueba que el borrado entero SALE en una sola petición. NO se
 *   comprueba —ni se puede— que esa petición se ejecute envuelta en `BEGIN`/
 *   `COMMIT`: ese `BEGIN`/`COMMIT` lo pone el SERVIDOR de Neon, no este código.
 *   Es contrato documentado del proveedor (`@neondatabase/serverless`: varias
 *   consultas enviadas por HTTP en una sola petición se ejecutan como «a single,
 *   non-interactive Postgres transaction»), y ningún doble local puede probarlo:
 *   probaría el doble, no a Neon.
 *
 *   Dicho de otro modo: si Neon dejara de ser transaccional en `/sql`, este test
 *   seguiría verde y el borrado podría quedar a medias. La comprobación de esa
 *   mitad es operativa, no automática — borrar una cuenta de prueba en el primer
 *   despliegue y contar (queda anotado en el ledger, R-1).
 *
 *   La atomicidad OBSERVABLE (o cae todo o no cae nada) se prueba contra Postgres
 *   de verdad en `tests/account-deletion.test.ts`, por la rama `transaction()`.
 * ─────────────────────────────────────────────────────────────────────────────
 */

/** Una URL de Neon con la forma real; ningún byte sale de aquí. */
const CADENA_NEON = 'postgresql://usuario:clave@ep-doble-de-prueba.aws.neon.tech/stockeiro';

const USUARIO = 'usuario-que-se-va-0001';
const OTRO_USUARIO = 'usuario-que-se-queda-0002';

interface SentenciaEnviada {
  query: string;
  params: unknown[];
}

interface PeticionCapturada {
  url: string;
  metodo: string;
  sentencias: SentenciaEnviada[];
}

/** Lo que el doble deja ver de cada llamada al cable. */
let peticiones: PeticionCapturada[] = [];
let fetchOriginal: unknown;

/**
 * El doble de `fetch` que usa el driver. Devuelve lo mínimo que
 * `@neondatabase/serverless` sabe leer: `results`, una entrada por sentencia, con
 * `fields` y `rows` vacíos (un `DELETE` sin `returning` no devuelve filas).
 */
function instalarDoble(responder: (sentencias: SentenciaEnviada[]) => unknown) {
  neonConfig.fetchFunction = async (url: string, init: any) => {
    const cuerpo = JSON.parse(String(init.body));
    const sentencias: SentenciaEnviada[] = cuerpo.queries ?? [cuerpo];
    peticiones.push({ url, metodo: init.method, sentencias });
    return responder(sentencias);
  };
}

function respuestaOk(sentencias: SentenciaEnviada[]) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      results: sentencias.map(() => ({ command: 'DELETE', fields: [], rows: [], rowCount: 0 })),
    }),
  };
}

/** Un 400 con el cuerpo que Neon devuelve cuando el servidor rechaza el lote. */
function respuesta400(mensaje: string) {
  return {
    ok: false,
    status: 400,
    json: async () => ({ message: mensaje, code: '23503', severity: 'ERROR' }),
    text: async () => mensaje,
  };
}

/** El cliente tal y como lo compone `src/db/client.ts` para producción. */
function clienteDeProduccion() {
  return drizzleNeon(neon(CADENA_NEON), { schema });
}

beforeEach(() => {
  peticiones = [];
  fetchOriginal = neonConfig.fetchFunction;
});

afterEach(() => {
  neonConfig.fetchFunction = fetchOriginal;
});

// ---------------------------------------------------------------------------
// 1. La elección por capacidad, mirada desde los tres drivers reales del proyecto
// ---------------------------------------------------------------------------

describe('SPEC-036 CA-7: con el cliente de producción se toma la rama batch()', () => {
  it('el cliente neon-http expone batch(), y por eso `purgeUserData` no llama a transaction()', async () => {
    const db = clienteDeProduccion();
    expect(typeof (db as any).batch).toBe('function');

    instalarDoble(respuestaOk);
    await purgeUserData(db as any, USUARIO);

    // La prueba de que se tomó `batch()` y no `transaction()` no es el `typeof`:
    // es que salió UNA petición con las seis sentencias dentro. Seis peticiones
    // sueltas serían exactamente el fallo que esta rama existe para evitar.
    expect(peticiones).toHaveLength(1);
    expect(peticiones[0].sentencias).toHaveLength(DELETION_ORDER.length);
  });

  it('el transaction() de neon-http lanza a propósito: la rama batch no es una preferencia', async () => {
    // Si mañana alguien "simplifica" `purgeUserData` a un `transaction()` a secas,
    // producción no degradaría a seis sentencias sueltas: reventaría en voz alta.
    // Este caso fija que el fallo sería ruidoso, que es lo que hace segura la
    // elección por capacidad.
    const db = clienteDeProduccion();
    await expect(db.transaction(async () => undefined)).rejects.toThrow(
      /No transactions support in neon-http driver/,
    );
  });

  it('PGlite (unit) NO expone batch(), así que cae en transaction() — y por eso nunca cubrió esto', async () => {
    const harness: { db: TestDb; client: PGlite } = await makeTestDb();
    try {
      expect(typeof (harness.db as any).batch).not.toBe('function');
      expect(typeof (harness.db as any).transaction).toBe('function');
    } finally {
      await harness.client.close();
    }
  });

  it('postgres-js (e2e) tampoco expone batch()', async () => {
    // Cliente perezoso: `postgres()` no abre conexión hasta la primera consulta,
    // y aquí no se hace ninguna. Solo se mira la forma del objeto.
    const cliente = postgres('postgresql://usuario:clave@127.0.0.1:5432/no-se-usa', { max: 1 });
    try {
      const db = drizzlePg(cliente, { schema });
      expect(typeof (db as any).batch).not.toBe('function');
      expect(typeof (db as any).transaction).toBe('function');
    } finally {
      await cliente.end({ timeout: 0 });
    }
  });
});

// ---------------------------------------------------------------------------
// 2. Qué sale por el cable
// ---------------------------------------------------------------------------

describe('SPEC-036 CA-7: el borrado entero viaja en UNA sola petición', () => {
  beforeEach(() => instalarDoble(respuestaOk));

  it('una única llamada, POST al endpoint /sql, con las seis sentencias en el cuerpo', async () => {
    await purgeUserData(clienteDeProduccion() as any, USUARIO);

    expect(peticiones).toHaveLength(1);
    expect(peticiones[0].metodo).toBe('POST');
    expect(peticiones[0].url).toMatch(/^https:\/\/.+\/sql$/);
    expect(peticiones[0].sentencias).toHaveLength(6);
  });

  it('las seis, en el orden de ADR-022 pto. 4 — derivado de la cobertura, no copiado', async () => {
    await purgeUserData(clienteDeProduccion() as any, USUARIO);

    expect(tablasBorradas(peticiones[0].sentencias)).toEqual([
      'notifications',
      'watched_symbols',
      'transactions',
      'symbol_aliases',
      'password_reset_tokens',
      'users',
    ]);
    // Y el mismo orden que declara el módulo: si alguien reordena la cobertura,
    // este caso lo sigue, pero el literal de arriba lo delata.
    expect(tablasBorradas(peticiones[0].sentencias)).toEqual([...DELETION_ORDER]);
  });

  it('cada sentencia es un DELETE con su where y parametrizado con ESE usuario', async () => {
    await purgeUserData(clienteDeProduccion() as any, USUARIO);

    for (const s of peticiones[0].sentencias) {
      expect(s.query).toMatch(/^delete from "/i);
      // Nada de interpolar el id en el SQL, y nada de un DELETE sin filtro: un
      // `delete from "transactions"` sin `where` vaciaría la tabla de todos.
      expect(s.query).toMatch(/\swhere\s/i);
      expect(s.query).not.toContain(USUARIO);
      expect(s.params).toEqual([USUARIO]);
    }
  });

  it('el filtro es por la columna de propiedad, y `users` por su propia id', async () => {
    await purgeUserData(clienteDeProduccion() as any, USUARIO);

    const porTabla = new Map(
      peticiones[0].sentencias.map((s) => [tablaDe(s), s.query] as const),
    );
    for (const tabla of DELETION_ORDER.filter((t) => t !== 'users')) {
      expect(porTabla.get(tabla)).toContain(`"${tabla}"."user_id" = $1`);
    }
    expect(porTabla.get('users')).toContain('"users"."id" = $1');
  });

  it('dos usuarios distintos producen dos lotes distintos: el id no se queda pegado', async () => {
    await purgeUserData(clienteDeProduccion() as any, USUARIO);
    await purgeUserData(clienteDeProduccion() as any, OTRO_USUARIO);

    expect(peticiones).toHaveLength(2);
    expect(peticiones[0].sentencias.every((s) => s.params[0] === USUARIO)).toBe(true);
    expect(peticiones[1].sentencias.every((s) => s.params[0] === OTRO_USUARIO)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 3. Lo que NO puede aparecer en el lote (ADR-022 pto. 2, R-6, RN-01)
// ---------------------------------------------------------------------------

describe('SPEC-036 CA-6: en el lote de producción no hay nada compartido ni de más', () => {
  beforeEach(() => instalarDoble(respuestaOk));

  it('ninguna sentencia menciona `symbols`, `quotes` ni `quote_diagnostics`', async () => {
    await purgeUserData(clienteDeProduccion() as any, USUARIO);

    const sql = peticiones[0].sentencias.map((s) => s.query).join('\n');
    for (const compartida of SHARED_TABLES) {
      expect(sql).not.toContain(`"${compartida}"`);
    }
    // Escrito también sobre la lista de tablas, no solo sobre el texto, por si
    // mañana el SQL se genera con otras comillas.
    expect(tablasBorradas(peticiones[0].sentencias)).not.toContain('symbols');
  });

  it('`zone_triggers` NO lleva sentencia propia: cae por su `on delete cascade`', async () => {
    await purgeUserData(clienteDeProduccion() as any, USUARIO);

    expect(tablasBorradas(peticiones[0].sentencias)).not.toContain('zone_triggers');
    // Y no es un olvido: la cobertura lo declara `cascade`, colgando de
    // `watched_symbols`, que sí va en el lote y va ANTES que `users`.
    const zt = ACCOUNT_DELETION_COVERAGE.find((c) => c.table === 'zone_triggers');
    expect(zt?.via).toBe('cascade');
    expect(zt?.from).toBe('watched_symbols');
    const orden = tablasBorradas(peticiones[0].sentencias);
    expect(orden.indexOf('watched_symbols')).toBeLessThan(orden.indexOf('users'));
  });

  it('no se cuela ninguna sentencia que no sea un DELETE de la cobertura', async () => {
    await purgeUserData(clienteDeProduccion() as any, USUARIO);

    const declaradas = new Set(DELETION_ORDER);
    for (const tabla of tablasBorradas(peticiones[0].sentencias)) {
      expect(declaradas.has(tabla)).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// 4. Cuando el servidor dice que no
// ---------------------------------------------------------------------------

describe('SPEC-036 CA-7: un error del servidor propaga y nada se da por borrado', () => {
  it('un 400 del lote sube como error; `purgeUserData` no resuelve', async () => {
    instalarDoble(() => respuesta400('update or delete on table "users" violates foreign key'));

    await expect(purgeUserData(clienteDeProduccion() as any, USUARIO)).rejects.toThrow(
      /violates foreign key/,
    );
    // Salió una sola petición: no hay reintento silencioso ni troceo en seis.
    expect(peticiones).toHaveLength(1);
  });

  it('un fallo de red también sube: no se traduce a «borrado hecho»', async () => {
    neonConfig.fetchFunction = async () => {
      throw new Error('socket hang up');
    };

    await expect(purgeUserData(clienteDeProduccion() as any, USUARIO)).rejects.toThrow();
  });

  it('el error que sube es el del servidor, no uno inventado por nosotros', async () => {
    // Importa porque `src/app/cuenta/actions.ts` lo traduce a «no se ha borrado
    // nada, vuelve a intentarlo» y lo registra: si aquí se tragara el motivo, la
    // ventana de F-SPEC-036-1 no se podría investigar nunca.
    instalarDoble(() => respuesta400('deadlock detected'));

    await expect(purgeUserData(clienteDeProduccion() as any, USUARIO)).rejects.toThrow(
      'deadlock detected',
    );
  });
});

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

/** `delete from "notifications" where …` → `notifications`. */
function tablaDe(s: SentenciaEnviada): string {
  const m = s.query.match(/^delete from "([^"]+)"/i);
  expect(m, `no parece un DELETE reconocible: ${s.query}`).not.toBeNull();
  return m![1];
}

function tablasBorradas(sentencias: SentenciaEnviada[]): string[] {
  return sentencias.map(tablaDe);
}
