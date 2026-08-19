'use server';

import { revalidatePath } from 'next/cache';
import { db } from '@/db/client';
import { sectionUserOrNull } from '@/lib/auth/session';
import { SECCION_NO_DISPONIBLE } from '@/lib/auth/section-messages';
import { parseCapacity } from '@/lib/registration/gate';
import { saveRegistrationSettings } from '@/lib/registration/service';

export type GateFormState = { error: string } | { ok: string } | undefined;

/** Lo que se le dice al operador cuando escribe un cupo que no es un cupo (CA-21). */
export const CUPO_INVALIDO =
  'El cupo tiene que ser un número entero de cero o más, o quedar vacío para no poner tope. No se ha cambiado nada.';

/** Acuse del cambio. La pantalla muestra además el estado resultante. */
export const GRIFO_GUARDADO = 'Listo: el registro queda como se ve arriba.';

/**
 * Mueve el grifo del registro (SPEC-037 CA-11, CA-21).
 *
 * **La acción se cierra, no solo la pantalla** (ADR-021 pto. 7, ADR-023 pto. 9). Una
 * sección oculta cuya server action sigue aceptando `POST` no está cerrada, solo
 * escondida: la URL se puede teclear y la acción se puede invocar desde fuera. Por eso
 * lo primero que hace es preguntar por la MISMA función de catálogo que decide la
 * pantalla y el enlace del menú — no una condición propia que pueda divergir de ellas.
 *
 * `sectionUserOrNull` y no `requireSectionUser`: una acción no pinta pantalla, así que
 * lo que tiene que hacer es no producir ningún efecto y terminar sin datos (SPEC-034
 * CA-7). El rol se lee de la sesión que la frontera de Node acaba de revalidar contra
 * la base, así que degradar a alguien le cierra esto en su siguiente petición (CA-12).
 *
 * Un cupo inválido se rechaza SIN MODIFICAR NADA: se valida antes de escribir, con la
 * misma función pura que se prueba caso a caso en `tests/registration-gate.test.ts`.
 */
export async function updateGateAction(
  _prev: GateFormState,
  formData: FormData,
): Promise<GateFormState> {
  const operador = await sectionUserOrNull('operacion');
  if (!operador) return { error: `Operación ${SECCION_NO_DISPONIBLE}.` };

  const capacidad = parseCapacity(formData.get('capacity'));
  if (!capacidad.ok) return { error: CUPO_INVALIDO };

  await saveRegistrationSettings(
    db,
    { openManually: formData.get('openManually') === 'si', capacity: capacidad.value },
    operador.id, // el ID, nunca el email (CA-22)
  );

  revalidatePath('/admin');
  revalidatePath('/register');
  return { ok: GRIFO_GUARDADO };
}
