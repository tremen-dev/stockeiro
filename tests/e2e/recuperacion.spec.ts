import { test, expect, type Browser, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { ponerRol } from './roles';

const SHOTS = '_qa/SPEC-023';
const OUTBOX = './.e2e-outbox.jsonl'; // mismo path que tests/e2e/server.mjs
const PWD = 'clave-secreta-123';
const NUEVA = 'clave-nueva-789';

/**
 * e2e de SPEC-023: el flujo real de recuperación en navegador, contra Postgres
 * efímero. El correo NUNCA sale a Resend: el sender del e2e lo vuelca en un buzón
 * en disco (ADR-006, tras el mismo puerto) y aquí se lee el enlace, igual que haría
 * el usuario abriendo su bandeja de entrada.
 *
 * CA-13 se verifica con DOS CONTEXTOS DE NAVEGADOR, que es el único nivel donde se
 * puede observar que la sesión abierta en "otro navegador" deja de valer.
 */

interface OutboxMessage {
  to: string;
  subject: string;
  body: string;
}

function outbox(): OutboxMessage[] {
  if (!existsSync(OUTBOX)) return [];
  return readFileSync(OUTBOX, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as OutboxMessage);
}

/** Espera al correo (el envío es diferido, CA-2) y devuelve el enlace recibido. */
async function waitForResetLink(recipient: string, since = 0): Promise<string> {
  await expect
    .poll(() => outbox().filter((m) => m.to === recipient).length, { timeout: 15_000 })
    .toBeGreaterThan(since);
  const mine = outbox().filter((m) => m.to === recipient);
  const link = mine[mine.length - 1].body.match(/https?:\/\/\S*\/reset-password\/\S+/);
  expect(link, 'el correo debe llevar el enlace de recuperación').not.toBeNull();
  return link![0];
}

const countTo = (recipient: string) => outbox().filter((m) => m.to === recipient).length;

async function registrar(page: Page, email: string, password = PWD) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

async function pedirEnlace(page: Page, email: string) {
  await page.goto('/forgot-password');
  await page.fill('input[name="email"]', email);
  await page.click('button[type="submit"]');
}

async function entrar(page: Page, email: string, password: string) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
}

async function nuevaSesion(browser: Browser) {
  const ctx = await browser.newContext();
  return { ctx, page: await ctx.newPage() };
}

test('CA-15: las rutas de recuperación son públicas y las de datos siguen protegidas', async ({
  page,
}) => {
  await page.goto('/forgot-password');
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.locator('input[name="email"]')).toBeVisible();

  await page.goto('/reset-password/token-inventado-sin-sesion');
  await expect(page).toHaveURL(/\/reset-password\//); // no rebota a login
  await expect(page.getByText('Este enlace no es válido')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ca15-rutas-publicas.png`, fullPage: true });

  for (const ruta of ['/dashboard', '/cartera', '/vigiladas', '/avisos']) {
    await page.goto(ruta);
    await page.waitForURL('**/login');
  }
});

test('CA-1: la respuesta es la misma con cuenta y sin cuenta, y sin cuenta no hay correo', async ({
  page,
}) => {
  await registrar(page, 'ca1-reset@example.com');
  await page.click('button:has-text("Cerrar sesión")');
  await page.waitForURL('**/login');

  await pedirEnlace(page, 'ca1-reset@example.com');
  const conCuenta = (await page.locator('.auth-note').textContent())!.trim();
  await page.screenshot({ path: `${SHOTS}/ca1-acuse-con-cuenta.png`, fullPage: true });

  const inexistente = 'nadie-jamas@example.com';
  await pedirEnlace(page, inexistente);
  const sinCuenta = (await page.locator('.auth-note').textContent())!.trim();
  await page.screenshot({ path: `${SHOTS}/ca1-acuse-sin-cuenta.png`, fullPage: true });

  expect(sinCuenta).toBe(conCuenta); // exactamente el mismo mensaje genérico
  await expect(page).toHaveURL(/\/forgot-password$/); // y el mismo desenlace

  await waitForResetLink('ca1-reset@example.com'); // la cuenta real sí recibe
  await page.waitForTimeout(1500);
  expect(countTo(inexistente)).toBe(0); // la inexistente, nunca
});

test('CA-3 + CA-6 + CA-14: el enlace del correo cambia la contraseña y devuelve a login', async ({
  page,
}) => {
  const email = 'ca6-reset@example.com';
  await registrar(page, email);
  await page.click('button:has-text("Cerrar sesión")');
  await page.waitForURL('**/login');

  await pedirEnlace(page, email);
  const link = await waitForResetLink(email);
  expect(new URL(link).origin).toBe('http://localhost:3200'); // CA-4: origen de config

  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Crea tu contraseña nueva' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ca6-pantalla-nueva-clave.png`, fullPage: true });

  await page.fill('input[name="password"]', NUEVA);
  await page.click('button[type="submit"]');

  // CA-14: sin auto-login. Aterriza en /login con la confirmación.
  await page.waitForURL('**/login?reset=1');
  await expect(page.locator('.auth-note-ok')).toContainText('Contraseña actualizada');
  await page.screenshot({ path: `${SHOTS}/ca14-confirmacion-en-login.png`, fullPage: true });
  await page.goto('/dashboard');
  await page.waitForURL('**/login'); // no hay sesión emitida por la ruta pública

  // CA-6: la anterior ya no vale...
  await entrar(page, email, PWD);
  await expect(page.locator('.auth-error')).toContainText('Email o contraseña incorrectos');

  // ...y la nueva sí, con acceso normal a sus datos (CA-14).
  await entrar(page, email, NUEVA);
  await page.waitForURL('**/dashboard');
  await expect(page.getByText(email)).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ca6-entra-con-la-nueva.png`, fullPage: true });
});

test('CA-10 + CA-7 + CA-9: abrir no gasta el enlace; usarlo dos veces sí', async ({ page }) => {
  const email = 'ca10-reset@example.com';
  await registrar(page, email);
  await page.click('button:has-text("Cerrar sesión")');
  await page.waitForURL('**/login');

  await pedirEnlace(page, email);
  const link = await waitForResetLink(email);

  // CA-10: tres visitas (antivirus de correo, vista previa, el usuario) y sigue vivo.
  for (let i = 0; i < 3; i++) {
    await page.goto(link);
    await expect(page.getByRole('heading', { name: 'Crea tu contraseña nueva' })).toBeVisible();
  }
  await page.screenshot({ path: `${SHOTS}/ca10-abrir-no-gasta.png`, fullPage: true });

  await page.fill('input[name="password"]', NUEVA);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/login?reset=1');

  // CA-7 / CA-9: reusarlo da el mensaje genérico y no cambia nada.
  await page.goto(link);
  await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible();
  await expect(page.getByText('Puede que ya se haya usado o que haya caducado')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ca7-enlace-ya-usado.png`, fullPage: true });

  // CA-9: un enlace que nunca existió da EXACTAMENTE lo mismo.
  const usado = (await page.locator('.auth-note').textContent())!.trim();
  await page.goto('/reset-password/este-token-no-existio-jamas');
  const inexistente = (await page.locator('.auth-note').textContent())!.trim();
  expect(inexistente).toBe(usado);
});

test('CA-11: pedir un enlace nuevo mata al anterior', async ({ page }) => {
  const email = 'ca11-reset@example.com';
  await registrar(page, email);
  await page.click('button:has-text("Cerrar sesión")');
  await page.waitForURL('**/login');

  await pedirEnlace(page, email);
  const primero = await waitForResetLink(email, 0);
  await pedirEnlace(page, email);
  const segundo = await waitForResetLink(email, 1);
  expect(segundo).not.toBe(primero);

  await page.goto(primero);
  await expect(page.getByRole('heading', { name: 'Enlace no válido' })).toBeVisible();

  await page.goto(segundo);
  await expect(page.getByRole('heading', { name: 'Crea tu contraseña nueva' })).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ca11-solo-el-ultimo-vale.png`, fullPage: true });
});

test('CA-13: la sesión abierta en otro navegador deja de valer tras el reset', async ({
  browser,
}) => {
  const email = 'ca13-reset@example.com';

  // Navegador A: el usuario (o el intruso) tiene sesión abierta.
  const a = await nuevaSesion(browser);
  await registrar(a.page, email);
  // SPEC-034 (F-SPEC-034-4): esta prueba usa /cartera como "ruta con datos"; el rol se
  // declara aquí para que siga midiendo la ÉPOCA DE CREDENCIAL y no la visibilidad.
  await ponerRol(email, 'completo');
  await a.page.goto('/cartera');
  await expect(a.page).toHaveURL(/\/cartera$/);
  await a.page.screenshot({ path: `${SHOTS}/ca13-a-antes-con-sesion.png`, fullPage: true });

  // Navegador B: recuperación completa, con su propio contexto y sus propias cookies.
  const b = await nuevaSesion(browser);
  await pedirEnlace(b.page, email);
  const link = await waitForResetLink(email);
  await b.page.goto(link);
  await b.page.fill('input[name="password"]', NUEVA);
  await b.page.click('button[type="submit"]');
  await b.page.waitForURL('**/login?reset=1');

  // La sesión de A ya no autentica: cualquier ruta protegida la manda a login...
  await a.page.goto('/cartera');
  await a.page.waitForURL('**/login');
  await a.page.screenshot({ path: `${SHOTS}/ca13-a-expulsado.png`, fullPage: true });

  // ...y no le sirve ni un dato (RN-01, RN-03).
  for (const ruta of ['/dashboard', '/vigiladas', '/avisos']) {
    await a.page.goto(ruta);
    await a.page.waitForURL('**/login');
    await expect(a.page.getByText(email)).toHaveCount(0);
  }

  // Y la sesión nueva, con la contraseña nueva, sí vale (CA-14).
  await entrar(b.page, email, NUEVA);
  await b.page.waitForURL('**/dashboard');
  await expect(b.page.getByText(email)).toBeVisible();
  await b.page.screenshot({ path: `${SHOTS}/ca13-b-sesion-nueva-vale.png`, fullPage: true });

  await a.ctx.close();
  await b.ctx.close();
});

test('ADR-015 pto. 9: la página del enlace no envía Referer', async ({ page }) => {
  const res = await page.goto('/reset-password/cualquier-cosa');
  expect(res?.headers()['referrer-policy']).toBe('no-referrer');
});
