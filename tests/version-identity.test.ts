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

  it('un entorno del todo vacío devuelve las CUATRO claves en `unknown`', () => {
    // SPEC-038 CA-8 / ADR-024 pto. 1: el contrato pasó de tres claves a cuatro.
    // Lo que este caso vigila no es el número, es la propiedad: un canal de build
    // del todo vacío no puede devolver ni una cadena vacía ni un valor inventado.
    expect(resolveIdentity({ version: '', commit: '', environment: '', builtAt: '' })).toEqual({
      version: UNKNOWN,
      commit: UNKNOWN,
      environment: UNKNOWN,
      builtAt: UNKNOWN,
    });
  });

  it('el objeto resuelto tiene exactamente las claves del contrato', () => {
    // De tres a CUATRO por ADR-024 pto. 1, que enmienda D-6 de ADR-018. La
    // igualdad de conjunto sigue siendo la guardia: ni una clave más entra sin un
    // CA que la pida (SPEC-038 CA-3).
    expect(Object.keys(resolveIdentity({ commit: SHA })).sort()).toEqual([
      'builtAt',
      'commit',
      'environment',
      'version',
    ]);
  });
});

/**
 * SPEC-038 CA-8 / ADR-024 pto. 5 — el semver se valida por CONTENIDO.
 *
 * Misma regla que SPEC-031 aplica al sha y a la fecha, y por el mismo motivo: un
 * `version: ""` que se colara diría que este despliegue sabe qué versión es
 * cuando no lo sabe.
 *
 * Con una diferencia deliberada respecto al `commit`: aquí NO se recortan los
 * espacios. CA-8 enumera «con espacios» entre los casos que devuelven la
 * sentinela, así que ` 1.2.3 ` **no** es un semver — es una forma que no es
 * `MAJOR.MINOR.PATCH`. El valor llega de un campo JSON de `package.json` leído en
 * `next.config.mjs`, donde no hay espacios que recortar; ser estricto aquí no
 * cuesta nada y cierra la puerta a que un canal sucio pase por limpio.
 */
describe('SPEC-038 CA-8: el semver de producto', () => {
  for (const valido of ['0.1.0', '10.20.30', '1.0.0', '0.0.0'] as const) {
    it(`\`${valido}\` es un semver admitido y pasa tal cual`, () => {
      expect(resolveIdentity({ version: valido }).version).toBe(valido);
    });
  }

  for (const [caso, valor] of [
    ['ausente', undefined],
    ['nulo', null],
    ['cadena vacía', ''],
    ['solo espacios', '   '],
    ['con espacios alrededor', ' 1.2.3 '],
    ['con un espacio dentro', '1. 2.3'],
    ['sin el segmento de parche', 'v1.2'],
    ['con la `v` delante — la `v` es de la ETIQUETA, no del número', 'v1.2.3'],
    ['con precedencia de prelanzamiento', '1.2.3-beta'],
    ['con metadatos de build', '1.2.3+build.7'],
    ['una palabra', 'latest'],
    ['cuatro segmentos', '1.2.3.4'],
    ['con ceros a la izquierda', '01.2.3'],
    ['un rango de npm', '^1.2.3'],
  ] as const) {
    it(`${caso} -> unknown`, () => {
      expect(resolveIdentity({ version: valor }).version).toBe(UNKNOWN);
    });
  }

  it('validar el semver no contamina a las otras tres claves', () => {
    const identidad = resolveIdentity({
      version: 'latest',
      commit: SHA,
      environment: 'production',
      builtAt: '2026-08-18T10:20:30.123Z',
    });
    expect(identidad).toEqual({
      version: UNKNOWN,
      commit: SHA,
      environment: 'production',
      builtAt: '2026-08-18T10:20:30.123Z',
    });
  });
});
