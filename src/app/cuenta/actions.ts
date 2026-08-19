'use server';

import { db } from '@/db/client';
import { auth, signOut } from '@/lib/auth/config';
import { deleteMyAccount } from '@/lib/account/deletion';
import { CUENTA_BORRADA_PATH } from '@/lib/account/routes';
import {
  ADMIN_NO_SE_BORRA,
  PASSWORD_INCORRECTA,
  REINTENTA,
  SESION_NO_VALIDA,
} from '@/lib/account/messages';

export type DeleteAccountState = { error: string } | undefined;

/**
 * SPEC-036 CA-3 / CA-10 / CA-11 — el borrado, tal y como lo pide una persona.
 *
 * Esta acción **no decide nada**: la identidad la comprueba `verifyCredentials` y el
 * rol lo comprueba `deleteMyAccount` leyendo la base (ADR-021 pto. 3). Aquí solo se
 * traduce el resultado a lo que un formulario sabe enseñar, y se cierra la sesión.
 *
 * Que la regla del `admin` viva abajo y no aquí es lo que hace CA-11 verdad: ocultar
 * el botón no cierra nada —la acción acepta `POST` mientras exista— y una guardia
 * escrita en la pantalla se queda corta en cuanto haya un segundo camino.
 *
 * La sesión se cierra con `signOut` y no con un `redirect` a secas: hay que retirar
 * la cookie. Las OTRAS sesiones de esa persona no necesitan nada (CA-9): sin fila en
 * `users` no hay época que revalidar, así que la frontera de Node las resuelve
 * anónimas en su siguiente petición (ADR-016).
 */
export async function deleteAccountAction(
  _prev: DeleteAccountState,
  formData: FormData,
): Promise<DeleteAccountState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: SESION_NO_VALIDA };

  const password = String(formData.get('password') ?? '');

  let result;
  try {
    result = await deleteMyAccount(db, userId, password);
  } catch (e) {
    // CA-7 / F-SPEC-036-1: si la transacción falló, falló ENTERA — no hay nada a
    // medias que arreglar y el remedio es repetir. Se traga el error para no
    // enseñarle a alguien una pantalla de Next, pero se deja rastro en el servidor:
    // esta ventana es de milisegundos y como se pierda no se investiga nunca.
    console.error('[SPEC-036] el borrado de cuenta falló y se revirtió entero', e);
    return { error: REINTENTA };
  }

  if (!result.ok) {
    return {
      error:
        result.reason === 'admin-role'
          ? ADMIN_NO_SE_BORRA
          : result.reason === 'invalid-password'
            ? PASSWORD_INCORRECTA
            : SESION_NO_VALIDA,
    };
  }

  // Lanza NEXT_REDIRECT: va fuera de cualquier try, como en `logoutAction`.
  await signOut({ redirectTo: CUENTA_BORRADA_PATH });
  return undefined;
}
