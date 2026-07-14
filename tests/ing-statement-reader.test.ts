import { describe, it, expect } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as XLSX from 'xlsx';
import { IngXlsStatementReader } from '@/lib/import/ing-xls-reader';
import {
  ExtractoIllegibleError,
  type BrokerStatementReader,
  type ExtractoParseado,
} from '@/lib/import/statement-reader';

// --- Fixture SINTÉTICO en el layout de ING (sin datos reales ni binario en git) ---
// El fichero real (examples/historico.xls) contiene datos personales y NO se versiona;
// aquí construimos extractos equivalentes por código para los asserts deterministas.

const HEADER = [
  'FECHA', 'OPERACIÓN', '', 'VALOR', '', 'MERCADO',
  'TÍTULOS', 'PRECIO EN DIVISA ORIGEN', '', 'IMPORTE TOTAL (€)',
];

type Celda = string | number;
/** Una fila de operación en las columnas exactas del extracto ING. */
const op = (
  fecha: string, tipo: string, valor: string, mercado: string,
  titulos: Celda, precio: Celda, importe: Celda,
): Celda[] => [fecha, tipo, '', valor, '', mercado, titulos, precio, '', importe];

interface MetaFixture { cuenta?: string; titular?: string; fecha?: string }

function buildIngXls(dataRows: Celda[][], meta: MetaFixture = {}): Uint8Array {
  const m = {
    cuenta: 'ES00 0000 0000 0000',
    titular: 'TITULAR DE PRUEBA',
    fecha: '14/07/2026 23:28h',
    ...meta,
  };
  const aoa: Celda[][] = [
    [],
    ['Movimientos de la Cartera', '', '  Número de cuenta:', '', m.cuenta],
    ['', '', '  Titular:', '', m.titular],
    ['', '', '  Fecha de exportación:', '', m.fecha],
    [], [],
    HEADER,
    ...dataRows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Cartera');
  return XLSX.write(wb, { type: 'buffer', bookType: 'biff8' }) as Uint8Array;
}

const reader = new IngXlsStatementReader();

describe('CA-1: parseo de operaciones COMPRA/VENTA', () => {
  it('devuelve una operación por fila COMPRA/VENTA con sus campos', () => {
    const buf = buildIngXls([
      op('13/07/2026', 'COMPRA', 'PHARMAMAR', 'M.CONTINUO', 200, 68.5, 13736.86),
      op('12/07/2026', 'VENTA', 'QFIN', 'NASDAQ', 100, 12.7, 1120),
    ]);
    const out = reader.read(buf);
    expect(out.operaciones).toHaveLength(2);
    expect(out.operaciones[0]).toEqual({
      occurredOn: '2026-07-13',
      side: 'buy',
      nombreBroker: 'PHARMAMAR',
      etiquetaMercado: 'M.CONTINUO',
      cantidad: '200',
      precioOrigen: '68.5',
      importeEur: '13736.86',
    });
    expect(out.operaciones[1]).toMatchObject({ side: 'sell', nombreBroker: 'QFIN', etiquetaMercado: 'NASDAQ' });
  });
});

describe('CA-2: encoding correcto (sin mojibake)', () => {
  it('preserva acentos y Ñ en textos', () => {
    const buf = buildIngXls([op('01/06/2026', 'COMPRA', 'COMPAÑÍA ACISA', 'M.CONTINUO', 10, 1.5, 15.2)]);
    const out = reader.read(buf);
    expect(out.operaciones[0].nombreBroker).toBe('COMPAÑÍA ACISA');
  });

  it('[real, opcional] el .xls real cp1252 se decodifica sin mojibake', () => {
    const real = resolve(process.cwd(), 'examples/historico.xls');
    if (!existsSync(real)) return; // fixture real gitignored; se salta en CI
    const out = reader.read(readFileSync(real));
    // Ningún texto contiene el carácter de reemplazo de una mala decodificación.
    for (const o of out.operaciones) {
      expect(o.nombreBroker).not.toContain('�');
      expect(o.etiquetaMercado).not.toContain('�');
    }
    expect(out.metadatos.titular).not.toContain('�');
  });
});

describe('CA-3: metadatos de cabecera', () => {
  it('extrae número de cuenta, titular y fecha de exportación', () => {
    const buf = buildIngXls(
      [op('13/07/2026', 'COMPRA', 'INDITEX', 'M.CONTINUO', 10, 30, 300.5)],
      { cuenta: 'ES99 1234 5678', titular: 'FULANA DE TAL', fecha: '01/01/2027 09:00h' },
    );
    const out = reader.read(buf);
    expect(out.metadatos).toEqual({
      numeroCuenta: 'ES99 1234 5678',
      titular: 'FULANA DE TAL',
      fechaExportacion: '01/01/2027 09:00h',
    });
  });
});

describe('CA-4: solo COMPRA/VENTA; el resto se ignora sin error', () => {
  it('ignora dividendos, filas en blanco y pie, sin fallar', () => {
    const buf = buildIngXls([
      op('13/07/2026', 'COMPRA', 'INDITEX', 'M.CONTINUO', 10, 30, 300.5),
      op('12/07/2026', 'DIVIDENDO', 'INDITEX', 'M.CONTINUO', 0, 0, 5),
      [],
      op('11/07/2026', 'VENTA', 'INDITEX', 'M.CONTINUO', 5, 32, 159),
      ['Total', '', '', '', '', '', '', '', '', 464.5], // fila de pie
    ]);
    const out = reader.read(buf);
    expect(out.operaciones).toHaveLength(2);
    expect(out.operaciones.map((o) => o.side)).toEqual(['buy', 'sell']);
  });
});

describe('CA-5: precisión decimal (sin arrastre float)', () => {
  it('conserva sub-céntimos, cantidades grandes y 2 decimales del importe', () => {
    const buf = buildIngXls([
      op('26/04/2019', 'COMPRA', 'ABENGOA.B', 'M.CONTINUO', 175270, 0.0142, 2500.33),
      op('20/05/2026', 'COMPRA', 'MCDONALDS', 'NYSE', 2, 280.093, 485.12),
      op('15/06/2026', 'COMPRA', 'PHARMAMAR', 'M.CONTINUO', 200, 68.5, 13736.86),
    ]);
    const out = reader.read(buf);
    expect(out.operaciones[0]).toMatchObject({ cantidad: '175270', precioOrigen: '0.0142', importeEur: '2500.33' });
    expect(out.operaciones[1]).toMatchObject({ precioOrigen: '280.093', importeEur: '485.12' });
    // El importe NO arrastra 13736.859999999999.
    expect(out.operaciones[2].importeEur).toBe('13736.86');
  });
});

describe('CA-6: detrás del puerto (formato desacoplado)', () => {
  it('el adaptador ING es asignable al puerto BrokerStatementReader', () => {
    const port: BrokerStatementReader = new IngXlsStatementReader();
    const buf = buildIngXls([op('13/07/2026', 'COMPRA', 'INDITEX', 'M.CONTINUO', 10, 30, 300.5)]);
    const out: ExtractoParseado = port.read(buf);
    expect(out.operaciones).toHaveLength(1);
  });

  it('el dominio consume el puerto, no el .xls: un fake produce el mismo modelo', () => {
    const fake: BrokerStatementReader = {
      read: (): ExtractoParseado => ({
        metadatos: { numeroCuenta: 'X', titular: 'Y', fechaExportacion: 'Z' },
        operaciones: [{
          occurredOn: '2026-01-01', side: 'buy', nombreBroker: 'ACME',
          etiquetaMercado: 'NASDAQ', cantidad: '1', precioOrigen: '2', importeEur: '2',
        }],
      }),
    };
    // Función de dominio tipada al puerto: funciona con cualquier adaptador.
    const contar = (r: BrokerStatementReader, b: Uint8Array) => r.read(b).operaciones.length;
    expect(contar(fake, new Uint8Array())).toBe(1);
  });
});

describe('CA-7: fallo legible ante fichero no válido', () => {
  it('lanza ExtractoIllegibleError con bytes que no son un .xls', () => {
    const basura = new TextEncoder().encode('esto no es un excel');
    expect(() => reader.read(basura)).toThrow(ExtractoIllegibleError);
  });

  it('lanza si falta la hoja "Cartera"', () => {
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['x']]), 'Otra');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'biff8' }) as Uint8Array;
    expect(() => reader.read(buf)).toThrow(ExtractoIllegibleError);
  });

  it('lanza si la cabecera de columnas no es la esperada', () => {
    const ws = XLSX.utils.aoa_to_sheet([['A', 'B', 'C'], ['1', '2', '3']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Cartera');
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'biff8' }) as Uint8Array;
    expect(() => reader.read(buf)).toThrow(ExtractoIllegibleError);
  });

  it('lanza (sin salida parcial) si una fila de operación trae una fecha inválida', () => {
    const buf = buildIngXls([op('no-es-fecha', 'COMPRA', 'INDITEX', 'M.CONTINUO', 10, 30, 300.5)]);
    expect(() => reader.read(buf)).toThrow(ExtractoIllegibleError);
  });
});

describe('[real, opcional] recuento del extracto de ejemplo', () => {
  it('lee las 250 operaciones del fichero real si está presente', () => {
    const real = resolve(process.cwd(), 'examples/historico.xls');
    if (!existsSync(real)) return; // gitignored; se salta en CI
    const out = reader.read(readFileSync(real));
    expect(out.operaciones).toHaveLength(250);
  });
});
