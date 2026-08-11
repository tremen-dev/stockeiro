import type {
  MarketDataProvider,
  ProviderFailure,
  ProviderQuote,
  QuoteFailureReason,
  QuoteRequest,
  QuotesResult,
} from './provider';
import { isOperatingMic } from './mic';

/**
 * Adaptador REAL de Marketstack (ADR-012), proveedor de COTIZACIONES. Sustituye a
 * `TwelveDataProvider`, cuyo free tier NO cubre BME/M.CONTINUO — el mercado principal
 * del usuario (EPIC-FIX). Verificado contra la API real (2026-07-15, free tier):
 *
 *   GET /v1/eod/latest?symbols=ITX.BMEX,SAN.BMEX → 200
 *   { data: [{ symbol:"ITX.BMEX", exchange:"BMEX", date:"2026-07-14T00:00:00+0000",
 *              close:53.72, adj_close:53.72, split_factor:1, dividend:0 }] }
 *
 * - El símbolo se construye SEGÚN EL MERCADO (`PROVIDER_SUFFIX`, SPEC-020): unos llevan
 *   sufijo y otros van pelados. **Batch en UNA llamada** (ADR-002: 1 símbolo = 1
 *   llamada/ciclo), con la cadena enviada deduplicada.
 * - Se toma `close` = último cierre **NO ajustado** (RN-12); `adj_close` se IGNORA a
 *   propósito: mezclarlos falsearía disparos y P/L.
 * - `date` → `asOf` (D-2). El mercado del precio se toma del campo `exchange` del eco y
 *   debe **confirmar** el mercado pedido antes de asignarlo (RN-09): un precio en el
 *   mercado equivocado falsea el P/L y es peor que no tener precio.
 * - Resiliencia por símbolo (CA-8/CA-6 de SPEC-004): ni una fila con `status:"error"` ni
 *   un fallo GLOBAL abortan el ciclo — **este adaptador nunca lanza por el proveedor**
 *   (SPEC-020 CA-7); degrada a fallo por símbolo con su motivo.
 *
 * NO se ejerce contra la API real en tests (se usa `fetch` inyectado y fakes); requiere
 * `MARKETSTACK_API_KEY` real, cuya ausencia SÍ lanza a propósito: es un fallo de
 * configuración, no del proveedor, y `refreshQuotes` lo degrada (SPEC-020 CA-9).
 */
const BASE_URL = 'https://api.marketstack.com/v1/eod/latest';

/**
 * DIALECTO DE MARKETSTACK, **POR MERCADO** (SPEC-020, ADR-012 pto. 4). No es una
 * traducción de código de mercado: es conocimiento de proveedor sobre CADA mercado, y
 * hay mercados **con** sufijo y mercados que solo se aceptan **pelados**.
 *
 * ┌───────────────┬──────────────────────┬──────────────────────────────────────────┐
 * │ operating MIC │ forma que ACEPTA     │ verificado con                           │
 * ├───────────────┼──────────────────────┼──────────────────────────────────────────┤
 * │ BMEX          │ TICKER.BMEX          │ ITX 59,10 · SAN 12,852 · TEF 3,636 · PHM │
 * │ XETR          │ TICKER.XETRA         │ SAP.XETRA 179,3                          │
 * │ XPAR          │ TICKER.XPAR          │ MC.XPAR 482,45                           │
 * │ XAMS          │ TICKER.XAMS          │ ASML.XAMS 1513,8                         │
 * │ XNAS          │ TICKER  (pelado)     │ AAPL 308,26 · WEN 7,30 · DOCS · TTD      │
 * │ XNYS          │ TICKER  (pelado)     │ KO 86,87                                 │
 * └───────────────┴──────────────────────┴──────────────────────────────────────────┘
 *
 * **PROCEDENCIA DEL DATO: llamadas REALES a la API el 2026-08-11** (SPEC-020, tabla del
 * Problema). NO se cambia ni se "completa por simetría" a ojo: el free tier son ~100
 * peticiones/mes, y un formato inventado gasta cuota y le devuelve al usuario un motivo
 * falso ("puede estar deslistado") sobre un valor que cotiza perfectamente.
 *
 * `XSTO` **no tiene entrada A PROPÓSITO** (F-SPEC-020-1): fallaron `ERIC.XSTO`,
 * `ERIC_B.XSTO` y `VOLV_B.XSTO`, y el cuarto formato no se inventa. Sin entrada aquí, el
 * símbolo **no se pide** y sale con `mercado_no_cubierto` (SPEC-020 CA-6), que es cierto
 * para nosotros hoy. Sigue siendo un operating MIC válido del dominio: `market/mic.ts`
 * es conocimiento de MERCADO (ISO 10383) y no se toca por esto.
 *
 * `null` = el proveedor lo quiere **pelado**. Ausente = no sabemos pedirlo.
 */
const PROVIDER_SUFFIX: Record<string, string | null> = {
  BMEX: 'BMEX',
  XETR: 'XETRA', // su dialecto: `XETRA` no es un MIC ISO válido, pero es lo que ellos usan
  XPAR: 'XPAR',
  XAMS: 'XAMS',
  XNAS: null, // pelado: `.XNAS` es INVÁLIDO para Marketstack (verificado)
  XNYS: null, // pelado: `.XNYS` es INVÁLIDO para Marketstack (verificado)
};

/** Dialecto → operating MIC canónico, para devolver el eco en el vocabulario del dominio. */
const FROM_PROVIDER: Record<string, string> = { XETRA: 'XETR' };

const fromProviderMic = (mic: string): string => FROM_PROVIDER[mic.toUpperCase()] ?? mic.toUpperCase();

/**
 * Cadena EXACTA que hay que enviarle al proveedor para ese (ticker, operating MIC), o
 * `null` si su mercado no tiene dialecto verificado — en cuyo caso **no se pide**.
 */
function providerSymbol(ticker: string, mic: string): string | null {
  if (!(mic in PROVIDER_SUFFIX)) return null;
  const sufijo = PROVIDER_SUFFIX[mic];
  return sufijo ? `${ticker}.${sufijo}` : ticker;
}

interface MarketstackRow {
  symbol?: string;
  exchange?: string;
  date?: string;
  close?: number | string;
  status?: string; // 'error' en fallos por símbolo
  code?: number;
  message?: string;
}

interface MarketstackBody {
  data?: MarketstackRow[];
  error?: { code?: string; message?: string };
}

/** Un pedido que SÍ se va a preguntar, con la cadena exacta que viaja. */
interface Askable {
  req: QuoteRequest;
  mic: string;
  /** Cadena enviada al proveedor (`ITX.BMEX`, `AAPL`). Puede repetirse entre mercados. */
  sent: string;
}

/**
 * Traduce el fallo del proveedor a vocabulario del DOMINIO (SPEC-016). El texto crudo
 * NO sale de aquí: la UI muestra la categoría, nunca "upgrade your plan".
 * Verificado 2026-07-15: el free tier responde `{code:403, message:"**symbol** ITX is not
 * available with your plan..."}` para los mercados que no cubre.
 */
function classify(row: MarketstackRow): QuoteFailureReason {
  const msg = (row.message ?? '').toLowerCase();
  if (row.code === 403 || /not available with your plan|upgrade/.test(msg)) return 'mercado_no_cubierto';
  if (row.code === 404 || /not found|invalid symbol|no data/.test(msg)) return 'simbolo_desconocido';
  return 'proveedor_no_disponible';
}

/**
 * Motivo de un fallo GLOBAL (SPEC-020 CA-8). Son dos cosas distintas y el usuario merece
 * saber cuál:
 *  - el proveedor respondió y **rechazó nuestra petición** (`no_valid_symbols_provided`):
 *    reintentar no lo arregla → `simbolo_no_admitido`;
 *  - el proveedor **se cayó** (HTTP 5xx, red, timeout): es transitorio y el próximo ciclo
 *    puede ir bien → `proveedor_no_disponible`.
 * Ninguno de los dos es `simbolo_desconocido`: acusar al valor de estar deslistado sería
 * mentira, y esa mentira es justo el defecto que EPIC-FIX vino a matar (CE-F2).
 */
function classifyGlobal(body: MarketstackBody | null): QuoteFailureReason {
  const code = (body?.error?.code ?? '').toLowerCase();
  const msg = (body?.error?.message ?? '').toLowerCase();
  if (/no_valid_symbols|invalid_symbol/.test(code) || /no valid symbols|invalid symbol/.test(msg)) {
    return 'simbolo_no_admitido';
  }
  return 'proveedor_no_disponible';
}

export class MarketstackProvider implements MarketDataProvider {
  constructor(
    private readonly apiKey: string | undefined = process.env.MARKETSTACK_API_KEY,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {}

  async getQuotes(requests: QuoteRequest[]): Promise<QuotesResult> {
    if (requests.length === 0) return { quotes: [], failures: [] };
    // Fallo de CONFIGURACIÓN, no del proveedor: se lanza a propósito y `refreshQuotes` lo
    // degrada a fallo por símbolo sin matar el ciclo (SPEC-020 CA-9).
    if (!this.apiKey) throw new Error('MARKETSTACK_API_KEY no definida (ver .env.example).');

    const askable: Askable[] = [];
    const failures: ProviderFailure[] = [];
    for (const req of requests) {
      // Sin operating MIC no se puede cotizar el mercado correcto y NO se adivina
      // (RN-09). No desaparece: sale con su motivo (SPEC-016).
      if (!isOperatingMic(req.micCode)) {
        failures.push({ ticker: req.ticker, micCode: req.micCode ?? null, reason: 'sin_identidad_de_mercado' });
        continue;
      }
      const mic = req.micCode as string;
      const sent = providerSymbol(req.ticker, mic);
      // Mercado sin dialecto verificado (hoy XSTO): no se gasta una llamada en adivinar
      // su formato y se dice la verdad — no lo cubrimos (CA-6).
      if (!sent) {
        failures.push({ ticker: req.ticker, micCode: mic, reason: 'mercado_no_cubierto' });
        continue;
      }
      askable.push({ req, mic, sent });
    }
    if (askable.length === 0) return { quotes: [], failures };

    const url = new URL(BASE_URL);
    // Dedupe de la CADENA enviada (ADR-002): con XNAS y XNYS pelados, el mismo ticker en
    // los dos mercados produce la misma cadena y no se pide dos veces (CA-5).
    url.searchParams.set('symbols', [...new Set(askable.map((a) => a.sent))].join(','));
    url.searchParams.set('access_key', this.apiKey);

    const body = await this.fetchBody(url.toString());
    if (!body.ok) {
      // Fallo GLOBAL (HTTP no-OK, red caída o HTTP 200 con {error:{...}}): NO se lanza.
      // Degrada a fallo por símbolo para todos los pedidos, y el ciclo sigue (CA-7).
      for (const a of askable) failures.push({ ticker: a.req.ticker, micCode: a.mic, reason: body.reason });
      return { quotes: [], failures };
    }

    const out: ProviderQuote[] = [];
    // Lo pedido y aún sin respuesta: al final, lo que quede es un símbolo que el
    // proveedor sencillamente no devolvió → tampoco desaparece en silencio (SPEC-016).
    const pedidos = new Map(askable.map((a) => [`${a.req.ticker}:${a.mic}`, a]));
    // Cadenas enviadas para las que SÍ llegó un precio (aunque fuera de otro mercado):
    // distingue "el proveedor no lo conoce" de "lo devolvió, pero no para este mercado".
    const conPrecio = new Set<string>();

    for (const row of body.data) {
      if (!row) continue;
      const eco = String(row.symbol ?? '').trim();
      const [ticker, sufijoEco] = eco.split('.');
      // El mercado del precio sale del campo `exchange` (que sigue viniendo aunque se
      // pida pelado); el sufijo del eco es solo respaldo. Se devuelve en canónico ISO.
      const micEco = row.exchange ? fromProviderMic(row.exchange) : sufijoEco ? fromProviderMic(sufijoEco) : null;

      // Fallo POR SÍMBOLO: no aborta a los demás (CA-8 de SPEC-004) pero su motivo se
      // propaga clasificado (SPEC-016) — antes se descartaba, de ahí el fallo silencioso.
      if (row.status === 'error' || !ticker || row.close == null || !row.date) {
        const a = matchRow(ticker, micEco, askable);
        if (a) {
          pedidos.delete(`${a.req.ticker}:${a.mic}`);
          failures.push({ ticker: a.req.ticker, micCode: a.mic, reason: classify(row) });
        }
        // Fila que no se puede atribuir a nadie: no se le cuelga a un pedido al azar. Lo
        // que quede sin respuesta cae al barrido final de `pedidos`.
        continue;
      }

      if (eco) conPrecio.add(eco.toUpperCase());
      // Sin mercado confirmado NO se asigna el precio: es preferible no tener precio a
      // tenerlo del mercado equivocado, que falsearía el P/L (RN-09/RN-06).
      if (!micEco) continue;
      const a = askable.find((x) => x.req.ticker === ticker && x.mic === micEco);
      if (!a) continue; // eco de OTRO mercado (o de nada pedido): no se asigna (CA-4)
      pedidos.delete(`${a.req.ticker}:${a.mic}`);
      out.push({
        ticker: a.req.ticker,
        micCode: a.mic,
        price: String(row.close), // último cierre NO ajustado (RN-12); adj_close se ignora
        // Sin `currency`: Marketstack no la devuelve (verificado). La divisa es la del
        // símbolo (RN-09) y la pone el refresco.
        asOf: new Date(row.date).toISOString(), // D-2
      });
    }

    for (const a of pedidos.values()) {
      // Si su cadena SÍ trajo precio, el proveedor respondió — pero para otro mercado:
      // no está deslistado, es que no nos lo sirve así (CA-4/CA-5). Si no trajo nada,
      // entonces sí: el proveedor no conoce el símbolo.
      const reason: QuoteFailureReason = conPrecio.has(a.sent.toUpperCase())
        ? 'simbolo_no_admitido'
        : 'simbolo_desconocido';
      failures.push({ ticker: a.req.ticker, micCode: a.mic, reason });
    }
    return { quotes: out, failures };
  }

  /**
   * Trae el cuerpo de la respuesta sin lanzar NUNCA por el proveedor (CA-7): red caída,
   * HTTP no-OK o `{error:{...}}` con HTTP 200 se devuelven como motivo clasificado.
   */
  private async fetchBody(
    url: string,
  ): Promise<{ ok: true; data: MarketstackRow[] } | { ok: false; reason: QuoteFailureReason }> {
    let res: Response;
    try {
      res = await this.fetchImpl(url);
    } catch {
      // Red caída / timeout: transitorio, el próximo ciclo puede ir bien (CA-8).
      return { ok: false, reason: 'proveedor_no_disponible' };
    }
    let body: MarketstackBody | null = null;
    try {
      body = (await res.json()) as MarketstackBody;
    } catch {
      body = null; // cuerpo ilegible: se clasifica por el estado HTTP
    }
    if (!res.ok) return { ok: false, reason: classifyGlobal(body) };
    if (body?.error) return { ok: false, reason: classifyGlobal(body) };
    return { ok: true, data: body?.data ?? [] };
  }
}

/**
 * Empareja una fila con el pedido al que pertenece, por identidad COMPLETA — ticker **y**
 * operating MIC (ADR-007), tomando el mercado del campo `exchange` del eco.
 *
 * Emparejar solo por ticker le cuelga el fallo al mercado equivocado cuando el mismo
 * ticker está en dos mercados (SAN en Madrid y SAN en NY, el ejemplo de ADR-012): el que
 * cotiza bien saldría también como fallido, y el que falla heredaría un motivo que no es
 * el suyo (F-SPEC-016-3).
 *
 * Si la fila no trae mercado parseable, solo se empareja cuando NO hay ambigüedad (un
 * único pedido con ese ticker). Con dos mercados **no se adivina** (ADR-012): es
 * preferible que caiga al barrido final de `pedidos` —donde igualmente se reporta, sin
 * inventar el motivo— a colgárselo al mercado que no es.
 */
function matchRow(ticker: string | undefined, mic: string | null, askable: Askable[]): Askable | undefined {
  if (!ticker) return undefined;
  if (!mic) {
    const candidatos = askable.filter((a) => a.req.ticker === ticker);
    return candidatos.length === 1 ? candidatos[0] : undefined;
  }
  return askable.find((a) => a.req.ticker === ticker && a.mic === mic);
}
