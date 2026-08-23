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
 *   mercado equivocado falsea el P/L y es peor que no tener precio. **Única excepción**
 *   (SPEC-021/ADR-014): dentro de un grupo de mercados equivalentes y con la cadena
 *   inambigua — ver `EQUIVALENT_MARKET_GROUPS` y el paso 2 de la atribución.
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
 * Problema). NO se cambia ni se "completa por simetría" a ojo: un formato inventado
 * gasta cuota y le devuelve al usuario un motivo falso ("puede estar deslistado") sobre
 * un valor que cotiza perfectamente.
 *
 * (El plan es **Basic, 10.000 unidades/mes** desde el 2026-08-23, ADR-032; antes eran
 * las 100 del free tier. La holgura es hoy ~25×, pero **no relaja esta regla**: la
 * cuota nunca fue la mitad importante del argumento — el motivo falso sí. Y recuerda
 * que se factura por **símbolo**, no por llamada: ADR-027 pto. 1.)
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

/**
 * GRUPOS DE MERCADOS EQUIVALENTES **PARA ESTE PROVEEDOR** (SPEC-021, **ADR-014**). Un
 * grupo es un conjunto de operating MIC entre los que un eco discrepante **no** es una
 * anomalía sino una diferencia de criterio entre proveedores: el buscador sitúa `DOCS`
 * (Doximity) en **NYSE** —y es lo cierto— mientras Marketstack etiqueta su fila con
 * `XNAS`. Sin esta tabla, el usuario se queda sin un precio que existe, es de su empresa
 * y está en su divisa (síntoma real observado en producción el 2026-08-11).
 *
 * **Para entrar en un grupo hay que cumplir las TRES condiciones a la vez** (ADR-014 pto.
 * 1); son el argumento de seguridad, no una descripción:
 *   (a) **Cadena indistinguible**: el proveedor los pide **pelados**, así que la cadena
 *       enviada NO nombra el mercado y no puede desambiguarlos. Con sufijo (`MC.XPAR`) ya
 *       le hemos dicho el mercado: ahí un eco discrepante es una **anomalía**.
 *   (b) **Divisa homogénea**: protege **RN-09**. El refresco pone la divisa **del
 *       símbolo** y el proveedor no manda ninguna; un eco de otra divisa (p. ej. `XETRA`,
 *       EUR) guardaría euros etiquetados como dólares.
 *   (c) **Espacio de nombres de tickers compartido y ÚNICO**: la misma cadena no puede ser
 *       dos empresas distintas dentro del grupo.
 *
 * **PROCEDENCIA DEL DATO**: (a) está **verificado contra la API real** (SPEC-020, tabla de
 * `PROVIDER_SUFFIX`): `XNAS` y `XNYS` son los **únicos** mercados que Marketstack acepta
 * pelados. (b) y (c) son **conocimiento general de mercado, NO verificado por nosotros
 * contra una fuente** — se declaran como asunción revisable en **F-SPEC-021-1**.
 *
 * **AMPLIAR ESTA TABLA NO ES LIBRE** (ADR-014 pto. 6): cada miembro nuevo obliga a rehacer
 * (a)(b)(c) con evidencia, y eso es un **ADR**, no un `push`. Un grupo **NUNCA** puede
 * mezclar divisas: si (c) fuera falsa para algún ticker, el usuario recibiría el precio de
 * otra empresa **sin motivo visible**, que es peor que el fallo que esto viene a arreglar.
 */
export const EQUIVALENT_MARKET_GROUPS: readonly (readonly string[])[] = [
  ['XNAS', 'XNYS'], // USD · tickers únicos entre Nasdaq y NYSE · ambos se piden pelados
];

/** ¿Están los dos mercados en el MISMO grupo equivalente? (`false` si alguno no está.) */
function sameEquivalentGroup(a: string, b: string): boolean {
  return EQUIVALENT_MARKET_GROUPS.some((g) => g.includes(a) && g.includes(b));
}

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
 * Motivo de un fallo GLOBAL (SPEC-020 CA-8, **SPEC-043 CA-1/CA-2/CA-3**). Son cosas
 * distintas y el usuario merece saber cuál:
 *  - el proveedor respondió y **rechazó nuestra petición** (`no_valid_symbols_provided`):
 *    reintentar no lo arregla → `simbolo_no_admitido`;
 *  - el proveedor nos dice que **hemos consumido nuestro presupuesto**
 *    (`usage_limit_reached`) → `cuota_agotada`;
 *  - el proveedor **se cayó** (HTTP 5xx, red, timeout) o nos frena por pedirle demasiado
 *    seguido: es transitorio y el próximo ciclo puede ir bien → `proveedor_no_disponible`.
 * Ninguno es `simbolo_desconocido`: acusar al valor de estar deslistado sería mentira, y
 * esa mentira es justo el defecto que EPIC-FIX vino a matar (CE-F2).
 *
 * ## El estado HTTP entra aquí porque es información necesaria
 *
 * Hasta SPEC-043 esta función solo veía el CUERPO, y por eso el **429** del 2026-08-19
 * —`{"code":"usage_limit_reached"}`— cayó al motivo por defecto y le dijo al operador
 * *«se reintentará en el próximo ciclo»* durante dos ciclos que fallaron igual. El
 * estado no puede seguir descartándose.
 *
 * ## La taxonomía del 429, que NO es un solo caso (ADR-027 pto. 5)
 *
 * Marketstack usa el mismo estado para dos cosas y solo una es transitoria:
 *  - `usage_limit_reached` → presupuesto **mensual** agotado → `cuota_agotada`;
 *  - `rate_limit_reached` / `too_many_requests` → tope de **5 peticiones por segundo**,
 *    que sí es pasajero → `proveedor_no_disponible`.
 *
 * ## Y la presunción, escrita aquí para que se lea al lado (CA-3)
 *
 * **Un 429 con cuerpo ilegible o con un código que no reconocemos se presume cuota.**
 * El motivo: esta app hace **una llamada por ciclo** (dedupe de ADR-002), así que **no
 * puede** alcanzar un tope de cinco peticiones por segundo — el 429 que nos llegue casi
 * solo puede ser el mensual. Y los dos errores no cuestan lo mismo: equivocarse hacia
 * *«revisa tu cuota»* manda al operador al sitio correcto, mientras que equivocarse
 * hacia *«se reintentará»* es **reproducir el defecto exacto** que ADR-027 cierra.
 *
 * La presunción está acotada al 429 a propósito: un 5xx mudo **sí** es una caída y
 * sigue siendo `proveedor_no_disponible`.
 */
function classifyGlobal(body: MarketstackBody | null, status: number | null): QuoteFailureReason {
  const code = (body?.error?.code ?? '').toLowerCase();
  const msg = (body?.error?.message ?? '').toLowerCase();
  if (/no_valid_symbols|invalid_symbol/.test(code) || /no valid symbols|invalid symbol/.test(msg)) {
    return 'simbolo_no_admitido';
  }
  // El tope por segundo, ANTES que la presunción: es el único 429 que sí es transitorio.
  if (/rate_limit_reached|too_many_requests/.test(code) || /too many requests|rate limit/.test(msg)) {
    return 'proveedor_no_disponible';
  }
  // La cuota se reconoce por su código diga lo que diga el estado —es la verdad venga
  // como venga—; y ante un 429 sin código legible, se presume (ver cabecera).
  if (/usage_limit_reached/.test(code) || /usage limit/.test(msg) || status === 429) {
    return 'cuota_agotada';
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
    // Filas CON precio y con mercado legible que NINGÚN pedido reclama por identidad
    // completa. Son las candidatas del paso 2 (SPEC-021): aquí no se decide nada todavía.
    const huerfanas: { ticker: string; micEco: string; row: MarketstackRow }[] = [];

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
      // Sin mercado LEGIBLE no se asigna el precio ni por la vía exacta ni por la relajada
      // (SPEC-021 CA-6): la relajación exige COMPROBAR que el mercado del eco está en el
      // grupo, y no comprobar no es lo mismo que comprobar y aceptar.
      if (!micEco) continue;
      // PASO 1 — emparejado EXACTO por identidad completa (ticker + operating MIC). Tiene
      // prioridad siempre (SPEC-021 CA-7): la relajación solo mira lo que quede sin precio.
      const a = askable.find((x) => x.req.ticker === ticker && x.mic === micEco);
      if (!a) {
        // Eco de OTRO mercado (o de nada pedido). Aquí NO se asigna: queda como candidata
        // del paso 2, que decidirá con las tres condiciones de ADR-014.
        huerfanas.push({ ticker, micEco, row });
        continue;
      }
      const clave = `${a.req.ticker}:${a.mic}`;
      if (!pedidos.has(clave)) continue; // ya servido: ningún pedido recibe dos precios (CA-7)
      pedidos.delete(clave);
      out.push({
        ticker: a.req.ticker,
        micCode: a.mic,
        price: String(row.close), // último cierre NO ajustado (RN-12); adj_close se ignora
        // Sin `currency`: Marketstack no la devuelve (verificado). La divisa es la del
        // símbolo (RN-09) y la pone el refresco.
        asOf: new Date(row.date).toISOString(), // D-2
      });
    }

    // PASO 2 — relajación acotada (SPEC-021, ADR-014). Solo sobre pedidos que quedaron sin
    // precio, y solo con las TRES condiciones a la vez. Cualquier otro caso mantiene el
    // rechazo estricto de SPEC-020.
    for (const a of [...pedidos.values()]) {
      // (a) La cadena NO nombra mercado. Con sufijo ya le dijimos cuál queríamos: un eco
      //     discrepante ahí es una anomalía, no una diferencia de criterio (CA-4).
      if (a.sent !== a.req.ticker) continue;
      // (b) La cadena corresponde a UN ÚNICO pedido del lote. Con dos compitiendo, el eco
      //     es la única información que los distingue: relajar cruzaría precios (CA-3).
      if (askable.filter((x) => x.sent === a.sent).length !== 1) continue;
      // (c) El mercado del eco está en el MISMO grupo equivalente que el pedido. Es el
      //     guardarraíl de divisa (RN-09): un eco de fuera del grupo se rechaza (CA-5).
      const candidatas = huerfanas.filter((h) => h.ticker === a.req.ticker && sameEquivalentGroup(a.mic, h.micEco));
      // Ninguna → nada que relajar. Dos o más compitiendo sin casar → se falla SEGURO y no
      // se asigna ninguna (CA-7): entre dos precios sin criterio, ninguno es defendible.
      if (candidatas.length !== 1) continue;

      const { row, micEco } = candidatas[0];
      pedidos.delete(`${a.req.ticker}:${a.mic}`);
      out.push({
        ticker: a.req.ticker,
        // El MIC del PEDIDO, nunca el del eco (CA-2, ADR-007/ADR-012 pto. 3): es el que el
        // dominio tiene por cierto y el que hace casar `quoteKey` en `refresh.ts`.
        micCode: a.mic,
        // El mercado del eco viaja SOLO como constancia observable del ciclo (CA-8).
        providerMicCode: micEco,
        price: String(row.close),
        asOf: new Date(row.date as string).toISOString(),
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
    // El ESTADO viaja al clasificador (SPEC-043): sin él, el 429 de la cuota agotada es
    // indistinguible de cualquier otro fallo global y vuelve a caer en el cajón.
    if (!res.ok) return { ok: false, reason: classifyGlobal(body, res.status) };
    if (body?.error) return { ok: false, reason: classifyGlobal(body, res.status) };
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
