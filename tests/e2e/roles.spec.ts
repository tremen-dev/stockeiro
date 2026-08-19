import { test, expect, type BrowserContext, type Page } from '@playwright/test';
import { decode } from 'next-auth/jwt';
import { ponerRol, rolDe } from './roles';

/**
 * SPEC-034 — Rol por usuario y visibilidad de sección, en el navegador.
 *
 * Cubre la mitad que solo se puede ver corriendo la app de verdad:
 *   CA-5  el menú enseña exactamente lo que el rol permite
 *   CA-6  la URL tecleada no llega, y no sirve ni un dato
 *   CA-8  rebotar no es fallar: se explica en una línea, y solo tras el rebote
 *   CA-9  el panel del tester no ofrece lo que no puede abrir
 *   CA-10 degradar y promover surten efecto sin volver a iniciar sesión
 *   CA-14 lo que el tester sí tiene, funciona entero
 */

const SHOTS = '_qa/SPEC-034';
const PWD = 'clave-secreta-123';

async function registrarYEntrar(page: Page, email: string) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

const nav = (page: Page) => page.locator('nav.app-nav');

/** El mismo secreto que arranca la app en tests/e2e/server.mjs. */
const AUTH_SECRET = 'e2e-secret-please-change-0123456789';
const SESSION_COOKIE = 'authjs.session-token';

/** El JWT de sesión REAL, decodificado. Es lo que de verdad viaja en la cookie. */
async function tokenDeSesion(context: BrowserContext): Promise<Record<string, unknown>> {
  const cookie = (await context.cookies()).find((c) => c.name === SESSION_COOKIE);
  expect(cookie, 'no hay cookie de sesión').toBeDefined();
  const payload = await decode({
    token: cookie!.value,
    secret: AUTH_SECRET,
    salt: SESSION_COOKIE,
  });
  expect(payload, 'el token de sesión no se pudo decodificar').toBeTruthy();
  return payload as Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// CA-3 (en el navegador) + CA-5 + CA-9
// ---------------------------------------------------------------------------

test('SPEC-034 CA-3/CA-5/CA-9: quien se registra nace tester, y ni el menú ni el panel le ofrecen Cartera', async ({
  page,
}) => {
  const email = 'spec034-tester@example.com';
  await registrarYEntrar(page, email);

  // CA-3: el registro real, por la UI, crea la cuenta como tester.
  expect(await rolDe(email)).toBe('tester');

  // CA-5: ni el href ni el texto. Las dos cosas, porque quitar solo una deja media puerta.
  await expect(nav(page).locator('a[href="/cartera"]')).toHaveCount(0);
  await expect(nav(page).locator('a[href="/cartera/importar"]')).toHaveCount(0);
  await expect(nav(page)).not.toContainText('Cartera');
  await expect(nav(page)).not.toContainText('Importar');

  // ...y sí está lo suyo, con el contador de no leídos intacto (SPEC-007 CA-10).
  await expect(nav(page).locator('a[href="/dashboard"]').filter({ hasText: 'Panel' })).toHaveCount(1);
  await expect(nav(page).locator('a[href="/vigiladas"]')).toHaveCount(1);
  await expect(nav(page).locator('a[href="/avisos"]')).toHaveCount(1);

  // CA-9: el panel no enlaza a una puerta cerrada. Quedan Vigiladas y Avisos, enteras.
  const tarjetas = page.locator('.cards .card');
  await expect(tarjetas).toHaveCount(2);
  await expect(page.locator('main')).not.toContainText('Cartera y P/L');
  await expect(page.locator('main a[href="/cartera"]')).toHaveCount(0);
  await expect(tarjetas.nth(0)).toContainText('Acciones vigiladas');
  await expect(tarjetas.nth(1)).toContainText('Avisos');

  await page.screenshot({ path: `${SHOTS}/ca5-ca9-panel-y-menu-de-tester.png`, fullPage: true });
});

test('SPEC-034 CA-5/CA-9: un completo y un admin ven las cuatro secciones y las tres tarjetas', async ({
  page,
}) => {
  for (const [email, rol] of [
    ['spec034-completo@example.com', 'completo'],
    ['spec034-admin@example.com', 'admin'],
  ] as const) {
    await registrarYEntrar(page, email);
    await ponerRol(email, rol);
    await page.goto('/dashboard');

    await expect(nav(page).locator('a[href="/cartera"]'), rol).toHaveCount(1);
    await expect(nav(page), rol).toContainText('Cartera');
    await expect(page.locator('.cards .card'), rol).toHaveCount(3);
    await expect(page.locator('main'), rol).toContainText('Cartera y P/L');

    /*
      RE-ENCUADRE DE SPEC-037 (documentado también en su ledger).

      Lo que esta guardia vigilaba ANTES: que la navegación tuviera **0** enlaces a
      `/admin` para todos los roles, `admin` incluido — porque la ruta todavía no
      existía y un enlace roto es peor que ninguno. Era "que nadie lo adelante aquí".

      Lo que vigila AHORA: la MISMA propiedad por el lado que corresponde desde que
      la ruta existe — que el enlace lo decida el catálogo de CA-4 y no una condición
      aparte, es decir, que un `completo` **siga sin verlo** y un `admin` sí. La
      propiedad de SPEC-034 que importaba (el menú no ofrece lo que la ruta niega) no
      se afloja: se comprueba en los dos sentidos en vez de en uno.

      Que `/admin` responda de verdad, y que quien no es admin no la alcance aunque
      teclee la URL, es de SPEC-037 y vive en `tests/e2e/admin-grifo.spec.ts` (CA-10/CA-24).
      Es el mismo movimiento que se hizo con el enlace a `/cuenta` entre SPEC-035 y
      SPEC-036.
    */
    await expect(nav(page).locator('a[href="/admin"]'), rol).toHaveCount(rol === 'admin' ? 1 : 0);

    await page.screenshot({ path: `${SHOTS}/ca5-ca9-panel-de-${rol}.png`, fullPage: true });
    await page.click('button:has-text("Cerrar sesión")');
    await page.waitForURL('**/login');
  }
});

// ---------------------------------------------------------------------------
// CA-6 + CA-8
// ---------------------------------------------------------------------------

test('SPEC-034 CA-6/CA-8: un tester que teclea /cartera y /cartera/importar acaba en el panel, con la nota y sin un solo dato', async ({
  page,
}) => {
  const email = 'spec034-url@example.com';
  await registrarYEntrar(page, email);

  for (const [ruta, seccion] of [
    ['/cartera', 'Cartera'],
    ['/cartera/importar', 'Importar'],
  ] as const) {
    await page.goto(ruta);

    // CA-6: acaba en el panel...
    await expect(page).toHaveURL(/\/dashboard/);

    // ...y no se le ha servido NI UN DATO de esas páginas: ni encabezado ni tabla.
    const cuerpo = (await page.locator('body').innerText()).toLowerCase();
    for (const rastro of [
      'tu cartera',
      'registrar compra',
      'registrar venta',
      'importar extracto',
      'p/l realizado',
      'coste medio',
      'sube el extracto',
    ]) {
      expect(cuerpo, `la respuesta final contiene "${rastro}" (${ruta})`).not.toContain(rastro);
    }
    await expect(page.locator('table')).toHaveCount(0);
    await expect(page.locator('form input[name="quantity"]')).toHaveCount(0);

    // CA-8: y lee POR QUÉ. No hay error de Next, no hay 404, no hay redirección muda.
    const nota = page.getByTestId('nota-sin-acceso');
    await expect(nota).toBeVisible();
    await expect(nota).toContainText(seccion);
    await expect(nota).toContainText('no está disponible en la versión de pruebas');
    await expect(page.locator('body')).not.toContainText('404');
    await expect(page.locator('body')).not.toContainText('This page could not be found');

    await page.screenshot({ path: `${SHOTS}/ca6-ca8-rebote-desde-${seccion.toLowerCase()}.png`, fullPage: true });
  }

  // CA-8: la nota aparece SOLO tras el rebote, no en cada visita al panel.
  await page.goto('/dashboard');
  await expect(page.getByTestId('nota-sin-acceso')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ca8-panel-limpio-sin-rebote.png`, fullPage: true });
});

test('SPEC-034 CA-8: un valor inventado en la URL no pinta ninguna nota', async ({ page }) => {
  // El parámetro lo escribe cualquiera; se valida contra el catálogo o sería un hueco
  // para meter texto ajeno dentro de la app.
  await registrarYEntrar(page, 'spec034-nota-falsa@example.com');
  await page.goto('/dashboard?sin-acceso=tu-banco-te-pide-la-clave');
  await expect(page.getByTestId('nota-sin-acceso')).toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('tu-banco-te-pide-la-clave');
});

// ---------------------------------------------------------------------------
// CA-10
// ---------------------------------------------------------------------------

test('SPEC-034 CA-10: degradar y promover surten efecto en la petición siguiente, con la misma cookie', async ({
  page,
  context,
}) => {
  const email = 'spec034-vaiven@example.com';
  await registrarYEntrar(page, email);
  await ponerRol(email, 'completo');

  // Identidad de la sesión al empezar. NO se compara la cookie byte a byte: Auth.js
  // rota el JWT en cada respuesta (ADR-016 pto. 5 lo nombra), así que el valor cambia
  // aunque nadie haya vuelto a autenticarse. Lo que tiene que quedar igual es lo que
  // el token AFIRMA: quién eres y de qué época es tu credencial.
  const alPrincipio = await tokenDeSesion(context);

  // Está viendo /cartera como un completo cualquiera.
  await page.goto('/cartera');
  await expect(page).toHaveURL(/\/cartera$/);
  await expect(nav(page).locator('a[href="/cartera"]')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/ca10-completo-dentro-de-cartera.png`, fullPage: true });

  // DEGRADAR: en la base pasa a tester. Sin cerrar sesión, sin tocar el navegador.
  await ponerRol(email, 'tester');
  await page.goto('/cartera');
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(nav(page).locator('a[href="/cartera"]')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ca10-degradado-fuera-en-el-clic-siguiente.png`, fullPage: true });

  // PROMOVER: vuelve a completo y en su siguiente petición ya entra.
  await ponerRol(email, 'completo');
  await page.goto('/cartera');
  await expect(page).toHaveURL(/\/cartera$/);
  await expect(nav(page).locator('a[href="/cartera"]')).toHaveCount(1);

  // La tercera transición: completo -> admin -> completo. Sobre el catálogo, sin la
  // ruta de operación (que es SPEC-037): lo observable es que no pierde nada.
  await ponerRol(email, 'admin');
  await page.goto('/cartera');
  await expect(page).toHaveURL(/\/cartera$/);
  await expect(nav(page).locator('a[href="/cartera"]')).toHaveCount(1);
  await ponerRol(email, 'completo');
  await page.goto('/cartera');
  await expect(page).toHaveURL(/\/cartera$/);

  // Y todo esto SIN volver a iniciar sesión: la sesión sigue siendo la misma (mismo
  // `id`, misma época de credencial) y en ningún momento se ha pasado por /login.
  const alFinal = await tokenDeSesion(context);
  expect(alFinal.id).toBe(alPrincipio.id);
  expect(alFinal.credentialEpoch).toBe(alPrincipio.credentialEpoch);

  // CA-11 sobre el token REAL emitido en el login: cuatro cambios de rol después,
  // el rol sigue sin viajar en él — ni por nombre ni por valor (ADR-021 pto. 2).
  expect(Object.keys(alFinal)).not.toContain('role');
  const serializado = JSON.stringify(alFinal);
  for (const valor of ['tester', 'completo', 'admin']) {
    expect(serializado, `el JWT lleva el valor "${valor}"`).not.toContain(valor);
  }
  expect(alFinal.id).toBeTruthy();
  expect(alFinal.credentialEpoch).toBeTruthy();
  await page.screenshot({ path: `${SHOTS}/ca10-promovido-de-vuelta.png`, fullPage: true });
});

// ---------------------------------------------------------------------------
// CA-14
// ---------------------------------------------------------------------------

test('SPEC-034 CA-14: con rol tester, Vigiladas y Avisos funcionan enteros', async ({ page }) => {
  const email = 'spec034-capacidades@example.com';
  await registrarYEntrar(page, email);
  expect(await rolDe(email)).toBe('tester');

  // --- Vigiladas: añadir con zonas (SPEC-003) -------------------------------------
  await page.goto('/vigiladas');
  const form = page.locator('form', { hasText: 'Vigilar una acción' });
  await form.locator('.symbol-search-input').fill('Repsol');
  await form.locator('.symbol-result', { hasText: 'REP' }).first().click();
  await form.locator('input[name="buyMin"]').fill('20');
  await form.locator('input[name="buyMax"]').fill('25');
  await form.locator('input[name="sellMin"]').fill('35');
  await form.locator('input[name="sellMax"]').fill('40');
  await form.locator('button[type="submit"]').click();

  const fila = page.locator('tr', { hasText: 'REP' });
  await expect(fila).toBeVisible();
  await expect(fila).toContainText('20 – 25');
  await expect(fila).toContainText('35 – 40');

  // --- Estado de zona y asOf (SPEC-007/SPEC-029) ----------------------------------
  await sembrarCotizacionYAviso(email, 'REP', '22');
  await page.reload();
  const enZona = page.locator('tr', { hasText: 'REP' });
  await expect(enZona).toHaveClass(/zone-buy/);
  await expect(enZona).toContainText('En zona de compra');
  await expect(enZona).toContainText('2026-07-13'); // asOf (D-2)
  await page.screenshot({ path: `${SHOTS}/ca14-tester-vigiladas-en-zona.png`, fullPage: true });

  // --- Avisos: leer y marcar leído (SPEC-007) -------------------------------------
  await expect(nav(page).locator('.nav-count')).toHaveText('1');
  await page.goto('/avisos');
  await expect(page.locator('.notif-item.unread')).toHaveCount(1);
  await page
    .locator('.notif-item.unread')
    .first()
    .locator('button', { hasText: 'Marcar leído' })
    .click();
  await expect(nav(page).locator('.nav-count')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ca14-tester-avisos-marcados.png`, fullPage: true });

  // --- Quitar de vigiladas, estando EN ZONA (SPEC-024) ----------------------------
  await page.goto('/vigiladas');
  await page.locator('tr', { hasText: 'REP' }).locator('button', { hasText: 'Quitar' }).click();
  await expect(page.locator('tr', { hasText: 'REP' })).toHaveCount(0);

  // El aviso sobrevive a que su vigilada desaparezca (ADR-017): RN-15 sigue en pie.
  await page.goto('/avisos');
  await expect(page.locator('.notif-item')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/ca14-tester-quitar-y-aviso-vivo.png`, fullPage: true });
});

/** Deja `ticker` EN ZONA con su episodio y su aviso, como haría el ciclo de refresco. */
async function sembrarCotizacionYAviso(email: string, ticker: string, price: string) {
  const { default: postgres } = await import('postgres');
  const { DB_URL } = await import('./roles');
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    const [u] = await sql`SELECT id FROM users WHERE email = ${email}`;
    const [w] = await sql`SELECT w.id AS watched_id, s.id AS symbol_id
      FROM watched_symbols w JOIN symbols s ON s.id = w.symbol_id
      WHERE w.user_id = ${u.id} AND s.ticker = ${ticker}`;
    await sql`INSERT INTO quotes (symbol_id, price, currency, as_of)
      VALUES (${w.symbol_id}, ${price}, 'EUR', '2026-07-13T00:00:00.000Z')
      ON CONFLICT (symbol_id) DO UPDATE SET price = EXCLUDED.price, as_of = EXCLUDED.as_of`;
    const [t] = await sql`INSERT INTO zone_triggers
      (user_id, watched_symbol_id, symbol_id, zone_kind, price, as_of)
      VALUES (${u.id}, ${w.watched_id}, ${w.symbol_id}, 'buy', ${price}, '2026-07-13T00:00:00.000Z')
      RETURNING id`;
    await sql`INSERT INTO notifications
      (user_id, kind, zone_trigger_id, payload, channel, status, as_of)
      VALUES (${u.id}, 'entry', ${t.id}, ${`${ticker} en zona de compra @ ${price}`},
              'email', 'sent', '2026-07-13T00:00:00.000Z')`;
  } finally {
    await sql.end();
  }
}
