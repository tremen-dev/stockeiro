import { describe, it, expect } from 'vitest';
import * as contenido from '../src/lib/legal/content';
import { CONSERVACION, DISPONIBILIDAD } from '../src/lib/legal/content';
import { RESET_TOKEN_TTL_MINUTES } from '../src/lib/auth/reset-tokens';
import { AFIRMACIONES_PROHIBIDAS } from './legal-afirmaciones-prohibidas';

/**
 * SPEC-035 CA-7 / CA-8 — que lo que dicen las páginas legales sea lo que el código
 * hace, y que no diga de más.
 *
 * ## Por qué en Vitest y no solo en Playwright
 *
 * `tests/e2e/legal.spec.ts` ya barre el texto RENDERIZADO con la lista de
 * afirmaciones prohibidas, y esa es la comprobación que vale: es lo que lee una
 * persona. Pero exige `npm run build` y un Postgres efímero, así que en la práctica
 * se ejecuta al final. Este fichero mira las mismas cadenas en el módulo puro
 * —`src/lib/legal/content.ts` no importa nada, ver `legal-import-graph.test.ts`—,
 * y se pone rojo en un segundo mientras alguien redacta. No sustituye al e2e: lo
 * adelanta.
 *
 * ## La correspondencia del número
 *
 * CA-5 ata la lista de datos guardados al esquema para que la página no se escriba
 * de memoria. Aquí se hace lo mismo con un número: la privacidad decía que los
 * enlaces de recuperación *"caducan solos y a las pocas horas ya no sirven"* cuando
 * la ventana real es de **30 minutos** (`RESET_TOKEN_TTL_MINUTES`, ADR-015 pto. 4).
 * No era falso, pero era **más laxo que la realidad** — y en un texto legal la
 * imprecisión juega en contra de quien lo firma: describe una exposición mayor de la
 * que hay. El número que se publica sale ahora del mismo sitio que el que aplica el
 * código, comprobado, no confiado.
 */

describe('SPEC-035 CA-7: la caducidad que publica la privacidad es la que aplica el código', () => {
  const texto = CONSERVACION.join(' ');

  it('dice un número de minutos, y es el de RESET_TOKEN_TTL_MINUTES', () => {
    const encontrado = texto.match(/(\d+)\s*minutos/);

    expect(
      encontrado,
      'CONSERVACION tiene que decir la ventana de caducidad en minutos: es el dato ' +
        'que el lector usa para saber cuánto tiempo vive un enlace que le llegó al correo.',
    ).not.toBeNull();

    expect(
      Number(encontrado![1]),
      `la página publica ${encontrado![1]} minutos y el código caduca a los ` +
        `${RESET_TOKEN_TTL_MINUTES} (src/lib/auth/reset-tokens.ts, ADR-015 pto. 4). ` +
        'Si cambia la ventana, cambia el texto en la MISMA PR: una política de privacidad ' +
        'que va por detrás del código es una política falsa.',
    ).toBe(RESET_TOKEN_TTL_MINUTES);
  });

  it('no lo dice con una vaguedad más laxa que la realidad', () => {
    // Estas fórmulas describen una ventana MAYOR que la real. Que no sean mentira no
    // las salva: en un texto legal, decir de más sobre la propia exposición es el
    // error que se paga.
    for (const vaguedad of [
      /pocas\s+horas/i,
      /unas\s+horas/i,
      /algunas\s+horas/i,
      /al\s+cabo\s+de\s+un\s+rato/i,
      /pasado\s+un\s+tiempo/i,
    ]) {
      expect(texto, `CONSERVACION dice ${vaguedad} en vez del plazo real`).not.toMatch(vaguedad);
    }
  });
});

describe('SPEC-035 CA-8: la disponibilidad se describe, no se promete', () => {
  const texto = DISPONIBILIDAD.join(' ');

  it('no compromete un aviso previo antes de cerrar el servicio', () => {
    // El texto llegó a decir: «Si el servicio se fuera a interrumpir de forma
    // definitiva, se avisaría por correo con antelación suficiente para que puedas
    // quedarte con lo tuyo». Era el ÚNICO punto de todas las páginas legales donde se
    // prometía algo en vez de describirlo, no lo pedía ningún CA, y comprometía al
    // titular a una obligación que nadie ha decidido asumir — justo lo contrario de lo
    // que dice el párrafo de al lado («no hay compromiso de servicio»).
    for (const promesa of [/con\s+antelaci[oó]n/i, /aviso\s+previo/i, /se\s+avisar[ií]a/i]) {
      expect(texto, `DISPONIBILIDAD promete ${promesa}`).not.toMatch(promesa);
    }
  });

  it('sigue diciendo lo que sí es verdad: que esto puede caerse y cambiar', () => {
    // Quitar la promesa no puede llevarse por delante la advertencia honesta.
    expect(texto).toMatch(/pruebas/i);
    expect(texto).toMatch(/no\s+hay\s+compromiso/i);
  });
});

/**
 * Todas las cadenas que el módulo publica, sin distinguir sección: si mañana entra
 * un apartado nuevo, entra ya vigilado. Recorrer el módulo entero —y no una lista de
 * exports escrita a mano— es lo que hace que esto no se quede atrás.
 */
function cadenasDe(valor: unknown): string[] {
  if (typeof valor === 'string') return [valor];
  if (Array.isArray(valor)) return valor.flatMap(cadenasDe);
  if (valor !== null && typeof valor === 'object') return Object.values(valor).flatMap(cadenasDe);
  return [];
}

describe('SPEC-035 CA-8: ninguna cadena del módulo dice algo prohibido', () => {
  const cadenas = cadenasDe(contenido);

  it('el recorrido no es vacío', () => {
    // Sin esto, un cambio en la forma del módulo dejaría la comprobación de abajo en
    // verde sin haber mirado nada.
    expect(cadenas.length).toBeGreaterThan(30);
  });

  it.each(AFIRMACIONES_PROHIBIDAS)('no dice $patron', ({ patron, motivo }) => {
    const infractoras = cadenas.filter((cadena) => patron.test(cadena));

    expect(infractoras, `${motivo}\n→ ${infractoras.join('\n→ ')}`).toEqual([]);
  });
});
