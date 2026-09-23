import { describe, it, expect } from 'vitest';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { makeTestDb } from '@/db/test-db';
import { MARCA } from '@/lib/legal/content';
import {
  correoDeActivacion,
  correoDeEntradaEnZona,
  correoDeRecuperacion,
  correoDeResumen,
  type CorreoCompuesto,
} from '@/lib/notifications/templates';
import { ACTIVATION_WINDOW_HOURS } from '@/lib/registration/activation-rules';
import { signUp } from '@/lib/registration/signup';
import { FakeNotificationSender, PWD } from './spec066-arnes';

/**
 * SPEC-066 CA-21 — el correo de activación tiene el diseño de SPEC-056 y el enlace que
 * manda.
 *
 * Las guardias de plantilla de SPEC-056 (`tests/spec056-plantillas.test.ts`) recorren su
 * propia lista de tres correos, y ese fichero es de otra spec: no se toca. Aquí se aplican
 * las MISMAS propiedades al cuarto, y donde SPEC-056 deriva un valor de su fuente
 * (paleta, marca, marco) éste lo deriva de los otros tres correos, que aquellas guardias
 * ya comprueban contra la fuente: el cuarto no puede usar un color, un marco o una
 * construcción que los tres vigilados no usen.
 */

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const URL_DE_MUESTRA = 'https://stockeiro.tremen.dev/register/confirmar/Qk3pZ-8sLmN_2vXcTa9yRbW4uEoJdHfG1iKq7Yz0xyA';

const activacion = correoDeActivacion({ url: URL_DE_MUESTRA, horasDePlazo: ACTIVATION_WINDOW_HOURS });

const OTROS: CorreoCompuesto[] = [
  correoDeEntradaEnZona({ ticker: 'ITX', precio: '45.20', zona: 'compra', asOf: '2026-08-24' }),
  correoDeResumen({ posiciones: [{ ticker: 'SAN', zona: 'venta' }], asOf: '2026-08-24' }),
  correoDeRecuperacion({ url: 'https://stockeiro.tremen.dev/reset-password/abc', minutosDeCaducidad: 30 }),
];

// La evidencia visual, como hace SPEC-056 con los suyos: el HTML en `_qa/SPEC-066/`.
const qaDir = join(rootDir, '_qa', 'SPEC-066');
mkdirSync(qaDir, { recursive: true });
writeFileSync(join(qaDir, 'correo-activacion.html'), `${activacion.html}\n`, 'utf8');

const bloqueDeCabecera = (html: string) => {
  const desde = html.indexOf('<tr><td style="padding:26px');
  expect(desde).toBeGreaterThanOrEqual(0);
  return html.slice(desde, html.indexOf('</td></tr>', desde) + '</td></tr>'.length);
};
const bloqueDePie = (html: string) => {
  const desde = html.indexOf('<tr><td style="padding:20px');
  expect(desde).toBeGreaterThanOrEqual(0);
  return html.slice(desde);
};
const coloresDe = (html: string): string[] => [
  ...(html.match(/#[0-9A-Fa-f]{3,8}\b/g) ?? []),
  ...(html.match(/rgba?\([^)]*\)/g) ?? []),
];
const normalizar = (c: string) => c.trim().replace(/\s+/g, '').toUpperCase();

describe('SPEC-066 CA-21: los dos cuerpos, y el enlace que manda', () => {
  it('lleva los dos cuerpos (ADR-036) y el texto no tiene ni una etiqueta', () => {
    expect(activacion.text.trim().length).toBeGreaterThan(0);
    expect(activacion.html.trim().length).toBeGreaterThan(0);
    expect(activacion.text).not.toMatch(/<[A-Za-z/]/);
    expect(activacion.text).not.toContain('&amp;');
  });

  it('en el texto, el enlace es la PRIMERA URL absoluta, desnudo y en su línea', () => {
    expect(activacion.text.match(/https?:\/\/\S+/)![0]).toBe(URL_DE_MUESTRA);
    expect(activacion.text.split('\n')).toContain(URL_DE_MUESTRA);
    // Ninguna URL de marca por delante (la línea de marca va al final, SPEC-056 D-6).
    expect(activacion.text.indexOf(URL_DE_MUESTRA)).toBeLessThan(
      activacion.text.includes(MARCA.url) ? activacion.text.indexOf(MARCA.url) : Number.MAX_SAFE_INTEGER,
    );
    expect(activacion.text.indexOf(URL_DE_MUESTRA)).toBeLessThan(activacion.text.indexOf(MARCA.linea));
  });

  it('en el HTML aparece como botón Y como texto copiable (dos veces)', () => {
    expect(activacion.html.split(URL_DE_MUESTRA).length - 1).toBe(2);
    expect(activacion.html).toContain(`href="${URL_DE_MUESTRA}"`);
    expect(activacion.html.replace(`href="${URL_DE_MUESTRA}"`, '')).toContain(`>${URL_DE_MUESTRA}<`);
    // Área táctil del botón, la de recuperación (ADR-034).
    expect(activacion.html).toContain('padding:14px 26px');
    expect(activacion.html).toContain('line-height:20px');
  });

  it('dice el plazo LEÍDO de su constante, en los dos cuerpos', () => {
    for (const cuerpo of [activacion.text, activacion.html]) {
      expect(cuerpo).toContain(`${ACTIVATION_WINDOW_HOURS} horas`);
    }
    // Y lo sigue: con otro número, otra frase (no hay un 24 tecleado).
    const otro = correoDeActivacion({ url: URL_DE_MUESTRA, horasDePlazo: 7 });
    expect(otro.text).toContain('7 horas');
    expect(otro.text).not.toContain(`${ACTIVATION_WINDOW_HOURS} horas`);
  });

  it('dice qué hacer si no lo has pedido tú: nada, la cuenta se borra sola', () => {
    expect(activacion.text).toMatch(/si no has sido tú/i);
    expect(activacion.text).toMatch(/no hace falta que hagas nada/i);
    expect(activacion.text).toMatch(/se borra sola/i);
  });

  it('el origen del enlace es APP_BASE_URL, nunca la cabecera Host (ADR-015 pto. 8)', async () => {
    const { db } = await makeTestDb();
    const sender = new FakeNotificationSender();
    const r = await signUp(db, sender, 'origen@example.com', PWD, {
      baseUrl: 'https://origen-configurado.example.org',
    });
    if (r.kind === 'neutral') await r.delivery;
    const enlace = sender.sent[0].body.match(/https?:\/\/\S+/)![0];
    expect(new URL(enlace).origin).toBe('https://origen-configurado.example.org');
    expect(sender.sent[0].html).toContain('https://origen-configurado.example.org/register/confirmar/');
  });
});

describe('SPEC-066 CA-21: las guardias de plantilla de SPEC-056, sin aflojar, sobre el cuarto correo', () => {
  it('comparte LITERALMENTE el marco de los otros tres (cabecera y pie, byte a byte)', () => {
    for (const otro of OTROS) {
      expect(bloqueDeCabecera(activacion.html)).toBe(bloqueDeCabecera(otro.html));
      expect(bloqueDePie(activacion.html)).toBe(bloqueDePie(otro.html));
    }
    expect(bloqueDeCabecera(activacion.html)).toContain(`href="${MARCA.url}"`);
    expect(bloqueDePie(activacion.html)).toContain(MARCA.linea);
    expect(activacion.text.endsWith(MARCA.linea)).toBe(true);
  });

  it('se declara como documento y su preheader es la primera línea del texto', () => {
    expect(activacion.html.startsWith('<!DOCTYPE html>')).toBe(true);
    expect(activacion.html).toContain('<html lang="es">');
    const m = /<div style="display:none;[^"]*">([^<]*)<\/div>/.exec(activacion.html);
    expect(m![1]).toBe(activacion.text.split('\n')[0]);
  });

  it('maquetado de correo: toda tabla con role="presentation", estilo en línea, 600 px', () => {
    const tablas = activacion.html.match(/<table[^>]*>/g) ?? [];
    expect(tablas.length).toBeGreaterThan(1);
    for (const t of tablas) expect(t).toContain('role="presentation"');
    expect(activacion.html).toContain('max-width:600px');
    expect(activacion.html).not.toContain('<style');
  });

  it('ninguna construcción que el cliente tire o ejecute, ni un recurso de fuera', () => {
    for (const patron of [
      /<script/i, /<iframe/i, /<form/i, /<object/i, /<embed/i, /\son[a-z]+\s*=/i,
      /position\s*:/i, /float\s*:/i, /display\s*:\s*flex/i, /display\s*:\s*grid/i,
      /@import/i, /<link/i, /<img/i, /\ssrc\s*=/i, /url\s*\(/i, /gradient/i, /box-shadow|text-shadow/i,
    ]) {
      expect(patron.test(activacion.html), `aparece ${patron}`).toBe(false);
    }
    const sinHref = activacion.html.replace(/href="[^"]*"/g, 'href=""');
    for (const trozo of sinHref.match(/<[^>]*>/g) ?? []) expect(trozo).not.toMatch(/https?:\/\//);
  });

  it('todo color que usa lo usan ya los correos que SPEC-056 comprueba contra la paleta', () => {
    const autorizados = new Set(OTROS.flatMap((c) => coloresDe(c.html)).map(normalizar));
    const usados = [...new Set(coloresDe(activacion.html).map(normalizar))];
    expect(usados.length).toBeGreaterThan(3);
    expect(usados.filter((c) => !autorizados.has(c))).toEqual([]);
  });

  it('el asunto no lleva la marca', () => {
    expect(activacion.subject).not.toContain(MARCA.nombre);
    expect(activacion.subject.length).toBeGreaterThan(0);
  });
});

describe('SPEC-066 CA-21: la evidencia visual queda en `_qa/SPEC-066/`', () => {
  it('correo-activacion.html es exactamente lo que produce la plantilla', () => {
    expect(readFileSync(join(qaDir, 'correo-activacion.html'), 'utf8').trimEnd()).toBe(activacion.html);
  });
});
