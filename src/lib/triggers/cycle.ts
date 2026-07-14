import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { MarketDataProvider } from '@/lib/market/provider';
import { authorizeCron } from '@/lib/market/cron';
import { refreshQuotes, type RefreshResult } from '@/lib/market/refresh';
import { evaluateTriggers, type EvaluationResult } from './service';
import type { NotificationSender } from '@/lib/notifications/sender';
import { notifyCycle, type NotifyResult } from '@/lib/notifications/service';

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
    return { status: 401, body: { error: 'unauthorized' } };
  }
  const { refresh, triggers, notifications } = await runRefreshCycle(deps.db, deps.provider, deps.sender);
  return {
    status: 200,
    body: {
      refresh,
      triggers: { opened: triggers.opened.length, closed: triggers.closed.length },
      ...(notifications
        ? { notifications: { entries: notifications.entries.length, digests: notifications.digests.length } }
        : {}),
    },
  };
}
