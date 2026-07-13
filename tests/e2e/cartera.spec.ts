import { test, expect, type Page } from '@playwright/test';

const SHOTS = '_qa/SPEC-002';
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
  await form.locator('input[name="ticker"]').fill(ticker);
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
