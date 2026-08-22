import postgres from 'postgres';
import { type Page } from '@playwright/test';
import { DB_URL, rolDe, ponerRol } from './roles';

/**
 * SPEC-043 — siembra y cuentas de las guardias de esta spec.
 *
 * ## Por qué se siembra por SQL y no por la pantalla
 *
 * El escenario que estos CA necesitan —una cotización cuyo **`updated_at` se quedó
 * atrás**— lo produce el **ciclo diario**, o más bien su ausencia, y no hay ninguna
 * interfaz que lo monte. Es el mismo criterio que ya siguen `vigiladas.spec.ts`,
 * `avisos-zona.spec.ts` y `spec041.ts`.
 *
 * ## ⚠️ El cupo del registro
 *
 * La base del e2e es UNA y la comparten todas las specs. La migración siembra el grifo
 * con cupo 50 (SPEC-037 / ADR-023 pto. 7) y la suite ya registra cuarenta y tantas
 * cuentas. SPEC-043 da de alta **una y solo una**.
 *
 * ## Los tickers son EXCLUSIVOS de esta spec
 *
 * El registro de símbolos es COMPARTIDO (ADR-002): tocar `ITX` o `TEF` cambiaría lo que
 * ven las pruebas de otras specs. Todos los de aquí empiezan por `Z6`.
 */

export const PWD = 'clave-secreta-123';

/** La única cuenta de esta spec. Necesita `completo`: CA-9 y CA-16 abren `/cartera`. */
export const CUENTA = 'spec043@example.com';

export const SHOTS = '_qa/SPEC-043';

const H = 3_600_000;

/**
 * Cuánto hace que el ciclo escribió la fila. **60 h** es «dos ciclos y medio perdidos»,
 * cómodamente por encima de las 36 h de RN-16 y del mismo orden que el hueco real del
 * incidente (última ingesta buena el 2026-08-18T23:43Z, descubierto el 21).
 *
 * Es RELATIVO al reloj a propósito: una fecha de calendario clavada convertiría estas
 * guardias en una bomba de relojería que se pone verde o roja según el día.
 */
export const HORAS_CONGELADA = 60;

/** Y esto es «anoche»: por debajo del umbral, la fila NO se marca. Es el control. */
export const HORAS_FRESCA = 11;

export interface FilaSembrada {
  ticker: string;
  micCode: string;
  name: string;
  buyMin?: string;
  buyMax?: string;
  /** Último precio ingerido. Todas las filas de esta spec TIENEN precio: ése es el punto. */
  price: string;
  /** Hace cuántas horas escribió el ciclo la fila (`quotes.updated_at`). */
  escritaHaceHoras: number;
  /** Motivo vigente en `quote_diagnostics`; ausente = no hay, y no se inventa (CA-10). */
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
 * Deja a `email` con EXACTAMENTE estas vigiladas y estas cotizaciones. Destructivo sobre
 * esa cuenta e idempotente: dos ejecuciones de la suite dan el mismo escenario.
 *
 * Lo que distingue esta siembra de la de SPEC-041 es **`updated_at`**: aquí se escribe a
 * mano, porque es el dato que RN-16 mide y el único que la interfaz no puede producir.
 * `as_of` se deja **igual en todas las filas** a propósito — así, si alguna guardia
 * pasara por medir la rancidez por `as_of`, no distinguiría la fila marcada de la fresca
 * y se caería. La prueba está construida para caerse si se cambia la medida.
 */
export async function sembrarEscenario(email: string, filas: FilaSembrada[]): Promise<string[]> {
  return conSql(async (sql) => {
    const [u] = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (!u) throw new Error(`sembrarEscenario: no existe la cuenta ${email}`);
    await sql`DELETE FROM watched_symbols WHERE user_id = ${u.id}`;
    await sql`DELETE FROM transactions WHERE user_id = ${u.id}`;

    const ids: string[] = [];
    for (const f of filas) {
      const encontrados = await sql`SELECT id FROM symbols WHERE ticker = ${f.ticker} AND mic_code = ${f.micCode}`;
      let symbolId: string;
      if (encontrados.length > 0) {
        symbolId = encontrados[0].id as string;
      } else {
        const [creado] = await sql`
          INSERT INTO symbols (ticker, mic_code, exchange, name, instrument_type, currency)
          VALUES (${f.ticker}, ${f.micCode}, ${f.micCode}, ${f.name}, 'Common Stock', 'EUR')
          RETURNING id`;
        symbolId = creado.id as string;
      }
      ids.push(symbolId);

      await sql`
        INSERT INTO watched_symbols (user_id, symbol_id, buy_min, buy_max)
        VALUES (${u.id}, ${symbolId}, ${f.buyMin ?? null}, ${f.buyMax ?? null})`;

      // Una compra, para que la misma fila exista también en `/cartera` con P/L actual
      // CALCULADO: es exactamente el caso que CA-9 dice que hoy esconde el motivo.
      await sql`
        INSERT INTO transactions (user_id, symbol_id, type, quantity, price, occurred_on)
        VALUES (${u.id}, ${symbolId}, 'buy', 10, 1, '2026-01-02')`;

      const escritaEn = new Date(Date.now() - f.escritaHaceHoras * H).toISOString();
      await sql`
        INSERT INTO quotes (symbol_id, price, currency, as_of, updated_at)
        VALUES (${symbolId}, ${f.price}, 'EUR', '2026-08-18T23:43:00.000Z', ${escritaEn})
        ON CONFLICT (symbol_id) DO UPDATE
          SET price = EXCLUDED.price, as_of = EXCLUDED.as_of, updated_at = EXCLUDED.updated_at`;

      if (f.failReason != null) {
        await sql`
          INSERT INTO quote_diagnostics (symbol_id, reason) VALUES (${symbolId}, ${f.failReason})
          ON CONFLICT (symbol_id) DO UPDATE SET reason = EXCLUDED.reason, attempted_at = now()`;
      } else {
        await sql`DELETE FROM quote_diagnostics WHERE symbol_id = ${symbolId}`;
      }
    }
    return ids;
  });
}

/** Simula el ciclo que VUELVE a funcionar sobre un símbolo: reescribe su fila (CA-11). */
export async function elCicloVuelveAEscribir(ticker: string): Promise<void> {
  await conSql(async (sql) => {
    const [s] = await sql`SELECT id FROM symbols WHERE ticker = ${ticker}`;
    // El upsert real reescribe `updated_at` y borra el diagnóstico (SPEC-016 CA-8).
    await sql`UPDATE quotes SET updated_at = now() WHERE symbol_id = ${s.id}`;
    await sql`DELETE FROM quote_diagnostics WHERE symbol_id = ${s.id}`;
  });
}

/**
 * **El escenario de esta spec**, y las tres filas están elegidas una a una:
 *
 * | ticker    | precio | escrita hace | diagnóstico      | qué demuestra                     |
 * |-----------|--------|--------------|------------------|-----------------------------------|
 * | `Z6CUOTA` | 22     | 60 h         | `cuota_agotada`  | CA-8/CA-9/CA-16: marcada CON motivo |
 * | `Z6MUDA`  | 22     | 60 h         | —                | CA-10: marcada SIN inventar causa  |
 * | `Z6VIVA`  | 22     | 11 h         | —                | el control: NO se marca            |
 *
 * Los tres llevan **el mismo precio dentro de la zona de compra 20–25**. No es comodidad:
 * es que el defecto vivía justo ahí. Con precio y con estado de zona distinto de `none`,
 * `/vigiladas` escondía el motivo (`watched-table.tsx:166`) y `/cartera` lo escondía
 * porque el P/L actual tenía número (`cartera/page.tsx:83`). Si las filas no estuvieran
 * en zona, esta guardia pasaría sin demostrar nada.
 */
export const ESCENARIO: FilaSembrada[] = [
  {
    ticker: 'Z6CUOTA',
    micCode: 'BMEX',
    name: 'Congelada Con Motivo SA',
    buyMin: '20',
    buyMax: '25',
    price: '22',
    escritaHaceHoras: HORAS_CONGELADA,
    failReason: 'cuota_agotada',
  },
  {
    ticker: 'Z6MUDA',
    micCode: 'BMEX',
    name: 'Congelada Sin Motivo SA',
    buyMin: '20',
    buyMax: '25',
    price: '22',
    escritaHaceHoras: HORAS_CONGELADA,
  },
  {
    ticker: 'Z6VIVA',
    micCode: 'BMEX',
    name: 'Refrescada Anoche SA',
    buyMin: '20',
    buyMax: '25',
    price: '22',
    escritaHaceHoras: HORAS_FRESCA,
  },
];

export async function entrar(page: Page, email: string): Promise<void> {
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

/** Entra, siembra el escenario y deja la sesión lista para abrir cualquiera de las dos. */
export async function prepararEscenario(page: Page, filas: FilaSembrada[] = ESCENARIO): Promise<void> {
  await entrar(page, CUENTA);
  await sembrarEscenario(CUENTA, filas);
}
