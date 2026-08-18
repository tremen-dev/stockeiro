'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/config';
import { db } from '@/db/client';
import { watchSymbol, unwatch, type WatchInput } from '@/lib/watchlist/service';
import { readSymbolSelection } from '@/lib/market/symbol-selection';
import { readDecimalField } from '@/lib/format/decimal-input';
import { toFormError } from '@/lib/format/action-error';

export type FormState = { error: string } | { ok: true } | undefined;

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('No autenticado');
  return session.user.id;
}

/**
 * Las cuatro zonas, leídas por la única puerta de entrada numérica (SPEC-030 CA-13).
 * Lanza `InvalidNumberError` con el campo, el valor y el motivo; un campo vacío es
 * ausencia (`null`), y de la validación del par sigue encargándose RN-10 en el servicio.
 */
function readZones(formData: FormData): WatchInput {
  return {
    buyMin: readDecimalField(formData, 'buyMin'),
    buyMax: readDecimalField(formData, 'buyMax'),
    sellMin: readDecimalField(formData, 'sellMin'),
    sellMax: readDecimalField(formData, 'sellMax'),
  };
}

/** Vigilar un ticker con zonas opcionales (CA-1/CA-2/CA-4). */
export async function watchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const selection = readSymbolSelection(formData);
  if (!selection) return { error: 'Busca y elige una acción de la lista.' };

  // SPEC-030: la normalización va FUERA del try del servicio. Así el cajón de sastre
  // queda reducido a lo que de verdad es infraestructura, y quien escribe «12,5» lee un
  // error que nombra su campo y su valor en vez del mensaje genérico de antes.
  let zones: WatchInput;
  try {
    zones = readZones(formData);
  } catch (e) {
    return toFormError('vigilar', e);
  }

  try {
    await watchSymbol(
      db,
      userId,
      selection.ticker,
      selection.currency,
      zones,
      selection.market,
    );
  } catch (e) {
    return toFormError('vigilar', e);
  }
  revalidatePath('/vigiladas');
  return { ok: true };
}

/**
 * Dejar de vigilar la acción vigilada señalada (CA-5 de SPEC-003; SPEC-024).
 * Viaja el `id` de la acción vigilada, no el ticker: con el mismo ticker en dos
 * mercados, el ticker no identifica la fila (ADR-007). Tolerante con el campo
 * ausente (CA-12): no hay nada que quitar, así que no se hace nada.
 */
export async function removeAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const watchedId = String(formData.get('watchedId') ?? '').trim();
  if (watchedId) {
    await unwatch(db, userId, watchedId);
    revalidatePath('/vigiladas');
  }
}
