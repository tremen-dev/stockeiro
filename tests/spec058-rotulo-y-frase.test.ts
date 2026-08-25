import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { AVISO_LO_EMITE_EL_CICLO, CADENCIA } from '@/lib/help/content';
import {
  CICLOS_HASTA_SIN_REFRESCAR,
  UMBRAL_SIN_REFRESCAR_HORAS,
} from '@/lib/market/sin-refrescar';
import { PRESUPUESTO_REFRESCO_BAJO_DEMANDA_MS } from '@/lib/market/refresh';
import { afirmacionesProhibidasEn } from './ayuda-afirmaciones-prohibidas';

/**
 * SPEC-058 **CA-11** (la mitad que no necesita navegador) y **CA-16**.
 *
 * Dos cosas distintas, y las dos son de vocabulario:
 *
 *  - **CA-11**: la frase que cuenta que la pantalla puede ir por delante del correo vive
 *    en **un** módulo y la muestran **dos** sitios. La otra mitad —que `/vigiladas` la
 *    enseñe de verdad cuando hay algo en zona— es de navegador y está en
 *    `tests/e2e/spec058-alta-con-precio.spec.ts`.
 *  - **CA-16**: el rótulo de dominio se **copia** de `docs/fundacion/dominio.md` y
 *    `docs/fundacion/reglas.md`, que los escribe sdd-arquitecto en el gate (ADR-025), y
 *    la precisión de RN-16 es **solo de redacción**: umbral, medida y motivos, intactos.
 */

const fuente = (ruta: string) => readFileSync(ruta, 'utf8');
const DOMINIO = () => fuente('docs/fundacion/dominio.md');
const REGLAS = () => fuente('docs/fundacion/reglas.md');
const seccionCadencia = () => [CADENCIA.titulo, ...CADENCIA.parrafos].join('\n');

describe('SPEC-058 CA-11: una frase, dos sitios que la muestran, ninguna copia', () => {
  it('la frase existe y dice las dos cosas: que el aviso es del ciclo y que la pantalla va por delante', () => {
    expect(AVISO_LO_EMITE_EL_CICLO).toMatch(/en zona/i);
    expect(AVISO_LO_EMITE_EL_CICLO).toMatch(/ciclo diario/i);
    expect(AVISO_LO_EMITE_EL_CICLO).toMatch(/por delante del correo/i);
  });

  it('la sección de cadencia de /ayuda la incluye LITERALMENTE', () => {
    expect(seccionCadencia()).toContain(AVISO_LO_EMITE_EL_CICLO);
  });

  it('/vigiladas la muestra desde el módulo compartido: no hay una segunda redacción', () => {
    const pagina = fuente('src/app/vigiladas/page.tsx');
    expect(pagina).toMatch(/AVISO_LO_EMITE_EL_CICLO/);
    expect(pagina).toMatch(/from '@\/lib\/help\/content'/);
    // Y no escribe el texto a mano: dos redacciones parecidas acaban diciendo cosas
    // distintas sobre el mismo hecho (ADR-026 pto. 2, precedente SPEC-044 CA-22).
    expect(pagina).not.toContain('por delante del correo');
  });

  it('y la enseña SOLO cuando hay algo en zona, que es cuando se puede leer mal', () => {
    const pagina = fuente('src/app/vigiladas/page.tsx');
    expect(pagina).toMatch(/state === 'buy'/);
    expect(pagina).toMatch(/state === 'sell'/);
    expect(pagina).toMatch(/state === 'both'/);
  });

  it('la prosa de la cadencia DEJA de decir que el ciclo es quien pide los precios', () => {
    const texto = seccionCadencia();
    // Lo que sigue diciendo, y es lo que importa (D-2): el ciclo es el ÚNICO que compara
    // con las zonas y avisa.
    expect(texto).toMatch(/[uú]nico que compara/i);
    // Y lo que ya no puede decir: que los precios se pidan solo ahí. Desde RN-17 hay dos
    // entradas, y la sección nombra la segunda.
    expect(texto).toMatch(/vigilar una acci[oó]n/i);
    expect(texto).not.toMatch(/se piden los precios de todo lo que alguien vigila/i);
  });

  it('la frase nueva no promete lo que D-2 niega (la lista cerrada de SPEC-039 CA-7)', () => {
    // La tentación aquí es enorme: se está hablando de "cuándo llega el aviso". Un
    // «te avisamos al instante» se colaría solo, y es justo lo que R-4 dice que gasta
    // la publicación. Se pasa por la misma guardia que la ayuda entera.
    expect(afirmacionesProhibidasEn(AVISO_LO_EMITE_EL_CICLO)).toEqual([]);
    expect(afirmacionesProhibidasEn(seccionCadencia())).toEqual([]);
  });
});

describe('SPEC-058 CA-16: el rótulo se copia de los documentos de verdad, no se inventa', () => {
  it('«refresco bajo demanda» y RN-17 están escritos en dominio.md y reglas.md', () => {
    // Si el término faltara cuando llega la implementación, lo que toca es levantar el
    // residual — no escribirlo en el documento de verdad (ADR-025).
    expect(DOMINIO()).toMatch(/\|\s*Refresco bajo demanda\s*\|/);
    expect(REGLAS()).toMatch(/\*\*RN-17\*\* \(Refresco bajo demanda\)/);
  });

  it('el código usa ESE rótulo, con esas palabras', () => {
    const refresh = fuente('src/lib/market/refresh.ts');
    expect(refresh).toMatch(/refresco bajo demanda/i);
    expect(refresh).toContain('RN-17');
    expect(refresh).toContain('ADR-038');
    // Y no un sinónimo de los que el dominio descartó a propósito: «refresco manual»
    // (lo que lo caracteriza no es que lo pulse una persona) y «refresco inmediato»
    // (prometería sobre el aviso justo lo que RN-17(a) niega).
    for (const ruta of [
      'src/lib/market/refresh.ts',
      'src/app/vigiladas/actions.ts',
      'src/lib/market/sin-refrescar.ts',
    ]) {
      expect(fuente(ruta), `${ruta} usa un nombre descartado`).not.toMatch(
        /refresco\s+(manual|inmediato)/i,
      );
    }
  });

  it('la precisión de RN-16 es SOLO de redacción: umbral, medida y motivos, intactos', () => {
    // El umbral no se mueve…
    expect(CICLOS_HASTA_SIN_REFRESCAR).toBe(1.5);
    expect(UMBRAL_SIN_REFRESCAR_HORAS).toBe(36);
    const bloque = REGLAS().slice(REGLAS().indexOf('**RN-16**'));
    expect(bloque.slice(0, 1400)).toContain(`${UMBRAL_SIN_REFRESCAR_HORAS} h`);
    // …la medida sigue siendo `updated_at` y NUNCA `as_of`…
    const modulo = fuente('src/lib/market/sin-refrescar.ts');
    expect(modulo).toContain('RN-16');
    expect(modulo).toMatch(/NUNCA por `as_of`/);
    // …y lo único que cambia es de quién se dice que escribió la fila: ya no «el ciclo»,
    // porque desde RN-17 hay dos escritores.
    expect(modulo).toMatch(/dos\s+\*\*escritores\*\*|\*\*dos escritores\*\*/i);
    expect(modulo, 'la redacción vieja atribuía la escritura al ciclo').not.toMatch(
      /el momento en que el ciclo escribió la fila/i,
    );
  });

  it('el umbral sigue teniendo UN solo hogar: el camino nuevo no escribe su propio número', () => {
    // La condición de gasto de RN-17(b) es el mismo umbral de RN-16, y por eso no puede
    // aparecer aquí ni el 36 ni la aritmética que lo reconstruye (SPEC-043 CA-12).
    for (const ruta of ['src/lib/market/refresh.ts', 'src/app/vigiladas/actions.ts']) {
      const texto = fuente(ruta);
      expect(texto, `${ruta} escribe un segundo umbral`).not.toMatch(/\b36\b/);
      expect(texto, `${ruta} reconstruye el umbral a mano`).not.toMatch(/3_?600_?000|86_?400_?000/);
    }
    expect(fuente('src/lib/market/refresh.ts')).toMatch(/from '\.\/sin-refrescar'/);
    expect(fuente('src/lib/market/refresh.ts')).toMatch(/cotizacionVigente/);
  });

  it('el presupuesto de tiempo se declara en UN solo sitio (ADR-026 pto. 2; ADR-038 pto. 5)', () => {
    expect(PRESUPUESTO_REFRESCO_BAJO_DEMANDA_MS).toBe(3_000);
    // Nadie más lo teclea: ni la action que lo consume, ni la factory del proveedor.
    for (const ruta of [
      'src/app/vigiladas/actions.ts',
      'src/lib/market/quote-provider-factory.ts',
      'src/lib/market/marketstack-provider.ts',
    ]) {
      expect(fuente(ruta), `${ruta} escribe un segundo presupuesto`).not.toMatch(/3_?000\b/);
    }
    // Y vive en el DOMINIO, no en el adaptador: es la paciencia de quien llama.
    expect(fuente('src/lib/market/refresh.ts')).toContain('PRESUPUESTO_REFRESCO_BAJO_DEMANDA_MS');
  });
});
