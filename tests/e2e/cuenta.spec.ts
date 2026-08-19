import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { ponerRol, rolDe, type Rol } from './roles';

/**
 * SPEC-036 — borrar mi cuenta, contra la app corriendo de verdad.
 *
 *   CA-1  la pantalla existe, exige sesión y se alcanza desde la navegación
 *   CA-2  se dice qué desaparece y qué no, y que no hay vuelta atrás
 *   CA-3  sin la contraseña actual no se borra nada y la sesión sigue viva
 *   CA-9  las sesiones del borrado mueren en todas partes, al instante
 *   CA-10 se aterriza en una página pública, con confirmación y sin cookie
 *   CA-11 una cuenta admin no ve el botón y la acción se rechaza igual
 *   CA-13 degradarse primero SÍ permite irse
 *   CA-14 la política de privacidad enlaza aquí, y el enlace lleva aquí
 *
 * Lo que se prueba aquí es lo que solo se ve con un navegador delante: la sesión,
 * la cookie, el rebote y el enlace. El borrado en sí —qué filas caen y cuáles no—
 * se prueba contra Postgres en `tests/account-deletion.test.ts`.
 */

const SHOTS = '_qa/SPEC-036';
const PWD = 'clave-secreta-123';
const MALA = 'clave-equivocada-999';

const nav = (page: Page) => page.locator('nav.app-nav');
const zona = (page: Page) => page.locator('[data-testid="zona-de-borrado"]');

async function registrarYEntrar(page: Page, email: string) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

/** Entra con una cuenta ya existente, en el contexto que se le pase. */
async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

async function borrar(page: Page, password: string) {
  await page.goto('/cuenta');
  await page.fill('[data-testid="borrado-password"]', password);
  await page.click('[data-testid="confirmar-borrado"]');
}

// ---------------------------------------------------------------------------
// CA-1 — la pantalla existe, exige sesión y se alcanza sin teclear la URL
// ---------------------------------------------------------------------------

test.describe('CA-1: /cuenta exige sesión y se alcanza desde la navegación', () => {
  test('sin sesión, /cuenta manda a /login y no sirve ni un dato', async ({ page }) => {
    await page.goto('/cuenta');

    await page.waitForURL('**/login');
    expect(new URL(page.url()).pathname).toBe('/login');
    await expect(page.locator('[data-testid="zona-de-borrado"]')).toHaveCount(0);
  });

  for (const rol of ['tester', 'completo', 'admin'] as const) {
    test(`un ${rol} la ve, y llega desde el menú sin teclear la URL`, async ({ page }) => {
      const email = `spec036-ca1-${rol}@example.com`;
      await registrarYEntrar(page, email);
      if (rol !== 'tester') {
        expect(await ponerRol(email, rol)).toBe(rol);
        await page.reload();
      }

      // El camino visible: un enlace en la navegación, en cualquiera de los tres roles.
      const enlace = nav(page).locator('a[href="/cuenta"]');
      await expect(enlace, `un ${rol} no tiene camino a /cuenta desde el menú`).toHaveCount(1);
      await expect(enlace).toBeVisible();

      await enlace.click();

      await page.waitForURL('**/cuenta');
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('main')).toContainText(email);
      await page.screenshot({ path: `${SHOTS}/ca1-cuenta-${rol}.png`, fullPage: true });
    });
  }

  test('el enlace del menú está en TODAS las páginas de dentro, no solo en una', async ({
    page,
  }) => {
    await registrarYEntrar(page, 'spec036-ca1-menu@example.com');

    for (const ruta of ['/dashboard', '/vigiladas', '/avisos', '/cuenta']) {
      await page.goto(ruta);
      await expect(nav(page).locator('a[href="/cuenta"]'), `${ruta} sin acceso a la cuenta`).toHaveCount(
        1,
      );
    }
  });
});

// ---------------------------------------------------------------------------
// CA-2 — qué desaparece, qué no, y que no hay vuelta atrás
// ---------------------------------------------------------------------------

test.describe('CA-2: se dice qué desaparece antes de pulsar', () => {
  test('enumera lo que se borra, lo que no, y declara que es irreversible', async ({ page }) => {
    await registrarYEntrar(page, 'spec036-ca2@example.com');
    await page.goto('/cuenta');

    const texto = await zona(page).innerText();

    // Qué SE BORRA: las cinco familias que CA-2 nombra.
    const seBorra = await page.locator('[data-testid="que-se-borra"]').innerText();
    expect(seBorra, 'la cuenta').toMatch(/cuenta/i);
    expect(seBorra, 'las operaciones').toMatch(/operacion/i);
    expect(seBorra, 'las acciones vigiladas y sus zonas').toMatch(/vigilad/i);
    expect(seBorra, 'las zonas').toMatch(/zona/i);
    expect(seBorra, 'los avisos').toMatch(/aviso/i);
    expect(seBorra, 'las equivalencias del import').toMatch(/equivalencia|import/i);

    // Qué NO: lo compartido, y por qué no es suyo.
    const noSeBorra = await page.locator('[data-testid="que-no-se-borra"]').innerText();
    expect(noSeBorra).toMatch(/cotizacion|cotizaci[oó]n/i);
    expect(noSeBorra).toMatch(/valores|s[ií]mbolo/i);
    expect(noSeBorra).toMatch(/compartid/i);

    // Irreversible y sin copia, dicho con esas palabras (ADR-022 pto. 10).
    expect(texto).toMatch(/irreversible|no\s+se\s+puede\s+deshacer|no\s+hay\s+vuelta\s+atr[aá]s/i);
    expect(texto).toMatch(/no\s+hay\s+copia|sin\s+copia|no\s+hay\s+papelera/i);

    await page.screenshot({ path: `${SHOTS}/ca2-que-desaparece.png`, fullPage: true });
  });

  test('el aviso está ANTES del botón, no debajo', async ({ page }) => {
    await registrarYEntrar(page, 'spec036-ca2-orden@example.com');
    await page.goto('/cuenta');

    const cajas = await page.evaluate(() => {
      const y = (sel: string) => document.querySelector(sel)?.getBoundingClientRect().top ?? -1;
      return {
        listas: y('[data-testid="que-se-borra"]'),
        boton: y('[data-testid="confirmar-borrado"]'),
      };
    });

    expect(cajas.listas).toBeGreaterThan(0);
    expect(
      cajas.boton,
      'el botón aparece por encima de lo que hay que leer antes de pulsarlo',
    ).toBeGreaterThan(cajas.listas);
  });
});

// ---------------------------------------------------------------------------
// CA-3 — sin la contraseña actual no se borra nada
// ---------------------------------------------------------------------------

test.describe('CA-3: la contraseña incorrecta no borra nada y no cierra la sesión', () => {
  test('se muestra un error, la sesión sigue viva y la cuenta sigue ahí', async ({ page }) => {
    const email = 'spec036-ca3@example.com';
    await registrarYEntrar(page, email);

    await borrar(page, MALA);

    await expect(page.locator('[data-testid="error-borrado"]')).toBeVisible();
    expect(new URL(page.url()).pathname).toBe('/cuenta');
    await page.screenshot({ path: `${SHOTS}/ca3-password-incorrecta.png`, fullPage: true });

    // La sesión SIGUE viva: se navega a una página de datos y no rebota a login.
    await page.goto('/vigiladas');
    expect(new URL(page.url()).pathname).toBe('/vigiladas');

    // Y la cuenta sigue existiendo, con su rol.
    expect(await rolDe(email)).toBe('tester');
  });

  test('con la contraseña correcta, en cambio, se va', async ({ page }) => {
    const email = 'spec036-ca3-correcta@example.com';
    await registrarYEntrar(page, email);

    await borrar(page, PWD);

    await page.waitForURL('**/cuenta-borrada');
    expect(await rolDe(email)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// CA-10 — dónde se aterriza
// ---------------------------------------------------------------------------

test.describe('CA-10: se aterriza en una página pública, con confirmación', () => {
  test('la confirmación se pinta entera, sin error de Next y sin cookie de sesión', async ({
    page,
    context,
  }) => {
    await registrarYEntrar(page, 'spec036-ca10@example.com');

    await borrar(page, PWD);
    await page.waitForURL('**/cuenta-borrada');

    // Página pública, servida entera.
    expect(new URL(page.url()).pathname).toBe('/cuenta-borrada');
    await expect(page.locator('[data-testid="cuenta-borrada"]')).toBeVisible();
    await expect(page.locator('main h1')).toBeVisible();
    const texto = await page.locator('main').innerText();
    expect(texto).toMatch(/borrad/i);
    // Ni un error de Next, ni una pantalla autenticada a medio pintar.
    expect(texto).not.toMatch(/application error|unhandled|500|Internal Server Error/i);
    await expect(nav(page)).toHaveCount(0);

    // Ni una cookie de sesión válida.
    const sesion = (await context.cookies()).filter((c) =>
      /^(__Secure-)?authjs\.session-token/.test(c.name),
    );
    expect(
      sesion.filter((c) => c.value !== ''),
      'queda una cookie de sesión con valor tras borrar la cuenta',
    ).toEqual([]);

    await page.screenshot({ path: `${SHOTS}/ca10-cuenta-borrada.png`, fullPage: true });
  });

  test('la confirmación se lee sin sesión ninguna, tecleando la URL', async ({ page }) => {
    const respuesta = await page.goto('/cuenta-borrada');

    expect(respuesta?.status()).toBe(200);
    expect(new URL(page.url()).pathname).toBe('/cuenta-borrada');
    await expect(page.locator('[data-testid="cuenta-borrada"]')).toBeVisible();
  });

  test('y desde ella se puede volver a registrarse con el mismo email (CA-8 por la UI)', async ({
    page,
  }) => {
    const email = 'spec036-ca10-vuelve@example.com';
    await registrarYEntrar(page, email);
    await borrar(page, PWD);
    await page.waitForURL('**/cuenta-borrada');

    await page.click('[data-testid="cuenta-borrada"] a[href="/register"]');
    await page.waitForURL('**/register');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', 'otra-clave-distinta-1');
    await page.click('button[type="submit"]');

    await page.waitForURL('**/dashboard');
    expect(await rolDe(email)).toBe('tester');
    // La cuenta nueva no hereda nada: el contador de avisos no leídos ni existe.
    await expect(nav(page).locator('.nav-count')).toHaveCount(0);
  });
});

// ---------------------------------------------------------------------------
// CA-9 — las sesiones mueren en todas partes, al instante
// ---------------------------------------------------------------------------

test('CA-9: la otra sesión, en otro navegador, deja de autenticar en su siguiente petición', async ({
  browser,
}) => {
  const email = 'spec036-ca9-dos-sesiones@example.com';

  const uno: BrowserContext = await browser.newContext();
  const dos: BrowserContext = await browser.newContext();
  try {
    const pUno = await uno.newPage();
    const pDos = await dos.newPage();

    await registrarYEntrar(pUno, email);
    await entrar(pDos, email);

    // Las dos autentican ANTES del borrado: si no, el test de después no prueba nada.
    await pDos.goto('/vigiladas');
    expect(new URL(pDos.url()).pathname).toBe('/vigiladas');

    await borrar(pUno, PWD);
    await pUno.waitForURL('**/cuenta-borrada');

    // La segunda, con su cookie intacta, en su SIGUIENTE petición.
    await pDos.goto('/avisos');
    await pDos.waitForURL('**/login');
    expect(new URL(pDos.url()).pathname).toBe('/login');
    expect(await pDos.locator('body').innerText()).not.toContain(email);

    // Y no se le sirve ni un dato en ninguna otra sección.
    for (const ruta of ['/dashboard', '/vigiladas', '/cuenta']) {
      await pDos.goto(ruta);
      expect(new URL(pDos.url()).pathname, `${ruta} siguió sirviendo con la cuenta borrada`).toBe(
        '/login',
      );
    }

    await pDos.screenshot({ path: `${SHOTS}/ca9-segunda-sesion-en-login.png`, fullPage: true });
  } finally {
    await uno.close();
    await dos.close();
  }
});

// ---------------------------------------------------------------------------
// CA-11 / CA-13 — la regla del `admin`, en la pantalla
// ---------------------------------------------------------------------------

test.describe('CA-11: una cuenta admin no se borra desde la app', () => {
  test('no se le ofrece el borrado, y se le explica por qué y cómo proceder', async ({ page }) => {
    const email = 'spec036-ca11-admin@example.com';
    await registrarYEntrar(page, email);
    await ponerRol(email, 'admin');
    await page.goto('/cuenta');

    await expect(page.locator('[data-testid="confirmar-borrado"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="borrado-password"]')).toHaveCount(0);

    const explicacion = page.locator('[data-testid="borrado-no-disponible"]');
    await expect(explicacion).toBeVisible();
    const texto = await explicacion.innerText();
    expect(texto, 'no dice qué rol lo impide').toMatch(/operador|admin/i);
    expect(texto, 'no dice cómo proceder: degradarse primero').toMatch(/degrad|dejar de ser/i);

    await page.screenshot({ path: `${SHOTS}/ca11-admin-sin-boton.png`, fullPage: true });
  });

  test('y la acción se rechaza aunque se invoque de verdad, con la contraseña buena', async ({
    page,
  }) => {
    const email = 'spec036-ca11-directa@example.com';
    await registrarYEntrar(page, email);

    // La pantalla se pide siendo `tester`, así que el formulario ESTÁ en el DOM y su
    // POST es una server action legítima, con su cookie y su envoltorio. Entonces la
    // cuenta se promueve a `admin` por debajo y se envía. Es la invocación directa que
    // CA-11 exige: el botón ya no debería estar, pero está, y aun así no borra nada.
    await page.goto('/cuenta');
    await expect(page.locator('[data-testid="confirmar-borrado"]')).toBeVisible();
    await page.fill('[data-testid="borrado-password"]', PWD);

    expect(await ponerRol(email, 'admin')).toBe('admin');

    await page.click('[data-testid="confirmar-borrado"]');

    const error = page.locator('[data-testid="error-borrado"]');
    await expect(error, 'la acción no rechazó al admin: ocultar el botón no basta').toBeVisible();
    expect(await error.innerText()).toMatch(/operador|admin/i);
    expect(new URL(page.url()).pathname).toBe('/cuenta');
    expect(await rolDe(email), 'el admin se borró invocando la acción directamente').toBe('admin');

    await page.screenshot({ path: `${SHOTS}/ca11-accion-rechazada.png`, fullPage: true });
  });
});

test('CA-13: degradarse primero SÍ permite irse', async ({ page }) => {
  const email = 'spec036-ca13@example.com';
  await registrarYEntrar(page, email);
  await ponerRol(email, 'admin');

  await page.goto('/cuenta');
  await expect(page.locator('[data-testid="confirmar-borrado"]')).toHaveCount(0);

  // El UPDATE que hoy hace el operador a mano (F-ADR-021-1). El rol se lee en cada
  // petición (ADR-021 pto. 4), así que basta con volver: misma cookie, sin relogin.
  await ponerRol(email, 'completo' as Rol);
  await page.goto('/cuenta');

  await expect(page.locator('[data-testid="confirmar-borrado"]')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ca13-degradado-ya-puede.png`, fullPage: true });

  await borrar(page, PWD);
  await page.waitForURL('**/cuenta-borrada');
  expect(await rolDe(email)).toBeNull();
});

// ---------------------------------------------------------------------------
// CA-14 — la política de privacidad enlaza aquí
// ---------------------------------------------------------------------------

test.describe('CA-14: el derecho de supresión, ahora clicable', () => {
  test('la privacidad tiene un enlace navegable a /cuenta', async ({ page }) => {
    await page.goto('/legal/privacidad');

    const enlace = page.locator('[data-testid="derechos"] a[href="/cuenta"]');
    await expect(enlace, 'SPEC-035 enuncia el derecho; este CA es el que lo hace clicable').toHaveCount(
      1,
    );
    await expect(enlace).toBeVisible();
  });

  test('y ese enlace lleva a la pantalla de esta spec', async ({ page }) => {
    await registrarYEntrar(page, 'spec036-ca14@example.com');

    await page.goto('/legal/privacidad');
    await page.click('[data-testid="derechos"] a[href="/cuenta"]');

    await page.waitForURL('**/cuenta');
    await expect(zona(page)).toBeVisible();
    await page.screenshot({ path: `${SHOTS}/ca14-desde-privacidad.png`, fullPage: true });
  });

  test('sin sesión, el enlace sigue siendo verdad: lleva a la pantalla, pasando por login', async ({
    page,
  }) => {
    await page.goto('/legal/privacidad');
    await page.click('[data-testid="derechos"] a[href="/cuenta"]');

    // RN-03 no se relaja por venir de una página legal: se pide sesión, no un 404.
    await page.waitForURL('**/login');
    expect(new URL(page.url()).pathname).toBe('/login');
  });
});
