import postgres from 'postgres';
import { type Locator, type Page } from '@playwright/test';
import { DB_URL, ponerRol, rolDe } from './roles';

/**
 * SPEC-054 — cuentas, siembra y localizadores compartidos por las guardias de esta spec.
 *
 * ## Por qué se siembra por SQL y no por la pantalla
 *
 * El escenario que estos CA necesitan —**una fila de cada estado de zona**, con y sin
 * motivo de fallo, con y sin marca de «sin refrescar», y **posiciones de cartera** con y
 * sin P/L actual— lo produce el ciclo diario, no la interfaz. Montarlo a base de clics
 * costaría media suite y convertiría cualquier fallo de maquetación en un fallo de
 * preparación. Es el mismo criterio que ya siguen `spec041.ts` y `spec043.ts`.
 *
 * ## ⚠️ El cupo del registro
 *
 * La base del e2e es UNA y la comparten todas las specs. La migración siembra el grifo con
 * cupo 50 (SPEC-037 / ADR-023 pto. 7) y la suite ya registra cuarenta y tantas cuentas.
 * SPEC-054 da de alta **una y sólo una**, y necesita rol `completo` porque **mide las dos
 * tablas**: un `tester` no alcanza `/cartera` (CE-2 de EPIC-004).
 *
 * ## Los tickers son EXCLUSIVOS de esta spec
 *
 * El registro de símbolos es COMPARTIDO (ADR-002): escribir sobre `ITX` cambiaría lo que
 * ven otras pruebas. Todos los de aquí empiezan por `Z7`, como `spec041.ts` usa `Z4`,
 * `vigiladas-editar.spec.ts` usa `Z5` y `spec043.ts`/`spec046.ts` usan `Z6`.
 */

export const PWD = 'clave-secreta-123';

/** La única cuenta de esta spec. Rol `completo`: mide `/vigiladas` **y** `/cartera`. */
export const CUENTA = 'spec054@example.com';

export const SHOTS = '_qa/SPEC-054';

const H = 3_600_000;

/**
 * Cuánto hace que el ciclo escribió una cotización congelada. **60 h** es «dos ciclos y
 * medio perdidos», cómodamente por encima de las 36 h de RN-16. Es RELATIVO al reloj a
 * propósito: una fecha clavada convertiría la guardia en una bomba de relojería.
 */
const HORAS_CONGELADA = 60;
/** Y esto es «anoche»: por debajo del umbral, la fila NO se marca. */
const HORAS_FRESCA = 11;

export interface SembradoVigilada {
  ticker: string;
  micCode: string;
  name: string | null;
  instrumentType: string | null;
  buyMin?: string;
  buyMax?: string;
  sellMin?: string;
  sellMax?: string;
  /** Última cotización ingerida; ausente = el símbolo no tiene precio (estado `none`). */
  price?: string;
  /** Hace cuántas horas escribió el ciclo la fila (`quotes.updated_at`). */
  escritaHaceHoras?: number;
  /** SPEC-016: motivo por el que NO se puede cotizar. */
  failReason?: string;
  /** Si además hay una compra, para que la fila exista también en `/cartera`. */
  enCartera?: boolean;
}

/**
 * **El escenario de esta spec**, y cada fila está elegida por lo que hace comprobable:
 *
 * | ticker    | estado | aviso           | en cartera | qué demuestra                          |
 * |-----------|--------|-----------------|------------|----------------------------------------|
 * | `Z7BOTH`  | both   | —               | sí         | la etiqueta más larga («En compra y venta») |
 * | `Z7BUY`   | buy    | —               | sí         | el caso normal, con P/L actual calculado |
 * | `Z7SELL`  | sell   | —               | no         | el tercer color de fondo                |
 * | `Z7OUT`   | out    | —               | sí         | el cuarto                               |
 * | `Z7FALLO` | none   | `.quote-fail`   | sí         | CA-15 en la tarjeta y en el P/L actual  |
 * | `Z7PEND`  | none   | `.quote-pending`| no         | CA-15, el aviso sin motivo              |
 * | `Z7STALE` | buy    | `.quote-stale`  | sí         | CA-15 con el P/L actual CON número      |
 *
 * Los **cinco estados de zona** están (CA-6 los pide todos) y los **tres avisos de
 * diagnóstico** también (CA-15). `Z7FALLO` va sin nombre: es SPEC-041 CA-3 —sin nombre no
 * se inventa un nombre— comprobado también en la tarjeta.
 */
export const ESCENARIO: SembradoVigilada[] = [
  {
    ticker: 'Z7BOTH',
    micCode: 'BMEX',
    name: 'Ambas Zonas Tarjeta SA',
    instrumentType: 'Common Stock',
    buyMin: '20',
    buyMax: '30',
    sellMin: '25',
    sellMax: '35',
    price: '28',
    enCartera: true,
  },
  {
    ticker: 'Z7BUY',
    micCode: 'BMEX',
    name: 'Compra Tarjeta SA',
    instrumentType: 'Common Stock',
    buyMin: '20',
    buyMax: '25',
    price: '22',
    enCartera: true,
  },
  {
    ticker: 'Z7SELL',
    micCode: 'XNYS',
    name: 'Venta Tarjeta ETF',
    instrumentType: 'ETF',
    sellMin: '35',
    sellMax: '40',
    price: '37',
  },
  {
    ticker: 'Z7OUT',
    micCode: 'BMEX',
    name: 'Fuera Tarjeta REIT',
    instrumentType: 'REIT',
    buyMin: '20',
    buyMax: '25',
    price: '99',
    enCartera: true,
  },
  {
    ticker: 'Z7FALLO',
    micCode: 'BMEX',
    name: null,
    instrumentType: null,
    buyMin: '10',
    buyMax: '15',
    failReason: 'sin_identidad_de_mercado',
    enCartera: true,
  },
  {
    ticker: 'Z7PEND',
    micCode: 'BMEX',
    name: 'Pendiente Tarjeta SA',
    instrumentType: 'Common Stock',
    buyMin: '10',
    buyMax: '15',
  },
  {
    ticker: 'Z7STALE',
    micCode: 'BMEX',
    name: 'Congelada Tarjeta SA',
    instrumentType: 'Common Stock',
    buyMin: '20',
    buyMax: '25',
    price: '22',
    escritaHaceHoras: HORAS_CONGELADA,
    enCartera: true,
  },
];

/** Cuántas posiciones deja el escenario en `/cartera`. Se deriva, no se escribe a mano. */
export const POSICIONES = ESCENARIO.filter((f) => f.enCartera === true).length;

async function conSql<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/**
 * Deja a `email` con EXACTAMENTE estas vigiladas, estas cotizaciones y estas compras.
 * Destructivo sobre esa cuenta e idempotente: dos ejecuciones dan el mismo escenario.
 */
export async function sembrar(email: string, filas: SembradoVigilada[]): Promise<void> {
  await conSql(async (sql) => {
    const [u] = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (!u) throw new Error(`sembrar: no existe la cuenta ${email} (¿se registró antes?)`);
    await sql`DELETE FROM watched_symbols WHERE user_id = ${u.id}`;
    await sql`DELETE FROM transactions WHERE user_id = ${u.id}`;

    for (const f of filas) {
      // El símbolo es compartido: se busca por su IDENTIDAD (ticker, mic) y sólo se crea
      // si no está. Los metadatos SÍ se refrescan, que es lo que este escenario monta.
      const encontrados =
        await sql`SELECT id FROM symbols WHERE ticker = ${f.ticker} AND mic_code = ${f.micCode}`;
      let symbolId: string;
      if (encontrados.length > 0) {
        symbolId = encontrados[0].id as string;
        await sql`UPDATE symbols SET name = ${f.name}, instrument_type = ${f.instrumentType} WHERE id = ${symbolId}`;
      } else {
        const [creado] = await sql`
          INSERT INTO symbols (ticker, mic_code, exchange, name, instrument_type, currency)
          VALUES (${f.ticker}, ${f.micCode}, ${f.micCode}, ${f.name}, ${f.instrumentType}, 'EUR')
          RETURNING id`;
        symbolId = creado.id as string;
      }

      await sql`
        INSERT INTO watched_symbols (user_id, symbol_id, buy_min, buy_max, sell_min, sell_max)
        VALUES (${u.id}, ${symbolId}, ${f.buyMin ?? null}, ${f.buyMax ?? null},
                ${f.sellMin ?? null}, ${f.sellMax ?? null})`;

      if (f.enCartera === true) {
        await sql`
          INSERT INTO transactions (user_id, symbol_id, type, quantity, price, occurred_on)
          VALUES (${u.id}, ${symbolId}, 'buy', 10, 1, '2026-01-02')`;
      }

      if (f.price != null) {
        const escritaEn = new Date(
          Date.now() - (f.escritaHaceHoras ?? HORAS_FRESCA) * H,
        ).toISOString();
        await sql`
          INSERT INTO quotes (symbol_id, price, currency, as_of, updated_at)
          VALUES (${symbolId}, ${f.price}, 'EUR', '2026-08-18T23:43:00.000Z', ${escritaEn})
          ON CONFLICT (symbol_id) DO UPDATE
            SET price = EXCLUDED.price, as_of = EXCLUDED.as_of, updated_at = EXCLUDED.updated_at`;
      } else {
        await sql`DELETE FROM quotes WHERE symbol_id = ${symbolId}`;
      }

      if (f.failReason != null) {
        await sql`
          INSERT INTO quote_diagnostics (symbol_id, reason) VALUES (${symbolId}, ${f.failReason})
          ON CONFLICT (symbol_id) DO UPDATE SET reason = EXCLUDED.reason, attempted_at = now()`;
      } else {
        await sql`DELETE FROM quote_diagnostics WHERE symbol_id = ${symbolId}`;
      }
    }
  });
}

/** Entra con la cuenta de esta spec; la registra la primera vez que se necesita. */
export async function entrar(page: Page, email: string = CUENTA): Promise<void> {
  const yaExiste = (await rolDe(email)) !== null;
  await page.goto(yaExiste ? '/login' : '/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  // SPEC-034 (F-SPEC-034-4): toda cuenta nueva nace `tester` y un tester NO ve Cartera.
  // Se DECLARA el rol que esta spec necesita en vez de heredarlo por descuido.
  await ponerRol(email, 'completo');
}

/** Entra, siembra el escenario y deja la sesión lista. No navega a ninguna de las dos. */
export async function prepararCuenta(page: Page): Promise<void> {
  await entrar(page);
  await sembrar(CUENTA, ESCENARIO);
}

/* ────────────────────────────────────────────────────────────────────────────
   Localizadores — las dos representaciones de cada pantalla
   ──────────────────────────────────────────────────────────────────────────── */

/** Las dos superficies que esta spec mide, con lo que cada una necesita saber de sí misma. */
export interface Pantalla {
  ruta: '/vigiladas' | '/cartera';
  nombre: string;
  /** La lista de tarjetas de esa pantalla. */
  tarjetas: string;
  /** Cuántas filas trae el escenario en esa pantalla. */
  filas: number;
  /** El texto que identifica cada fila, en el orden en que se pinta a 1280 px. */
  claveDeFila: string;
}

export const SELECTOR_TABLA = 'table.data-table';
export const TARJETAS_VIGILADAS = 'ul[data-testid="tarjetas-vigiladas"]';
export const TARJETAS_CARTERA = 'ul[data-testid="tarjetas-cartera"]';

export const PANTALLAS: Pantalla[] = [
  {
    ruta: '/vigiladas',
    nombre: 'vigiladas',
    tarjetas: TARJETAS_VIGILADAS,
    filas: ESCENARIO.length,
    claveDeFila: '.ticker',
  },
  {
    ruta: '/cartera',
    nombre: 'cartera',
    tarjetas: TARJETAS_CARTERA,
    filas: POSICIONES,
    claveDeFila: '.ticker',
  },
];

/** Las filas de la TABLA de la pantalla que esté cargada. */
export const filasDeLaTabla = (page: Page): Locator =>
  page.locator(`${SELECTOR_TABLA} tbody tr`);

/** Las TARJETAS de la pantalla que esté cargada. */
export const tarjetasDe = (page: Page, pantalla: Pantalla): Locator =>
  page.locator(`${pantalla.tarjetas} > li`);

/**
 * **Deja la pantalla pintada en su forma ANCHA**, que es de donde salen las comparaciones.
 *
 * Se navega a 1280 px a propósito y se espera a la tabla: si se navegara al ancho que está
 * bajo prueba, un fallo de maquetación se convertiría en un fallo de preparación y el
 * mensaje no diría nada útil (mismo criterio que `asegurarVigilada` de SPEC-040).
 */
export async function abrirAncha(page: Page, pantalla: Pantalla): Promise<void> {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(pantalla.ruta);
  await page.locator(SELECTOR_TABLA).waitFor({ state: 'visible' });
}
