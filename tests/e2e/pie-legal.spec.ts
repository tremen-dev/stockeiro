import { test, expect, type Page } from '@playwright/test';

/**
 * SPEC-035 — el pie compartido, en el navegador.
 *
 *   CA-9  el descargo de no asesoramiento está en TODAS las páginas, con enlace al
 *         texto completo, que vive en /legal/terminos
 *   CA-10 el pie es el mismo con sesión y sin ella, y el anónimo no filtra nada
 *   CA-11 la marca: «Stockeiro, un proyecto de tremen.dev», con enlace
 *   CA-15 desde /login y /register se llega a lo legal ANTES de teclear nada
 *
 * El pie lo crea esta spec y lo amplían otras: SPEC-038 le añadirá la versión y
 * SPEC-039 el enlace de feedback. Lo que estos tests fijan es lo que no puede
 * perderse por el camino.
 */

const PWD = 'clave-secreta-123';

/** Páginas públicas: cualquiera las ve sin haber tecleado nada. */
const PUBLICAS = ['/login', '/register', '/forgot-password', '/legal', '/legal/terminos'];

/** Páginas de dentro: solo se ven con sesión. */
const AUTENTICADAS = ['/dashboard', '/vigiladas', '/avisos'];

const pie = (page: Page) => page.locator('footer.app-footer');

async function registrarYEntrar(page: Page, email: string) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

test.describe('CA-9: el descargo de no asesoramiento, donde se ve', () => {
  for (const ruta of PUBLICAS) {
    test(`${ruta} lleva el descargo en el pie`, async ({ page }) => {
      await page.goto(ruta);

      const texto = await pie(page).innerText();
      expect(texto).toMatch(/no\s+presta\s+asesoramiento\s+financiero/i);
      expect(texto).toMatch(/n[io]\s+recomienda\s+operaciones/i);
      // El descargo lleva su propio enlace al texto completo, que no está en el pie.
      await expect(
        pie(page).locator('[data-testid="descargo"] a[href^="/legal/terminos"]'),
      ).toHaveCount(1);
      await expect(pie(page).locator('a[href="/legal/terminos"]')).toHaveCount(1);
    });
  }

  test('también con sesión iniciada, en las páginas de dentro', async ({ page }) => {
    await registrarYEntrar(page, `pie-${Date.now()}@ejemplo.test`);

    for (const ruta of AUTENTICADAS) {
      await page.goto(ruta);
      expect(await pie(page).innerText(), `${ruta} sin descargo`).toMatch(
        /no\s+presta\s+asesoramiento\s+financiero/i,
      );
    }
  });

  test('/legal/terminos contiene el texto completo del descargo', async ({ page }) => {
    await page.goto('/legal/terminos');
    const bloque = await page.locator('[data-testid="no-asesoramiento"]').innerText();

    expect(bloque).toMatch(/no\s+presta\s+asesoramiento\s+financiero/i);
    // D-1: la app avisa, no opera.
    expect(bloque).toMatch(/avisa/i);
    expect(bloque).toMatch(/no\s+(ejecuta|opera)/i);
    // D-4: la app no calcula ni recomienda zonas — las pone el usuario.
    expect(bloque).toMatch(/no\s+calcula\s+ni\s+recomienda/i);
    expect(bloque).toMatch(/zonas/i);
  });
});

test.describe('CA-10: el mismo pie con sesión y sin ella, y el anónimo no filtra', () => {
  test('el pie anónimo ofrece las cuatro páginas legales', async ({ page }) => {
    await page.goto('/legal');

    for (const ruta of ['/legal/aviso-legal', '/legal/privacidad', '/legal/terminos']) {
      await expect(pie(page).locator(`a[href="${ruta}"]`)).toHaveCount(1);
    }
  });

  test('el pie autenticado ofrece las mismas', async ({ page }) => {
    await registrarYEntrar(page, `pie-auth-${Date.now()}@ejemplo.test`);
    await page.goto('/dashboard');

    for (const ruta of ['/legal/aviso-legal', '/legal/privacidad', '/legal/terminos']) {
      await expect(pie(page).locator(`a[href="${ruta}"]`)).toHaveCount(1);
    }
  });

  test('el pie anónimo no ofrece ni un enlace de la navegación autenticada', async ({ page }) => {
    await page.goto('/legal/privacidad');

    for (const ruta of ['/dashboard', '/cartera', '/vigiladas', '/avisos', '/cartera/importar']) {
      await expect(pie(page).locator(`a[href="${ruta}"]`)).toHaveCount(0);
    }
    // Ni la navegación de dentro, ni el botón de salir, ni rastro de nadie.
    await expect(page.locator('nav.app-nav')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toMatch(/cerrar sesi[oó]n/i);
  });

  test('el pie anónimo no enseña ningún dato de usuario', async ({ page }) => {
    const email = `pie-fuga-${Date.now()}@ejemplo.test`;
    await registrarYEntrar(page, email);
    await page.context().clearCookies();

    await page.goto('/legal');
    expect(await page.locator('body').innerText()).not.toContain(email);
  });
});

test.describe('CA-11: de quién es esto', () => {
  for (const ruta of [...PUBLICAS, '/legal/privacidad']) {
    test(`${ruta} dice «Stockeiro, un proyecto de tremen.dev»`, async ({ page }) => {
      await page.goto(ruta);

      expect(await pie(page).innerText()).toContain('Stockeiro, un proyecto de tremen.dev');
      await expect(pie(page).locator('a[href="https://tremen.dev"]')).toHaveCount(1);
      expect(await pie(page).locator('a[href="https://tremen.dev"]').innerText()).toBe(
        'tremen.dev',
      );
    });
  }

  test('también con sesión iniciada', async ({ page }) => {
    await registrarYEntrar(page, `pie-marca-${Date.now()}@ejemplo.test`);

    expect(await pie(page).innerText()).toContain('Stockeiro, un proyecto de tremen.dev');
    await expect(pie(page).locator('a[href="https://tremen.dev"]')).toHaveCount(1);
  });
});

test.describe('CA-15: se llega desde donde hace falta llegar', () => {
  for (const origen of ['/login', '/register']) {
    test(`desde ${origen} se lee la privacidad antes de teclear nada`, async ({ page }) => {
      await page.goto(origen);

      // Sin haber rellenado ni un campo: el camino existe desde el formulario.
      await pie(page).locator('a[href="/legal/privacidad"]').click();
      await page.waitForURL('**/legal/privacidad');

      expect(new URL(page.url()).pathname).toBe('/legal/privacidad');
      await expect(page.locator('main h1')).toBeVisible();
    });
  }

  test('desde /register también se alcanza el aviso legal y los términos', async ({ page }) => {
    await page.goto('/register');

    for (const ruta of ['/legal/aviso-legal', '/legal/terminos']) {
      await expect(pie(page).locator(`a[href="${ruta}"]`)).toHaveCount(1);
    }
  });
});
