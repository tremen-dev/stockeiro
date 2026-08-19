import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { ponerRol } from './roles';

/**
 * SPEC-030 CA-16/CA-17 — el usuario escribe la coma decimal en el navegador y la app
 * la guarda. Es el caso que el humano reportó en producción el 2026-08-18 (`UPWK` con
 * zona `12,5`, respuesta «Datos inválidos.»), reproducido en el flujo real.
 */
const DB_URL = 'postgres://postgres:postgres@localhost:54329/stockeiro_e2e';
const SHOTS = '_qa/SPEC-030';
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

async function withSql<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/**
 * Cotización sembrada por SQL, como haría la ingesta. Se BORRA al terminar el test:
 * los símbolos son compartidos (ADR-002) y otros e2e dan por hecho que ese ticker no
 * tiene cotización, así que este spec no puede dejar poso en el catálogo común.
 */
const seedQuote = (ticker: string, price: string) =>
  withSql(async (sql) => {
    const [s] = await sql`SELECT id FROM symbols WHERE ticker = ${ticker}`;
    await sql`INSERT INTO quotes (symbol_id, price, currency, as_of)
      VALUES (${s.id}, ${price}, 'EUR', '2026-08-18T00:00:00.000Z')
      ON CONFLICT (symbol_id) DO UPDATE SET price = EXCLUDED.price, as_of = EXCLUDED.as_of`;
  });

const dropQuote = (ticker: string) =>
  withSql(async (sql) => {
    await sql`DELETE FROM quotes q USING symbols s
      WHERE q.symbol_id = s.id AND s.ticker = ${ticker}`;
  });

test('SPEC-030 CA-16: vigilar con la zona escrita en español (12,5 / 13,5)', async ({ page }) => {
  await registrarYEntrar(page, 'decimales1@example.com');
  await page.goto('/vigiladas');

  const form = page.locator('form', { hasText: 'Vigilar una acción' });
  await form.locator('.symbol-search-input').fill('Telefónica');
  await form.locator('.symbol-result', { hasText: 'TEF' }).first().click();
  await expect(form.locator('.symbol-chip-tk')).toContainText('TEF');

  // El caso reportado: coma decimal, no punto.
  await form.locator('input[name="buyMin"]').fill('12,5');
  await form.locator('input[name="buyMax"]').fill('13,5');
  await form.locator('button[type="submit"]').click();

  // Sin mensaje de error: «Datos inválidos.» ya no aparece.
  await expect(form.locator('.auth-error')).toHaveCount(0);

  const fila = page.locator('tr', { hasText: 'TEF' });
  await expect(fila).toBeVisible();
  await expect(fila).toContainText('12.5 – 13.5');
  await page.screenshot({ path: `${SHOTS}/ca16-vigilar-con-coma.png`, fullPage: true });

  try {
    // RN-11: el estado de zona se evalúa contra 12,5–13,5. Con 125–135 (que es lo que
    // daría el parser del import) un precio de 13 quedaría FUERA de zona.
    await seedQuote('TEF', '13');
    await page.reload();
    const conCotizacion = page.locator('tr', { hasText: 'TEF' });
    await expect(conCotizacion).toHaveClass(/zone-buy/);
    await expect(conCotizacion).toContainText('En zona de compra');
    await page.screenshot({ path: `${SHOTS}/ca16-zona-evaluada.png`, fullPage: true });
  } finally {
    await dropQuote('TEF');
  }
});

test('SPEC-030 CA-10: un valor ambiguo dice el campo, el valor y qué escribir', async ({
  page,
}) => {
  await registrarYEntrar(page, 'decimales2@example.com');
  await page.goto('/vigiladas');

  const form = page.locator('form', { hasText: 'Vigilar una acción' });
  await form.locator('.symbol-search-input').fill('Repsol');
  await form.locator('.symbol-result', { hasText: 'REP' }).first().click();
  await form.locator('input[name="buyMin"]').fill('1.234');
  await form.locator('input[name="buyMax"]').fill('20');
  await form.locator('button[type="submit"]').click();

  const error = form.locator('.auth-error');
  await expect(error).toBeVisible();
  await expect(error).not.toContainText('Datos inválidos');
  await expect(error).toContainText('Zona de compra (mínimo)');
  await expect(error).toContainText('1.234');
  await expect(error).toContainText('sin separador de miles');
  await page.screenshot({ path: `${SHOTS}/ca10-error-que-dice-que-escribir.png`, fullPage: true });
});

test('SPEC-030 CA-17: comprar con cantidad, precio y gastos en español', async ({ page }) => {
  await registrarYEntrar(page, 'decimales3@example.com');
  await page.goto('/cartera');

  const form = page.locator('form', { hasText: 'Registrar compra' });
  await form.locator('.symbol-search-input').fill('Microsoft');
  await form.locator('.symbol-result', { hasText: 'MSFT' }).first().click();
  await form.locator('input[name="quantity"]').fill('1,5');
  await form.locator('input[name="price"]').fill('12,5');
  await form.locator('input[name="gastos"]').fill('0,95');
  await form.locator('input[name="occurredOn"]').fill('2026-08-18');
  await form.locator('button[type="submit"]').click();

  await expect(form.locator('.auth-error')).toHaveCount(0);

  // RN-04: coste base 1,5 × 12,5 + 0,95 = 19,70 → coste medio 19,70 / 1,5 = 13,13.
  const fila = page.locator('tr', { hasText: 'MSFT' });
  await expect(fila).toBeVisible();
  await expect(fila).toContainText('1.5'); // cantidad viva
  await expect(fila).toContainText('13.13'); // coste medio
  await page.screenshot({ path: `${SHOTS}/ca17-comprar-con-coma.png`, fullPage: true });
});
