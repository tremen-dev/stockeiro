import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  ESQUEMAS_PERMITIDOS,
  MOTIVO_ENLACE_TEXTO,
  normalizarEnlace,
  rotuloDeEnlace,
} from '@/lib/contexto/enlace';
import {
  LIMITE_ETIQUETA_CARACTERES,
  LIMITE_URL_CARACTERES,
} from '@/lib/config/limites-contexto';

/**
 * SPEC-063 **CA-11** y **CA-15** — **qué enlace se acepta, y cómo se presenta el que no
 * trae etiqueta**.
 *
 * ## Las dos direcciones, y por qué la segunda no es adorno
 *
 * Un filtro que **caza de menos** deja entrar un `href` que ejecuta al pulsarlo, dentro de
 * la sesión de su propio dueño. Un filtro que **caza de más** rechaza el enlace legítimo
 * del foro, y entonces alguien lo afloja — y el aflojado no distingue. Por eso los dos
 * bloques de abajo pesan lo mismo.
 */

const PROHIBIDOS: Array<[string, string]> = [
  ['javascript:alert(1)', 'el clásico: un href que EJECUTA al pulsarlo'],
  ['JavaScript:alert(1)', 'el mismo, con la caja cambiada'],
  ['jAvAsCrIpT:alert(1)', 'y con la caja alternada, que es como se cuela en un filtro textual'],
  ['   javascript:alert(1)', 'con espacios delante, que un filtro que mira el principio no ve'],
  ['\tjavascript:alert(1)', 'con un tabulador delante, por lo mismo'],
  ['data:text/html,<script>alert(1)</script>', 'un documento entero embebido en la dirección'],
  ['vbscript:msgbox(1)', 'la variante vieja, que sigue viva en algún navegador'],
  ['file:///etc/passwd', 'el sistema de ficheros de quien abra el enlace'],
  ['about:blank', 'no es una dirección web y no tiene por qué guardarse'],
];

const PERMITIDOS: Array<[string, string]> = [
  ['https://es.tradingview.com/symbols/BME-ITX/', 'el caso normal, que es el 99% de lo que se pegará'],
  ['http://foro.example.com/hilo/123', 'http a secas: sigue siendo web, y rechazarlo molestaría sin proteger'],
  ['https://example.com:8443/informe', 'con puerto'],
  ['https://example.com/buscar?q=itx&ord=fecha#resultados', 'con query y fragmento'],
  ['https://es.wikipedia.org/wiki/Inditex_(empresa)', 'con paréntesis en la ruta'],
  ['https://example.com/análisis/valoración', 'con acentos: no es raro y no es peligroso'],
];

describe('SPEC-063 CA-11: solo http y https — lo que DEBE rechazarse', () => {
  it.each(PROHIBIDOS)('rechaza %s — %s', (url) => {
    const r = normalizarEnlace(url);
    expect(r.ok).toBe(false);
  });

  it('el rechazo dice POR QUÉ, y el motivo tiene texto para el usuario', () => {
    const r = normalizarEnlace('javascript:alert(1)');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe('esquema_no_permitido');
    expect(MOTIVO_ENLACE_TEXTO[r.motivo]).toMatch(/http/i);
  });

  it('lo que no es una dirección se distingue de lo que sí lo es pero con esquema prohibido', () => {
    const suelto = normalizarEnlace('esto no es una url');
    expect(suelto).toMatchObject({ ok: false, motivo: 'no_es_una_direccion' });
  });

  it('una dirección vacía no es un fallo del sistema: es un campo sin rellenar', () => {
    expect(normalizarEnlace('')).toMatchObject({ ok: false, motivo: 'vacio' });
    expect(normalizarEnlace('    ')).toMatchObject({ ok: false, motivo: 'vacio' });
  });
});

describe('SPEC-063 CA-11: solo http y https — lo que NO debe rechazarse', () => {
  it.each(PERMITIDOS)('acepta %s — %s', (url) => {
    const r = normalizarEnlace(url);
    expect(r.ok, `un filtro que caza de más acaba aflojado: ${url}`).toBe(true);
  });

  it('la lista de esquemas es cerrada y son exactamente dos', () => {
    expect([...ESQUEMAS_PERMITIDOS]).toEqual(['http:', 'https:']);
  });

  it('lo aceptado se guarda en su forma canónica, no en la cruda', () => {
    const r = normalizarEnlace('  https://example.com/a?b=1  ');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.enlace.url).toBe('https://example.com/a?b=1');
  });
});

describe('SPEC-063 CA-14: los topes de la dirección y de la etiqueta', () => {
  it('una dirección por encima del tope se rechaza, y una justo en el tope entra', () => {
    const relleno = 'a'.repeat(LIMITE_URL_CARACTERES);
    expect(normalizarEnlace(`https://example.com/${relleno}`)).toMatchObject({
      ok: false,
      motivo: 'demasiado_largo',
    });
    const justa = 'https://example.com/' + 'a'.repeat(LIMITE_URL_CARACTERES - 'https://example.com/'.length);
    expect(justa.length).toBe(LIMITE_URL_CARACTERES);
    expect(normalizarEnlace(justa).ok).toBe(true);
  });

  it('una etiqueta demasiado larga se rechaza, y una del tamaño del tope entra', () => {
    const url = 'https://example.com';
    expect(normalizarEnlace(url, 'x'.repeat(LIMITE_ETIQUETA_CARACTERES + 1))).toMatchObject({
      ok: false,
      motivo: 'etiqueta_demasiado_larga',
    });
    expect(normalizarEnlace(url, 'x'.repeat(LIMITE_ETIQUETA_CARACTERES)).ok).toBe(true);
  });

  it('una etiqueta en blanco es NO tener etiqueta, no una etiqueta vacía', () => {
    const r = normalizarEnlace('https://example.com', '   ');
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.enlace.label).toBeNull();
  });
});

describe('SPEC-063 CA-15: sin etiqueta se enseña el dominio, no un nombre inventado', () => {
  it('con etiqueta, manda la etiqueta', () => {
    expect(rotuloDeEnlace({ url: 'https://es.tradingview.com/x', label: 'Mi gráfico' })).toBe(
      'Mi gráfico',
    );
  });

  it('sin etiqueta, el dominio — y sin el `www.`, que no dice nada', () => {
    expect(rotuloDeEnlace({ url: 'https://es.tradingview.com/symbols/BME-ITX/', label: null })).toBe(
      'es.tradingview.com',
    );
    expect(rotuloDeEnlace({ url: 'https://www.example.com/a', label: null })).toBe('example.com');
  });

  it('y no se inventa nada: ni «Enlace 1», ni el ticker, ni la URL entera', () => {
    const rotulo = rotuloDeEnlace({ url: 'https://example.com/un/camino/muy/largo', label: null });
    expect(rotulo).toBe('example.com');
    expect(rotulo).not.toMatch(/enlace/i);
    expect(rotulo).not.toContain('/un/camino');
  });
});

describe('SPEC-063 CA-13: la app no visita lo que el usuario pega', () => {
  // La mitad estructural: el módulo que valida no puede pedir la URL. La otra mitad —que
  // la pantalla tampoco lo haga— la mide el e2e interceptando la red.
  it('ni el validador ni el servicio llaman a la red', () => {
    for (const fichero of ['src/lib/contexto/enlace.ts', 'src/lib/contexto/service.ts']) {
      const codigo = readFileSync(fichero, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
      expect(codigo, `${fichero} no puede pedir la URL del usuario (SSRF, CE-4)`).not.toMatch(
        /\bfetch\s*\(|axios|node:https?|got\(/,
      );
    }
  });
});
