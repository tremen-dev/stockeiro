import { mkdirSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import {
  CUENTA,
  ESCENARIO,
  SHOTS,
  elCicloVuelveAEscribir,
  prepararEscenario,
  sembrarEscenario,
} from './spec043';

/**
 * SPEC-043 CA-8, CA-9, CA-10, CA-11 y CA-16 — **en el navegador, que es donde estaba el
 * defecto**.
 *
 * Del 2026-08-19 al 21 el producto enseñó el mismo precio tres días con cara de vigente.
 * El diagnóstico estaba en la base desde el primer minuto y **ninguna de las dos
 * pantallas lo dijo**, porque el aviso estaba condicionado a que no hubiera precio:
 *
 *  - `watched-table.tsx:166` lo pintaba sólo si `r.state === 'none'`;
 *  - `cartera/page.tsx:83` sólo si `p.plActual === null`.
 *
 * Las tres filas del escenario llevan **precio dentro de la zona** justamente para que
 * esas dos condiciones sean falsas. Si estuvieran sin precio, estas guardias pasarían
 * sin demostrar nada — el escenario ES la prueba.
 */

const fila = (page: Page, ticker: string) => page.locator('tr', { hasText: ticker });

test.beforeAll(() => {
  mkdirSync(SHOTS, { recursive: true });
});

test('SPEC-043 · CA-8: /vigiladas lo dice aunque haya precio y estado de zona', async ({ page }) => {
  await prepararEscenario(page);
  await page.goto('/vigiladas');
  await page.locator('table.data-table').waitFor({ state: 'visible' });

  const congelada = fila(page, 'Z6CUOTA');

  // El estado de zona SIGUE calculándose (RN-11, CA-13): marcar no es borrar.
  await expect(congelada).toContainText('En zona de compra');
  await expect(congelada).toContainText('22');
  // Y aun así la fila dice que ese precio no se está actualizando…
  const marca = congelada.getByTestId('sin-refrescar');
  await expect(marca).toBeVisible();
  await expect(marca).toContainText(/no se está actualizando desde/i);
  // …y, como hay diagnóstico vigente, POR QUÉ.
  await expect(marca).toHaveAttribute('data-reason', 'cuota_agotada');
  await expect(marca).toContainText(/cuota/i);
  // El motivo que se le da al usuario no le manda a esperar (CA-4, ADR-027 pto. 4).
  await expect(marca).not.toContainText(/se reintentar|pr[óo]ximo ciclo/i);
  // Ni una palabra cruda del proveedor.
  await expect(marca).not.toContainText(/usage_limit|429|monthly/i);

  // El control: la fila refrescada anoche NO lleva marca. Sin él, un test que marcara
  // todas las filas por igual pasaría igual y no diría nada.
  await expect(fila(page, 'Z6VIVA').getByTestId('sin-refrescar')).toHaveCount(0);

  await page.screenshot({ path: `${SHOTS}/vigiladas-sin-refrescar.png`, fullPage: true });
});

test('SPEC-043 · CA-10: sin diagnóstico se dice el hecho y no se inventa la causa', async ({ page }) => {
  await prepararEscenario(page);
  await page.goto('/vigiladas');

  const muda = fila(page, 'Z6MUDA').getByTestId('sin-refrescar');

  await expect(muda).toBeVisible();
  await expect(muda).toContainText(/no se está actualizando desde/i);
  // Es el caso del ciclo que NUNCA llegó a invocarse (F-SPEC-037-4): no hay a quién
  // echarle la culpa, porque nadie llegó a preguntarle nada al proveedor.
  await expect(muda).not.toHaveAttribute('data-reason', /.+/);
  await expect(muda).not.toContainText(/proveedor|cuota|deslistad|mercado/i);
});

test('SPEC-043 · CA-9: /cartera lo dice aunque el P/L actual tenga número', async ({ page }) => {
  await prepararEscenario(page);
  await page.goto('/cartera');
  await page.locator('table.data-table').waitFor({ state: 'visible' });

  const congelada = fila(page, 'Z6CUOTA');

  // RN-06 intacta (CA-13): el P/L actual TIENE número — (22 − 1) × 10 = 210 — y por eso
  // la condición vieja (`plActual === null`) escondía el motivo.
  await expect(congelada).toContainText('210');
  await expect(congelada).not.toContainText('—');

  const marca = congelada.getByTestId('sin-refrescar');
  await expect(marca).toBeVisible();
  await expect(marca).toContainText(/no se está actualizando desde/i);
  await expect(marca).toHaveAttribute('data-reason', 'cuota_agotada');

  await expect(fila(page, 'Z6VIVA').getByTestId('sin-refrescar')).toHaveCount(0);

  await page.screenshot({ path: `${SHOTS}/cartera-sin-refrescar.png`, fullPage: true });
});

test('SPEC-043 · CA-11: la marca desaparece sola cuando el ciclo vuelve', async ({ page }) => {
  await prepararEscenario(page);
  await page.goto('/vigiladas');
  await expect(fila(page, 'Z6CUOTA').getByTestId('sin-refrescar')).toBeVisible();

  // Un ciclo posterior SÍ la actualiza. Nadie toca ningún botón.
  await elCicloVuelveAEscribir('Z6CUOTA');
  await page.reload();

  await expect(fila(page, 'Z6CUOTA').getByTestId('sin-refrescar')).toHaveCount(0);
  await expect(fila(page, 'Z6CUOTA').getByTestId('fail-reason')).toHaveCount(0); // sin fantasmas
  // Y la que sigue congelada sigue marcada: no se limpió la pantalla entera.
  await expect(fila(page, 'Z6MUDA').getByTestId('sin-refrescar')).toBeVisible();

  await page.goto('/cartera');
  await expect(fila(page, 'Z6CUOTA').getByTestId('sin-refrescar')).toHaveCount(0);
});

test('SPEC-043 · CA-16: el incidente real, en las dos pantallas', async ({ page }) => {
  // Trece símbolos, todos con el mismo motivo y todos congelados el mismo día: la firma
  // del 19 y el 20 de agosto (`cron_runs` success, updated=0, skipped=13).
  const trece = Array.from({ length: 13 }, (_, i) => ({
    ticker: `Z6INC${String(i + 1).padStart(2, '0')}`,
    micCode: 'BMEX',
    name: `Incidente ${i + 1} SA`,
    buyMin: '20',
    buyMax: '25',
    price: '22',
    escritaHaceHoras: 60,
    failReason: 'cuota_agotada',
  }));
  await prepararEscenario(page, trece);

  await page.goto('/vigiladas');
  await page.locator('table.data-table').waitFor({ state: 'visible' });
  await expect(page.getByTestId('sin-refrescar')).toHaveCount(13);
  for (const f of trece) {
    await expect(fila(page, f.ticker).getByTestId('sin-refrescar')).toHaveAttribute(
      'data-reason',
      'cuota_agotada',
    );
  }
  await page.screenshot({ path: `${SHOTS}/incidente-vigiladas.png`, fullPage: true });

  await page.goto('/cartera');
  await page.locator('table.data-table').waitFor({ state: 'visible' });
  await expect(page.getByTestId('sin-refrescar')).toHaveCount(13);
  await page.screenshot({ path: `${SHOTS}/incidente-cartera.png`, fullPage: true });

  // Deja la base como estaba para las guardias que corran después.
  await sembrarEscenario(CUENTA, ESCENARIO);
});
