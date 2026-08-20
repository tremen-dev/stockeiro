import { test, expect, type Page } from '@playwright/test';
import { rolDe } from './roles';

/**
 * SPEC-039 CA-17 (no degradar lo entregado) — la GEOMETRÍA de las dos pantallas
 * nuevas, medida en el navegador a varios anchos.
 *
 * ## Por qué existe este fichero
 *
 * Porque ya pasó dos veces y la primera costó una ronda RED entera.
 * `design/tremen-ds/responsive.css` estiliza **por selector de elemento** (`footer`,
 * `nav`, `h1`…) y por debajo de 720 px cambia ejes: en SPEC-035, `.app-footer` no
 * declaraba su `flex-direction`, lo heredó del sistema, y ahí el `flex: 1 1 320px`
 * del descargo **dejó de ser un ancho y pasó a ser un alto** — 452 px de pie en
 * móvil, con ~280 px de hueco muerto, y una suite de 879 tests en verde que no lo vio
 * porque todos preguntaban por el *contenido* y ninguno por la *forma*.
 *
 * Esta spec entrega dos pantallas nuevas —la primera pantalla y `/ayuda`— y la
 * primera de las dos es literalmente lo que ve un desconocido que pincha un enlace
 * del foro **desde el móvil, un domingo por la noche**. Si esa se ve mal, da igual lo
 * que diga.
 *
 * Todos sus contenedores se declaran `display: grid` a propósito: un grid de una
 * columna no tiene ese modo de fallo. Esto lo MIDE, no lo razona.
 *
 * ## Qué mide, y por qué así
 *
 * Nada de comparar capturas: una prueba de imagen se rompe cuando cambia una fuente y
 * eso no es lo que hay que proteger. Se protegen tres invariantes de caja, los mismos
 * que fijó SPEC-037:
 *
 *   1. **La página no desborda a lo ancho.** `scrollWidth` no puede superar el ancho
 *      de la ventana.
 *   2. **Ningún bloque reserva alto que su contenido no ocupe.** Es la traducción
 *      literal del defecto de SPEC-035.
 *   3. **Los contenedores declaran su eje.** Si alguno apareciera con un
 *      `flex-direction` heredado, el mensaje de fallo apunta al sitio.
 *
 * Los anchos son los del finding de SPEC-035: 390 (móvil), 640 y 700 (por debajo del
 * breakpoint de 720), 760 (justo por encima) y 1280 (escritorio).
 *
 * Las dos pantallas nuevas son públicas y no necesitan cuenta. El estado vacío de
 * `/vigiladas` sí —y es la tercera superficie nueva de esta spec, `.empty-guia`—, así
 * que **reutiliza la misma cuenta** que `tests/e2e/ayuda.spec.ts` en vez de dar de
 * alta otra: la base del e2e es una sola y el cupo del registro se agota. Ver la nota
 * del cupo en aquel fichero.
 */

const ANCHOS = [390, 640, 700, 760, 1280] as const;
const SHOTS = '_qa/SPEC-039';

/**
 * Holgura entre la caja ÚTIL de un bloque y lo que ocupa su contenido, en px.
 *
 * Mucho más apretada que los 60 px de SPEC-037 porque aquí se mide mejor: al alto de
 * la caja se le resta su propio `padding` vertical antes de comparar. El padding es
 * espacio declarado a propósito y contarlo como hueco muerto obligaría a aflojar el
 * umbral hasta dejar de cazar el defecto que este test existe para cazar — en
 * `main.ayuda`, 72 px de padding se comían más que toda la holgura de SPEC-037.
 * Restándolo, la caja y el contenido coinciden al píxel y lo que queda es margen de
 * redondeo.
 */
const HOLGURA_PX = 12;

/** Los contenedores propios de esta spec. Todos tienen que ser grid. */
const CONTENEDORES = [
  '.landing',
  '.landing-acciones',
  '.ayuda',
  '.ayuda-indice',
  '.ayuda-seccion',
  '.ayuda-mercados',
  '.ayuda-motivos',
  '.empty-guia',
].join(', ');

type Bloque = { selector: string; alto: number; altoContenido: number; display: string };
type Medida = { ancho: number; desbordeH: number; bloques: Bloque[] };

async function medir(page: Page, ancho: number): Promise<Medida> {
  await page.setViewportSize({ width: ancho, height: 900 });
  await page.locator('main').first().waitFor({ state: 'visible' });

  return {
    ancho,
    ...(await page.evaluate((selectores) => {
      const doc = document.documentElement;
      const bloques = [...document.querySelectorAll(selectores)].map((el) => {
        const caja = el.getBoundingClientRect();
        const estilo = getComputedStyle(el);
        const relleno =
          parseFloat(estilo.paddingTop || '0') + parseFloat(estilo.paddingBottom || '0');
        // Lo que de verdad ocupa el contenido: del borde superior del primer hijo al
        // inferior del último. Si la caja mide mucho más, hay hueco muerto.
        const hijos = [...el.children].map((h) => h.getBoundingClientRect());
        const arriba = Math.min(...hijos.map((r) => r.top));
        const abajo = Math.max(...hijos.map((r) => r.bottom));
        return {
          selector: `${el.tagName.toLowerCase()}.${[...el.classList].join('.')}`,
          // Alto ÚTIL: sin el padding, que es espacio pedido y no hueco muerto.
          alto: caja.height - relleno,
          altoContenido: hijos.length === 0 ? caja.height : abajo - arriba,
          display: getComputedStyle(el).display,
        };
      });
      return { desbordeH: doc.scrollWidth - doc.clientWidth, bloques };
    }, CONTENEDORES)),
  };
}

const describir = (m: Medida) =>
  `ancho ${m.ancho}: desbordeH=${m.desbordeH} ` +
  m.bloques
    .map(
      (b) =>
        `${b.selector}[display=${b.display} alto=${Math.round(b.alto)} contenido=${Math.round(
          b.altoContenido,
        )}]`,
    )
    .join(' ');

for (const [nombre, ruta] of [
  ['la primera pantalla', '/'],
  ['la ayuda', '/ayuda'],
] as const) {
  test.describe(`SPEC-039 CA-17: ${nombre} no rompe la maquetación a ningún ancho`, () => {
    test(`no desborda a lo ancho en ninguno de los cinco anchos (${ruta})`, async ({ page }) => {
      await page.goto(ruta);

      const medidas: Medida[] = [];
      for (const ancho of ANCHOS) medidas.push(await medir(page, ancho));

      const informe = medidas.map(describir).join('\n');
      for (const m of medidas) {
        expect(
          m.desbordeH,
          `a ${m.ancho} px la pantalla se sale por la derecha\n${informe}`,
        ).toBeLessThanOrEqual(1);
      }
    });

    test(`ningún bloque reserva alto que su contenido no ocupe (${ruta})`, async ({ page }) => {
      await page.goto(ruta);

      for (const ancho of ANCHOS) {
        const m = await medir(page, ancho);
        expect(m.bloques.length, `no se midió ningún bloque a ${ancho} px`).toBeGreaterThanOrEqual(
          2,
        );

        for (const b of m.bloques) {
          expect(
            b.alto,
            `hueco muerto en "${b.selector}" a ${ancho} px: la caja mide ${Math.round(b.alto)} ` +
              `px y su contenido solo ${Math.round(b.altoContenido)} px — es el síntoma de un ` +
              `flex-basis interpretado como ALTURA (${describir(m)})`,
          ).toBeLessThanOrEqual(b.altoContenido + HOLGURA_PX);
        }
      }
    });

    test(`los contenedores declaran su eje y no lo heredan (${ruta})`, async ({ page }) => {
      await page.goto(ruta);

      for (const ancho of ANCHOS) {
        const m = await medir(page, ancho);
        for (const b of m.bloques) {
          expect(
            b.display,
            `a ${ancho} px el bloque "${b.selector}" no es un grid: si fuera un flex sin eje ` +
              `declarado, heredaría \`flex-direction: column\` de ` +
              `design/tremen-ds/responsive.css`,
          ).toBe('grid');
        }
      }
    });

    test(`capturas y medidas de los cinco anchos (${ruta})`, async ({ page }) => {
      await page.goto(ruta);
      const nombreFichero = ruta === '/' ? 'primera-pantalla' : 'ayuda';

      for (const ancho of ANCHOS) {
        const m = await medir(page, ancho);
        // Las medidas se IMPRIMEN, no solo se comprueban: así el número queda en el
        // registro de la ejecución y quien revise no tiene que fiarse de un «pasa».
        console.log(`[SPEC-039 CA-17] ${ruta} — ${describir(m)}`);
        await page.screenshot({
          path: `${SHOTS}/ancho-${ancho}-${nombreFichero}.png`,
          fullPage: true,
        });
      }
    });
  });
}

/**
 * El pie ganó una fila (el canal de feedback, CA-12) y va en el layout raíz, así que
 * un defecto suyo alcanza a la app entera. `tests/e2e/pie-responsive.spec.ts` sigue
 * vigilando su proporción; esto mide lo que aquella no puede saber porque es de otra
 * spec: que la fila NUEVA no reserva alto que su texto no ocupa.
 */
test('SPEC-039 CA-17: la fila de feedback del pie no deja hueco muerto', async ({ page }) => {
  await page.goto('/ayuda');

  for (const ancho of ANCHOS) {
    await page.setViewportSize({ width: ancho, height: 900 });
    await page.locator('footer.app-footer [data-testid="feedback"]').waitFor({ state: 'visible' });

    const medida = await page.evaluate(() => {
      const fila = document.querySelector('footer.app-footer [data-testid="feedback"]')!;
      const rango = document.createRange();
      rango.selectNodeContents(fila);
      const lineas = [...rango.getClientRects()];
      return {
        alto: fila.getBoundingClientRect().height,
        altoTexto:
          lineas.length === 0
            ? 0
            : Math.max(...lineas.map((r) => r.bottom)) - Math.min(...lineas.map((r) => r.top)),
      };
    });

    expect(medida.altoTexto, `no se midió el texto del feedback a ${ancho} px`).toBeGreaterThan(0);
    expect(
      medida.alto,
      `hueco muerto en la fila de feedback a ${ancho} px: la caja mide ` +
        `${Math.round(medida.alto)} px y su texto solo ${Math.round(medida.altoTexto)} px`,
    ).toBeLessThanOrEqual(medida.altoTexto + 24);
    console.log(
      `[SPEC-039 CA-17] pie/feedback ancho ${ancho}: alto=${Math.round(medida.alto)} ` +
        `texto=${Math.round(medida.altoTexto)}`,
    );
  }
});


/**
 * La tercera superficie nueva: el bloque que guía dentro del estado vacío de
 * `/vigiladas` (`.empty-guia`, CA-9). Vive dentro de un `.empty` con `place-items:
 * center`, que es exactamente el tipo de contenedor donde un hijo sin ancho declarado
 * hace cosas raras. Se mide con la MISMA cuenta que el resto de la spec.
 */
test('SPEC-039 CA-17: el estado vacío de /vigiladas tampoco desborda ni deja hueco', async ({
  page,
}) => {
  const email = 'spec039-guia@example.com';
  const yaExiste = (await rolDe(email)) !== null;
  await page.goto(yaExiste ? '/login' : '/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', 'clave-secreta-123');
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');

  await page.goto('/vigiladas');
  await page.getByTestId('vigiladas-vacio').waitFor({ state: 'visible' });

  for (const ancho of ANCHOS) {
    const m = await medir(page, ancho);
    console.log(`[SPEC-039 CA-17] /vigiladas vacío — ${describir(m)}`);

    expect(m.desbordeH, `a ${ancho} px la pantalla se sale por la derecha`).toBeLessThanOrEqual(1);
    expect(m.bloques.length, `no se midió .empty-guia a ${ancho} px`).toBeGreaterThanOrEqual(1);
    for (const b of m.bloques) {
      expect(b.display, `"${b.selector}" no declara su eje a ${ancho} px`).toBe('grid');
      expect(
        b.alto,
        `hueco muerto en "${b.selector}" a ${ancho} px: caja ${Math.round(b.alto)} px, ` +
          `contenido ${Math.round(b.altoContenido)} px`,
      ).toBeLessThanOrEqual(b.altoContenido + HOLGURA_PX);
    }
    await page.screenshot({
      path: `${SHOTS}/ancho-${ancho}-vigiladas-vacio.png`,
      fullPage: true,
    });
  }
});
