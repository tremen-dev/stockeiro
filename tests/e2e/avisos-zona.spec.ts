import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';

// Render real de SPEC-007: color de fondo según estado de zona en /vigiladas, y bandeja
// /avisos con contador de no-leídos y marcar-leído. Se siembran cotizaciones/avisos por SQL
// (como haría la ingesta/notificación), sin llamar a APIs externas.
const DB_URL = 'postgres://postgres:postgres@localhost:54329/stockeiro_e2e';
const SHOTS = '_qa/SPEC-007';
const PWD = 'clave-secreta-123';

async function registrarYEntrar(page: Page, email: string) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

async function vigilar(page: Page, ticker: string, buyMin?: string, buyMax?: string) {
  const form = page.locator('form', { hasText: 'Vigilar una acción' });
  // SPEC-008: elegir del buscador (E2E_FAKE_SYMBOL_SEARCH=1) en vez de teclear el ticker.
  await form.locator('.symbol-search-input').fill(ticker);
  await form.locator('.symbol-result', { hasText: ticker }).first().click();
  if (buyMin) await form.locator('input[name="buyMin"]').fill(buyMin);
  if (buyMax) await form.locator('input[name="buyMax"]').fill(buyMax);
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('tr', { hasText: ticker })).toBeVisible();
}

async function withSql<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}
const seedQuote = (ticker: string, price: string) =>
  withSql(async (sql) => {
    const [s] = await sql`SELECT id FROM symbols WHERE ticker = ${ticker}`;
    await sql`INSERT INTO quotes (symbol_id, price, currency, as_of)
      VALUES (${s.id}, ${price}, 'EUR', '2026-07-13T00:00:00.000Z')
      ON CONFLICT (symbol_id) DO UPDATE SET price = EXCLUDED.price, as_of = EXCLUDED.as_of`;
  });
const seedDigest = (email: string, cycleRef: string, payload: string) =>
  withSql(async (sql) => {
    const [u] = await sql`SELECT id FROM users WHERE email = ${email}`;
    await sql`INSERT INTO notifications (user_id, kind, cycle_ref, payload, channel, status, as_of)
      VALUES (${u.id}, 'digest', ${cycleRef}, ${payload}, 'email', 'sent', '2026-07-13T00:00:00.000Z')`;
  });

test('SPEC-007: /vigiladas colorea la fila según el estado de zona', async ({ page }) => {
  await registrarYEntrar(page, 'zona1@example.com');
  await page.goto('/vigiladas');

  // Tickers EXCLUSIVOS de este spec (símbolos compartidos, ADR-002): no reutilizar
  // ITX/AAPL/SAN que otros e2e asumen sin cotización.
  await vigilar(page, 'REP', '20', '25'); // en zona con precio 22
  await vigilar(page, 'TEF', '10', '15'); // sin cotización -> neutro
  await seedQuote('REP', '22');
  await page.reload();

  // CA-1: REP en zona de compra -> fila con clase zone-buy y etiqueta de texto.
  const rep = page.locator('tr', { hasText: 'REP' });
  await expect(rep).toHaveClass(/zone-buy/);
  await expect(rep).toContainText('En zona de compra');
  await expect(rep).toContainText('2026-07-13'); // CA-4 asOf

  // CA-2: TEF sin cotización -> neutro.
  const tef = page.locator('tr', { hasText: 'TEF' });
  await expect(tef).toHaveClass(/zone-none/);
  await expect(tef).toContainText('Sin cotización');

  await page.screenshot({ path: `${SHOTS}/ca1-vigiladas-estado-zona.png`, fullPage: true });
});

test('SPEC-007: bandeja /avisos con contador de no-leídos y marcar-leído', async ({ page }) => {
  await registrarYEntrar(page, 'avisos1@example.com');
  await seedDigest('avisos1@example.com', 'c1', 'Permanencia en zona: ITX (compra)');
  await seedDigest('avisos1@example.com', 'c2', 'Permanencia en zona: AAPL (compra)');

  // CA-10: el contador de la nav muestra 2 sin leer.
  await page.goto('/dashboard');
  await expect(page.locator('.nav-count')).toHaveText('2');

  await page.goto('/avisos');
  await expect(page.locator('.notif-item.unread')).toHaveCount(2); // CA-6

  // CA-8: marcar uno como leído baja el contador a 1.
  await page.locator('.notif-item.unread').first().locator('button', { hasText: 'Marcar leído' }).click();
  await expect(page.locator('.nav-count')).toHaveText('1');
  await expect(page.locator('.notif-item.unread')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/ca8-avisos-marcar-leido.png`, fullPage: true });

  // CA-9: marcar todos -> contador desaparece (0) y estado "Todo al día".
  await page.locator('button', { hasText: 'Marcar todos como leídos' }).click();
  await expect(page.locator('.nav-count')).toHaveCount(0);
  await expect(page.locator('main')).toContainText('Todo al día');
});

test('SPEC-007: /avisos sin avisos muestra estado vacío', async ({ page }) => {
  await registrarYEntrar(page, 'vacio1@example.com');
  await page.goto('/avisos');
  await expect(page.locator('.empty')).toContainText('Aún no tienes avisos'); // CA-7
});
