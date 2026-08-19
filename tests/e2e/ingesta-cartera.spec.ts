import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { ponerRol } from './roles';

// Flujo real ingesta -> cartera (SPEC-004, CA-4/CA-5). No se llama a Twelve Data:
// se SIEMBRA la cotización en la tabla `quotes` (lo que el refresco persistiría) y
// se verifica que la UI de cartera muestra el P/L actual real y el `asOf` (RN-12/D-2).
const DB_URL = 'postgres://postgres:postgres@localhost:54329/stockeiro_e2e';
const SHOTS = '_qa/SPEC-004';
const PWD = 'clave-secreta-123';

async function registrarYEntrar(page: Page, email: string) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  // SPEC-034 (F-SPEC-034-4): toda cuenta nueva nace `tester` y un tester NO ve Cartera.
  // Esta prueba la ejercita, así que DECLARA el rol que necesita en vez de heredarlo.
  await ponerRol(email, 'completo');
}

/** Simula la ingesta: upsert de la última cotización del ticker (como refreshQuotes). */
async function ingerirCotizacion(ticker: string, price: string, currency: string, asOf: string) {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    const [sym] = await sql`SELECT id FROM symbols WHERE ticker = ${ticker}`;
    await sql`
      INSERT INTO quotes (symbol_id, price, currency, as_of)
      VALUES (${sym.id}, ${price}, ${currency}, ${asOf})
      ON CONFLICT (symbol_id) DO UPDATE
        SET price = EXCLUDED.price, currency = EXCLUDED.currency, as_of = EXCLUDED.as_of, updated_at = now()
    `;
  } finally {
    await sql.end();
  }
}

test('SPEC-004: la cotización ingerida alimenta el P/L actual y muestra el asOf', async ({ page }) => {
  await registrarYEntrar(page, 'ingesta1@example.com');
  await page.goto('/cartera');

  // Compra 10 @ 100 (coste medio 100). Sin cotización aún, P/L actual "—".
  const compra = page.locator('form', { hasText: 'Registrar compra' });
  // SPEC-008: se elige la acción del buscador (E2E_FAKE_SYMBOL_SEARCH=1) en vez de teclear el ticker.
  await compra.locator('.symbol-search-input').fill('Santander');
  await compra.locator('.symbol-result', { hasText: 'SAN' }).first().click();
  await compra.locator('input[name="quantity"]').fill('10');
  await compra.locator('input[name="price"]').fill('100');
  await compra.locator('input[name="occurredOn"]').fill('2026-01-02');
  await compra.locator('button[type="submit"]').click();

  const fila = page.locator('tr', { hasText: 'SAN' });
  await expect(fila).toContainText('—'); // sin ingesta: P/L actual sin dato

  // Ingesta: último cierre no ajustado 110 con asOf 2026-07-13 (RN-12).
  await ingerirCotizacion('SAN', '110', 'EUR', '2026-07-13T00:00:00.000Z');
  await page.reload();

  // CA-4: P/L actual = (110-100)*10 = 100.00, ya no "—".
  await expect(fila).toContainText('100.00');
  await expect(page.locator('section.lede')).toContainText('100.00');
  // CA-5: el asOf de la cotización se muestra (D-2).
  await expect(page.locator('section.lede')).toContainText('cotizaciones a fecha 2026-07-13');

  await page.screenshot({ path: `${SHOTS}/ca4-ca5-ingesta-cartera.png`, fullPage: true });
});
