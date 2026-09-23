import { test, expect } from '@playwright/test';
import { darseDeAlta, registrarYEntrar } from './alta';

const SHOTS = '_qa/SPEC-001';
const PWD = 'clave-secreta-123';

/**
 * e2e de SPEC-001 (RED-2): ejercita en navegador real los CA con dimensión
 * end-to-end que el gate no pudo observar a nivel unitario. Cada test guarda
 * captura como evidencia en _qa/SPEC-001/.
 */

/**
 * ⚠️ CA-1 y CA-2 RE-ENCUADRADOS por SPEC-066 CA-25 ptos. 1 y 2 (anotado en su ledger).
 *
 * - **Qué vigilaban antes**: que el alta creaba la cuenta, iniciaba sesión y llevaba al
 *   panel (CA-1), y que un correo repetido se rechazaba con «ya está registrado» (CA-2).
 * - **Qué vigilan ahora**: que el alta lleva al panel por el recorrido de SPEC-066 CA-23
 *   (alta → correo → activar → entrar) y que un correo repetido recibe EXACTAMENTE la misma
 *   pantalla que uno nuevo, sin decir que existe (SPEC-066 CA-9). Lo que se afirma después
 *   de entrar —el panel con el correo de la cuenta— no cambia.
 */
test('CA-1: registro crea cuenta, autentica y redirige al panel', async ({ page }) => {
  await registrarYEntrar(page, 'ca1@example.com', PWD);

  await expect(page.getByText('ca1@example.com')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ca1-registro-panel.png`, fullPage: true });
});

test('CA-2: registro con email ya existente responde lo mismo que uno nuevo (SPEC-066 CA-9)', async ({
  page,
}) => {
  // Alta inicial, completa.
  await registrarYEntrar(page, 'dup@example.com', PWD);
  await page.click('button:has-text("Cerrar sesión")');
  await page.waitForURL('**/login');

  // Segundo intento con el mismo email, y un alta de un correo que no existe.
  await darseDeAlta(page, 'dup@example.com', 'otra-clave-456');
  const repetido = await page.getByTestId('alta-enviada').innerText();
  await expect(page).toHaveURL(/\/register$/);
  await page.screenshot({ path: `${SHOTS}/ca2-email-duplicado.png`, fullPage: true });

  await darseDeAlta(page, 'dup-nuevo@example.com', PWD);
  const nuevo = await page.getByTestId('alta-enviada').innerText();

  expect(repetido).toBe(nuevo);
  expect(repetido).not.toMatch(/ya está registrado/i);
});

test('CA-3 + CA-7: login accede al panel; logout invalida la sesión', async ({ page }) => {
  // Preparar un usuario vía registro (recorrido de SPEC-066 CA-23) y salir.
  await registrarYEntrar(page, 'ca3@example.com', PWD);

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
