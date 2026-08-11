import { describe, it, expect, beforeEach } from 'vitest';
import { eq } from 'drizzle-orm';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { notifications } from '@/db/schema';
import { refreshQuotes, symbolUniverse } from '@/lib/market/refresh';
import { runCronCycle } from '@/lib/triggers/cycle';
import { MarketstackProvider } from '@/lib/market/marketstack-provider';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';
import { getDiagnosticMap, getQuoteViews, upsertQuote } from '@/lib/market/quotes';
import { FAIL_REASON_TEXT, failReasonText } from '@/lib/market/fail-reason-text';
import type { MarketDataProvider } from '@/lib/market/provider';

// SPEC-020 — El dialecto del símbolo es conocimiento POR MERCADO del adaptador: hay
// mercados con sufijo y mercados que Marketstack solo acepta PELADOS. Y un fallo global
// del proveedor deja de tumbar el ciclo.
//
// NINGÚN test llama a la API real: la tabla de dialecto ya está verificada contra ella
// (2026-08-11) y el free tier son ~100 peticiones/mes. Aquí se usa `fetch` inyectado.

const SECRET = 'test-cron-secret';
const FECHA = '2026-08-10T00:00:00+0000';
const AS_OF = '2026-08-10T00:00:00.000Z';

let db: TestDb;
let userA: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
});

/** `fetch` inyectado que además ESPÍA lo que se pidió (la URL es parte del contrato). */
function spyFetch(body: unknown, opts: { ok?: boolean; status?: number } = {}) {
  const urls: string[] = [];
  const impl = (async (url: string) => {
    urls.push(String(url));
    return { ok: opts.ok ?? true, status: opts.status ?? 200, json: async () => body };
  }) as unknown as typeof fetch;
  return {
    impl,
    urls,
    llamadas: () => urls.length,
    /** El parámetro `symbols` tal cual viaja (URLSearchParams lo decodifica). */
    symbols: () => new URL(urls[0]).searchParams.get('symbols') ?? '',
    enviados: () => (new URL(urls[0]).searchParams.get('symbols') ?? '').split(',').filter(Boolean),
  };
}

const fila = (symbol: string, exchange: string, close: number) => ({
  symbol,
  exchange,
  date: FECHA,
  close,
  adj_close: 999.99, // RN-12: el ajustado se IGNORA a propósito
});

describe('CA-1: dialecto por mercado — mercados CON sufijo', () => {
  it('BMEX, XETR→XETRA, XPAR y XAMS viajan con su sufijo', async () => {
    const f = spyFetch({ data: [] });
    const provider = new MarketstackProvider('key', f.impl);

    await provider.getQuotes([
      { ticker: 'ITX', micCode: 'BMEX' },
      { ticker: 'SAP', micCode: 'XETR' },
      { ticker: 'MC', micCode: 'XPAR' },
      { ticker: 'ASML', micCode: 'XAMS' },
    ]);

    expect(f.enviados()).toEqual(['ITX.BMEX', 'SAP.XETRA', 'MC.XPAR', 'ASML.XAMS']);
  });

  it('el dominio sigue recibiendo el operating MIC canónico, no el dialecto (ADR-012 pto. 4)', async () => {
    const f = spyFetch({ data: [fila('SAP.XETRA', 'XETRA', 179.3)] });
    const provider = new MarketstackProvider('key', f.impl);

    const { quotes } = await provider.getQuotes([{ ticker: 'SAP', micCode: 'XETR' }]);

    expect(f.symbols()).toBe('SAP.XETRA'); // se pide en dialecto…
    expect(quotes).toEqual([{ ticker: 'SAP', micCode: 'XETR', price: '179.3', asOf: AS_OF }]); // …y vuelve canónico
  });
});

describe('CA-2: dialecto por mercado — mercados SIN sufijo (el defecto corregido)', () => {
  it('XNAS y XNYS se piden PELADOS: en la URL no aparece ni .XNAS ni .XNYS', async () => {
    const f = spyFetch({ data: [] });
    const provider = new MarketstackProvider('key', f.impl);

    await provider.getQuotes([
      { ticker: 'AAPL', micCode: 'XNAS' },
      { ticker: 'KO', micCode: 'XNYS' },
    ]);

    expect(f.enviados()).toEqual(['AAPL', 'KO']);
    // Ni codificado ni sin codificar: `.XNAS` es inválido para este proveedor.
    expect(decodeURIComponent(f.urls[0])).not.toMatch(/\.XNAS|\.XNYS/);
  });
});

describe('CA-3: el eco del ticker pelado se empareja y se persiste', () => {
  it('casa por ticker + mercado del campo `exchange`, con close no ajustado y date→asOf', async () => {
    const f = spyFetch({ data: [fila('AAPL', 'XNAS', 308.26)] });
    const provider = new MarketstackProvider('key', f.impl);

    const { quotes, failures } = await provider.getQuotes([{ ticker: 'AAPL', micCode: 'XNAS' }]);

    expect(quotes).toEqual([{ ticker: 'AAPL', micCode: 'XNAS', price: '308.26', asOf: AS_OF }]);
    expect(failures).toEqual([]); // deja de caer en `skipped`: era el defecto
  });

  it('el ciclo lo persiste con la divisa DEL SÍMBOLO (RN-09)', async () => {
    await watchSymbol(db, userA, 'AAPL', 'USD', {}, { micCode: 'XNAS', exchange: 'NASDAQ', name: 'Apple' });
    const f = spyFetch({ data: [fila('AAPL', 'XNAS', 308.26)] });

    const res = await refreshQuotes(db, new MarketstackProvider('key', f.impl));

    expect(res.updated).toEqual(['AAPL']);
    expect(res.skipped).toEqual([]);
    const [view] = await getQuoteViews(db);
    expect(view.price).toBe('308.26');
    expect(view.currency).toBe('USD');
    expect(view.asOf.toISOString()).toBe(AS_OF); // D-2
  });
});

describe('CA-4: eco de OTRO mercado — nunca el precio equivocado', () => {
  it('un eco con exchange XNYS NO se le asigna al pedido de XNAS; sale en failures con motivo', async () => {
    const f = spyFetch({ data: [fila('WEN', 'XNYS', 7.3)] });
    const provider = new MarketstackProvider('key', f.impl);

    const { quotes, failures } = await provider.getQuotes([{ ticker: 'WEN', micCode: 'XNAS' }]);

    expect(quotes).toEqual([]); // un precio del mercado que no es falsearía el P/L (RN-09/RN-06)
    expect(failures).toEqual([{ ticker: 'WEN', micCode: 'XNAS', reason: 'simbolo_no_admitido' }]);
    // Y el motivo NO acusa al valor de estar deslistado: el proveedor sí respondió.
    expect(failReasonText('simbolo_no_admitido')).not.toMatch(/deslistad/i);
  });
});

describe('CA-5: mismo ticker en dos mercados US — la colisión del pelado', () => {
  const dosUS = [
    { ticker: 'WEN', micCode: 'XNAS' },
    { ticker: 'WEN', micCode: 'XNYS' },
  ];

  it('la cadena enviada se deduplica: el símbolo no se pide dos veces (ADR-002)', async () => {
    const f = spyFetch({ data: [fila('WEN', 'XNAS', 7.3)] });

    await new MarketstackProvider('key', f.impl).getQuotes(dosUS);

    expect(f.llamadas()).toBe(1);
    expect(f.enviados()).toEqual(['WEN']); // una sola vez, no `WEN,WEN`
  });

  it('el precio va SOLO al mercado que confirma el eco; el otro sale en failures', async () => {
    const f = spyFetch({ data: [fila('WEN', 'XNAS', 7.3)] });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes(dosUS);

    expect(quotes).toEqual([{ ticker: 'WEN', micCode: 'XNAS', price: '7.3', asOf: AS_OF }]);
    expect(failures).toEqual([{ ticker: 'WEN', micCode: 'XNYS', reason: 'simbolo_no_admitido' }]);
  });

  it('si el eco confirma XNYS, el precio es de XNYS y el que falla es XNAS', async () => {
    const f = spyFetch({ data: [fila('WEN', 'XNYS', 7.3)] });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes(dosUS);

    expect(quotes).toEqual([{ ticker: 'WEN', micCode: 'XNYS', price: '7.3', asOf: AS_OF }]);
    expect(failures).toEqual([{ ticker: 'WEN', micCode: 'XNAS', reason: 'simbolo_no_admitido' }]);
  });
});

describe('CA-6: mercado sin dialecto conocido — no se pide y no se miente', () => {
  it('XSTO no viaja en la petición y sale con `mercado_no_cubierto`', async () => {
    const f = spyFetch({ data: [fila('ITX.BMEX', 'BMEX', 59.1)] });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes([
      { ticker: 'ITX', micCode: 'BMEX' },
      { ticker: 'ERIC_B', micCode: 'XSTO' },
    ]);

    expect(f.enviados()).toEqual(['ITX.BMEX']); // no se gasta cuota adivinando el formato
    expect(f.symbols()).not.toContain('ERIC');
    expect(quotes).toEqual([{ ticker: 'ITX', micCode: 'BMEX', price: '59.1', asOf: AS_OF }]);
    expect(failures).toEqual([{ ticker: 'ERIC_B', micCode: 'XSTO', reason: 'mercado_no_cubierto' }]);
    // Y jamás `simbolo_desconocido`, que diría "puede estar deslistado" — sería falso.
    expect(failReasonText('mercado_no_cubierto')).not.toMatch(/deslistad/i);
  });

  it('si TODO lo pedido es de un mercado sin dialecto, no se llama al proveedor', async () => {
    const f = spyFetch({ data: [] });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes([
      { ticker: 'VOLV_B', micCode: 'XSTO' },
    ]);

    expect(f.llamadas()).toBe(0); // ni una petición: no hay nada que preguntar
    expect(quotes).toEqual([]);
    expect(failures).toEqual([{ ticker: 'VOLV_B', micCode: 'XSTO', reason: 'mercado_no_cubierto' }]);
  });

  it('el ciclo lo reporta con ese motivo, sin abortar', async () => {
    await watchSymbol(db, userA, 'ERIC_B', 'SEK', {}, { micCode: 'XSTO', exchange: 'OMX', name: 'Ericsson B' });
    const f = spyFetch({ data: [] });

    const res = await refreshQuotes(db, new MarketstackProvider('key', f.impl));

    expect(res.skipped).toEqual([{ ticker: 'ERIC_B', reason: 'mercado_no_cubierto' }]);
    expect((await getDiagnosticMap(db)).ERIC_B.reason).toBe('mercado_no_cubierto');
  });
});

describe('CA-7: un fallo GLOBAL del proveedor no tumba el ciclo', () => {
  const pedidos = [
    { ticker: 'ITX', micCode: 'BMEX' },
    { ticker: 'AAPL', micCode: 'XNAS' },
  ];

  it('HTTP 200 con {error:{...}}: el adaptador NO lanza, degrada a fallo por símbolo', async () => {
    const f = spyFetch({ error: { code: 'no_valid_symbols_provided', message: 'no valid symbols' } });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes(pedidos);

    expect(quotes).toEqual([]);
    expect(failures).toHaveLength(2);
    expect(failures.map((x) => x.ticker)).toEqual(['ITX', 'AAPL']); // ninguno desaparece
  });

  it('HTTP no-OK: tampoco lanza', async () => {
    const f = spyFetch({}, { ok: false, status: 503 });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes(pedidos);

    expect(quotes).toEqual([]);
    expect(failures).toHaveLength(2);
  });

  it('el ciclo entero termina en 200, con disparos y avisos ejecutados', async () => {
    // Zona de compra con cotización previa: si el ciclo llega hasta el motor de disparo,
    // el episodio se abre y el aviso se emite AUNQUE el proveedor haya fallado en bloque.
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 50, buyMax: 60 }, { micCode: 'BMEX', exchange: 'BME', name: 'Inditex' });
    const [u] = await symbolUniverse(db);
    await upsertQuote(db, u.symbolId, { price: '55', currency: 'EUR', asOf: AS_OF });

    const f = spyFetch({ error: { code: 'no_valid_symbols_provided', message: 'no valid symbols' } });
    const sender = new FakeNotificationSender();
    const outcome = await runCronCycle({
      authHeader: `Bearer ${SECRET}`,
      secret: SECRET,
      db,
      provider: new MarketstackProvider('key', f.impl),
      sender,
    });

    expect(outcome.status).toBe(200); // ningún ciclo muere por el proveedor
    if (outcome.status !== 200) return;
    expect(outcome.body.refresh.skipped).toHaveLength(1);
    expect(outcome.body.refresh.skipped[0].reason).not.toBe('simbolo_desconocido');
    expect(outcome.body.triggers.opened).toBe(1); // la evaluación de disparos SÍ corrió
    expect(await db.select().from(notifications).where(eq(notifications.kind, 'entry'))).toHaveLength(1);
    expect(sender.sent.length).toBeGreaterThan(0); // y los avisos también
  });
});

describe('CA-8: rechazo de la petición ≠ caída del proveedor', () => {
  const pedido = [{ ticker: 'ITX', micCode: 'BMEX' }];

  const motivo = async (impl: typeof fetch) =>
    (await new MarketstackProvider('key', impl).getQuotes(pedido)).failures[0].reason;

  it('son motivos DISTINTOS y ninguno es `simbolo_desconocido`', async () => {
    const rechazo = await motivo(spyFetch({ error: { code: 'no_valid_symbols_provided', message: 'x' } }).impl);
    const caida = await motivo(spyFetch({}, { ok: false, status: 500 }).impl);

    expect(rechazo).toBe('simbolo_no_admitido'); // el proveedor respondió y rechazó NUESTRA petición
    expect(caida).toBe('proveedor_no_disponible'); // caída real: el reintento sí puede arreglarlo
    expect(rechazo).not.toBe(caida);
    expect([rechazo, caida]).not.toContain('simbolo_desconocido'); // "puede estar deslistado" sería falso
  });

  it('la red caída (fetch que lanza) es `proveedor_no_disponible`, y no revienta', async () => {
    const roto = (async () => {
      throw new Error('ECONNRESET');
    }) as unknown as typeof fetch;

    const { quotes, failures } = await new MarketstackProvider('key', roto).getQuotes(pedido);

    expect(quotes).toEqual([]);
    expect(failures).toEqual([{ ticker: 'ITX', micCode: 'BMEX', reason: 'proveedor_no_disponible' }]);
  });

  it('el texto del motivo nuevo ni acusa al valor ni promete que el reintento lo arregle', () => {
    const texto = FAIL_REASON_TEXT.simbolo_no_admitido;

    expect(texto).toBeTruthy();
    expect(texto).not.toMatch(/deslistad|reintent|próximo ciclo/i);
    expect(texto).not.toMatch(/plan|403|upgrade|no_valid_symbols/i); // ni texto crudo del proveedor
    expect(failReasonText('simbolo_no_admitido')).toBe(texto);
  });
});

describe('CA-9: defensa en profundidad — el dominio también degrada', () => {
  beforeEach(async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, { micCode: 'BMEX', exchange: 'BME', name: 'Inditex' });
  });

  it('un adaptador que LANZA no aborta el ciclo: motivo `proveedor_no_disponible` persistido', async () => {
    const explota: MarketDataProvider = {
      getQuotes: async () => {
        throw new Error('excepción inesperada del adaptador');
      },
    };

    const res = await refreshQuotes(db, explota);

    expect(res.updated).toEqual([]);
    expect(res.skipped).toEqual([{ ticker: 'ITX', reason: 'proveedor_no_disponible' }]);
    expect((await getDiagnosticMap(db)).ITX.reason).toBe('proveedor_no_disponible'); // SPEC-016 CA-2
  });

  it('sin MARKETSTACK_API_KEY el ciclo tampoco muere', async () => {
    const sinKey = new MarketstackProvider('', spyFetch({ data: [] }).impl);

    const res = await refreshQuotes(db, sinKey);

    expect(res.skipped).toEqual([{ ticker: 'ITX', reason: 'proveedor_no_disponible' }]);
  });

  it('el ciclo completo responde 200 aunque el adaptador lance', async () => {
    const explota: MarketDataProvider = {
      getQuotes: async () => {
        throw new Error('boom');
      },
    };

    const outcome = await runCronCycle({
      authHeader: `Bearer ${SECRET}`,
      secret: SECRET,
      db,
      provider: explota,
      sender: new FakeNotificationSender(),
    });

    expect(outcome.status).toBe(200);
  });
});

describe('CA-10: sin regresión de lo ya entregado', () => {
  it('batch de UNA llamada mezclando mercados con y sin sufijo, con dedupe por símbolo', async () => {
    const f = spyFetch({ data: [] });

    await new MarketstackProvider('key', f.impl).getQuotes([
      { ticker: 'ITX', micCode: 'BMEX' },
      { ticker: 'SAN', micCode: 'BMEX' },
      { ticker: 'AAPL', micCode: 'XNAS' },
      { ticker: 'KO', micCode: 'XNYS' },
    ]);

    expect(f.llamadas()).toBe(1); // ADR-002: 1 símbolo = 1 llamada por ciclo
    expect(f.enviados()).toEqual(['ITX.BMEX', 'SAN.BMEX', 'AAPL', 'KO']);
  });

  it('el mismo ticker en Madrid y en Nueva York no se cruza (ADR-007)', async () => {
    // SAN cotiza en BMEX (EUR) y en XNYS (USD). Con XNYS pelado, la cadena enviada es
    // `SAN` y `SAN.BMEX`: dos cadenas distintas, dos ecos distintos, cero cruce.
    const f = spyFetch({ data: [fila('SAN.BMEX', 'BMEX', 12.852), fila('SAN', 'XNYS', 14.6)] });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes([
      { ticker: 'SAN', micCode: 'BMEX' },
      { ticker: 'SAN', micCode: 'XNYS' },
    ]);

    expect(f.enviados()).toEqual(['SAN.BMEX', 'SAN']);
    expect(quotes).toEqual([
      { ticker: 'SAN', micCode: 'BMEX', price: '12.852', asOf: AS_OF },
      { ticker: 'SAN', micCode: 'XNYS', price: '14.6', asOf: AS_OF },
    ]);
    expect(failures).toEqual([]);
  });

  it('sigue tomando `close` y no `adj_close` (RN-12) y un símbolo sin MIC no se cotiza', async () => {
    const f = spyFetch({ data: [fila('ITX.BMEX', 'BMEX', 59.1)] });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes([
      { ticker: 'ITX', micCode: 'BMEX' },
      { ticker: 'VIEJO', micCode: null },
    ]);

    expect(quotes[0].price).toBe('59.1'); // el adj_close de la fila era 999.99
    expect(failures).toEqual([{ ticker: 'VIEJO', micCode: null, reason: 'sin_identidad_de_mercado' }]);
    expect(f.symbols()).not.toContain('VIEJO');
  });

  it('el diagnóstico se limpia cuando el símbolo vuelve a cotizar (SPEC-016 CA-8)', async () => {
    await watchSymbol(db, userA, 'AAPL', 'USD', {}, { micCode: 'XNAS', exchange: 'NASDAQ', name: 'Apple' });

    // Ciclo 1: fallo global → diagnóstico con motivo.
    await refreshQuotes(db, new MarketstackProvider('key', spyFetch({ error: { code: 'no_valid_symbols_provided' } }).impl));
    expect((await getDiagnosticMap(db)).AAPL).toBeDefined();

    // Ciclo 2: el pelado funciona → cotiza y el aviso desaparece.
    const res = await refreshQuotes(db, new MarketstackProvider('key', spyFetch({ data: [fila('AAPL', 'XNAS', 308.26)] }).impl));

    expect(res.updated).toEqual(['AAPL']);
    expect((await getDiagnosticMap(db)).AAPL).toBeUndefined();
  });
});
