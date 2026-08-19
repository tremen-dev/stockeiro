import { test, expect, type Page } from '@playwright/test';
import { ponerRol } from './roles';
import {
  abrirDeParEnPar,
  anotarCiclo,
  censo,
  leerGrifo,
  llenarElAforo,
  olvidarCiclos,
  ponerGrifo,
} from './grifo';

/**
 * SPEC-037 — el grifo y la pantalla de operación, en el navegador.
 *
 * Cubre la mitad que solo se ve corriendo la app de verdad:
 *   CA-1  la migración siembra el grifo abierto y con cupo 50 (en Postgres, no PGlite)
 *   CA-6  quien llega con la puerta cerrada lee POR QUÉ, y el porqué correcto
 *   CA-7  se cierra y se reabre sin desplegar y sin esperar
 *   CA-8  cerrar el grifo NO cierra la app
 *   CA-10 la pantalla es solo para `admin`
 *   CA-12 degradar al operador le cierra la pantalla en el acto
 *   CA-13 los cuatro contadores coinciden con la base
 *   CA-18 el último ciclo, y el «no ha corrido nunca»
 *   CA-21 el operador mueve el grifo desde la pantalla
 *   CA-22 la pantalla no enseña a nadie
 *   CA-24 el acceso se ofrece solo a quien puede usarlo
 *
 * ⚠️ La base del e2e es UNA y la comparten todas las specs, y la migración siembra el
 * grifo con **cupo 50**. Este fichero se llama `admin-grifo` y no `admin` a propósito:
 * Playwright ordena por ruta, así que es el PRIMERO de todo el directorio y el único
 * que puede ver la fila recién sembrada (CA-1) antes de que nadie la toque. Al
 * terminar deja el grifo **abierto y sin tope** (`abrirDeParEnPar`), que es lo que el
 * resto de la suite —cuarenta y tantas altas— necesita encontrarse. Los emails van
 * prefijados con `spec037-` para no chocar con los de ninguna otra spec.
 */

const SHOTS = '_qa/SPEC-037';
const PWD = 'clave-secreta-123';

async function registrarYEntrar(page: Page, email: string) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

async function entrar(page: Page, email: string) {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

const nav = (page: Page) => page.locator('nav.app-nav');

/** Crea una cuenta con el rol pedido y la deja con la sesión abierta. */
async function operador(page: Page, email: string) {
  await registrarYEntrar(page, email);
  await ponerRol(email, 'admin');
  await page.goto('/admin');
}

test.afterAll(async () => {
  // Lo que el resto de la suite necesita encontrarse. Ver el comentario de `grifo.ts`.
  await abrirDeParEnPar();
});

// ---------------------------------------------------------------------------
// CA-1 (en Postgres de verdad)
// ---------------------------------------------------------------------------

test('SPEC-037 CA-1: la migración deja el grifo abierto y con cupo 50', async () => {
  // Primer test del directorio: la base acaba de migrarse y nadie la ha tocado. Esto
  // ancla la semilla contra el Postgres real, no solo contra PGlite.
  expect(await leerGrifo()).toEqual({ openManually: true, capacity: 50 });
});

// ---------------------------------------------------------------------------
// CA-6 + CA-7
// ---------------------------------------------------------------------------

test('SPEC-037 CA-6: cerrado a mano y cerrado por cupo dicen cosas DISTINTAS', async ({ page }) => {
  const respuestas: number[] = [];
  page.on('response', (r) => {
    if (new URL(r.url()).pathname === '/register') respuestas.push(r.status());
  });

  // (a) cerrado a mano
  await ponerGrifo({ openManually: false, capacity: null });
  await page.goto('/register');

  await expect(page.getByTestId('registro-cerrado')).toBeVisible();
  await expect(page.locator('form input[name="email"]')).toHaveCount(0);
  const manual = await page.getByTestId('registro-cerrado').innerText();
  await expect(page.locator('[data-motivo="manual"]')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/ca6-registro-cerrado-a-mano.png`, fullPage: true });

  // (b) cerrado por cupo
  await llenarElAforo();
  await page.goto('/register');

  await expect(page.getByTestId('registro-cerrado')).toBeVisible();
  await expect(page.locator('form input[name="email"]')).toHaveCount(0);
  const cupo = await page.getByTestId('registro-cerrado').innerText();
  await expect(page.locator('[data-motivo="capacity"]')).toHaveCount(1);
  await page.screenshot({ path: `${SHOTS}/ca6-registro-cerrado-por-cupo.png`, fullPage: true });

  // Dos mensajes DISTINTOS, cada uno con su motivo. Un solo texto para los dos casos
  // convertiría el «por qué» en un adorno.
  expect(manual).not.toBe(cupo);
  expect(manual.length).toBeGreaterThan(40);
  expect(cupo.length).toBeGreaterThan(40);

  // Ni un error de Next, ni un 500, ni una redirección muda: 200 y la URL intacta.
  expect(respuestas.every((s) => s === 200), `estados de /register: ${respuestas}`).toBe(true);
  await expect(page).toHaveURL(/\/register$/);
  const cuerpo = (await page.locator('body').innerText()).toLowerCase();
  for (const rastro of ['application error', 'unhandled', 'internal server error', '404']) {
    expect(cuerpo, `la pantalla contiene "${rastro}"`).not.toContain(rastro);
  }

  await abrirDeParEnPar();
});

test('SPEC-037 CA-7: cerrar y reabrir surte efecto en la visita SIGUIENTE, sin reiniciar nada', async ({
  page,
}) => {
  // La app lleva corriendo desde el principio de la suite: no se reinicia, no se
  // reconstruye y no hay ninguna variable de entorno de por medio.
  await abrirDeParEnPar();
  await page.goto('/register');
  await expect(page.locator('form input[name="email"]')).toHaveCount(1);

  await ponerGrifo({ openManually: false, capacity: null });
  await page.goto('/register');
  await expect(page.getByTestId('registro-cerrado')).toBeVisible();
  await expect(page.locator('form input[name="email"]')).toHaveCount(0);

  await abrirDeParEnPar();
  await page.goto('/register');
  await expect(page.locator('form input[name="email"]')).toHaveCount(1);
  await expect(page.getByTestId('registro-cerrado')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// CA-8
// ---------------------------------------------------------------------------

test('SPEC-037 CA-8: con el grifo cerrado, quien ya tiene cuenta sigue entrando y usando la app', async ({
  page,
}) => {
  const email = 'spec037-ya-dentro@example.com';
  await registrarYEntrar(page, email);
  await page.click('button:has-text("Cerrar sesión")');
  await page.waitForURL('**/login');

  // Se cierra la puerta DESPUÉS de que esta persona ya estuviera dentro.
  await ponerGrifo({ openManually: false, capacity: null });

  await entrar(page, email);
  await expect(page.locator('nav.app-nav')).toBeVisible();

  // Vigiladas y Avisos, enteras.
  await page.goto('/vigiladas');
  await expect(page).toHaveURL(/\/vigiladas/);
  await expect(page.locator('h1')).toBeVisible();
  await page.goto('/avisos');
  await expect(page).toHaveURL(/\/avisos/);
  await expect(page.locator('h1')).toBeVisible();

  // Y recuperar la contraseña, que es otra puerta pública y tampoco es un alta.
  await page.goto('/forgot-password');
  await page.fill('input[name="email"]', email);
  await page.click('button[type="submit"]');
  await expect(page.locator('body')).not.toContainText('Application error');

  await abrirDeParEnPar();
});

// ---------------------------------------------------------------------------
// CA-10 + CA-24
// ---------------------------------------------------------------------------

test('SPEC-037 CA-10/CA-24: solo el admin ve /admin, y solo él encuentra el camino', async ({
  page,
}) => {
  // (a) sin sesión -> login
  await page.context().clearCookies();
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);

  // (b) y (c) tester y completo: rebotan y no reciben NI UN contador
  for (const [email, rol] of [
    ['spec037-tester@example.com', 'tester'],
    ['spec037-completo@example.com', 'completo'],
  ] as const) {
    await registrarYEntrar(page, email);
    await ponerRol(email, rol);

    await page.goto('/dashboard');
    await expect(nav(page).locator('a[href="/admin"]'), rol).toHaveCount(0);
    await expect(nav(page), rol).not.toContainText('Operación');

    await page.goto('/admin');
    await expect(page, rol).toHaveURL(/\/dashboard/);
    const cuerpo = (await page.locator('body').innerText()).toLowerCase();
    for (const rastro of [
      'símbolos en el ciclo',
      'símbolos sin precio',
      'el ciclo diario',
      'aceptar altas nuevas',
      'cupo de cuentas',
      'última ejecución registrada',
    ]) {
      expect(cuerpo, `un ${rol} ha recibido "${rastro}"`).not.toContain(rastro);
    }
    await expect(page.getByTestId('grifo'), rol).toHaveCount(0);
    await expect(page.getByTestId('contadores'), rol).toHaveCount(0);

    await page.click('button:has-text("Cerrar sesión")');
    await page.waitForURL('**/login');
  }

  // (d) admin: la pantalla, y su enlace en el menú
  await operador(page, 'spec037-admin@example.com');
  await expect(page).toHaveURL(/\/admin/);
  await expect(nav(page).locator('a[href="/admin"]')).toHaveCount(1);
  await expect(page.getByTestId('grifo')).toBeVisible();
  await expect(page.getByTestId('contadores')).toBeVisible();
  await expect(page.getByTestId('ultimo-ciclo')).toBeVisible();

  // El resto de la navegación queda IGUAL para el admin (CA-24). Se mira dentro de
  // `.app-nav-links` y no de todo el `nav`, porque la marca de la izquierda también
  // enlaza al panel y contarla sería contar dos veces la misma sección.
  const enlaces = page.locator('nav.app-nav .app-nav-links');
  for (const href of ['/dashboard', '/cartera', '/vigiladas', '/avisos']) {
    await expect(enlaces.locator(`a[href="${href}"]`), href).toHaveCount(1);
  }
  await expect(enlaces.locator('a[href="/admin"]')).toHaveCount(1);

  await page.screenshot({ path: `${SHOTS}/ca10-ca24-pantalla-de-operacion.png`, fullPage: true });
});

// ---------------------------------------------------------------------------
// CA-12
// ---------------------------------------------------------------------------

test('SPEC-037 CA-12: degradar al operador le cierra la pantalla en su siguiente petición', async ({
  page,
}) => {
  const email = 'spec037-degradado@example.com';
  await operador(page, email);
  await expect(page.getByTestId('grifo')).toBeVisible();

  // El rol cambia en la BASE. Ni se cierra sesión, ni se toca la cookie, ni se
  // redespliega nada: es la propiedad que la lista de emails no daba.
  await ponerRol(email, 'completo');

  await page.reload();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByTestId('grifo')).toHaveCount(0);
  await expect(nav(page).locator('a[href="/admin"]')).toHaveCount(0);

  // Y al revés, con la MISMA cookie.
  await ponerRol(email, 'admin');
  await page.goto('/admin');
  await expect(page.getByTestId('grifo')).toBeVisible();
});

// ---------------------------------------------------------------------------
// CA-13 + CA-18 + CA-22
// ---------------------------------------------------------------------------

test('SPEC-037 CA-13: los cuatro contadores coinciden EXACTAMENTE con la base', async ({ page }) => {
  await operador(page, 'spec037-cifras@example.com');

  const esperado = await censo();
  await page.reload();

  await expect(page.getByTestId('cifra-cuentas')).toContainText(String(esperado.cuentas));
  await expect(page.getByTestId('cifra-vigiladas')).toContainText(String(esperado.vigiladas));
  await expect(page.getByTestId('cifra-simbolos')).toContainText(String(esperado.simbolosDelCiclo));
  await expect(page.getByTestId('cifra-sin-precio')).toContainText(String(esperado.sinPrecio));

  await page.screenshot({ path: `${SHOTS}/ca13-contadores.png`, fullPage: true });
});

test('SPEC-037 CA-18: sin ninguna ejecución lo dice, y con varias enseña la última', async ({
  page,
}) => {
  await operador(page, 'spec037-ciclo@example.com');

  // (a) ninguna fila: se dice explícitamente, no una fecha inventada ni un cero mudo.
  await olvidarCiclos();
  await page.reload();
  await expect(page.getByTestId('ciclo-nunca')).toBeVisible();
  await expect(page.getByTestId('ciclo-nunca')).toContainText('no ha corrido nunca');
  await expect(page.getByTestId('ciclo-datos')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ca18-ciclo-nunca-ha-corrido.png`, fullPage: true });

  // (b) varias filas de fechas distintas: la MÁS RECIENTE.
  await anotarCiclo({
    startedAt: '2026-08-15T22:00:00Z',
    finishedAt: '2026-08-15T22:00:11Z',
    outcome: 'success',
    requested: 7,
    updated: 7,
    skipped: 0,
  });
  await anotarCiclo({
    startedAt: '2026-08-18T22:00:00Z',
    finishedAt: '2026-08-18T22:00:31Z',
    outcome: 'success',
    requested: 31,
    updated: 27,
    skipped: 4,
  });
  await anotarCiclo({
    startedAt: '2026-08-16T22:00:00Z',
    finishedAt: null,
    outcome: null,
  });

  await page.reload();
  await expect(page.getByTestId('ciclo-nunca')).toHaveCount(0);
  await expect(page.getByTestId('ciclo-empezo')).toContainText('2026');
  await expect(page.getByTestId('ciclo-requested')).toHaveText('31');
  await expect(page.getByTestId('ciclo-updated')).toHaveText('27');
  await expect(page.getByTestId('ciclo-skipped')).toHaveText('4');
  await expect(page.getByTestId('ciclo-estado')).toHaveAttribute('data-outcome', 'success');
  await page.screenshot({ path: `${SHOTS}/ca18-ultimo-ciclo.png`, fullPage: true });

  // (c) el que empezó y no volvió, cuando es el último: se dice tal cual.
  await anotarCiclo({ startedAt: '2026-08-19T22:00:00Z', finishedAt: null, outcome: null });
  await page.reload();
  await expect(page.getByTestId('ciclo-termino')).toHaveText('No terminó');
  await expect(page.getByTestId('ciclo-estado')).toContainText('no volvió');
});

test('SPEC-037 CA-22: la pantalla no contiene NI UN email, NI UN ticker ni una fila de nadie', async ({
  page,
}) => {
  // Se siembra ruido a propósito: varias cuentas con datos, para que si la pantalla
  // filtrara algo, hubiera algo que filtrar.
  await registrarYEntrar(page, 'spec037-ruido-uno@example.com');
  await page.goto('/vigiladas');
  await page.click('button:has-text("Cerrar sesión")');
  await page.waitForURL('**/login');

  await operador(page, 'spec037-miron@example.com');

  const html = await page.locator('main').innerHTML();
  const texto = await page.locator('main').innerText();

  expect(texto, 'la pantalla enseña una dirección de correo').not.toMatch(/[\w.+-]+@[\w.-]+/);
  expect(texto.toLowerCase()).not.toContain('spec037');
  expect(texto.toLowerCase()).not.toContain('@example.com');
  // Ni una tabla de filas de usuario: aquí no hay a quién listar.
  await expect(page.locator('main table')).toHaveCount(0);
  // Y el id del operador tampoco viaja al HTML (el `updated_by` es auditoría).
  expect(html).not.toMatch(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/);

  await page.screenshot({ path: `${SHOTS}/ca22-sin-datos-de-nadie.png`, fullPage: true });
});

// ---------------------------------------------------------------------------
// CA-21 (y CA-7 desde la pantalla)
// ---------------------------------------------------------------------------

test('SPEC-037 CA-21: el operador cierra el grifo en dos clics, y la pantalla lo refleja', async ({
  page,
}) => {
  await operador(page, 'spec037-interruptor@example.com');
  await expect(page.getByTestId('grifo-estado')).toHaveAttribute('data-abierto', 'si');

  // Dos clics: desmarcar y guardar.
  await page.uncheck('[data-testid="interruptor"]');
  await page.click('[data-testid="guardar-grifo"]');

  await expect(page.getByTestId('grifo-estado')).toHaveAttribute('data-abierto', 'no');
  await expect(page.getByTestId('grifo-estado')).toHaveAttribute('data-motivo', 'manual');
  expect(await leerGrifo()).toMatchObject({ openManually: false });
  await page.screenshot({ path: `${SHOTS}/ca21-grifo-cerrado-desde-la-pantalla.png`, fullPage: true });

  // Y la puerta está cerrada de verdad para quien llegue (CA-7, desde la pantalla).
  await page.goto('/register');
  await expect(page.getByTestId('registro-cerrado')).toBeVisible();

  // Se reabre y se fija un cupo nuevo.
  await page.goto('/admin');
  await page.check('[data-testid="interruptor"]');
  await page.fill('[data-testid="cupo"]', '120');
  await page.click('[data-testid="guardar-grifo"]');
  await expect(page.getByTestId('grifo-estado')).toHaveAttribute('data-abierto', 'si');
  expect(await leerGrifo()).toEqual({ openManually: true, capacity: 120 });

  // Se RETIRA el cupo: vacío es «sin tope», no cero.
  await page.fill('[data-testid="cupo"]', '');
  await page.click('[data-testid="guardar-grifo"]');
  expect(await leerGrifo()).toEqual({ openManually: true, capacity: null });
  await expect(page.getByTestId('grifo-aforo')).toContainText('sin cupo');

  // Un cupo inválido se rechaza SIN cambiar nada.
  await page.fill('[data-testid="cupo"]', '-3');
  await page.uncheck('[data-testid="interruptor"]');
  await page.click('[data-testid="guardar-grifo"]');
  await expect(page.getByTestId('grifo-error')).toBeVisible();
  expect(await leerGrifo()).toEqual({ openManually: true, capacity: null });
  await page.screenshot({ path: `${SHOTS}/ca21-cupo-invalido-rechazado.png`, fullPage: true });
});
