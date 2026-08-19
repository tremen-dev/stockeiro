import { count, desc } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { cronRuns, quoteDiagnostics, users, watchedSymbols } from '@/db/schema';
import { countUniverseSymbols } from '@/lib/market/refresh';
import { FAIL_REASON_TEXT } from '@/lib/market/fail-reason-text';
import type { QuoteFailureReason } from '@/lib/market/provider';
import { registrationState, type RegistrationSettings, type RegistrationState } from '@/lib/registration/gate';
import { countAccounts, readRegistrationSettings } from '@/lib/registration/service';

type Db = PgDatabase<any, any, any>;

/**
 * Lo que la pantalla de operación SABE (SPEC-037 CA-13, CA-18, CA-22, CA-23).
 *
 * Dos propiedades gobiernan este módulo, y las dos son de la spec, no de gusto:
 *
 * 1. **CUENTA FILAS, NO LISTA PERSONAS** (RN-01, ADR-023 pto. 10, CA-22). Aquí no
 *    hay ningún `select` que devuelva una fila de usuario, ni un email, ni un ticker
 *    de la cartera o de las vigiladas de nadie. Todo lo que sale de aquí son
 *    agregados y estado operativo. No es una omisión que haya que recordar al pintar
 *    la pantalla: es que el dato **no llega**. Una pantalla de operación que empieza
 *    listando emails termina siendo un panel de administración de personas.
 *
 * 2. **PREGUNTA POCO** (CE-7, CA-23). El número de consultas es CONSTANTE: no crece
 *    con el número de cuentas ni con el de símbolos, y ninguna trae un conjunto de
 *    filas que dependa del volumen. Los cinco segundos de CE-7 se garantizan por la
 *    forma de las consultas, no por un cronómetro que un día va lento y tumba la CI.
 *    El único `select` que no es una agregación es el del último ciclo, que trae
 *    exactamente UNA fila por `LIMIT 1`.
 *
 * Y una frontera que conviene releer antes de añadir nada (ADR-023 pto. 15, CA-19):
 * esto **registra y muestra**. No alerta a nadie, no manda correo y no escribe en
 * `notifications`. Si algún día hace falta avisar al operador, será con su spec.
 */

/** Los símbolos sin precio, agrupados por el motivo del dominio (SPEC-016). */
export interface WithoutPriceReason {
  reason: QuoteFailureReason;
  /** El motivo dicho en castellano, del mismo sitio del que lo lee el usuario. */
  text: string;
  count: number;
}

/** El último ciclo, tal y como quedó registrado. Sin `userId`: no es de nadie. */
export interface LastCycle {
  startedAt: Date;
  /** null = empezó y no volvió (ADR-023 pto. 12). */
  finishedAt: Date | null;
  outcome: string | null;
  requested: number | null;
  updated: number | null;
  skipped: number | null;
  triggersOpened: number | null;
  triggersClosed: number | null;
  notificationsEntries: number | null;
  notificationsDigests: number | null;
  error: string | null;
}

export interface OperationSnapshot {
  /** Cuentas vivas. Es también el número que consume el cupo (ADR-022 pto. 9). */
  accounts: number;
  /** Filas de vigilancia: cuántas acciones se están vigilando en total. */
  watchedSymbols: number;
  /** Símbolos del universo del ciclo: `watched_symbols ∪ transactions`. */
  cycleSymbols: number;
  symbolsWithoutPrice: { total: number; byReason: WithoutPriceReason[] };
  registration: { settings: RegistrationSettings; state: RegistrationState };
  /** null = el ciclo NO HA CORRIDO NUNCA (CA-18). No es un cero ambiguo. */
  lastCycle: LastCycle | null;
}

export async function readOperationSnapshot(db: Db): Promise<OperationSnapshot> {
  const [accounts, watched, cycleSymbols, diagnosticos, settings, ultimo] = await Promise.all([
    countAccounts(db),
    contarVigiladas(db),
    countUniverseSymbols(db),
    contarSinPrecio(db),
    readRegistrationSettings(db),
    leerUltimoCiclo(db),
  ]);

  return {
    accounts,
    watchedSymbols: watched,
    cycleSymbols,
    symbolsWithoutPrice: {
      total: diagnosticos.reduce((acc, d) => acc + d.count, 0),
      byReason: diagnosticos,
    },
    registration: { settings, state: registrationState(settings, accounts) },
    lastCycle: ultimo,
  };
}

async function contarVigiladas(db: Db): Promise<number> {
  const [fila] = await db.select({ n: count() }).from(watchedSymbols);
  return Number(fila?.n ?? 0);
}

/**
 * Agrupación por motivo: como mucho tantas filas como motivos hay en el dominio
 * (cinco hoy), pase lo que pase con el volumen. Un número mudo no cumpliría CA-13.
 */
async function contarSinPrecio(db: Db): Promise<WithoutPriceReason[]> {
  const filas = await db
    .select({ reason: quoteDiagnostics.reason, n: count() })
    .from(quoteDiagnostics)
    .groupBy(quoteDiagnostics.reason)
    .orderBy(quoteDiagnostics.reason);

  return filas.map((f) => {
    const reason = f.reason as QuoteFailureReason;
    return { reason, text: FAIL_REASON_TEXT[reason] ?? reason, count: Number(f.n) };
  });
}

/**
 * La ÚLTIMA fila por `started_at`, y solo esa (spec §Fuera de alcance: nada de
 * series históricas ni comparativas — aquí se lee la última y punto).
 */
async function leerUltimoCiclo(db: Db): Promise<LastCycle | null> {
  const [fila] = await db
    .select({
      startedAt: cronRuns.startedAt,
      finishedAt: cronRuns.finishedAt,
      outcome: cronRuns.outcome,
      requested: cronRuns.requested,
      updated: cronRuns.updated,
      skipped: cronRuns.skipped,
      triggersOpened: cronRuns.triggersOpened,
      triggersClosed: cronRuns.triggersClosed,
      notificationsEntries: cronRuns.notificationsEntries,
      notificationsDigests: cronRuns.notificationsDigests,
      error: cronRuns.error,
    })
    .from(cronRuns)
    .orderBy(desc(cronRuns.startedAt))
    .limit(1);
  return fila ?? null;
}
