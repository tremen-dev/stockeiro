import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registrationSettings, users } from '@/db/schema';
import { registerUser } from '@/lib/auth/users';
import { EmailAlreadyRegisteredError } from '@/lib/auth/errors';
import { deleteMyAccount } from '@/lib/account/deletion';
import { SEED_REGISTRATION_SETTINGS } from '@/lib/registration/gate';
import {
  countAccounts,
  readRegistrationSettings,
  registerIfOpen,
  resolveRegistrationState,
  saveRegistrationSettings,
} from '@/lib/registration/service';

/**
 * SPEC-037 CA-3 / CA-4 / CA-5 / CA-9 / CA-21 — el grifo, contra la base de verdad.
 *
 * Aquí se prueba la mitad que la función pura no puede probar: que el estado que se
 * lee sale de la fila, que el alta LO CONSULTA ANTES DE CREAR NADA, y que el cupo
 * cuenta **cuentas vivas** — de modo que quien se va libera plaza (ADR-022 pto. 9).
 *
 * La medida es siempre la misma y no admite interpretación: **cuántas filas hay en
 * `users` antes y después**. Que la acción devuelva un mensaje bonito no prueba
 * nada; que la cuenta no exista, sí.
 */

const PWD = 'clave-secreta-123';
let db: TestDb;

beforeEach(async () => {
  ({ db } = await makeTestDb());
});

const cuentas = async () => (await db.select().from(users)).length;

/** Mueve el grifo directamente en la fila, como haría el operador desde `/admin`. */
async function ajustar(openManually: boolean, capacity: number | null) {
  await db.update(registrationSettings).set({ openManually, capacity });
}

describe('SPEC-037: los ajustes se leen de la fila', () => {
  it('la fila sembrada por la migración es la que se lee', async () => {
    expect(await readRegistrationSettings(db)).toEqual(SEED_REGISTRATION_SETTINGS);
  });

  it('si la fila faltara, la respuesta es la semilla — nunca «cerrado» (ADR-023 pto. 7)', async () => {
    await db.delete(registrationSettings);
    expect(await readRegistrationSettings(db)).toEqual(SEED_REGISTRATION_SETTINGS);
    expect(await resolveRegistrationState(db)).toEqual({ open: true });
  });

  it('`countAccounts` cuenta las cuentas que hay, ni una más', async () => {
    expect(await countAccounts(db)).toBe(0);
    await registerUser(db, 'uno@example.com', PWD);
    await registerUser(db, 'dos@example.com', PWD);
    expect(await countAccounts(db)).toBe(2);
  });
});

describe('SPEC-037 CA-3: con el registro abierto no cambia nada', () => {
  it('el alta funciona exactamente como hoy: cuenta creada y rol tester', async () => {
    const r = await registerIfOpen(db, 'spec037-abierto@example.com', PWD);
    expect(r.ok).toBe(true);
    expect(r.ok && r.user.email).toBe('spec037-abierto@example.com');
    expect(r.ok && r.user.role).toBe('tester'); // SPEC-034: toda cuenta nace tester
    expect(await cuentas()).toBe(1);
  });

  it('el email duplicado sigue siendo el MISMO error de SPEC-001 CA-2, no un cierre', async () => {
    await registerIfOpen(db, 'dup@example.com', PWD);
    await expect(registerIfOpen(db, 'DUP@example.com', PWD)).rejects.toBeInstanceOf(
      EmailAlreadyRegisteredError,
    );
    expect(await cuentas()).toBe(1);
  });
});

describe('SPEC-037 CA-4: el interruptor manual cierra de VERDAD', () => {
  it('con el registro cerrado a mano NO se crea ninguna cuenta', async () => {
    await ajustar(false, null);

    const r = await registerIfOpen(db, 'spec037-manual@example.com', PWD);

    expect(r).toEqual({ ok: false, reason: 'manual' });
    expect(await cuentas()).toBe(0);
    // Y no queda un usuario "a medias" con ese email: no existe fila ninguna.
    expect(await db.select().from(users).where(eq(users.email, 'spec037-manual@example.com'))).toEqual(
      [],
    );
  });
});

describe('SPEC-037 CA-5: el cupo cierra solo', () => {
  it('con N cuentas y cupo N no entra nadie, aunque el interruptor esté abierto', async () => {
    await ajustar(true, 2);
    await registerUser(db, 'a@example.com', PWD);
    await registerUser(db, 'b@example.com', PWD);

    const r = await registerIfOpen(db, 'c@example.com', PWD);

    expect(r).toEqual({ ok: false, reason: 'capacity' });
    expect(await cuentas()).toBe(2);
  });

  it('con N−1 cuentas el alta SÍ funciona, y deja el registro cerrado para la siguiente', async () => {
    await ajustar(true, 2);
    await registerUser(db, 'a@example.com', PWD);

    expect((await registerIfOpen(db, 'b@example.com', PWD)).ok).toBe(true);
    expect(await cuentas()).toBe(2);

    // La plaza que acaba de ocuparse era la última.
    expect(await resolveRegistrationState(db)).toEqual({ open: false, reason: 'capacity' });
    expect(await registerIfOpen(db, 'c@example.com', PWD)).toEqual({
      ok: false,
      reason: 'capacity',
    });
    expect(await cuentas()).toBe(2);
  });

  it('sin cupo (null) no hay tope: el interruptor es lo único que manda', async () => {
    await ajustar(true, null);
    for (const n of [1, 2, 3, 4, 5]) {
      expect((await registerIfOpen(db, `n${n}@example.com`, PWD)).ok).toBe(true);
    }
    expect(await cuentas()).toBe(5);
  });
});

describe('SPEC-037 CA-9: borrar una cuenta libera plaza (ADR-022 pto. 9)', () => {
  it('el cupo cuenta CUENTAS VIVAS: quien se va deja su plaza libre', async () => {
    await ajustar(true, 2);
    const uno = await registerUser(db, 'vivo@example.com', PWD);
    const dos = await registerUser(db, 'se-va@example.com', PWD);
    expect(await resolveRegistrationState(db)).toEqual({ open: false, reason: 'capacity' });

    // El borrado REAL de SPEC-036, no un DELETE a mano: es la frontera que se prueba.
    expect(await deleteMyAccount(db, dos.id, PWD)).toEqual({ ok: true });

    expect(await resolveRegistrationState(db)).toEqual({ open: true });
    expect((await registerIfOpen(db, 'nuevo@example.com', PWD)).ok).toBe(true);
    expect(await cuentas()).toBe(2);
    // Y no es una fuga: recuperar la plaza exigió renunciar a todos sus datos.
    expect(await db.select().from(users).where(eq(users.id, dos.id))).toEqual([]);
    expect(await db.select().from(users).where(eq(users.id, uno.id))).toHaveLength(1);
  });
});

describe('SPEC-037 CA-21: el operador cambia el grifo y queda constancia', () => {
  it('guarda los valores, la marca de tiempo y QUIÉN lo cambió', async () => {
    const antes = (await db.select().from(registrationSettings))[0].updatedAt;
    const operador = await registerUser(db, 'operador@example.com', PWD);

    const guardado = await saveRegistrationSettings(
      db,
      { openManually: false, capacity: 120 },
      operador.id,
    );

    expect(guardado).toEqual({ openManually: false, capacity: 120 });
    const [fila] = await db.select().from(registrationSettings);
    expect(fila.openManually).toBe(false);
    expect(fila.capacity).toBe(120);
    expect(fila.updatedBy).toBe(operador.id);
    expect(fila.updatedAt.getTime()).toBeGreaterThanOrEqual(antes.getTime());
    // CA-22: lo que se guarda es el ID, nunca el email. La pantalla no puede enseñar
    // lo que la fila no tiene.
    expect(fila.updatedBy).not.toContain('@');
  });

  it('retirar el cupo es un cambio legítimo: pasa a «sin cupo»', async () => {
    await saveRegistrationSettings(db, { openManually: true, capacity: null }, 'op');
    expect(await readRegistrationSettings(db)).toEqual({ openManually: true, capacity: null });
    expect(await resolveRegistrationState(db)).toEqual({ open: true });
  });

  it('sigue siendo UNA fila después de guardar, y se recompone si faltara', async () => {
    await db.delete(registrationSettings);
    await saveRegistrationSettings(db, { openManually: false, capacity: 7 }, 'op');
    const filas = await db.select().from(registrationSettings);
    expect(filas).toHaveLength(1);
    expect(filas[0].openManually).toBe(false);
  });
});
