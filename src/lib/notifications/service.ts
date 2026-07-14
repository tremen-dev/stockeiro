import { and, desc, eq, isNull, max } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { notifications, zoneTriggers, symbols, quotes, users, type Notification } from '@/db/schema';
import { findByIdForOwner } from '@/lib/data/ownership';
import type { NotificationSender, NotificationMessage } from './sender';

type Db = PgDatabase<any, any, any>;

type Status = 'sent' | 'failed';

/** Intenta enviar; nunca lanza. Devuelve el estado a persistir (RN-15). */
async function deliver(sender: NotificationSender, msg: NotificationMessage): Promise<Status> {
  try {
    const { ok } = await sender.send(msg);
    return ok ? 'sent' : 'failed';
  } catch {
    return 'failed';
  }
}

function dateOf(d: Date): string {
  return d.toISOString().slice(0, 10);
}

const zoneEs = (kind: string) => (kind === 'buy' ? 'compra' : 'venta');

export interface NotifyResult {
  /** Avisos de entrada emitidos EN ESTA pasada (los ya notificados no se repiten). */
  entries: { userId: string; ticker: string; status: Status }[];
  /** Avisos agregados emitidos en esta pasada (uno por usuario y ciclo). */
  digests: { userId: string; status: Status }[];
}

interface OpenRow {
  triggerId: string;
  userId: string;
  ticker: string;
  zoneKind: string;
  price: string;
  asOf: Date;
  email: string;
}

/**
 * Notificación del ciclo (ADR-006, SPEC-006). Sobre los episodios de disparo ABIERTOS
 * (SPEC-005):
 *  - **Entrada (RN-14):** por cada episodio SIN aviso de entrada aún, emite uno y lo
 *    registra (único por `zoneTriggerId` → exactamente uno por episodio, idempotente).
 *  - **Permanencia (RN-14):** por cada usuario con episodios abiertos, un aviso agregado
 *    por (usuario, `cycleRef`) que los lista todos; se repite en ciclos posteriores
 *    (recordatorio) pero no dentro del mismo ciclo.
 * El aviso se REGISTRA siempre in-app (fuente de verdad/fallback, RN-15): si el envío
 * externo falla, la fila queda con `status='failed'` y el ciclo sigue con los demás.
 * Cada aviso lleva su `asOf` (D-2).
 *
 * `cycleRef` identifica el ciclo para la idempotencia del digest; por defecto se deriva
 * de la fecha del dato más reciente (`max(quote.asOf)`), así un reintento del mismo día
 * no duplica y el día siguiente sí genera un nuevo recordatorio.
 */
export async function notifyCycle(
  db: Db,
  sender: NotificationSender,
  opts: { cycleRef?: string } = {},
): Promise<NotifyResult> {
  let cycleRef = opts.cycleRef;
  if (!cycleRef) {
    const [row] = await db.select({ m: max(quotes.asOf) }).from(quotes);
    if (!row?.m) return { entries: [], digests: [] }; // sin cotizaciones: nada que notificar
    cycleRef = dateOf(new Date(row.m));
  }

  const open: OpenRow[] = await db
    .select({
      triggerId: zoneTriggers.id,
      userId: zoneTriggers.userId,
      ticker: symbols.ticker,
      zoneKind: zoneTriggers.zoneKind,
      price: zoneTriggers.price,
      asOf: zoneTriggers.asOf,
      email: users.email,
    })
    .from(zoneTriggers)
    .innerJoin(symbols, eq(zoneTriggers.symbolId, symbols.id))
    .innerJoin(users, eq(zoneTriggers.userId, users.id))
    .where(isNull(zoneTriggers.closedAt))
    .orderBy(zoneTriggers.userId, symbols.ticker);

  // --- Aviso de ENTRADA: uno por episodio sin aviso previo (idempotente, RN-14) ---
  const entries: NotifyResult['entries'] = [];
  for (const ep of open) {
    const [already] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(eq(notifications.zoneTriggerId, ep.triggerId))
      .limit(1);
    if (already) continue; // ya notificado -> no se repite (CA-2)

    const status = await deliver(sender, {
      to: ep.email,
      subject: `${ep.ticker} entró en tu zona de ${zoneEs(ep.zoneKind)}`,
      body: `${ep.ticker} a ${ep.price} entró en tu zona de ${zoneEs(ep.zoneKind)} (asOf ${dateOf(ep.asOf)}).`,
    });
    await db
      .insert(notifications)
      .values({
        userId: ep.userId,
        kind: 'entry',
        zoneTriggerId: ep.triggerId,
        payload: `${ep.ticker} en zona de ${zoneEs(ep.zoneKind)} @ ${ep.price}`,
        channel: 'email',
        status,
        asOf: ep.asOf,
      })
      .onConflictDoNothing({ target: notifications.zoneTriggerId });
    entries.push({ userId: ep.userId, ticker: ep.ticker, status });
  }

  // --- Aviso AGREGADO de permanencia: uno por (usuario, cycleRef) (RN-14) ---
  const byUser = new Map<string, OpenRow[]>();
  for (const ep of open) {
    const list = byUser.get(ep.userId) ?? [];
    list.push(ep);
    byUser.set(ep.userId, list);
  }

  const digests: NotifyResult['digests'] = [];
  for (const [userId, eps] of byUser) {
    const [already] = await db
      .select({ id: notifications.id })
      .from(notifications)
      .where(and(eq(notifications.userId, userId), eq(notifications.kind, 'digest'), eq(notifications.cycleRef, cycleRef)))
      .limit(1);
    if (already) continue; // ya hay digest de este ciclo (CA-4 dentro del ciclo)

    const lista = eps.map((e) => `${e.ticker} (${zoneEs(e.zoneKind)})`).join(', ');
    const digestAsOf = eps.reduce((m, e) => (e.asOf > m ? e.asOf : m), eps[0].asOf);
    const status = await deliver(sender, {
      to: eps[0].email,
      subject: `Resumen: ${eps.length} acción(es) en zona`,
      body: `Siguen en zona: ${lista}. (asOf ${cycleRef})`,
    });
    await db
      .insert(notifications)
      .values({
        userId,
        kind: 'digest',
        cycleRef,
        payload: `Permanencia en zona: ${lista}`,
        channel: 'email',
        status,
        asOf: digestAsOf,
      })
      .onConflictDoNothing({ target: [notifications.userId, notifications.cycleRef] });
    digests.push({ userId, status });
  }

  return { entries, digests };
}

export interface NotificationView {
  id: string;
  kind: string;
  payload: string;
  status: string;
  asOf: Date;
  createdAt: Date;
}

/** CA-5/CA-6: historial de avisos de un usuario (SOLO suyos, RN-01), con asOf y estado. */
export async function listNotificationsForUser(db: Db, userId: string): Promise<NotificationView[]> {
  const rows = await db
    .select({
      id: notifications.id,
      kind: notifications.kind,
      payload: notifications.payload,
      status: notifications.status,
      asOf: notifications.asOf,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt));
  return rows as NotificationView[];
}

/** CA-6: acceso a un aviso por id SOLO si es del usuario (aislamiento RN-01). */
export function getNotificationForOwner(db: Db, id: string, userId: string): Promise<Notification | null> {
  return findByIdForOwner(db, notifications, id, userId);
}
