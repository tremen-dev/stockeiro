import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';

const SHOTS = '_qa/SPEC-003';
const SHOTS_024 = '_qa/SPEC-024';
const DB_URL = 'postgres://postgres:postgres@localhost:54329/stockeiro_e2e';
const PWD = 'clave-secreta-123';

async function registrarYEntrar(page: Page, email: string) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

/**
 * SPEC-008: busca la acción por nombre y elige un candidato del desplegable (ya no
 * se teclea el ticker). Requiere el servidor con `E2E_FAKE_SYMBOL_SEARCH=1`.
 */
async function elegirAccion(form: ReturnType<Page['locator']>, query: string, ticker: string) {
  await form.locator('.symbol-search-input').fill(query);
  await form.locator('.symbol-result', { hasText: ticker }).first().click();
  await expect(form.locator('.symbol-chip-tk')).toContainText(ticker);
}

// TEMPORAL — SPEC-027 CA-10. Un `.only` olvidado: sin `--forbid-only` el e2e
// pasaria en verde habiendo ejecutado UN test de 27. Se revierte.
test.only('SPEC-003: vigilar un ticker con zonas aparece en la lista', async ({ page }) => {
  await registrarYEntrar(page, 'vig1@example.com');
  await page.goto('/vigiladas');

  const form = page.locator('form', { hasText: 'Vigilar una acción' });
  await elegirAccion(form, 'Inditex', 'ITX');
  await form.locator('input[name="buyMin"]').fill('20');
  await form.locator('input[name="buyMax"]').fill('25');
  await form.locator('input[name="sellMin"]').fill('35');
  await form.locator('input[name="sellMax"]').fill('40');
  await form.locator('button[type="submit"]').click();

  const fila = page.locator('tr', { hasText: 'ITX' });
  await expect(fila).toBeVisible();
  await expect(fila).toContainText('20 – 25'); // zona de compra
  await expect(fila).toContainText('35 – 40'); // zona de venta
  await page.screenshot({ path: `${SHOTS}/ca2-vigilar-con-zonas.png`, fullPage: true });
});

// --- SPEC-024: el botón "Quitar" ---------------------------------------------------
// Se siembra por SQL (episodios de zona, avisos y un segundo mercado del mismo ticker),
// igual que en tests/e2e/avisos-zona.spec.ts: son estados que produce el ciclo/el buscador,
// no la UI, y este e2e verifica el flujo real de borrado, no cómo se llegó al estado.
async function withSql<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/** Pone la vigilada de `ticker` EN ZONA: cotización dentro, episodio abierto y su aviso. */
const seedEnZonaConAviso = (email: string, ticker: string, price: string) =>
  withSql(async (sql) => {
    const [u] = await sql`SELECT id FROM users WHERE email = ${email}`;
    const [w] = await sql`SELECT w.id AS watched_id, s.id AS symbol_id
      FROM watched_symbols w JOIN symbols s ON s.id = w.symbol_id
      WHERE w.user_id = ${u.id} AND s.ticker = ${ticker}`;
    await sql`INSERT INTO quotes (symbol_id, price, currency, as_of)
      VALUES (${w.symbol_id}, ${price}, 'EUR', '2026-07-13T00:00:00.000Z')
      ON CONFLICT (symbol_id) DO UPDATE SET price = EXCLUDED.price, as_of = EXCLUDED.as_of`;
    const [t] = await sql`INSERT INTO zone_triggers
      (user_id, watched_symbol_id, symbol_id, zone_kind, price, as_of)
      VALUES (${u.id}, ${w.watched_id}, ${w.symbol_id}, 'buy', ${price}, '2026-07-13T00:00:00.000Z')
      RETURNING id`;
    await sql`INSERT INTO notifications
      (user_id, kind, zone_trigger_id, payload, channel, status, as_of)
      VALUES (${u.id}, 'entry', ${t.id}, ${`${ticker} en zona de compra @ ${price}`},
              'email', 'sent', '2026-07-13T00:00:00.000Z')`;
  });

/** Dos vigiladas del MISMO ticker en mercados distintos (ADR-007), con zonas distintas. */
const seedDosMercados = (
  email: string,
  ticker: string,
  a: { mic: string; buyMin: string; buyMax: string },
  b: { mic: string; buyMin: string; buyMax: string },
) =>
  withSql(async (sql) => {
    const [u] = await sql`SELECT id FROM users WHERE email = ${email}`;
    for (const m of [a, b]) {
      const [s] = await sql`INSERT INTO symbols (ticker, mic_code, exchange, name, currency)
        VALUES (${ticker}, ${m.mic}, ${m.mic}, ${ticker}, 'EUR')
        ON CONFLICT (ticker, mic_code) DO UPDATE SET currency = EXCLUDED.currency
        RETURNING id`;
      await sql`INSERT INTO watched_symbols (user_id, symbol_id, buy_min, buy_max)
        VALUES (${u.id}, ${s.id}, ${m.buyMin}, ${m.buyMax})`;
    }
  });

test('SPEC-024 CA-7: quitar una vigilada EN ZONA funciona y no pierde los avisos', async ({ page }) => {
  await registrarYEntrar(page, 'quitar1@example.com');
  await page.goto('/vigiladas');

  // Ticker EXCLUSIVO de este test (símbolos compartidos, ADR-002).
  const form = page.locator('form', { hasText: 'Vigilar una acción' });
  await elegirAccion(form, 'Microsoft', 'MSFT');
  await form.locator('input[name="buyMin"]').fill('10');
  await form.locator('input[name="buyMax"]').fill('15');
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('tr', { hasText: 'MSFT' })).toBeVisible();

  // La acción está en zona AHORA y ya generó su aviso (lo que hoy rompe el borrado).
  await seedEnZonaConAviso('quitar1@example.com', 'MSFT', '12');
  await page.reload();
  const fila = page.locator('tr', { hasText: 'MSFT' });
  await expect(fila).toHaveClass(/zone-buy/);
  await page.screenshot({ path: `${SHOTS_024}/ca7-antes-de-quitar.png`, fullPage: true });

  await fila.locator('button', { hasText: 'Quitar' }).click();

  // Vuelve a /vigiladas SIN pantalla de error y sin la fila (CE-F1). Se espera un marcador
  // POSITIVO del estado final —la lista vacía— porque la página de error 500 de Next
  // ("This page couldn't load" + digest opaco) también cumple "ya no está la fila": una
  // aserción en negativo pasaría con el bug delante.
  await expect(page.locator('.empty-title')).toContainText('Aún no vigilas ninguna acción');
  await expect(page).toHaveURL(/\/vigiladas$/);
  await expect(page.locator('h1')).toHaveText('Acciones vigiladas');
  await expect(page.locator('body')).not.toContainText("This page couldn't load");
  await expect(page.locator('tr', { hasText: 'MSFT' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS_024}/ca7-despues-de-quitar.png`, fullPage: true });

  // El aviso sobrevive a la baja (RN-15, ADR-017).
  await page.goto('/avisos');
  await expect(page.locator('main')).toContainText('MSFT en zona de compra');
  await page.screenshot({ path: `${SHOTS_024}/ca7-avisos-conservados.png`, fullPage: true });
});

test('SPEC-024 CA-13: con dos mercados del mismo ticker se quita la fila señalada', async ({ page }) => {
  await registrarYEntrar(page, 'quitar2@example.com');
  // BBVA en dos mercados: mismo ticker, símbolos distintos (ADR-007/ADR-012).
  await seedDosMercados(
    'quitar2@example.com',
    'BBVA',
    { mic: 'BMEX', buyMin: '10', buyMax: '15' },
    { mic: 'XNYS', buyMin: '60', buyMax: '65' },
  );

  await page.goto('/vigiladas');
  await expect(page.locator('tr', { hasText: 'BBVA' })).toHaveCount(2);
  await page.screenshot({ path: `${SHOTS_024}/ca13-dos-mercados.png`, fullPage: true });

  // Se quita la SEGUNDA (zona 60 – 65): la que el `limit(1)` por ticker NO resolvería.
  const nyse = page.locator('tr', { hasText: '60 – 65' });
  await nyse.locator('button', { hasText: 'Quitar' }).click();

  // Estado final esperado: UNA fila de BBVA. Antes del clic hay 2 y en la página de error
  // 500 hay 0, así que esperar exactamente 1 distingue los tres casos sin depender del
  // tiempo de navegación.
  await expect(page.locator('tr', { hasText: 'BBVA' })).toHaveCount(1);
  await expect(page.locator('h1')).toHaveText('Acciones vigiladas');
  await expect(page.locator('body')).not.toContainText("This page couldn't load");
  await expect(page.locator('tr', { hasText: '60 – 65' })).toHaveCount(0);
  await expect(page.locator('tr', { hasText: '10 – 15' })).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS_024}/ca13-queda-la-otra.png`, fullPage: true });
});

test('SPEC-003: rango inválido (min > max) se rechaza con error', async ({ page }) => {
  await registrarYEntrar(page, 'vig2@example.com');
  await page.goto('/vigiladas');

  const form = page.locator('form', { hasText: 'Vigilar una acción' });
  await elegirAccion(form, 'Apple', 'AAPL');
  await form.locator('input[name="buyMin"]').fill('30');
  await form.locator('input[name="buyMax"]').fill('10'); // min > max
  await form.locator('button[type="submit"]').click();

  await expect(form.locator('.auth-error')).toContainText('mínimo no puede ser mayor');
  await expect(page.locator('tr', { hasText: 'AAPL' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ca3-rango-invalido.png`, fullPage: true });
});
