import { test, expect, type Page } from '@playwright/test';
import { ponerRol, rolDe } from './roles';
import { abrirDeParEnPar } from './grifo';

/**
 * SPEC-037 CA-25 (no degradar lo entregado) — la GEOMETRÍA de `/admin` y de la
 * pantalla de registro cerrado, medida en el navegador a varios anchos.
 *
 * ## Por qué existe este fichero
 *
 * Porque ya pasó, y costó una ronda RED entera. `design/tremen-ds/responsive.css`
 * estiliza **por selector de elemento** (`footer`, `nav`, `h1`…) y por debajo de
 * 720 px cambia ejes: en SPEC-035, `.app-footer` no declaraba su `flex-direction`, lo
 * heredó del sistema, y ahí el `flex: 1 1 320px` del descargo **dejó de ser un ancho
 * y pasó a ser un alto** — 452 px de pie en móvil, con ~280 px de hueco muerto, y una
 * suite de 879 tests en verde que no lo vio porque todos preguntaban por el
 * *contenido* y ninguno por la *forma*.
 *
 * `/admin` es pantalla nueva y trae cuatro contenedores propios (`.ops-bloque`,
 * `.ops-cifras`, `.ops-datos`, `.ops-form`). Todos se declaran `display: grid` a
 * propósito, que es la forma de no tener ese modo de fallo. Esto lo MIDE.
 *
 * ## Qué mide, y por qué así
 *
 * Nada de comparar capturas: una prueba de imagen se rompe cuando cambia una fuente y
 * eso no es lo que hay que proteger. Lo que se protege son tres invariantes de caja:
 *
 *   1. **La página no desborda a lo ancho.** `scrollWidth` no puede superar el ancho
 *      de la ventana: una pantalla de operación que hay que arrastrar en horizontal
 *      en el móvil no sirve para lo que existe — mirarla deprisa a las 23:00.
 *   2. **Ningún bloque reserva alto que su contenido no ocupe.** Es la traducción
 *      literal del defecto de SPEC-035: la caja mide mucho más que su texto.
 *   3. **Los contenedores declaran su eje.** Si alguno apareciera con un
 *      `flex-direction` heredado, el mensaje de fallo apunta al sitio en vez de dejar
 *      a quien lo lea buscando.
 *
 * Los anchos son los del finding de SPEC-035: 390 (móvil), 640 y 700 (por debajo del
 * breakpoint de 720), 760 (justo por encima) y 1280 (escritorio).
 */

const ANCHOS = [390, 640, 700, 760, 1280] as const;
const PWD = 'clave-secreta-123';
const SHOTS = '_qa/SPEC-037';

/** Holgura entre la caja de un bloque y lo que ocupa su contenido, en px. */
const HOLGURA_PX = 60;

type Medida = {
  ancho: number;
  desbordeH: number;
  bloques: { testid: string; alto: number; altoContenido: number; display: string }[];
};

async function medir(page: Page, ancho: number): Promise<Medida> {
  await page.setViewportSize({ width: ancho, height: 900 });
  await page.locator('main.page').waitFor({ state: 'visible' });

  return {
    ancho,
    ...(await page.evaluate(() => {
      const doc = document.documentElement;
      const bloques = [...document.querySelectorAll('[data-testid]')]
        .filter((el) => el.classList.contains('ops-bloque'))
        .map((el) => {
          const caja = el.getBoundingClientRect();
          // Lo que de verdad ocupa el contenido: del borde superior del primer hijo
          // al inferior del último. Si la caja mide mucho más, hay hueco muerto.
          const hijos = [...el.children].map((h) => h.getBoundingClientRect());
          const arriba = Math.min(...hijos.map((r) => r.top));
          const abajo = Math.max(...hijos.map((r) => r.bottom));
          return {
            testid: el.getAttribute('data-testid')!,
            alto: caja.height,
            altoContenido: hijos.length === 0 ? caja.height : abajo - arriba,
            display: getComputedStyle(el).display,
          };
        });
      return { desbordeH: doc.scrollWidth - doc.clientWidth, bloques };
    })),
  };
}

const describir = (m: Medida) =>
  `ancho ${m.ancho}: desbordeH=${m.desbordeH} ` +
  m.bloques
    .map(
      (b) =>
        `${b.testid}[display=${b.display} alto=${Math.round(b.alto)} contenido=${Math.round(
          b.altoContenido,
        )}]`,
    )
    .join(' ');

test.describe('SPEC-037 CA-25: /admin no rompe la maquetación a ningún ancho', () => {
  /**
   * Cada test de Playwright estrena contexto, así que hay que volver a entrar. La
   * cuenta se crea la primera vez y se reutiliza después: se pregunta a la BASE si ya
   * existe (`rolDe`) en vez de deducirlo de lo que se vea en la pantalla, que es lo
   * que hacía que el segundo test se quedara colgado en un «email ya registrado».
   */
  test.beforeEach(async ({ page }) => {
    const email = 'spec037-medidas@example.com';
    const yaExiste = (await rolDe(email)) !== null;
    await page.goto(yaExiste ? '/login' : '/register');
    await page.fill('input[name="email"]', email);
    await page.fill('input[name="password"]', PWD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard');
    await ponerRol(email, 'admin');
    await page.goto('/admin');
  });

  test.afterAll(async () => {
    await abrirDeParEnPar();
  });

  test('la página no desborda a lo ancho en ninguno de los cinco anchos', async ({ page }) => {
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

  test('ningún bloque reserva alto que su contenido no ocupe', async ({ page }) => {
    for (const ancho of ANCHOS) {
      const m = await medir(page, ancho);
      expect(m.bloques.length, `no se midió ningún bloque a ${ancho} px`).toBeGreaterThanOrEqual(3);

      for (const b of m.bloques) {
        expect(
          b.alto,
          `hueco muerto en "${b.testid}" a ${ancho} px: la caja mide ${Math.round(b.alto)} px y ` +
            `su contenido solo ${Math.round(b.altoContenido)} px — es el síntoma de un ` +
            `flex-basis interpretado como ALTURA (${describir(m)})`,
        ).toBeLessThanOrEqual(b.altoContenido + HOLGURA_PX);
      }
    }
  });

  test('los bloques declaran su eje y no lo heredan del sistema de diseño', async ({ page }) => {
    for (const ancho of ANCHOS) {
      const m = await medir(page, ancho);
      for (const b of m.bloques) {
        expect(
          b.display,
          `a ${ancho} px el bloque "${b.testid}" no es un grid: si vuelve a ser un flex sin eje ` +
            `declarado, hereda \`flex-direction: column\` de design/tremen-ds/responsive.css`,
        ).toBe('grid');
      }
    }
  });

  test('capturas y medidas de los cinco anchos', async ({ page }) => {
    for (const ancho of ANCHOS) {
      const m = await medir(page, ancho);
      // Las medidas se IMPRIMEN, no solo se comprueban: así el número queda en el
      // registro de la ejecución y quien revise no tiene que fiarse de un «pasa».
      console.log(`[SPEC-037 CA-25] ${describir(m)}`);
      await page.screenshot({ path: `${SHOTS}/ancho-${ancho}-admin.png`, fullPage: true });
    }
  });
});

/**
 * La otra pantalla nueva de esta spec. Es más simple —un `card` con dos párrafos—
 * pero la mide igual: es la primera cosa que ve quien llega del foro un domingo por
 * la noche, y llega desde el móvil.
 */
test('SPEC-037 CA-25: la pantalla de registro cerrado tampoco desborda', async ({ page }) => {
  const { ponerGrifo } = await import('./grifo');
  await ponerGrifo({ openManually: false, capacity: null });
  try {
    for (const ancho of ANCHOS) {
      await page.setViewportSize({ width: ancho, height: 900 });
      await page.goto('/register');
      await page.getByTestId('registro-cerrado').waitFor({ state: 'visible' });

      const medida = await page.evaluate(() => {
        const doc = document.documentElement;
        const caja = document.querySelector('[data-testid="registro-cerrado"]')!;
        const hijos = [...caja.children].map((h) => h.getBoundingClientRect());
        const rect = caja.getBoundingClientRect();
        return {
          desbordeH: doc.scrollWidth - doc.clientWidth,
          display: getComputedStyle(caja).display,
          alto: rect.height,
          altoContenido:
            Math.max(...hijos.map((r) => r.bottom)) - Math.min(...hijos.map((r) => r.top)),
        };
      });

      expect(medida.desbordeH, `desborda a ${ancho} px`).toBeLessThanOrEqual(1);
      expect(medida.display, `no es grid a ${ancho} px`).toBe('grid');
      expect(
        medida.alto,
        `hueco muerto a ${ancho} px: caja ${Math.round(medida.alto)} px, contenido ` +
          `${Math.round(medida.altoContenido)} px`,
      ).toBeLessThanOrEqual(medida.altoContenido + HOLGURA_PX);

      await page.screenshot({ path: `${SHOTS}/ancho-${ancho}-registro-cerrado.png`, fullPage: true });
    }
  } finally {
    await abrirDeParEnPar();
  }
});
