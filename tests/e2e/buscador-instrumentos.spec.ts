import { test, expect, type Page } from '@playwright/test';

/**
 * SPEC-029 — el buscador ofrece cualquier instrumento del mercado soportado, dice de
 * qué tipo es y por qué descarta. Es el defecto que el humano reportó en producción
 * el 2026-08-18: buscó «orchid island capital» y «lexinfintech» en /vigiladas y la
 * app dijo «Sin resultados», cuando las dos existen y cotizan en mercados que
 * cubrimos (ORC@XNYS es un REIT, LX@XNAS un ADR).
 *
 * Corre contra el catálogo fake propio de esta spec (`E2E_FAKE_SYMBOL_SEARCH=1`):
 * `ORC`, `LX`, `UPWK`, `IWDA` como candidatos y `TSCO`@`XLON` sembrado en la lista
 * de DESCARTES, porque el descarte por mercado ocurre en el adaptador y el fake
 * tiene que poder reproducirlo. Ninguno de los cinco lo usa otra spec.
 */
const SHOTS = '_qa/SPEC-029';
const PWD = 'clave-secreta-123';

async function registrarYEntrar(page: Page, email: string) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

const buscador = (page: Page) => page.locator('form', { hasText: 'Vigilar una acción' });

test('SPEC-029 CA-12: el buscador ofrece REIT, ADR, acción y ETF, y dice de qué tipo es cada uno', async ({ page }) => {
  await registrarYEntrar(page, 'spec029-tipos@example.com');
  await page.goto('/vigiladas');
  const form = buscador(page);

  // El caso reportado, tal cual lo tecleó el humano.
  await form.locator('.symbol-search-input').fill('orchid island capital');
  const orc = form.locator('.symbol-result', { hasText: 'ORC' }).first();
  await expect(orc).toBeVisible(); // antes: «Sin resultados para «orchid island capital».»
  await expect(orc).toContainText('REIT'); // se lee el tipo ANTES de elegirlo
  await expect(orc).toContainText('NYSE'); // y el mercado, con nombre de dominio
  await expect(form.locator('[data-testid="search-empty"]')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ca12-reit-en-el-buscador.png`, fullPage: true });

  await form.locator('.symbol-search-input').fill('lexinfintech');
  const lx = form.locator('.symbol-result', { hasText: 'LX' }).first();
  await expect(lx).toBeVisible();
  await expect(lx).toContainText('ADR'); // «American Depositary Receipt» traducido
  await expect(lx).toContainText('NASDAQ'); // XNAS, no «XNGS» ni el rótulo del proveedor

  // No regresión: la acción común sigue apareciendo, y ahora dice que es una acción.
  await form.locator('.symbol-search-input').fill('upwork');
  const upwk = form.locator('.symbol-result', { hasText: 'UPWK' }).first();
  await expect(upwk).toBeVisible();
  await expect(upwk).toContainText('Acción');

  // CA-4: el ETF entra, y eso es querido (invierte CA-2 de SPEC-008, por ADR-020).
  await form.locator('.symbol-search-input').fill('iShares Core MSCI World');
  const iwda = form.locator('.symbol-result', { hasText: 'IWDA' }).first();
  await expect(iwda).toBeVisible();
  await expect(iwda).toContainText('ETF');
  await expect(iwda).toContainText('Euronext Ámsterdam');
});

test('SPEC-029 CA-10: «no existe» y «existe pero no lo cubrimos» son dos mensajes distintos', async ({ page }) => {
  await registrarYEntrar(page, 'spec029-descarte@example.com');
  await page.goto('/vigiladas');
  const form = buscador(page);

  // (a) No existe: no hay candidatos y tampoco descartes.
  await form.locator('.symbol-search-input').fill('zzzzznoexisteestevalor');
  const vacio = form.locator('[data-testid="search-empty"]');
  await expect(vacio).toBeVisible();
  await expect(vacio).toContainText('No hemos encontrado');
  await expect(form.locator('[data-testid="search-discarded"]')).toHaveCount(0); // ausencia del otro
  await page.screenshot({ path: `${SHOTS}/ca10-no-existe.png`, fullPage: true });

  // (b) Existe, pero está en un mercado que no cubrimos: se NOMBRA el mercado.
  await form.locator('.symbol-search-input').fill('tesco');
  const descartado = form.locator('[data-testid="search-discarded"]');
  await expect(descartado).toBeVisible();
  await expect(descartado).toContainText('Existe, pero no lo cubrimos');
  await expect(descartado).toContainText('TSCO');
  await expect(descartado).toContainText('mercado que todavía no cubrimos');
  await expect(descartado).toContainText('XLON'); // qué mercado es, para que pueda entenderlo
  await expect(form.locator('[data-testid="search-empty"]')).toHaveCount(0); // ausencia del otro
  // El texto crudo del proveedor no llega a la UI (aserto negativo, SPEC-016 CA-1).
  await expect(descartado).not.toContainText(/mic_code|instrument_type|Common Stock/);
  await page.screenshot({ path: `${SHOTS}/ca10-descartado-por-mercado.png`, fullPage: true });
});

test('SPEC-029 CA-13/CA-14/CA-18: vigilar un REIT lo deja en la tabla con su tipo y su mercado', async ({ page }) => {
  await registrarYEntrar(page, 'spec029-flujo@example.com');
  await page.goto('/vigiladas');
  const form = buscador(page);

  await form.locator('.symbol-search-input').fill('orchid island');
  const candidato = form.locator('.symbol-result', { hasText: 'ORC' }).first();
  // Lo que el usuario LEE al elegir: tiene que ser el MISMO texto que verá en la tabla.
  const mercadoEnElBuscador = (await candidato.locator('[data-testid="result-market"]').innerText()).trim();
  const tipoEnElBuscador = (await candidato.locator('[data-testid="result-type"]').innerText()).trim();
  expect(mercadoEnElBuscador).toBe('NYSE');
  expect(tipoEnElBuscador).toBe('REIT');

  await candidato.click();
  await expect(form.locator('.symbol-chip-tk')).toContainText('ORC');
  await form.locator('input[name="buyMin"]').fill('7');
  await form.locator('input[name="buyMax"]').fill('8');
  await form.locator('button[type="submit"]').click();

  const fila = page.locator('tr', { hasText: 'ORC' });
  await expect(fila).toBeVisible();
  await expect(fila.locator('[data-testid="row-type"]')).toHaveText(tipoEnElBuscador);
  await expect(fila.locator('[data-testid="row-market"]')).toHaveText(mercadoEnElBuscador);
  // Sin pantalla de error: el formulario no rechazó nada y la tabla se pintó entera.
  await expect(page.locator('.auth-error')).toHaveCount(0);
  await expect(page.locator('table.data-table')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/ca18-reit-vigilado-con-tipo-y-mercado.png`, fullPage: true });
});

test('SPEC-029 CA-14: dos vigiladas del mismo ticker en mercados distintos dejan de verse iguales', async ({ page }) => {
  await registrarYEntrar(page, 'spec029-dos-mercados@example.com');
  await page.goto('/vigiladas');
  const form = buscador(page);

  // La distinción de DOS FILAS DEL MISMO TICKER se verifica sobre la proyección
  // (`tests/symbol-instrument-type.test.ts`, CA-14), con dos símbolos sembrados: así lo
  // pide la spec, y así no hay que tocar el catálogo E2E compartido. Lo que se
  // comprueba AQUÍ, en el navegador, es que las dos celdas nuevas se pintan por fila y
  // llevan el valor de SU símbolo, no uno repetido ni el de la primera fila.
  for (const [q, tk] of [['orchid island', 'ORC'], ['lexinfintech', 'LX']] as const) {
    await form.locator('.symbol-search-input').fill(q);
    await form.locator('.symbol-result', { hasText: tk }).first().click();
    await expect(form.locator('.symbol-chip-tk')).toContainText(tk);
    await form.locator('button[type="submit"]').click();
    await expect(page.locator('tr', { hasText: tk })).toBeVisible();
  }

  const mercados = await page.locator('tbody [data-testid="row-market"]').allInnerTexts();
  expect(mercados.map((m) => m.trim()).sort()).toEqual(['NASDAQ', 'NYSE']);
  const tipos = await page.locator('tbody [data-testid="row-type"]').allInnerTexts();
  expect(tipos.map((t) => t.trim()).sort()).toEqual(['ADR', 'REIT']);
});

test('SPEC-029 CA-18: el mismo buscador en /cartera no regresa', async ({ page }) => {
  await registrarYEntrar(page, 'spec029-cartera@example.com');
  await page.goto('/cartera');

  const form = page.locator('form', { hasText: 'Registrar compra' });
  await form.locator('.symbol-search-input').fill('orchid island');
  const orc = form.locator('.symbol-result', { hasText: 'ORC' }).first();
  await expect(orc).toBeVisible();
  await expect(orc).toContainText('REIT');
  await expect(orc).toContainText('NYSE');
});
