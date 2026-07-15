import { test, expect, type Page } from '@playwright/test';
import * as XLSX from 'xlsx';

// UI del import desde bróker (SPEC-014). Sube un extracto .xls SINTÉTICO (sin datos
// personales), resuelve identidad (auto + manual + fusión), previsualiza y confirma;
// verifica idempotencia, sobreventa y reflejo en la cartera. Búsqueda determinista con
// E2E_FAKE_SYMBOL_SEARCH=1 (catálogo ITX/SAN/AAPL/MSFT/REP/TEF).
const SHOTS = '_qa/SPEC-014';
const PWD = 'clave-secreta-123';

type Celda = string | number;
const op = (fecha: string, tipo: string, valor: string, mkt: string, tit: Celda, precio: Celda, imp: Celda): Celda[] =>
  [fecha, tipo, '', valor, '', mkt, tit, precio, '', imp];

/** Construye un .xls en el layout de ING (sintético, anonimizado). */
function buildIngXls(rows: Celda[][]): Buffer {
  const aoa: Celda[][] = [
    [],
    ['Movimientos de la Cartera', '', '  Número de cuenta:', '', 'ES00 0000 0000 0000'],
    ['', '', '  Titular:', '', 'TITULAR DE PRUEBA'],
    ['', '', '  Fecha de exportación:', '', '14/07/2026 23:28h'],
    [], [],
    ['FECHA', 'OPERACIÓN', '', 'VALOR', '', 'MERCADO', 'TÍTULOS', 'PRECIO EN DIVISA ORIGEN', '', 'IMPORTE TOTAL (€)'],
    ...rows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cartera');
  return XLSX.write(wb, { type: 'buffer', bookType: 'biff8' }) as Buffer;
}

const EXTRACTO = buildIngXls([
  op('02/01/2026', 'COMPRA', 'INDITEX', 'M.CONTINUO', 100, 10, 1000),
  op('02/01/2026', 'COMPRA', 'REPSOL', 'M.CONTINUO', 100, 12, 1200),
  op('05/01/2026', 'COMPRA', 'APPLE COMPUTER', 'NASDAQ', 10, 150, 1350),
  op('10/03/2026', 'VENTA', 'REPSOL YPF', 'M.CONTINUO', 40, 13, 520),
  op('15/01/2026', 'VENTA', 'SANTANDER', 'M.CONTINUO', 100, 5, 500), // sobreventa: sin compra previa
  op('20/01/2026', 'COMPRA', 'DESCONOCIDO XYZ', 'M.CONTINUO', 5, 1, 5), // no resuelve → pendiente
]);

async function registrarYEntrar(page: Page, email: string) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

async function subir(page: Page, buffer: Buffer) {
  await page.getByTestId('file-input').setInputFiles({ name: 'historico.xls', mimeType: 'application/vnd.ms-excel', buffer });
  await page.getByTestId('read-btn').click();
}

test('SPEC-014: subir → resolver → previsualizar → confirmar, con fusión y sobreventa', async ({ page }) => {
  await registrarYEntrar(page, 'importar1@example.com');

  // CA-1: entrada desde la cartera.
  await page.goto('/cartera');
  await page.getByTestId('importar-cta').click();
  await expect(page).toHaveURL(/\/cartera\/importar/);

  // CA-2: subida y lectura.
  await subir(page, EXTRACTO);
  await expect(page.getByTestId('summary')).toContainText('6');

  // CA-4: resolución manual de un valor sin auto-match (APPLE COMPUTER → AAPL).
  const apple = page.locator('[data-valor="APPLE COMPUTER"]');
  await apple.locator('.symbol-search-input').fill('Apple');
  await apple.locator('.symbol-result', { hasText: 'AAPL' }).first().click();
  await expect(apple.getByTestId('valor-ok')).toBeVisible();

  // CA-5: fusión manual (REPSOL YPF = mismo emisor que REPSOL).
  const ypf = page.locator('[data-valor="REPSOL YPF"]');
  await ypf.getByTestId('fuse-select').selectOption({ label: 'REPSOL (REP)' });
  await expect(ypf.getByTestId('fuse-warn')).toBeVisible();

  // CA-6: un valor sin resolver queda pendiente.
  await expect(page.locator('[data-valor="DESCONOCIDO XYZ"]').getByTestId('valor-pending')).toBeVisible();

  // CA-7: previsualización (nada escrito aún).
  await page.getByTestId('preview-btn').click();
  await expect(page.getByTestId('count-crear')).toHaveText('4');
  await expect(page.getByTestId('count-pendientes')).toHaveText('1');
  // CA-10: aviso de sobreventa (SANTANDER vende sin compra previa).
  await expect(page.getByTestId('avisos')).toContainText('SANTANDER');
  await page.screenshot({ path: `${SHOTS}/preview.png`, fullPage: true });

  // CA-8: confirmar escribe y se refleja en la cartera.
  await page.getByTestId('confirm-btn').click();
  await expect(page.getByTestId('result')).toContainText('Creadas');
  await page.getByTestId('go-cartera').click();
  await expect(page).toHaveURL(/\/cartera$/);
  await expect(page.locator('tr', { hasText: 'ITX' })).toBeVisible();
  await expect(page.locator('tr', { hasText: 'REP' })).toBeVisible();
  await expect(page.locator('tr', { hasText: 'AAPL' })).toBeVisible();

  // CA-9: re-importar el mismo extracto no duplica (0 a crear / 4 a saltar).
  await page.goto('/cartera/importar');
  await subir(page, EXTRACTO);
  await expect(page.getByTestId('summary')).toBeVisible();
  await page.getByTestId('preview-btn').click();
  await expect(page.getByTestId('count-crear')).toHaveText('0');
  await expect(page.getByTestId('count-saltar')).toHaveText('4');

  // CA-12: coherencia responsive (móvil) sin desbordes.
  await page.setViewportSize({ width: 390, height: 800 });
  await expect(page.getByTestId('step-preview')).toBeVisible();
  await page.screenshot({ path: `${SHOTS}/mobile.png`, fullPage: true });
});

test('SPEC-014 · CA-3: fichero inválido muestra error legible y no avanza', async ({ page }) => {
  await registrarYEntrar(page, 'importar2@example.com');
  await page.goto('/cartera/importar');
  await page.getByTestId('file-input').setInputFiles({
    name: 'no-es-excel.xls',
    mimeType: 'application/vnd.ms-excel',
    buffer: Buffer.from('esto no es un excel'),
  });
  await page.getByTestId('read-btn').click();
  await expect(page.getByTestId('read-error')).toBeVisible();
  await expect(page.getByTestId('step-upload')).toBeVisible(); // sigue en el paso 1
});

test('SPEC-014 · CA-11: sin sesión, la pantalla de import redirige a login', async ({ page }) => {
  await page.goto('/cartera/importar');
  await expect(page).toHaveURL(/\/login/);
});
