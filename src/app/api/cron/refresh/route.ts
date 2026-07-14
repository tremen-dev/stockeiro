import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { runCronCycle } from '@/lib/triggers/cycle';
import { TwelveDataProvider } from '@/lib/market/twelve-data-provider';

/**
 * Endpoint del ciclo de refresco diario (SPEC-004 + SPEC-005, ADR-004/ADR-005). Lo
 * dispara Vercel Cron (ver crons en la config de despliegue), que envía
 * `Authorization: Bearer <CRON_SECRET>`. Sin el secreto correcto se rechaza (CA-7).
 *
 * Está fuera del `matcher` del middleware de sesión (excluye `/api`): la protección
 * es el `CRON_SECRET`, no la sesión de usuario. El ciclo (ingesta de cotizaciones +
 * evaluación de disparos por zona) vive en `runCronCycle` (testable con proveedor
 * fake); aquí solo se inyectan db, proveedor real y env.
 */
export async function GET(req: Request): Promise<Response> {
  const outcome = await runCronCycle({
    authHeader: req.headers.get('authorization'),
    secret: process.env.CRON_SECRET,
    db,
    provider: new TwelveDataProvider(),
  });
  return NextResponse.json(outcome.body, { status: outcome.status });
}
