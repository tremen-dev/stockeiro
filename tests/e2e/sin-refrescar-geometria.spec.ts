import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import {
  TOLERANCIA_PX,
  describirDesborde,
  describirViolaciones,
  inyectarDefecto,
  medirDesborde,
  ponerVentana,
} from './geometria';
import { ESCENARIO, SHOTS, prepararEscenario } from './spec043';

/**
 * SPEC-043 CA-15 — **la marca nueva no rompe la tabla** (ADR-026).
 *
 * Se pide explícitamente porque **esta tabla ya se rompió por esto**. El párrafo del
 * motivo de SPEC-016 se extendía en vez de envolverse y estiraba `/vigiladas` entera; lo
 * arregló **SPEC-040 CA-4** acotando la CAJA (`.estado-caja { max-width: 170px }`), no
 * el texto. La marca de esta spec entra en **esa misma celda**, así que hereda la caja
 * acotada… y hay que demostrarlo, no suponerlo.
 *
 * ## Cómo se mide (ADR-026 §1)
 *
 * Las medidas viven en `tests/e2e/geometria.ts` y se importan. **M1** —desborde por
 * elemento— es la principal, y la única que `overflow-x: hidden` no puede enmascarar;
 * **M2** acompaña. Los dos anchos son los que CA-15 nombra: **360 px**, el suelo
 * declarado del proyecto, y **1280 px**.
 *
 * ## Y con filas marcadas Y sin marcar, en la misma tabla
 *
 * El escenario mezcla las tres: una marcada con motivo (el texto más largo), una marcada
 * sin motivo y una sin marcar. Una tabla con todas las filas iguales no se estira igual
 * que una con alturas distintas, y el defecto de SPEC-016 apareció precisamente en la
 * mezcla.
 */

const ANCHOS_CA15 = [360, 1280] as const;

test('SPEC-043 · CA-15: ningún elemento desborda en /vigiladas, a 360 y a 1280', async ({ page }) => {
  await prepararEscenario(page);
  await page.goto('/vigiladas');
  await page.locator('table.data-table').waitFor({ state: 'visible' });
  // La tabla tiene que estar en el estado que se quiere medir: con marca y sin marca.
  await expect(page.getByTestId('sin-refrescar')).toHaveCount(2);

  const informe: string[] = [];
  for (const ancho of ANCHOS_CA15) {
    const m = await medirDesborde(page, ancho);
    informe.push(describirDesborde(m));

    expect(m.m1.medidos, `no se midió ningún elemento a ${ancho} px`).toBeGreaterThan(5);
    expect(
      m.m1.violaciones.length,
      `/vigiladas con filas marcadas a ${ancho} px: ${m.m1.violaciones.length} elementos ` +
        `se salen de la ventana\n${describirViolaciones(m.m1)}\n${informe.join('\n')}`,
      ).toBe(0);
    expect(
      m.m2.desborde,
      `el documento se desborda a ${ancho} px: ${describirDesborde(m)}`,
    ).toBeLessThanOrEqual(TOLERANCIA_PX);
  }

  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(`${SHOTS}/geometria-vigiladas.txt`, `${informe.join('\n')}\n`, 'utf8');
});

test('SPEC-043 · CA-15: la tabla NO se estira — la marca se envuelve dentro de su caja', async ({ page }) => {
  // El defecto de SPEC-016 no era desborde de ventana: era que la celda de estado crecía
  // a lo ancho y arrastraba la tabla entera. Se mide el ancho de la tabla con y sin
  // marca; si la marca la estirara, la diferencia se vería aquí y en ningún otro sitio.
  await prepararEscenario(page, ESCENARIO.map((f) => ({ ...f, escritaHaceHoras: 11 })));
  await ponerVentana(page, 1280);
  await page.goto('/vigiladas');
  await page.locator('table.data-table').waitFor({ state: 'visible' });
  await expect(page.getByTestId('sin-refrescar')).toHaveCount(0);
  const sinMarca = (await page.locator('table.data-table').boundingBox())!.width;

  await prepararEscenario(page); // el escenario de siempre: dos filas marcadas
  await page.goto('/vigiladas');
  await expect(page.getByTestId('sin-refrescar')).toHaveCount(2);
  const conMarca = (await page.locator('table.data-table').boundingBox())!.width;

  expect(
    conMarca,
    `la tabla pasa de ${Math.round(sinMarca)} px a ${Math.round(conMarca)} px al marcar dos ` +
      'filas: la marca está estirando la tabla, como hizo el motivo de SPEC-016',
  ).toBeLessThanOrEqual(sinMarca + TOLERANCIA_PX);

  // Y la caja acotada de SPEC-040 CA-4 sigue haciendo su trabajo sobre el elemento nuevo.
  const marca = page.getByTestId('sin-refrescar').first();
  const caja = (await marca.boundingBox())!;
  const celda = (await marca.locator('xpath=ancestor::td[1]').boundingBox())!;
  expect(
    Math.round(caja.width),
    'la marca es más ancha que su celda: se está extendiendo en vez de envolverse',
  ).toBeLessThanOrEqual(Math.round(celda.width) + TOLERANCIA_PX);

  // ── Prueba de eficacia (ADR-026 §7) ──────────────────────────────────────────
  // Una guardia que no se pone roja al devolverle el defecto no está midiendo lo que
  // dice medir, y este proyecto ya vivió la versión cara de esa lección. Aquí se le
  // devuelve LA causa real: el párrafo del motivo sin caja acotada y sin envolverse,
  // que es exactamente como estiraba la tabla antes de SPEC-040 CA-4.
  const quitar = await inyectarDefecto(
    page,
    `.data-table .estado-caja { max-width: none; }
     .data-table .estado-caja .quote-stale { max-width: none; white-space: nowrap; }`,
  );
  const conDefecto = (await page.locator('table.data-table').boundingBox())!.width;
  await quitar();

  expect(
    conDefecto,
    'la medida no ve el defecto: con la caja del motivo sin acotar la tabla NO se ha ' +
      'estirado, así que esta guardia estaría en verde pase lo que pase',
  ).toBeGreaterThan(conMarca + TOLERANCIA_PX);
});

test('SPEC-043 · CA-15: y en /cartera, donde la marca va en una celda numérica', async ({ page }) => {
  await prepararEscenario(page);
  await page.goto('/cartera');
  await page.locator('table.data-table').waitFor({ state: 'visible' });
  await expect(page.getByTestId('sin-refrescar')).toHaveCount(2);

  const informe: string[] = [];
  for (const ancho of ANCHOS_CA15) {
    const m = await medirDesborde(page, ancho);
    informe.push(describirDesborde(m));
    expect(
      m.m1.violaciones.length,
      `/cartera con filas marcadas a ${ancho} px:\n${describirViolaciones(m.m1)}`,
    ).toBe(0);
  }

  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(`${SHOTS}/geometria-cartera.txt`, `${informe.join('\n')}\n`, 'utf8');
});
