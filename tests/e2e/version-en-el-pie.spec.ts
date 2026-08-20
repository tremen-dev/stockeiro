import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import {
  ANCHOS,
  describirDesborde,
  describirViolaciones,
  medirDesborde,
  ponerVentana,
} from './geometria';
import { CUENTA_VACIA, entrar } from './spec040';

/**
 * SPEC-038 CA-1, CA-2 y CA-4 — la versión, dentro de la app y de verdad.
 *
 * ## Qué ancla esto que los unitarios no pueden
 *
 * `tests/version-presentacion.test.ts` prueba el FORMATO caso a caso, sin navegador.
 * Lo que solo se ve con la app corriendo es lo que CE-3 pide literalmente:
 *
 *  - que la versión esté **en el pie de cualquier página**, con sesión y sin ella
 *    (CA-1) — el pie va en el layout raíz, así que alcanzar `/login` y `/dashboard`
 *    con el mismo texto es la prueba de que no depende del usuario (RN-03);
 *  - que lo que se lee sea **el semver, primero, y copiable** (CA-2);
 *  - y que **coincida con `/api/version` del MISMO despliegue** (CA-4): el semver
 *    idéntico, el commit mostrado prefijo exacto del suyo y la fecha el mismo
 *    instante. No por inspección: comparando las dos cosas en la misma pasada.
 *
 * ## Y la geometría, porque esto sale en TODAS las páginas
 *
 * El pie se monta en el layout raíz: un defecto suyo de maquetación es un defecto de
 * la app entera. Ya pasó una vez —SPEC-035 lo entregó midiendo 452 px en móvil, con
 * 879 tests en verde— y costó una ronda RED entera. Aquí se mide con el módulo
 * compartido de ADR-026 (`tests/e2e/geometria.ts`), a los ocho anchos del proyecto y
 * con M1 (elemento a elemento), que es la única que `overflow: hidden` no enmascara.
 *
 * ## La cuenta
 *
 * No se registra ninguna: se REUTILIZA `spec040-vacio@example.com`. El grifo tiene
 * cupo 50 y la suite ya gasta cuarenta y tantas altas; añadir una más por una spec
 * que no necesita datos propios sería gastar cupo ajeno para nada. Lo único que
 * hace falta de la sesión es que el pie se pinte igual estando dentro.
 */

const SHOTS = '_qa/SPEC-038';

/** Públicas: cualquiera las ve sin haber tecleado nada. */
const PUBLICAS = ['/login', '/legal/terminos'] as const;

/** De dentro: solo con sesión. */
const AUTENTICADAS = ['/dashboard', '/vigiladas'] as const;

const pie = (page: Page) => page.locator('footer.app-footer');
const version = (page: Page) => pie(page).locator('[data-testid="version"]');

/** Lo que el navegador acaba pintando en la fila de la versión. */
async function leerVersion(page: Page) {
  await version(page).waitFor({ state: 'visible' });
  return {
    texto: (await version(page).innerText()).trim(),
    semver: (await version(page).locator('[data-testid="version-semver"]').innerText()).trim(),
    commit: (await version(page).locator('[data-testid="version-commit"]').innerText()).trim(),
    construido: (
      await version(page).locator('[data-testid="version-construido"]').innerText()
    ).trim(),
    construidoISO: await version(page)
      .locator('[data-testid="version-construido"]')
      .getAttribute('datetime'),
  };
}

test.describe('CA-1: la versión se ve, con sesión y sin ella', () => {
  for (const ruta of PUBLICAS) {
    test(`${ruta} la enseña en el pie, sin sesión`, async ({ page }) => {
      await page.goto(ruta);

      await expect(version(page)).toHaveCount(1);
      await expect(version(page)).toBeVisible();
      expect((await leerVersion(page)).semver).toMatch(/^v\d+\.\d+\.\d+$/);
    });
  }

  test('las páginas de dentro también, y con el MISMO texto', async ({ page }) => {
    await page.goto('/login');
    const anonima = await leerVersion(page);

    await entrar(page, CUENTA_VACIA);

    for (const ruta of AUTENTICADAS) {
      await page.goto(ruta);
      const dentro = await leerVersion(page);
      expect(dentro.texto, `${ruta} enseña otra versión que /login`).toBe(anonima.texto);
    }
  });

  test('el pie sigue teniendo UN solo enlace a los términos: no se ha duplicado nada', async ({
    page,
  }) => {
    // La fila de la versión se añade al pie de SPEC-035; lo que aquella spec fijó
    // no puede perderse por el camino.
    await page.goto('/legal/terminos');
    await expect(pie(page).locator('a[href="/legal/terminos"]')).toHaveCount(1);
    await expect(pie(page).locator('[data-testid="feedback-enlace"]')).toHaveCount(1);
    expect(await pie(page).innerText()).toContain('Stockeiro, un proyecto de tremen.dev');
  });
});

test.describe('CA-2: el número que se enseña es el semver, y es citable', () => {
  test('el semver va PRIMERO, con el commit y la fecha detrás', async ({ page }) => {
    await page.goto('/login');
    const leido = await leerVersion(page);

    expect(leido.semver).toMatch(/^v\d+\.\d+\.\d+$/);
    expect(leido.texto.startsWith(leido.semver)).toBe(true);
    expect(leido.texto.indexOf(leido.semver)).toBeLessThan(leido.texto.indexOf(leido.commit));
    expect(leido.texto.indexOf(leido.commit)).toBeLessThan(
      leido.texto.indexOf(leido.construido),
    );
  });

  test('es TEXTO: ni una imagen, ni un tooltip, ni contenido generado por CSS', async ({
    page,
  }) => {
    await page.goto('/login');

    // Ni imagen ni SVG dentro de la fila.
    await expect(version(page).locator('img, svg, canvas')).toHaveCount(0);
    // Y no vive en un `title=`: un tooltip no se copia y no se lee en un móvil.
    expect(await version(page).getAttribute('title')).toBeNull();

    const copiable = await version(page).evaluate((el) => {
      const estilo = getComputedStyle(el);
      const antes = getComputedStyle(el, '::before').content;
      const despues = getComputedStyle(el, '::after').content;
      return {
        seleccion: estilo.userSelect,
        // Contenido metido por CSS no entra en el portapapeles.
        generado: [antes, despues].filter((c) => c !== 'none' && c !== 'normal' && c !== '""'),
        // Lo que de verdad se llevaría el portapapeles.
        seleccionado: (() => {
          const rango = document.createRange();
          rango.selectNodeContents(el);
          return rango.toString().trim();
        })(),
      };
    });

    expect(copiable.seleccion).not.toBe('none');
    expect(copiable.generado, 'la versión no puede venir de un ::before/::after').toEqual([]);
    expect(copiable.seleccionado).toBe((await leerVersion(page)).texto);
  });
});

test.describe('CA-4: coincide con /api/version, y se comprueba de verdad', () => {
  test('el mismo despliegue dice lo mismo en el pie y en el endpoint', async ({ page }) => {
    await page.goto('/login');
    const enElPie = await leerVersion(page);

    // MISMA página, mismo servidor: `page.request` comparte contexto con la
    // navegación de arriba, así que no hay forma de comparar dos despliegues.
    const cuerpo = await (await page.request.get('/api/version')).json();

    expect(Object.keys(cuerpo).sort()).toEqual(['builtAt', 'commit', 'environment', 'version']);

    // 1. El semver es IDÉNTICO (la `v` es del rótulo, no del número).
    expect(enElPie.semver).toBe(`v${cuerpo.version}`);

    // 2. El commit mostrado es PREFIJO EXACTO del que sirve el endpoint.
    expect(cuerpo.commit.startsWith(enElPie.commit)).toBe(true);
    expect(enElPie.commit.length).toBeGreaterThan(0);

    // 3. La fecha corresponde al MISMO instante.
    expect(enElPie.construidoISO).not.toBeNull();
    expect(Date.parse(enElPie.construidoISO!)).toBe(Date.parse(cuerpo.builtAt));
  });

  test('también con sesión: la coincidencia no depende de quién mire', async ({ page }) => {
    await entrar(page, CUENTA_VACIA);
    await page.goto('/vigiladas');

    const enElPie = await leerVersion(page);
    const cuerpo = await (await page.request.get('/api/version')).json();

    expect(enElPie.semver).toBe(`v${cuerpo.version}`);
    expect(cuerpo.commit.startsWith(enElPie.commit)).toBe(true);
    expect(Date.parse(enElPie.construidoISO!)).toBe(Date.parse(cuerpo.builtAt));
  });

  test('el enlace de feedback viaja con el MISMO semver (F-SPEC-038-7)', async ({ page }) => {
    await page.goto('/login');

    const href = await pie(page).locator('[data-testid="feedback-enlace"]').getAttribute('href');
    const asunto = new URL(href!).searchParams.get('subject') ?? '';
    const cuerpo = await (await page.request.get('/api/version')).json();

    expect(asunto).toContain(`v${cuerpo.version}`);
    expect(asunto).toContain(cuerpo.commit);
    expect(asunto.indexOf(`v${cuerpo.version}`)).toBeLessThan(asunto.indexOf(cuerpo.commit));
  });
});

test.describe('CA-16: el pie con la versión no rompe la maquetación', () => {
  test('nada se sale de la ventana a los ocho anchos, con y sin sesión', async ({ page }) => {
    const partes: string[] = [];

    for (const ruta of ['/login', '/legal/terminos'] as const) {
      await page.goto(ruta);
      for (const ancho of ANCHOS) {
        const medida = await medirDesborde(page, ancho);
        partes.push(`${ruta} ${describirDesborde(medida)}`);

        expect(
          medida.m1.medidos,
          `no se midió ningún elemento en ${ruta} a ${ancho} px`,
        ).toBeGreaterThan(3);
        expect(
          medida.m1.violaciones.length,
          `${ruta} a ${ancho} px: ${medida.m1.violaciones.length} elementos fuera de la ` +
            `ventana\n${describirViolaciones(medida.m1)}`,
        ).toBe(0);
      }
    }

    mkdirSync(SHOTS, { recursive: true });
    writeFileSync(
      `${SHOTS}/geometria-del-pie.txt`,
      `SPEC-038 CA-16 — desborde con la fila de la versión en el pie\n${partes.join('\n')}\n`,
      'utf8',
    );
  });

  test('la fila de la versión cabe en su caja: su texto no se sale del pie', async ({ page }) => {
    // El modo de fallo propio de esta fila: un renglón largo —semver, entorno,
    // commit y fecha— que a 360 px no envuelve y empuja el ancho. Se mide la caja
    // contra la del pie, que es lo que ADR-026 §4 admite como salida: que quepa.
    await page.goto('/login');

    for (const ancho of ANCHOS) {
      await ponerVentana(page, ancho);
      await version(page).waitFor({ state: 'visible' });

      const cajas = await page.evaluate(() => {
        const fila = document.querySelector('[data-testid="version"]')!.getBoundingClientRect();
        const pie = document.querySelector('footer.app-footer')!.getBoundingClientRect();
        return { filaDerecha: fila.right, pieDerecha: pie.right, filaAlto: fila.height };
      });

      expect(
        cajas.filaDerecha,
        `a ${ancho} px la fila de la versión se sale del pie ` +
          `(${Math.round(cajas.filaDerecha)} > ${Math.round(cajas.pieDerecha)})`,
      ).toBeLessThanOrEqual(cajas.pieDerecha + 1);
      expect(cajas.filaAlto, `a ${ancho} px la fila de la versión no ocupa nada`).toBeGreaterThan(
        0,
      );
    }
  });

  test('captura del pie a 360 y a 1280, para el ledger', async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true });
    await page.goto('/legal/terminos');

    for (const ancho of [360, 1280]) {
      await ponerVentana(page, ancho);
      await version(page).waitFor({ state: 'visible' });
      await pie(page).screenshot({ path: `${SHOTS}/pie-${ancho}.png` });
    }
  });
});
