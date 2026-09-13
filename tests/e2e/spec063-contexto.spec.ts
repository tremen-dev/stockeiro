import { mkdirSync } from 'node:fs';
import postgres from 'postgres';
import { test, expect, type Page } from '@playwright/test';
import { DB_URL } from './roles';
import { ANCHOS, ponerVentana, medirDesbordePorElemento, describirViolaciones } from './geometria';
import { entrar, sembrarVigiladas, type FilaSembrada } from './spec041';

/**
 * SPEC-063 — **la nota y los enlaces, en el navegador**.
 *
 * ## Qué prueba esto que no prueben los unitarios
 *
 * `tests/spec063-contexto.test.ts` demuestra que el **modelo** hace lo que CA-2 a CA-6
 * dicen, y `spec063-enlace.test.ts` que el **filtro** acepta y rechaza lo que debe. Aquí se
 * demuestra lo que ninguno de los dos puede: que el usuario **llega** a eso desde su fila,
 * que lo que escribe **se ve tal cual** —marcado incluido, CA-12— y que la página **no pide
 * la dirección que él pega** (CA-13, la mitad de navegador).
 */

const CUENTA = 'spec063-contexto@example.com';
const SHOTS = '_qa/SPEC-063';

const ESCENARIO: FilaSembrada[] = [
  {
    ticker: 'Z8NOTA',
    micCode: 'BMEX',
    name: 'Con Contexto SA',
    instrumentType: 'Common Stock',
    buyMin: '20',
    buyMax: '25',
    price: '22',
  },
  {
    ticker: 'Z8PELADA',
    micCode: 'BMEX',
    name: 'Sin Contexto SA',
    instrumentType: 'Common Stock',
    buyMin: '10',
    buyMax: '15',
    price: '30',
  },
];

const laFila = (page: Page, ticker: string) =>
  page.locator('table.data-table tbody tr').filter({ hasText: ticker });

/**
 * Deja a la cuenta **sin contexto**, que es lo que `sembrarVigiladas` no puede hacer: la
 * nota y los enlaces cuelgan del **símbolo** y por diseño **sobreviven** a que la vigilada
 * desaparezca (CA-4). Es la propiedad de la spec, no un descuido de la siembra — pero un
 * escenario que no se limpia hace que cada test herede lo que escribió el anterior.
 */
async function limpiarContexto(email: string): Promise<void> {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    const [u] = await sql`SELECT id FROM users WHERE email = ${email}`;
    if (u) {
      await sql`DELETE FROM symbol_notes WHERE user_id = ${u.id}`;
      await sql`DELETE FROM symbol_links WHERE user_id = ${u.id}`;
    }
  } finally {
    await sql.end();
  }
}

async function preparar(page: Page) {
  await entrar(page, CUENTA);
  await sembrarVigiladas(CUENTA, ESCENARIO);
  await limpiarContexto(CUENTA);
  await page.goto('/vigiladas');
  await page.locator('table.data-table').waitFor({ state: 'visible' });
}

/**
 * Abre el panel de esa fila **y despliega el bloque de contexto**, que va plegado a
 * propósito: con él abierto, la capa tapaba la tabla entera y rompía la promesa que
 * SPEC-046 CA-6(f) mide (ADR-030 §1).
 */
async function abrirPanel(page: Page, ticker: string) {
  await laFila(page, ticker).getByTestId('editar-zonas').click();
  await page.getByTestId('editar-panel').waitFor({ state: 'visible' });
  await page.getByTestId('contexto-resumen').click();
  await page.getByTestId('contexto-nota').waitFor({ state: 'visible' });
}

async function cerrarPanel(page: Page) {
  await page.keyboard.press('Escape');
  await page.getByTestId('editar-panel').waitFor({ state: 'hidden' });
}

/**
 * Escribe la nota y **espera al acuse**, no a un reloj. Guardar y cerrar de inmediato es lo
 * que destapó el defecto de sincronización: el panel se reabría antes de que la
 * revalidación llegara y enseñaba la nota en blanco.
 */
async function escribirNota(page: Page, texto: string) {
  await page.getByTestId('contexto-nota').fill(texto);
  await page.getByTestId('contexto-nota-guardar').click();
  await page.getByTestId('contexto-nota-guardada').waitFor({ state: 'visible' });
}

test.describe('SPEC-063 CA-5/CA-6: se escribe y se borra donde se mira la acción', () => {
  test('la nota se escribe en el panel de la fila, y sigue ahí al reabrirlo', async ({ page }) => {
    await preparar(page);

    await abrirPanel(page, 'Z8NOTA');
    await escribirNota(page, 'La sigo por el dividendo; zonas del análisis del 3 de marzo.');
    await expect(page.getByTestId('contexto-nota-error')).toHaveCount(0);
    await cerrarPanel(page);

    // Sin recargar a mano: la acción revalida y el panel se vuelve a abrir con lo escrito.
    await abrirPanel(page, 'Z8NOTA');
    await expect(page.getByTestId('contexto-nota')).toHaveValue(
      'La sigo por el dividendo; zonas del análisis del 3 de marzo.',
    );

    // Y vaciarla la borra: al reabrir, no vuelve.
    await escribirNota(page, '');
    await cerrarPanel(page);
    await abrirPanel(page, 'Z8NOTA');
    await expect(page.getByTestId('contexto-nota')).toHaveValue('');
  });

  test('un enlace se añade, se ve con su etiqueta y se quita', async ({ page }) => {
    await preparar(page);
    await abrirPanel(page, 'Z8NOTA');

    await page.getByTestId('contexto-url').fill('https://es.tradingview.com/symbols/BME-ITX/');
    await page.getByTestId('contexto-etiqueta').fill('Mi gráfico');
    await page.getByTestId('contexto-enlace-anadir').click();

    const enlace = page.getByTestId('contexto-enlace').first();
    await expect(enlace).toHaveText('Mi gráfico');
    await expect(enlace).toHaveAttribute('href', 'https://es.tradingview.com/symbols/BME-ITX/');
    await expect(enlace).toHaveAttribute('rel', 'noopener noreferrer');

    await page.getByTestId('contexto-enlace-quitar').first().click();
    await expect(page.getByTestId('contexto-enlace')).toHaveCount(0);
  });

  test('sin etiqueta, el enlace se presenta por su dominio — no por una inventada', async ({
    page,
  }) => {
    await preparar(page);
    await abrirPanel(page, 'Z8NOTA');

    await page.getByTestId('contexto-url').fill('https://www.eldiariodelabolsa.example.com/hilo/42');
    await page.getByTestId('contexto-enlace-anadir').click();

    await expect(page.getByTestId('contexto-enlace').first()).toHaveText(
      'eldiariodelabolsa.example.com',
    );
  });
});

test.describe('SPEC-063 CA-7: el contexto y las zonas no se pisan', () => {
  test('guardar la nota deja las cuatro zonas donde estaban', async ({ page }) => {
    await preparar(page);
    await abrirPanel(page, 'Z8NOTA');

    const zonasAntes = await laFila(page, 'Z8NOTA').locator('td').allInnerTexts();
    await escribirNota(page, 'una nota cualquiera');
    await cerrarPanel(page);

    const zonasDespues = await laFila(page, 'Z8NOTA').locator('td').allInnerTexts();
    // La celda de Activo gana la señal de contexto; las de zona, precio y estado, no.
    expect(zonasDespues.slice(1)).toEqual(zonasAntes.slice(1));
  });
});

test.describe('SPEC-063 CA-9/CA-10: la fila dice que hay contexto', () => {
  test('con contexto aparece la señal, sin contexto no hay marca — y la señal habla', async ({
    page,
  }) => {
    await preparar(page);

    // Antes de escribir nada: ninguna de las dos filas tiene señal.
    await expect(page.getByTestId('contexto-senal')).toHaveCount(0);

    await abrirPanel(page, 'Z8NOTA');
    await escribirNota(page, 'ahora sí');
    await cerrarPanel(page);

    const senal = laFila(page, 'Z8NOTA').getByTestId('contexto-senal');
    await expect(senal).toHaveCount(1);
    await expect(senal).toHaveAttribute('aria-label', 'Tiene nota tuya');
    // La otra dirección, en la misma pantalla: la fila sin contexto sigue sin marca.
    await expect(laFila(page, 'Z8PELADA').getByTestId('contexto-senal')).toHaveCount(0);

    // Y al añadir un enlace, la frase cuenta las dos cosas.
    await abrirPanel(page, 'Z8NOTA');
    await page.getByTestId('contexto-url').fill('https://foro.example.com/hilo');
    await page.getByTestId('contexto-enlace-anadir').click();
    await cerrarPanel(page);
    await expect(senal).toHaveAttribute('aria-label', 'Tiene nota tuya y 1 enlace');
  });
});

test.describe('SPEC-063 CA-11: un enlace del usuario no es un vector', () => {
  test('`javascript:` se rechaza con motivo y no se guarda; el enlace bueno entra', async ({
    page,
  }) => {
    await preparar(page);
    await abrirPanel(page, 'Z8NOTA');

    await page.getByTestId('contexto-url').fill('javascript:alert(1)');
    await page.getByTestId('contexto-enlace-anadir').click();

    await expect(page.getByTestId('contexto-enlace-error')).toBeVisible();
    await expect(page.getByTestId('contexto-enlace-error')).toContainText('http');
    await expect(page.getByTestId('contexto-enlace')).toHaveCount(0);

    // La otra dirección, sin recargar: el enlace legítimo sí entra.
    await page.getByTestId('contexto-url').fill('https://foro.example.com/hilo/42?orden=fecha#final');
    await page.getByTestId('contexto-enlace-anadir').click();
    await expect(page.getByTestId('contexto-enlace')).toHaveCount(1);
  });
});

test.describe('SPEC-063 CA-12/CA-13: el texto es texto, y la app no visita nada', () => {
  test('una nota con marcado se ve tal cual y no se ejecuta', async ({ page }) => {
    await preparar(page);
    await abrirPanel(page, 'Z8NOTA');

    const veneno = '<script>window.__colado = true</script><b>negrita</b>';
    await escribirNota(page, veneno);
    await cerrarPanel(page);
    await abrirPanel(page, 'Z8NOTA');

    // Se ve tal cual, con sus signos: es contenido de un textarea, no marcado.
    await expect(page.getByTestId('contexto-nota')).toHaveValue(veneno);
    // Y nada se ha ejecutado ni se ha convertido en un elemento de la página.
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__colado)).toBeUndefined();
    expect(await page.locator('.contexto-bloque b').count()).toBe(0);
  });

  test('guardar un enlace no hace que el navegador pida esa dirección', async ({ page }) => {
    await preparar(page);

    const pedidas: string[] = [];
    page.on('request', (r) => pedidas.push(r.url()));

    await abrirPanel(page, 'Z8NOTA');
    await page.getByTestId('contexto-url').fill('https://no-deberia-pedirse.example.com/x');
    await page.getByTestId('contexto-enlace-anadir').click();
    await expect(page.getByTestId('contexto-enlace')).toHaveCount(1);

    expect(
      pedidas.filter((u) => u.includes('no-deberia-pedirse.example.com')),
      'la app no visita lo que el usuario pega: ni para validarlo, ni para previsualizarlo',
    ).toEqual([]);
  });
});

test.describe('SPEC-063 CA-8: el panel sigue siendo el panel', () => {
  test('con el bloque nuevo dentro, nada se sale de la pantalla a ningún ancho', async ({
    page,
  }) => {
    await preparar(page);
    mkdirSync(SHOTS, { recursive: true });

    for (const ancho of ANCHOS) {
      await ponerVentana(page, ancho);
      await page.goto('/vigiladas');
      const editar =
        ancho > 720
          ? laFila(page, 'Z8NOTA').getByTestId('editar-zonas')
          : page.getByTestId('editar-zonas-tarjeta').first();
      await editar.click();
      await page.getByTestId('contexto-bloque').waitFor({ state: 'visible' });

      const m1 = await medirDesbordePorElemento(page);
      expect(m1.violaciones, `a ${ancho} px: ${describirViolaciones(m1)}`).toEqual([]);

      await cerrarPanel(page);
    }

    await ponerVentana(page, 1280);
    await page.goto('/vigiladas');
    await abrirPanel(page, 'Z8NOTA');
    await page.screenshot({ path: `${SHOTS}/panel-contexto-1280.png` });
    await cerrarPanel(page);
    await ponerVentana(page, 390);
    await page.goto('/vigiladas');
    await page.screenshot({ path: `${SHOTS}/tarjetas-senal-390.png`, fullPage: true });
  });

  test('con la nota llena y el bloque desplegado, la lista SIGUE leyéndose detrás', async ({
    page,
  }) => {
    /*
      Esto protege la propiedad de la VECINA en el caso que esta spec introduce.
      SPEC-046 CA-6(f) mide que la capa deja ver la parte alta de la lista, y la mide con
      el panel **vacío**. Aquí se mide con el bloque de contexto **desplegado y lleno**,
      que es cuando la capa es más alta — el caso que la puso roja mientras se implementaba
      esto. Sin esta guardia, plegar el bloque «arreglaría» el rojo de hoy y dejaría la
      promesa rota para quien tenga contexto de verdad.
    */
    await preparar(page);
    await ponerVentana(page, 1280);

    await abrirPanel(page, 'Z8NOTA');
    await escribirNota(page, 'x'.repeat(600));
    for (const n of [1, 2, 3]) {
      await page.getByTestId('contexto-url').fill(`https://e${n}.example.com/un/camino/largo`);
      await page.getByTestId('contexto-enlace-anadir').click();
    }

    const hayFilaVisible = await page.evaluate(() => {
      const capa = document.querySelector('dialog.editar-vigilada')!.getBoundingClientRect();
      return [...document.querySelectorAll('table.data-table tbody tr')].some(
        (tr) => tr.getBoundingClientRect().bottom <= capa.top,
      );
    });
    expect(
      hayFilaVisible,
      'con el contexto desplegado la capa tapa la tabla entera: ADR-030 §1 exige que la ' +
        'parte alta de la lista se siga viendo, y SPEC-046 CA-6(f) lo mide sobre el panel vacío',
    ).toBe(true);
  });

  test('y el foco vuelve a su fila al cerrar, como midió SPEC-046', async ({ page }) => {
    await preparar(page);
    await abrirPanel(page, 'Z8NOTA');
    await page.getByTestId('contexto-nota').click();
    await cerrarPanel(page);

    const enfocado = await page.evaluate(
      () => document.activeElement?.getAttribute('data-watched-id') ?? null,
    );
    expect(enfocado, 'el foco tiene que volver al control que abrió la capa').not.toBeNull();
  });
});
