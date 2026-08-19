/**
 * El grifo del registro: LA decisión, y nada más (SPEC-037 CA-2, ADR-023 ptos. 3 y 4).
 *
 * Función PURA, al margen de la base y de Next — el patrón de `isPublicPath`
 * (SPEC-001), `isSessionEpochCurrent` (ADR-016 pto. 7) y `canSee` (SPEC-034
 * / ADR-021 pto. 5). Este módulo NO importa nada, y esa carencia es su propiedad:
 * la matriz completa de la decisión se recorre en un test sin levantar una base de
 * datos, sin arrancar Auth.js y sin un solo `await`.
 *
 * Las dos condiciones del grifo son INDEPENDIENTES y la respuesta dice CUÁL de las
 * dos falló (ADR-023 pto. 3), porque quien llega con la puerta cerrada tiene que
 * leer POR QUÉ, no un error (R-7 de EPIC-004, CA-6). Un booleano pelado obligaría a
 * recomponer el motivo en la pantalla, y ahí es donde se desincroniza.
 */

/** Los ajustes del grifo, tal y como viven en su fila. `capacity` null = sin cupo. */
export interface RegistrationSettings {
  openManually: boolean;
  capacity: number | null;
}

/** Por qué está cerrado. Son dos motivos distintos porque se explican distinto. */
export type ClosedReason = 'manual' | 'capacity';

export type RegistrationState = { open: true } | { open: false; reason: ClosedReason };

/**
 * La semilla (ADR-023 pto. 7): abierto y con cupo 50, fijado por el humano el
 * 2026-08-19. Vive en UNA constante nombrada porque tiene dos usos y deben decir lo
 * mismo: es lo que siembra la migración, y es también la respuesta si la fila
 * faltara. Cerrar el registro por una fila ausente sería matar el objetivo de la
 * épica en silencio.
 *
 * Es SEMILLA, NO POLÍTICA: se cambia desde `/admin` sin desplegar (CA-7/CA-21).
 */
export const SEED_REGISTRATION_SETTINGS: RegistrationSettings = {
  openManually: true,
  capacity: 50,
};

/**
 * ¿Está abierto el registro? (ADR-023 pto. 3.)
 *
 * Abierto si y solo si `openManually` **y** (`capacity` es null **o** las cuentas son
 * ESTRICTAMENTE menores que el cupo). La comparación estricta es la frontera del CA:
 * con 50 cuentas y cupo 50 el aforo está lleno, no queda una plaza.
 *
 * El motivo manual manda sobre el de cupo cuando fallan los dos: quien cerró el
 * grifo a propósito no quiere que se le diga a la gente que la app «se ha llenado».
 */
export function registrationState(
  settings: RegistrationSettings,
  accounts: number,
): RegistrationState {
  if (!settings.openManually) return { open: false, reason: 'manual' };
  if (settings.capacity !== null && accounts >= settings.capacity) {
    return { open: false, reason: 'capacity' };
  }
  return { open: true };
}

export type ParsedCapacity = { ok: true; value: number | null } | { ok: false };

/**
 * Qué es un cupo válido (CA-21). Vive aquí, junto a la decisión, y no dentro de la
 * server action: así se puede saber qué se acepta sin levantar Next.
 *
 * - Vacío o ausente = **sin cupo** (`null`), que es un valor legítimo y no un error.
 * - Entero no negativo = ese cupo. El `0` vale: es «cerrado por aforo», distinto de
 *   «cerrado a mano», y alguien puede querer justo eso.
 * - Negativo, decimal, notación científica o cualquier cosa que no sea un entero
 *   escrito en claro: se **rechaza**, y quien llama no modifica nada.
 */
export function parseCapacity(raw: unknown): ParsedCapacity {
  if (raw === null || raw === undefined) return { ok: true, value: null };
  if (typeof raw === 'number') {
    return Number.isInteger(raw) && raw >= 0 ? { ok: true, value: raw } : { ok: false };
  }
  if (typeof raw !== 'string') return { ok: false };
  const texto = raw.trim();
  if (texto === '') return { ok: true, value: null };
  // Solo dígitos: ni signo, ni punto decimal, ni `1e3`, ni espacios interiores.
  if (!/^\d+$/.test(texto)) return { ok: false };
  const valor = Number(texto);
  return Number.isSafeInteger(valor) ? { ok: true, value: valor } : { ok: false };
}
