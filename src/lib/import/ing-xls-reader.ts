import * as XLSX from 'xlsx';
import { Decimal } from 'decimal.js';
import {
  type BrokerStatementReader,
  type ExtractoParseado,
  type MetadatosExtracto,
  type OperacionImportada,
  type OperacionSide,
  ExtractoIllegibleError,
} from './statement-reader';

/**
 * Adaptador de lectura del export de ING "Movimientos de la Cartera" (`.xls` BIFF,
 * JasperReports), primer adaptador del puerto `BrokerStatementReader` (ADR-009).
 * Convierte el fichero en `ExtractoParseado`; no resuelve identidad ni persiste.
 *
 * Layout: hoja `Cartera`, metadatos en la cabecera superior, fila de columnas
 * `FECHA · OPERACIÓN · VALOR · MERCADO · TÍTULOS · PRECIO EN DIVISA ORIGEN ·
 * IMPORTE TOTAL (€)` y, debajo, las operaciones. La lectura toma el valor
 * FORMATEADO de cada celda (`raw:false`) para respetar la precisión decimal del
 * bróker (CA-5) y lo normaliza con `Decimal` (nunca float).
 */
const SHEET = 'Cartera';

// Índices de columna fijos del informe ING (verificados contra el export real).
const COL = { fecha: 0, operacion: 1, valor: 3, mercado: 5, titulos: 6, precio: 7, importe: 9 } as const;

/** Normaliza para comparar sin acentos ni mayúsculas/espacios. */
const norm = (v: unknown): string =>
  String(v ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();

const SIDE_BY_OP: Record<string, OperacionSide> = { COMPRA: 'buy', VENTA: 'sell' };

/** Convierte un valor de celda formateado a string decimal canónico (sin arrastre float). */
function parseDecimal(raw: unknown, campo: string): string {
  const s = String(raw ?? '').replace(/,/g, '').trim(); // ',' = separador de miles (en-US)
  if (s === '') throw new ExtractoIllegibleError(`Operación con ${campo} vacío.`);
  try {
    return new Decimal(s).toString();
  } catch {
    throw new ExtractoIllegibleError(`Operación con ${campo} no numérico: "${String(raw)}".`);
  }
}

/** Convierte una fecha `dd/mm/yyyy` a `yyyy-mm-dd`; lanza si no es válida. */
function parseFecha(raw: unknown): string {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(String(raw ?? '').trim());
  if (!m) throw new ExtractoIllegibleError(`Fecha de operación inválida: "${String(raw)}".`);
  const [, d, mo, y] = m;
  const day = Number(d), month = Number(mo);
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new ExtractoIllegibleError(`Fecha de operación fuera de rango: "${String(raw)}".`);
  }
  return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
}

/** Busca el valor de un metadato por su etiqueta (celda a la derecha de la etiqueta). */
function metadato(rows: string[][], etiqueta: string): string {
  const needle = norm(etiqueta);
  for (const row of rows) {
    const i = row.findIndex((c) => norm(c).includes(needle));
    if (i >= 0) {
      const val = row.slice(i + 1).find((c) => String(c ?? '').trim() !== '');
      if (val !== undefined) return String(val).trim();
    }
  }
  return '';
}

export class IngXlsStatementReader implements BrokerStatementReader {
  read(contenido: Uint8Array | ArrayBuffer): ExtractoParseado {
    const bytes = contenido instanceof Uint8Array ? contenido : new Uint8Array(contenido);

    let wb: XLSX.WorkBook;
    try {
      wb = XLSX.read(bytes, { type: 'array' });
    } catch (e) {
      throw new ExtractoIllegibleError(`No se pudo leer el fichero como .xls: ${(e as Error).message}`);
    }

    const ws = wb.Sheets[SHEET];
    if (!ws) {
      throw new ExtractoIllegibleError(`El fichero no tiene la hoja "${SHEET}" (¿no es un extracto de ING?).`);
    }

    const rows = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' });

    const headerIdx = rows.findIndex(
      (r) =>
        norm(r[COL.fecha]) === 'FECHA' &&
        norm(r[COL.operacion]) === 'OPERACION' &&
        norm(r[COL.valor]) === 'VALOR' &&
        norm(r[COL.mercado]) === 'MERCADO' &&
        norm(r[COL.titulos]) === 'TITULOS' &&
        norm(r[COL.importe]).includes('IMPORTE'),
    );
    if (headerIdx < 0) {
      throw new ExtractoIllegibleError('No se encontró la cabecera de columnas esperada del extracto de ING.');
    }

    const metadatos: MetadatosExtracto = {
      numeroCuenta: metadato(rows, 'Numero de cuenta'),
      titular: metadato(rows, 'Titular'),
      fechaExportacion: metadato(rows, 'Fecha de exportacion'),
    };

    const operaciones: OperacionImportada[] = [];
    for (const row of rows.slice(headerIdx + 1)) {
      const side = SIDE_BY_OP[norm(row[COL.operacion])];
      if (!side) continue; // no es COMPRA/VENTA (blanco, pie, otro tipo): se ignora (CA-4)
      operaciones.push({
        occurredOn: parseFecha(row[COL.fecha]),
        side,
        nombreBroker: String(row[COL.valor] ?? '').trim(),
        etiquetaMercado: String(row[COL.mercado] ?? '').trim(),
        cantidad: parseDecimal(row[COL.titulos], 'títulos'),
        precioOrigen: parseDecimal(row[COL.precio], 'precio'),
        importeEur: parseDecimal(row[COL.importe], 'importe'),
      });
    }

    return { metadatos, operaciones };
  }
}
