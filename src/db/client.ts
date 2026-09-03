import type { PgDatabase } from 'drizzle-orm/pg-core';
import { drizzle as drizzleNeon } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import { drizzle as drizzlePg } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

/**
 * Cliente de base de datos, INTERCAMBIABLE por driver (ADR-001, RED-1):
 * - `DB_DRIVER` ausente o `DB_DRIVER=neon`: Neon Postgres serverless en producción.
 * - `DB_DRIVER=pg`: Postgres estándar (driver postgres-js), para desarrollo o
 *   para el e2e contra una instancia local efímera.
 * - **Cualquier otro valor: se rechaza al arrancar** (SPEC-060 CA-14).
 *
 * En ambos casos el resto de la app depende solo de `db` (un PgDatabase de
 * Drizzle), no del driver concreto. Los tests unitarios usan `test-db.ts` (PGlite).
 *
 * ## Por qué el valor no reconocido LANZA y no degrada
 *
 * Hasta el 2026-09-03 esto era `process.env.DB_DRIVER ?? 'neon'` con
 * `driver === 'pg' ? … : neon`: **sólo `pg` desviaba y todo lo demás caía en Neon,
 * en silencio, sin excepción, sin aviso y sin log**. Y `docs/fundacion/contexto.md`
 * —el documento que `CLAUDE.md` manda leer el primero— llevaba desde el 2026-08-23
 * recomendando `postgres-js`, un nombre que este módulo nunca ha reconocido. Quien
 * lo copiaba creyendo apuntar a su Postgres local **acababa hablando con el de
 * producción y no se enteraba**, con la `DATABASE_URL` que tuviera a mano — que en
 * este proyecto es compartida entre Production y Preview (F-SPEC-023-1).
 *
 * El idioma de la casa es fallar cerrado: `authorizeCron` deniega sin secreto
 * configurado, `scripts/guard-migrate.mjs` corta el build por omisión y
 * `appBaseUrl()` (SPEC-055) rechaza el valor envenenado **con sujeto** en vez de
 * estallar río abajo con un `Invalid URL` mudo. Este rechazo sigue ese molde, y no
 * abre una clase de fallo nueva: el módulo **ya lanza al importarse** si falta
 * `DATABASE_URL`, y lleva así desde ADR-001. *Avisar y seguir* se rechazó por
 * escrito en la spec: una línea de log en una función serverless que nadie lee no
 * impide la escritura, y lo que hay que impedir aquí es la escritura.
 */

/**
 * **Los valores de `DB_DRIVER` que este módulo reconoce.** Único sitio donde vive el
 * conjunto: de aquí salen **la decisión**, **el texto del mensaje de error** y la
 * mitad del código de la guardia de SPEC-060 CA-3, que lo lee de este fichero en vez
 * de teclearlo. Es ADR-040 pto. 1 aplicado al propio arreglo: si el mensaje repitiera
 * la lista, la entrega que cura una copia nacería con otra dentro.
 *
 * El primero es el **valor por defecto**: el que rige cuando la variable no está, que
 * es como corre producción.
 */
export const DRIVERS_RECONOCIDOS = ['neon', 'pg'] as const;

export type DriverReconocido = (typeof DRIVERS_RECONOCIDOS)[number];

/** Delimitado para que se vean los espacios y las comillas que trae el valor (molde de `appBaseUrl()`). */
function delimitar(valor: string): string {
  return `«${valor}»`;
}

/**
 * El driver configurado, o un rechazo que nombra **la clave**, **el valor recibido**,
 * **los valores reconocidos** y **dónde mirar**.
 *
 * La variable **ausente** —y la ausente incluye la cadena vacía, que no expresa
 * ninguna intención— significa el valor por defecto, exactamente como hasta hoy: en
 * producción `DB_DRIVER` no está definida (no aparece en `vercel.json` ni en los
 * workflows, y en `.env.example` está comentada), así que la rama del rechazo **no se
 * puede alcanzar allí**. Sólo lanza cuando alguien **escribió** un valor a propósito,
 * que es justo el caso en que cree estar apuntando a un sitio y está apuntando a otro.
 *
 * **No se normaliza nada**: `PG` en mayúsculas se rechaza igual que `postgress`.
 * Reconocer variantes sería adivinar la intención, y adivinar es lo que trajo el
 * defecto.
 */
export function resolverDriver(
  env: Record<string, string | undefined> = process.env,
): DriverReconocido {
  const crudo = env.DB_DRIVER;
  if (crudo === undefined || crudo === '') return DRIVERS_RECONOCIDOS[0];
  if ((DRIVERS_RECONOCIDOS as readonly string[]).includes(crudo)) return crudo as DriverReconocido;

  const reconocidos = DRIVERS_RECONOCIDOS.map((v) => `\`${v}\``).join(' o ');
  throw new Error(
    `DB_DRIVER no reconocido: ${delimitar(crudo)}. ` +
      `Los únicos valores reconocidos son ${reconocidos}; sin la variable rige ` +
      `\`${DRIVERS_RECONOCIDOS[0]}\`. ` +
      'Dónde mirar: `.env.example` declara la clave y `src/db/client.ts` es quien decide. ' +
      'Se rechaza al arrancar en vez de caer en el driver por defecto porque eso ' +
      'significaría hablar con la base de producción creyendo estar en local.',
  );
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL no definida. Configúrala (ver .env.example).');
}

const driver = resolverDriver();

export const db: PgDatabase<any, any, any> =
  driver === 'pg'
    ? drizzlePg(postgres(connectionString, { max: 5, ssl: false }), { schema })
    : drizzleNeon(neon(connectionString), { schema });
