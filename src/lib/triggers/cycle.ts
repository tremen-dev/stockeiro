import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { MarketDataProvider } from '@/lib/market/provider';
import { authorizeCron } from '@/lib/market/cron';
import { refreshQuotes, type RefreshResult } from '@/lib/market/refresh';
import { evaluateTriggers, type EvaluationResult } from './service';

type Db = PgDatabase<any, any, any>;

export interface CycleResult {
  refresh: RefreshResult;
  triggers: { opened: number; closed: number };
}

/**
 * Ciclo de refresco completo (ADR-005): ingiere las cotizaciones (SPEC-004) y, en la
 * MISMA ejecución y sobre esas cotizaciones, evalúa los disparos por zona (SPEC-005).
 * La evaluación corre SIEMPRE después del upsert de precios (CA-7).
 */
export async function runRefreshCycle(db: Db, provider: MarketDataProvider): Promise<{ refresh: RefreshResult; triggers: EvaluationResult }> {
  const refresh = await refreshQuotes(db, provider);
  const triggers = await evaluateTriggers(db);
  return { refresh, triggers };
}

export interface CronCycleDeps {
  authHeader: string | null | undefined;
  secret: string | undefined;
  db: Db;
  provider: MarketDataProvider;
}

export type CronCycleOutcome =
  | { status: 401; body: { error: string } }
  | { status: 200; body: CycleResult };

/**
 * Núcleo del endpoint de cron (ADR-004/ADR-005): reutiliza la autorización por
 * `CRON_SECRET` (SPEC-004) y, si pasa, ejecuta el ciclo completo (ingesta + disparos).
 * Sin secreto correcto → 401 y no se ejecuta nada.
 */
export async function runCronCycle(deps: CronCycleDeps): Promise<CronCycleOutcome> {
  if (!authorizeCron(deps.authHeader, deps.secret)) {
    return { status: 401, body: { error: 'unauthorized' } };
  }
  const { refresh, triggers } = await runRefreshCycle(deps.db, deps.provider);
  return {
    status: 200,
    body: { refresh, triggers: { opened: triggers.opened.length, closed: triggers.closed.length } },
  };
}
