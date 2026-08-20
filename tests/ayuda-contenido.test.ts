import { describe, it, expect } from 'vitest';
import {
  AVISOS,
  CADENCIA,
  CADENCIA_LINEA,
  MERCADOS,
  MERCADOS_EN_PROSA,
  MERCADOS_SECCION,
  MOTIVOS_SIN_PRECIO,
  MOTIVO_SIN_DATOS_AUN,
  PRECIOS,
  SIN_PRECIO_SECCION,
  ZONAS,
} from '@/lib/help/content';
import { OPERATING_MICS } from '@/lib/market/mic';
import { marketName } from '@/lib/market/market-name';
import { FAIL_REASON_TEXT } from '@/lib/market/fail-reason-text';

/**
 * SPEC-039 — el CONTENIDO de la ayuda, atado al código del que habla.
 *
 * La otra mitad (que la página lo renderice y se lea sin sesión) está en
 * `tests/e2e/ayuda.spec.ts`. Aquí se comprueba lo que no necesita navegador y lo
 * que un navegador no puede comprobar: que lo que la ayuda cuenta **es** lo que el
 * código hace, y que no puede quedarse desfasada en silencio.
 *
 * Esto es deliberadamente incómodo (F-SPEC-039-3): el día que alguien añada un
 * mercado a `OPERATING_MICS` o un motivo a `QuoteFailureReason` sin tocar la ayuda,
 * este fichero se pone rojo **en su PR**. La ayuda mintió una vez —cuando decía
 * cubrir mercados que el proveedor no servía— y costó EPIC-FIX entera.
 */

const todoElTexto = () =>
  [CADENCIA, ZONAS, AVISOS, PRECIOS]
    .flatMap((s) => [s.titulo, ...s.parrafos])
    .concat([MERCADOS_SECCION.titulo, MERCADOS_SECCION.intro, MERCADOS_SECCION.cierre])
    .concat([SIN_PRECIO_SECCION.titulo, SIN_PRECIO_SECCION.intro])
    .concat(MERCADOS.map((m) => m.nombre))
    .concat(MOTIVOS_SIN_PRECIO.flatMap((m) => [m.titulo, m.texto]))
    .join('\n');

describe('SPEC-039 CA-6: los mercados de la ayuda salen del código, no de la memoria', () => {
  it('la lista es EXACTAMENTE OPERATING_MICS, en su orden', () => {
    expect(MERCADOS.map((m) => m.mic)).toEqual([...OPERATING_MICS]);
  });

  it('cada mercado se nombra con su nombre de dominio, el mismo que la tabla de /vigiladas', () => {
    for (const mercado of MERCADOS) {
      expect(mercado.nombre, `${mercado.mic} sin nombre`).not.toBe('');
      expect(mercado.nombre).toBe(marketName(mercado.mic));
    }
  });

  it('están los siete nombres que el producto reconoce, y ni uno más', () => {
    expect(MERCADOS.map((m) => m.nombre).sort()).toEqual(
      [
        'BME',
        'NASDAQ',
        'NYSE',
        'Xetra',
        'Nasdaq Estocolmo',
        'Euronext París',
        'Euronext Ámsterdam',
      ].sort(),
    );
  });

  it('la CIFRA que la prosa escribe a mano coincide con la del código', () => {
    // Escrita a mano a propósito: la lista se deriva y no puede desfasarse sola,
    // pero la frase que dice «siete mercados» sí. Esta comprobación es la que se
    // pone roja el día que alguien añada el octavo (F-SPEC-039-3).
    expect(
      MERCADOS_EN_PROSA.cifra,
      'la ayuda dice cuántos mercados hay con una palabra escrita a mano: ' +
        'actualízala en src/lib/help/content.ts',
    ).toBe(OPERATING_MICS.length);
    expect(todoElTexto()).toContain(MERCADOS_EN_PROSA.palabra);
  });
});

describe('SPEC-039 CA-8: «sin cotización» explicado por todos sus motivos', () => {
  it('cubre TODOS los motivos del dominio (QuoteFailureReason), sin inventar ninguno', () => {
    const delCodigo = Object.keys(FAIL_REASON_TEXT).sort();
    const deLaAyuda = MOTIVOS_SIN_PRECIO.filter((m) => m.id !== MOTIVO_SIN_DATOS_AUN.id)
      .map((m) => m.id)
      .sort();

    expect(deLaAyuda, 'la ayuda y QuoteFailureReason tienen que ser el MISMO conjunto').toEqual(
      delCodigo,
    );
  });

  it('añade el caso que /vigiladas muestra y no es un fallo: aún sin datos', () => {
    expect(MOTIVOS_SIN_PRECIO.map((m) => m.id)).toContain(MOTIVO_SIN_DATOS_AUN.id);
    expect(MOTIVO_SIN_DATOS_AUN.texto).toMatch(/pr[oó]ximo ciclo/i);
  });

  it('cada motivo se explica en lenguaje llano, sin texto crudo del proveedor', () => {
    for (const motivo of MOTIVOS_SIN_PRECIO) {
      expect(motivo.titulo.length, `${motivo.id} sin título`).toBeGreaterThan(0);
      expect(motivo.texto.length, `${motivo.id} sin explicación`).toBeGreaterThan(40);
      expect(motivo.texto, `${motivo.id} filtra jerga del proveedor`).not.toMatch(
        /upgrade|http|\{|\}|api/i,
      );
    }
  });

  it('el precio se explica como el último cierre NO ajustado, con su fecha (RN-12)', () => {
    const texto = [PRECIOS.titulo, ...PRECIOS.parrafos].join('\n');
    expect(texto).toMatch(/[uú]ltimo (precio de )?cierre/i);
    expect(texto).toMatch(/no ajustad/i);
    expect(texto).toMatch(/fecha/i);
  });
});

describe('SPEC-039 CA-4: la zona, como es y no como suena', () => {
  const texto = () => [ZONAS.titulo, ...ZONAS.parrafos].join('\n');

  it('es un RANGO [min, max], no un valor puntual (RN-10)', () => {
    expect(texto()).toMatch(/rango/i);
    expect(texto()).toMatch(/m[ií]nimo/i);
    expect(texto()).toMatch(/m[aá]ximo/i);
    expect(texto()).toMatch(/no\s+es\s+un\s+(valor|precio)\s+(puntual|exacto)/i);
  });

  it('compra y venta son etiquetas independientes y opcionales (RN-10)', () => {
    expect(texto()).toMatch(/opcional/i);
    expect(texto()).toMatch(/independiente/i);
    expect(texto()).toMatch(/(sin ninguna|sin zona|solo una|una de las dos|las dos)/i);
  });

  it('se entra en zona con los extremos INCLUIDOS (RN-11)', () => {
    expect(texto()).toMatch(/inclu/i);
    expect(texto()).toMatch(/extremos/i);
  });

  it('las zonas las pone el usuario: la app no las calcula ni las recomienda (D-4)', () => {
    expect(texto()).toMatch(/no\s+(las\s+)?calcula/i);
    expect(texto()).toMatch(/recomien/i);
  });
});

describe('SPEC-039 CA-5: cuándo llega el aviso y de qué tipo', () => {
  const texto = () => [AVISOS.titulo, ...AVISOS.parrafos].join('\n');

  it('distingue el aviso de ENTRADA del agregado de PERMANENCIA (RN-13, RN-14)', () => {
    expect(texto()).toMatch(/aviso de entrada/i);
    expect(texto()).toMatch(/permanencia/i);
  });

  it('dice que la entrada no se repite mientras siga dentro, y que se re-arma al salir', () => {
    expect(texto()).toMatch(/no se repite|una sola vez|no vuelve a avisar/i);
    expect(texto()).toMatch(/sale.*vuelve a entrar|salir.*volver a entrar/i);
  });

  it('el agregado es uno por ciclo con todo lo que sigue dentro (RN-14)', () => {
    expect(texto()).toMatch(/uno (al d[ií]a|por ciclo)/i);
    expect(texto()).toMatch(/siguen? dentro|sigue en (su )?zona/i);
  });

  it('el aviso queda SIEMPRE en la bandeja aunque el correo falle (RN-15)', () => {
    expect(texto()).toMatch(/bandeja/i);
    expect(texto()).toMatch(/aunque.*(correo|email)|si el (correo|email).*falla/i);
  });
});

describe('SPEC-039 CA-3: la cadencia se dice con UNA frase, y esa frase se repite', () => {
  it('la frase canónica dice cierre, una vez al día y que esto no es lo otro', () => {
    expect(CADENCIA_LINEA).toMatch(/cierre/i);
    expect(CADENCIA_LINEA).toMatch(/una vez al d[ií]a/i);
    expect(CADENCIA_LINEA).toMatch(/no es tiempo real/i);
  });

  it('la sección de cadencia de la ayuda la contiene literalmente', () => {
    expect([CADENCIA.titulo, ...CADENCIA.parrafos].join('\n')).toContain(CADENCIA_LINEA);
  });
});
