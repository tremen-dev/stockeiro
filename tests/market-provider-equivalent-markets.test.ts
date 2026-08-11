import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { refreshQuotes } from '@/lib/market/refresh';
import { runCronCycle } from '@/lib/triggers/cycle';
import { EQUIVALENT_MARKET_GROUPS, MarketstackProvider } from '@/lib/market/marketstack-provider';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';
import { getDiagnosticMap, getQuoteViews } from '@/lib/market/quotes';

// SPEC-021 / ADR-014 — Los dos proveedores discrepan sobre el mercado de un valor: el
// buscador sitúa DOCS en NYSE (`XNYS`, correcto) y Marketstack etiqueta su fila con
// `XNAS`. El rechazo estricto de SPEC-020 CA-4 se relaja SOLO con las tres condiciones a
// la vez: cadena que no nombra mercado, un único pedido para esa cadena, y eco dentro del
// grupo de mercados equivalentes `{XNAS, XNYS}`.
//
// NINGÚN test llama a la API real: `fetch` inyectado y fakes (quedan ~85 llamadas del mes).

const SECRET = 'test-cron-secret';
const FECHA = '2026-08-11T00:00:00+0000';
const AS_OF = '2026-08-11T00:00:00.000Z';

let db: TestDb;
let userA: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
});

function spyFetch(body: unknown) {
  const urls: string[] = [];
  const impl = (async (url: string) => {
    urls.push(String(url));
    return { ok: true, status: 200, json: async () => body };
  }) as unknown as typeof fetch;
  return { impl, urls, enviados: () => (new URL(urls[0]).searchParams.get('symbols') ?? '').split(',').filter(Boolean) };
}

const fila = (symbol: string, exchange: string | undefined, close: number) => ({
  symbol,
  exchange,
  date: FECHA,
  close,
  adj_close: 999.99, // RN-12: el ajustado se IGNORA a propósito
});

/** El caso real observado en producción el 2026-08-11 (SPEC-021, Problema). */
const DOCS_XNYS = [{ ticker: 'DOCS', micCode: 'XNYS' }];
const ECO_DOCS_XNAS = { data: [fila('DOCS', 'XNAS', 25.63)] };

describe('CA-1: el caso real — DOCS pedido en XNYS y etiquetado XNAS por el proveedor', () => {
  it('la cadena viaja PELADA y el precio SÍ se le asigna al pedido', async () => {
    const f = spyFetch(ECO_DOCS_XNAS);

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes(DOCS_XNYS);

    expect(f.enviados()).toEqual(['DOCS']); // la cadena no nombra mercado
    expect(quotes).toEqual([
      { ticker: 'DOCS', micCode: 'XNYS', price: '25.63', asOf: AS_OF, providerMicCode: 'XNAS' },
    ]);
    expect(quotes[0].price).toBe('25.63'); // `close` NO ajustado (RN-12); el adj_close era 999.99
    expect(failures).toEqual([]); // deja de salir con `simbolo_no_admitido`: era el defecto
  });
});

describe('CA-2: el mercado que viaja al dominio es el DEL PEDIDO', () => {
  it('el `micCode` de la cotización es XNYS —el del pedido—, nunca XNAS', async () => {
    const { quotes } = await new MarketstackProvider('key', spyFetch(ECO_DOCS_XNAS).impl).getQuotes(DOCS_XNYS);

    expect(quotes[0].micCode).toBe('XNYS'); // identidad del dominio (ADR-007/ADR-012 pto. 3)
    expect(quotes[0].micCode).not.toBe('XNAS');
  });

  it('el ciclo lo persiste con la divisa DEL SÍMBOLO (RN-09) y su asOf (D-2)', async () => {
    await watchSymbol(db, userA, 'DOCS', 'USD', {}, { micCode: 'XNYS', exchange: 'NYSE', name: 'Doximity' });

    const res = await refreshQuotes(db, new MarketstackProvider('key', spyFetch(ECO_DOCS_XNAS).impl));

    expect(res.updated).toEqual(['DOCS']); // hay dato → hay P/L actual (RN-06)
    expect(res.skipped).toEqual([]);
    const [view] = await getQuoteViews(db);
    expect(view.price).toBe('25.63');
    expect(view.currency).toBe('USD'); // la del símbolo, no la del eco
    expect(view.asOf.toISOString()).toBe(AS_OF);
  });

  it('el diagnóstico del símbolo se limpia cuando por fin cotiza (SPEC-016 CA-8)', async () => {
    await watchSymbol(db, userA, 'DOCS', 'USD', {}, { micCode: 'XNYS', exchange: 'NYSE', name: 'Doximity' });

    // Ciclo 1, comportamiento anterior a esta spec: el proveedor no devuelve nada.
    await refreshQuotes(db, new MarketstackProvider('key', spyFetch({ data: [] }).impl));
    expect((await getDiagnosticMap(db)).DOCS).toBeDefined();

    // Ciclo 2: el eco discrepante ya se acepta → cotiza y el aviso desaparece.
    const res = await refreshQuotes(db, new MarketstackProvider('key', spyFetch(ECO_DOCS_XNAS).impl));

    expect(res.updated).toEqual(['DOCS']);
    expect((await getDiagnosticMap(db)).DOCS).toBeUndefined();
  });
});

describe('CA-3: cadena AMBIGUA — dos pedidos comparten cadena, no se relaja nada', () => {
  const dosUS = [
    { ticker: 'WEN', micCode: 'XNAS' },
    { ticker: 'WEN', micCode: 'XNYS' },
  ];

  it('el precio va SOLO al mercado que el eco confirma; el otro sigue fallando', async () => {
    const f = spyFetch({ data: [fila('WEN', 'XNAS', 7.3)] });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes(dosUS);

    expect(quotes).toEqual([{ ticker: 'WEN', micCode: 'XNAS', price: '7.3', asOf: AS_OF }]);
    expect(failures).toEqual([{ ticker: 'WEN', micCode: 'XNYS', reason: 'simbolo_no_admitido' }]);
  });

  it('el simétrico: eco XNYS → precio a XNYS y XNAS sigue fallando', async () => {
    const f = spyFetch({ data: [fila('WEN', 'XNYS', 7.3)] });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes(dosUS);

    expect(quotes).toEqual([{ ticker: 'WEN', micCode: 'XNYS', price: '7.3', asOf: AS_OF }]);
    expect(failures).toEqual([{ ticker: 'WEN', micCode: 'XNAS', reason: 'simbolo_no_admitido' }]);
  });
});

describe('CA-4: mercado CON sufijo — la cadena ya nombra el mercado, sigue el rechazo', () => {
  it('un pedido único MC@XPAR con eco XMIL NO recibe precio', async () => {
    const f = spyFetch({ data: [fila('MC.XPAR', 'XMIL', 482.45)] });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes([
      { ticker: 'MC', micCode: 'XPAR' },
    ]);

    expect(f.enviados()).toEqual(['MC.XPAR']); // la cadena nombra el mercado: un eco discrepante es anomalía
    expect(quotes).toEqual([]); // los tickers europeos no comparten espacio de nombres
    expect(failures).toEqual([{ ticker: 'MC', micCode: 'XPAR', reason: 'simbolo_no_admitido' }]);
  });

  it('tampoco entre dos mercados con sufijo (ITX@BMEX con eco XETRA)', async () => {
    const f = spyFetch({ data: [fila('ITX.BMEX', 'XETRA', 59.1)] });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes([
      { ticker: 'ITX', micCode: 'BMEX' },
    ]);

    expect(quotes).toEqual([]);
    expect(failures).toEqual([{ ticker: 'ITX', micCode: 'BMEX', reason: 'simbolo_no_admitido' }]);
  });
});

describe('CA-5: eco FUERA del grupo — el guardarraíl de divisa (RN-09)', () => {
  it('un pedido único y pelado WEN@XNAS con eco XETRA NO recibe precio', async () => {
    // Sería un listado alemán en EUR sobre un símbolo en USD: el refresco pondría la
    // divisa del símbolo y guardaríamos euros etiquetados como dólares.
    const f = spyFetch({ data: [fila('WEN', 'XETRA', 6.2)] });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes([
      { ticker: 'WEN', micCode: 'XNAS' },
    ]);

    expect(f.enviados()).toEqual(['WEN']); // cadena pelada y única… pero el eco no está en el grupo
    expect(quotes).toEqual([]);
    expect(failures).toEqual([{ ticker: 'WEN', micCode: 'XNAS', reason: 'simbolo_no_admitido' }]);
  });

  it('el ciclo no persiste nada y deja el motivo visible', async () => {
    await watchSymbol(db, userA, 'WEN', 'USD', {}, { micCode: 'XNAS', exchange: 'NASDAQ', name: "Wendy's" });
    const f = spyFetch({ data: [fila('WEN', 'XETRA', 6.2)] });

    const res = await refreshQuotes(db, new MarketstackProvider('key', f.impl));

    expect(res.updated).toEqual([]);
    expect(res.skipped).toEqual([{ ticker: 'WEN', reason: 'simbolo_no_admitido' }]);
    expect(await getQuoteViews(db)).toEqual([]); // ni un euro guardado como dólar
  });
});

describe('CA-6: eco SIN mercado legible — no comprobar no es comprobar y aceptar', () => {
  it('una fila sin `exchange` y sin sufijo en `symbol` no basta para relajar', async () => {
    const f = spyFetch({ data: [fila('DOCS', undefined, 25.63)] });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes(DOCS_XNYS);

    expect(quotes).toEqual([]);
    expect(failures).toEqual([{ ticker: 'DOCS', micCode: 'XNYS', reason: 'simbolo_no_admitido' }]);
  });
});

describe('CA-7: el emparejado exacto manda; ningún pedido recibe dos precios', () => {
  it('con una fila que casa y otra que no, se queda con la que CASA y recibe UNA sola', async () => {
    const f = spyFetch({ data: [fila('DOCS', 'XNYS', 25.63), fila('DOCS', 'XNAS', 26.0)] });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes(DOCS_XNYS);

    expect(quotes).toHaveLength(1);
    expect(quotes).toEqual([{ ticker: 'DOCS', micCode: 'XNYS', price: '25.63', asOf: AS_OF }]);
    expect(quotes[0].providerMicCode).toBeUndefined(); // no hubo discrepancia que anotar
    expect(failures).toEqual([]);
  });

  it('el orden de las filas da igual: la que casa gana aunque llegue la segunda', async () => {
    const f = spyFetch({ data: [fila('DOCS', 'XNAS', 26.0), fila('DOCS', 'XNYS', 25.63)] });

    const { quotes } = await new MarketstackProvider('key', f.impl).getQuotes(DOCS_XNYS);

    expect(quotes).toEqual([{ ticker: 'DOCS', micCode: 'XNYS', price: '25.63', asOf: AS_OF }]);
  });

  it('dos filas del grupo compitiendo y NINGUNA casa: no se asigna ninguna (fallo seguro)', async () => {
    const f = spyFetch({ data: [fila('DOCS', 'XNAS', 25.63), fila('DOCS', 'XNAS', 26.0)] });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes(DOCS_XNYS);

    expect(quotes).toEqual([]);
    expect(failures).toEqual([{ ticker: 'DOCS', micCode: 'XNYS', reason: 'simbolo_no_admitido' }]);
  });
});

describe('CA-8: constancia observable de la etiqueta discrepante', () => {
  it('`RefreshResult` hace constar ticker, mercado PEDIDO y mercado del ECO', async () => {
    await watchSymbol(db, userA, 'DOCS', 'USD', {}, { micCode: 'XNYS', exchange: 'NYSE', name: 'Doximity' });

    const res = await refreshQuotes(db, new MarketstackProvider('key', spyFetch(ECO_DOCS_XNAS).impl));

    expect(res.mismatched).toEqual([{ ticker: 'DOCS', requestedMicCode: 'XNYS', providerMicCode: 'XNAS' }]);
  });

  it('viaja entero en el cuerpo del cron, y al usuario no se le muestra NADA', async () => {
    await watchSymbol(db, userA, 'DOCS', 'USD', {}, { micCode: 'XNYS', exchange: 'NYSE', name: 'Doximity' });

    const outcome = await runCronCycle({
      authHeader: `Bearer ${SECRET}`,
      secret: SECRET,
      db,
      provider: new MarketstackProvider('key', spyFetch(ECO_DOCS_XNAS).impl),
      sender: new FakeNotificationSender(),
    });

    expect(outcome.status).toBe(200);
    if (outcome.status !== 200) return;
    expect(outcome.body.refresh.mismatched).toEqual([
      { ticker: 'DOCS', requestedMicCode: 'XNYS', providerMicCode: 'XNAS' },
    ]);
    // Para el usuario no ha fallado nada: hay precio y NO hay diagnóstico (SPEC-016).
    expect(outcome.body.refresh.skipped).toEqual([]);
    expect((await getDiagnosticMap(db)).DOCS).toBeUndefined();
  });

  it('cuando el eco casa, la lista queda VACÍA: no se anota ruido', async () => {
    await watchSymbol(db, userA, 'AAPL', 'USD', {}, { micCode: 'XNAS', exchange: 'NASDAQ', name: 'Apple' });

    const res = await refreshQuotes(db, new MarketstackProvider('key', spyFetch({ data: [fila('AAPL', 'XNAS', 308.26)] }).impl));

    expect(res.updated).toEqual(['AAPL']);
    expect(res.mismatched).toEqual([]);
  });
});

describe('CA-9: el grupo equivalente es una tabla acotada, no una heurística', () => {
  it('hoy hay EXACTAMENTE un grupo, `{XNAS, XNYS}` (ampliarlo exige un ADR: ADR-014 pto. 6)', () => {
    expect(EQUIVALENT_MARKET_GROUPS.map((g) => [...g].sort())).toEqual([['XNAS', 'XNYS']]);
  });
});
