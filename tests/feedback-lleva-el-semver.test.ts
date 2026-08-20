import { describe, it, expect } from 'vitest';
import { construirMailtoDeFeedback } from '@/lib/feedback/channel';
import { TITULAR } from '@/lib/legal/content';
import { UNKNOWN, resolveIdentity } from '@/lib/version/identity';
import { etiquetaDeVersion } from '@/lib/version/presentation';

/**
 * SPEC-038, F-SPEC-038-7 — la promesa de SPEC-039 CA-13, cumplida aquí.
 *
 * SPEC-039 dejó escrito que *"si SPEC-038 ya está entregada, el prefijo del asunto
 * incluirá el semver sin ningún cambio aquí"*. **Era falso**, y el arquitecto lo
 * verificó contra el código antes de implementar: `construirMailtoDeFeedback`
 * componía el asunto leyendo el campo `commit`, no un campo genérico de versión.
 * Añadir el semver en una clave NUEVA —que es lo correcto, porque dos despliegues
 * comparten semver y nunca comparten commit— dejaba esa afirmación rota **sin que
 * ningún test se enterase**: SPEC-039 está en `hecho` y su prueba compara contra
 * `/api/version`, que seguía cuadrando.
 *
 * Este fichero es esa línea con su test. Vive aparte de `tests/feedback-canal.test.ts`
 * a propósito: aquél es de SPEC-039, que está cerrada, y sigue verde sin tocarlo.
 *
 * El orden es el mismo que CA-2 impone en el pie, y por el mismo motivo: **el semver
 * primero**, porque es lo que el tester cita; **el commit detrás**, porque es lo que
 * precisa. Y el commit va ENTERO, no abreviado: en el asunto no compite por sitio y
 * quien reciba el reporte quiere poder pegarlo en un `git show`.
 */

const SHA = 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2';

const IDENTIDAD = resolveIdentity({
  version: '0.2.0',
  commit: SHA,
  environment: 'production',
  builtAt: '2026-08-19T21:30:00Z',
});

const partes = (identidad = IDENTIDAD) => {
  const url = new URL(construirMailtoDeFeedback(identidad, TITULAR.contacto));
  return {
    asunto: url.searchParams.get('subject') ?? '',
    cuerpo: url.searchParams.get('body') ?? '',
  };
};

describe('F-SPEC-038-7: el asunto lleva el semver, y lo lleva PRIMERO', () => {
  it('el asunto contiene el semver de producto', () => {
    expect(partes().asunto).toContain('v0.2.0');
  });

  it('el semver va DELANTE del commit, igual que en el pie (CA-2)', () => {
    const { asunto } = partes();
    expect(asunto.indexOf('v0.2.0')).toBeLessThan(asunto.indexOf(SHA));
  });

  it('el commit sigue estando, y entero: el semver no lo sustituye (CA-15)', () => {
    // Dos despliegues pueden compartir semver; nunca comparten commit. Si el
    // semver echara al commit del asunto, un reporte dejaría de poder situarse
    // en un artefacto concreto.
    expect(partes().asunto).toContain(SHA);
  });

  it('sigue siendo un prefijo, no una coletilla al final', () => {
    expect(partes().asunto.indexOf('v0.2.0')).toBeLessThan(15);
  });
});

describe('F-SPEC-038-7: el cuerpo dice la versión, y ya no llama versión al commit', () => {
  it('el cuerpo lleva el semver en claro', () => {
    expect(partes().cuerpo).toContain('v0.2.0');
  });

  it('el cuerpo etiqueta cada dato por su nombre', () => {
    const { cuerpo } = partes();
    expect(cuerpo).toMatch(/versión:\s*v0\.2\.0/);
    // Antes ponía «versión: <sha>», que era lo único que había. Ahora que hay dos
    // datos distintos, llamarlos igual sería peor que no etiquetarlos.
    expect(cuerpo).toMatch(new RegExp(`commit:\\s*${SHA}`));
    expect(cuerpo).toMatch(/entorno:\s*production/);
    expect(cuerpo).toMatch(/construido:/);
  });

  it('el cuerpo sigue dejando sitio para escribir', () => {
    expect(partes().cuerpo).toMatch(/\n\n/);
  });
});

describe('F-SPEC-038-7: un despliegue sin identidad tampoco miente en el correo', () => {
  const sinNada = resolveIdentity({});

  it('el asunto manda la sentinela, no un hueco ni un `v` suelto', () => {
    const { asunto } = partes(sinNada);
    expect(asunto).toContain(UNKNOWN);
    expect(asunto).not.toContain('v ');
    expect(asunto).not.toMatch(/vunknown/);
  });

  it('el cuerpo también', () => {
    expect(partes(sinNada).cuerpo).toContain(UNKNOWN);
  });
});

describe('F-SPEC-038-7: es el MISMO dato que enseña el pie y que responde /api/version', () => {
  it('el semver del asunto es el de la identidad, sin copiarlo por otra vía', () => {
    // La comprobación que hace que esto no pueda desincronizarse: se compone la
    // etiqueta del pie a partir de la MISMA identidad y se exige que el asunto
    // lleve exactamente ese número.
    const enElPie = etiquetaDeVersion(IDENTIDAD).version;
    expect(partes().asunto).toContain(enElPie);
  });

  it('con otra identidad, otro asunto: no hay literal escondido', () => {
    const otra = resolveIdentity({
      version: '9.9.9',
      commit: 'f'.repeat(40),
      environment: 'preview',
      builtAt: '2020-01-02T03:04:05Z',
    });
    expect(partes(otra).asunto).toContain('v9.9.9');
    expect(partes(otra).asunto).not.toContain('v0.2.0');
  });
});
