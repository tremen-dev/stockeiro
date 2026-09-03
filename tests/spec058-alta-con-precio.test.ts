import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { quoteDiagnostics, quotes, watchedSymbols } from '@/db/schema';
import { getOrCreateSymbol } from '@/lib/portfolio/symbols';
import { watchSymbol, unwatch } from '@/lib/watchlist/service';
import { zoneStatusForUser } from '@/lib/watchlist/zone-status';
import { upsertQuote } from '@/lib/market/quotes';
import {
  PRESUPUESTO_REFRESCO_BAJO_DEMANDA_MS,
  refreshSymbolOnDemand,
} from '@/lib/market/refresh';
import {
  UMBRAL_SIN_REFRESCAR_MS,
  cotizacionVigente,
  estaSinRefrescar,
} from '@/lib/market/sin-refrescar';
import { FakeMarketDataProvider } from '@/lib/market/fake-provider';
import type {
  MarketDataProvider,
  ProviderQuote,
  QuoteFailureReason,
  QuoteRequest,
  QuotesResult,
} from '@/lib/market/provider';

/**
 * SPEC-058 — **el alta de una vigilada trae su precio**, medido sobre la server action
 * real (`watchAction`) y sobre lo que queda en la base.
 *
 * Cubre CA-1, CA-2, CA-4 (rebanada 1), CA-5 a CA-9 (rebanada 2) y CA-12 a CA-14
 * (rebanada 4). CA-3 y la mitad de pantalla de CA-11 son de navegador y viven en
 * `tests/e2e/spec058-alta-con-precio.spec.ts`; CA-10 va aparte porque su control positivo
 * arrastra el ciclo entero, y CA-15 compara los dos caminos en su propio fichero.
 *
 * El arnés es el que ya usan `spec044-accion-edicion.test.ts` y
 * `cartera-actions-role.test.ts`: PGlite por `@/db/client`, una sesión de mentira por
 * `auth()` y —lo único nuevo— el **proveedor** por su factory, que es la misma costura
 * por la que el e2e mete su catálogo con `E2E_FAKE_QUOTES=1`.
 */

const contexto: {
  db: unknown;
  sesion: { user?: { id: string; email: string } } | null;
  provider: MarketDataProvider;
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

const H = 3_600_000;
const ASOF = '2026-08-24T00:00:00.000Z';
const BMEX = { micCode: 'BMEX', exchange: 'BME', name: 'Inditex', instrumentType: 'stock' };
const XNYS = { micCode: 'XNYS', exchange: 'NYSE', name: 'Banco Santander', instrumentType: 'stock' };

let db: TestDb;
let userA: string;
let userB: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  contexto.db = db;
  const a = await registerUser(db, 'a@example.com', 'clave');
  const b = await registerUser(db, 'b@example.com', 'clave');
  userA = a.id;
  userB = b.id;
  contexto.sesion = { user: { id: a.id, email: 'a@example.com' } };
  contexto.provider = new FakeMarketDataProvider({});
});

const comoUsuario = (id: string, email: string) => {
  contexto.sesion = { user: { id, email } };
};

/** El formulario de alta tal como lo manda `/vigiladas` tras elegir del buscador. */
function alta(
  ticker: string,
  currency: string,
  market: { micCode: string; exchange: string; name: string; instrumentType: string },
  zonas: Record<string, string> = {},
): FormData {
  const fd = new FormData();
  fd.set('ticker', ticker);
  fd.set('micCode', market.micCode);
  fd.set('currency', currency);
  fd.set('exchange', market.exchange);
  fd.set('name', market.name);
  fd.set('instrumentType', market.instrumentType);
  for (const [k, v] of Object.entries(zonas)) fd.set(k, v);
  return fd;
}

const ITX = (zonas: Record<string, string> = {}) => alta('ITX', 'EUR', BMEX, zonas);
const ZONA_QUE_CONTIENE = { buyMin: '50', buyMax: '60' };

const cotizacion = async (symbolId: string) => {
  const [q] = await db.select().from(quotes).where(eq(quotes.symbolId, symbolId));
  return q ?? null;
};

const diagnostico = async (symbolId: string): Promise<QuoteFailureReason | null> => {
  const [d] = await db.select().from(quoteDiagnostics).where(eq(quoteDiagnostics.symbolId, symbolId));
  return d ? (d.reason as QuoteFailureReason) : null;
};

/** Una cotización escrita hace `horas`: el estado que RN-16 mide (por `updated_at`). */
async function sembrarCotizacion(
  symbolId: string,
  q: { price: string; currency: string; asOf: string },
  horas: number,
) {
  await upsertQuote(db, symbolId, q);
  const updatedAt = new Date(Date.now() - horas * H);
  await db.update(quotes).set({ updatedAt }).where(eq(quotes.symbolId, symbolId));
  return updatedAt;
}

/**
 * Proveedor que devuelve **literalmente** lo que se le dice, incluida la ausencia de
 * divisa. Existe porque el fake compartido siempre pone una, y CA-4 necesita el caso
 * real de Marketstack —**no devuelve divisa**— además del contradictorio.
 */
class ProveedorLiteral implements MarketDataProvider {
  public readonly calls: QuoteRequest[][] = [];
  constructor(private readonly respuestas: Record<string, Omit<ProviderQuote, 'ticker' | 'micCode'>>) {}
  async getQuotes(requests: QuoteRequest[]): Promise<QuotesResult> {
    this.calls.push([...requests]);
    const quotes: ProviderQuote[] = [];
    const failures = [];
    for (const r of requests) {
      const clave = `${r.ticker}:${r.micCode}`;
      const q = this.respuestas[clave];
      if (q) quotes.push({ ticker: r.ticker, micCode: r.micCode ?? null, ...q });
      else failures.push({ ticker: r.ticker, micCode: r.micCode ?? null, reason: 'simbolo_desconocido' as const });
    }
    return { quotes, failures };
  }
}

/** Proveedor que LANZA en vez de informar el fallo por símbolo (SPEC-020 CA-9). */
class ProveedorQueLanza implements MarketDataProvider {
  public llamadas = 0;
  async getQuotes(): Promise<QuotesResult> {
    this.llamadas += 1;
    throw new Error('MARKETSTACK_API_KEY no configurada');
  }
}

/** Proveedor que NO responde nunca: la promesa se queda colgada para siempre. */
class ProveedorMudo implements MarketDataProvider {
  public llamadas = 0;
  getQuotes(): Promise<QuotesResult> {
    this.llamadas += 1;
    return new Promise<QuotesResult>(() => {});
  }
}

/** Proveedor que tarda `ms` en contestar, y contesta bien. */
class ProveedorLento implements MarketDataProvider {
  constructor(private readonly ms: number, private readonly precio = '53.72') {}
  async getQuotes(requests: QuoteRequest[]): Promise<QuotesResult> {
    await new Promise((r) => setTimeout(r, this.ms));
    return {
      quotes: requests.map((r) => ({
        ticker: r.ticker,
        micCode: r.micCode ?? null,
        price: this.precio,
        currency: 'EUR',
        asOf: ASOF,
      })),
      failures: [],
    };
  }
}

// ── Rebanada 1 — la vigilada nace con precio (CE-1) ─────────────────────────────────

describe('SPEC-058 CA-1: un símbolo nuevo entra ya con su precio', () => {
  it('tras el alta hay UNA cotización con el precio y el asOf del proveedor, en la divisa del símbolo', async () => {
    contexto.provider = new FakeMarketDataProvider({
      'ITX:BMEX': { price: '53.72', currency: 'EUR', asOf: ASOF },
    });

    expect(await watchAction(undefined, ITX(ZONA_QUE_CONTIENE))).toEqual({ ok: true });

    const [fila] = await zoneStatusForUser(db, userA);
    // La fila deja de estar muda: hay precio y hay estado de zona (RN-11), computados en
    // render sobre la cotización que el alta acaba de persistir.
    expect(fila.hasQuote).toBe(true);
    expect(fila.state).toBe('buy');
    expect(fila.price).toBe('53.72');

    const todas = await db.select().from(quotes);
    expect(todas, 'una cotización por símbolo (ADR-004)').toHaveLength(1);
    expect(todas[0].price).toBe('53.72');
    expect(todas[0].currency).toBe('EUR');
    expect(todas[0].asOf.toISOString()).toBe(ASOF);
    // No ha fallado nada, así que no hay silencio que explicar (SPEC-016).
    expect(await db.select().from(quoteDiagnostics)).toHaveLength(0);
  });
});

describe('SPEC-058 CA-2: el símbolo congelado se descongela', () => {
  it('con precio DISTINTO: la fila lleva el precio nuevo y pierde la marca', async () => {
    const sym = await getOrCreateSymbol(db, 'ITX', 'EUR', BMEX);
    await sembrarCotizacion(sym.id, { price: '40', currency: 'EUR', asOf: '2026-08-01T00:00:00.000Z' }, 60);
    contexto.provider = new FakeMarketDataProvider({
      'ITX:BMEX': { price: '53.72', currency: 'EUR', asOf: ASOF },
    });

    await watchAction(undefined, ITX(ZONA_QUE_CONTIENE));

    const [fila] = await zoneStatusForUser(db, userA);
    expect(fila.price).toBe('53.72');
    expect(fila.sinRefrescar).toBe(false);
  });

  it('con EXACTAMENTE el mismo price y el mismo asOf: la fila también pierde la marca', async () => {
    // El caso que importa, y el que justifica que RN-16 se mida por `updated_at`: lo que
    // la marca cuenta es **cuándo se escribió la fila**, no qué se escribió. El upsert
    // reescribe `updatedAt` aunque el precio no cambie (dictamen de sdd-mercados, pto. 3).
    const sym = await getOrCreateSymbol(db, 'ITX', 'EUR', BMEX);
    const antes = await sembrarCotizacion(sym.id, { price: '53.72', currency: 'EUR', asOf: ASOF }, 60);
    contexto.provider = new FakeMarketDataProvider({
      'ITX:BMEX': { price: '53.72', currency: 'EUR', asOf: ASOF },
    });

    await watchAction(undefined, ITX(ZONA_QUE_CONTIENE));

    const [fila] = await zoneStatusForUser(db, userA);
    expect(fila.price).toBe('53.72'); // el mismo dato…
    expect(fila.asOf?.toISOString()).toBe(ASOF);
    expect(fila.updatedAt!.getTime()).toBeGreaterThan(antes.getTime()); // …escrito de nuevo
    expect(fila.sinRefrescar, 'la marca se va aunque el precio sea idéntico').toBe(false);
  });
});

describe('SPEC-058 CA-4: la identidad y la divisa son las del símbolo, no las del proveedor', () => {
  it('mismo ticker en dos mercados: cada fila lleva su precio y su divisa (RN-09, ADR-012)', async () => {
    const literal = new ProveedorLiteral({
      // Dirección 1: el proveedor devuelve una divisa CONTRADICTORIA (USD sobre un
      // símbolo EUR). Es el caso que permitía guardar USD en SAN@BME (ADR-012).
      'SAN:BMEX': { price: '11.98', currency: 'USD', asOf: ASOF },
      // Dirección 2: el proveedor NO devuelve divisa. Es el caso REAL de Marketstack, y
      // el campo no puede quedarse vacío ni adivinarse.
      'SAN:XNYS': { price: '5.10', asOf: ASOF },
    });
    contexto.provider = literal;

    await watchAction(undefined, alta('SAN', 'EUR', { ...BMEX, name: 'Banco Santander' }));
    await watchAction(undefined, alta('SAN', 'USD', XNYS));

    const filas = await zoneStatusForUser(db, userA);
    const porMercado = Object.fromEntries(filas.map((f) => [f.micCode, f]));
    expect(porMercado.BMEX.price).toBe('11.98');
    expect(porMercado.BMEX.currency).toBe('EUR'); // la del símbolo, no la del proveedor
    expect(porMercado.XNYS.price).toBe('5.10');
    expect(porMercado.XNYS.currency).toBe('USD'); // no se queda vacía ni se adivina

    const guardadas = await db.select().from(quotes);
    expect(guardadas.map((q) => q.currency).sort()).toEqual(['EUR', 'USD']);
    // Y se pidió por (ticker, operating MIC) las dos veces: dos claves, no una.
    expect(literal.calls).toEqual([
      [{ ticker: 'SAN', micCode: 'BMEX' }],
      [{ ticker: 'SAN', micCode: 'XNYS' }],
    ]);
  });
});

// ── Rebanada 2 — nunca peor que hoy (CE-2) ──────────────────────────────────────────

describe('SPEC-058 CA-5: fallo clasificado — el alta se completa y el silencio deja de ser mudo', () => {
  it('sin cotización, con las cuatro zonas tal como se escribieron y su motivo vigente', async () => {
    contexto.provider = new FakeMarketDataProvider({}, { 'ITX:BMEX': 'simbolo_no_admitido' });

    expect(
      await watchAction(undefined, ITX({ buyMin: '20', buyMax: '25', sellMin: '35', sellMax: '40' })),
    ).toEqual({ ok: true });

    const [w] = await db.select().from(watchedSymbols).where(eq(watchedSymbols.userId, userA));
    expect([w.buyMin, w.buyMax, w.sellMin, w.sellMax]).toEqual(['20', '25', '35', '40']);
    expect(await cotizacion(w.symbolId)).toBeNull();
    // La fila explica su silencio DESDE EL PRIMER MINUTO, no en el ciclo diario siguiente.
    expect(await diagnostico(w.symbolId)).toBe('simbolo_no_admitido');
  });
});

describe('SPEC-058 CA-6: fallo inesperado — el alta tampoco se entera', () => {
  it('un adaptador que LANZA degrada a proveedor_no_disponible, sin motivo nuevo', async () => {
    const roto = new ProveedorQueLanza();
    contexto.provider = roto;

    expect(await watchAction(undefined, ITX(ZONA_QUE_CONTIENE))).toEqual({ ok: true });

    const [w] = await db.select().from(watchedSymbols).where(eq(watchedSymbols.userId, userA));
    expect(roto.llamadas).toBe(1);
    expect(await cotizacion(w.symbolId)).toBeNull();
    // El camino de degradación que YA existía (SPEC-020 CA-9). Ni una rama propia.
    expect(await diagnostico(w.symbolId)).toBe('proveedor_no_disponible');
  });
});

describe('SPEC-058 CA-7: presupuesto de tiempo, y su agotamiento no inventa nada', () => {
  it(
    'un proveedor que NO responde nunca: el alta TERMINA, devuelve éxito y degrada igual',
    async () => {
      const mudo = new ProveedorMudo();
      contexto.provider = mudo;

      const resultado = await watchAction(undefined, ITX(ZONA_QUE_CONTIENE));

      expect(resultado).toEqual({ ok: true });
      expect(mudo.llamadas).toBe(1); // la petición SALIÓ: el presupuesto ahorra espera, no cuota
      const [w] = await db.select().from(watchedSymbols).where(eq(watchedSymbols.userId, userA));
      // MISMO tratamiento que CA-6: sin motivo `tiempo_agotado` en el vocabulario.
      expect(await diagnostico(w.symbolId)).toBe('proveedor_no_disponible');
    },
    60_000,
  );

  it(
    'y lo que acota la espera es el presupuesto DECLARADO: ~3 s, no una eternidad',
    async () => {
      // El reloj se mide sobre el refresco y no sobre la action, que además hace dos
      // escrituras en la base: sumarlas al cronómetro convierte la propiedad en una
      // carrera contra el arnés. Aquí NO se inyecta presupuesto — se ejerce el que la
      // spec declara, que es lo que CA-7 quiere ver acotando la espera de verdad.
      const w = await watchSymbol(db, userA, 'ITX', 'EUR', ZONA_QUE_CONTIENE, BMEX);
      const t0 = Date.now();
      await refreshSymbolOnDemand(db, new ProveedorMudo(), w.symbolId);
      const tardado = Date.now() - t0;

      expect(tardado, 'esperó menos que el presupuesto: entonces no lo aplicó')
        .toBeGreaterThanOrEqual(PRESUPUESTO_REFRESCO_BAJO_DEMANDA_MS - 100);
      expect(tardado, 'esperó bastante más que el presupuesto')
        .toBeLessThan(PRESUPUESTO_REFRESCO_BAJO_DEMANDA_MS + 4_000);
      expect(await diagnostico(w.symbolId)).toBe('proveedor_no_disponible');
    },
    60_000,
  );

  it('el presupuesto es inyectable donde se aplica: agotado degrada, sin esperar segundos reales', async () => {
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', ZONA_QUE_CONTIENE, BMEX);
    const resultado = await refreshSymbolOnDemand(db, new ProveedorLento(400), w.symbolId, {
      presupuestoMs: 20,
    });

    expect(resultado.pedido).toBe(true);
    expect(await cotizacion(w.symbolId)).toBeNull();
    expect(await diagnostico(w.symbolId)).toBe('proveedor_no_disponible');
  });

  it('la otra dirección: POR DEBAJO del presupuesto sí persiste el precio y no deja diagnóstico', async () => {
    // Sin esta mitad la guardia estaría cazando «el proveedor falla» en vez de «el
    // proveedor tarda», y pasaría igual con el presupuesto puesto a cero.
    const w = await watchSymbol(db, userA, 'ITX', 'EUR', ZONA_QUE_CONTIENE, BMEX);
    await refreshSymbolOnDemand(db, new ProveedorLento(5), w.symbolId, { presupuestoMs: 1_000 });

    expect((await cotizacion(w.symbolId))?.price).toBe('53.72');
    expect(await diagnostico(w.symbolId)).toBeNull();
  });

  it('el ciclo NO lleva presupuesto: solo el refresco bajo demanda lo aplica', async () => {
    // ADR-038 pto. 5: el presupuesto es una propiedad de la paciencia de QUIEN LLAMA. El
    // cron no tiene prisa y su firma no admite ninguno.
    expect(PRESUPUESTO_REFRESCO_BAJO_DEMANDA_MS).toBe(3_000);
  });
});

describe('SPEC-058 CA-8: marcar no es borrar — un fallo no destruye el precio viejo', () => {
  const VIEJA = { price: '40', currency: 'EUR', asOf: '2026-08-01T00:00:00.000Z' };

  async function congelada() {
    const sym = await getOrCreateSymbol(db, 'ITX', 'EUR', BMEX);
    const updatedAt = await sembrarCotizacion(sym.id, VIEJA, 60);
    return { symbolId: sym.id, updatedAt };
  }

  async function intacta(symbolId: string, updatedAt: Date, motivo: QuoteFailureReason) {
    const q = await cotizacion(symbolId);
    expect(q!.price).toBe(VIEJA.price);
    expect(q!.currency).toBe(VIEJA.currency);
    expect(q!.asOf.toISOString()).toBe(VIEJA.asOf);
    expect(q!.updatedAt.getTime(), 'ni siquiera se reescribió la fila').toBe(updatedAt.getTime());
    const [fila] = await zoneStatusForUser(db, userA);
    expect(fila.sinRefrescar, 'sigue sin presentarse como vigente').toBe(true);
    expect(fila.failReason, 'y ahora acompañada de su motivo').toBe(motivo);
  }

  it('fallo clasificado (CA-5): la cotización vieja sigue ahí y sigue marcada', async () => {
    const { symbolId, updatedAt } = await congelada();
    contexto.provider = new FakeMarketDataProvider({}, { 'ITX:BMEX': 'mercado_no_cubierto' });
    await watchAction(undefined, ITX(ZONA_QUE_CONTIENE));
    await intacta(symbolId, updatedAt, 'mercado_no_cubierto');
  });

  it('excepción inesperada (CA-6): idem', async () => {
    const { symbolId, updatedAt } = await congelada();
    contexto.provider = new ProveedorQueLanza();
    await watchAction(undefined, ITX(ZONA_QUE_CONTIENE));
    await intacta(symbolId, updatedAt, 'proveedor_no_disponible');
  });

  it('presupuesto agotado (CA-7): idem', async () => {
    const { symbolId, updatedAt } = await congelada();
    await watchSymbol(db, userA, 'ITX', 'EUR', ZONA_QUE_CONTIENE, BMEX);
    await refreshSymbolOnDemand(db, new ProveedorLento(400), symbolId, { presupuestoMs: 20 });
    await intacta(symbolId, updatedAt, 'proveedor_no_disponible');
  });
});

describe('SPEC-058 CA-9: el resultado del refresco no puede alterar el alta', () => {
  it(
    'acierta, falla clasificado, lanza o no responde: el alta es indistinguible en los cuatro',
    async () => {
      const proveedores: Array<[string, MarketDataProvider]> = [
        ['acierta', new FakeMarketDataProvider({ 'ITX:BMEX': { price: '53.72', currency: 'EUR', asOf: ASOF } })],
        ['falla clasificado', new FakeMarketDataProvider({}, { 'ITX:BMEX': 'mercado_no_cubierto' })],
        ['lanza', new ProveedorQueLanza()],
        ['no responde', new ProveedorMudo()],
      ];

      const observados: Array<{ caso: string; resultado: unknown; fila: unknown; filas: number }> = [];
      for (const [caso, provider] of proveedores) {
        ({ db } = await makeTestDb());
        contexto.db = db;
        const u = await registerUser(db, 'a@example.com', 'clave');
        comoUsuario(u.id, 'a@example.com');
        contexto.provider = provider;

        const resultado = await watchAction(
          undefined,
          ITX({ buyMin: '20', buyMax: '25', sellMin: '35', sellMax: '40' }),
        );
        const todas = await db.select().from(watchedSymbols);
        const [w] = todas;
        observados.push({
          caso,
          resultado,
          fila: { buyMin: w.buyMin, buyMax: w.buyMax, sellMin: w.sellMin, sellMax: w.sellMax },
          filas: todas.length,
        });
      }

      const [primero, ...resto] = observados;
      for (const otro of resto) {
        expect(otro.resultado, `${otro.caso} devuelve otra cosa`).toEqual(primero.resultado);
        expect(otro.fila, `${otro.caso} deja otra fila`).toEqual(primero.fila);
        expect(otro.filas, `${otro.caso} deja otro recuento`).toBe(primero.filas);
      }
      // Y que no sea "los cuatro fallaron igual": el alta se completó de verdad.
      expect(primero.resultado).toEqual({ ok: true });
      expect(primero.filas).toBe(1);
      expect(primero.fila).toEqual({ buyMin: '20', buyMax: '25', sellMin: '35', sellMax: '40' });
    },
    90_000, // cuatro bases PGlite y una espera de presupuesto: holgura para la suite entera
  );
});

// ── Rebanada 4 — el gasto: acotado y contado ────────────────────────────────────────

describe('SPEC-058 CA-12: no se le pide al proveedor un precio que ya está al día', () => {
  it('cotización escrita hace una hora: CERO llamadas, y la fila enseña precio y estado igual', async () => {
    const sym = await getOrCreateSymbol(db, 'ITX', 'EUR', BMEX);
    await sembrarCotizacion(sym.id, { price: '53.72', currency: 'EUR', asOf: ASOF }, 1);
    const provider = new FakeMarketDataProvider({
      'ITX:BMEX': { price: '99.99', currency: 'EUR', asOf: ASOF },
    });
    contexto.provider = provider;

    await watchAction(undefined, ITX(ZONA_QUE_CONTIENE));

    // La guardia cuenta INVOCACIONES, no la forma de una llamada concreta.
    expect(provider.calls, 'no se gasta cuota por un dato que ya se tiene').toHaveLength(0);
    const [fila] = await zoneStatusForUser(db, userA);
    expect(fila.price).toBe('53.72'); // CE-1 se cumple sin gastar nada
    expect(fila.state).toBe('buy');
  });

  it('sin cotización ninguna: SÍ se llama', async () => {
    const provider = new FakeMarketDataProvider({
      'ITX:BMEX': { price: '53.72', currency: 'EUR', asOf: ASOF },
    });
    contexto.provider = provider;
    await watchAction(undefined, ITX(ZONA_QUE_CONTIENE));
    expect(provider.calls).toHaveLength(1);
  });

  it('cotización SIN REFRESCAR: SÍ se llama', async () => {
    const sym = await getOrCreateSymbol(db, 'ITX', 'EUR', BMEX);
    await sembrarCotizacion(sym.id, { price: '40', currency: 'EUR', asOf: ASOF }, 60);
    const provider = new FakeMarketDataProvider({
      'ITX:BMEX': { price: '53.72', currency: 'EUR', asOf: ASOF },
    });
    contexto.provider = provider;
    await watchAction(undefined, ITX(ZONA_QUE_CONTIENE));
    expect(provider.calls).toHaveLength(1);
  });
});

describe('SPEC-058 CA-13: repetir el gesto no repite el gasto', () => {
  const provider = () => contexto.provider as FakeMarketDataProvider;

  beforeEach(() => {
    contexto.provider = new FakeMarketDataProvider({
      'ITX:BMEX': { price: '53.72', currency: 'EUR', asOf: ASOF },
    });
  });

  it('dar de alta DOS VECES seguidas lo mismo: una sola llamada en total', async () => {
    await watchAction(undefined, ITX({ buyMin: '50', buyMax: '60' }));
    await watchAction(undefined, ITX({ buyMin: '10', buyMax: '20' })); // upsert de zonas
    expect(provider().calls).toHaveLength(1);
  });

  it('unwatch y volver a dar de alta: una sola llamada en total', async () => {
    await watchAction(undefined, ITX(ZONA_QUE_CONTIENE));
    const [w] = await db.select().from(watchedSymbols).where(eq(watchedSymbols.userId, userA));
    await unwatch(db, userA, w.id);
    await watchAction(undefined, ITX(ZONA_QUE_CONTIENE));
    // El símbolo salió del universo y volvió, pero su cotización sigue siendo vigente:
    // la condición mira el DATO, no el gesto (ADR-038 pto. 6, alternativa (f) rechazada).
    expect(provider().calls).toHaveLength(1);
  });

  it('un SEGUNDO usuario que da de alta el mismo símbolo: una sola llamada en total', async () => {
    await watchAction(undefined, ITX(ZONA_QUE_CONTIENE));
    comoUsuario(userB, 'b@example.com');
    await watchAction(undefined, ITX({ buyMin: '10', buyMax: '20' }));
    expect(provider().calls).toHaveLength(1);
    // …y los dos ven el precio: el símbolo es compartido (ADR-002).
    expect((await zoneStatusForUser(db, userB))[0].price).toBe('53.72');
  });
});

describe('SPEC-058 CA-14: la condición de gasto y la marca de la pantalla no pueden divergir', () => {
  it('para toda antigüedad, «la pantalla la presenta como vigente» y «el alta no la vuelve a pedir» son la MISMA respuesta', async () => {
    // Antigüedades que cruzan el umbral de RN-16 por los dos lados. No se escribe el
    // número: se deriva del único sitio donde vive (`UMBRAL_SIN_REFRESCAR_MS`), para que
    // este test siga midiendo lo mismo el día que el umbral se mueva (F-SPEC-043-2).
    const umbralHoras = UMBRAL_SIN_REFRESCAR_MS / H;
    const antiguedades = [
      0.5,
      umbralHoras / 2,
      umbralHoras - 1,
      umbralHoras - 0.05,
      umbralHoras + 0.05,
      umbralHoras + 1,
      umbralHoras * 2,
    ];

    for (const [i, horas] of antiguedades.entries()) {
      const ticker = `TST${i}`;
      const mercado = { ...BMEX, name: `Prueba ${i}` };
      const sym = await getOrCreateSymbol(db, ticker, 'EUR', mercado);
      // Se vigila ANTES para poder leer lo que la pantalla dice de esa fila; el alta que
      // se mide después es el mismo gesto (upsert), que es lo que CA-13 ya cubre.
      await watchSymbol(db, userA, ticker, 'EUR', {}, mercado);
      await sembrarCotizacion(sym.id, { price: '53.72', currency: 'EUR', asOf: ASOF }, horas);

      const antes = (await zoneStatusForUser(db, userA)).find((f) => f.ticker === ticker)!;
      const provider = new FakeMarketDataProvider({
        [`${ticker}:BMEX`]: { price: '53.72', currency: 'EUR', asOf: ASOF },
      });
      contexto.provider = provider;

      await watchAction(undefined, alta(ticker, 'EUR', mercado));

      const laPantallaLaDaPorVigente = !antes.sinRefrescar;
      const elAltaNoLaVuelveAPedir = provider.calls.length === 0;
      expect(
        elAltaNoLaVuelveAPedir,
        `a ${horas} h la pantalla dice vigente=${laPantallaLaDaPorVigente} y el alta pidió=${!elAltaNoLaVuelveAPedir}`,
      ).toBe(laPantallaLaDaPorVigente);
    }
  });

  it('no hay zona intermedia: el predicado del gasto es la negación exacta del de la pantalla', async () => {
    // La misma propiedad, barrida fina y sin base de datos: para CUALQUIER antigüedad de
    // una cotización que existe, «vigente» y «sin refrescar» son complementarios. Un
    // segundo umbral —o un `>=` donde hay un `>`— abre aquí un hueco visible.
    const ahora = new Date('2026-08-25T12:00:00.000Z');
    for (let minutos = 0; minutos <= 48 * 60; minutos += 7) {
      const updatedAt = new Date(ahora.getTime() - minutos * 60_000);
      expect(cotizacionVigente(updatedAt, ahora)).toBe(!estaSinRefrescar(updatedAt, ahora));
    }
    // Y el caso que NO es simétrico y tiene que seguir sin serlo: sin cotización no hay
    // nada vigente que reutilizar, aunque tampoco haya nada que «dejó de refrescarse».
    expect(estaSinRefrescar(null, ahora)).toBe(false);
    expect(cotizacionVigente(null, ahora)).toBe(false);
  });
});
