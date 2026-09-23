import { expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { MIN_FORM_FILL_MS } from '../../src/lib/registration/activation-rules';

/**
 * SPEC-066 CA-23 / CA-25 pto. 2 — el ayudante COMPARTIDO del alta en el e2e.
 *
 * Hasta SPEC-066 casi veinte suites copiaban un `registrarYEntrar` que se daba de alta por
 * la interfaz y esperaba llegar a `/dashboard`. Desde SPEC-066 el alta no entra en la app:
 * crea una cuenta PENDIENTE y manda un correo de activación (ADR-042). Este ayudante hace
 * el recorrido completo que hace una persona —alta, buzón, activar, entrar— y deja la
 * página en `/dashboard`, que es lo que esas suites afirman DESPUÉS de entrar; lo que
 * afirman no cambia.
 *
 * Dos cosas que no son estilo:
 *
 *   - **El tiempo mínimo se lee de su constante** (`MIN_FORM_FILL_MS`, D-3), no de un
 *     literal: Playwright rellena en milisegundos y el servidor tomaría el envío por un
 *     automatismo. Si mañana el mínimo cambia, el ayudante espera lo nuevo.
 *   - **El enlace sale del buzón en disco** del e2e (`tests/e2e/server.mjs`), igual que la
 *     recuperación: nunca se inventa ni se lee de la base.
 */

export const OUTBOX = './.e2e-outbox.jsonl'; // mismo path que tests/e2e/server.mjs
export const PWD = 'clave-secreta-123';

/** Margen sobre el mínimo, para que el reloj del servidor no vea «justo 1999 ms». */
const MARGEN_MS = 300;

interface OutboxMessage {
  to: string;
  subject: string;
  body: string;
}

export function buzon(): OutboxMessage[] {
  if (!existsSync(OUTBOX)) return [];
  return readFileSync(OUTBOX, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as OutboxMessage);
}

const ENLACE = /https?:\/\/\S*\/register\/confirmar\/[A-Za-z0-9_-]+/;

const correosDeActivacion = (email: string) =>
  buzon().filter((m) => m.to === email.trim().toLowerCase() && ENLACE.test(m.body));

/** Cuántos correos de activación lleva recibidos esa dirección. */
export const activacionesRecibidas = (email: string) => correosDeActivacion(email).length;

/** Espera al correo de activación número `desde + 1` (el envío es diferido) y da su enlace. */
export async function enlaceDeActivacion(email: string, desde = 0): Promise<string> {
  await expect
    .poll(() => activacionesRecibidas(email), { timeout: 15_000 })
    .toBeGreaterThan(desde);
  const mios = correosDeActivacion(email);
  return mios[mios.length - 1].body.match(ENLACE)![0];
}

/**
 * Espera lo que falte hasta el tiempo mínimo contado desde `pintado` (el `Date.now()` de
 * justo después de cargar `/register`). Para los recorridos que rellenan el formulario a
 * su manera —sin desplazar, desde un enlace— y no pueden usar `darseDeAlta`.
 */
export async function esperarTiempoMinimo(page: Page, pintado: number): Promise<void> {
  const falta = MIN_FORM_FILL_MS + MARGEN_MS - (Date.now() - pintado);
  if (falta > 0) await page.waitForTimeout(falta);
}

/**
 * Rellena y envía el alta respetando el tiempo mínimo, y espera la respuesta NEUTRA.
 * No activa nada: para eso, `activarDesdeElBuzon`.
 */
export async function darseDeAlta(page: Page, email: string, password = PWD): Promise<void> {
  await page.goto('/register');
  const pintado = Date.now();
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await esperarTiempoMinimo(page, pintado);
  await page.click('button[type="submit"]');
  await expect(page.getByTestId('alta-enviada')).toBeVisible();
}

/** Abre el último enlace de activación de esa dirección y pulsa *activar*. Acaba en `/login`. */
export async function activarDesdeElBuzon(page: Page, email: string, desde = 0): Promise<void> {
  const enlace = await enlaceDeActivacion(email, desde);
  await page.goto(enlace);
  await page.getByRole('button', { name: 'Activar mi cuenta' }).click();
  await page.waitForURL(/\/login\?activada=1$/);
}

/** Entra con correo y contraseña y espera el panel. */
export async function entrarConContrasena(page: Page, email: string, password = PWD): Promise<void> {
  await page.goto('/login');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

/**
 * EL recorrido completo de CA-23: alta → respuesta neutra → buzón → activar → entrar.
 * Deja la página en `/dashboard`, como la dejaba el `registrarYEntrar` de antes.
 */
export async function registrarYEntrar(page: Page, email: string, password = PWD): Promise<void> {
  const antes = activacionesRecibidas(email);
  await darseDeAlta(page, email, password);
  await activarDesdeElBuzon(page, email, antes);
  await entrarConContrasena(page, email, password);
}

/**
 * Para las suites que comparten UNA cuenta entre tests: si ya existe, entra; si no, hace
 * el recorrido completo. Quien llama decide si existe (lo sabe por la base).
 */
export async function entrarORegistrar(
  page: Page,
  email: string,
  yaExiste: boolean,
  password = PWD,
): Promise<void> {
  if (yaExiste) await entrarConContrasena(page, email, password);
  else await registrarYEntrar(page, email, password);
}
