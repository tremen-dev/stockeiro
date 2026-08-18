import { describe, it, expect } from 'vitest';
import {
  normalizeDecimalInput,
  InvalidNumberError,
  type InvalidNumberReason,
} from '@/lib/format/decimal-input';

// SPEC-030 — el número se entiende como lo escribe un español, y lo ambiguo se
// pregunta en vez de adivinarse (ADR-012). CA-1..CA-9.

const CAMPO = 'Zona de compra (mínimo)';

/** El valor normalizado como string canónico, o `null` si el campo venía vacío. */
const norm = (raw: string | null | undefined): string | null =>
  normalizeDecimalInput(raw, CAMPO)?.toString() ?? null;

/** Captura el `InvalidNumberError` que produce `raw`; falla si no lanza. */
function rechazo(raw: string): InvalidNumberError {
  try {
    normalizeDecimalInput(raw, CAMPO);
  } catch (e) {
    if (e instanceof InvalidNumberError) return e;
    throw e;
  }
  throw new Error(`Se esperaba que "${raw}" fuese rechazado y no lo fue.`);
}

const motivo = (raw: string): InvalidNumberReason => rechazo(raw).reason;

describe('CA-1: la coma decimal (el caso reportado con UPWK)', () => {
  it('"12,5" vale 12.5 y no lanza', () => {
    expect(norm('12,5')).toBe('12.5');
  });
});

describe('CA-2: el punto sigue funcionando (no regresión)', () => {
  it.each([
    ['12.5', '12.5'],
    ['100', '100'],
    ['0.001', '0.001'],
  ])('"%s" → %s', (raw, esperado) => {
    expect(norm(raw)).toBe(esperado);
  });
});

describe('CA-3: espacios interiores, incluido el no separable', () => {
  it('espacio normal como separador de miles', () => {
    expect(norm('1 234,56')).toBe('1234.56');
  });

  it('espacio no separable U+00A0 (el que llega al pegar de Excel o de una web)', () => {
    expect(norm('1 234,56')).toBe('1234.56');
  });

  it('espacio fino no separable U+202F', () => {
    expect(norm('1 234,56')).toBe('1234.56');
  });

  it('espacios alrededor: se recortan', () => {
    expect(norm('  12,5  ')).toBe('12.5');
  });
});

describe('CA-4: miles y decimales, en los dos dialectos', () => {
  it('español "1.234,56" → 1234.56 (el de más a la derecha manda)', () => {
    expect(norm('1.234,56')).toBe('1234.56');
  });

  it('inglés "1,234.56" → 1234.56', () => {
    expect(norm('1,234.56')).toBe('1234.56');
  });

  it('con varios grupos de miles: "1.234.567,89" y "1,234,567.89"', () => {
    expect(norm('1.234.567,89')).toBe('1234567.89');
    expect(norm('1,234,567.89')).toBe('1234567.89');
  });

  it('el decimal repetido sigue siendo ambiguo: "1.234,56,7"', () => {
    expect(motivo('1.234,56,7')).toBe('ambiguo');
  });
});

describe('CA-5: separador repetido → ambiguo, se rechaza (ADR-012)', () => {
  it.each(['1,234,567', '1.234.567'])('"%s" se rechaza por ambiguo', (raw) => {
    expect(motivo(raw)).toBe('ambiguo');
  });
});

describe('CA-6: separador único con exactamente 3 dígitos detrás', () => {
  // Columna izquierda de la tabla: se RECHAZA porque la parte entera es un
  // grupo de miles plausible (1..3 dígitos, sin cero inicial).
  it.each(['1.234', '1,234', '12,345', '123.456', '10,000'])(
    '"%s" se rechaza: la parte entera es un grupo de miles plausible',
    (raw) => {
      expect(motivo(raw)).toBe('ambiguo');
    },
  );

  // Columna derecha: sigue VALIENDO. Estas filas son las que impiden que la
  // enmienda del gate se lleve por delante lo que ya funcionaba (CA-2).
  it.each([
    ['12,5', '12.5'],
    ['12.5', '12.5'],
    ['12,75', '12.75'],
    ['1,2345', '1.2345'],
    ['0.001', '0.001'],
    ['0,500', '0.5'],
    ['1234,567', '1234.567'],
    ['1.234,56', '1234.56'],
    ['1,234.56', '1234.56'],
  ])('"%s" sigue valiendo %s', (raw, esperado) => {
    expect(norm(raw)).toBe(esperado);
  });

  it('la regla es simétrica: coma y punto se tratan igual', () => {
    expect(motivo('1.234')).toBe(motivo('1,234'));
    expect(norm('0.500')).toBe(norm('0,500'));
  });

  it('parte entera de 4 dígitos: como miles habría que haber escrito el grupo', () => {
    expect(norm('1234.567')).toBe('1234.567');
  });

  it('el signo no convierte la parte entera en implausible: "-1.234" se rechaza', () => {
    expect(motivo('-1.234')).toBe('ambiguo');
  });
});

describe('CA-7: el rechazo por ambigüedad dice qué escribir', () => {
  it('el mensaje del ambiguo muestra el valor y nombra las dos salidas', () => {
    const e = rechazo('1.234');
    expect(e.reason).toBe('ambiguo');
    expect(e.message).toContain(CAMPO);
    expect(e.message).toContain('1.234');
    expect(e.message).toContain('sin separador de miles');
    expect(e.message).toContain('1234');
    expect(e.message).toContain('1234,00');
  });

  it('el mensaje de "abc" NO finge esa orientación (la otra dirección)', () => {
    const e = rechazo('abc');
    expect(e.reason).toBe('no_es_numero');
    expect(e.message).toContain(CAMPO);
    expect(e.message).toContain('abc');
    expect(e.message).not.toContain('sin separador de miles');
    expect(e.message).not.toContain('1234,00');
  });

  it('los dos motivos son un vocabulario cerrado y producen mensajes distintos', () => {
    expect(rechazo('1.234').message).not.toBe(rechazo('abc').message);
  });
});

describe('CA-8: lo que no es un número se rechaza como dato, no como fallo', () => {
  it.each(['12€', 'abc', '-', '1e3', '12,5,3'])(
    '"%s" produce InvalidNumberError, no una DecimalError cruda',
    (raw) => {
      let capturado: unknown;
      try {
        normalizeDecimalInput(raw, CAMPO);
      } catch (e) {
        capturado = e;
      }
      expect(capturado).toBeInstanceOf(InvalidNumberError);
      expect((capturado as Error).name).toBe('InvalidNumberError');
      // Ni rastro de decimal.js: nunca llegó a `new Decimal`.
      expect((capturado as Error).message).not.toContain('DecimalError');
      expect((capturado as Error).message).not.toContain('Invalid argument');
    },
  );

  it('la notación científica se rechaza aunque decimal.js la aceptaría', () => {
    expect(motivo('1e3')).toBe('no_es_numero');
    expect(motivo('1E3')).toBe('no_es_numero');
  });

  it('formas incompletas: ".5" y "5." tampoco pasan', () => {
    expect(motivo('.5')).toBe('no_es_numero');
    expect(motivo('5.')).toBe('no_es_numero');
  });

  it('el error lleva el campo y el valor rechazado como datos, no solo en el texto', () => {
    const e = rechazo('12€');
    expect(e.field).toBe(CAMPO);
    expect(e.value).toBe('12€');
  });
});

describe('CA-9: el vacío sigue significando "no informado"', () => {
  it.each([
    { raw: '', caso: 'cadena vacía' },
    { raw: '   ', caso: 'solo espacios' },
    { raw: ' ', caso: 'solo un espacio no separable' },
  ])('$caso → null, no error', ({ raw }) => {
    expect(norm(raw)).toBeNull();
  });

  it('null y undefined también son ausencia', () => {
    expect(norm(null)).toBeNull();
    expect(norm(undefined)).toBeNull();
  });
});

describe('el signo se conserva (esta spec no valida el rango — F-SPEC-030-2)', () => {
  it('"-12,5" → -12.5', () => {
    expect(norm('-12,5')).toBe('-12.5');
  });

  it('"+12,5" → 12.5', () => {
    expect(norm('+12,5')).toBe('12.5');
  });
});
