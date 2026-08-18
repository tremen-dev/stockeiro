import { describe, it, expect } from 'vitest';
import { UNKNOWN, resolveIdentity } from '@/lib/version/identity';

/**
 * SPEC-031 CA-3 — `unknown` es una respuesta, y la cadena vacía cuenta como ausencia.
 *
 * El caso importante NO es "falta la variable": es que **viene vacía**. ADR-018
 * verificó el 2026-08-17 que sin integración Git las `VERCEL_GIT_*` existen y
 * llegan como `''`. Un `??` devolvería `""` y el endpoint diría que sabe de dónde
 * viene cuando no lo sabe; por eso la resolución mira el CONTENIDO, no la
 * presencia.
 *
 * La sentinela es `unknown` (no `desconocido`) por decisión del humano en el gate
 * del 2026-08-18: el valor viaja en un JSON de claves inglesas y la regla del
 * proyecto es código e identificadores en inglés. Se aparta de la letra de
 * ADR-018 D-6, no de su decisión ("mecanismo libre, propiedades obligatorias").
 */

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';

describe('SPEC-031 CA-3: la sentinela es `unknown`', () => {
  it('la sentinela se llama exactamente `unknown`', () => {
    expect(UNKNOWN).toBe('unknown');
  });

  describe('commit', () => {
    it('un sha hexadecimal válido pasa tal cual, en minúsculas', () => {
      expect(resolveIdentity({ commit: SHA }).commit).toBe(SHA);
      expect(resolveIdentity({ commit: SHA.toUpperCase() }).commit).toBe(SHA);
      // 7 caracteres es el sha corto: también vale.
      expect(resolveIdentity({ commit: 'a1b2c3d' }).commit).toBe('a1b2c3d');
    });

    it('se le recortan los espacios antes de juzgarlo', () => {
      expect(resolveIdentity({ commit: `  ${SHA}\n` }).commit).toBe(SHA);
    });

    for (const [caso, valor] of [
      ['ausente', undefined],
      ['nulo', null],
      ['cadena vacía — EL CASO REAL DE HOY', ''],
      ['solo espacios', '   \t\n'],
      ['no hexadecimal', 'no-es-un-sha'],
      ['demasiado corto', 'a1b2c3'],
      ['demasiado largo', `${SHA}00`],
      ['hexadecimal con letras fuera de rango', 'g1b2c3d4e5'],
    ] as const) {
      it(`${caso} -> unknown`, () => {
        expect(resolveIdentity({ commit: valor }).commit).toBe(UNKNOWN);
      });
    }
  });

  describe('environment', () => {
    for (const valido of ['production', 'preview', 'development'] as const) {
      it(`\`${valido}\` es un entorno admitido`, () => {
        expect(resolveIdentity({ environment: valido }).environment).toBe(valido);
      });
    }

    for (const [caso, valor] of [
      ['ausente', undefined],
      ['nulo', null],
      ['cadena vacía', ''],
      ['solo espacios', '  '],
      ['un entorno inventado', 'staging'],
      ['el nombre en español', 'produccion'],
    ] as const) {
      it(`${caso} -> unknown`, () => {
        expect(resolveIdentity({ environment: valor }).environment).toBe(UNKNOWN);
      });
    }
  });

  describe('builtAt', () => {
    it('un ISO-8601 válido pasa tal cual', () => {
      expect(resolveIdentity({ builtAt: '2026-08-18T10:20:30.123Z' }).builtAt).toBe(
        '2026-08-18T10:20:30.123Z',
      );
      expect(resolveIdentity({ builtAt: '2026-08-18T10:20:30+02:00' }).builtAt).toBe(
        '2026-08-18T10:20:30+02:00',
      );
    });

    for (const [caso, valor] of [
      ['ausente', undefined],
      ['nulo', null],
      ['cadena vacía', ''],
      ['solo espacios', ' '],
      ['una fecha suelta sin hora', '2026-08-18'],
      ['un instante imposible', '2026-13-45T99:99:99Z'],
      ['texto', 'ayer por la tarde'],
      ['un epoch en milisegundos', '1755511230123'],
    ] as const) {
      it(`${caso} -> unknown`, () => {
        expect(resolveIdentity({ builtAt: valor }).builtAt).toBe(UNKNOWN);
      });
    }
  });

  it('un entorno del todo vacío devuelve las tres claves en `unknown`', () => {
    expect(resolveIdentity({ commit: '', environment: '', builtAt: '' })).toEqual({
      commit: UNKNOWN,
      environment: UNKNOWN,
      builtAt: UNKNOWN,
    });
  });

  it('el objeto resuelto tiene exactamente las tres claves del contrato', () => {
    expect(Object.keys(resolveIdentity({ commit: SHA })).sort()).toEqual([
      'builtAt',
      'commit',
      'environment',
    ]);
  });
});
