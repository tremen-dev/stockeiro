import { count, eq } from 'drizzle-orm';
import type { PgDatabase } from 'drizzle-orm/pg-core';
import { REGISTRATION_SETTINGS_ID, registrationSettings, users } from '@/db/schema';
import { registerUser, type PublicUser } from '@/lib/auth/users';
import {
  SEED_REGISTRATION_SETTINGS,
  registrationState,
  type ClosedReason,
  type RegistrationSettings,
  type RegistrationState,
} from './gate';

/** Acepta tanto el cliente Neon (producción) como PGlite/postgres-js (tests y e2e). */
type Db = PgDatabase<any, any, any>;

/**
 * El grifo del registro contra la base (SPEC-037, ADR-023).
 *
 * Este módulo es la mitad que sabe de SQL; la DECISIÓN vive en `./gate.ts`, que no
 * importa nada. La separación no es estética: es lo que permite recorrer la matriz
 * completa del grifo sin levantar una base de datos, y lo que garantiza que la
 * pantalla de operación y el alta respondan a la misma regla.
 *
 * EFECTO INMEDIATO, SIN CACHÉ (ADR-023 pto. 6): los ajustes se leen **en la
 * petición**. Ni memoización de módulo, ni `revalidate`, ni variable de entorno. Un
 * grifo que tarda cinco minutos en cerrarse no es un grifo, y una variable de
 * entorno exigiría redespliegue justo en el momento en que no se quiere tocar nada.
 */

/**
 * Los ajustes vigentes. Si la fila faltara —no debería, la siembra la migración—, la
 * respuesta es la SEMILLA y no «cerrado» (ADR-023 pto. 7): cerrar el registro por una
 * fila ausente sería matar el objetivo de la épica en silencio.
 */
export async function readRegistrationSettings(db: Db): Promise<RegistrationSettings> {
  const [fila] = await db
    .select({ openManually: registrationSettings.openManually, capacity: registrationSettings.capacity })
    .from(registrationSettings)
    .limit(1);
  if (!fila) return { ...SEED_REGISTRATION_SETTINGS };
  return { openManually: fila.openManually, capacity: fila.capacity };
}

/**
 * Cuentas VIVAS (ADR-022 pto. 9). Es una agregación, no un recuento en memoria: el
 * cupo no puede pagar una consulta que crezca con el número de usuarios.
 *
 * Que cuente vivas y no históricas es lo que hace que quien borra su cuenta libere
 * plaza (CA-9). No es una fuga: recuperar la plaza exige haber renunciado antes a
 * todos sus datos.
 */
export async function countAccounts(db: Db): Promise<number> {
  const [fila] = await db.select({ n: count() }).from(users);
  return Number(fila?.n ?? 0);
}

/** El estado del grifo AHORA: los ajustes de la fila más el censo, por la función pura. */
export async function resolveRegistrationState(db: Db): Promise<RegistrationState> {
  const [settings, accounts] = await Promise.all([readRegistrationSettings(db), countAccounts(db)]);
  return registrationState(settings, accounts);
}

/**
 * Guarda los ajustes y deja constancia de quién y cuándo (CA-21).
 *
 * Es un `INSERT … ON CONFLICT DO UPDATE` y no un `UPDATE` a secas para que la fila se
 * recomponga sola si faltara: el operador que entra a cerrar el grifo no puede
 * encontrarse con que su clic no hizo nada porque la fila no estaba.
 *
 * `updatedBy` recibe el **id** del operador, nunca su email (CA-22).
 */
export async function saveRegistrationSettings(
  db: Db,
  settings: RegistrationSettings,
  updatedBy: string,
): Promise<RegistrationSettings> {
  await db
    .insert(registrationSettings)
    .values({
      id: REGISTRATION_SETTINGS_ID,
      openManually: settings.openManually,
      capacity: settings.capacity,
      updatedAt: new Date(),
      updatedBy,
    })
    .onConflictDoUpdate({
      target: registrationSettings.id,
      set: {
        openManually: settings.openManually,
        capacity: settings.capacity,
        updatedAt: new Date(),
        updatedBy,
      },
    });
  return readRegistrationSettings(db);
}

/** Cuándo y quién tocó el grifo por última vez. `updatedBy` null = lo sembró la migración. */
export async function readRegistrationAudit(
  db: Db,
): Promise<{ updatedAt: Date; updatedBy: string | null } | null> {
  const [fila] = await db
    .select({ updatedAt: registrationSettings.updatedAt, updatedBy: registrationSettings.updatedBy })
    .from(registrationSettings)
    .where(eq(registrationSettings.id, REGISTRATION_SETTINGS_ID))
    .limit(1);
  return fila ?? null;
}

export type RegisterOutcome = { ok: true; user: PublicUser } | { ok: false; reason: ClosedReason };

/**
 * El alta CON el grifo delante (CA-4, CA-5, ADR-023 pto. 5).
 *
 * La comprobación se hace en el CAMINO DE REGISTRO, no solo al pintar el formulario:
 * ocultar el formulario y dejar la server action aceptando envíos no es cerrar el
 * registro, es esconderlo. Por eso quien quiera crear una cuenta pasa por aquí, y no
 * por `registerUser` directamente.
 *
 * El error de email duplicado SUBE tal cual (SPEC-001 CA-2, RN-02): un email ya
 * registrado no es un cierre del grifo y no puede confundirse con uno.
 *
 * Residual declarado (F-SPEC-037-3, ADR-023 pto. 8): dos altas exactamente
 * simultáneas en la última plaza pueden dejar el contador uno por encima del cupo. Se
 * acepta a conciencia — el cupo es un tope operativo con margen amplio, no una
 * licencia, y bloquear `users` en cada alta sería pagar contención permanente por una
 * plaza que nadie va a auditar. A partir de ahí no entra nadie más.
 */
export async function registerIfOpen(
  db: Db,
  email: string,
  password: string,
): Promise<RegisterOutcome> {
  const estado = await resolveRegistrationState(db);
  if (!estado.open) return { ok: false, reason: estado.reason };
  return { ok: true, user: await registerUser(db, email, password) };
}
