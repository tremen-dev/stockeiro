import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { notifications, zoneTriggers } from '@/db/schema';
import { watchSymbol, updateWatchedZones } from '@/lib/watchlist/service';
import { runRefreshCycle } from '@/lib/triggers/cycle';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';

/**
 * SPEC-044 rebanada 2 (CE-2) — **la edición no genera ruido; solo el precio lo genera**.
 *
 * ## Por qué estos tests no traen código nuevo, y eso es el resultado
 *
 * ADR-028 pto. 2 dice la cláusula que a ADR-005 le faltaba: el episodio es por
 * `(vigilada, tipo de zona)`, **no** por `(vigilada, tipo de zona, valores de la zona)`.
 * `evaluateTriggers` lo indexa así literalmente —`openBy.get(`${watchedSymbolId}:${kind}`)`—
 * y decide comparando *"¿está dentro AHORA?"* contra *"¿hay episodio abierto?"*. Nunca
 * presupuso que la zona fuera constante: presupuso que la **fila** siguiera siendo la
 * misma.
 *
 * Por eso los tres casos de CE-2 son las tres ramas que el motor ya tenía escritas, y por
 * eso este fichero **no toca `src/lib/triggers/`**. Si alguien se ve modificando el motor
 * para hacer pasar uno de estos tests, está resolviendo el problema por el sitio
 * equivocado: el defecto vivía entero en el `DELETE`, y lo arregló `updateWatchedZones`.
 *
 * Lo que sí hace falta es **fijarlo con tests**, porque las alternativas equivocadas
 * (cerrar el episodio al editar, notificar en el acto) son justo lo que escribiría alguien
 * de buena fe — y las dos producen el aviso duplicado que CE-2 prohíbe.
 */

let db: TestDb;
let userA: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
});

const DIA_1 = '2026-07-13T00:00:00.000Z';
const DIA_2 = '2026-07-14T00:00:00.000Z';

const cot = (price: string, asOf: string) => ({ price, currency: 'EUR', asOf });

/** Un ciclo completo con proveedor y canal FAKE: ingesta → disparos → avisos. */
async function ciclo(precios: Record<string, { price: string; currency: string; asOf: string }>) {
  const sender = new FakeNotificationSender();
  const resultado = await runRefreshCycle(db, new FakeMarketDataProvider(precios), sender);
  return { ...resultado, sender };
}

const episodiosDe = (watchedId: string) =>
  db.select().from(zoneTriggers).where(eq(zoneTriggers.watchedSymbolId, watchedId));

/** Avisos de ENTRADA registrados para un episodio concreto (RN-14: como mucho uno). */
const entradasDe = async (triggerId: string) =>
  (await db.select().from(notifications)).filter(
    (n) => n.kind === 'entry' && n.zoneTriggerId === triggerId,
  );

const digests = async (userId: string) =>
  (await db.select().from(notifications)).filter(
    (n) => n.kind === 'digest' && n.userId === userId,
  );

describe('SPEC-044 CA-5: caso 1 — sigue dentro: el episodio continúa y no se vuelve a avisar', () => {
  it('mismo id, mismo openedAt, closedAt null y EXACTAMENTE un aviso de entrada', async () => {
    // Zona [12,00 – 14,00], cotización 13,00: el ciclo abre el episodio y avisa.
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 12, buyMax: 14 });
    const primero = await ciclo({ ITX: cot('13', DIA_1) });
    expect(primero.triggers.opened).toHaveLength(1);
    expect(primero.notifications!.entries).toHaveLength(1);

    const [episodio] = await episodiosDe(w.id);
    expect(await entradasDe(episodio.id)).toHaveLength(1);

    // El usuario amplía la zona por arriba. El precio sigue dentro.
    await updateWatchedZones(db, userA, w.id, { buyMin: 12, buyMax: 14.5 });

    const segundo = await ciclo({ ITX: cot('13', DIA_2) });

    // El motor no abre ni cierra nada: es la rama "sigue dentro" (no-op, idempotente).
    expect(segundo.triggers.opened).toHaveLength(0);
    expect(segundo.triggers.closed).toHaveLength(0);

    const despues = await episodiosDe(w.id);
    expect(despues).toHaveLength(1);
    expect(despues[0].id).toBe(episodio.id); // EL MISMO episodio
    expect(despues[0].openedAt.toISOString()).toBe(episodio.openedAt.toISOString());
    expect(despues[0].closedAt).toBeNull();

    // RN-13/RN-14: un aviso de entrada por episodio, y el episodio no cambió de id.
    expect(await entradasDe(episodio.id)).toHaveLength(1);
    expect(segundo.notifications!.entries).toHaveLength(0);
  });
});

describe('SPEC-044 CA-6: caso 2 — el cambio deja el precio fuera: el episodio se cierra', () => {
  it('closedAt = asOf del ciclo, sin aviso por el cierre y con el de entrada intacto', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 12, buyMax: 14 });
    await ciclo({ ITX: cot('13', DIA_1) });
    const [episodio] = await episodiosDe(w.id);
    const [avisoEntrada] = await entradasDe(episodio.id);
    expect(avisoEntrada).toBeDefined();

    // La zona nueva deja el precio (13,00) fuera.
    await updateWatchedZones(db, userA, w.id, { buyMin: 10, buyMax: 11 });

    const segundo = await ciclo({ ITX: cot('13', DIA_2) });

    expect(segundo.triggers.closed).toHaveLength(1);
    expect(segundo.triggers.opened).toHaveLength(0);

    const despues = await episodiosDe(w.id);
    expect(despues).toHaveLength(1);
    expect(despues[0].id).toBe(episodio.id);
    expect(despues[0].closedAt?.toISOString()).toBe(DIA_2); // el asOf del ciclo

    // Cerrar no avisa: no hay aviso de salida, ni nuevo aviso de entrada.
    expect(segundo.notifications!.entries).toHaveLength(0);
    const kinds = (await db.select().from(notifications)).map((n) => n.kind);
    expect(kinds.filter((k) => k === 'entry')).toHaveLength(1);
    expect(new Set(kinds)).toEqual(new Set(['entry', 'digest']));

    // Y el aviso de entrada anterior sigue en la bandeja, tal cual (RN-15).
    const [sigueAhi] = (await db.select().from(notifications)).filter(
      (n) => n.id === avisoEntrada.id,
    );
    expect(sigueAhi.payload).toBe(avisoEntrada.payload);
    expect(sigueAhi.readAt).toBeNull();
  });
});

describe('SPEC-044 CA-7: caso 3 — estaba fuera y el cambio lo mete dentro: eso SÍ es una entrada', () => {
  it('abre un episodio nuevo y emite exactamente un aviso, con el precio y el asOf de la cotización', async () => {
    // Zona [10,00 – 11,00] con el precio en 13,00: fuera, y sin episodio abierto.
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 10, buyMax: 11 });
    const primero = await ciclo({ ITX: cot('13', DIA_1) });
    expect(primero.triggers.opened).toHaveLength(0);
    expect(await episodiosDe(w.id)).toHaveLength(0);

    // El usuario mueve la zona hasta donde está el precio.
    await updateWatchedZones(db, userA, w.id, { buyMin: 12.5, buyMax: 13.5 });

    const segundo = await ciclo({ ITX: cot('13', DIA_2) });

    expect(segundo.triggers.opened).toHaveLength(1);
    const episodios = await episodiosDe(w.id);
    expect(episodios).toHaveLength(1);
    expect(episodios[0].closedAt).toBeNull();
    // D-2: el precio y el asOf son los de la cotización que lo originó, no los de "ahora".
    expect(episodios[0].price).toBe('13');
    expect(episodios[0].asOf.toISOString()).toBe(DIA_2);

    const entradas = await entradasDe(episodios[0].id);
    expect(entradas).toHaveLength(1);
    expect(entradas[0].asOf.toISOString()).toBe(DIA_2);
    expect(entradas[0].payload).toContain('13');
    expect(segundo.sender.sent.filter((m) => m.subject.includes('entró'))).toHaveLength(1);
  });
});

describe('SPEC-044 CA-9: el orden del ciclo protege el digest', () => {
  it('la vigilada que acaba de salir de zona NO aparece diciendo que sigue dentro', async () => {
    const itx = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 12, buyMax: 14 });
    await watchSymbol(db, userA, 'TEF', 'EUR', { buyMin: 12, buyMax: 14 });

    const primero = await ciclo({ ITX: cot('13', DIA_1), TEF: cot('13', DIA_1) });
    expect(primero.notifications!.digests).toHaveLength(1);
    const [digestUno] = await digests(userA);
    expect(digestUno.payload).toContain('ITX');
    expect(digestUno.payload).toContain('TEF');

    // Se edita ITX de modo que su precio quede fuera; TEF no se toca.
    await updateWatchedZones(db, userA, itx.id, { buyMin: 1, buyMax: 2 });

    await ciclo({ ITX: cot('13', DIA_2), TEF: cot('13', DIA_2) });

    // `runRefreshCycle` corre ingesta → disparos → avisos: el episodio de ITX se cierra
    // ANTES de construir el agregado, así que el digest de ESE ciclo lista solo la otra.
    const todos = await digests(userA);
    expect(todos).toHaveLength(2);
    const digestDos = todos.find((d) => d.id !== digestUno.id)!;
    expect(digestDos.payload).toContain('TEF');
    expect(
      digestDos.payload,
      'el digest dice que ITX sigue en zona después de una edición que la sacó: el orden ' +
        'del ciclo (ADR-028 pto. 6) no es un detalle reordenable',
    ).not.toContain('ITX');
  });
});

describe('SPEC-044 CA-10: editar dos veces antes del ciclo', () => {
  it('se reconcilia solo contra los valores VIGENTES; el intermedio no deja rastro', async () => {
    // Fuera de zona y sin episodio: el punto de partida.
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 10, buyMax: 11 });
    await ciclo({ ITX: cot('13', DIA_1) });
    expect(await episodiosDe(w.id)).toHaveLength(0);

    // Primera edición: metería el precio dentro. Segunda: lo vuelve a dejar fuera.
    await updateWatchedZones(db, userA, w.id, { buyMin: 12.5, buyMax: 13.5 });
    await updateWatchedZones(db, userA, w.id, { buyMin: 20, buyMax: 21 });

    const segundo = await ciclo({ ITX: cot('13', DIA_2) });

    expect(segundo.triggers.opened).toHaveLength(0);
    expect(segundo.triggers.closed).toHaveLength(0);
    expect(await episodiosDe(w.id)).toHaveLength(0); // el intermedio no dejó episodio
    expect(await db.select().from(notifications)).toHaveLength(0); // ni aviso
    expect(segundo.sender.sent).toHaveLength(0); // ni envío
  });

  it('y al revés: el ida y vuelta que ACABA dentro abre un episodio, uno solo', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 10, buyMax: 11 });
    await ciclo({ ITX: cot('13', DIA_1) });

    await updateWatchedZones(db, userA, w.id, { buyMin: 20, buyMax: 21 });
    await updateWatchedZones(db, userA, w.id, { buyMin: 12.5, buyMax: 13.5 });

    const segundo = await ciclo({ ITX: cot('13', DIA_2) });

    expect(segundo.triggers.opened).toHaveLength(1);
    expect(await episodiosDe(w.id)).toHaveLength(1);
    expect(segundo.notifications!.entries).toHaveLength(1);
  });
});
