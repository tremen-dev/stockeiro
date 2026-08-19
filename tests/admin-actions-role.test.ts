import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registrationSettings } from '@/db/schema';
import { registerUser } from '@/lib/auth/users';
import type { Role } from '@/lib/auth/sections';
import { SECCION_NO_DISPONIBLE } from '@/lib/auth/section-messages';
import { CUPO_INVALIDO } from '@/lib/registration/messages';

/**
 * SPEC-037 CA-11 — las server actions de la pantalla de operación también están
 * cerradas (ADR-023 pto. 9, ADR-021 pto. 7).
 *
 * Es el gemelo de `tests/cartera-actions-role.test.ts` (SPEC-034 CA-7) y existe por
 * el mismo motivo: **cerrar la pantalla sin cerrar la acción es esconder, no cerrar**.
 * Aquí importa más que en ninguna otra sección, porque lo que hay al otro lado de
 * esta acción es el interruptor que decide si entra gente en el servicio.
 *
 * Y no hay muestreo: se ENUMERAN las actions de `src/app/admin/` leyendo el fuente, y
 * un test comprueba que la lista cubierta abajo es exactamente esa. Añadir una action
 * nueva sin cerrarla pone este fichero en rojo aunque nadie se acuerde de volver.
 *
 * La medida es la fila de ajustes: **antes y después**. Que la acción devuelva un
 * mensaje no prueba nada; que el grifo no se haya movido, sí.
 */

const contexto: {
  db: TestDb | null;
  sesion: { user?: { id: string; email: string; role: Role } } | null;
} = { db: null, sesion: null };

vi.mock('@/db/client', () => ({
  get db() {
    return contexto.db;
  },
}));

vi.mock('@/lib/auth/config', () => ({
  auth: async () => contexto.sesion,
  signIn: async () => undefined,
  signOut: async () => undefined,
  handlers: {},
}));

vi.mock('next/cache', () => ({ revalidatePath: () => undefined }));

const { updateGateAction } = await import('@/app/admin/actions');

const PWD = 'clave-secreta-123';
const ACTIONS_CUBIERTAS = ['updateGateAction'] as const;

let db: TestDb;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  contexto.db = db;
  contexto.sesion = null;
});

async function comoRol(rol: Role) {
  const u = await registerUser(db, `${rol}@example.com`, PWD);
  contexto.sesion = { user: { id: u.id, email: u.email, role: rol } };
  return u;
}

const ajustes = async () => (await db.select().from(registrationSettings))[0];

function formulario(abierto: boolean, cupo: string): FormData {
  const fd = new FormData();
  if (abierto) fd.set('openManually', 'si');
  fd.set('capacity', cupo);
  return fd;
}

/** Invoca la action y devuelve algo serializable, aunque lance. */
async function ejecutar(fd: FormData): Promise<string> {
  try {
    return JSON.stringify((await updateGateAction(undefined, fd)) ?? {});
  } catch (e) {
    return `THROW: ${e instanceof Error ? e.message : String(e)}`;
  }
}

describe('SPEC-037 CA-11: quien no es admin no mueve el grifo', () => {
  for (const rol of ['tester', 'completo'] as const) {
    it(`un ${rol} que invoca la action NO modifica la fila de ajustes`, async () => {
      await comoRol(rol);
      const antes = await ajustes();

      const resultado = await ejecutar(formulario(false, '3'));

      const despues = await ajustes();
      expect(despues.openManually, rol).toBe(antes.openManually);
      expect(despues.capacity, rol).toBe(antes.capacity);
      expect(despues.updatedBy, rol).toBe(antes.updatedBy);
      expect(despues.updatedAt.getTime(), rol).toBe(antes.updatedAt.getTime());
      expect(resultado, rol).toContain(SECCION_NO_DISPONIBLE);
    });
  }

  it('sin sesión tampoco: la acción termina sin efecto', async () => {
    contexto.sesion = null;
    const antes = await ajustes();

    await ejecutar(formulario(false, '0'));

    const despues = await ajustes();
    expect(despues.openManually).toBe(antes.openManually);
    expect(despues.capacity).toBe(antes.capacity);
  });

  it('una sesión con un rol que no existe en el dominio no abre nada', async () => {
    // La frontera no confía en lo que le llegue: un valor fuera de `ROLES` no es rol.
    const u = await registerUser(db, 'raro@example.com', PWD);
    contexto.sesion = { user: { id: u.id, email: u.email, role: 'superadmin' as Role } };
    const antes = await ajustes();

    await ejecutar(formulario(false, '1'));

    expect((await ajustes()).openManually).toBe(antes.openManually);
  });
});

describe('SPEC-037 CA-21: el admin sí lo mueve, y un cupo inválido no', () => {
  it('cierra el registro y fija el cupo, con constancia de quién', async () => {
    const admin = await comoRol('admin');

    const resultado = await ejecutar(formulario(false, '120'));

    const fila = await ajustes();
    expect(fila.openManually).toBe(false);
    expect(fila.capacity).toBe(120);
    expect(fila.updatedBy).toBe(admin.id);
    expect(resultado).not.toContain(SECCION_NO_DISPONIBLE);
  });

  it('retirar el cupo (campo vacío) es un cambio legítimo, no un error', async () => {
    await comoRol('admin');
    await ejecutar(formulario(true, ''));
    expect((await ajustes()).capacity).toBeNull();
  });

  for (const malo of ['-1', '2,5', '3.5', 'cincuenta', '1e3']) {
    it(`un cupo "${malo}" se rechaza SIN modificar nada`, async () => {
      await comoRol('admin');
      await ejecutar(formulario(true, '77')); // un cambio válido primero
      const antes = await ajustes();

      const resultado = await ejecutar(formulario(false, malo));

      const despues = await ajustes();
      expect(JSON.parse(resultado)).toEqual({ error: CUPO_INVALIDO });
      expect(despues.capacity).toBe(antes.capacity);
      expect(despues.openManually).toBe(antes.openManually);
    });
  }
});

describe('SPEC-037 CA-11: la cobertura no envejece', () => {
  it('las actions de `src/app/admin/` son exactamente las cubiertas aquí', () => {
    const fuente = readFileSync(
      join(resolve(dirname(fileURLToPath(import.meta.url)), '..'), 'src', 'app', 'admin', 'actions.ts'),
      'utf8',
    );
    const declaradas = [...fuente.matchAll(/export async function (\w+)/g)].map((m) => m[1]);
    expect(declaradas.sort()).toEqual([...ACTIONS_CUBIERTAS].sort());
  });
});
