import postgres from 'postgres';
import { type Page } from '@playwright/test';
import { DB_URL, rolDe } from './roles';

/**
 * SPEC-041 — cuentas, siembra y gestos compartidos por las guardias de esta spec.
 *
 * ## ⚠️ El cupo del registro, otra vez
 *
 * La base del e2e es UNA y la comparten todas las specs. La migración siembra el grifo
 * con cupo 50 (SPEC-037 / ADR-023 pto. 7) y la suite ya registra del orden de cuarenta y
 * tantas cuentas. Por eso SPEC-041 da de alta **cuatro y sólo cuatro**, prefijadas con
 * `spec041-`, y **reutiliza** dos de ellas para lo que necesita dos usuarios distintos.
 *
 * ## Por qué se siembra por SQL y no por la pantalla
 *
 * Porque el escenario que estos CA necesitan —una fila **de cada estado de zona**, con y
 * sin motivo de fallo, con y sin nombre, con y sin mercado conocido— lo produce el
 * **ciclo diario** y el buscador, no la interfaz de alta. Montarlo a base de clics
 * costaría media suite y convertiría cualquier fallo de maquetación en un fallo de
 * preparación. Es el mismo criterio que ya siguen `avisos-zona.spec.ts` y
 * `vigiladas.spec.ts` para sembrar cotizaciones y episodios.
 *
 * ## Los tickers son EXCLUSIVOS de esta spec
 *
 * El registro de símbolos es COMPARTIDO (ADR-002): escribir un `name` sobre `ITX` o
 * `TEF` cambiaría lo que ven las pruebas de otras specs. Todos los tickers de aquí
 * empiezan por `Z4` y no los usa nadie más.
 */

export const PWD = 'clave-secreta-123';

/** Seis filas, una por estado de zona, con nombres pensados para CA-7. */
export const CUENTA_ORDEN = 'spec041-orden@example.com';

/** Exactamente una fila: el escenario mínimo de «lista con filas» (CA-13..CA-16, CA-22). */
export const CUENTA_ALTA = 'spec041-alta@example.com';

/** El mismo ticker vigilado en dos mercados (ADR-007), para CA-18. */
export const CUENTA_QUITAR = 'spec041-quitar@example.com';

/** Sin ninguna vigilada, nunca: CA-12 y CA-21. */
export const CUENTA_VACIA = 'spec041-vacio@example.com';

export const SHOTS = '_qa/SPEC-041';

/** Una vigilada tal como la deja el ciclo: símbolo, zonas y —si toca— precio o motivo. */
export interface FilaSembrada {
  ticker: string;
  micCode: string | null;
  name: string | null;
  instrumentType: string | null;
  buyMin?: string;
  buyMax?: string;
  sellMin?: string;
  sellMax?: string;
  /** Última cotización ingerida; ausente = el símbolo no tiene precio (estado `none`). */
  price?: string;
  /** SPEC-016: motivo por el que NO se puede cotizar. Sólo tiene sentido sin precio. */
  failReason?: string;
}

async function conSql<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/**
 * Deja a `email` con EXACTAMENTE estas vigiladas. Idempotente y **destructivo sobre esa
 * cuenta**: borra primero lo que tuviera, para que dos ejecuciones de la suite den el
 * mismo escenario y un test no herede filas de otro.
 */
export async function sembrarVigiladas(email: string, filas: FilaSembrada[]): Promise<void> {
  await conSql(async (sql) => {
    const [u] = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (!u) throw new Error(`sembrarVigiladas: no existe la cuenta ${email} (¿se registró antes?)`);
    await sql`DELETE FROM watched_symbols WHERE user_id = ${u.id}`;

    for (const f of filas) {
      // El símbolo es compartido: se busca por su IDENTIDAD (ticker, mic) y sólo se crea
      // si no está. Los metadatos SÍ se refrescan, que es lo que este escenario monta.
      const encontrados =
        f.micCode === null
          ? await sql`SELECT id FROM symbols WHERE ticker = ${f.ticker} AND mic_code IS NULL`
          : await sql`SELECT id FROM symbols WHERE ticker = ${f.ticker} AND mic_code = ${f.micCode}`;
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

      if (f.price != null) {
        await sql`
          INSERT INTO quotes (symbol_id, price, currency, as_of)
          VALUES (${symbolId}, ${f.price}, 'EUR', '2026-07-13T00:00:00.000Z')
          ON CONFLICT (symbol_id) DO UPDATE SET price = EXCLUDED.price, as_of = EXCLUDED.as_of`;
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

/**
 * **El escenario de orden**: una fila por estado de zona, y los nombres elegidos para que
 * los tres criterios den tres secuencias DISTINTAS. Si el orden por nombre coincidiera
 * con el orden por ticker, un test que pasara no demostraría nada.
 *
 * | ticker    | nombre            | estado          | ticker↑ | nombre↑ | estado↑ |
 * |-----------|-------------------|-----------------|---------|---------|---------|
 * | Z4BOTH    | Ambas Zonas SA    | both            | 1       | 2       | 1       |
 * | Z4BUY     | iberdrola         | buy             | 2       | 3       | 2       |
 * | Z4NOFALLO | (sin nombre)      | none + motivo   | 3       | 6       | 5       |
 * | Z4NOPEND  | Repsol Vigilada   | none, sin motivo| 4       | 5       | 6       |
 * | Z4OUT     | Acerinox          | out             | 5       | 1       | 4       |
 * | Z4SELL    | Índice Zeta       | sell            | 6       | 4       | 3       |
 *
 * `iberdrola` en minúscula e `Índice Zeta` con tilde no son adorno: son CA-7 —orden
 * alfabético en español, insensible a mayúsculas y a acentos— puesto donde se ve.
 * `Z4NOFALLO` va **sin nombre y sin mercado**: es a la vez CA-3 (sólo el ticker, sin
 * inventar nada) y la mitad de CA-17 (la celda de mercado queda VACÍA, SPEC-029).
 */
export const ESCENARIO_ORDEN: FilaSembrada[] = [
  { ticker: 'Z4BOTH', micCode: 'BMEX', name: 'Ambas Zonas SA', instrumentType: 'Common Stock', buyMin: '20', buyMax: '30', sellMin: '25', sellMax: '35', price: '28' },
  { ticker: 'Z4BUY', micCode: 'BMEX', name: 'iberdrola', instrumentType: 'Common Stock', buyMin: '20', buyMax: '25', price: '22' },
  { ticker: 'Z4SELL', micCode: 'XNYS', name: 'Índice Zeta', instrumentType: 'ETF', sellMin: '35', sellMax: '40', price: '37' },
  { ticker: 'Z4OUT', micCode: 'BMEX', name: 'Acerinox', instrumentType: 'REIT', buyMin: '20', buyMax: '25', price: '99' },
  { ticker: 'Z4NOFALLO', micCode: null, name: null, instrumentType: null, buyMin: '10', buyMax: '15', failReason: 'sin_identidad_de_mercado' },
  { ticker: 'Z4NOPEND', micCode: 'BMEX', name: 'Repsol Vigilada', instrumentType: 'Common Stock', buyMin: '10', buyMax: '15' },
];

/** Orden por ticker ascendente: el de siempre, `orderBy(symbols.ticker)` (CA-6). */
export const POR_TICKER = ['Z4BOTH', 'Z4BUY', 'Z4NOFALLO', 'Z4NOPEND', 'Z4OUT', 'Z4SELL'];

/** Orden por nombre ascendente, con el ticker como clave del que no tiene (CA-7). */
export const POR_NOMBRE = ['Z4OUT', 'Z4BOTH', 'Z4BUY', 'Z4SELL', 'Z4NOPEND', 'Z4NOFALLO'];

/** Orden por estado ascendente: both → buy → sell → out → none(motivo) → none(ciclo) (CA-8). */
export const POR_ESTADO = ['Z4BOTH', 'Z4BUY', 'Z4SELL', 'Z4OUT', 'Z4NOFALLO', 'Z4NOPEND'];

/** El mismo ticker en dos mercados (ADR-007) más una fila que los separe al reordenar. */
export const ESCENARIO_QUITAR: FilaSembrada[] = [
  { ticker: 'Z4DUAL', micCode: 'BMEX', name: 'Dual SA', instrumentType: 'Common Stock', buyMin: '10', buyMax: '15', price: '12' },
  { ticker: 'Z4DUAL', micCode: 'XNYS', name: 'Dual SA', instrumentType: 'Common Stock', buyMin: '60', buyMax: '65' },
  { ticker: 'Z4SOLO', micCode: 'BMEX', name: 'Sola SA', instrumentType: 'Common Stock', buyMin: '1', buyMax: '2', price: '99' },
];

/** Una sola fila: lo mínimo para que el alta esté plegada (CA-13). */
export const ESCENARIO_ALTA: FilaSembrada[] = [
  { ticker: 'Z4ALTA', micCode: 'BMEX', name: 'Alta Plegable SA', instrumentType: 'Common Stock', buyMin: '20', buyMax: '25', price: '22' },
];

/** Entra con la cuenta indicada; la registra la primera vez que se necesita. */
export async function entrar(page: Page, email: string): Promise<void> {
  const yaExiste = (await rolDe(email)) !== null;
  await page.goto(yaExiste ? '/login' : '/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

/** Entra, siembra el escenario y deja la página en `/vigiladas` con la tabla pintada. */
export async function prepararLista(
  page: Page,
  email: string,
  filas: FilaSembrada[],
): Promise<void> {
  await entrar(page, email);
  await sembrarVigiladas(email, filas);
  await page.goto('/vigiladas');
  await page.locator('table.data-table').waitFor({ state: 'visible' });
}

/** Los tickers de la tabla, EN EL ORDEN EN QUE SE VEN. */
export async function tickersEnPantalla(page: Page): Promise<string[]> {
  return page.locator('table.data-table tbody tr td:first-child .ticker').allInnerTexts();
}

/** Elige criterio y dirección en el control de orden de CA-11. */
export async function ordenarPor(
  page: Page,
  criterio: 'ticker' | 'name' | 'state',
  direccion: 'asc' | 'desc',
): Promise<void> {
  await page.getByTestId('orden-criterio').selectOption(criterio);
  const boton = page.getByTestId('orden-direccion');
  if ((await boton.getAttribute('data-direccion')) !== direccion) await boton.click();
}
