import { describe, it, expect, beforeEach } from 'vitest';
import { makeTestDb, type TestDb } from '@/db/test-db';
import { registerUser } from '@/lib/auth/users';
import { watchSymbol } from '@/lib/watchlist/service';
import { MarketstackProvider } from '@/lib/market/marketstack-provider';
import { refreshQuotes, symbolUniverse } from '@/lib/market/refresh';
import { getDiagnosticMap, upsertQuote } from '@/lib/market/quotes';
import { zoneStatusForUser } from '@/lib/watchlist/zone-status';
import { quotes } from '@/db/schema';
import { FAIL_REASON_TEXT, failReasonText } from '@/lib/market/fail-reason-text';
import { runCronCycle } from '@/lib/triggers/cycle';
import { FakeNotificationSender } from '@/lib/notifications/fake-sender';
import {
  EJEMPLOS_PERMITIDOS,
  EJEMPLOS_PROHIBIDOS,
  FORMULAS_PROHIBIDAS_CUOTA,
  MARCAS_DE_PRIMERA_PERSONA,
  formulasProhibidasEn,
} from './spec043-formulas-prohibidas';
import { MOTIVOS_EN_PROSA, MOTIVOS_SIN_PRECIO, SIN_PRECIO_SECCION } from '@/lib/help/content';

/**
 * SPEC-043 · bloque A — **el motivo verdadero**.
 *
 * El 2026-08-19 y el 2026-08-20 el ciclo entero cayó a `proveedor_no_disponible`
 * porque `classifyGlobal` no tenía rama para el **HTTP 429** con
 * `usage_limit_reached`. El motivo por defecto promete *«se reintentará en el próximo
 * ciclo»* y **no era verdad**: la cuota es terminal (ADR-027 pto. 4).
 *
 * ## NINGÚN test llama a la API real
 *
 * La respuesta del proveedor se simula con `fetchImpl`, igual que en SPEC-020. La cuota
 * real está agotada —ese es el incidente— y una llamada de test no la resucita.
 */

const SECRET = 'test-cron-secret';

let db: TestDb;
let userA: string;

beforeEach(async () => {
  ({ db } = await makeTestDb());
  userA = (await registerUser(db, 'a@example.com', 'clave')).id;
});

/** `fetch` inyectado: cuerpo y estado HTTP a voluntad, y cuenta las llamadas. */
function fetchQueResponde(body: unknown, opts: { ok?: boolean; status?: number } = {}) {
  const urls: string[] = [];
  const impl = (async (url: string) => {
    urls.push(String(url));
    return {
      ok: opts.ok ?? true,
      status: opts.status ?? 200,
      json: async () => {
        if (body === undefined) throw new Error('cuerpo ilegible');
        return body;
      },
    };
  }) as unknown as typeof fetch;
  return { impl, llamadas: () => urls.length };
}

/** El 429 tal y como lo devolvió Marketstack el 2026-08-19 (leído de producción). */
const CUERPO_429_CUOTA = {
  error: { code: 'usage_limit_reached', message: 'Your monthly usage limit has been reached.' },
};

const PEDIDOS = [
  { ticker: 'ITX', micCode: 'BMEX' },
  { ticker: 'AAPL', micCode: 'XNAS' },
  { ticker: 'SAN', micCode: 'BMEX' },
];

const motivos = (f: { reason: string }[]) => [...new Set(f.map((x) => x.reason))];

describe('SPEC-043 CA-1: la cuota agotada tiene nombre propio', () => {
  it('429 con usage_limit_reached → TODOS los símbolos quedan con `cuota_agotada`', async () => {
    const f = fetchQueResponde(CUERPO_429_CUOTA, { ok: false, status: 429 });

    const { quotes, failures } = await new MarketstackProvider('key', f.impl).getQuotes(PEDIDOS);

    expect(quotes).toEqual([]);
    expect(failures).toHaveLength(PEDIDOS.length); // ninguno desaparece (SPEC-016)
    expect(motivos(failures)).toEqual(['cuota_agotada']);
  });

  it('y ese motivo es el que se PERSISTE por símbolo y el que llega a la UI', async () => {
    // El mecanismo de propagación y persistencia es el de SPEC-016 CA-1/CA-2 y no se
    // re-especifica: lo que se comprueba aquí es que el motivo NUEVO lo recorre entero.
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, { micCode: 'BMEX', exchange: 'BME' });
    await watchSymbol(db, userA, 'AAPL', 'USD', {}, { micCode: 'XNAS', exchange: 'NASDAQ' });
    const f = fetchQueResponde(CUERPO_429_CUOTA, { ok: false, status: 429 });

    const res = await refreshQuotes(db, new MarketstackProvider('key', f.impl));

    expect(res.updated).toEqual([]);
    expect(motivos(res.skipped)).toEqual(['cuota_agotada']);

    const diag = await getDiagnosticMap(db);
    const guardados = Object.values(diag).map((d) => d.reason);
    expect(guardados).toHaveLength(2);
    expect([...new Set(guardados)]).toEqual(['cuota_agotada']);

    // Lo que ve el usuario: la categoría del dominio, nunca el crudo del proveedor.
    const texto = failReasonText('cuota_agotada');
    expect(texto).not.toMatch(/usage_limit_reached|429|monthly usage/i);
    expect(texto.length).toBeGreaterThan(20);
  });
});

describe('SPEC-043 CA-2: el tope POR SEGUNDO sigue siendo transitorio', () => {
  it.each(['rate_limit_reached', 'too_many_requests'])(
    '429 con %s → `proveedor_no_disponible`, que ahí sí es la verdad',
    async (code) => {
      const f = fetchQueResponde({ error: { code, message: 'Too many requests' } }, { ok: false, status: 429 });

      const { failures } = await new MarketstackProvider('key', f.impl).getQuotes(PEDIDOS);

      expect(motivos(failures)).toEqual(['proveedor_no_disponible']);
    },
  );

  it('los dos 429 NO se confunden: mismo estado, motivos distintos', async () => {
    const cuota = fetchQueResponde(CUERPO_429_CUOTA, { ok: false, status: 429 });
    const tope = fetchQueResponde(
      { error: { code: 'rate_limit_reached', message: 'Too many requests' } },
      { ok: false, status: 429 },
    );

    const a = await new MarketstackProvider('key', cuota.impl).getQuotes(PEDIDOS);
    const b = await new MarketstackProvider('key', tope.impl).getQuotes(PEDIDOS);

    expect(motivos(a.failures)).not.toEqual(motivos(b.failures));
  });
});

describe('SPEC-043 CA-3: ante un 429 mudo se presume cuota', () => {
  it('429 con cuerpo ILEGIBLE → `cuota_agotada`', async () => {
    const f = fetchQueResponde(undefined, { ok: false, status: 429 });

    const { failures } = await new MarketstackProvider('key', f.impl).getQuotes(PEDIDOS);

    expect(motivos(failures)).toEqual(['cuota_agotada']);
  });

  it('429 con un código NO reconocido → `cuota_agotada`', async () => {
    const f = fetchQueResponde({ error: { code: 'algo_que_no_conocemos' } }, { ok: false, status: 429 });

    const { failures } = await new MarketstackProvider('key', f.impl).getQuotes(PEDIDOS);

    expect(motivos(failures)).toEqual(['cuota_agotada']);
  });

  it('la presunción NO se derrama a otros estados: un 503 mudo sigue siendo caída', async () => {
    // Un 5xx SÍ es una caída del proveedor y sigue siendo transitorio (SPEC-020 CA-8).
    const f = fetchQueResponde(undefined, { ok: false, status: 503 });

    const { failures } = await new MarketstackProvider('key', f.impl).getQuotes(PEDIDOS);

    expect(motivos(failures)).toEqual(['proveedor_no_disponible']);
  });

  it('la presunción queda ESCRITA junto al código, no implícita', async () => {
    const { readFileSync } = await import('node:fs');
    const fuente = readFileSync('src/lib/market/marketstack-provider.ts', 'utf8');
    // El comentario que precede al clasificador MÁS su cuerpo: «junto al código» es
    // literal, no vale que la razón viva en el ADR y aquí no se sepa que existe.
    const decl = fuente.indexOf('function classifyGlobal');
    const bloque = fuente.slice(fuente.lastIndexOf('/**', decl), decl + 1200);

    // No es decoración: CA-3 pide que el porqué de presumir cuota se lea al lado.
    expect(bloque).toMatch(/ADR-027/);
    expect(bloque).toMatch(/una\s+llamada\s+por\s+ciclo|una\s+sola\s+llamada/i);
  });
});

describe('SPEC-043 CA-4: el texto de usuario no promete lo que no puede cumplir', () => {
  it('la guardia se prueba a sí misma: caza lo que tiene que cazar', () => {
    expect(FORMULAS_PROHIBIDAS_CUOTA.length).toBeGreaterThan(4);
    for (const { patron, motivo } of FORMULAS_PROHIBIDAS_CUOTA) {
      expect(motivo.length, `${patron} sin motivo escrito`).toBeGreaterThan(40);
    }
    for (const frase of EJEMPLOS_PROHIBIDOS) {
      expect(formulasProhibidasEn(frase), `la guardia deja pasar «${frase}»`).not.toEqual([]);
    }
  });

  it('y no caza lo que la spec pide escribir', () => {
    for (const frase of EJEMPLOS_PERMITIDOS) {
      expect(
        formulasProhibidasEn(frase).map((v) => `${v.patron} → ${v.fragmento}`),
        `la guardia prohíbe una frase legítima: el patrón está mal, no la frase («${frase}»)`,
      ).toEqual([]);
    }
  });

  it('`cuota_agotada` tiene entrada PROPIA y distinta de `proveedor_no_disponible`', () => {
    expect(FAIL_REASON_TEXT.cuota_agotada).toBeTruthy();
    expect(FAIL_REASON_TEXT.cuota_agotada).not.toBe(FAIL_REASON_TEXT.proveedor_no_disponible);
  });

  it('ni una sola fórmula prohibida en los DOS textos del motivo (fila y ayuda)', () => {
    const enLaAyuda = MOTIVOS_SIN_PRECIO.find((m) => m.id === 'cuota_agotada');
    expect(enLaAyuda, 'la ayuda no explica `cuota_agotada`').toBeTruthy();

    const textos = [FAIL_REASON_TEXT.cuota_agotada, enLaAyuda!.titulo, enLaAyuda!.texto];
    for (const texto of textos) {
      expect(
        formulasProhibidasEn(texto).map((v) => `${v.fragmento}\n   → ${v.motivo}`),
        'el motivo nuevo promete lo que ADR-027 dice que no puede cumplir',
      ).toEqual([]);
    }
  });

  it('atribuye la causa y la acción a NOSOTROS, no al valor ni al mercado', () => {
    const enLaAyuda = MOTIVOS_SIN_PRECIO.find((m) => m.id === 'cuota_agotada')!;
    expect(FAIL_REASON_TEXT.cuota_agotada).toMatch(MARCAS_DE_PRIMERA_PERSONA);
    expect(enLaAyuda.texto).toMatch(MARCAS_DE_PRIMERA_PERSONA);
  });

  it('`proveedor_no_disponible` CONSERVA su contrato: sigue prometiendo el ciclo', () => {
    // ADR-027 pto. 4: no se hace vago el motivo verdadero para acomodar al impostor.
    // Lo que cambia es que deja de ser el cajón donde caía la cuota.
    expect(FAIL_REASON_TEXT.proveedor_no_disponible).toMatch(/pr[óo]ximo ciclo|reintent/i);
  });
});

describe('SPEC-043 CA-16: el incidente real, reproducido (CE-F1)', () => {
  /** Los trece del universo del 2026-08-19, con su mercado y su dialecto real. */
  const TRECE: [string, string, string][] = [
    ['ITX', 'BMEX', 'EUR'],
    ['SAN', 'BMEX', 'EUR'],
    ['TEF', 'BMEX', 'EUR'],
    ['PHM', 'BMEX', 'EUR'],
    ['SAP', 'XETR', 'EUR'],
    ['MC', 'XPAR', 'EUR'],
    ['ASML', 'XAMS', 'EUR'],
    ['AAPL', 'XNAS', 'USD'],
    ['WEN', 'XNAS', 'USD'],
    ['DOCS', 'XNAS', 'USD'],
    ['TTD', 'XNAS', 'USD'],
    ['APP', 'XNAS', 'USD'],
    ['KO', 'XNYS', 'USD'],
  ];

  it('trece símbolos, UN 429 `usage_limit_reached`: trece motivos `cuota_agotada`', async () => {
    for (const [ticker, mic, divisa] of TRECE) {
      await watchSymbol(db, userA, ticker, divisa, {}, { micCode: mic, exchange: mic });
    }
    // Última ingesta buena: 2026-08-18T23:43Z, leída de producción. El `updated_at` se
    // pone RELATIVO —el mismo hueco de tres días— para que el test no dependa del reloj
    // de quien lo ejecute; es el hueco lo que importa, no la fecha del calendario.
    const universo = await symbolUniverse(db);
    expect(universo).toHaveLength(13);
    for (const u of universo) {
      await upsertQuote(db, u.symbolId, { price: '10', currency: u.currency, asOf: '2026-08-18T23:43:00.000Z' });
    }
    await db.update(quotes).set({ updatedAt: new Date(Date.now() - 60 * 3_600_000) });

    const f = fetchQueResponde(CUERPO_429_CUOTA, { ok: false, status: 429 });
    const res = await refreshQuotes(db, new MarketstackProvider('key', f.impl));

    // Firma del incidente: requested=13, updated=0, skipped=13… pero ya no mintiendo.
    expect(f.llamadas(), 'una sola llamada por ciclo (ADR-002)').toBe(1);
    expect(res.requested).toHaveLength(13);
    expect(res.updated).toHaveLength(0);
    expect(res.skipped).toHaveLength(13);
    expect(motivos(res.skipped)).toEqual(['cuota_agotada']);

    const diag = await getDiagnosticMap(db);
    expect(Object.keys(diag)).toHaveLength(13);
    expect([...new Set(Object.values(diag).map((d) => d.reason))]).toEqual(['cuota_agotada']);
  });

  it('y las dos pantallas lo dicen: trece filas sin refrescar, con su porqué', async () => {
    for (const [ticker, mic, divisa] of TRECE) {
      await watchSymbol(db, userA, ticker, divisa, {}, { micCode: mic, exchange: mic });
    }
    const universo = await symbolUniverse(db);
    for (const u of universo) {
      await upsertQuote(db, u.symbolId, { price: '10', currency: u.currency, asOf: '2026-08-18T23:43:00.000Z' });
    }
    await db.update(quotes).set({ updatedAt: new Date(Date.now() - 60 * 3_600_000) });
    await refreshQuotes(db, new MarketstackProvider('key', fetchQueResponde(CUERPO_429_CUOTA, { ok: false, status: 429 }).impl));

    const filas = await zoneStatusForUser(db, userA);

    expect(filas).toHaveLength(13);
    for (const fila of filas) {
      // Lo que el usuario veía: un precio, un estado de zona, y ni una palabra sobre que
      // llevaba tres días congelado. Ahora las dos cosas conviven.
      expect(fila.price).toBe('10');
      expect(fila.state, `${fila.ticker} perdió su estado de zona`).not.toBe('none');
      expect(fila.sinRefrescar, `${fila.ticker} no dice que dejó de actualizarse`).toBe(true);
      expect(fila.failReason).toBe('cuota_agotada');
    }
    // Y el motivo que llega a la pantalla ya no manda a esperar, sino a reponer.
    expect(failReasonText('cuota_agotada')).not.toMatch(/pr[óo]ximo ciclo|reintent/i);
  });
});

describe('SPEC-043 CA-6: la ayuda explica el motivo nuevo y su cuenta deja de mentir', () => {
  it('el motivo nuevo tiene su explicación, y no es la etiqueta corta repetida', () => {
    const entrada = MOTIVOS_SIN_PRECIO.find((m) => m.id === 'cuota_agotada');
    expect(entrada, 'sin esta entrada el proyecto NO COMPILA: el mapa es total').toBeTruthy();
    expect(entrada!.titulo.length).toBeGreaterThan(10);
    expect(entrada!.texto.length).toBeGreaterThan(80);
    expect(entrada!.texto).not.toBe(FAIL_REASON_TEXT.cuota_agotada);
  });

  it('la CIFRA que la prosa escribe a mano está atada al recuento REAL de motivos', () => {
    // F-SPEC-039-3: el literal «es uno de estos seis» era un número suelto que nadie ata,
    // y esta spec es exactamente el día que lo habría dejado obsoleto en silencio. Ahora
    // se pone rojo, igual que `MERCADOS_EN_PROSA` está atada a `OPERATING_MICS.length`.
    expect(
      MOTIVOS_EN_PROSA.cifra,
      'la ayuda dice cuántos motivos hay con una palabra escrita a mano: actualízala en ' +
        'src/lib/help/content.ts',
    ).toBe(MOTIVOS_SIN_PRECIO.length);
    expect(SIN_PRECIO_SECCION.intro).toContain(MOTIVOS_EN_PROSA.palabra);
  });

  it('y el número viejo ya no anda suelto por la sección', () => {
    expect(SIN_PRECIO_SECCION.intro).not.toMatch(/\bseis\b/);
  });
});

describe('SPEC-043 CA-5: la resiliencia y el contrato del ciclo no cambian', () => {
  it('degrada a fallo POR SÍMBOLO sin abortar, y el endpoint sigue devolviendo 200', async () => {
    await watchSymbol(db, userA, 'ITX', 'EUR', { buyMin: 50, buyMax: 60 }, { micCode: 'BMEX', exchange: 'BME' });
    const [u] = await symbolUniverse(db);
    await upsertQuote(db, u.symbolId, { price: '55', currency: 'EUR', asOf: '2026-08-18T23:43:00.000Z' });

    const f = fetchQueResponde(CUERPO_429_CUOTA, { ok: false, status: 429 });
    const outcome = await runCronCycle({
      authHeader: `Bearer ${SECRET}`,
      secret: SECRET,
      db,
      provider: new MarketstackProvider('key', f.impl),
      sender: new FakeNotificationSender(),
    });

    expect(outcome.status).toBe(200);
    expect(outcome.body).toHaveProperty('refresh');
    expect(outcome.body).toHaveProperty('triggers');
    expect(outcome.body).toHaveProperty('notifications');
  });

  it('los símbolos que SÍ obtienen precio se actualizan igual (una cosa no tapa la otra)', async () => {
    // La rama nueva vive en el fallo GLOBAL; el camino feliz no la toca. Se comprueba
    // que sigue intacto porque el criterio es de SPEC-016 CA-7 / SPEC-020 CA-9.
    await watchSymbol(db, userA, 'ITX', 'EUR', {}, { micCode: 'BMEX', exchange: 'BME' });
    const f = fetchQueResponde({
      data: [{ symbol: 'ITX.BMEX', exchange: 'BMEX', date: '2026-08-20T00:00:00+0000', close: 59.1 }],
    });

    const res = await refreshQuotes(db, new MarketstackProvider('key', f.impl));

    expect(res.updated).toEqual(['ITX']);
    expect(res.skipped).toEqual([]);
  });
});
