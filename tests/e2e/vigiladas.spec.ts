import { test, expect, type Page } from '@playwright/test';

const SHOTS = '_qa/SPEC-003';
const PWD = 'clave-secreta-123';

async function registrarYEntrar(page: Page, email: string) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

test('SPEC-003: vigilar un ticker con zonas aparece en la lista', async ({ page }) => {
  await registrarYEntrar(page, 'vig1@example.com');
  await page.goto('/vigiladas');

  const form = page.locator('form', { hasText: 'Vigilar una acción' });
  await form.locator('input[name="ticker"]').fill('ITX');
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

test('SPEC-003: rango inválido (min > max) se rechaza con error', async ({ page }) => {
  await registrarYEntrar(page, 'vig2@example.com');
  await page.goto('/vigiladas');

  const form = page.locator('form', { hasText: 'Vigilar una acción' });
  await form.locator('input[name="ticker"]').fill('AAPL');
  await form.locator('input[name="buyMin"]').fill('30');
  await form.locator('input[name="buyMax"]').fill('10'); // min > max
  await form.locator('button[type="submit"]').click();

  await expect(form.locator('.auth-error')).toContainText('mínimo no puede ser mayor');
  await expect(page.locator('tr', { hasText: 'AAPL' })).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ca3-rango-invalido.png`, fullPage: true });
});
