import { describe, it, expect } from 'vitest';
import { OPERATING_MICS } from '@/lib/market/mic';
import { MARKET_NAME, marketName } from '@/lib/market/market-name';
import { instrumentTypeText } from '@/lib/market/instrument-type-text';
import { SEARCH_DISCARD_TEXT, searchDiscardText } from '@/lib/market/search-discard-text';
import type { SearchDiscardReason } from '@/lib/market/search-provider';

/**
 * SPEC-029 — lo que el usuario LEE del tipo y del mercado.
 *
 * Una sola idea gobierna los dos mapas, y explica por qué se comportan distinto:
 * **no perder información y no inventarla**. El vocabulario de tipos lo cierra el
 * proveedor, así que lo desconocido se muestra EN CRUDO (ADR-020 pto. 3); el de
 * mercados lo cerramos nosotros (`mic.ts`), así que se traduce SIEMPRE (CA-14).
 */

describe('CA-11: traducción del tipo — lo conocido se traduce, lo desconocido se muestra', () => {
  it('las etiquetas conocidas salen en vocabulario del dominio', () => {
    expect(instrumentTypeText('Common Stock')).toBe('Acción');
    expect(instrumentTypeText('REIT')).toBe('REIT');
    expect(instrumentTypeText('American Depositary Receipt')).toBe('ADR');
    expect(instrumentTypeText('ETF')).toBe('ETF');
  });

  it('reconoce la etiqueta sin importar caja ni espacios sobrantes', () => {
    expect(instrumentTypeText('  common stock ')).toBe('Acción');
    expect(instrumentTypeText('american depositary receipt')).toBe('ADR');
  });

  it('una etiqueta DESCONOCIDA sale tal cual la dio el proveedor: nunca «Otro», nunca oculta', () => {
    expect(instrumentTypeText('Closed-End Fund')).toBe('Closed-End Fund');
    expect(instrumentTypeText('Unit')).toBe('Unit');
    expect(instrumentTypeText('Zzz Instrumento Inventado')).toBe('Zzz Instrumento Inventado');
    expect(instrumentTypeText('Closed-End Fund')).not.toMatch(/otro/i);
  });

  it('una etiqueta VACÍA no muestra nada: ni hueco raro ni «—» engañoso', () => {
    expect(instrumentTypeText('')).toBe('');
    expect(instrumentTypeText('   ')).toBe('');
    expect(instrumentTypeText(null)).toBe('');
    expect(instrumentTypeText(undefined)).toBe('');
  });
});

describe('CA-14: el mapa de mercados es TOTAL sobre los operating MIC soportados', () => {
  it('cada operating MIC de `mic.ts` tiene nombre, y no sobra ninguno', () => {
    // Si algún día se amplía OPERATING_MICS, este test cae hasta que el mapa se amplíe
    // con él: es lo que impide que aparezca una celda de mercado con el código pelado.
    expect(Object.keys(MARKET_NAME).sort()).toEqual([...OPERATING_MICS].sort());
    for (const mic of OPERATING_MICS) {
      expect(MARKET_NAME[mic]).toBeTruthy();
    }
  });

  it('traduce los 7 al nombre de dominio que fija la spec', () => {
    expect(marketName('BMEX')).toBe('BME');
    expect(marketName('XNAS')).toBe('NASDAQ');
    expect(marketName('XNYS')).toBe('NYSE');
    expect(marketName('XETR')).toBe('Xetra');
    expect(marketName('XSTO')).toBe('Nasdaq Estocolmo');
    expect(marketName('XPAR')).toBe('Euronext París');
    expect(marketName('XAMS')).toBe('Euronext Ámsterdam');
  });

  it('un micCode NULL (símbolo legacy pre-ADR-007) no inventa mercado: cadena vacía', () => {
    // No se rellena con `exchange`, ni con «—», ni con el ticker: de esos símbolos NO
    // sabemos en qué mercado cotizan, y escribir uno sería inventarlo.
    expect(marketName(null)).toBe('');
    expect(marketName(undefined)).toBe('');
    expect(marketName('')).toBe('');
    expect(marketName('   ')).toBe('');
  });

  it('un MIC fuera de los 7 se muestra EN CRUDO, nunca oculto ni convertido en hueco', () => {
    expect(marketName('XLON')).toBe('XLON');
    expect(marketName('PINX')).toBe('PINX');
  });
});

describe('CA-10: el motivo del descarte tiene texto de usuario, y es vocabulario del dominio', () => {
  const REASONS: SearchDiscardReason[] = ['mercado_no_soportado', 'sin_identidad_de_mercado'];

  it('los dos motivos tienen texto, y son textos distintos', () => {
    expect(Object.keys(SEARCH_DISCARD_TEXT).sort()).toEqual([...REASONS].sort());
    expect(searchDiscardText('mercado_no_soportado')).not.toBe(searchDiscardText('sin_identidad_de_mercado'));
    for (const r of REASONS) expect(searchDiscardText(r)).toBeTruthy();
  });

  it('el texto crudo del proveedor NO sale a la UI (aserto negativo, SPEC-016 CA-1)', () => {
    for (const r of REASONS) {
      const t = searchDiscardText(r);
      expect(t).not.toMatch(/mic_code|instrument_type|symbol_search|twelve\s*data|upgrade|plan|\d{3}/i);
    }
  });
});
