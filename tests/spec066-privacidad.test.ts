import { describe, it, expect } from 'vitest';
import {
  CATEGORIAS_DE_DATO,
  CONSERVACION,
  COOKIES_Y_ANALITICA,
  ENCARGADOS,
} from '@/lib/legal/content';
import { ACTIVATION_WINDOW_HOURS } from '@/lib/registration/activation-rules';

/**
 * SPEC-066 CA-22 — `/legal/privacidad` dice la verdad sobre lo nuevo.
 *
 * La tabla nueva la exige ya, sin tocarla, la guardia de SPEC-035 CA-5
 * (`tests/legal-datos-y-esquema.test.ts`), que compara categorías con el esquema. Aquí va
 * lo que aquella no puede ver: que el texto diga la fecha de verificación, el plazo de
 * borrado —el MISMO número que aplica el código (`src/lib/legal/content.ts` es puro y no
 * puede importarlo: se copia y se comprueba, como el de recuperación)— y la comprobación
 * anti-bots, con lo que carga y lo que ve.
 *
 * El texto legal es del titular: lo aprueba el humano en la PR (R-3 de SPEC-065).
 */

const todo = (xs: string[]) => xs.join(' ');

describe('SPEC-066 CA-22: la privacidad describe lo nuevo', () => {
  it('la tabla de enlaces de activación tiene su categoría', () => {
    const cat = CATEGORIAS_DE_DATO.find((c) => c.tabla === 'email_verification_tokens');
    expect(cat).toBeDefined();
    expect(cat!.descripcion).toMatch(/huella/i);
    expect(cat!.descripcion).toMatch(/no se almacena/i);
  });

  it('la categoría de cuenta nombra la fecha de verificación', () => {
    const cuenta = CATEGORIAS_DE_DATO.find((c) => c.tabla === 'users')!;
    expect(cuenta.descripcion).toMatch(/verific/i);
  });

  it('dice que una cuenta sin activar se borra, con el plazo que aplica el código', () => {
    const texto = todo(CONSERVACION);
    const m = texto.match(/(\d+)\s*horas/);
    expect(m, 'CONSERVACION tiene que decir el plazo en horas').not.toBeNull();
    expect(Number(m![1])).toBe(ACTIVATION_WINDOW_HOURS);
    expect(texto).toMatch(/no se activa/i);
    expect(texto).toMatch(/se borra/i);
  });

  it('dice que el alta pasa una comprobación anti-bots de Vercel: en qué consiste y qué ve', () => {
    const vercel = ENCARGADOS.find((e) => e.id === 'vercel')!;
    expect(`${vercel.para} ${vercel.ve}`).toMatch(/BotID/);
    expect(vercel.para).toMatch(/anti-bots/i);
    expect(vercel.ve).toMatch(/navegador/i);
  });

  it('la frase de cookies y scripts sigue siendo cierta: nombra el script y las cookies del alta', () => {
    const texto = todo(COOKIES_Y_ANALITICA);
    expect(texto).toMatch(/BotID/);
    expect(texto).toMatch(/script/i);
    expect(texto).toMatch(/cookies?/i);
    expect(texto).toMatch(/alta/i);
  });

  it('el correo de activación consta entre lo que envía el proveedor de correo', () => {
    const resend = ENCARGADOS.find((e) => e.id === 'resend')!;
    expect(resend.para).toMatch(/activar/i);
  });
});
