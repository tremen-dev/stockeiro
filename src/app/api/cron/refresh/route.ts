import { NextResponse } from 'next/server';
import { db } from '@/db/client';
import { runCronCycle } from '@/lib/triggers/cycle';
import { TwelveDataProvider } from '@/lib/market/twelve-data-provider';
import { ResendSender } from '@/lib/notifications/resend-sender';

/**
 * Endpoint del ciclo de refresco diario (SPEC-004 + SPEC-005 + SPEC-006,
 * ADR-004/ADR-005/ADR-006). Lo dispara Vercel Cron (ver crons en la config de
 * despliegue), que envía `Authorization: Bearer <CRON_SECRET>`. Sin el secreto
 * correcto se rechaza (CA-7).
 *
 * Está fuera del `matcher` del middleware de sesión (excluye `/api`): la protección
 * es el `CRON_SECRET`, no la sesión de usuario. El ciclo (ingesta de cotizaciones +
 * evaluación de disparos + envío de avisos) vive en `runCronCycle` (testable con
 * fakes); aquí solo se inyectan db, proveedor real, sender real y env.
 */
export async function GET(req: Request): Promise<Response> {
  const outcome = await runCronCycle({
    authHeader: req.headers.get('authorization'),
    secret: process.env.CRON_SECRET,
    db,
    provider: new TwelveDataProvider(),
    sender: new ResendSender(),
  });
  return NextResponse.json(outcome.body, { status: outcome.status });
}
