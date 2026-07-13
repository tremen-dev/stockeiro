import { test, expect } from '@playwright/test';

const SHOTS = '_qa/SPEC-001';
const PWD = 'clave-secreta-123';

/**
 * e2e de SPEC-001 (RED-2): ejercita en navegador real los CA con dimensión
 * end-to-end que el gate no pudo observar a nivel unitario. Cada test guarda
 * captura como evidencia en _qa/SPEC-001/.
 */

test('CA-1: registro crea cuenta, autentica y redirige al panel', async ({ page }) => {
  await page.goto('/register');
  await page.fill('input[name="email"]', 'ca1@example.com');
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');

  await page.waitForURL('**/dashboard');
  await expect(page.getByText('ca1@example.com')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ca1-registro-panel.png`, fullPage: true });
});

test('CA-2: registro con email ya existente se rechaza con error claro', async ({ page }) => {
  // Alta inicial.
  await page.goto('/register');
  await page.fill('input[name="email"]', 'dup@example.com');
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  await page.click('button:has-text("Cerrar sesión")');
  await page.waitForURL('**/login');

  // Segundo intento con el mismo email.
  await page.goto('/register');
  await page.fill('input[name="email"]', 'dup@example.com');
  await page.fill('input[name="password"]', 'otra-clave-456');
  await page.click('button[type="submit"]');

  await expect(page.locator('.auth-error')).toContainText('ya está registrado');
  await expect(page).toHaveURL(/\/register$/);
  await page.screenshot({ path: `${SHOTS}/ca2-email-duplicado.png`, fullPage: true });
});

test('CA-3 + CA-7: login accede al panel; logout invalida la sesión', async ({ page }) => {
  // Preparar un usuario vía registro y salir.
  await page.goto('/register');
  await page.fill('input[name="email"]', 'ca3@example.com');
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  // CA-7: cerrar sesión.
  await page.click('button:has-text("Cerrar sesión")');
  await page.waitForURL('**/login');
  await page.screenshot({ path: `${SHOTS}/ca7-logout.png`, fullPage: true });

  // CA-7: sesión invalidada → ruta protegida vuelve a exigir login.
  await page.goto('/dashboard');
  await page.waitForURL('**/login');

  // CA-3: login con credenciales válidas → panel.
  await page.fill('input[name="email"]', 'ca3@example.com');
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  await expect(page.getByText('ca3@example.com')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ca3-login-panel.png`, fullPage: true });
});

test('CA-4: login inválido muestra error genérico (no revela si el email existe)', async ({ page }) => {
  await page.goto('/login');
  await page.fill('input[name="email"]', 'noexiste@example.com');
  await page.fill('input[name="password"]', 'lo-que-sea');
  await page.click('button[type="submit"]');

  await expect(page.locator('.auth-error')).toContainText('Email o contraseña incorrectos');
  await page.screenshot({ path: `${SHOTS}/ca4-login-invalido.png`, fullPage: true });
});
