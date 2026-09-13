import { and, asc, eq, inArray } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { symbolLinks, symbolNotes, watchedSymbols } from '@/db/schema';
import {
  LIMITE_ENLACES_POR_SIMBOLO,
  LIMITE_NOTA_CARACTERES,
} from '@/lib/config/limites-contexto';
import { normalizarEnlace, type MotivoEnlaceInvalido } from './enlace';

type Db = PgDatabase<any, any, any>;

/**
 * SPEC-063 — **el contexto que un usuario pone a un símbolo**: su nota y sus enlaces.
 *
 * ## Las tres propiedades que este módulo defiende
 *
 * 1. **Es de un solo usuario.** Toda lectura y toda escritura filtran por `userId`
 *    (RN-01). No hay ni una consulta aquí que pueda devolver lo de otro, y borrar por id
 *    ajeno **no borra nada** en vez de fallar: el id ajeno es indistinguible de uno que no
 *    existe, igual que en `findByIdForOwner`.
 * 2. **Sobrevive a dejar de vigilar.** Nada de esto cuelga de `watched_symbols`, así que
 *    `unwatch` no lo toca. Lo único que se lo lleva es el borrado de cuenta (ADR-022).
 * 3. **La app no lo interpreta.** Se guarda, se lee y se enseña a su dueño. No entra en
 *    ningún cálculo, en ningún aviso y en ninguna petición al proveedor — y **no se visita
 *    ninguna URL** (EPIC-009 CE-4): este fichero no llama a `fetch` ni lo hará.
 */

export interface Enlace {
  id: string;
  url: string;
  label: string | null;
}

export interface ContextoDeSimbolo {
  note: string | null;
  enlaces: Enlace[];
}

export const CONTEXTO_VACIO: ContextoDeSimbolo = { note: null, enlaces: [] };

/** Por qué se rechaza una escritura. Los de enlace vienen de `enlace.ts`. */
export type MotivoRechazo = MotivoEnlaceInvalido | 'nota_demasiado_larga' | 'demasiados_enlaces';

export const MOTIVO_RECHAZO_TEXTO: Record<'nota_demasiado_larga' | 'demasiados_enlaces', string> = {
  nota_demasiado_larga: `La nota no puede pasar de ${LIMITE_NOTA_CARACTERES} caracteres.`,
  demasiados_enlaces: `Ya tienes ${LIMITE_ENLACES_POR_SIMBOLO} enlaces en esta acción; quita uno para añadir otro.`,
};

export type ResultadoEscritura = { ok: true } | { ok: false; motivo: MotivoRechazo; detalle?: string };

/**
 * **Guarda la nota** de un símbolo, o la borra si queda vacía (CA-2, CA-6).
 *
 * Vaciar **borra la fila** en vez de guardar una cadena vacía: una nota vacía y no tener
 * nota son la misma cosa para el usuario, y dejar filas en blanco haría que la señal de la
 * lista mintiera («esta acción tiene contexto» sobre una nota que no existe).
 *
 * Vaciar la nota **no toca los enlaces**: son dos cosas (CA-6).
 */
export async function guardarNota(
  db: Db,
  userId: string,
  symbolId: string,
  texto: string,
): Promise<ResultadoEscritura> {
  const nota = (texto ?? '').trim();
  if (nota.length > LIMITE_NOTA_CARACTERES) {
    return { ok: false, motivo: 'nota_demasiado_larga' };
  }

  if (nota === '') {
    await db
      .delete(symbolNotes)
      .where(and(eq(symbolNotes.userId, userId), eq(symbolNotes.symbolId, symbolId)));
    return { ok: true };
  }

  await db
    .insert(symbolNotes)
    .values({ userId, symbolId, note: nota })
    .onConflictDoUpdate({
      // `(user_id, symbol_id)` es único: escribir otra nota SUSTITUYE, no acumula (CA-2).
      target: [symbolNotes.userId, symbolNotes.symbolId],
      set: { note: nota, updatedAt: new Date() },
    });
  return { ok: true };
}

/**
 * **Añade un enlace** (CA-11, CA-14).
 *
 * El tope se comprueba **contando lo que hay**, no confiando en la pantalla: la acción de
 * servidor es alcanzable sin pasar por el formulario, y un tope que sólo vive en la UI no
 * es un tope.
 *
 * `position` se calcula como «uno más que el mayor», de modo que **añadir no reordena** lo
 * que ya estaba (CA-2).
 */
export async function anadirEnlace(
  db: Db,
  userId: string,
  symbolId: string,
  url: string,
  label?: string | null,
): Promise<ResultadoEscritura> {
  const normalizado = normalizarEnlace(url, label);
  if (!normalizado.ok) return normalizado;

  const existentes = await db
    .select({ position: symbolLinks.position })
    .from(symbolLinks)
    .where(and(eq(symbolLinks.userId, userId), eq(symbolLinks.symbolId, symbolId)));

  if (existentes.length >= LIMITE_ENLACES_POR_SIMBOLO) {
    return { ok: false, motivo: 'demasiados_enlaces' };
  }

  const siguiente = existentes.reduce((max, e) => Math.max(max, e.position ?? 0), -1) + 1;
  await db.insert(symbolLinks).values({
    userId,
    symbolId,
    url: normalizado.enlace.url,
    label: normalizado.enlace.label,
    position: siguiente,
  });
  return { ok: true };
}

/**
 * **Quita un enlace** (CA-6). Filtra por `userId` además de por id: un id ajeno no borra
 * nada y no dice que exista (RN-01, misma discreción que `findByIdForOwner`).
 */
export async function quitarEnlace(db: Db, userId: string, enlaceId: string): Promise<void> {
  await db
    .delete(symbolLinks)
    .where(and(eq(symbolLinks.id, enlaceId), eq(symbolLinks.userId, userId)));
}

/**
 * **El contexto de UN símbolo**, para el panel que abre la fila (CA-5).
 *
 * El orden de los enlaces es **total y estable** (CA-2): `position`, y después `createdAt`
 * e `id` para que dos filas con la misma posición —que no debería haberlas, pero el orden
 * no se apoya en esperanzas— no bailen entre dos lecturas.
 */
export async function contextoDeSimbolo(
  db: Db,
  userId: string,
  symbolId: string,
): Promise<ContextoDeSimbolo> {
  const [nota] = await db
    .select({ note: symbolNotes.note })
    .from(symbolNotes)
    .where(and(eq(symbolNotes.userId, userId), eq(symbolNotes.symbolId, symbolId)));

  const enlaces = await db
    .select({ id: symbolLinks.id, url: symbolLinks.url, label: symbolLinks.label })
    .from(symbolLinks)
    .where(and(eq(symbolLinks.userId, userId), eq(symbolLinks.symbolId, symbolId)))
    .orderBy(asc(symbolLinks.position), asc(symbolLinks.createdAt), asc(symbolLinks.id));

  return { note: nota?.note ?? null, enlaces };
}

/**
 * **Todo el contexto de un usuario, en una sola pasada** — dos consultas, no dos por fila.
 *
 * De aquí salen **las dos** cosas que la pantalla necesita: la **señal** de cada fila
 * (CA-9) y lo que se lee y se edita dentro del panel (CA-5). Sale de la misma lectura a
 * propósito: si la señal se calculara aparte, podrían discrepar — una fila diciendo «hay
 * nota» sobre un panel vacío es exactamente la clase de mentira pequeña que este proyecto
 * persigue.
 *
 * Lo que **no** está en el mapa no tiene contexto, que es lo que la fila necesita saber
 * para no pintar señal (las dos direcciones de CA-9).
 */
export async function contextosDeUsuario(
  db: Db,
  userId: string,
  symbolIds: readonly string[],
): Promise<Map<string, ContextoDeSimbolo>> {
  const contextos = new Map<string, ContextoDeSimbolo>();
  if (symbolIds.length === 0) return contextos;

  const ids = [...new Set(symbolIds)];

  const notas = await db
    .select({ symbolId: symbolNotes.symbolId, note: symbolNotes.note })
    .from(symbolNotes)
    .where(and(eq(symbolNotes.userId, userId), inArray(symbolNotes.symbolId, ids)));

  const enlaces = await db
    .select({
      id: symbolLinks.id,
      symbolId: symbolLinks.symbolId,
      url: symbolLinks.url,
      label: symbolLinks.label,
    })
    .from(symbolLinks)
    .where(and(eq(symbolLinks.userId, userId), inArray(symbolLinks.symbolId, ids)))
    .orderBy(asc(symbolLinks.position), asc(symbolLinks.createdAt), asc(symbolLinks.id));

  const deSimbolo = (symbolId: string): ContextoDeSimbolo => {
    const actual = contextos.get(symbolId);
    if (actual) return actual;
    const nuevo: ContextoDeSimbolo = { note: null, enlaces: [] };
    contextos.set(symbolId, nuevo);
    return nuevo;
  };

  for (const fila of notas) deSimbolo(fila.symbolId).note = fila.note;
  for (const fila of enlaces) {
    deSimbolo(fila.symbolId).enlaces.push({ id: fila.id, url: fila.url, label: fila.label });
  }
  return contextos;
}

/** ¿Esta fila lleva contexto? Pura, y **derivada** de lo que el panel enseña (CA-9). */
export function tieneContexto(contexto: ContextoDeSimbolo | undefined): boolean {
  if (!contexto) return false;
  return contexto.note !== null || contexto.enlaces.length > 0;
}

/**
 * El `symbolId` de una vigilada **del usuario**, o `null` si esa vigilada no es suya
 * (RN-01).
 *
 * Existe porque lo que viaja desde la pantalla es el id de la **fila de vigiladas** —es lo
 * que la tabla usa como `key` desde SPEC-024— y lo que este módulo guarda cuelga del
 * **símbolo**. La traducción se hace aquí, filtrando por dueño, para que ninguna acción
 * pueda escribir contexto sobre un símbolo a partir de una fila ajena.
 */
export async function simboloDeVigiladaPropia(
  db: Db,
  userId: string,
  watchedId: string,
): Promise<string | null> {
  const [fila] = await db
    .select({ symbolId: watchedSymbols.symbolId })
    .from(watchedSymbols)
    .where(and(eq(watchedSymbols.id, watchedId), eq(watchedSymbols.userId, userId)));
  return fila?.symbolId ?? null;
}
