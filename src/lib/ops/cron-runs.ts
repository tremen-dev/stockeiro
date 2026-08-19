import { eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { cronRuns } from '@/db/schema';

type Db = PgDatabase<any, any, any>;

/**
 * El registro de ejecuciones del ciclo diario (SPEC-037 CA-14 a CA-17,
 * ADR-023 ptos. 11 a 16).
 *
 * LA FILA SE ABRE AL EMPEZAR Y SE CIERRA AL TERMINAR, y esa es toda la gracia.
 * `startedAt` se escribe ANTES de ingerir nada, así que una fila con `finishedAt`
 * nulo significa «empezó y no volvió» — el ciclo que revienta a mitad, que es
 * exactamente el caso que ninguna derivación de `quotes`/`quote_diagnostics` podía
 * detectar, y la razón de que esta tabla exista.
 *
 * FRONTERA NORMATIVA (ADR-023 pto. 15, CA-19). Este módulo **registra**. No alerta,
 * no envía correo, no escribe en `notifications` y no llama a nadie por HTTP. Lo dice
 * su lista de importaciones —tres— y `tests/ops-cron-runs.test.ts` la vigila leyendo
 * este fichero: si mañana aparece aquí un `sender`, el test se pone rojo antes de que
 * nadie tenga que discutirlo. La alerta proactiva al operador sigue siendo la idea
 * «Observabilidad del ciclo diario» del roadmap, y necesita su propia spec.
 *
 * Tampoco hay transacción: son dos escrituras independientes y **deben** serlo. Si se
 * envolvieran juntas, un ciclo que revienta haría rollback de su propia constancia —
 * justo lo contrario de lo que esta tabla existe para hacer. De paso, esto vale igual
 * en `neon-http` (que no tiene transacciones interactivas) que en PGlite.
 */

/** El desenlace de una ejecución. `null` en la fila mientras el ciclo corre. */
export type CronRunOutcome = 'success' | 'failure';

/** Los contadores que se cierran con la fila. Son los de `CycleResult`, no otros. */
export interface CronRunCounters {
  requested: number;
  updated: number;
  skipped: number;
  triggersOpened: number;
  triggersClosed: number;
  notificationsEntries: number;
  notificationsDigests: number;
}

/**
 * Abre la fila de una ejecución AUTORIZADA. Se llama después de `authorizeCron` y
 * antes de tocar el proveedor: un 401 no es una ejecución y no escribe fila (CA-17).
 */
export async function openCronRun(db: Db): Promise<string> {
  const [fila] = await db
    .insert(cronRuns)
    .values({ startedAt: new Date() })
    .returning({ id: cronRuns.id });
  return fila.id;
}

/** Cierra la fila con éxito y los contadores del ciclo (CA-14, CA-16). */
export async function closeCronRun(
  db: Db,
  id: string,
  counters: CronRunCounters,
): Promise<void> {
  await db
    .update(cronRuns)
    .set({ finishedAt: new Date(), outcome: 'success' satisfies CronRunOutcome, ...counters })
    .where(eq(cronRuns.id, id));
}

/**
 * Cierra la fila con el fallo (CA-15). Quien llama **vuelve a lanzar** la excepción:
 * registrar no puede tragarse el fallo, o el cron respondería 200 y nadie se
 * enteraría de nada — que es peor que no tener la tabla.
 *
 * El texto del error se guarda acotado: es una pista para el operador, no un volcado.
 */
export async function failCronRun(db: Db, id: string, error: unknown): Promise<void> {
  const texto = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  await db
    .update(cronRuns)
    .set({
      finishedAt: new Date(),
      outcome: 'failure' satisfies CronRunOutcome,
      error: texto.slice(0, 500),
    })
    .where(eq(cronRuns.id, id));
}
