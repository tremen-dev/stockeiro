import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { MarketDataProvider } from '@/lib/market/provider';
import { authorizeCron } from '@/lib/market/cron';
import { refreshQuotes, type RefreshResult } from '@/lib/market/refresh';
import { evaluateTriggers, type EvaluationResult } from './service';
import type { NotificationSender } from '@/lib/notifications/sender';
import { notifyCycle, type NotifyResult } from '@/lib/notifications/service';
import { closeCronRun, failCronRun, openCronRun } from '@/lib/ops/cron-runs';
import { purgeExpiredPendingAccounts } from '@/lib/registration/signup';

type Db = PgDatabase<any, any, any>;

export interface CycleResult {
  refresh: RefreshResult;
  triggers: { opened: number; closed: number };
  notifications?: { entries: number; digests: number };
}

/**
 * Ciclo de refresco completo (ADR-005/ADR-006): ingiere las cotizaciones (SPEC-004);
 * en la MISMA ejecución evalúa los disparos por zona (SPEC-005) sobre esas cotizaciones;
 * y, si se pasa un `sender`, notifica los avisos del ciclo (SPEC-006). El orden es
 * SIEMPRE ingesta → disparos → avisos. Sin `sender`, la notificación se omite (lo usan
 * los tests del motor de SPEC-005).
 */
export async function runRefreshCycle(
  db: Db,
  provider: MarketDataProvider,
  sender?: NotificationSender,
): Promise<{ refresh: RefreshResult; triggers: EvaluationResult; notifications: NotifyResult | null }> {
  const refresh = await refreshQuotes(db, provider);
  const triggers = await evaluateTriggers(db);
  const notifications = sender ? await notifyCycle(db, sender) : null;
  return { refresh, triggers, notifications };
}

export interface CronCycleDeps {
  authHeader: string | null | undefined;
  secret: string | undefined;
  db: Db;
  provider: MarketDataProvider;
  /** Canal de aviso (SPEC-006). Opcional: sin él, el ciclo no notifica. */
  sender?: NotificationSender;
  /**
   * SPEC-066 CA-19 — la purga de cuentas pendientes caducadas. Se inyecta sólo para que
   * un unitario la haga lanzar; por defecto es la real (ADR-042 pto. 11).
   */
  purgePending?: (db: Db) => Promise<number>;
}

export type CronCycleOutcome =
  | { status: 401; body: { error: string } }
  | { status: 200; body: CycleResult };

/**
 * Núcleo del endpoint de cron (ADR-004/ADR-005/ADR-006): reutiliza la autorización por
 * `CRON_SECRET` (SPEC-004) y, si pasa, ejecuta el ciclo completo (ingesta + disparos +
 * avisos). Sin secreto correcto → 401 y no se ejecuta nada (ni se notifica).
 */
export async function runCronCycle(deps: CronCycleDeps): Promise<CronCycleOutcome> {
  if (!authorizeCron(deps.authHeader, deps.secret)) {
    // SPEC-037 CA-17 / ADR-023 pto. 14: un 401 no es una ejecución. Se rechaza ANTES
    // de abrir la fila, así que quien sondee el endpoint no llena la tabla.
    return { status: 401, body: { error: 'unauthorized' } };
  }

  // SPEC-037 CA-14/CA-15/CA-16 — la constancia se abre ANTES de ingerir nada.
  const runId = await openCronRun(deps.db);

  let refresh: RefreshResult;
  let triggers: EvaluationResult;
  let notifications: NotifyResult | null;
  try {
    ({ refresh, triggers, notifications } = await runRefreshCycle(
      deps.db,
      deps.provider,
      deps.sender,
    ));
  } catch (e) {
    // Se cierra la fila con el error Y SE VUELVE A LANZAR (ADR-023 pto. 12):
    // registrar no puede tragarse el fallo. El endpoint sigue comportándose como hoy.
    await failCronRun(deps.db, runId, e);
    throw e;
  }

  const body: CycleResult = {
    refresh,
    triggers: { opened: triggers.opened.length, closed: triggers.closed.length },
    ...(notifications
      ? { notifications: { entries: notifications.entries.length, digests: notifications.digests.length } }
      : {}),
  };

  // Los contadores son los de `CycleResult`, no unos nuevos (ADR-023 pto. 13): lo que
  // se registra es literalmente lo que el endpoint ya devolvía y nadie leía. Se
  // derivan de `body` y no de las variables sueltas para que no puedan divergir.
  await closeCronRun(deps.db, runId, {
    requested: body.refresh.requested.length,
    updated: body.refresh.updated.length,
    skipped: body.refresh.skipped.length,
    triggersOpened: body.triggers.opened,
    triggersClosed: body.triggers.closed,
    notificationsEntries: body.notifications?.entries ?? 0,
    notificationsDigests: body.notifications?.digests ?? 0,
  });

  // SPEC-066 CA-19 / ADR-042 pto. 11 — la purga de cuentas pendientes caducadas, DESPUÉS
  // de cerrar la fila de `cron_runs` y con su fallo CONTENIDO: el ciclo es la promesa del
  // producto y una purga no puede tumbarlo; lo que no se purgue hoy se purga mañana. No
  // añade nada a la respuesta (ADR-023 pto. 16) ni a `cron_runs`.
  try {
    await (deps.purgePending ?? purgeExpiredPendingAccounts)(deps.db);
  } catch (e) {
    console.error(
      '[purga de cuentas pendientes] ha fallado; el ciclo ya había terminado y la respuesta no cambia:',
      e instanceof Error ? e.message : e,
    );
  }

  // CA-20: la respuesta NO cambia. La tabla es un registro ADICIONAL, no un
  // sustituto, y ningún consumidor existente se entera de que existe.
  return { status: 200, body };
}
