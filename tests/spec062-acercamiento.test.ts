import { describe, it, expect } from 'vitest';
import { Decimal } from 'decimal.js';
import {
  DECIMALES_VISIBLES,
  ESCALA_ACERCAMIENTO_PCT,
  acercamientoDeVigilada,
  distanciaAZona,
  fraccionDeBarra,
  nombreAccesibleDeAcercamiento,
  porcentajeVisible,
  textoDeAcercamiento,
  type Acercamiento,
} from '@/lib/watchlist/acercamiento';
import { entraEnZona } from '@/lib/watchlist/zones';
import { afirmacionesProhibidasEn } from './ayuda-afirmaciones-prohibidas';

/**
 * SPEC-062 — **la medida, como función pura** (RN-18) y **cómo se lee**.
 *
 * Lo que estos casos defienden, por encima de todo lo demás: que **la ausencia de medida
 * no se confunda con un cero** (CA-1) y que **el redondeo no pueda fabricar una entrada en
 * zona** (CA-13). Las dos son la misma clase de fallo —un dato que parece decir algo que
 * no dice— y es la clase que le costó a este proyecto una épica entera (EPIC-FIX).
 */

const fila = (
  price: string | null,
  zonas: Partial<Record<'buyMin' | 'buyMax' | 'sellMin' | 'sellMax', string>> = {},
) => ({
  price,
  buyMin: zonas.buyMin ?? null,
  buyMax: zonas.buyMax ?? null,
  sellMin: zonas.sellMin ?? null,
  sellMax: zonas.sellMax ?? null,
});

/** Redondeo a la cifra que se ENSEÑA, para comparar contra el exacto. */
const visible = (a: Acercamiento) => porcentajeVisible(a);

/* ────────────────────────────────────────────────────────────────────────────
   CA-1 — La medida existe sólo cuando hay con qué medirla
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-062 CA-1: sin dato no hay medida, y «no hay medida» no es cero', () => {
  it('sin cotización no hay acercamiento, aunque las dos zonas estén completas', () => {
    expect(acercamientoDeVigilada(fila(null, { buyMin: '10', buyMax: '12', sellMin: '20', sellMax: '22' }))).toBeNull();
  });

  it('una zona a medias no es una zona: falta un extremo y no hay medida', () => {
    expect(acercamientoDeVigilada(fila('15', { buyMin: '10' }))).toBeNull();
    expect(acercamientoDeVigilada(fila('15', { buyMax: '12' }))).toBeNull();
    expect(acercamientoDeVigilada(fila('15', { sellMin: '20' }))).toBeNull();
  });

  it('sin ninguna zona tampoco, por mucho precio que haya', () => {
    expect(acercamientoDeVigilada(fila('15'))).toBeNull();
  });

  it('un precio no positivo no se divide: no hay medida (y no hay excepción)', () => {
    expect(acercamientoDeVigilada(fila('0', { buyMin: '10', buyMax: '12' }))).toBeNull();
    expect(acercamientoDeVigilada(fila('-3', { buyMin: '10', buyMax: '12' }))).toBeNull();
  });

  // La dirección buena: con los dos datos SÍ sale número. Sin este caso, todo lo de
  // arriba estaría en verde aunque la función devolviera `null` siempre.
  it('con cotización y una zona completa, sí hay medida — y es un número, no un hueco', () => {
    const a = acercamientoDeVigilada(fila('4.12', { buyMin: '3.80', buyMax: '3.99' }));
    expect(a).not.toBeNull();
    expect(a!.dentro).toBe(false);
    expect(Number(a!.porcentaje)).toBeGreaterThan(0);
  });

  it('el cero significa DENTRO, que es lo contrario de no saber: los dos casos son distinguibles', () => {
    const dentro = acercamientoDeVigilada(fila('3.90', { buyMin: '3.80', buyMax: '3.99' }));
    const sinDato = acercamientoDeVigilada(fila(null, { buyMin: '3.80', buyMax: '3.99' }));

    expect(dentro).toEqual({ zona: 'compra', dentro: true, porcentaje: '0', sentido: null });
    expect(sinDato).toBeNull();
    expect(dentro).not.toEqual(sinDato);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-2 — Qué mide y sobre qué denominador
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-062 CA-2: la distancia al borde más cercano, sobre el precio, con su sentido', () => {
  it('por encima del rango: el precio tiene que BAJAR, y la cuenta es (p − max) / p', () => {
    const a = acercamientoDeVigilada(fila('4.12', { buyMin: '3.80', buyMax: '3.99' }))!;
    expect(a.sentido).toBe('bajar');
    expect(a.zona).toBe('compra');
    // (4.12 − 3.99) / 4.12 × 100 = 3.15533980582…
    expect(new Decimal(a.porcentaje).toDecimalPlaces(6).toString()).toBe('3.15534');
    expect(visible(a)).toBe('3,2%');
  });

  it('por debajo del rango: el precio tiene que SUBIR, y la cuenta es (min − p) / p', () => {
    const a = acercamientoDeVigilada(fila('3.70', { buyMin: '3.80', buyMax: '3.99' }))!;
    expect(a.sentido).toBe('subir');
    // (3.80 − 3.70) / 3.70 × 100 = 2.7027027…
    expect(new Decimal(a.porcentaje).toDecimalPlaces(6).toString()).toBe('2.702703');
    expect(visible(a)).toBe('2,7%');
  });

  it('el denominador es el PRECIO y no el borde — y se nota, porque los dos números difieren', () => {
    const a = acercamientoDeVigilada(fila('4.12', { buyMin: '3.80', buyMax: '3.99' }))!;
    const sobreElBorde = new Decimal('4.12').minus('3.99').div('3.99').times(100);

    expect(new Decimal(a.porcentaje).equals(sobreElBorde)).toBe(false);
    expect(new Decimal(a.porcentaje).lt(sobreElBorde)).toBe(true);
  });

  it('la medida NO es simétrica, que es justo por lo que el sentido se muestra siempre', () => {
    // Bajar un 3,2% desde 100 lleva a 96,8; subir desde 96,8 hasta 100 no es un 3,2%.
    const bajando = acercamientoDeVigilada(fila('100', { buyMin: '90', buyMax: '96.8' }))!;
    const subiendo = acercamientoDeVigilada(fila('96.8', { buyMin: '100', buyMax: '110' }))!;

    expect(bajando.sentido).toBe('bajar');
    expect(subiendo.sentido).toBe('subir');
    expect(new Decimal(bajando.porcentaje).equals(subiendo.porcentaje)).toBe(false);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-3 / CA-4 — Dentro es cero, sin sentido, y lo decide `entraEnZona`
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-062 CA-3: dentro de la zona la distancia es cero y no hay dirección', () => {
  it('en mitad del rango', () => {
    const a = acercamientoDeVigilada(fila('3.90', { buyMin: '3.80', buyMax: '3.99' }))!;
    expect(a).toMatchObject({ dentro: true, porcentaje: '0', sentido: null });
  });

  it('en el extremo superior, que RN-11 cuenta como dentro', () => {
    const a = acercamientoDeVigilada(fila('3.99', { buyMin: '3.80', buyMax: '3.99' }))!;
    expect(a).toMatchObject({ dentro: true, porcentaje: '0', sentido: null });
  });

  it('en el extremo inferior, igual', () => {
    const a = acercamientoDeVigilada(fila('3.80', { buyMin: '3.80', buyMax: '3.99' }))!;
    expect(a).toMatchObject({ dentro: true, porcentaje: '0', sentido: null });
  });
});

describe('SPEC-062 CA-4: una sola definición de «dentro» — la de `entraEnZona`', () => {
  it('sobre un barrido que cruza los dos bordes, «distancia cero» y `entraEnZona` coinciden SIEMPRE', () => {
    const zona = { min: '3.80', max: '3.99' };
    // Paso de un céntimo desde 3,70 hasta 4,09: cruza el suelo y el techo, y pisa los dos
    // extremos exactos.
    const precios: string[] = [];
    for (let c = 370; c <= 409; c += 1) precios.push(new Decimal(c).div(100).toFixed(2));

    const dentroSegunZonas = precios.filter((p) => entraEnZona(p, zona));
    const dentroSegunMedida = precios.filter((p) => distanciaAZona(p, zona)?.dentro === true);

    // Centinela de no-vacuidad por los dos lados: el barrido tiene puntos dentro y fuera.
    expect(dentroSegunZonas.length).toBeGreaterThan(0);
    expect(dentroSegunZonas.length).toBeLessThan(precios.length);
    expect(dentroSegunMedida).toEqual(dentroSegunZonas);
    // Y los extremos exactos están en el barrido, que es donde más fácil es divergir.
    expect(dentroSegunZonas).toContain('3.80');
    expect(dentroSegunZonas).toContain('3.99');
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-5 — Aritmética decimal, y se nota en la cifra que se enseña
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-062 CA-5: la cuenta es decimal, y una implementación en `number` fallaría', () => {
  it('el caso discriminante: en coma flotante la cifra visible sale distinta', () => {
    // p = 1.15, max = 1.10 → (1.15 − 1.10) / 1.15 × 100.
    // En `number`: 1.15 − 1.10 = 0.04999999999999993 → 4.3478260869565135…
    // En decimal:  0.05 / 1.15 × 100                 = 4.3478260869565217…
    const a = acercamientoDeVigilada(fila('1.15', { buyMin: '1.00', buyMax: '1.10' }))!;

    const enFlotante = ((1.15 - 1.1) / 1.15) * 100;
    expect(new Decimal(a.porcentaje).equals(enFlotante)).toBe(false);
    expect(new Decimal(a.porcentaje).toDecimalPlaces(16).toString()).toBe('4.3478260869565217');
  });

  it('y el redondeo de presentación también es decimal: 0,05 sobre 1,15 se lee 4,3%', () => {
    const a = acercamientoDeVigilada(fila('1.15', { buyMin: '1.00', buyMax: '1.10' }))!;
    expect(visible(a)).toBe('4,3%');
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-7 — Qué zona elige la barra
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-062 CA-7: la barra apunta a la zona más cercana, y el empate está declarado', () => {
  it('con las dos zonas definidas, gana la de menor distancia — aquí, venta', () => {
    // precio 19 · compra 10–12 (lejos, hacia abajo) · venta 20–22 (cerca, hacia arriba)
    const a = acercamientoDeVigilada(fila('19', { buyMin: '10', buyMax: '12', sellMin: '20', sellMax: '22' }))!;
    expect(a.zona).toBe('venta');
    expect(a.sentido).toBe('subir');
  });

  it('y aquí, compra — la misma fila con el precio al otro lado', () => {
    const a = acercamientoDeVigilada(fila('12.5', { buyMin: '10', buyMax: '12', sellMin: '20', sellMax: '22' }))!;
    expect(a.zona).toBe('compra');
    expect(a.sentido).toBe('bajar');
  });

  it('con una sola zona definida, es esa aunque esté lejísimos', () => {
    const a = acercamientoDeVigilada(fila('100', { sellMin: '500', sellMax: '600' }))!;
    expect(a.zona).toBe('venta');
    expect(Number(a.porcentaje)).toBeGreaterThan(ESCALA_ACERCAMIENTO_PCT);
  });

  it('si está DENTRO de una, eso manda sobre la distancia a la otra', () => {
    const a = acercamientoDeVigilada(fila('21', { buyMin: '20.5', buyMax: '20.9', sellMin: '20.95', sellMax: '22' }))!;
    expect(a).toMatchObject({ zona: 'venta', dentro: true, porcentaje: '0' });
  });

  it('empate exacto → compra, y es estable: no depende del orden en que se miren las zonas', () => {
    // precio 15 · compra 10–14 (1 abajo) · venta 16–20 (1 arriba): misma distancia.
    const a = acercamientoDeVigilada(fila('15', { buyMin: '10', buyMax: '14', sellMin: '16', sellMax: '20' }))!;
    expect(a.zona).toBe('compra');

    const espejo = acercamientoDeVigilada(fila('15', { sellMin: '16', sellMax: '20', buyMin: '10', buyMax: '14' }))!;
    expect(espejo).toEqual(a);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-8 — La barra es escala; el número es el dato
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-062 CA-8: la barra se acota, el número nunca', () => {
  const conDistancia = (pct: string): Acercamiento => ({
    zona: 'compra',
    dentro: false,
    porcentaje: pct,
    sentido: 'bajar',
  });

  it('dentro de zona, la barra está llena', () => {
    expect(fraccionDeBarra({ zona: 'compra', dentro: true, porcentaje: '0', sentido: null })).toBe(1);
  });

  it('a media escala, media barra', () => {
    expect(fraccionDeBarra(conDistancia(String(ESCALA_ACERCAMIENTO_PCT / 2)))).toBeCloseTo(0.5, 10);
  });

  it('justo en la escala, vacía', () => {
    expect(fraccionDeBarra(conDistancia(String(ESCALA_ACERCAMIENTO_PCT)))).toBe(0);
  });

  it('más allá de la escala sigue vacía — pero el número dice la verdad entera', () => {
    const lejos = conDistancia('23.4');
    expect(fraccionDeBarra(lejos)).toBe(0);
    expect(porcentajeVisible(lejos)).toBe('23,4%');
    expect(textoDeAcercamiento(lejos)).toContain('23,4%');
  });

  it('la fracción nunca se sale de [0, 1], ni con distancias absurdas', () => {
    expect(fraccionDeBarra(conDistancia('9999'))).toBe(0);
    expect(fraccionDeBarra(conDistancia('0'))).toBe(1);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-13 — El redondeo no puede fabricar una entrada en zona
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-062 CA-13: por debajo de la resolución se dice «menos de», nunca «0,0%»', () => {
  it('una fila a 0,04% de su zona NO se lee como un cero', () => {
    // precio 100,04 · zona 90–100 → 0,03998…%
    const a = acercamientoDeVigilada(fila('100.04', { buyMin: '90', buyMax: '100' }))!;
    expect(a.dentro).toBe(false);
    expect(Number(a.porcentaje)).toBeLessThan(0.1);
    expect(visible(a)).toBe('menos de 0,1%');
    expect(visible(a)).not.toContain('0,0%');
  });

  it('y una que sí está dentro se lee distinto: la confusión que esto evita es exactamente ésa', () => {
    const dentro = acercamientoDeVigilada(fila('99.99', { buyMin: '90', buyMax: '100' }))!;
    const casi = acercamientoDeVigilada(fila('100.04', { buyMin: '90', buyMax: '100' }))!;

    expect(dentro.dentro).toBe(true);
    expect(textoDeAcercamiento(dentro)).toBe('');
    expect(textoDeAcercamiento(casi)).not.toBe('');
    expect(textoDeAcercamiento(dentro)).not.toBe(textoDeAcercamiento(casi));
  });

  it('la resolución declarada es un decimal, y el redondeo es el normal por encima de ella', () => {
    expect(DECIMALES_VISIBLES).toBe(1);
    const a = acercamientoDeVigilada(fila('4.12', { buyMin: '3.80', buyMax: '3.99' }))!;
    expect(visible(a)).toBe('3,2%'); // 3,155… redondea a 3,2
  });

  it('la coma decimal es la del idioma del producto, no el punto', () => {
    const a = acercamientoDeVigilada(fila('4.12', { buyMin: '3.80', buyMax: '3.99' }))!;
    expect(visible(a)).toContain(',');
    expect(visible(a)).not.toContain('.');
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-9 / CA-10 — El sentido se dice, y no sólo con la forma
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-062 CA-9/CA-10: el sentido y el destino, en texto', () => {
  it('un 3% hacia abajo y un 3% hacia arriba no se leen igual', () => {
    const arriba = acercamientoDeVigilada(fila('103', { buyMin: '90', buyMax: '100' }))!;
    const abajo = acercamientoDeVigilada(fila('97', { buyMin: '100', buyMax: '110' }))!;

    expect(textoDeAcercamiento(arriba)).toContain('▼');
    expect(textoDeAcercamiento(abajo)).toContain('▲');
    expect(textoDeAcercamiento(arriba)).not.toBe(textoDeAcercamiento(abajo));
  });

  it('el texto dice el porcentaje y la zona de destino', () => {
    const a = acercamientoDeVigilada(fila('19', { sellMin: '20', sellMax: '22' }))!;
    expect(textoDeAcercamiento(a)).toContain('venta');
    expect(textoDeAcercamiento(a)).toContain(porcentajeVisible(a));
  });

  it('el nombre accesible dice lo mismo en una frase entera: quien escucha no tiene la flecha', () => {
    const a = acercamientoDeVigilada(fila('4.12', { buyMin: '3.80', buyMax: '3.99' }))!;
    const nombre = nombreAccesibleDeAcercamiento(a);

    expect(nombre).toContain('bajar');
    expect(nombre).toContain('3,2%');
    expect(nombre).toContain('compra');
    expect(nombre).not.toContain('▼');
  });

  it('dentro de zona, el nombre accesible lo dice y el texto calla — lo cuenta la etiqueta de estado', () => {
    const a = acercamientoDeVigilada(fila('3.90', { buyMin: '3.80', buyMax: '3.99' }))!;
    expect(textoDeAcercamiento(a)).toBe('');
    expect(nombreAccesibleDeAcercamiento(a)).toMatch(/dentro de la zona de compra/i);
  });
});

/* ────────────────────────────────────────────────────────────────────────────
   CA-15 — La app sigue sin recomendar
   ──────────────────────────────────────────────────────────────────────────── */

describe('SPEC-062 CA-15: ningún texto de esta spec cruza D-4', () => {
  const textos = () => {
    const casos: Acercamiento[] = [
      { zona: 'compra', dentro: false, porcentaje: '3.15', sentido: 'bajar' },
      { zona: 'venta', dentro: false, porcentaje: '0.04', sentido: 'subir' },
      { zona: 'compra', dentro: true, porcentaje: '0', sentido: null },
      { zona: 'venta', dentro: true, porcentaje: '0', sentido: null },
    ];
    return casos.flatMap((a) => [textoDeAcercamiento(a), nombreAccesibleDeAcercamiento(a)]).join('\n');
  };

  it('no dice ni sugiere que la app aconseje comprar o vender', () => {
    expect(afirmacionesProhibidasEn(textos())).toEqual([]);
  });

  // La otra dirección, sin la cual lo de arriba podría estar verde por no mirar nada: una
  // frase que SÍ aconseja tiene que ser cazada por el mismo mecanismo.
  it('y el mecanismo que lo comprueba no está ciego: una frase que aconseja sí se caza', () => {
    const inventada = 'Está a un 1% de tu zona: te recomendamos comprar ahora, es una señal de compra.';
    expect(afirmacionesProhibidasEn(inventada).length).toBeGreaterThan(0);
  });
});
