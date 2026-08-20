import { test, expect } from '@playwright/test';
import {
  DEFECTOS,
  TOLERANCIA_PX,
  describirViolaciones,
  inyectarDefecto,
  medirDesbordeDeDocumento,
  medirDesbordePorElemento,
  medirIntegridadDePalabra,
  ponerVentana,
} from './geometria';
import { CUENTA_VACIA, asegurarVigilada, entrar } from './spec040';

/**
 * SPEC-040 CA-7 y CA-8 — **la prueba de eficacia de la guardia**.
 *
 * ## Por qué esto es el centro de la spec y no un extra
 *
 * Los tres arreglos de maquetación de SPEC-040 son unas pocas líneas de CSS. Lo que
 * evita que la familia entera vuelva es que la medida **vea** el defecto, y eso no se
 * demuestra teniendo la suite en verde: la suite YA estuvo en verde con el botón
 * «Vigilar» fuera de la pantalla, durante cuatro specs.
 *
 * Así que aquí se hace lo que exige **ADR-026 §7**: se **reinyecta cada defecto** en
 * tiempo de ejecución, con CSS, y se comprueba que **la misma función de medida** que
 * usan CA-3, CA-4 y CA-5 reporta violación — con la cifra en el mensaje. Y que sin
 * reinyectar nada, no la reporta. Si una guardia no se pone roja al devolverle el
 * defecto, no está midiendo lo que dice medir.
 *
 * Es el patrón que ya funcionó en SPEC-035.
 *
 * ## CA-8: por qué no basta con `scrollWidth`
 *
 * El último test toma **las dos** medidas sobre la MISMA página con el defecto (a)
 * puesto, y afirma las dos cifras: la de documento **no ve nada** —porque
 * `html, body { overflow-x: hidden }` la enmascara— y la de elemento **sí lo ve**.
 * Existe para que nadie vuelva a sustituir la segunda por la primera creyendo que son
 * equivalentes. Es la lección de `V-SPEC-039-6`, escrita como comprobación.
 */

test.describe('SPEC-040 CA-7: la guardia caza los tres defectos al reinyectarlos', () => {
  test('(a) el formulario de alta que no puede encoger — M1 lo ve, a 360 y a 390', async ({
    page,
  }) => {
    await entrar(page, CUENTA_VACIA);
    await page.goto('/vigiladas');
    await page.locator('form.auth-form').waitFor({ state: 'visible' });

    for (const ancho of [360, 390] as const) {
      await ponerVentana(page, ancho);

      // Sin inyectar: no hay violación. Es la mitad que suele faltar.
      const sano = await medirDesbordePorElemento(page);
      expect(
        sano.violaciones.length,
        `sin reinyectar nada, /vigiladas ya viola M1 a ${ancho} px — el caso de control ` +
          `no vale:\n${describirViolaciones(sano)}`,
      ).toBe(0);

      const quitar = await inyectarDefecto(page, DEFECTOS.formularioQueNoEncoge);
      const enfermo = await medirDesbordePorElemento(page);
      await quitar();

      expect(
        enfermo.violaciones.length,
        `con el defecto (a) reinyectado a ${ancho} px, M1 NO ve nada. La guardia no está ` +
          `midiendo lo que dice medir.`,
      ).toBeGreaterThan(0);

      const peor = enfermo.peor!;
      // La cifra, en el registro de la ejecución: es lo que distingue «pasa» de «mira».
      console.log(
        `[SPEC-040 CA-7a] ${ancho} px · defecto reinyectado → ${enfermo.violaciones.length} ` +
          `violaciones; peor ${peor.selector} ancho=${Math.round(peor.ancho)} ` +
          `right=${Math.round(peor.derecha)} sobre ventana ${peor ? enfermo.ventana : 0}`,
      );
      expect(
        Math.round(peor.ancho),
        `el defecto (a) reinyectado debería devolver la columna a ~444 px y sólo llega a ` +
          `${Math.round(peor.ancho)}: la inyección no está reproduciendo la causa real`,
      ).toBeGreaterThan(enfermo.ventana);

      // Y el botón «Vigilar» —el que cierra CE-1— vuelve a estar entre los que se salen.
      const botonFuera = enfermo.violaciones.some((v) => v.selector.startsWith('button'));
      expect(
        botonFuera,
        `con el defecto (a) puesto a ${ancho} px, el botón «Vigilar» NO aparece entre los ` +
          `elementos fuera de la ventana:\n${describirViolaciones(enfermo)}`,
      ).toBe(true);
    }
  });

  test('(b) el panel de tres columnas a 390 px — M3 lo ve', async ({ page }) => {
    await entrar(page, CUENTA_VACIA);
    await page.goto('/dashboard');
    await page.locator('.cards').waitFor({ state: 'visible' });
    await ponerVentana(page, 390);

    const roto = (textos: Awaited<ReturnType<typeof medirIntegridadDePalabra>>) =>
      textos.filter((t) => t.lineas > t.palabras);

    const sano = await medirIntegridadDePalabra(page, '.card h3, .card .num', '.card');
    expect(sano.length, 'no se midió ningún título de tarjeta').toBeGreaterThan(0);
    expect(
      roto(sano).map((t) => `${t.texto}: ${t.lineas} líneas / ${t.palabras} palabras`),
      'sin reinyectar nada, el panel ya parte palabras a 390 px — el caso de control no vale',
    ).toEqual([]);

    const quitar = await inyectarDefecto(page, DEFECTOS.panelDeTresColumnasSiempre);
    const enfermo = await medirIntegridadDePalabra(page, '.card h3, .card .num', '.card');
    const pistas = await page.evaluate(
      () => getComputedStyle(document.querySelector('.cards')!).gridTemplateColumns,
    );
    await quitar();

    const rotos = roto(enfermo);
    console.log(
      `[SPEC-040 CA-7b] 390 px · .cards reinyectado como "${pistas}" → ` +
        rotos
          .map((t) => `«${t.texto}» ${t.lineas} líneas para ${t.palabras} palabras`)
          .join(' · '),
    );
    expect(
      rotos.length,
      `con .cards devuelto a repeat(3, 1fr) a 390 px ("${pistas}"), M3 NO ve ninguna palabra ` +
        `partida. Es el defecto que ninguna medida de DESBORDE puede ver, así que si M3 no ` +
        `lo caza no lo caza nadie.\n` +
        enfermo
          .map((t) => `  «${t.texto}»: ${t.lineas} líneas / ${t.palabras} palabras`)
          .join('\n'),
    ).toBeGreaterThan(0);
  });

  test('(c) la tabla sin contenedor propio a 760 px — M2 y M1 lo ven', async ({ page }) => {
    await asegurarVigilada(page);
    await page.goto('/vigiladas');
    await page.locator('table.data-table').waitFor({ state: 'visible' });
    await ponerVentana(page, 760);

    const docSano = await medirDesbordeDeDocumento(page);
    const m1Sano = await medirDesbordePorElemento(page);
    expect(
      docSano.desborde,
      `sin reinyectar nada, /vigiladas ya desplaza el documento a 760 px ` +
        `(${docSano.documento}/${docSano.ventana}) — el caso de control no vale`,
    ).toBeLessThanOrEqual(TOLERANCIA_PX);
    expect(m1Sano.violaciones.length, describirViolaciones(m1Sano)).toBe(0);

    const quitar = await inyectarDefecto(page, DEFECTOS.tablaSinContenedorPropio);
    const docEnfermo = await medirDesbordeDeDocumento(page);
    const m1Enfermo = await medirDesbordePorElemento(page);
    await quitar();

    console.log(
      `[SPEC-040 CA-7c] 760 px · .table-scroll con overflow-x: visible → documento ` +
        `${docEnfermo.documento}/${docEnfermo.ventana} (desborde ${docEnfermo.desborde}); ` +
        `M1 ${m1Enfermo.violaciones.length} violaciones, peor ${m1Enfermo.peor?.selector} ` +
        `right=${Math.round(m1Enfermo.peor?.derecha ?? 0)}`,
    );
    expect(
      docEnfermo.desborde,
      `con el defecto (c) reinyectado a 760 px, la medida de documento NO ve el ` +
        `desplazamiento (${docEnfermo.documento}/${docEnfermo.ventana})`,
    ).toBeGreaterThan(TOLERANCIA_PX);
    expect(
      m1Enfermo.violaciones.length,
      `con el defecto (c) reinyectado a 760 px, M1 tampoco ve nada`,
    ).toBeGreaterThan(0);
  });
});

test('SPEC-040 CA-8: con el defecto (a) puesto, la medida de documento NO lo ve y la de elemento SÍ', async ({
  page,
}) => {
  await entrar(page, CUENTA_VACIA);
  await page.goto('/vigiladas');
  await page.locator('form.auth-form').waitFor({ state: 'visible' });
  await ponerVentana(page, 390);

  const quitar = await inyectarDefecto(page, DEFECTOS.formularioQueNoEncoge);
  const documento = await medirDesbordeDeDocumento(page);
  const porElemento = await medirDesbordePorElemento(page);
  await quitar();

  const relato =
    `documento: ocupa ${documento.documento} en una ventana de ${documento.ventana} ` +
    `(desborde ${documento.desborde}) · por elemento: ${porElemento.violaciones.length} ` +
    `violaciones, peor ${porElemento.peor?.selector} ancho=` +
    `${Math.round(porElemento.peor?.ancho ?? 0)} right=${Math.round(
      porElemento.peor?.derecha ?? 0,
    )} sobre ventana ${porElemento.ventana}`;
  console.log(`[SPEC-040 CA-8] 390 px · ${relato}`);

  // (1) La medida de documento no ve NADA. No porque el defecto no esté, sino porque
  //     `html, body { overflow-x: hidden }` del sistema de diseño recorta al hijo sin
  //     mover `scrollWidth`. Esto es lo que dejó la suite en verde durante cuatro specs.
  expect(
    documento.desborde,
    `la medida de documento SÍ ve el defecto (a) — entonces ya no es cierto que ` +
      `\`overflow-x: hidden\` la enmascare, y este test hay que reescribirlo con lo que ` +
      `sea cierto ahora: ${relato}`,
  ).toBeLessThanOrEqual(TOLERANCIA_PX);

  // (2) Y la medida por elemento sí lo ve, con nombre y cifra.
  expect(
    porElemento.violaciones.length,
    `la medida por elemento tampoco ve el defecto (a): ${relato}`,
  ).toBeGreaterThan(0);
  expect(
    Math.round(porElemento.peor!.derecha),
    `el peor elemento no llega a salirse de la ventana: ${relato}`,
  ).toBeGreaterThan(porElemento.ventana);
});
