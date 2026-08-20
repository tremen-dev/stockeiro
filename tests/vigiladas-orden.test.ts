import { describe, it, expect } from 'vitest';
import {
  CRITERIOS_ORDEN,
  PRIORIDAD_ESTADO,
  claveDeNombre,
  compararVigiladas,
  ordenarVigiladas,
  type FilaOrdenable,
} from '@/lib/watchlist/sort';

/**
 * SPEC-041 CA-6 a CA-9 — **el comparador del orden, como función pura**.
 *
 * ## Por qué esto es un test unitario y no un e2e
 *
 * CA-9 lo pide por escrito: *«El comparador es una función pura exportada y se prueba
 * con Vitest sin levantar navegador ni base de datos»*. Y hay una razón detrás que no
 * es de comodidad: el orden por **estado** es la única parte de esta spec que expresa
 * una **decisión de producto** —`both → buy → sell → out → none`, ratificada en el gate
 * del 2026-08-20— y una decisión de producto se defiende con una tabla de casos, no
 * mirando una pantalla y contando filas.
 *
 * La otra mitad —que la tabla *renderizada* respete ese orden y que ordenar no dispare
 * ninguna consulta (CA-10)— sí es de navegador, y vive en
 * `tests/e2e/vigiladas-orden.spec.ts`. Las dos hacen falta: esta dice que la regla es
 * la que es; aquella, que la pantalla la usa.
 *
 * ## Lo que este fichero NO prueba
 *
 * No prueba `entraEnZona` ni cómo se calcula `state`: eso es RN-11, se computa en el
 * servidor y esta spec **no lo toca** (CE-M1). Aquí el `state` llega dado.
 */

/** Constructor de filas mínimas: solo lo que el comparador mira. */
const fila = (
  ticker: string,
  name: string | null,
  state: FilaOrdenable['state'] = 'out',
  failReason: string | null = null,
  id = `id-${ticker}-${name ?? 'sin'}`,
): FilaOrdenable => ({ id, ticker, name, state, failReason });

const tickers = (filas: FilaOrdenable[]) => filas.map((f) => f.ticker);

describe('SPEC-041 CA-6: el orden por defecto es el de hoy — ticker ascendente', () => {
  it('«Ticker» es un criterio ofrecido y es el primero de la lista', () => {
    expect(CRITERIOS_ORDEN[0].clave).toBe('ticker');
    expect(CRITERIOS_ORDEN.map((c) => c.clave)).toEqual(['ticker', 'name', 'state']);
  });

  it('ordena por ticker ascendente, que es lo que hacía `orderBy(symbols.ticker)`', () => {
    const filas = [fila('TEF', 'Telefónica SA'), fila('ITX', 'Inditex'), fila('SAN', 'Santander')];
    expect(tickers(ordenarVigiladas(filas, 'ticker', 'asc'))).toEqual(['ITX', 'SAN', 'TEF']);
  });

  it('descendente es exactamente el inverso', () => {
    const filas = [fila('TEF', 'Telefónica SA'), fila('ITX', 'Inditex'), fila('SAN', 'Santander')];
    const asc = ordenarVigiladas(filas, 'ticker', 'asc');
    const desc = ordenarVigiladas(filas, 'ticker', 'desc');
    expect(tickers(desc)).toEqual([...tickers(asc)].reverse());
  });
});

describe('SPEC-041 CA-7: ordenar por nombre, sin dejar fuera a quien no tiene', () => {
  // El escenario literal del CA: tres nombres con mayúsculas y acentos de por medio, y
  // una fila SIN nombre cuyo ticker hace de clave.
  const escenario = () => [
    fila('ACX', 'Acerinox'),
    fila('IBE', 'iberdrola'),
    fila('IDX', 'Índice X'),
    fila('BBVA', null),
  ];

  it('alfabético en español, insensible a mayúsculas y a acentos, con el ticker como clave del que no tiene nombre', () => {
    const orden = ordenarVigiladas(escenario(), 'name', 'asc');
    expect(tickers(orden)).toEqual(['ACX', 'BBVA', 'IBE', 'IDX']);
  });

  it('ninguna fila desaparece ni queda relegada a un bloque de «sin nombre»', () => {
    const orden = ordenarVigiladas(escenario(), 'name', 'asc');
    expect(orden).toHaveLength(4);
    // La fila sin nombre NO va al final: cae donde le toca por su ticker (BBVA, 2.ª).
    expect(tickers(orden).indexOf('BBVA')).toBe(1);
  });

  it('descendente es exactamente el inverso', () => {
    const asc = ordenarVigiladas(escenario(), 'name', 'asc');
    const desc = ordenarVigiladas(escenario(), 'name', 'desc');
    expect(tickers(desc)).toEqual([...tickers(asc)].reverse());
  });

  it('la clave del nombre es el nombre, o el ticker cuando no hay nombre', () => {
    expect(claveDeNombre(fila('ACX', 'Acerinox'))).toBe('Acerinox');
    expect(claveDeNombre(fila('BBVA', null))).toBe('BBVA');
    // Un nombre en blanco no es un nombre: se cae al ticker, igual que un nulo.
    expect(claveDeNombre(fila('BBVA', '   '))).toBe('BBVA');
  });
});

describe('SPEC-041 CA-8: ordenar por estado, con la prioridad de producto', () => {
  const escenario = () => [
    fila('E-NONE-CICLO', 'Sin datos aún', 'none', null),
    fila('D-OUT', 'Fuera', 'out'),
    fila('C-SELL', 'Venta', 'sell'),
    fila('B-BUY', 'Compra', 'buy'),
    fila('A-BOTH', 'Ambas', 'both'),
    fila('E-NONE-FALLO', 'Sin datos por fallo', 'none', 'mercado_no_cubierto'),
  ];

  it('la prioridad declarada es both → buy → sell → out → none, y no la alfabética de las etiquetas', () => {
    expect(PRIORIDAD_ESTADO.both).toBeLessThan(PRIORIDAD_ESTADO.buy);
    expect(PRIORIDAD_ESTADO.buy).toBeLessThan(PRIORIDAD_ESTADO.sell);
    expect(PRIORIDAD_ESTADO.sell).toBeLessThan(PRIORIDAD_ESTADO.out);
    expect(PRIORIDAD_ESTADO.out).toBeLessThan(PRIORIDAD_ESTADO.none);
  });

  it('ascendente saca primero lo que reclama atención', () => {
    const orden = ordenarVigiladas(escenario(), 'state', 'asc');
    expect(orden.map((f) => f.state)).toEqual(['both', 'buy', 'sell', 'out', 'none', 'none']);
  });

  it('dentro de `none`, primero las que tienen motivo de fallo (piden una acción) y luego las que esperan al ciclo', () => {
    const orden = ordenarVigiladas(escenario(), 'state', 'asc');
    expect(tickers(orden).slice(-2)).toEqual(['E-NONE-FALLO', 'E-NONE-CICLO']);
  });

  it('descendente es exactamente el inverso', () => {
    const asc = ordenarVigiladas(escenario(), 'state', 'asc');
    const desc = ordenarVigiladas(escenario(), 'state', 'desc');
    expect(tickers(desc)).toEqual([...tickers(asc)].reverse());
  });
});

describe('SPEC-041 CA-9: el orden es total y estable — dos filas nunca bailan', () => {
  const mismoEstado = () => [
    fila('ZZZ', 'zeta', 'buy'),
    fila('AAA', 'Álfa', 'buy'),
    fila('MMM', null, 'buy'),
  ];

  it('dentro del mismo estado se desempata por la clave de CA-7 (nombre, o ticker), ASCENDENTE', () => {
    expect(tickers(ordenarVigiladas(mismoEstado(), 'state', 'asc'))).toEqual([
      'AAA',
      'MMM',
      'ZZZ',
    ]);
  });

  it('el desempate sigue siendo ascendente también con la dirección descendente', () => {
    // CA-8 («desc es el inverso») se comprueba con una fila por estado, donde no hay
    // empates; CA-9 gobierna lo que pasa DENTRO de un empate, y ahí la clave manda en
    // ascendente para que la salida sea determinista en las dos direcciones.
    expect(tickers(ordenarVigiladas(mismoEstado(), 'state', 'desc'))).toEqual([
      'AAA',
      'MMM',
      'ZZZ',
    ]);
  });

  it('con la clave de nombre repetida el desempate llega hasta el id: la salida es determinista', () => {
    const a = fila('BBVA', 'Banco', 'out', null, 'id-1');
    const b = fila('BBVA', 'Banco', 'out', null, 'id-2');
    expect(ordenarVigiladas([b, a], 'name', 'asc').map((f) => f.id)).toEqual(['id-1', 'id-2']);
    expect(ordenarVigiladas([a, b], 'name', 'asc').map((f) => f.id)).toEqual(['id-1', 'id-2']);
  });

  it('dos ejecuciones sobre los mismos datos, en cualquier entrada, dan la misma secuencia', () => {
    const base = [
      fila('ITX', 'Inditex', 'buy'),
      fila('SAN', 'Santander', 'buy'),
      fila('TEF', null, 'none', 'simbolo_desconocido'),
      fila('REP', 'Repsol SA', 'none', null),
      fila('AAPL', 'Apple Inc', 'both'),
    ];
    for (const clave of ['ticker', 'name', 'state'] as const) {
      for (const dir of ['asc', 'desc'] as const) {
        const uno = tickers(ordenarVigiladas(base, clave, dir));
        const dos = tickers(ordenarVigiladas([...base].reverse(), clave, dir));
        expect(dos, `${clave}/${dir} depende del orden de entrada`).toEqual(uno);
      }
    }
  });

  it('ordenar no muta la lista que recibe', () => {
    const base = [fila('TEF', 'Telefónica'), fila('ITX', 'Inditex')];
    const copia = tickers(base);
    ordenarVigiladas(base, 'name', 'desc');
    expect(tickers(base)).toEqual(copia);
  });

  it('`compararVigiladas` es una función pura reutilizable: devuelve el comparador', () => {
    const cmp = compararVigiladas('name', 'asc');
    expect(cmp(fila('A', 'Acerinox'), fila('B', 'Zeltia'))).toBeLessThan(0);
    expect(cmp(fila('B', 'Zeltia'), fila('A', 'Acerinox'))).toBeGreaterThan(0);
  });
});
