import { mkdirSync, writeFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import {
  DEFECTOS,
  TOLERANCIA_PX,
  describirRespuestaAlGesto,
  describirViolaciones,
  inyectarDefecto,
  medirDesbordeDeDocumento,
  medirDesbordePorElemento,
  medirIntegridadDePalabra,
  medirRespuestaAlGesto,
  ponerVentana,
} from './geometria';
import { entrar, sembrarVigiladas } from './spec041';
import {
  ANCHO_DE_DERIVACION,
  CUENTA,
  SHOTS,
  afirmarListaLarga,
  capa,
  cerrarCapa,
  derivarListaLarga,
  editarEnFila,
  listaLarga,
  subirDelTodo,
} from './spec046';

/**
 * SPEC-046 CA-10 — **la prueba de eficacia de M4**, y el gemelo exacto de SPEC-040 CA-8.
 *
 * ## Por qué esto es el centro de la spec y no un extra
 *
 * Mover la superficie de edición son unas líneas de CSS. Lo que evita que la familia
 * entera vuelva es que **la medida vea el defecto**, y eso no se demuestra teniendo la
 * suite en verde: la suite **ya estuvo en verde** con el panel de edición a cuarenta filas
 * del gesto, medido a los ocho anchos por `vigiladas-editar.spec.ts`.
 *
 * Así que aquí se hace lo que exige **ADR-026 §7**: se **reinyecta el defecto** en tiempo
 * de ejecución, con CSS, sobre **la misma página**, y se afirman los **cuatro hechos** en
 * el mismo test:
 *
 *  1. sin defecto, **M4 no reporta nada** (el caso de control, la mitad que suele faltar);
 *  2. con el defecto, **M4 reporta violación con la cifra** —a cuántos píxeles por debajo
 *     del pliegue quedó la superficie—;
 *  3. con el defecto puesto, **M1, M2 y M3 no ven absolutamente nada**;
 *  4. y quitando el defecto, M4 vuelve a callar.
 *
 * El hecho 3 es el que importa de verdad. Es la razón por la que M4 tenía que existir: no
 * es que las tres medidas viejas estuvieran mal escritas —están bien—, es que **sólo ven
 * lo que preguntan**, y ninguna preguntaba por el eje vertical.
 */

test('SPEC-046 CA-10: con la capa devuelta al flujo, M4 la caza con la cifra y M1/M2/M3 no ven nada', async ({
  page,
}) => {
  test.slow();
  mkdirSync(SHOTS, { recursive: true });

  const total = await derivarListaLarga(page);
  await entrar(page, CUENTA);
  await sembrarVigiladas(CUENTA, listaLarga(total));
  await page.goto('/vigiladas');
  await page.locator('table.data-table').waitFor({ state: 'visible' });

  const relato: string[] = [];

  for (const ancho of [360, ANCHO_DE_DERIVACION] as const) {
    await ponerVentana(page, ancho);
    await subirDelTodo(page);
    const precondicion = await afirmarListaLarga(page, ancho);

    // ── (1) El caso de control: sin reinyectar nada, M4 no reporta nada ───────────
    const sano = await medirRespuestaAlGesto(page, {
      disparador: editarEnFila(page, 0),
      revelado: capa(page),
      etiqueta: `${ancho} px · sin defecto`,
    });
    expect(
      sano.viola,
      `sin reinyectar nada, M4 ya se queja a ${ancho} px — el caso de control no vale: ` +
        describirRespuestaAlGesto(sano),
    ).toBe(false);
    await cerrarCapa(page);

    // ── (2) El defecto de SPEC-044, devuelto: la capa vuelve al flujo tras la tabla ──
    await subirDelTodo(page);
    const quitar = await inyectarDefecto(page, DEFECTOS.capaDeEdicionEnElFlujo);
    const enfermo = await medirRespuestaAlGesto(page, {
      disparador: editarEnFila(page, 0),
      revelado: capa(page),
      etiqueta: `${ancho} px · defecto reinyectado`,
    });

    // ── (3) Y sobre LA MISMA PÁGINA, con el defecto puesto y la capa abierta, las tres
    //        medidas horizontales no ven absolutamente nada ─────────────────────────
    const m1 = await medirDesbordePorElemento(page, {
      testigos: 'dialog[data-testid="editar-panel"]',
    });
    const m2 = await medirDesbordeDeDocumento(page);
    const m3 = await medirIntegridadDePalabra(
      page,
      'dialog[data-testid="editar-panel"] strong, dialog[data-testid="editar-panel"] label, ' +
        'dialog[data-testid="editar-panel"] button',
      'dialog[data-testid="editar-panel"]',
    );

    // CA-17(a): el «antes», con la distancia medida en píxeles.
    await page.screenshot({ path: `${SHOTS}/antes-${ancho}.png`, fullPage: false });
    await quitar();

    const linea =
      `${describirRespuestaAlGesto(enfermo)} · M1 ${m1.violaciones.length} violaciones de ` +
      `${m1.medidos} medidos (testigos de la capa: ${m1.testigos.length}) · M2 desborde ` +
      `${m2.desborde} · M3 ${m3.filter((t) => t.lineas > Math.max(1, t.palabras)).length} ` +
      `rótulos partidos · precondición: ${precondicion.elementos} filas, fondo de la tabla ` +
      `${Math.round(precondicion.porDebajoDelPliegue)} px por debajo del pliegue`;
    relato.push(linea);
    console.log(`[SPEC-046 CA-10] ${linea}`);

    // (2) M4 lo caza, **con la cifra**.
    expect(
      enfermo.viola,
      `con la capa devuelta al flujo a ${ancho} px, M4 NO ve nada. La guardia no está ` +
        `midiendo lo que dice medir, y el defecto de SPEC-044 volvería a pasar por verde: ` +
        describirRespuestaAlGesto(enfermo),
    ).toBe(true);
    expect(
      Math.round(enfermo.porDebajoDelPliegue),
      `M4 se queja pero no por lo que debe: la superficie tendría que quedar POR DEBAJO del ` +
        `pliegue y no llega. ${describirRespuestaAlGesto(enfermo)}`,
    ).toBeGreaterThan(0);
    expect(
      describirRespuestaAlGesto(enfermo),
      'el mensaje de M4 no lleva la cifra medida. «Se veía mal» sin número es lo que no ' +
        'convence a nadie de arreglarlo (CA-17)',
    ).toContain('POR DEBAJO DEL PLIEGUE');

    // (3) Y las tres medidas horizontales, ciegas.
    expect(
      m1.testigos,
      `a ${ancho} px la capa ni siquiera entró en el conjunto que M1 midió: entonces su ` +
        `«cero violaciones» no dice nada de ella y este test no demuestra la ceguera`,
    ).not.toEqual([]);
    expect(
      m1.violaciones.length,
      `M1 SÍ ve el defecto de colocación vertical a ${ancho} px, y no debería: si lo viera, ` +
        `M4 no habría hecho falta y este test hay que reescribirlo con lo que sea cierto ` +
        `ahora.\n${describirViolaciones(m1)}`,
    ).toBe(0);
    expect(
      m2.desborde,
      `M2 SÍ ve el defecto a ${ancho} px (documento ${m2.documento}/${m2.ventana}), y no ` +
        `debería: una superficie por debajo del pliegue no desplaza el documento a lo ancho`,
    ).toBeLessThanOrEqual(TOLERANCIA_PX);
    expect(
      m3.filter((t) => t.lineas > Math.max(1, t.palabras)).map((t) => t.texto),
      `M3 SÍ ve el defecto a ${ancho} px, y no debería: la colocación vertical no parte ` +
        `ninguna palabra`,
    ).toEqual([]);

    // ── (4) Quitado el defecto, M4 vuelve a callar ────────────────────────────────
    await cerrarCapa(page);
    await subirDelTodo(page);
    const curado = await medirRespuestaAlGesto(page, {
      disparador: editarEnFila(page, 0),
      revelado: capa(page),
      etiqueta: `${ancho} px · defecto retirado`,
    });
    expect(
      curado.viola,
      `retirado el defecto, M4 sigue quejándose a ${ancho} px: entonces se queja de otra ` +
        `cosa. ${describirRespuestaAlGesto(curado)}`,
    ).toBe(false);
    await cerrarCapa(page);
  }

  writeFileSync(
    `${SHOTS}/m4-eficacia.txt`,
    `SPEC-046 CA-10 — la capa devuelta al flujo detrás de la tabla: M4 la caza, M1/M2/M3 no\n` +
      `${relato.join('\n')}\n`,
    'utf8',
  );
});
