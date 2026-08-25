import { count, eq, inArray } from 'drizzle-orm';
import { union, type PgDatabase } from 'drizzle-orm/pg-core';
import { quotes, symbols, transactions, watchedSymbols } from '@/db/schema';
import { quoteKey, type MarketDataProvider, type QuoteFailureReason, type QuotesResult } from './provider';
import { clearDiagnostic, upsertDiagnostic, upsertQuote } from './quotes';
import { cotizacionVigente } from './sin-refrescar';

type Db = PgDatabase<any, any, any>;

export interface UniverseSymbol {
  symbolId: string;
  ticker: string;
  micCode: string | null;
  /** Divisa del símbolo: es la VERDAD de la cotización (RN-09), no la que diga el proveedor. */
  currency: string;
}

/**
 * Universo de símbolos a refrescar (CA-1/CA-2): la UNIÓN DISTINCT de los símbolos
 * referenciados por alguna acción vigilada (watchlist) o alguna transacción
 * (cartera), de CUALQUIER usuario. Un símbolo que nadie referencia NO entra
 * (aunque exista en `symbols`). El `Set` garantiza que no hay duplicados: un
 * símbolo que vigilan/operan N usuarios aparece una sola vez (dedupe, ADR-002).
 */
export async function symbolUniverse(db: Db): Promise<UniverseSymbol[]> {
  const watched = await db.selectDistinct({ symbolId: watchedSymbols.symbolId }).from(watchedSymbols);
  const traded = await db.selectDistinct({ symbolId: transactions.symbolId }).from(transactions);

  const ids = new Set<string>();
  for (const r of watched) ids.add(r.symbolId);
  for (const r of traded) ids.add(r.symbolId);
  if (ids.size === 0) return [];

  const rows = await db.select().from(symbols).where(inArray(symbols.id, [...ids]));
  return rows.map((s) => ({ symbolId: s.id, ticker: s.ticker, micCode: s.micCode, currency: s.currency }));
}

/**
 * CUÁNTOS símbolos tiene ese universo, sin traérselos (SPEC-037 CA-13/CA-23).
 *
 * Vive AQUÍ, pegada a `symbolUniverse`, y no en la pantalla de operación, porque el
 * proyecto no puede tener dos definiciones de «universo del ciclo»: la de lo que se
 * cotiza y la de lo que se cuenta. Si mañana el universo deja de ser
 * `watched_symbols ∪ transactions`, las dos funciones se cambian a la vez y el mismo
 * test las compara — `tests/ops-snapshot.test.ts` exige que este número sea siempre
 * `(await symbolUniverse(db)).length`.
 *
 * Es una AGREGACIÓN y no un `length` de la otra: la pantalla de operación tiene que
 * responder deprisa porque pregunta poco (CE-7), y traerse cinco mil filas para
 * contarlas es justo lo contrario. El `UNION` (no `UNION ALL`) hace el dedupe en la
 * base, igual que el `Set` de arriba lo hace en memoria.
 */
export async function countUniverseSymbols(db: Db): Promise<number> {
  const universo = union(
    db.selectDistinct({ symbolId: watchedSymbols.symbolId }).from(watchedSymbols),
    db.selectDistinct({ symbolId: transactions.symbolId }).from(transactions),
  ).as('universo');
  const [fila] = await db.select({ n: count() }).from(universo);
  return Number(fila?.n ?? 0);
}

/** Un símbolo que no se pudo cotizar, con su motivo clasificado (SPEC-016). */
export interface SkippedSymbol {
  ticker: string;
  reason: QuoteFailureReason;
}

/**
 * Un precio que SÍ se asignó aunque el proveedor etiquetara la fila con otro mercado del
 * mismo grupo equivalente (SPEC-021 CA-8, ADR-014). No es un fallo y **no se le muestra al
 * usuario**: para él hay precio y no hay diagnóstico. Es constancia para el OPERADOR, en
 * el canal que ya existe —el resultado del ciclo, que viaja entero al cuerpo del cron—,
 * sin tabla nueva, sin telemetría y sin tocar `quote_diagnostics`, que es el canal de "no
 * hay precio" y aquí sí lo hay. Si el proveedor empezara a etiquetar mal en masa, se ve
 * aquí y no en el P/L de un usuario.
 */
export interface MarketLabelMismatch {
  ticker: string;
  /** Operating MIC del símbolo: el que se pidió y el ÚNICO que se persiste (ADR-007). */
  requestedMicCode: string | null;
  /** Mercado con el que el proveedor etiquetó la fila (del mismo grupo equivalente). */
  providerMicCode: string;
}

export interface RefreshResult {
  requested: string[]; // tickers pedidos (distinct)
  updated: string[]; // tickers cuya cotización se persistió
  /**
   * Tickers que no se pudieron cotizar, CON SU MOTIVO (SPEC-016). Antes era una lista
   * de tickers pelada y el motivo se tiraba: por eso el defecto de cobertura de EPIC-FIX
   * pasó semanas sin detectarse. Se saltan sin abortar el ciclo (CA-6 de SPEC-004).
   */
  skipped: SkippedSymbol[];
  /** Precios asignados con etiqueta de mercado discrepante (SPEC-021 CA-8). */
  mismatched: MarketLabelMismatch[];
}

/**
 * Refresco diario de cotizaciones (ADR-004): calcula el universo distinct, pide
 * los precios al proveedor en UNA llamada (ADR-002), y hace upsert de cada
 * cotización devuelta. Los símbolos que el proveedor no resuelve se SALTAN sin
 * abortar el ciclo (CA-6). El precio se guarda NO ajustado con su `asOf` (RN-12).
 *
 * **SPEC-058**: el cuerpo se ha mudado a `ingerir`, que es el que comparten el ciclo y
 * el **refresco bajo demanda** (RN-17, ADR-038 pto. 2). Lo que queda aquí es lo único
 * que de verdad es del ciclo: **quién** se pide —el universo entero— y que **no lleva
 * presupuesto de tiempo**, porque el cron no tiene prisa.
 */
export async function refreshQuotes(db: Db, provider: MarketDataProvider): Promise<RefreshResult> {
  return ingerir(db, provider, await symbolUniverse(db));
}

/**
 * **El presupuesto de tiempo del refresco bajo demanda: 3 segundos** (RN-17,
 * ADR-038 pto. 5). Se declara **aquí y en ningún otro sitio** (ADR-026 pto. 2).
 *
 * Por qué 3 s, con el precio de las alternativas que el ADR razona: **1 s** se agotaría
 * con latencia normal de red y convertiría el caso bueno en el caso raro; **10 s** es la
 * clase de espera que hace que la gente pulse dos veces el botón. El alta en sí son dos
 * escrituras en la base y tarda milisegundos, así que el presupuesto es **todo** para el
 * tercero.
 *
 * **Salvedad que sigue escrita a propósito** (gate del 2026-08-25): la latencia real
 * **no está medida**. Esto es un techo razonado, no un percentil observado. Si molesta,
 * la salida es la alternativa (d) de ADR-038 —refrescar en segundo plano— y entonces se
 * enmienda por ADR, no por parche.
 *
 * El presupuesto vive **en el dominio y no en el adaptador** porque es una propiedad de
 * la **paciencia de quien llama**, no del proveedor: el ciclo llama al mismo adaptador y
 * espera lo que haga falta.
 */
export const PRESUPUESTO_REFRESCO_BAJO_DEMANDA_MS = 3_000;

/** El presupuesto se agotó antes de que el proveedor contestara. Interna a propósito:
 *  no es vocabulario de dominio y no llega a `QuoteFailureReason` (ADR-038 pto. 5). */
class PresupuestoAgotado extends Error {
  constructor(ms: number) {
    super(`El proveedor no respondió dentro del presupuesto de ${ms} ms`);
    this.name = 'PresupuestoAgotado';
  }
}

/**
 * Espera a `promesa` como mucho `ms`. Sin `ms` (el ciclo) no hay carrera ninguna: se
 * espera lo que haga falta, exactamente como antes de SPEC-058.
 *
 * Al agotarse **se rechaza**, y ese rechazo cae en el mismo `catch` que un adaptador que
 * lanza: el camino de degradación de SPEC-020 CA-9 → `proveedor_no_disponible`. Inventar
 * un motivo `tiempo_agotado` sería ampliar el vocabulario de dominio para decir lo mismo.
 */
function conPresupuesto<T>(promesa: Promise<T>, ms: number | undefined): Promise<T> {
  if (ms === undefined) return promesa;
  return new Promise<T>((resolve, reject) => {
    const reloj = setTimeout(() => reject(new PresupuestoAgotado(ms)), ms);
    promesa.then(
      (v) => {
        clearTimeout(reloj);
        resolve(v);
      },
      (e) => {
        clearTimeout(reloj);
        reject(e);
      },
    );
  });
}

/**
 * **El cuerpo de ingesta, el único que hay** (ADR-038 pto. 2). Lo llaman los dos
 * caminos: el ciclo con N símbolos y el refresco bajo demanda con **uno**.
 *
 * Todo lo que decide *cómo se ingiere un precio* está aquí y solo aquí: pedir por
 * `(ticker, micCode)` (ADR-007/ADR-012), `upsertQuote` con la divisa **del símbolo**
 * (RN-09), `clearDiagnostic` al acertar, `upsertDiagnostic` con el motivo clasificado al
 * fallar (SPEC-016) y el `try/catch` de defensa en profundidad (SPEC-020 CA-9).
 *
 * Que sea uno y no dos es una decisión, no una preferencia de estilo: un segundo
 * constructor del símbolo del proveedor es **exactamente** cómo entra una serie
 * envenenada, y este repositorio ya tiene el caso. `tests/spec058-un-solo-camino.test.ts`
 * lo mide comparando los dos caminos reales entre sí.
 *
 * @param presupuestoMs paciencia de quien llama, en ms. `undefined` = sin límite (ciclo).
 */
async function ingerir(
  db: Db,
  provider: MarketDataProvider,
  universe: UniverseSymbol[],
  presupuestoMs?: number,
): Promise<RefreshResult> {
  const requested = universe.map((u) => u.ticker);
  if (universe.length === 0) return { requested, updated: [], skipped: [], mismatched: [] };

  // Se pide por (ticker, micCode) para desambiguar el mercado (ADR-007). El universo
  // ya es distinct por símbolo, así que no hay duplicados (dedupe, ADR-002).
  const requests = universe.map((u) => ({ ticker: u.ticker, micCode: u.micCode }));

  // Defensa en profundidad (SPEC-020 CA-9). El contrato del puerto dice que `getQuotes`
  // NO lanza (CA-6 de SPEC-004): informa el fallo por símbolo. Pero si un adaptador se
  // porta mal —excepción inesperada, API key ausente, error de red no contemplado— el
  // ciclo NO puede morir: sin refresco no hay evaluación de disparos (SPEC-005) ni avisos
  // (SPEC-006) para NINGÚN usuario ese día. Un adaptador roto degrada a "el proveedor no
  // respondió", que es exactamente lo que ha pasado.
  //
  // SPEC-058 añade una segunda forma de portarse mal que cae en el MISMO sitio: que el
  // proveedor no conteste dentro del presupuesto de quien llama (ADR-038 pto. 5). El
  // rechazo de `conPresupuesto` es indistinguible aquí de un adaptador que lanza, y lo
  // es a propósito: mismo tratamiento, mismo motivo, ninguna rama nueva.
  let resultado: QuotesResult;
  try {
    resultado = await conPresupuesto(provider.getQuotes(requests), presupuestoMs);
  } catch {
    resultado = {
      quotes: [],
      failures: requests.map((r) => ({ ticker: r.ticker, micCode: r.micCode, reason: 'proveedor_no_disponible' as const })),
    };
  }

  const returned = new Map(resultado.quotes.map((q) => [quoteKey(q.ticker, q.micCode), q]));
  const failed = new Map(resultado.failures.map((f) => [quoteKey(f.ticker, f.micCode), f.reason]));

  const updated: string[] = [];
  const skipped: SkippedSymbol[] = [];
  const mismatched: MarketLabelMismatch[] = [];
  for (const u of universe) {
    const key = quoteKey(u.ticker, u.micCode);
    const q = returned.get(key);
    if (!q) {
      // No se pudo cotizar: se salta sin abortar el ciclo (CA-6 de SPEC-004) PERO el
      // motivo se registra para que el usuario lo vea (SPEC-016, CE-F2 de EPIC-FIX).
      const reason = failed.get(key) ?? 'proveedor_no_disponible';
      await upsertDiagnostic(db, u.symbolId, reason);
      skipped.push({ ticker: u.ticker, reason });
      continue;
    }
    // La divisa es la DEL SÍMBOLO (RN-09), no la que devuelva el proveedor: la fijó el
    // candidato elegido en la búsqueda (ADR-007). Marketstack ni siquiera la devuelve, y
    // fiarse del proveedor permitía guardar USD (SAN@NYSE) en un símbolo EUR (ADR-012).
    await upsertQuote(db, u.symbolId, { price: q.price, currency: u.currency, asOf: q.asOf });
    await clearDiagnostic(db, u.symbolId); // se resolvió: fuera el diagnóstico (CA-8)
    updated.push(u.ticker);
    // El proveedor etiquetó la fila con otro mercado del grupo equivalente (SPEC-021).
    // El precio se persiste igual, con el mercado y la divisa DEL SÍMBOLO; aquí solo queda
    // la constancia para el operador.
    if (q.providerMicCode) {
      mismatched.push({ ticker: u.ticker, requestedMicCode: u.micCode, providerMicCode: q.providerMicCode });
    }
  }
  return { requested, updated, skipped, mismatched };
}

/** Opciones del refresco bajo demanda. Las dos existen para poder afirmar propiedades
 *  sin esperar segundos reales ni depender del reloj de la máquina. */
export interface RefrescoBajoDemandaOpciones {
  /** Presupuesto de tiempo, en ms. Por defecto, el declarado arriba (ADR-038 pto. 5). */
  presupuestoMs?: number;
  /** «Ahora» con el que se mide RN-16 al decidir si la cotización ya es vigente. */
  ahora?: Date;
}

export interface RefrescoBajoDemandaResult extends RefreshResult {
  /**
   * ¿Se le llegó a pedir el precio al proveedor? `false` = la cotización ya era
   * **vigente** y no se gastó cuota (RN-17 b). Es lo que hace que repetir el gesto no
   * sea un botón de gastar cuota, y lo que `requested` vacío ya cuenta: se expone
   * aparte porque leer una lista vacía como «no se pidió» es la clase de deducción que
   * mañana alguien hace al revés.
   */
  pedido: boolean;
}

/**
 * **Refresco bajo demanda** (RN-17, ADR-038): el precio de **un** símbolo, pedido fuera
 * del ciclo porque un gesto del usuario lo justifica —hoy, y solo hoy, el alta de una
 * acción vigilada en `/vigiladas` (ADR-038 pto. 8)—.
 *
 * No es un camino de ingesta nuevo: es `ingerir` —el del ciclo— con **universo de uno**.
 * Lo único que añade encima son las dos cosas que sí son suyas:
 *
 *  1. **No gasta si no compra nada** (RN-17 b, ADR-038 pto. 6). Si la cotización ya es
 *     **vigente** —existe y no está *sin refrescar*, con **el mismo umbral de RN-16**—
 *     no se llama al proveedor y CE-1 se cumple igual, porque el precio ya está. La
 *     condición mira **el estado del dato**, no la forma del gesto: por eso repetir el
 *     alta, `unwatch` + `watch`, o que un segundo usuario añada el mismo símbolo, no
 *     pueden gastar una segunda unidad. Condicionarlo a «que el alta sea un INSERT» es
 *     la alternativa (f) del ADR, rechazada.
 *  2. **Un presupuesto de tiempo**, que el ciclo no tiene, porque aquí hay alguien
 *     esperando delante de un formulario.
 *
 * Y las tres cosas que **no** hace, que son las de ADR-038 pto. 3 y el gemelo exacto de
 * ADR-028 pto. 3: **no evalúa disparos, no abre ni cierra episodios y no notifica**.
 * Quien reconcilia con el precio nuevo es el **ciclo siguiente**. Añadir aquí un
 * `evaluateTriggers()` *«para que se vea al momento»* reintroduce el aviso por gesto que
 * ADR-028 vino a eliminar **y** reinterpreta D-2 por la puerta de atrás, sin gate.
 *
 * El precio que trae **es un precio vigente de pleno derecho**: mismo endpoint, mismo
 * cierre no ajustado (RN-12) y misma regla que el del ciclo. No se marca como provisional
 * (ADR-038 pto. 9).
 */
export async function refreshSymbolOnDemand(
  db: Db,
  provider: MarketDataProvider,
  symbolId: string,
  opciones: RefrescoBajoDemandaOpciones = {},
): Promise<RefrescoBajoDemandaResult> {
  const { presupuestoMs = PRESUPUESTO_REFRESCO_BAJO_DEMANDA_MS, ahora = new Date() } = opciones;
  const nada = { requested: [], updated: [], skipped: [], mismatched: [] };

  const [sym] = await db.select().from(symbols).where(eq(symbols.id, symbolId)).limit(1);
  if (!sym) return { pedido: false, ...nada };

  // RN-17(b): la MISMA pregunta que le hace la pantalla a la fila, con el mismo umbral y
  // desde su único hogar. Si la pantalla ya la presenta como al día, volver a pedirla no
  // añade dato y sí consume cuota (ADR-002 pto. 4 aplicado fuera del ciclo).
  const [fila] = await db
    .select({ updatedAt: quotes.updatedAt })
    .from(quotes)
    .where(eq(quotes.symbolId, symbolId))
    .limit(1);
  if (cotizacionVigente(fila?.updatedAt, ahora)) return { pedido: false, ...nada };

  const uno: UniverseSymbol = {
    symbolId: sym.id,
    ticker: sym.ticker,
    micCode: sym.micCode,
    currency: sym.currency,
  };
  return { pedido: true, ...(await ingerir(db, provider, [uno], presupuestoMs)) };
}
