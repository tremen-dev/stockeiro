import { expect, type Locator, type Page } from '@playwright/test';
import { rolDe, ponerRol } from './roles';

/**
 * SPEC-040 — cuentas y gestos compartidos por las guardias de esta spec.
 *
 * ## ⚠️ El cupo del registro
 *
 * La base del e2e es UNA y la comparten todas las specs. La migración siembra el grifo
 * con **cupo 50** (SPEC-037 / ADR-023 pto. 7) y la suite ya registra del orden de
 * cuarenta y tantas cuentas. Agotarlo rompería specs ajenas con un síntoma —«no
 * aparece el formulario de alta»— que no se parece en nada a la causa.
 *
 * Por eso SPEC-040 da de alta **tres cuentas y sólo tres**, prefijadas con `spec040-`:
 *
 *  - `spec040-vacio@example.com`, rol `tester`, SIEMPRE sin vigiladas: es el escenario
 *    de CA-1 (el formulario de alta a la vista) y el panel de DOS tarjetas de CA-4.
 *  - `spec040-filas@example.com`, rol `completo`, con al menos una vigilada: es el
 *    escenario de CA-5 (la tabla), de la mitad «con filas» de CA-3 y el panel de TRES
 *    tarjetas de CA-4.
 *  - una cuenta nueva por ejecución para CA-2, que por definición tiene que registrarse
 *    de cero: el recorrido que mide es el de un desconocido que llega del foro.
 *
 * Cada test de Playwright estrena contexto, así que hay que volver a entrar en cada
 * uno. Se pregunta a la BASE si la cuenta ya existe (`rolDe`) en vez de deducirlo de lo
 * que se vea en pantalla, que es lo que dejaba a SPEC-037 colgada en un «email ya
 * registrado».
 */

export const PWD = 'clave-secreta-123';

/** Sin vigiladas nunca. Rol `tester`: panel de dos tarjetas (CE-2 de EPIC-004). */
export const CUENTA_VACIA = 'spec040-vacio@example.com';

/** Con al menos una vigilada. Rol `completo`: panel de tres tarjetas. */
export const CUENTA_CON_FILAS = 'spec040-filas@example.com';

export const SHOTS = '_qa/SPEC-040';

/** Entra con la cuenta indicada; la registra la primera vez que se necesita. */
export async function entrar(page: Page, email: string): Promise<void> {
  const yaExiste = (await rolDe(email)) !== null;
  await page.goto(yaExiste ? '/login' : '/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

/**
 * Deja a `CUENTA_CON_FILAS` con al menos una acción vigilada, y con el rol que necesita
 * CA-4 para pintar tres tarjetas. Idempotente: si la fila ya está, no crea otra.
 *
 * El alta se hace a 1280 px a propósito. Este helper monta el ESCENARIO de otros CA; si
 * lo hiciera en el ancho que está bajo prueba, un fallo de maquetación se convertiría en
 * un fallo de preparación y el mensaje no diría nada útil.
 */
export async function asegurarVigilada(page: Page): Promise<void> {
  await entrar(page, CUENTA_CON_FILAS);
  await ponerRol(CUENTA_CON_FILAS, 'completo');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/vigiladas');

  if ((await page.locator('table.data-table tbody tr').count()) > 0) return;

  const form = page.locator('form', { hasText: 'Vigilar una acción' });
  await form.locator('.symbol-search-input').fill('Inditex');
  await form.locator('.symbol-result', { hasText: 'ITX' }).first().click();
  await expect(form.locator('.symbol-chip-tk')).toContainText('ITX');
  await form.locator('input[name="buyMin"]').fill('20');
  await form.locator('input[name="buyMax"]').fill('25');
  await form.locator('input[name="sellMin"]').fill('35');
  await form.locator('input[name="sellMax"]').fill('40');
  await form.locator('button[type="submit"]').click();
  await expect(page.locator('tr', { hasText: 'ITX' })).toBeVisible();
}

/**
 * La caja de un control, en coordenadas de ventana, junto al ancho de la ventana.
 * Es la medida M1 aplicada a UN elemento: la que `overflow: hidden` no enmascara.
 */
export async function cajaDe(control: Locator): Promise<{
  derecha: number;
  izquierda: number;
  ancho: number;
  ventana: number;
}> {
  return control.evaluate((el) => {
    const r = el.getBoundingClientRect();
    return {
      derecha: r.right,
      izquierda: r.left,
      ancho: r.width,
      ventana: document.documentElement.clientWidth,
    };
  });
}

/**
 * Comprueba que el control está DENTRO de la ventana antes de tocarlo y lo pulsa sin
 * que la página se haya tenido que desplazar en horizontal.
 *
 * Es el gesto que CA-2 mide: no basta con que el clic funcione —Playwright desplaza
 * solo—, tiene que funcionar como le funciona a una persona con un teléfono en la mano.
 */
export async function pulsarSinDesplazar(
  page: Page,
  control: Locator,
  nombre: string,
): Promise<void> {
  const caja = await cajaDe(control);
  expect(
    caja.derecha,
    `«${nombre}» se sale por la derecha antes de poder pulsarlo: right=${Math.round(
      caja.derecha,
    )} con la ventana en ${caja.ventana} px (ancho del control ${Math.round(caja.ancho)})`,
  ).toBeLessThanOrEqual(caja.ventana + 1);
  expect(
    caja.izquierda,
    `«${nombre}» se sale por la izquierda: left=${Math.round(caja.izquierda)}`,
  ).toBeGreaterThanOrEqual(-1);

  await control.click();

  const desplazamiento = await page.evaluate(() => window.scrollX);
  expect(
    desplazamiento,
    `pulsar «${nombre}» obligó a desplazar la página en horizontal (scrollX=${desplazamiento})`,
  ).toBe(0);
}
