import type { PgDatabase } from 'drizzle-orm/pg-core';
import type { MarketDataProvider } from './provider';
import { refreshQuotes, type RefreshResult } from './refresh';

type Db = PgDatabase<any, any, any>;

/**
 * Autorización del endpoint de cron (CA-7, ADR-004). Vercel Cron envía el secreto
 * en la cabecera `Authorization: Bearer <CRON_SECRET>`. Lógica PURA y testable, del
 * mismo modo que `guard.ts` para las rutas de sesión: el comportamiento probado es
 * el que corre en producción.
 *
 * Deniega si no hay secreto configurado (fail-closed) o si no coincide. La
 * comparación es de tiempo constante para no filtrar el secreto por timing.
 */
export function authorizeCron(authHeader: string | null | undefined, secret: string | undefined): boolean {
  if (!secret) return false; // sin secreto configurado -> denegar (fail-closed)
  if (!authHeader) return false;
  return constantTimeEquals(authHeader, `Bearer ${secret}`);
}

function constantTimeEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export interface CronEndpointDeps {
  authHeader: string | null | undefined;
  secret: string | undefined;
  db: Db;
  provider: MarketDataProvider;
}

export type CronEndpointOutcome =
  | { status: 401; body: { error: string } }
  | { status: 200; body: RefreshResult };

/**
 * Núcleo del endpoint de refresco (CA-7), inyectable para test: si la autorización
 * falla, responde 401 y NO ejecuta la ingesta; con el secreto correcto, refresca.
 */
export async function runCronRefresh(deps: CronEndpointDeps): Promise<CronEndpointOutcome> {
  if (!authorizeCron(deps.authHeader, deps.secret)) {
    return { status: 401, body: { error: 'unauthorized' } };
  }
  const result = await refreshQuotes(deps.db, deps.provider);
  return { status: 200, body: result };
}
