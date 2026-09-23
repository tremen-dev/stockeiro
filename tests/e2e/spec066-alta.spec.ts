import { test, expect, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';
import postgres from 'postgres';
import { DB_URL } from './roles';
import {
  PWD,
  activarDesdeElBuzon,
  darseDeAlta,
  enlaceDeActivacion,
  entrarConContrasena,
  esperarTiempoMinimo,
  registrarYEntrar,
} from './alta';
import { BOTID_PATH_PREFIX } from '../../src/lib/auth/guard';
import { HONEYPOT_FIELD } from '../../src/lib/registration/activation-rules';
import { CUENTA_PENDIENTE } from '../../src/lib/registration/signup-messages';

/**
 * SPEC-066 en el navegador, contra `next start` y Postgres efímero:
 *   CA-2  el campo trampa no lo ve, no lo alcanza y no lo rellena un humano
 *   CA-5  fuera de Vercel el cliente de BotID no pide nada
 *   CA-7  las cabeceras y `/api/version` del build servido
 *   CA-13 abrir el enlace no activa; pulsar sí, y no inicia sesión
 *   CA-16 `/register/reenviar` es accesible sin sesión
 *   CA-17 y CA-23 el recorrido entero, y la cuenta pendiente en `/login`
 *
 * Capturas en `_qa/SPEC-066/`.
 */

const SHOTS = '_qa/SPEC-066';

async function verificadaEn(email: string): Promise<Date | null | undefined> {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    const [u] = await sql`SELECT email_verified_at FROM users WHERE email = ${email}`;
    return u ? (u.email_verified_at as Date | null) : undefined;
  } finally {
    await sql.end();
  }
}

/** El `name` del control que tiene el foco ahora mismo. */
const enfocado = (page: Page) =>
  page.evaluate(() => (document.activeElement as HTMLInputElement | null)?.getAttribute('name') ?? document.activeElement?.tagName ?? '');

test.describe('SPEC-066 CA-2: el campo trampa no lo ve, no lo alcanza y no lo rellena un humano', () => {
  test('no es visible, no está en el árbol de accesibilidad y no se autocompleta', async ({ page }) => {
    await page.goto('/register');
    const trampa = page.locator(`input[name="${HONEYPOT_FIELD}"]`);
    await expect(trampa).toHaveCount(1); // existe: si no, lo de abajo no probaría nada
    await expect(trampa).toBeHidden();
    await expect(trampa).toHaveAttribute('autocomplete', 'off');
    await expect(trampa).toHaveAttribute('tabindex', '-1');
    // Fuera del árbol de accesibilidad: ninguna consulta por rol lo encuentra.
    await expect(page.getByRole('textbox', { name: /vac[ií]o/i })).toHaveCount(0);
    const nombres = await page.getByRole('textbox').evaluateAll((els) =>
      els.map((e) => e.getAttribute('name')),
    );
    expect(nombres).not.toContain(HONEYPOT_FIELD);
    await page.screenshot({ path: `${SHOTS}/ca2-formulario-alta.png`, fullPage: true });
  });

  test('recorrer el formulario con el tabulador, del primero al último control, nunca lo enfoca', async ({
    page,
  }) => {
    await page.goto('/register');
    await page.locator('input[name="email"]').focus();
    const recorrido = [await enfocado(page)];
    for (let i = 0; i < 6 && recorrido[recorrido.length - 1] !== 'BUTTON'; i++) {
      await page.keyboard.press('Tab');
      recorrido.push(await enfocado(page));
    }
    expect(recorrido[0]).toBe('email');
    expect(recorrido).toContain('password');
    expect(recorrido[recorrido.length - 1]).toBe('BUTTON');
    expect(recorrido).not.toContain(HONEYPOT_FIELD);
  });

  test('un alta hecha SÓLO con teclado llega a la respuesta neutra y CREA la cuenta', async ({ page }) => {
    const email = 'spec066-teclado@example.com';
    await page.goto('/register');
    const pintado = Date.now();
    await page.locator('input[name="email"]').focus();
    await page.keyboard.type(email);
    await page.keyboard.press('Tab');
    await page.keyboard.type(PWD);
    await esperarTiempoMinimo(page, pintado);
    await page.keyboard.press('Enter');

    await expect(page.getByTestId('alta-enviada')).toBeVisible();
    await expect.poll(() => verificadaEn(email)).toBeNull(); // existe, y pendiente
    await page.screenshot({ path: `${SHOTS}/ca2-alta-con-teclado.png`, fullPage: true });
  });
});

test('SPEC-066 CA-5: fuera de Vercel, ninguna petición al prefijo de BotID en un alta completa', async ({
  page,
}) => {
  const aBotId: string[] = [];
  page.on('request', (r) => {
    if (new URL(r.url()).pathname.startsWith(BOTID_PATH_PREFIX)) aBotId.push(r.url());
  });
  await registrarYEntrar(page, 'spec066-sin-botid@example.com');
  expect(aBotId).toEqual([]);
});

test.describe('SPEC-066 CA-7: el build servido conserva lo que tenía', () => {
  test('Referrer-Policy: no-referrer en /reset-password/<token> y en /register/confirmar/<token>', async ({
    request,
  }) => {
    for (const ruta of ['/reset-password/token-de-muestra', '/register/confirmar/token-de-muestra']) {
      const res = await request.get(ruta);
      expect(res.status(), ruta).toBe(200);
      expect(res.headers()['referrer-policy'], ruta).toBe('no-referrer');
    }
  });

  test('/api/version sigue con su contrato, y con la versión de package.json', async ({ request }) => {
    const body = await (await request.get('/api/version')).json();
    expect(Object.keys(body).sort()).toEqual(['builtAt', 'commit', 'environment', 'version']);
    const { version } = JSON.parse(readFileSync('package.json', 'utf8')) as { version: string };
    expect(body.version).toBe(version);
  });
});

test.describe('SPEC-066 CA-13: abrir el enlace no activa; pulsar sí, y no inicia sesión', () => {
  test('GET varias veces: botón visible y la cuenta sigue pendiente; noindex', async ({ page }) => {
    const email = 'spec066-abrir@example.com';
    await darseDeAlta(page, email);
    await page.screenshot({ path: `${SHOTS}/ca23-respuesta-neutra.png`, fullPage: true });
    const enlace = await enlaceDeActivacion(email);

    for (let i = 0; i < 3; i++) {
      await page.goto(enlace);
      await expect(page.getByRole('button', { name: 'Activar mi cuenta' })).toBeVisible();
    }
    expect(await verificadaEn(email)).toBeNull();
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
    await page.screenshot({ path: `${SHOTS}/ca13-pagina-activar.png`, fullPage: true });
  });

  test('pulsar activa, lleva a /login con el aviso y NO hay sesión hasta entrar', async ({ page, context }) => {
    const email = 'spec066-pulsar@example.com';
    await darseDeAlta(page, email);
    await activarDesdeElBuzon(page, email);

    await expect(page.getByTestId('cuenta-activada')).toBeVisible();
    expect(await verificadaEn(email)).not.toBeNull();
    const sesion = (await context.cookies()).filter((c) => /authjs\.session-token/.test(c.name));
    expect(sesion).toEqual([]);
    await page.screenshot({ path: `${SHOTS}/ca13-login-cuenta-activada.png`, fullPage: true });

    await page.goto('/dashboard');
    await page.waitForURL('**/login');

    // Usado: el mismo enlace ya no sirve.
    await page.goto(await enlaceDeActivacion(email));
    await expect(page.getByTestId('activacion-no-valida')).toBeVisible();
  });
});

test('SPEC-066 CA-16: /register/reenviar es accesible sin sesión y responde el acuse', async ({ page }) => {
  await page.goto('/register/reenviar');
  await expect(page).toHaveURL(/\/register\/reenviar$/);
  await page.fill('input[name="email"]', 'spec066-nadie@example.com');
  await page.click('button[type="submit"]');
  await expect(page.getByTestId('reenvio-enviado')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ca16-reenvio.png`, fullPage: true });
});

test('SPEC-066 CA-23 + CA-17: el recorrido completo, y la pendiente en /login antes de activar', async ({
  page,
}) => {
  const email = 'spec066-recorrido@example.com';
  await darseDeAlta(page, email);

  // Antes de activar: con su contraseña, no entra y se le dice qué falta.
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  const aviso = page.getByTestId('cuenta-pendiente');
  await expect(aviso).toContainText(CUENTA_PENDIENTE);
  await expect(aviso.locator('a[href="/register/reenviar"]')).toHaveCount(1);
  await expect(page).toHaveURL(/\/login$/);
  await page.screenshot({ path: `${SHOTS}/ca17-login-pendiente.png`, fullPage: true });

  // Con una contraseña mala, el genérico de siempre.
  await page.fill('input[name="password"]', 'no-es-esta');
  await page.click('button[type="submit"]');
  await expect(page.locator('.auth-error')).toContainText('Email o contraseña incorrectos');

  await activarDesdeElBuzon(page, email);
  await entrarConContrasena(page, email);
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.screenshot({ path: `${SHOTS}/ca23-panel-tras-activar.png`, fullPage: true });
});
