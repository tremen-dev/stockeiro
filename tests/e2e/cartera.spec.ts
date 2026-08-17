import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';

const SHOTS = '_qa/SPEC-002';
const SHOTS_025 = '_qa/SPEC-025';
const DB_URL = 'postgres://postgres:postgres@localhost:54329/stockeiro_e2e';
const PWD = 'clave-secreta-123';

interface CompraInput {
  ticker: string;
  quantity: string;
  price: string;
  gastos?: string;
  fecha: string;
}

async function registrarYEntrar(page: Page, email: string) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

async function comprar(page: Page, { ticker, quantity, price, gastos, fecha }: CompraInput) {
  const form = page.locator('form', { hasText: 'Registrar compra' });
  // SPEC-008: elegir la acción del buscador (E2E_FAKE_SYMBOL_SEARCH=1) en vez de teclearla.
  await form.locator('.symbol-search-input').fill(ticker);
  await form.locator('.symbol-result', { hasText: ticker }).first().click();
  await form.locator('input[name="quantity"]').fill(quantity);
  await form.locator('input[name="price"]').fill(price);
  if (gastos) await form.locator('input[name="gastos"]').fill(gastos);
  await form.locator('input[name="occurredOn"]').fill(fecha);
  await form.locator('button[type="submit"]').click();
}

test('SPEC-002: registrar compra muestra la posición con P/L actual "—"', async ({ page }) => {
  await registrarYEntrar(page, 'cartera1@example.com');
  await page.goto('/cartera');

  await comprar(page, { ticker: 'ITX', quantity: '10', price: '100', fecha: '2026-01-02' });

  const fila = page.locator('tr', { hasText: 'ITX' });
  await expect(fila).toBeVisible();
  await expect(fila).toContainText('10'); // cantidad viva
  await expect(fila).toContainText('100'); // coste medio
  // P/L actual "—" (sin ingesta): la fila muestra el guion largo
  await expect(fila).toContainText('—');
  await page.screenshot({ path: `${SHOTS}/ca1-ca6-compra-posicion.png`, fullPage: true });
});

test('SPEC-002: venta parcial actualiza el P/L realizado; sobreventa se rechaza', async ({ page }) => {
  await registrarYEntrar(page, 'cartera2@example.com');
  await page.goto('/cartera');
  await comprar(page, { ticker: 'AAPL', quantity: '10', price: '100', fecha: '2026-01-02' });

  // Venta parcial de 4 @ 120 → realizado (120-100)*4 = 80
  const venta = page.locator('form', { hasText: 'Registrar venta' });
  await venta.locator('input[name="ticker"]').fill('AAPL');
  await venta.locator('input[name="quantity"]').fill('4');
  await venta.locator('input[name="price"]').fill('120');
  await venta.locator('input[name="occurredOn"]').fill('2026-01-05');
  await venta.locator('button[type="submit"]').click();

  const fila = page.locator('tr', { hasText: 'AAPL' });
  await expect(fila).toContainText('6'); // cantidad viva restante
  await expect(fila).toContainText('80'); // P/L realizado
  await page.screenshot({ path: `${SHOTS}/ca4-venta-parcial.png`, fullPage: true });

  // Sobreventa: intentar vender 100 → error, sin cambiar la posición (CA-5)
  await venta.locator('input[name="ticker"]').fill('AAPL');
  await venta.locator('input[name="quantity"]').fill('100');
  await venta.locator('input[name="price"]').fill('120');
  await venta.locator('input[name="occurredOn"]').fill('2026-01-06');
  await venta.locator('button[type="submit"]').click();
  await expect(venta.locator('.auth-error')).toContainText('más de lo que tienes');
  await page.screenshot({ path: `${SHOTS}/ca5-sobreventa-rechazada.png`, fullPage: true });
});

// --- SPEC-025 CA-8: la UI deja elegir la posición y manda su identidad -------------
// El mismo ticker en dos mercados (ADR-012: SAN en BME y su ADR en NYSE) se siembra por
// SQL, igual que en tests/e2e/ingesta-cartera.spec.ts: el catálogo fake del buscador solo
// trae SAN@BMEX, y lo que este e2e verifica es la cadena
// portfolio-forms.tsx -> addSellAction -> recordSell, no cómo se llegó al estado.
async function sembrarDosMercados(email: string) {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    const [user] = await sql`SELECT id FROM users WHERE email = ${email}`;
    const [bmex] = await sql`
      INSERT INTO symbols (ticker, mic_code, exchange, name, currency)
      VALUES ('SAN', 'BMEX', 'BME', 'Banco Santander SA', 'EUR')
      ON CONFLICT (ticker, mic_code) DO UPDATE SET currency = EXCLUDED.currency
      RETURNING id`;
    const [xnys] = await sql`
      INSERT INTO symbols (ticker, mic_code, exchange, name, currency)
      VALUES ('SAN', 'XNYS', 'NYSE', 'Banco Santander SA ADR', 'USD')
      ON CONFLICT (ticker, mic_code) DO UPDATE SET currency = EXCLUDED.currency
      RETURNING id`;
    await sql`INSERT INTO transactions (user_id, symbol_id, type, occurred_on, quantity, price)
              VALUES (${user.id}, ${bmex.id}, 'buy', '2026-01-01', 100, 10)`;
    await sql`INSERT INTO transactions (user_id, symbol_id, type, occurred_on, quantity, price)
              VALUES (${user.id}, ${xnys.id}, 'buy', '2026-01-02', 100, 13)`;
    return { bmex: bmex.id as string, xnys: xnys.id as string };
  } finally {
    await sql.end();
  }
}

test('SPEC-025 CA-8: con el mismo ticker en dos mercados, la venta cae en la posición elegida', async ({
  page,
}) => {
  const email = 'cartera3@example.com';
  await registrarYEntrar(page, email);
  const ids = await sembrarDosMercados(email);
  await page.goto('/cartera');

  const venta = page.locator('form', { hasText: 'Registrar venta' });
  const selector = venta.locator('select[name="symbolId"]');
  await expect(selector).toBeVisible();

  // Las dos opciones son DISTINGUIBLES: ticker + mercado/divisa, no dos "SAN" iguales.
  const etiquetas = await selector.locator('option').allTextContents();
  expect(etiquetas).toHaveLength(2);
  expect(new Set(etiquetas).size).toBe(2);
  expect(etiquetas.some((l) => l.includes('SAN') && /NYSE|XNYS/.test(l) && l.includes('USD'))).toBe(true);
  expect(etiquetas.some((l) => l.includes('SAN') && /BME|BMEX/.test(l) && l.includes('EUR'))).toBe(true);
  await page.screenshot({ path: `${SHOTS_025}/ca8-selector-de-posicion.png`, fullPage: true });

  // Vende 50 de la posición de NUEVA YORK (13 USD): realizado (14 − 13) × 50 = 50,00.
  await selector.selectOption(ids.xnys);
  await venta.locator('input[name="quantity"]').fill('50');
  await venta.locator('input[name="price"]').fill('14');
  await venta.locator('input[name="occurredOn"]').fill('2026-02-01');
  await venta.locator('button[type="submit"]').click();

  await expect(venta.locator('.auth-error')).toHaveCount(0); // sin pantalla de error

  // Filas en orden de ledger: BMEX (2026-01-01) primero, XNYS (2026-01-02) después.
  const filas = page.locator('tbody tr');
  await expect(filas).toHaveCount(2);
  const bme = filas.nth(0);
  const ny = filas.nth(1);
  await expect(ny.locator('td').nth(2)).toHaveText('13.00'); // coste medio: es la de NYSE
  await expect(ny.locator('td').nth(1)).toHaveText('50'); // cantidad viva: 100 − 50
  await expect(ny.locator('td').nth(3)).toHaveText('50.00'); // P/L realizado
  await expect(bme.locator('td').nth(2)).toHaveText('10.00'); // coste medio: es la de BME
  await expect(bme.locator('td').nth(1)).toHaveText('100'); // NO se ha movido
  await expect(bme.locator('td').nth(3)).toHaveText('0.00');

  await page.screenshot({ path: `${SHOTS_025}/ca8-venta-en-la-posicion-elegida.png`, fullPage: true });
});
