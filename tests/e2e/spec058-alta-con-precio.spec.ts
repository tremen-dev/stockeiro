import { mkdirSync } from 'node:fs';
import postgres from 'postgres';
import { test, expect, type Page } from '@playwright/test';
import { AVISO_LO_EMITE_EL_CICLO } from '../../src/lib/help/content';
import { DB_URL } from './roles';
import { entrar } from './spec041';

/**
 * SPEC-058 **CA-3** y la mitad de pantalla de **CA-11**, en navegador y sobre la app
 * real, con `E2E_FAKE_QUOTES=1` (el catálogo de `quote-provider-factory`).
 *
 * ## Lo que CA-3 exige y por qué aquí NO se recarga
 *
 * *«En la propia respuesta a ese envío —sin navegar, sin recargar y sin ninguna acción
 * adicional— la fila nueva enseña precio, fecha del precio y el color de fondo del estado
 * de zona»*. Por eso este fichero **no llama a `page.reload()` ni una vez**: si hiciera
 * falta recargar, lo que se estaría midiendo es que el precio acabó en la base, que ya lo
 * miden los tests de la action. Lo que se mide aquí es la consecuencia de que la
 * revalidación vaya **después** del refresco (ADR-038 pto. 4).
 *
 * ## Las dos direcciones de CA-11
 *
 * La frase del desacompasamiento se enseña **cuando hay algo en zona**, que es cuando la
 * pantalla se puede leer como una promesa de correo. Así que se comprueban las dos: con
 * la única fila **fuera** de zona no está, y en cuanto una entra, aparece. Sin la primera
 * mitad, «se ve la frase» pasaría igual con la frase pintada siempre.
 *
 * ## Estado de partida
 *
 * Los símbolos son **compartidos** (ADR-002) y la base del e2e es una sola, así que otra
 * spec puede haber dejado ya una cotización de estos tickers. Se borran a propósito antes
 * de empezar: el escenario de CA-3 es *«el símbolo no tiene precio y el alta se lo trae»*,
 * y heredar un precio ajeno haría verde este test sin que el refresco hubiera ocurrido.
 */

const SHOTS = '_qa/SPEC-058';
const CUENTA = 'spec058-alta@example.com';

async function conSql<T>(fn: (sql: ReturnType<typeof postgres>) => Promise<T>): Promise<T> {
  const sql = postgres(DB_URL, { ssl: false, max: 1 });
  try {
    return await fn(sql);
  } finally {
    await sql.end();
  }
}

/** Deja el símbolo SIN precio y SIN motivo: el punto de partida de CE-1. */
const borrarCotizaciones = (tickers: string[]) =>
  conSql(async (sql) => {
    const filas = await sql`SELECT id FROM symbols WHERE ticker IN ${sql(tickers)}`;
    for (const s of filas) {
      await sql`DELETE FROM quotes WHERE symbol_id = ${s.id}`;
      await sql`DELETE FROM quote_diagnostics WHERE symbol_id = ${s.id}`;
    }
  });

const alta = (page: Page) => page.locator('form', { hasText: 'Vigilar una acción' });

/** Elige del buscador y envía el alta con su zona de compra. Un solo gesto, sin recargar. */
async function vigilar(page: Page, busqueda: string, ticker: string, min: string, max: string) {
  const form = alta(page);
  if (!(await form.isVisible())) await page.getByTestId('alta-toggle').click();
  await form.locator('.symbol-search-input').fill(busqueda);
  await form.locator('.symbol-result', { hasText: ticker }).first().click();
  await form.locator('input[name="buyMin"]').fill(min);
  await form.locator('input[name="buyMax"]').fill(max);
  await form.locator('button[type="submit"]').click();
}

test('SPEC-058 CA-3/CA-11: el alta trae el precio en la misma respuesta, y la espera del aviso se cuenta', async ({
  page,
}) => {
  mkdirSync(SHOTS, { recursive: true });
  await entrar(page, CUENTA);
  await borrarCotizaciones(['ITX', 'REP']);
  await page.goto('/vigiladas');

  // ── CA-3, con la zona FUERA del precio ────────────────────────────────────────────
  // ITX cotiza a 53,72 en el catálogo del e2e; la zona 10–15 no lo contiene, así que el
  // color que le corresponde es el de «fuera de zona». Que la fila lleve precio y fecha
  // es lo que hasta esta spec no pasaba hasta el ciclo diario siguiente.
  await vigilar(page, 'Inditex', 'ITX', '10', '15');

  const itx = page.locator('tr', { hasText: 'ITX' });
  await expect(itx).toBeVisible();
  await expect(itx, 'el precio que devolvió el proveedor').toContainText('53.72');
  await expect(itx, 'la fecha del precio (D-2)').toContainText('2026-07-14');
  await expect(itx, 'el color del estado de zona que le corresponde').toHaveClass(/zone-out/);
  // Y sin haber recargado: esta es la propiedad, no un detalle del arnés.

  // CA-11, primera dirección: nada en zona, así que la frase NO está.
  await expect(page.getByTestId('vigiladas-aviso-del-ciclo')).toHaveCount(0);
  await page.screenshot({ path: `${SHOTS}/ca3-alta-trae-precio-fuera-de-zona.png`, fullPage: true });

  // ── CA-3 otra vez, ahora con el precio DENTRO de la zona ──────────────────────────
  await vigilar(page, 'Repsol', 'REP', '12', '13');

  const rep = page.locator('tr', { hasText: 'REP' });
  await expect(rep).toContainText('12.10');
  await expect(rep, 'la fila nace pintada en zona de compra').toHaveClass(/zone-buy/);
  await expect(rep).toContainText('En zona de compra');

  // CA-11, segunda dirección: hay algo en zona, así que la pantalla explica que el aviso
  // lo emite el ciclo — y con la MISMA frase que `/ayuda`, no con una copia.
  const frase = page.getByTestId('vigiladas-aviso-del-ciclo');
  await expect(frase).toBeVisible();
  await expect(frase).toHaveText(AVISO_LO_EMITE_EL_CICLO);
  await page.screenshot({ path: `${SHOTS}/ca11-en-zona-el-aviso-es-del-ciclo.png`, fullPage: true });
});

test('SPEC-058 CA-11: /ayuda cuenta lo mismo, y con la misma frase', async ({ page }) => {
  await page.goto('/ayuda');
  const cadencia = page.getByTestId('ayuda-cadencia');
  await expect(cadencia).toContainText(AVISO_LO_EMITE_EL_CICLO);
  // Y la sección ya no dice que el ciclo sea quien pide los precios: dice que es el
  // único que compara con las zonas y avisa (D-2), que es lo que sigue siendo verdad.
  await expect(cadencia).toContainText('único que compara');
  await page.screenshot({ path: `${SHOTS}/ca11-ayuda-cadencia.png`, fullPage: true });
});
