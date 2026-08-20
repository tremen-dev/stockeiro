import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { CUENTA_VACIA, entrar } from './spec040';

/**
 * SPEC-040 CA-9 — **el rótulo sale del glosario**, y un test lo ata.
 *
 * `/cuenta` rotulaba el rol como «Tipo de cuenta» cuando `docs/fundacion/dominio.md`
 * dice «**Rol de cuenta**» (fila que entró con SPEC-034, desde ADR-021). Es
 * `F-SPEC-036-9`, y **ADR-025 pto. 4** le asignó la vía (b): *«el primer punto del lote
 * de rótulos de EPIC-FIX»*, con el motivo escrito de que un rótulo que contradice al
 * glosario **en una pantalla que va a ver un tester externo no espera compañía**.
 *
 * ## Por qué no basta con cambiar la cadena
 *
 * Cambiar «Tipo» por «Rol» y seguir es dejar el mismo hueco por el que se coló: una
 * cadena suelta en un `.tsx` que nadie compara con nada. Este test **lee la fila del
 * término en el glosario** y la compara con lo que la app PINTA de verdad, en el
 * navegador. Salta en los dos sentidos:
 *
 *  - si el rótulo se desvía del término, el texto deja de coincidir;
 *  - si el término se renombra en `docs/fundacion/dominio.md`, ninguna fila casa con el
 *    `data-termino` que declara la pantalla y el test dice exactamente eso.
 *
 * `docs/fundacion/dominio.md` es **documento de verdad** y la implementación no escribe
 * ahí nunca (ADR-025 pto. 1). Este test lo **lee**; escribirlo sería de sdd-arquitecto.
 *
 * ## Lo que este test NO es
 *
 * No es el barrido general de rótulos contra el glosario: **`F-ADR-025-1` sigue
 * abierto**. Aquí queda el patrón escrito para UN término, no la disciplina entera.
 */

const GLOSARIO = 'docs/fundacion/dominio.md';

/** `Rol de cuenta` → `rol-de-cuenta`. Lo mismo que declara el `data-termino` de la app. */
const aClave = (termino: string) =>
  termino
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

/** Los nombres de término del glosario: la primera celda de cada fila de su tabla. */
function terminosDelGlosario(): string[] {
  return readFileSync(GLOSARIO, 'utf8')
    .split('\n')
    .filter((l) => l.startsWith('| ') && !/^\|\s*-+/.test(l))
    .map((l) => l.split('|')[1]?.trim() ?? '')
    .filter((t) => t !== '' && t !== 'Término');
}

test('SPEC-040 CA-9: /cuenta rotula el rol con el término del glosario, no con uno propio', async ({
  page,
}) => {
  await entrar(page, CUENTA_VACIA);
  await page.goto('/cuenta');

  const rotulo = page.locator('dt[data-termino]');
  await rotulo.first().waitFor({ state: 'visible' });

  for (const dt of await rotulo.all()) {
    const clave = (await dt.getAttribute('data-termino'))!;
    // `textContent`, no `innerText`: la hoja de estilos pinta los `dt` en versalitas con
    // `text-transform`, y `innerText` devolvería «ROL DE CUENTA». Lo que hay que atar al
    // glosario es el texto que escribió quien programó la pantalla, no cómo lo dibuja el
    // CSS — si no, el test obligaría a escribir el término en mayúsculas en el `.tsx`.
    const texto = (await dt.evaluate((el) => el.textContent ?? '')).trim();

    const candidatos = terminosDelGlosario().filter((t) => aClave(t) === clave);
    expect(
      candidatos,
      `la pantalla dice que el rótulo «${texto}» sale del término "${clave}" del glosario, ` +
        `y en ${GLOSARIO} no hay ninguna fila con ese nombre. O el término se renombró ahí ` +
        `—y hay que actualizar la pantalla— o el \`data-termino\` está mal escrito.`,
    ).toHaveLength(1);

    expect(
      texto,
      `el rótulo de /cuenta dice «${texto}» y el glosario llama a ese término ` +
        `«${candidatos[0]}». La implementación COPIA de ${GLOSARIO}, no inventa ` +
        `(ADR-025 pto. 1).`,
    ).toBe(candidatos[0]);
  }

  // Y el rótulo viejo no queda por ninguna esquina de la pantalla.
  const pantalla = await page.locator('body').innerText();
  expect(
    pantalla.includes('Tipo de cuenta'),
    'sigue apareciendo «Tipo de cuenta» en /cuenta: es el rótulo que contradice al glosario',
  ).toBe(false);

  // El término concreto que cierra F-SPEC-036-9, dicho por su nombre para que se lea en
  // la revisión sin tener que deducirlo del bucle de arriba.
  const rol = await page
    .locator('dt[data-termino="rol-de-cuenta"]')
    .evaluate((el) => el.textContent ?? '');
  expect(rol.trim()).toBe('Rol de cuenta');
});
