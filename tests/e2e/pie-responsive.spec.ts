import { test, expect, type Page } from '@playwright/test';
import { ANCHOS, ponerVentana } from './geometria';

/**
 * SPEC-035 CA-17 (no degradar lo entregado) — la GEOMETRÍA del pie compartido,
 * medida en el navegador a varios anchos.
 *
 * ## Por qué existe este fichero
 *
 * El pie de SPEC-035 se monta en el layout raíz, así que aparece en **todas** las
 * páginas: públicas y de dentro. Eso convierte cualquier defecto suyo de maquetación
 * en un defecto de la app entera.
 *
 * Y pasó: por debajo de los 720 px, `design/tremen-ds/responsive.css` §footer aplica
 * `footer { flex-direction: column }` al selector de elemento. `.app-footer` no
 * fijaba su eje, así que lo heredaba — y ahí el `flex: 1 1 320px` del párrafo del
 * descargo **deja de ser un ancho y pasa a ser un alto**, porque `flex-basis` actúa
 * sobre el eje principal. Resultado medido por el verificador: `footer.app-footer`
 * con **452 px** de alto en vez de 138, con **~280 px de hueco muerto** debajo de dos
 * líneas de texto, en cada pantalla de móvil y tablet.
 *
 * El defecto llegó al verificador con **879 tests en verde**. Ninguno lo vio porque
 * todos preguntaban por el *contenido* del pie —que el descargo esté, que la marca
 * esté, que los enlaces estén— y ninguno por su *forma*. Un test que solo comprueba
 * que el texto está presente no habría cambiado nada: este mide píxeles.
 *
 * ## Qué mide, y por qué así
 *
 * Nada de comparar capturas: una prueba de imagen se rompe cuando cambia una fuente
 * o un color, y ninguna de esas dos cosas es lo que hay que proteger. Lo que se
 * protege son dos invariantes de caja, expresados en relación con el propio texto:
 *
 *   1. El pie **no crece desproporcionadamente** al estrecharse la ventana. En móvil
 *      es legítimo que crezca algo (el texto reflows en más líneas y los bloques se
 *      apilan), pero no que se multiplique: el tope es 2,2× el alto de escritorio.
 *   2. El párrafo del descargo **no tiene alto muerto**: su caja no puede exceder de
 *      forma apreciable lo que ocupa su propio texto. Es la traducción literal del
 *      fallo — 320 px de caja para 39 px de texto.
 *
 * El invariante (2) es el que ata el defecto por la causa y no por el síntoma: da
 * igual que mañana el descargo tenga tres líneas en vez de dos, o que el diseño
 * cambie el `padding`. Si `flex-basis` vuelve a interpretarse como altura, el hueco
 * reaparece y esta comprobación se pone roja.
 *
 * ## De dónde salen los anchos (SPEC-040 / ADR-026 §3)
 *
 * Ya no los declara este fichero. Los anchos de referencia son **del proyecto** y viven
 * en `tests/e2e/geometria.ts`: a los cinco del finding de SPEC-035 (390, 640, 700, 760,
 * 1280) se les sumaron **730 y 800** —el tramo donde vivía `V-SPEC-039-3`, que ninguna
 * guardia miraba porque caía justo entre dos anchos medidos— y **360**, el suelo que
 * fijó el humano en el gate del 2026-08-20.
 *
 * Lo que este fichero AFIRMA no cambia: sigue siendo suyo el factor del pie, la holgura
 * del descargo y el eje declarado. Lo que se comparte es **cómo se mide**.
 */

/** Alto máximo del pie en móvil respecto al de escritorio. */
const FACTOR_MAXIMO = 2.2;

/**
 * Holgura permitida entre la caja del descargo y el alto real de su texto, en px.
 * Cubre `line-height` de más y redondeos del motor; no cubre 280 px de vacío.
 */
const HOLGURA_PX = 24;

type Medida = {
  ancho: number;
  direccion: string;
  altoPie: number;
  altoDescargo: number;
  altoTextoDescargo: number;
};

/**
 * Mide el pie tal y como lo pinta el navegador.
 *
 * `altoTextoDescargo` es lo que de verdad ocupan las líneas de texto: se obtiene de
 * los rectángulos del rango del párrafo (`Range.getClientRects()`), no del elemento.
 * Esa es la diferencia que delata el hueco muerto — el elemento puede medir 320 px
 * mientras su texto ocupa 39.
 */
async function medirPie(page: Page, ancho: number): Promise<Medida> {
  await ponerVentana(page, ancho);
  await page.locator('footer.app-footer').waitFor({ state: 'visible' });

  return {
    ancho,
    ...(await page.evaluate(() => {
      const pie = document.querySelector('footer.app-footer')!;
      const descargo = pie.querySelector('.app-footer-descargo')!;

      const rango = document.createRange();
      rango.selectNodeContents(descargo);
      const lineas = [...rango.getClientRects()];
      const arriba = Math.min(...lineas.map((r) => r.top));
      const abajo = Math.max(...lineas.map((r) => r.bottom));

      return {
        direccion: getComputedStyle(pie).flexDirection,
        altoPie: pie.getBoundingClientRect().height,
        altoDescargo: descargo.getBoundingClientRect().height,
        altoTextoDescargo: lineas.length === 0 ? 0 : abajo - arriba,
      };
    })),
  };
}

const describir = (m: Medida) =>
  `ancho ${m.ancho}: flex-direction=${m.direccion} altoPie=${Math.round(m.altoPie)} ` +
  `altoDescargo=${Math.round(m.altoDescargo)} altoTexto=${Math.round(m.altoTextoDescargo)}`;

/**
 * Se miden dos páginas a propósito: una pública sin sesión y otra de autenticación.
 * El pie está en el layout raíz, así que un fallo suyo alcanza a las dos — y a todas
 * las demás. Con dos basta para probar que el defecto no es de una página concreta.
 */
for (const ruta of ['/legal', '/login']) {
  test.describe(`CA-17: el pie no rompe la maquetación en ${ruta}`, () => {
    test(`su caja no se dispara al estrechar la ventana (${ruta})`, async ({ page }) => {
      await page.goto(ruta);

      const medidas: Medida[] = [];
      for (const ancho of ANCHOS) medidas.push(await medirPie(page, ancho));

      const informe = medidas.map(describir).join('\n');
      const escritorio = medidas.find((m) => m.ancho === 1280)!;

      for (const medida of medidas) {
        expect(
          medida.altoPie,
          `el pie se dispara a ${medida.ancho} px (referencia 1280: ` +
            `${Math.round(escritorio.altoPie)} px)\n${informe}`,
        ).toBeLessThanOrEqual(escritorio.altoPie * FACTOR_MAXIMO);
      }
    });

    test(`el descargo no reserva alto que su texto no ocupa (${ruta})`, async ({ page }) => {
      await page.goto(ruta);

      for (const ancho of ANCHOS) {
        const medida = await medirPie(page, ancho);

        expect(medida.altoTextoDescargo, `no se midió el texto del descargo`).toBeGreaterThan(0);
        expect(
          medida.altoDescargo,
          `hueco muerto en el descargo: la caja mide ` +
            `${Math.round(medida.altoDescargo)} px y su texto solo ` +
            `${Math.round(medida.altoTextoDescargo)} px — es el síntoma de un ` +
            `flex-basis interpretado como ALTURA (${describir(medida)})`,
        ).toBeLessThanOrEqual(medida.altoTextoDescargo + HOLGURA_PX);
      }
    });
  });
}

/**
 * La causa, dicha por su nombre. Los dos tests de arriba cazan el síntoma sea cual
 * sea su origen; este fija la propiedad concreta que lo produjo, para que el mensaje
 * de fallo apunte al sitio en vez de dejar a quien lo lea buscando.
 */
test('CA-17: el pie fija su eje y no lo hereda del sistema de diseño', async ({ page }) => {
  await page.goto('/legal');

  for (const ancho of ANCHOS) {
    const medida = await medirPie(page, ancho);

    expect(
      medida.direccion,
      `a ${ancho} px el pie no declara su eje: hereda ` +
        `\`footer { flex-direction: column }\` de design/tremen-ds/responsive.css, y ahí ` +
        `el flex-basis del descargo se vuelve altura`,
    ).toBe('row');
  }
});
