import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';

/**
 * SPEC-036 CA-15 (no degradar lo entregado) — la GEOMETRÍA de `/cuenta`, medida en
 * el navegador a varios anchos.
 *
 * ## Por qué existe este fichero
 *
 * SPEC-035 entregó un pie con **879 tests en verde** que medía 452 px de alto en
 * móvil, con 280 px de hueco muerto, en todas las páginas de la app. No lo vio nadie
 * porque todos los tests preguntaban por el *contenido* —que el texto esté— y
 * ninguno por la *forma*. Costó una ronda RED entera.
 *
 * Esta spec entrega pantalla (`/cuenta`) y además toca la barra de navegación
 * compartida, que aparece en todas las páginas de dentro. Las dos cosas se miden, y
 * se miden con números, no con razonamientos.
 *
 * ## Qué mide, y por qué así
 *
 * Nada de comparar capturas: una prueba de imagen se rompe cuando cambia una fuente
 * o un color, y ninguna de esas dos cosas es lo que hay que proteger. Lo que se
 * protege son cuatro invariantes de caja:
 *
 *   1. **La página no se desborda a lo ancho.** Es el síntoma más barato de
 *      diagnosticar y el más caro de sufrir: una tabla, una lista o un botón que
 *      sobresalen obligan a hacer scroll lateral en toda la pantalla.
 *   2. **Ningún elemento de `main` se sale del viewport.** El (1) puede ocultarse si
 *      algo tiene `overflow: hidden`; esto lo caza igual.
 *   3. **La zona de borrado no reserva alto que su contenido no ocupa** — la misma
 *      medida que delató el hueco muerto del pie: la caja frente a la unión real de
 *      las cajas de sus hijos, descontando su propio `padding`.
 *   4. **La navegación no se dispara al estrechar la ventana.** Esta spec le añade un
 *      enlace; si eso rompiera el reparto, lo rompería en TODAS las páginas de dentro.
 *
 * Los anchos son los mismos que usa `pie-responsive.spec.ts`: 390 (móvil), 640 y 700
 * (por debajo del breakpoint de 720 del sistema de diseño), 760 (justo por encima) y
 * 1280 (escritorio, la referencia).
 */

const SHOTS = '_qa/SPEC-036';
const ANCHOS = [390, 640, 700, 760, 1280] as const;
const PWD = 'clave-secreta-123';

/** Alto máximo de la barra de navegación en móvil respecto al de escritorio. */
const FACTOR_MAXIMO_NAV = 3;

/** Holgura entre la caja de una sección y lo que ocupa su contenido, en px. */
const HOLGURA_PX = 40;

async function registrarYEntrar(page: Page, email: string) {
  await page.goto('/register');
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', PWD);
  await page.click('button[type="submit"]');
  await page.waitForURL('**/dashboard');
}

type Medida = {
  ancho: number;
  anchoDocumento: number;
  anchoVentana: number;
  /** El elemento de `main` que más se sale por la derecha, y cuánto. */
  desbordado: { selector: string; derecha: number } | null;
  altoNav: number;
  altoZona: number;
  altoContenidoZona: number;
};

async function medir(page: Page, ancho: number): Promise<Medida> {
  await page.setViewportSize({ width: ancho, height: 900 });
  await page.locator('main').waitFor({ state: 'visible' });

  return {
    ancho,
    ...(await page.evaluate(() => {
      const ventana = document.documentElement.clientWidth;

      // (2) El elemento de `main` que más se sale por la derecha.
      let peor: { selector: string; derecha: number } | null = null;
      for (const el of document.querySelectorAll('main *')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.right > ventana + 1 && (!peor || r.right > peor.derecha)) {
          peor = {
            selector: `${el.tagName.toLowerCase()}${el.className ? `.${String(el.className).split(' ')[0]}` : ''}`,
            derecha: r.right,
          };
        }
      }

      const nav = document.querySelector('nav.app-nav');
      const zona = document.querySelector('[data-testid="zona-de-borrado"]');

      // (3) Lo que de verdad ocupa el contenido de la zona: de lo más alto de sus
      // hijos a lo más bajo. Es la medida que delata una caja con hueco muerto.
      let altoContenidoZona = 0;
      if (zona) {
        const hijos = [...zona.children]
          .map((c) => c.getBoundingClientRect())
          .filter((r) => r.width > 0 || r.height > 0);
        if (hijos.length > 0) {
          altoContenidoZona =
            Math.max(...hijos.map((r) => r.bottom)) - Math.min(...hijos.map((r) => r.top));
        }
        const estilo = getComputedStyle(zona);
        altoContenidoZona +=
          parseFloat(estilo.paddingTop || '0') + parseFloat(estilo.paddingBottom || '0');
      }

      return {
        anchoDocumento: document.documentElement.scrollWidth,
        anchoVentana: ventana,
        desbordado: peor,
        altoNav: nav ? nav.getBoundingClientRect().height : 0,
        altoZona: zona ? zona.getBoundingClientRect().height : 0,
        altoContenidoZona,
      };
    })),
  };
}

const describir = (m: Medida) =>
  `ancho ${m.ancho}: documento=${Math.round(m.anchoDocumento)} ventana=${m.anchoVentana} ` +
  `nav=${Math.round(m.altoNav)} zona=${Math.round(m.altoZona)} ` +
  `contenidoZona=${Math.round(m.altoContenidoZona)}`;

/**
 * Las medidas se dejan escritas en `_qa/SPEC-036/`, junto a las capturas.
 *
 * Un test que pasa no imprime nada, y aquí lo que importa no es solo que pase: son
 * los NÚMEROS. La ronda RED de SPEC-035 se resolvió cuando alguien midió 452 px; con
 * las medidas en un fichero, la siguiente persona que toque esta pantalla puede
 * comparar contra lo que había en vez de volver a descubrirlo.
 */
function guardarMedidas(nombre: string, medidas: Medida[]) {
  mkdirSync(SHOTS, { recursive: true });
  writeFileSync(
    `${SHOTS}/${nombre}`,
    `SPEC-036 CA-15 — geometría medida en el navegador\n${medidas.map(describir).join('\n')}\n`,
    'utf8',
  );
}

test.describe('CA-15: /cuenta se maqueta bien en todos los anchos', () => {
  test('ni se desborda a lo ancho ni deja hueco muerto en la zona de borrado', async ({ page }) => {
    await registrarYEntrar(page, `geo-cuenta-${Date.now()}@ejemplo.test`);
    await page.goto('/cuenta');

    const medidas: Medida[] = [];
    for (const ancho of ANCHOS) medidas.push(await medir(page, ancho));
    const informe = medidas.map(describir).join('\n');
    guardarMedidas('medidas-cuenta.txt', medidas);

    for (const m of medidas) {
      // (1) Nada de scroll lateral.
      expect(
        m.anchoDocumento,
        `la página se desborda a lo ancho a ${m.ancho} px\n${informe}`,
      ).toBeLessThanOrEqual(m.anchoVentana + 1);

      // (2) Y ningún elemento se sale, aunque algo lo recorte.
      expect(
        m.desbordado,
        `a ${m.ancho} px un elemento de main se sale del viewport: ` +
          `${m.desbordado?.selector} llega a ${Math.round(m.desbordado?.derecha ?? 0)} px\n${informe}`,
      ).toBeNull();

      // (3) La zona de borrado mide lo que ocupa su contenido, ni un dedo más.
      expect(m.altoContenidoZona, 'no se midió el contenido de la zona').toBeGreaterThan(0);
      expect(
        m.altoZona,
        `hueco muerto en la zona de borrado a ${m.ancho} px: la caja mide ` +
          `${Math.round(m.altoZona)} px y su contenido solo ${Math.round(m.altoContenidoZona)} px ` +
          `— es el síntoma de un flex-basis interpretado como ALTURA\n${informe}`,
      ).toBeLessThanOrEqual(m.altoContenidoZona + HOLGURA_PX);
    }
  });

  test('la navegación no se dispara al estrechar la ventana', async ({ page }) => {
    // El enlace a /cuenta lo pinta `AppNav`, que sale en TODAS las páginas de dentro:
    // un defecto suyo no sería de esta pantalla, sería de la app entera.
    await registrarYEntrar(page, `geo-nav-${Date.now()}@ejemplo.test`);

    for (const ruta of ['/dashboard', '/cuenta']) {
      await page.goto(ruta);
      const medidas: Medida[] = [];
      for (const ancho of ANCHOS) medidas.push(await medir(page, ancho));

      const informe = medidas.map(describir).join('\n');
      guardarMedidas(`medidas-nav${ruta.replace('/', '-')}.txt`, medidas);
      const escritorio = medidas.find((m) => m.ancho === 1280)!;
      expect(escritorio.altoNav, `no se midió la navegación en ${ruta}`).toBeGreaterThan(0);

      for (const m of medidas) {
        expect(
          m.altoNav,
          `la navegación se dispara a ${m.ancho} px en ${ruta} (referencia 1280: ` +
            `${Math.round(escritorio.altoNav)} px)\n${informe}`,
        ).toBeLessThanOrEqual(escritorio.altoNav * FACTOR_MAXIMO_NAV);
      }
    }
  });

  test('la confirmación pública tampoco se desborda', async ({ page }) => {
    await page.goto('/cuenta-borrada');

    const medidas: Medida[] = [];
    for (const ancho of ANCHOS) {
      const m = await medir(page, ancho);
      medidas.push(m);
      expect(
        m.anchoDocumento,
        `/cuenta-borrada se desborda a lo ancho a ${ancho} px (${describir(m)})`,
      ).toBeLessThanOrEqual(m.anchoVentana + 1);
      expect(m.desbordado, `${describir(m)}`).toBeNull();
    }
    guardarMedidas('medidas-cuenta-borrada.txt', medidas);
  });
});
