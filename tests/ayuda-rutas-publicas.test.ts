import { describe, it, expect } from 'vitest';
import { isPublicPath, PUBLIC_PREFIXES } from '@/lib/auth/guard';

/**
 * SPEC-039 CA-1 — `/ayuda` se lee SIN sesión, y solo `/ayuda`.
 *
 * Es la tercera excepción declarada a RN-03 (tras `/legal` en SPEC-035 CA-2 y
 * `/reset-password` en SPEC-023 CA-15) y por la misma clase de razón: quien llega
 * de un hilo de un foro tiene que poder leer **qué hace esto y con qué cadencia**
 * antes de teclear su correo. Una ayuda que exige cuenta para explicar si merece la
 * pena tener cuenta no ayuda a nadie.
 *
 * Se declara en `PUBLIC_PREFIXES` y en ningún otro sitio: el `matcher` de
 * `src/proxy.ts` no cambia (sacarla de ahí la sacaría del middleware entero, que es
 * otra cosa y peor).
 *
 * El emparejamiento es por SEGMENTO COMPLETO, así que una ruta que solo se parezca
 * —`/ayudaX`, `/ayuda-interna`— no entra. Se prueba, no se hereda.
 */

const AYUDA = '/ayuda';

describe('SPEC-039 CA-1: la ayuda es pública', () => {
  it('se lee sin sesión', () => {
    expect(isPublicPath(AYUDA)).toBe(true);
  });

  it('la excepción se declara en PUBLIC_PREFIXES, único sitio donde vive', () => {
    expect(PUBLIC_PREFIXES).toContain(AYUDA);
  });

  it('una ruta que solo SE PARECE no es pública', () => {
    for (const parecida of ['/ayudaX', '/ayuda-interna', '/ayudas', '/xayuda']) {
      expect(isPublicPath(parecida), `${parecida} no puede ser pública`).toBe(false);
    }
  });

  it('las rutas de datos siguen exigiendo sesión', () => {
    for (const ruta of ['/dashboard', '/vigiladas', '/avisos', '/cartera', '/cuenta', '/admin']) {
      expect(isPublicPath(ruta), `${ruta} exige sesión`).toBe(false);
    }
  });
});
