import postgres from 'postgres';
import { DB_URL } from './roles';

/**
 * El grifo del registro y el registro del ciclo, en el e2e (SPEC-037 / ADR-023).
 *
 * Hermano de `tests/e2e/roles.ts`: la app corre en OTRO proceso, así que lo que aquí
 * se toca es la base directamente, exactamente igual que hace el operador cuando
 * mueve el interruptor desde `/admin` — solo que sin pasar por la pantalla, para
 * poder montar el escenario que cada test necesita.
 *
 * ## Una advertencia que hay que leer antes de tocar esto
 *
 * La base del e2e es **UNA sola, compartida por todas las specs**, y la migración
 * siembra el grifo con **cupo 50** (ADR-023 pto. 7). La suite entera registra del
 * orden de cuarenta y tantas cuentas: si alguna spec dejara el cupo bajo, o si el
 * censo llegara al tope, **todas las specs posteriores fallarían al registrarse**, y
 * el síntoma —«no aparece el formulario de alta»— no se parece en nada a la causa.
 *
 * Por eso los ficheros `admin*.spec.ts` —que son los primeros del directorio en
 * orden alfabético, y por tanto los primeros que corren— dejan el grifo **abierto y
 * sin cupo** al terminar, con `abrirDeParEnPar()`. Es también lo que hace que el
 * cupo sembrado se pueda verificar de verdad al principio (CA-1) sin condenar al
 * resto de la suite.
 */

export interface Grifo {
  openManually: boolean;
  capacity: number | null;
}

async function conSql<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/** El estado de la fila de ajustes AHORA. */
export async function leerGrifo(): Promise<Grifo> {
  return conSql(async (sql) => {
    const filas = await sql`SELECT open_manually, capacity FROM registration_settings`;
    if (filas.length !== 1) throw new Error(`registration_settings tiene ${filas.length} filas`);
    return {
      openManually: filas[0].open_manually as boolean,
      capacity: filas[0].capacity === null ? null : Number(filas[0].capacity),
    };
  });
}

/** Mueve el grifo por la base, como haría un `UPDATE` en Neon. */
export async function ponerGrifo(grifo: Grifo): Promise<void> {
  await conSql(async (sql) => {
    await sql`
      UPDATE registration_settings
      SET open_manually = ${grifo.openManually}, capacity = ${grifo.capacity}, updated_at = now()
    `;
  });
}

/** Deja el grifo abierto y sin tope. Lo que el resto de la suite necesita encontrar. */
export const abrirDeParEnPar = () => ponerGrifo({ openManually: true, capacity: null });

/** Cierra el grifo POR CUPO, sea cual sea el censo del momento. */
export async function llenarElAforo(): Promise<number> {
  const cuentas = await contarCuentas();
  await ponerGrifo({ openManually: true, capacity: cuentas });
  return cuentas;
}

/** Los cuatro números que la pantalla dice, leídos de la base. */
export async function censo(): Promise<{
  cuentas: number;
  vigiladas: number;
  simbolosDelCiclo: number;
  sinPrecio: number;
}> {
  return conSql(async (sql) => {
    const [{ n: cuentas }] = await sql`SELECT count(*)::int AS n FROM users`;
    const [{ n: vigiladas }] = await sql`SELECT count(*)::int AS n FROM watched_symbols`;
    const [{ n: simbolos }] = await sql`
      SELECT count(*)::int AS n FROM (
        SELECT symbol_id FROM watched_symbols
        UNION
        SELECT symbol_id FROM transactions
      ) universo
    `;
    const [{ n: sinPrecio }] = await sql`SELECT count(*)::int AS n FROM quote_diagnostics`;
    return {
      cuentas: Number(cuentas),
      vigiladas: Number(vigiladas),
      simbolosDelCiclo: Number(simbolos),
      sinPrecio: Number(sinPrecio),
    };
  });
}

export async function contarCuentas(): Promise<number> {
  return (await censo()).cuentas;
}

/** Borra el registro de ejecuciones: el punto de partida de «nunca ha corrido». */
export async function olvidarCiclos(): Promise<void> {
  await conSql(async (sql) => {
    await sql`DELETE FROM cron_runs`;
  });
}

export interface CicloRegistrado {
  startedAt: string;
  finishedAt: string | null;
  outcome: 'success' | 'failure' | null;
  requested?: number;
  updated?: number;
  skipped?: number;
}

/** Escribe a mano una ejecución registrada, para poder montar escenarios de CA-18. */
export async function anotarCiclo(c: CicloRegistrado): Promise<void> {
  await conSql(async (sql) => {
    await sql`
      INSERT INTO cron_runs
        (started_at, finished_at, outcome, requested, updated, skipped,
         triggers_opened, triggers_closed, notifications_entries, notifications_digests)
      VALUES
        (${c.startedAt}, ${c.finishedAt}, ${c.outcome},
         ${c.requested ?? null}, ${c.updated ?? null}, ${c.skipped ?? null},
         0, 0, 0, 0)
    `;
  });
}

/** Cuántas filas hay en `cron_runs` ahora mismo. */
export async function contarCiclos(): Promise<number> {
  return conSql(async (sql) => {
    const [{ n }] = await sql`SELECT count(*)::int AS n FROM cron_runs`;
    return Number(n);
  });
}
