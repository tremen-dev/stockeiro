'use server';

import { revalidatePath } from 'next/cache';
import { auth } from '@/lib/auth/config';
import { db } from '@/db/client';
import {
  watchSymbol,
  unwatch,
  updateWatchedZones,
  type WatchInput,
} from '@/lib/watchlist/service';
import { refreshSymbolOnDemand } from '@/lib/market/refresh';
import { quoteProvider } from '@/lib/market/quote-provider-factory';
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

/**
 * Vigilar un ticker con zonas opcionales (CA-1/CA-2/CA-4).
 *
 * ## SPEC-058 / ADR-038 — el alta **trae su precio**, y el orden no es casual
 *
 * Hasta esta spec el alta metía el símbolo en el universo del ciclo y ahí acababa su
 * trabajo: hasta **24 h** de fila muda, o enseñando el precio congelado del día en que
 * ese símbolo salió del universo. Ahora el alta **pide el precio de ese símbolo** por el
 * **mismo camino que el ciclo** —`refreshSymbolOnDemand`, que es `ingerir` con universo
 * de uno (RN-17, ADR-038 pto. 2)— y lo persiste.
 *
 * El orden es **escribir la vigilada → pedir el precio → revalidar**, y las tres cosas
 * están donde están a propósito:
 *
 *  - **La vigilada se persiste ANTES.** El precio es un extra, **jamás** un requisito del
 *    alta (RN-17 c, ADR-038 pto. 4): acierte el proveedor, falle clasificado, lance o se
 *    quede sin presupuesto, lo que queda en `watched_symbols` y lo que esta action
 *    devuelve son **indistinguibles** en los cuatro casos (CA-9).
 *  - **El refresco va en su propio `try/catch`.** Es defensa en profundidad sobre una
 *    función que ya degrada por dentro: si algún día deja de hacerlo, el alta sigue sin
 *    enterarse. Un fallo del tercero no puede convertirse en un error de formulario.
 *  - **La revalidación va DESPUÉS del refresco**, y esa es la línea que cumple CE-1: es
 *    lo que hace que el precio y el color de zona aparezcan en la respuesta a este mismo
 *    envío, sin que el usuario recargue (CA-3).
 *
 * Lo que esta action **sigue sin hacer** es comparar con las zonas y avisar: **RN-13** y
 * **RN-14** son del ciclo (D-2, ADR-038 pto. 3, gemelo de ADR-028 pto. 3). La pantalla
 * puede decir «En compra» hoy y el correo salir en el ciclo; eso es el diseño, y CA-11 se
 * encarga de que el usuario lo lea en la pantalla en vez de descubrirlo.
 */
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

  let vigilada;
  try {
    vigilada = await watchSymbol(
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

  try {
    await refreshSymbolOnDemand(db, quoteProvider(), vigilada.symbolId);
  } catch {
    // El precio es un extra (RN-17 c): si el refresco se cae de una forma que ni él
    // mismo contempla, el alta ya está hecha y no se entera.
  }

  revalidatePath('/vigiladas');
  return { ok: true };
}

/**
 * SPEC-044 / ADR-028 — **ajustar las zonas de una vigilada que ya existe**.
 *
 * La tercera server action de esta pantalla, junto a `watchAction` y `removeAction`, y la
 * que cierra el hueco que obligaba a **quitar y volver a vigilar** para mover un rango.
 * Ese rodeo no era equivalente: borraba el episodio por cascada (ADR-017), así que el
 * ciclo siguiente leía el precio dentro de la zona como una *entrada* y mandaba otro
 * correo por un gesto que no significa nada para el mercado.
 *
 * Tres cosas que esta action hace por construcción, no por vigilancia:
 *
 *  - **Valida por la misma puerta que el alta** (CA-15): el mismo `readZones` —o sea el
 *    mismo `readDecimalField`, SPEC-030 CA-13— y la misma `validatePair` del servicio
 *    (RN-10). No hay un normalizador de la edición ni una validación relajada para
 *    editar; si un día alguien afloja la validación, la afloja para las dos y lo cazan
 *    los tests de SPEC-030.
 *  - **La normalización va FUERA del try del servicio**, como fijó SPEC-030: así el cajón
 *    de sastre queda reducido a lo que de verdad es infraestructura y quien escribe
 *    «12,5» lee un error que nombra su campo y su valor (CA-14).
 *  - **No abre, no cierra y no notifica** (ADR-028 pto. 3). Valida, escribe y termina.
 *    Quien reconcilia con la zona nueva es el ciclo siguiente. Añadir aquí una llamada al
 *    motor «para que se vea al momento» reintroduce el aviso duplicado que esta spec vino
 *    a eliminar.
 *
 * Viaja el `id` de la acción vigilada, nunca el símbolo: cambiar el símbolo sería otra
 * vigilada (ADR-028 pto. 8). Un id ausente o manipulado no es una excepción — el servicio
 * responde «no hay nada que editar», igual que la baja (CA-18).
 */
export async function editZonesAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const userId = await requireUserId();
  const watchedId = String(formData.get('watchedId') ?? '').trim();

  let zones: WatchInput;
  try {
    zones = readZones(formData);
  } catch (e) {
    return toFormError('editar zonas', e);
  }

  try {
    await updateWatchedZones(db, userId, watchedId, zones);
  } catch (e) {
    return toFormError('editar zonas', e);
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
