import { describe, it, expect } from 'vitest';
import {
  ETIQUETA_FEEDBACK,
  FEEDBACK_ENV_KEY,
  construirMailtoDeFeedback,
  direccionDeFeedback,
} from '@/lib/feedback/channel';
import { TITULAR } from '@/lib/legal/content';
import { deploymentIdentity, resolveIdentity, UNKNOWN } from '@/lib/version/identity';

/**
 * SPEC-039 CA-12 y CA-13 — el canal de feedback es un enlace, y lo que viaja por él.
 *
 * La épica lo decidió así con estas palabras: *"el canal de feedback es un enlace, no
 * una bandeja"*. Un formulario propio significaría tabla, moderación y un compromiso
 * de respuesta que hoy nadie quiere dar. Lo único que se añade por encima del
 * `mailto:` pelado es **la versión del despliegue prefijada**, porque un reporte sin
 * versión obliga a una ida y vuelta que con veinte testers se nota.
 *
 * La versión sale de `deploymentIdentity` (SPEC-031 / ADR-024), la MISMA fuente que
 * responde `/api/version` y que el pie enseñará cuando entre SPEC-038. No hay
 * dependencia entre las dos specs: beben del mismo sitio, no una de la otra.
 */

const IDENTIDAD = resolveIdentity({
  commit: 'a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2',
  environment: 'production',
  builtAt: '2026-08-19T21:30:00Z',
});

describe('CA-13: la dirección no se duplica, se comparte', () => {
  it('por defecto es EXACTAMENTE la del contacto del titular (SPEC-035)', () => {
    expect(direccionDeFeedback({})).toBe(TITULAR.contacto);
    expect(direccionDeFeedback({})).toBe('hola@tremen.dev');
  });

  it('se puede reapuntar por entorno sin tocar código', () => {
    expect(direccionDeFeedback({ [FEEDBACK_ENV_KEY]: 'otra@tremen.dev' })).toBe(
      'otra@tremen.dev',
    );
  });

  it('una variable vacía o en blanco NO es una dirección: se cae al contacto del titular', () => {
    // Vercel deja variables definidas y vacías; un `??` mandaría el feedback a la
    // dirección `mailto:` vacía y el tester no se enteraría de que no llegó.
    for (const valor of ['', '   ', 'no-es-un-correo']) {
      expect(direccionDeFeedback({ [FEEDBACK_ENV_KEY]: valor })).toBe(TITULAR.contacto);
    }
  });
});

describe('CA-13: lo que se manda lleva la versión puesta', () => {
  const mailto = () => construirMailtoDeFeedback(IDENTIDAD, TITULAR.contacto);
  const partes = () => {
    const url = new URL(mailto());
    return {
      destino: decodeURIComponent(url.pathname),
      asunto: url.searchParams.get('subject') ?? '',
      cuerpo: url.searchParams.get('body') ?? '',
    };
  };

  it('es un mailto a la dirección del canal', () => {
    expect(mailto().startsWith('mailto:')).toBe(true);
    expect(partes().destino).toBe(TITULAR.contacto);
  });

  it('el asunto lleva la versión PREFIJADA, no escondida al final', () => {
    expect(partes().asunto.indexOf(IDENTIDAD.commit)).toBeLessThan(24);
  });

  it('el cuerpo lleva los tres datos de identidad del despliegue', () => {
    const { cuerpo } = partes();
    expect(cuerpo).toContain(IDENTIDAD.commit);
    expect(cuerpo).toContain(IDENTIDAD.environment);
    expect(cuerpo).toContain(IDENTIDAD.builtAt);
  });

  it('deja sitio para escribir: el tester no tiene que borrar nada para empezar', () => {
    expect(partes().cuerpo).toMatch(/\n\n/);
  });

  it('un despliegue sin identidad manda la sentinela, no una cadena vacía', () => {
    const sinIdentidad = resolveIdentity({});
    const { asunto, cuerpo } = (() => {
      const url = new URL(construirMailtoDeFeedback(sinIdentidad, TITULAR.contacto));
      return { asunto: url.searchParams.get('subject') ?? '', cuerpo: url.searchParams.get('body') ?? '' };
    })();

    expect(asunto).toContain(UNKNOWN);
    expect(cuerpo).toContain(UNKNOWN);
  });

  it('el dato que viaja es el MISMO que responde /api/version', () => {
    // No una copia parecida: la misma constante. Si mañana SPEC-038 añade el semver,
    // el prefijo lo hereda sin tocar nada aquí.
    const url = new URL(construirMailtoDeFeedback(deploymentIdentity, TITULAR.contacto));
    expect(url.searchParams.get('subject')).toContain(deploymentIdentity.commit);
  });
});

describe('CA-12: el enlace se llama de una sola manera', () => {
  it('tiene una etiqueta y dice para qué es', () => {
    expect(ETIQUETA_FEEDBACK.length).toBeGreaterThan(4);
  });
});
