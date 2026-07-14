'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/config';
import { db } from '@/db/client';
import { markNotificationRead, markAllRead } from '@/lib/notifications/service';

async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new Error('No autenticado');
  return session.user.id;
}

/** CA-8: marca un aviso como leído (idempotente, aislado por usuario en el servicio). */
export async function markReadAction(formData: FormData): Promise<void> {
  const userId = await requireUserId();
  const id = String(formData.get('id') ?? '').trim();
  if (id) {
    await markNotificationRead(db, id, userId);
    revalidatePath('/avisos');
    revalidatePath('/dashboard');
  }
}

/** CA-9: marca TODOS los avisos no leídos del usuario como leídos. */
export async function markAllReadAction(): Promise<void> {
  const userId = await requireUserId();
  await markAllRead(db, userId);
  revalidatePath('/avisos');
  revalidatePath('/dashboard');
}
