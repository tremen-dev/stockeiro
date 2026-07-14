'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/config';
import { db } from '@/db/client';
import { watchSymbol, unwatch, InvalidZoneError } from '@/lib/watchlist/service';
import { readSymbolSelection } from '@/lib/market/symbol-selection';

export type FormState = { error: string } | { ok: true } | undefined;

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('No autenticado');
  return session.user.id;
}

function opt(formData: FormData, key: string): string | null {
  const v = String(formData.get(key) ?? '').trim();
  return v === '' ? null : v;
}

/** Vigilar un ticker con zonas opcionales (CA-1/CA-2/CA-4). */
export async function watchAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const selection = readSymbolSelection(formData);
  if (!selection) return { error: 'Busca y elige una acción de la lista.' };
  try {
    await watchSymbol(
      db,
      userId,
      selection.ticker,
      selection.currency,
      {
        buyMin: opt(formData, 'buyMin'),
        buyMax: opt(formData, 'buyMax'),
        sellMin: opt(formData, 'sellMin'),
        sellMax: opt(formData, 'sellMax'),
      },
      selection.market,
    );
  } catch (e) {
    if (e instanceof InvalidZoneError) return { error: e.message };
    return { error: 'Datos inválidos.' };
  }
  revalidatePath('/vigiladas');
  return { ok: true };
}

/** Dejar de vigilar un ticker (CA-5). */
export async function removeAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const ticker = String(formData.get('ticker') ?? '').trim();
  if (ticker) {
    await unwatch(db, userId, ticker);
    revalidatePath('/vigiladas');
  }
}
