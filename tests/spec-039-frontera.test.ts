import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FEEDBACK_ENV_KEY } from '@/lib/feedback/channel';
import { TITULAR } from '@/lib/legal/content';

/**
 * SPEC-039 CA-16 — la clave nueva se declara donde el proyecto declara sus claves.
 *
 * La lista cerrada de `.env.example` la congela `tests/spec-031-frontera.test.ts` y
 * ahí es donde `FEEDBACK_EMAIL` pide permiso (de diez claves a once, con esa y solo
 * con esa). Lo que se comprueba AQUÍ es lo otro que CA-16 exige y que aquella lista
 * no puede ver: que la clave venga **explicada** en la plantilla y **anotada** en el
 * runbook, para que quien despliegue no se la encuentre por sorpresa.
 *
 * Y la mitad más importante: que la dirección **no se duplique**. `hola@tremen.dev`
 * es la misma que el contacto del titular de SPEC-035 y se escribe en un solo sitio.
 * Dos literales acaban siendo dos direcciones distintas publicadas, y una de ellas
 * muerta — el modo de fallo exacto que F-SPEC-039-2 quiso evitar.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const leer = (...ruta: string[]) => readFileSync(join(rootDir, ...ruta), 'utf8');

describe('SPEC-039 CA-16: la clave del canal de feedback, declarada y explicada', () => {
  it('.env.example la declara con una explicación de verdad, no una línea suelta', () => {
    const plantilla = leer('.env.example');
    const bloque = plantilla.slice(plantilla.indexOf('Canal de feedback'));

    expect(plantilla).toContain(FEEDBACK_ENV_KEY);
    // Explicación: qué es, qué pasa si falta y por qué existe.
    expect(bloque).toMatch(/si falta/i);
    expect(bloque).toMatch(/titular/i);
    expect(bloque.length, 'una clave sin explicación es una clave que nadie sabe poner')
      .toBeGreaterThan(300);
  });

  it('el runbook la anota: quien despliega no se la encuentra por sorpresa', () => {
    const runbook = leer('docs', 'despliegue.md');
    expect(runbook).toContain(FEEDBACK_ENV_KEY);
    expect(runbook).toContain('SPEC-039');
  });

  it('la dirección se escribe UNA vez: el canal la lee del contacto del titular', () => {
    // Si alguien vuelve a teclear el correo en el módulo del canal, esto se pone rojo.
    expect(leer('src', 'lib', 'feedback', 'channel.ts')).not.toContain(TITULAR.contacto);
  });

  it('esta spec no añade NINGUNA otra variable de entorno', () => {
    // El resto de EPIC-004 no toca configuración. Si aparece una segunda clave en el
    // código de esta spec, tiene que venir con su CA — igual que vino esta.
    const fuentes = [
      leer('src', 'lib', 'feedback', 'channel.ts'),
      leer('src', 'lib', 'help', 'content.ts'),
      leer('src', 'app', 'ayuda', 'page.tsx'),
      leer('src', 'app', 'page.tsx'),
      leer('src', 'app', 'app-footer.tsx'),
    ].join('\n');

    const claves = [...fuentes.matchAll(/process\.env\.([A-Z][A-Z0-9_]*)/g)].map((m) => m[1]);
    const porNombre = [...fuentes.matchAll(/env\[FEEDBACK_ENV_KEY\]/g)].map(() => FEEDBACK_ENV_KEY);

    expect([...new Set([...claves, ...porNombre])]).toEqual([FEEDBACK_ENV_KEY]);
  });
});
