import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { UNKNOWN, resolveIdentity, type DeploymentIdentity } from '@/lib/version/identity';
import {
  LARGO_DEL_COMMIT_CORTO,
  SEPARADOR,
  etiquetaDeVersion,
} from '@/lib/version/presentation';

/**
 * SPEC-038 CA-5, CA-9, CA-10 y CA-11 — la versión, dicha para personas.
 *
 * Función pura sobre una `DeploymentIdentity` ya resuelta: no lee `process.env`,
 * no toca red ni disco y no menciona los nombres del canal de build. Por eso se
 * puede probar sin levantar Next, y por eso el pie y `/api/version` no pueden
 * desincronizarse: no hay dos lectores, hay uno (ADR-024 pto. 6).
 *
 * La flecha va en un solo sentido —esto importa la identidad, la identidad no
 * importa esto— y es lo que mantiene el grafo de `/api/version` tan pequeño como
 * lo dejó SPEC-031 (CA-7). Lo vigila `tests/version-import-graph.test.ts`.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const moduloPath = join(rootDir, 'src', 'lib', 'version', 'presentation.ts');

const SHA = 'a1b2c3d4e5f60718293a4b5c6d7e8f9012345678';
const CORTO = 'a1b2c3d';
const ISO = '2026-08-19T21:30:00.000Z';

/** Una identidad completa y válida, resuelta por la vía de siempre. */
const completa = (extra: Partial<DeploymentIdentity> = {}): DeploymentIdentity => ({
  ...resolveIdentity({ version: '0.2.0', commit: SHA, environment: 'production', builtAt: ISO }),
  ...extra,
});

describe('SPEC-038 CA-2: el semver va primero, y es lo citable', () => {
  it('la versión se enseña como `vMAJOR.MINOR.PATCH`', () => {
    expect(etiquetaDeVersion(completa()).version).toBe('v0.2.0');
  });

  it('el texto EMPIEZA por el semver: es lo que el tester copia', () => {
    expect(etiquetaDeVersion(completa()).texto.startsWith('v0.2.0')).toBe(true);
  });

  it('lleva el commit abreviado y la fecha de construcción, en ese orden', () => {
    const etiqueta = etiquetaDeVersion(completa());
    const texto = etiqueta.texto;

    expect(texto.indexOf(etiqueta.version)).toBeLessThan(texto.indexOf(etiqueta.commit));
    expect(texto.indexOf(etiqueta.commit)).toBeLessThan(texto.indexOf(etiqueta.construido));
  });

  it('el commit abreviado es PREFIJO EXACTO del commit completo (CA-4)', () => {
    const { commit } = etiquetaDeVersion(completa());
    expect(commit).toHaveLength(LARGO_DEL_COMMIT_CORTO);
    expect(SHA.startsWith(commit)).toBe(true);
  });

  it('el instante exacto viaja aparte, sin redondear, para poder compararlo', () => {
    // La fecha que se LEE es corta y sin zona local; la que se COMPARA es el ISO
    // tal cual. CA-4 exige "el mismo instante" que `builtAt`, y un texto
    // formateado no basta para demostrarlo.
    expect(etiquetaDeVersion(completa()).construidoISO).toBe(ISO);
  });
});

describe('SPEC-038 CA-11: los siete casos, sin lanzar', () => {
  it('1. identidad completa', () => {
    expect(etiquetaDeVersion(completa()).texto).toBe(
      `v0.2.0${SEPARADOR}${CORTO}${SEPARADOR}2026-08-19 21:30 UTC`,
    );
  });

  it('2. commit corto (7 caracteres) — se enseña entero, no se recorta a menos', () => {
    const etiqueta = etiquetaDeVersion(completa({ commit: CORTO }));
    expect(etiqueta.commit).toBe(CORTO);
    expect(etiqueta.texto).toContain(CORTO);
  });

  it('3. commit largo (40 caracteres) — se abrevia', () => {
    const etiqueta = etiquetaDeVersion(completa({ commit: SHA }));
    expect(etiqueta.commit).toBe(CORTO);
    expect(etiqueta.texto).not.toContain(SHA);
  });

  it('4. semver desconocido', () => {
    const etiqueta = etiquetaDeVersion(completa({ version: UNKNOWN }));
    expect(etiqueta.version).toBe('versión desconocida');
    expect(etiqueta.texto.startsWith('versión desconocida')).toBe(true);
  });

  it('5. builtAt desconocido', () => {
    const etiqueta = etiquetaDeVersion(completa({ builtAt: UNKNOWN }));
    expect(etiqueta.construido).toBe('fecha de construcción desconocida');
    expect(etiqueta.construidoISO).toBeNull();
  });

  it('6. environment desconocido — se dice, porque no es producción', () => {
    const etiqueta = etiquetaDeVersion(completa({ environment: UNKNOWN }));
    expect(etiqueta.entorno).toBe('entorno desconocido');
    expect(etiqueta.texto).toContain('entorno desconocido');
  });

  it('7. los CUATRO desconocidos a la vez', () => {
    const nada = resolveIdentity({});
    const etiqueta = etiquetaDeVersion(nada);

    expect(etiqueta.texto).toBe(
      [
        'versión desconocida',
        'entorno desconocido',
        'commit desconocido',
        'fecha de construcción desconocida',
      ].join(SEPARADOR),
    );
  });

  it('ninguno de los siete lanza', () => {
    const casos: DeploymentIdentity[] = [
      completa(),
      completa({ commit: CORTO }),
      completa({ commit: SHA }),
      completa({ version: UNKNOWN }),
      completa({ builtAt: UNKNOWN }),
      completa({ environment: UNKNOWN }),
      resolveIdentity({}),
    ];
    for (const caso of casos) expect(() => etiquetaDeVersion(caso)).not.toThrow();
  });
});

describe('SPEC-038 CA-9: lo desconocido se dice, no se disimula', () => {
  const desconocidas = [
    completa({ version: UNKNOWN }),
    completa({ commit: UNKNOWN }),
    completa({ environment: UNKNOWN }),
    completa({ builtAt: UNKNOWN }),
    resolveIdentity({}),
  ];

  it('nunca hay un hueco: ninguna pieza sale vacía', () => {
    for (const identidad of desconocidas) {
      const etiqueta = etiquetaDeVersion(identidad);
      for (const pieza of [etiqueta.version, etiqueta.commit, etiqueta.construido]) {
        expect(pieza.trim()).not.toBe('');
      }
      expect(etiqueta.texto.trim()).not.toBe('');
    }
  });

  it('nunca aparece la palabra cruda `unknown` sin contexto', () => {
    // La sentinela es un valor de máquina; a una persona no le dice nada, y peor:
    // parece un identificador válido. Que se VEA es la alarma (SPEC-031), pero se
    // ve dicha en castellano.
    for (const identidad of desconocidas) {
      expect(etiquetaDeVersion(identidad).texto).not.toContain(UNKNOWN);
    }
  });

  it('nunca se inventa un valor: no hay `v0.0.0` ni una fecha de relleno', () => {
    const etiqueta = etiquetaDeVersion(resolveIdentity({}));
    expect(etiqueta.texto).not.toMatch(/v\d/);
    expect(etiqueta.texto).not.toMatch(/\d{4}-\d{2}-\d{2}/);
  });

  it('dos separadores seguidos serían un hueco: no los hay', () => {
    for (const identidad of desconocidas) {
      expect(etiquetaDeVersion(identidad).texto).not.toContain(`${SEPARADOR}${SEPARADOR}`);
    }
  });
});

describe('SPEC-038 CA-10: el entorno se dice cuando importa y calla cuando no', () => {
  it('en producción no se añade ruido', () => {
    const etiqueta = etiquetaDeVersion(completa({ environment: 'production' }));
    expect(etiqueta.entorno).toBeNull();
    expect(etiqueta.texto).not.toContain('production');
  });

  for (const entorno of ['preview', 'development'] as const) {
    it(`en \`${entorno}\` sí se muestra: nadie debe confundirlo con la app real`, () => {
      const etiqueta = etiquetaDeVersion(completa({ environment: entorno }));
      expect(etiqueta.entorno).toBe(entorno);
      expect(etiqueta.texto).toContain(entorno);
    });
  }

  it('el entorno va justo detrás del semver, no escondido al final', () => {
    const etiqueta = etiquetaDeVersion(completa({ environment: 'preview' }));
    const texto = etiqueta.texto;
    expect(texto.indexOf('preview')).toBeLessThan(texto.indexOf(etiqueta.commit));
  });
});

describe('SPEC-038 CA-5: una sola fuente de verdad', () => {
  const fuente = () => readFileSync(moduloPath, 'utf8');

  it('el módulo no lee `process.env`', () => {
    expect(fuente()).not.toContain('process.env');
  });

  it('no menciona los nombres de las variables del canal de build', () => {
    // Si los mencionara, sería un SEGUNDO lector del canal, y dos lectores se
    // desincronizan. Aquí solo entra lo que ya resolvió `resolveIdentity`.
    expect(fuente()).not.toContain('STOCKEIRO_');
  });

  it('no lee `package.json` (CA-6)', () => {
    const codigo = fuente()
      .replace(/\/\*[\s\S]*?\*\//g, ' ')
      .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    expect(codigo).not.toContain('package.json');
  });

  it('todo lo que enseña sale del argumento: cambiar la identidad cambia la etiqueta', () => {
    // La prueba de que no hay una segunda fuente escondida: con otra identidad,
    // otra etiqueta. Si algo viniera de fuera, se quedaría igual.
    const a = etiquetaDeVersion(completa());
    const b = etiquetaDeVersion(
      resolveIdentity({
        version: '9.9.9',
        commit: 'f'.repeat(40),
        environment: 'preview',
        builtAt: '2020-01-02T03:04:05Z',
      }),
    );

    expect(b.version).not.toBe(a.version);
    expect(b.commit).not.toBe(a.commit);
    expect(b.construido).not.toBe(a.construido);
    expect(b.entorno).not.toBe(a.entorno);
  });
});
