import postgres from 'postgres';
import { type Page } from '@playwright/test';
import { DB_URL, rolDe } from './roles';
import { entrarORegistrar } from './alta';

/**
 * SPEC-062 — cuenta, siembra y gestos de las guardias del **acercamiento a zona**.
 *
 * ## Una cuenta, y tickers exclusivos
 *
 * La base del e2e es UNA y la comparten todas las specs (cupo del grifo: 50, ADR-023
 * pto. 7). Esta spec registra **una sola** cuenta. Y todos sus tickers empiezan por `Z6`,
 * que no usa nadie más: el registro de símbolos es **compartido** (ADR-002), así que
 * escribir zonas o precios sobre un ticker ajeno cambiaría lo que ven otras pruebas.
 *
 * ## `as_of` clavado, `updated_at` calculado
 *
 * El `as_of` es el MISMO que usan `spec041.ts` y `spec054.ts`, y no es indiferente: la
 * entradilla de `/cartera` enseña `max(as_of)` de **toda** la base y hay una guardia ajena
 * que afirma esa fecha. Lo que esta spec necesita mover es `updated_at`, que es lo que
 * mide RN-16 — y se calcula **relativo al reloj**, porque una fecha clavada convertiría la
 * guardia en una bomba de relojería.
 */

export const CUENTA = 'spec062-cercania@example.com';
export const PWD = 'clave-secreta-123';
export const SHOTS = '_qa/SPEC-062';

const H = 3_600_000;
/** Dos ciclos y medio sin escribirse: por encima de las 36 h de RN-16. */
const HORAS_CONGELADA = 60;
/** «Anoche»: por debajo del umbral, la fila NO se marca. */
const HORAS_FRESCA = 11;

export interface SembradoCercania {
  ticker: string;
  name: string | null;
  buyMin?: string;
  buyMax?: string;
  sellMin?: string;
  sellMax?: string;
  price?: string;
  escritaHaceHoras?: number;
}

/**
 * **El escenario**, y cada fila está elegida por lo que hace comprobable. La zona de
 * compra es `90 – 100` en casi todas a propósito: así lo único que cambia entre filas es
 * **el precio**, y las distancias se pueden leer de un vistazo al revisar un fallo.
 *
 * | ticker      | precio | zonas                  | qué demuestra                              |
 * |-------------|--------|------------------------|--------------------------------------------|
 * | `Z6DENTRO`  | 95     | compra 90–100          | dentro: barra llena y sin porcentaje (CA-7) |
 * | `Z6CERCA`   | 100.5  | compra 90–100          | ~0,5 %: barra casi llena (CA-8)             |
 * | `Z6CASI`    | 100.04 | compra 90–100          | «menos de 0,1%» sin parecer dentro (CA-13)  |
 * | `Z6DEBAJO`  | 88     | compra 90–100          | el precio ya cayó por debajo: SUBIR (CA-9)  |
 * | `Z6LEJOS`   | 130    | compra 90–100          | ~23 %: barra vacía, número entero (CA-8)    |
 * | `Z6VENTA`   | 19     | compra 10–12 · venta 20–22 | elige la zona más cercana (CA-7)        |
 * | `Z6VIEJA`   | 105    | compra 90–100          | sin refrescar: la barra se apaga (CA-14)    |
 * | `Z6SINQ`    | —      | compra 90–100          | sin cotización: no hay barra (CA-1)         |
 * | `Z6SINZONA` | 50     | —                      | sin zonas: tampoco (CA-1)                   |
 */
export const ESCENARIO: SembradoCercania[] = [
  { ticker: 'Z6DENTRO', name: 'Dentro Cercanía SA', buyMin: '90', buyMax: '100', price: '95' },
  { ticker: 'Z6CERCA', name: 'Cerca Cercanía SA', buyMin: '90', buyMax: '100', price: '100.5' },
  { ticker: 'Z6CASI', name: 'Casi Cercanía SA', buyMin: '90', buyMax: '100', price: '100.04' },
  { ticker: 'Z6DEBAJO', name: 'Debajo Cercanía SA', buyMin: '90', buyMax: '100', price: '88' },
  { ticker: 'Z6LEJOS', name: 'Lejos Cercanía SA', buyMin: '90', buyMax: '100', price: '130' },
  {
    ticker: 'Z6VENTA',
    name: 'Venta Cercanía SA',
    buyMin: '10',
    buyMax: '12',
    sellMin: '20',
    sellMax: '22',
    price: '19',
  },
  {
    ticker: 'Z6VIEJA',
    name: 'Vieja Cercanía SA',
    buyMin: '90',
    buyMax: '100',
    price: '105',
    escritaHaceHoras: HORAS_CONGELADA,
  },
  { ticker: 'Z6SINQ', name: 'Sin Precio Cercanía SA', buyMin: '90', buyMax: '100' },
  { ticker: 'Z6SINZONA', name: 'Sin Zona Cercanía SA', price: '50' },
];

/**
 * El orden por cercanía ascendente que el escenario tiene que producir en pantalla.
 *
 * **Se deriva del escenario, no se teclea**: si mañana alguien cambia un precio de la
 * tabla de arriba, esta lista cambia con él y la guardia sigue afirmando la propiedad
 * —*lo más cerca primero, y lo que no se sabe al final*— en vez de una foto.
 */
export function porCercaniaAscendente(filas: SembradoCercania[] = ESCENARIO): string[] {
  const distancia = (f: SembradoCercania): number | null => {
    if (f.price == null) return null;
    const p = Number(f.price);
    const de = (min?: string, max?: string): number | null => {
      if (min == null || max == null) return null;
      if (p >= Number(min) && p <= Number(max)) return 0;
      return (Math.abs(p > Number(max) ? p - Number(max) : Number(min) - p) / p) * 100;
    };
    const compra = de(f.buyMin, f.buyMax);
    const venta = de(f.sellMin, f.sellMax);
    if (compra == null) return venta;
    if (venta == null) return compra;
    return Math.min(compra, venta);
  };

  const con = filas.filter((f) => distancia(f) != null);
  const sin = filas.filter((f) => distancia(f) == null);

  con.sort((a, b) => distancia(a)! - distancia(b)! || a.ticker.localeCompare(b.ticker));
  sin.sort((a, b) => a.ticker.localeCompare(b.ticker));

  return [...con, ...sin].map((f) => f.ticker);
}

async function conSql<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/** Deja a la cuenta con EXACTAMENTE estas vigiladas. Destructivo sobre ella e idempotente. */
export async function sembrar(email: string, filas: SembradoCercania[]): Promise<void> {
  await conSql(async (sql) => {
    const [u] = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (!u) throw new Error(`sembrar: no existe la cuenta ${email} (¿se registró antes?)`);
    await sql`DELETE FROM watched_symbols WHERE user_id = ${u.id}`;

    for (const f of filas) {
      const encontrados =
        await sql`SELECT id FROM symbols WHERE ticker = ${f.ticker} AND mic_code = 'BMEX'`;
      let symbolId: string;
      if (encontrados.length > 0) {
        symbolId = encontrados[0].id as string;
        await sql`UPDATE symbols SET name = ${f.name} WHERE id = ${symbolId}`;
      } else {
        const [creado] = await sql`
          INSERT INTO symbols (ticker, mic_code, exchange, name, instrument_type, currency)
          VALUES (${f.ticker}, 'BMEX', 'BMEX', ${f.name}, 'Common Stock', 'EUR')
          RETURNING id`;
        symbolId = creado.id as string;
      }

      await sql`
        INSERT INTO watched_symbols (user_id, symbol_id, buy_min, buy_max, sell_min, sell_max)
        VALUES (${u.id}, ${symbolId}, ${f.buyMin ?? null}, ${f.buyMax ?? null},
                ${f.sellMin ?? null}, ${f.sellMax ?? null})`;

      if (f.price != null) {
        const escritaEn = new Date(
          Date.now() - (f.escritaHaceHoras ?? HORAS_FRESCA) * H,
        ).toISOString();
        await sql`
          INSERT INTO quotes (symbol_id, price, currency, as_of, updated_at)
          VALUES (${symbolId}, ${f.price}, 'EUR', '2026-07-13T00:00:00.000Z', ${escritaEn})
          ON CONFLICT (symbol_id) DO UPDATE
            SET price = EXCLUDED.price, as_of = EXCLUDED.as_of, updated_at = EXCLUDED.updated_at`;
      } else {
        await sql`DELETE FROM quotes WHERE symbol_id = ${symbolId}`;
      }

      await sql`DELETE FROM quote_diagnostics WHERE symbol_id = ${symbolId}`;
    }
  });
}

/** Entra con la cuenta de esta spec; la registra la primera vez que se necesita. */
export async function entrar(page: Page, email: string = CUENTA): Promise<void> {
  const yaExiste = (await rolDe(email)) !== null;
  // SPEC-066 CA-23: si no existe, el recorrido completo (tests/e2e/alta.ts).
  await entrarORegistrar(page, email, yaExiste, PWD);
}

/** Entra, siembra y deja la página en `/vigiladas` con la tabla pintada. */
export async function prepararLista(page: Page): Promise<void> {
  await entrar(page);
  await sembrar(CUENTA, ESCENARIO);
  await page.goto('/vigiladas');
  await page.locator('table.data-table').waitFor({ state: 'visible' });
}

/** La fila de la tabla de un ticker. */
export const laFila = (page: Page, ticker: string) =>
  page.locator('table.data-table tbody tr').filter({ hasText: ticker });

/** Los tickers de la tabla, EN EL ORDEN EN QUE SE VEN. */
export async function tickersEnPantalla(page: Page): Promise<string[]> {
  return page.locator('table.data-table tbody tr td:first-child .ticker').allInnerTexts();
}

/** Elige criterio y dirección en el control de orden (SPEC-041 CA-11). */
export async function ordenarPor(
  page: Page,
  criterio: 'ticker' | 'name' | 'state' | 'cercania',
  direccion: 'asc' | 'desc',
): Promise<void> {
  await page.getByTestId('orden-criterio').selectOption(criterio);
  const boton = page.getByTestId('orden-direccion');
  if ((await boton.getAttribute('data-direccion')) !== direccion) await boton.click();
}
