import { describe, it, expect } from 'vitest';
import {
  AFIRMACIONES_PROHIBIDAS_AYUDA,
  EJEMPLOS_PERMITIDOS,
  EJEMPLOS_PROHIBIDOS,
  afirmacionesProhibidasEn,
} from './ayuda-afirmaciones-prohibidas';
import {
  AVISOS,
  CADENCIA,
  MERCADOS_SECCION,
  MOTIVOS_SIN_PRECIO,
  PRECIOS,
  QUE_HACE,
  QUE_NO_HACE,
  SIN_PRECIO_SECCION,
  ZONAS,
} from '@/lib/help/content';

/**
 * SPEC-039 CA-7 — la ayuda y la primera pantalla no prometen lo que D-1, D-2 y D-4
 * prohíben.
 *
 * El fichero tiene DOS mitades y el orden importa:
 *
 *  1. La guardia se prueba a sí misma contra sus ejemplos. Una regla que decide qué
 *     es una afirmación y qué es su negación se puede equivocar en los dos sentidos:
 *     dejar pasar «te avisamos al instante» o prohibir «esto no es tiempo real», que
 *     es la frase que la spec existe para escribir. Las dos listas de ejemplos viven
 *     junto a los patrones y se ejercitan antes que nada.
 *  2. Solo entonces se le pasa el texto real de la ayuda.
 *
 * La mitad que mira el HTML renderizado —incluido el pie, que no sale de este
 * módulo— está en `tests/e2e/ayuda.spec.ts`.
 */

const textoDeLaAyuda = () =>
  [
    QUE_HACE,
    QUE_NO_HACE,
    ...[CADENCIA, ZONAS, AVISOS, PRECIOS].flatMap((s) => [s.titulo, ...s.parrafos]),
    MERCADOS_SECCION.titulo,
    MERCADOS_SECCION.intro,
    MERCADOS_SECCION.cierre,
    SIN_PRECIO_SECCION.titulo,
    SIN_PRECIO_SECCION.intro,
    ...MOTIVOS_SIN_PRECIO.flatMap((m) => [m.titulo, m.texto]),
  ].join('\n');

describe('la guardia se prueba a sí misma antes de juzgar a nadie', () => {
  it('la lista no está vacía y cada entrada lleva su motivo escrito', () => {
    expect(AFIRMACIONES_PROHIBIDAS_AYUDA.length).toBeGreaterThan(5);
    for (const { patron, motivo } of AFIRMACIONES_PROHIBIDAS_AYUDA) {
      expect(motivo.length, `${patron} sin motivo`).toBeGreaterThan(40);
    }
  });

  it.each(EJEMPLOS_PROHIBIDOS)('caza «%s»', (frase) => {
    expect(
      afirmacionesProhibidasEn(frase),
      'esta frase tendría que estar prohibida y la guardia la deja pasar',
    ).not.toEqual([]);
  });

  it.each(EJEMPLOS_PERMITIDOS)('deja pasar «%s»', (frase) => {
    const violaciones = afirmacionesProhibidasEn(frase);
    expect(
      violaciones.map((v) => `${v.patron} → ${v.fragmento}`),
      'la guardia prohíbe una frase que la spec pide escribir: el patrón está mal, no la frase',
    ).toEqual([]);
  });

  it('un «no» de la frase ANTERIOR no exculpa a la siguiente', () => {
    const texto = 'Stockeiro no opera por ti. Las cotizaciones llegan en tiempo real.';
    expect(afirmacionesProhibidasEn(texto).length).toBe(1);
  });
});

describe('SPEC-039 CA-7: el texto de la ayuda no promete lo que D-2 prohíbe', () => {
  it('ni una sola afirmación prohibida en toda la ayuda', () => {
    const violaciones = afirmacionesProhibidasEn(textoDeLaAyuda());
    expect(
      violaciones.map((v) => `${v.fragmento}\n   → ${v.motivo}`),
      'la ayuda dice algo que una decisión locked prohíbe',
    ).toEqual([]);
  });

  it('y lo dice al revés: la cadencia aparece negada, no omitida', () => {
    // Callarse el tiempo real pasaría esta guardia igual que decir lo contrario. R-4
    // exige lo segundo: que se diga alto, y en negativo.
    expect(textoDeLaAyuda()).toMatch(/no es tiempo real/i);
  });
});
