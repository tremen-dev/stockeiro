import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { users, transactions, symbolAliases } from '@/db/schema';
import { registerUser } from '@/lib/auth/users';
import type { Role } from '@/lib/auth/sections';
import { SECCION_NO_DISPONIBLE } from '@/lib/auth/section-messages';

/**
 * SPEC-034 CA-7 — las server actions de la sección cerrada tampoco pasan
 * (ADR-021 pto. 7).
 *
 * Éste es el CA que de verdad cierra CE-2 y el más fácil de hacer mal: ocultar la
 * página se ve, dejar una server action abierta no. Una sección oculta cuyas
 * acciones siguen aceptando `POST` no está cerrada, solo escondida.
 *
 * Por eso aquí NO hay muestreo. Se enumeran las actions de `src/app/cartera/` y de
 * `src/app/cartera/importar/` LEYENDO EL FUENTE, y un test comprueba que la lista
 * cubierta abajo es exactamente esa: añadir una action nueva sin cerrarla pone este
 * fichero en rojo, aunque nadie se acuerde de venir a tocarlo.
 *
 * El arnés reemplaza `@/db/client` por PGlite y `auth()` por una sesión de mentira
 * con el rol que toque. Lo que se mide es lo único que importa: cuántas filas hay en
 * `transactions` y en `symbol_aliases` antes y después.
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

const { addBuyAction, addSellAction } = await import('@/app/cartera/actions');
const {
  readStatementAction,
  resolveAction,
  confirmSelectionAction,
  fuseAction,
  previewAction,
  confirmImportAction,
} = await import('@/app/cartera/importar/actions');

const PWD = 'clave-secreta-123';

/**
 * Invoca una action y devuelve SIEMPRE algo serializable: lo que resolvió, o el
 * error que lanzó. Una action que revienta también "termina sin datos", y no
 * queremos que la excepción tumbe la medición de filas que viene después.
 */
async function ejecutar(invocar: () => Promise<unknown>): Promise<string> {
  try {
    return JSON.stringify((await invocar()) ?? {});
  } catch (e) {
    return `THROW: ${e instanceof Error ? e.message : String(e)}`;
  }
}

const MATCH = {
  ticker: 'ITX',
  micCode: 'BMEX',
  exchange: 'BME',
  name: 'Industria de Diseño Textil SA',
  currency: 'EUR',
  country: 'Spain',
  instrumentType: 'Common Stock',
};

function formCompra(): FormData {
  const fd = new FormData();
  fd.set('ticker', 'ITX');
  fd.set('micCode', 'BMEX');
  fd.set('currency', 'EUR');
  fd.set('exchange', 'BME');
  fd.set('name', 'Inditex');
  fd.set('quantity', '10');
  fd.set('price', '100');
  fd.set('occurredOn', '2026-01-02');
  return fd;
}

/**
 * Cada action con la forma de invocarla y una etiqueta. La lista se compara contra
 * el fuente más abajo: es la mitad que impide que envejezca en silencio.
 */
const ACCIONES: { nombre: string; invocar: () => Promise<unknown> }[] = [
  { nombre: 'addBuyAction', invocar: () => addBuyAction(undefined, formCompra()) },
  {
    nombre: 'addSellAction',
    invocar: () => {
      const fd = new FormData();
      fd.set('symbolId', '00000000-0000-0000-0000-000000000001');
      fd.set('quantity', '1');
      fd.set('price', '1');
      fd.set('occurredOn', '2026-01-03');
      return addSellAction(undefined, fd);
    },
  },
  { nombre: 'readStatementAction', invocar: () => readStatementAction(new FormData()) },
  { nombre: 'resolveAction', invocar: () => resolveAction([]) },
  { nombre: 'confirmSelectionAction', invocar: () => confirmSelectionAction('INDITEX', 'M.CONTINUO', MATCH) },
  {
    nombre: 'fuseAction',
    invocar: () => fuseAction('INDITEX', 'M.CONTINUO', '00000000-0000-0000-0000-000000000002'),
  },
  { nombre: 'previewAction', invocar: () => previewAction([]) },
  { nombre: 'confirmImportAction', invocar: () => confirmImportAction([]) },
];

describe('SPEC-034 CA-7: la lista de actions se prueba ENTERA, no una muestra', () => {
  const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'app', 'cartera');

  /** Los `export async function …Action` que declara un fichero de actions. */
  function actionsDeclaradas(file: string): string[] {
    const source = readFileSync(file, 'utf8');
    return [...source.matchAll(/export\s+async\s+function\s+(\w+Action)\s*\(/g)]
      .map((m) => m[1])
      .sort();
  }

  it('las actions de cartera e importar son exactamente las que este fichero cubre', () => {
    const declaradas = [
      ...actionsDeclaradas(join(appDir, 'actions.ts')),
      ...actionsDeclaradas(join(appDir, 'importar', 'actions.ts')),
    ].sort();

    expect(declaradas.length).toBeGreaterThan(0);
    expect(
      ACCIONES.map((a) => a.nombre).sort(),
      'Hay una server action de la sección cerrada que este test no ejercita. ' +
        'ADR-021 pto. 7: la frontera se aplica en el punto de entrada de CADA action, ' +
        'no solo en el componente que la pinta.',
    ).toEqual(declaradas);
  });
});

describe('SPEC-034 CA-7: con rol tester, ninguna action produce efecto', () => {
  let db: TestDb;
  let userId: string;

  beforeEach(async () => {
    ({ db } = await makeTestDb());
    contexto.db = db;
    const creado = await registerUser(db, 'tester@example.com', PWD);
    userId = creado.id;
    contexto.sesion = { user: { id: userId, email: creado.email, role: 'tester' } };
  });

  async function censo() {
    return {
      transactions: (await db.select().from(transactions)).length,
      symbolAliases: (await db.select().from(symbolAliases)).length,
    };
  }

  for (const accion of ACCIONES) {
    it(`${accion.nombre} no crea, no modifica y no borra ninguna fila`, async () => {
      const antes = await censo();
      const resultado = await ejecutar(accion.invocar);
      const despues = await censo();

      expect(despues, `${accion.nombre} tocó la base`).toEqual(antes);
      expect(despues.transactions).toBe(0);
      expect(despues.symbolAliases).toBe(0);

      // Y termina SIN DATOS: nada de devolver medio resultado con un aviso al lado.
      expect(resultado).not.toContain('"ok":true');
      // Y lo hace por el motivo correcto: la sección está cerrada para este rol, no
      // es un error opaco ni una excepción que se lea como una avería (CA-8).
      expect(
        resultado,
        `${accion.nombre} no dice que la sección está cerrada: ${resultado}`,
      ).toContain(SECCION_NO_DISPONIBLE);
    });
  }

  it('el censo de la sesión no cambia por intentarlo: el rol sigue siendo tester', async () => {
    for (const accion of ACCIONES) await ejecutar(accion.invocar);
    const [fila] = await db.select().from(users).where(eq(users.id, userId));
    expect(fila.role).toBe('tester');
  });
});

/**
 * CONTROL POSITIVO. Sin esto, los tests de arriba pasarían igual con un arnés roto en
 * el que ninguna action llega a hacer nada nunca — que es la forma más cómoda de tener
 * quince tests verdes que no miran nada.
 */
describe('SPEC-034 CA-7 (control positivo): con rol completo las MISMAS actions sí pasan', () => {
  let db: TestDb;

  beforeEach(async () => {
    ({ db } = await makeTestDb());
    contexto.db = db;
    const creado = await registerUser(db, 'completo@example.com', PWD);
    contexto.sesion = { user: { id: creado.id, email: creado.email, role: 'completo' } };
  });

  it('addBuyAction escribe de verdad una transacción (la medición de arriba mide algo)', async () => {
    const resultado = await addBuyAction(undefined, formCompra());
    expect(resultado).toEqual({ ok: true });
    expect(await db.select().from(transactions)).toHaveLength(1);
  });

  it('confirmSelectionAction escribe de verdad un alias de símbolo', async () => {
    const resultado = await confirmSelectionAction('INDITEX', 'M.CONTINUO', MATCH);
    expect(resultado).toMatchObject({ ok: true });
    expect(await db.select().from(symbolAliases)).toHaveLength(1);
  });

  it('ninguna action responde ya "sección no disponible": el guard es lo que bloqueaba', async () => {
    for (const accion of ACCIONES) {
      const resultado = await ejecutar(accion.invocar);
      expect(resultado, `${accion.nombre} sigue rebotando con rol completo`).not.toContain(
        SECCION_NO_DISPONIBLE,
      );
    }
  });
});

describe('SPEC-034 CA-7: un admin, que está dentro de la cadena, tampoco queda fuera', () => {
  it('addBuyAction funciona con rol admin (ADR-021 pto. 1.a)', async () => {
    const { db } = await makeTestDb();
    contexto.db = db;
    const creado = await registerUser(db, 'admin@example.com', PWD);
    contexto.sesion = { user: { id: creado.id, email: creado.email, role: 'admin' } };

    expect(await addBuyAction(undefined, formCompra())).toEqual({ ok: true });
    expect(await db.select().from(transactions)).toHaveLength(1);
  });
});

describe('SPEC-034 CA-7: sin sesión sigue sin pasar nada (RN-03, no es el rol quien autentica)', () => {
  it('todas las actions terminan sin datos y sin escribir', async () => {
    const { db } = await makeTestDb();
    contexto.db = db;
    contexto.sesion = null;

    for (const accion of ACCIONES) await ejecutar(accion.invocar);
    expect(await db.select().from(transactions)).toHaveLength(0);
    expect(await db.select().from(symbolAliases)).toHaveLength(0);
  });
});
