import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { quoteDiagnostics, quotes } from '@/db/schema';
import { watchSymbol } from '@/lib/watchlist/service';
import { runRefreshCycle } from '@/lib/triggers/cycle';
import { symbolUniverse } from '@/lib/market/refresh';
import { upsertDiagnostic } from '@/lib/market/quotes';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';
import type { QuoteFailureReason } from '@/lib/market/provider';

/**
 * SPEC-058 **CA-15** — *el ciclo y el alta ingieren igual, o no ingieren igual*.
 *
 * Este es el CA que sostiene **ADR-038 pto. 2** —un solo cuerpo de ingesta— y la forma
 * de medirlo no es opcional: **se ejecutan los dos caminos reales en el mismo test** y
 * se comparan **entre sí**, no contra una expectativa escrita a mano. Comparar cada
 * camino con una constante deja pasar exactamente el fallo que importa: que los dos
 * hagan algo consistente y distinto el uno del otro.
 *
 * Los dos caminos son los de producción:
 *  - el **ciclo**: `runRefreshCycle` (SPEC-005), tal cual lo invoca el cron;
 *  - el **alta**: `watchAction`, la server action de `/vigiladas`, con el arnés que ya
 *    usan `spec044-accion-edicion.test.ts` y `cartera-actions-role.test.ts`.
 *
 * Cada uno corre sobre **su propia base**, sembrada igual, porque lo que se compara es
 * el estado que cada camino deja: mismo `price`, misma `currency`, mismo `asOf` y el
 * mismo tratamiento del diagnóstico. `updatedAt` queda fuera de la comparación a
 * propósito: es un reloj, y RN-16 lo que exige es que **se mueva**, no que coincida al
 * milisegundo entre dos ejecuciones (eso lo mide CA-2).
 *
 * Y por qué un segundo camino sería caro, para quien venga a "simplificar": ADR-038
 * pto. 2 lo dice con el caso del repositorio — un segundo constructor del símbolo del
 * proveedor es cómo entra una serie envenenada.
 */

const contexto: {
  db: unknown;
  sesion: { user?: { id: string; email: string } } | null;
  provider: FakeMarketDataProvider;
} = { db: null, sesion: null, provider: new FakeMarketDataProvider({}) };

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

vi.mock('@/lib/market/quote-provider-factory', () => ({
  quoteProvider: () => contexto.provider,
}));

const { watchAction } = await import('@/app/vigiladas/actions');

const MERCADO = { micCode: 'BMEX', exchange: 'BME', name: 'Inditex', instrumentType: 'stock' };
const ASOF = '2026-08-24T00:00:00.000Z';
const PRECIO = { price: '53.72', currency: 'EUR', asOf: ASOF };

/** El formulario de alta tal como lo manda `/vigiladas` tras elegir del buscador. */
function formAlta(): FormData {
  const fd = new FormData();
  fd.set('ticker', 'ITX');
  fd.set('micCode', MERCADO.micCode);
  fd.set('currency', 'EUR');
  fd.set('exchange', MERCADO.exchange);
  fd.set('name', MERCADO.name);
  fd.set('instrumentType', MERCADO.instrumentType);
  fd.set('buyMin', '50');
  fd.set('buyMax', '60');
  return fd;
}

/** Lo que queda persistido de la ingesta de un símbolo: la fila y su diagnóstico. */
async function ingerido(db: TestDb, symbolId: string) {
  const [q] = await db.select().from(quotes).where(eq(quotes.symbolId, symbolId));
  const [d] = await db
    .select()
    .from(quoteDiagnostics)
    .where(eq(quoteDiagnostics.symbolId, symbolId));
  return {
    cotizacion: q ? { price: q.price, currency: q.currency, asOf: q.asOf.toISOString() } : null,
    diagnostico: d ? (d.reason as QuoteFailureReason) : null,
  };
}

/**
 * El camino del CICLO: la vigilada ya existe, el cron corre y `refreshQuotes` ingiere.
 * Sin `sender`, que es como lo invocan los tests del motor desde SPEC-005: aquí se mide
 * lo que queda ingerido, no el aviso (eso es CA-10).
 */
async function porElCiclo(
  precios: Record<string, { price: string; currency: string; asOf: string }>,
  fallos: Record<string, QuoteFailureReason> = {},
  conDiagnosticoPrevio = false,
) {
  const { db } = await makeTestDb();
  const userId = (await registerUser(db, 'ciclo@example.com', 'clave')).id;
  await watchSymbol(db, userId, 'ITX', 'EUR', { buyMin: 50, buyMax: 60 }, MERCADO);
  const [u] = await symbolUniverse(db);
  if (conDiagnosticoPrevio) await upsertDiagnostic(db, u.symbolId, 'proveedor_no_disponible');

  const provider = new FakeMarketDataProvider(precios, fallos);
  await runRefreshCycle(db, provider);
  return { estado: await ingerido(db, u.symbolId), provider };
}

/** El camino del ALTA: la server action real de `/vigiladas`, con su fake provider. */
async function porElAlta(
  precios: Record<string, { price: string; currency: string; asOf: string }>,
  fallos: Record<string, QuoteFailureReason> = {},
  conDiagnosticoPrevio = false,
) {
  const { db } = await makeTestDb();
  contexto.db = db;
  const u = await registerUser(db, 'alta@example.com', 'clave');
  contexto.sesion = { user: { id: u.id, email: 'alta@example.com' } };
  contexto.provider = new FakeMarketDataProvider(precios, fallos);

  if (conDiagnosticoPrevio) {
    // El diagnóstico previo necesita el símbolo, y el símbolo lo crea el alta. Se da de
    // alta una vez SIN proveedor que acierte, se siembra el diagnóstico y se repite el
    // gesto: `watchSymbol` es upsert, así que la vigilada es la misma (ADR-038 pto. 6).
    const mudo = new FakeMarketDataProvider({}, {});
    contexto.provider = mudo;
    await watchAction(undefined, formAlta());
    const [s] = await symbolUniverse(db);
    await upsertDiagnostic(db, s.symbolId, 'proveedor_no_disponible');
    contexto.provider = new FakeMarketDataProvider(precios, fallos);
  }

  const resultado = await watchAction(undefined, formAlta());
  const [s] = await symbolUniverse(db);
  return { estado: await ingerido(db, s.symbolId), provider: contexto.provider, resultado };
}

describe('SPEC-058 CA-15: el ciclo y el alta ingieren por el MISMO cuerpo', () => {
  it('respuesta BUENA: los dos escriben la misma fila y los dos borran el diagnóstico previo', async () => {
    const precios = { 'ITX:BMEX': PRECIO };
    const ciclo = await porElCiclo(precios, {}, true);
    const alta = await porElAlta(precios, {}, true);

    // La comparación es entre los DOS caminos reales, no contra una constante.
    expect(alta.estado).toEqual(ciclo.estado);
    // Y que no sea "los dos no hicieron nada": la fila está y el diagnóstico se fue.
    expect(ciclo.estado.cotizacion).toEqual({ price: '53.72', currency: 'EUR', asOf: ASOF });
    expect(ciclo.estado.diagnostico).toBeNull();
  });

  it('FALLO CLASIFICADO: ninguno escribe fila y los dos registran el mismo motivo', async () => {
    const fallos = { 'ITX:BMEX': 'mercado_no_cubierto' as const };
    const ciclo = await porElCiclo({}, fallos);
    const alta = await porElAlta({}, fallos);

    expect(alta.estado).toEqual(ciclo.estado);
    expect(ciclo.estado.cotizacion).toBeNull();
    expect(ciclo.estado.diagnostico).toBe('mercado_no_cubierto');
  });

  it('los dos piden la MISMA identidad: (ticker, operating MIC) y no el ticker pelado', async () => {
    const precios = { 'ITX:BMEX': PRECIO };
    const ciclo = await porElCiclo(precios);
    const alta = await porElAlta(precios);

    expect(alta.provider.calls).toEqual(ciclo.provider.calls);
    expect(ciclo.provider.calls).toEqual([[{ ticker: 'ITX', micCode: 'BMEX' }]]);
  });

  it('el alta no tiene un cuerpo de ingesta propio: llama al del refresco', () => {
    // La mitad estructural de CA-15 (ADR-038 pto. 2). Lo de arriba mide que HOY hacen lo
    // mismo; esto mide que **no pueden** dejar de hacerlo sin que se vea. Ni la action ni
    // el servicio de watchlist conocen el puerto del proveedor, ni el upsert de la
    // cotización, ni el vocabulario de diagnóstico: todo eso vive en `market/refresh.ts`.
    for (const ruta of ['src/app/vigiladas/actions.ts', 'src/lib/watchlist/service.ts']) {
      const fuente = readFileSync(ruta, 'utf8');
      expect(fuente, `${ruta} construye su propia petición al proveedor`).not.toMatch(
        /getQuotes|quoteKey/,
      );
      expect(fuente, `${ruta} persiste cotizaciones por su cuenta`).not.toMatch(
        /upsertQuote|upsertDiagnostic|clearDiagnostic/,
      );
    }
  });
});
