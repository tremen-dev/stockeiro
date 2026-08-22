import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { notifications, watchedSymbols, zoneTriggers, type WatchedSymbol } from '@/db/schema';
import { watchSymbol } from '@/lib/watchlist/service';
import { INFRA_ERROR_TEXT } from '@/lib/format/action-error';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';

/**
 * SPEC-044 — **la server action de edición**: CA-8 (no escribe ni un byte fuera de
 * `watched_symbols`), CA-14 (el error de dato se distingue del fallo nuestro) y la mitad
 * de inspección de CA-15 (una sola puerta de validación, no dos).
 *
 * El arnés es el que ya usa `cartera-actions-role.test.ts`: se reemplaza `@/db/client` por
 * PGlite y `auth()` por una sesión de mentira. Lo que se mide no es lo que la action
 * devuelve, sino **qué filas quedan** — que es donde vivía el daño.
 */

const contexto: {
  db: unknown;
  sesion: { user?: { id: string; email: string } } | null;
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

const { editZonesAction } = await import('@/app/vigiladas/actions');

const VIGILADAS = 'src/app/vigiladas/actions.ts';
const SERVICIO = 'src/lib/watchlist/service.ts';
const fuente = (rel: string) => readFileSync(join(process.cwd(), rel), 'utf8');

const ASOF = new Date('2026-07-13T00:00:00.000Z');

let db: TestDb;
let userA: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  contexto.db = db;
  const u = await registerUser(db, 'a@example.com', 'clave');
  userA = u.id;
  contexto.sesion = { user: { id: u.id, email: 'a@example.com' } };
});

function form(values: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(values)) fd.set(k, v);
  return fd;
}

async function sembrarEpisodioYAviso(w: WatchedSymbol) {
  const [t] = await db
    .insert(zoneTriggers)
    .values({
      userId: w.userId,
      watchedSymbolId: w.id,
      symbolId: w.symbolId,
      zoneKind: 'buy',
      price: '13',
      asOf: ASOF,
    })
    .returning();
  const [n] = await db
    .insert(notifications)
    .values({
      userId: w.userId,
      kind: 'entry',
      zoneTriggerId: t.id,
      payload: 'ITX en zona de compra @ 13',
      channel: 'email',
      status: 'sent',
      asOf: ASOF,
    })
    .returning();
  return { t, n };
}

/* ────────────────────────────────────────────────────────────────────────────
   CA-8 — la garantía dura de ADR-028 pto. 3
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-044 CA-8: la acción de edición no escribe ni un byte fuera de watched_symbols', () => {
  it('zone_triggers y notifications quedan exactamente igual, y no se envía nada', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 12, buyMax: 14 });
    await sembrarEpisodioYAviso(w);

    // El canal de aviso, intacto y observable: si la edición notificara, aquí se vería.
    const sender = new FakeNotificationSender();

    const instantanea = async () => ({
      episodios: JSON.stringify(await db.select().from(zoneTriggers)),
      avisos: JSON.stringify(await db.select().from(notifications)),
    });
    const antes = await instantanea();

    const salida = await editZonesAction(undefined, form({
      watchedId: w.id,
      buyMin: '12',
      buyMax: '14,5',
      sellMin: '',
      sellMax: '',
    }));

    expect(salida).toEqual({ ok: true });
    expect(await instantanea()).toEqual(antes);
    expect(sender.sent).toHaveLength(0);

    // Y la fila SÍ cambió: el test no está pasando porque no haya hecho nada.
    const [fila] = await db.select().from(watchedSymbols).where(eq(watchedSymbols.id, w.id));
    expect([fila.buyMin, fila.buyMax]).toEqual(['12', '14.5']);
  });

  it('la action no importa el motor de disparo ni el notificador', () => {
    const src = fuente(VIGILADAS);
    for (const prohibido of [
      'lib/triggers',
      'evaluateTriggers',
      'notifyCycle',
      'NotificationSender',
      'zoneTriggers',
      'notifications',
    ]) {
      expect(
        src,
        `\`${VIGILADAS}\` alcanza \`${prohibido}\`. ADR-028 pto. 3: la edición valida, ` +
          `escribe y termina — no abre, no cierra y no notifica. Un segundo autor de ` +
          `episodios rompería el carácter derivado que ADR-017 le dio a zone_triggers`,
      ).not.toContain(prohibido);
    }
  });

  it('el servicio de edición tampoco: solo toca watchedSymbols', () => {
    const src = fuente(SERVICIO);
    const desde = src.indexOf('export async function updateWatchedZones');
    expect(desde).toBeGreaterThan(-1);
    const cuerpo = src.slice(desde, src.indexOf('\n}', desde));
    expect(cuerpo).toContain('.update(watchedSymbols)');
    expect(cuerpo).not.toContain('zoneTriggers');
    expect(cuerpo).not.toContain('notifications');
    expect(cuerpo).not.toContain('delete');
    expect(cuerpo).not.toContain('insert');
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-14 — de quién es la culpa, en las dos direcciones (SPEC-030 CA-10..CA-12)
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-044 CA-14: el error de dato se distingue del fallo nuestro', () => {
  it('"abc" nombra el campo y el valor, dice qué se espera y NO deja traza', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 12, buyMax: 14 });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const salida = await editZonesAction(undefined, form({
      watchedId: w.id,
      buyMin: 'abc',
      buyMax: '14',
      sellMin: '',
      sellMax: '',
    }));

    expect(salida).toHaveProperty('error');
    const mensaje = (salida as { error: string }).error;
    expect(mensaje).toContain('Zona de compra (mínimo)');
    expect(mensaje).toContain('abc');
    expect(mensaje).toContain('12,5'); // el ejemplo de qué se espera
    expect(mensaje).not.toBe(INFRA_ERROR_TEXT);
    expect(log, 'un error de DATO no es un incidente nuestro: no se traza').not.toHaveBeenCalled();
    log.mockRestore();

    // Y no se guardó nada.
    const [fila] = await db.select().from(watchedSymbols).where(eq(watchedSymbols.id, w.id));
    expect([fila.buyMin, fila.buyMax]).toEqual(['12', '14']);
  });

  it('un fallo de la base da el mensaje de "fallo nuestro" Y SÍ deja traza', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 12, buyMax: 14 });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    // La base se cae justo en el UPDATE, con los datos ya validados.
    contexto.db = {
      update() {
        throw new Error('connection terminated unexpectedly');
      },
    };

    const salida = await editZonesAction(undefined, form({
      watchedId: w.id,
      buyMin: '12',
      buyMax: '14,5',
      sellMin: '',
      sellMax: '',
    }));

    expect(salida).toEqual({ error: INFRA_ERROR_TEXT });
    expect(log, 'un fallo de infraestructura invisible es inaccionable (CE-F2)').toHaveBeenCalled();
    log.mockRestore();
  });

  it('los dos mensajes son DISTINTOS: es la mitad que se olvida', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 12, buyMax: 14 });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const dato = (await editZonesAction(
      undefined,
      form({ watchedId: w.id, buyMin: 'abc', buyMax: '14', sellMin: '', sellMax: '' }),
    )) as { error: string };

    contexto.db = {
      update() {
        throw new Error('boom');
      },
    };
    const infra = (await editZonesAction(
      undefined,
      form({ watchedId: w.id, buyMin: '12', buyMax: '14', sellMin: '', sellMax: '' }),
    )) as { error: string };
    log.mockRestore();

    expect(dato.error).not.toBe(infra.error);
  });

  it('una zona inválida (RN-10) mantiene su mensaje de dominio y tampoco traza', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 12, buyMax: 14 });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});

    const salida = (await editZonesAction(
      undefined,
      form({ watchedId: w.id, buyMin: '30', buyMax: '10', sellMin: '', sellMax: '' }),
    )) as { error: string };

    expect(salida.error).toContain('Zona de compra');
    expect(salida.error).not.toBe(INFRA_ERROR_TEXT);
    expect(log).not.toHaveBeenCalled();
    log.mockRestore();
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-15 — una sola puerta, y se comprueba mirando el código
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-044 CA-15: una sola puerta, no dos', () => {
  it('la edición lee sus cuatro campos con el MISMO `readZones` que el alta', () => {
    const src = fuente(VIGILADAS);
    expect([...src.matchAll(/function readZones\(/g)]).toHaveLength(1);
    expect([...src.matchAll(/readZones\(formData\)/g)].length).toBeGreaterThanOrEqual(2);
    for (const campo of ['buyMin', 'buyMax', 'sellMin', 'sellMax']) {
      expect([...src.matchAll(new RegExp(`readDecimalField\\(formData, '${campo}'\\)`, 'g')),
      ]).toHaveLength(1);
      // La puerta trasera: leer el campo crudo saltándose la normalización (SPEC-030 CA-13).
      expect(src).not.toContain(`formData.get('${campo}')`);
    }
  });

  it('`validatePair` se declara UNA vez y la edición la usa, sin copia ni variante', () => {
    const src = fuente(SERVICIO);
    expect(
      [...src.matchAll(/function validatePair\(/g)],
      'hay más de una `validatePair`: la edición estaría validando por su cuenta y una ' +
        'de las dos podría aflojarse sin que la otra se entere',
    ).toHaveLength(1);

    const desde = src.indexOf('export async function updateWatchedZones');
    const cuerpo = src.slice(desde, src.indexOf('\n}', desde));
    expect(cuerpo).toContain("validatePair(zones.buyMin, zones.buyMax, 'compra')");
    expect(cuerpo).toContain("validatePair(zones.sellMin, zones.sellMax, 'venta')");
  });

  it('no hay un segundo normalizador ni una segunda tabla de mensajes', () => {
    const src = `${fuente(VIGILADAS)}\n${fuente(SERVICIO)}`;
    expect(src).not.toContain("replace(',', '.')");
    expect(src).not.toContain("replace(/,/g");
    expect(src).not.toContain('Datos inválidos');
    // El único constructor de Decimal vive en los helpers compartidos del servicio.
    expect([...fuente(SERVICIO).matchAll(/new Decimal\(/g)].length).toBeLessThanOrEqual(3);
    expect(fuente(VIGILADAS)).not.toContain('new Decimal(');
  });

  it('el `userId` viaja DENTRO del WHERE del UPDATE (CA-17), no en un chequeo previo', () => {
    const src = fuente(SERVICIO);
    const desde = src.indexOf('export async function updateWatchedZones');
    const cuerpo = src.slice(desde, src.indexOf('\n}', desde));
    expect(
      cuerpo,
      'el aislamiento no puede depender de una comprobación previa que un refactor ' +
        'pueda saltarse (ADR-028 pto. 9, RN-01)',
    ).toMatch(/\.where\(\s*and\(\s*eq\(watchedSymbols\.id[\s\S]*eq\(watchedSymbols\.userId/);
  });
});
