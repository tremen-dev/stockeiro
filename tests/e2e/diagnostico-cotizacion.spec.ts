import { test, expect, type Page } from '@playwright/test';
import postgres from 'postgres';
import { ponerRol } from './roles';

// SPEC-016 — el símbolo que no se puede cotizar lo DICE y explica por qué (CE-F2).
// Antes: "sin cotización" / "—", indistinguible de "el ciclo aún no ha corrido" — por eso
// el defecto de cobertura de EPIC-FIX pasó semanas sin detectarse.
const DB_URL = 'postgres://postgres:postgres@localhost:54329/stockeiro_e2e';
const SHOTS = '_qa/SPEC-016';
const PWD = 'clave-secreta-123';

async function registrarYEntrar(page: Page, email: string) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
  // SPEC-034 (F-SPEC-034-4): toda cuenta nueva nace `tester` y un tester NO ve Cartera.
  // Esta prueba la ejercita, así que DECLARA el rol que necesita en vez de heredarlo.
  await ponerRol(email, 'completo');
}

/**
 * Deja el símbolo **sin precio y sin motivo**: el estado «aún no ha pasado el ciclo».
 *
 * Hace falta desde **SPEC-058**: el alta de una vigilada **pide el precio en el acto**
 * (RN-17), y `MSFT` está en el catálogo de fallos del e2e, así que su motivo se escribe
 * ya en el alta — que es justamente la mejora que esa spec entrega (CE-2: *el silencio
 * deja de ser mudo desde el primer minuto*). Lo que CA-3 mide —que la pantalla
 * **distinga** «aún sin datos» de «no se puede cotizar»— no cambia y su aserción no se
 * toca; lo que se reconstruye aquí es la **premisa**, porque por esta puerta el producto
 * ya no la produce sola.
 */
async function borrarDiagnostico(ticker: string) {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    const [sym] = await sql`SELECT id FROM symbols WHERE ticker = ${ticker}`;
    await sql`DELETE FROM quote_diagnostics WHERE symbol_id = ${sym.id}`;
    await sql`DELETE FROM quotes WHERE symbol_id = ${sym.id}`;
  } finally {
    await sql.end();
  }
}

/** Simula el resultado del ciclo: el símbolo no se pudo cotizar y queda su motivo. */
async function sembrarDiagnostico(ticker: string, reason: string) {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    const [sym] = await sql`SELECT id FROM symbols WHERE ticker = ${ticker}`;
    await sql`
      INSERT INTO quote_diagnostics (symbol_id, reason) VALUES (${sym.id}, ${reason})
      ON CONFLICT (symbol_id) DO UPDATE SET reason = EXCLUDED.reason, attempted_at = now()
    `;
  } finally {
    await sql.end();
  }
}

test('SPEC-016 · CA-3/CA-4: /vigiladas distingue "aún sin datos" de "no se puede cotizar"', async ({ page }) => {
  await registrarYEntrar(page, 'diag1@example.com');
  await page.goto('/vigiladas');

  // Vigilar MSFT eligiéndolo del buscador (E2E_FAKE_SYMBOL_SEARCH=1).
  const form = page.locator('form', { hasText: 'Vigilar una acción' });
  await form.locator('.symbol-search-input').fill('Microsoft');
  await form.locator('.symbol-result', { hasText: 'MSFT' }).first().click();
  await form.locator('input[name="buyMin"]').fill('100');
  await form.locator('input[name="buyMax"]').fill('200');
  await form.locator('button[type="submit"]').click();

  const fila = page.locator('tr', { hasText: 'MSFT' });
  await expect(fila).toContainText('Sin cotización');

  // SPEC-058: el alta ya intentó cotizarlo y dejó su motivo. Se retira para reconstruir
  // el estado que CA-3 describe —nadie le ha preguntado nada al proveedor todavía—, que
  // es el que llega por `/cartera` y el que dejan las filas anteriores a esta spec.
  await borrarDiagnostico('MSFT');
  await page.reload();

  // CA-3: aún NO ha corrido el ciclo → se dice que faltan datos, sin culpar a nadie.
  await expect(fila.getByTestId('sin-datos-aun')).toBeVisible();
  await expect(fila.getByTestId('fail-reason')).toHaveCount(0);

  // Ahora el ciclo ha corrido y el proveedor no cubre ese mercado.
  await sembrarDiagnostico('MSFT', 'mercado_no_cubierto');
  await page.reload();

  // CA-4: el estado de zona sigue "sin dato" (RN-11) pero YA NO ES MUDO.
  await expect(fila).toContainText('Sin cotización');
  const motivo = fila.getByTestId('fail-reason');
  await expect(motivo).toBeVisible();
  await expect(motivo).toHaveAttribute('data-reason', 'mercado_no_cubierto');
  await expect(motivo).toContainText('No se vigila');
  // El texto crudo del proveedor NUNCA llega a la UI (CA-1).
  await expect(motivo).not.toContainText(/plan|403|upgrade/i);
  await expect(fila.getByTestId('sin-datos-aun')).toHaveCount(0);

  await page.screenshot({ path: `${SHOTS}/vigiladas-motivo.png`, fullPage: true });
});

test('SPEC-016 · CA-5/CA-6: /cartera muestra el motivo junto al P/L "—" sin inventarlo', async ({ page }) => {
  await registrarYEntrar(page, 'diag2@example.com');
  await page.goto('/cartera');

  // Comprar MSFT eligiéndolo del buscador.
  const compra = page.locator('form', { hasText: 'Registrar compra' });
  await compra.locator('.symbol-search-input').fill('Microsoft');
  await compra.locator('.symbol-result', { hasText: 'MSFT' }).first().click();
  await compra.locator('input[name="quantity"]').fill('5');
  await compra.locator('input[name="price"]').fill('400');
  await compra.locator('input[name="occurredOn"]').fill('2026-01-02');
  await compra.locator('button[type="submit"]').click();

  const fila = page.locator('tr', { hasText: 'MSFT' });
  await expect(fila).toContainText('—'); // CA-6: sin precio, el P/L actual NO se calcula

  await sembrarDiagnostico('MSFT', 'mercado_no_cubierto');
  await page.reload();

  // CA-5: sigue el "—" (RN-06 intacto) PERO acompañado del motivo.
  const motivo = fila.getByTestId('fail-reason');
  await expect(motivo).toBeVisible();
  await expect(motivo).toHaveAttribute('data-reason', 'mercado_no_cubierto');
  await expect(fila).toContainText('—');

  await page.screenshot({ path: `${SHOTS}/cartera-motivo.png`, fullPage: true });
});
