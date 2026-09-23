import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ESQUEMAS_PERMITIDOS } from '@/lib/contexto/enlace';
import { dominioDeEnlace, enlacesAbribles, esAbrible } from '@/lib/contexto/abribles';
import {
  TEXTO_SENAL_NOTA,
  destinoDeEnlace,
  nombreDeSenalDeEnlaces,
  textoDeSenalDeNota,
  tituloDeCapaDeEnlaces,
} from '@/lib/contexto/senal';

/**
 * SPEC-067 — **lo que la fila ofrece y cómo lo nombra**, sin navegador.
 *
 * La pantalla (tabla y tarjeta, teclado, capa, geometría) está en
 * `tests/e2e/spec067-enlaces.spec.ts`. Aquí vive lo puro: qué enlaces son abribles
 * (CA-10), qué frase dice cada señal (CA-2, CA-4, CA-5) y que los módulos nuevos no
 * visitan nada (CA-11).
 */

const enlace = (url: string, label: string | null = null) => ({ url, label });

describe('SPEC-067 CA-2: la señal de nota dice lo que hay, desde el módulo puro', () => {
  it('con nota, «Tiene nota tuya»; sin nota, no hay frase (y por tanto no hay señal)', () => {
    expect(TEXTO_SENAL_NOTA).toBe('Tiene nota tuya');
    expect(textoDeSenalDeNota({ note: 'x', enlaces: [] })).toBe('Tiene nota tuya');
    expect(textoDeSenalDeNota({ note: null, enlaces: [{ id: '1', url: 'https://a.example/', label: null }] })).toBeNull();
  });

  it('la frase de la nota ya no habla de enlaces: cada señal dice lo suyo', () => {
    const frase = textoDeSenalDeNota({
      note: 'x',
      enlaces: [{ id: '1', url: 'https://a.example/', label: null }],
    });
    expect(frase).toBe('Tiene nota tuya');
    expect(frase).not.toMatch(/enlace/i);
  });

  it('la celda no escribe la frase: la importa de `senal.ts`', () => {
    const celda = readFileSync('src/app/vigiladas/columnas-vigiladas.tsx', 'utf8');
    expect(celda).not.toMatch(/['"`]Tiene nota tuya['"`]/);
    expect(celda).toMatch(/textoDeSenalDeNota/);
  });
});

describe('SPEC-067 CA-4: la señal de un solo enlace dice adónde lleva', () => {
  it('con etiqueta: la etiqueta Y el dominio, y que se abre en pestaña nueva', () => {
    const frase = destinoDeEnlace(enlace('https://www.seekingalpha.com/x', 'Tesis Q3'));
    expect(frase).toContain('Tesis Q3');
    expect(frase).toContain('seekingalpha.com');
    expect(frase).not.toContain('www.seekingalpha.com');
    expect(frase).toMatch(/pestaña nueva/);
    expect(frase).toMatch(/\benlace\b/); // dice que es UN enlace (CA-14: cuántos)
  });

  it('sin etiqueta: el dominio UNA sola vez, y nunca la URL entera', () => {
    const url = 'https://www.seekingalpha.com/article/123-tesis?utm=foro#comentarios';
    const frase = destinoDeEnlace(enlace(url));
    expect(frase.split('seekingalpha.com').length - 1).toBe(1);
    expect(frase).not.toContain(url);
    expect(frase).not.toContain('/article/');
    expect(frase).not.toContain('https://');
    expect(frase).toMatch(/pestaña nueva/);
  });

  it('con una etiqueta que ES el dominio, tampoco lo repite', () => {
    const frase = destinoDeEnlace(enlace('https://seekingalpha.com/x', 'seekingalpha.com'));
    expect(frase.split('seekingalpha.com').length - 1).toBe(1);
  });
});

describe('SPEC-067 CA-5: la señal de varios enlaces dice cuántos y de qué activo', () => {
  it('nombra el número y el activo, en plural', () => {
    const nombre = nombreDeSenalDeEnlaces(3, 'QFIN · NASDAQ');
    expect(nombre).toContain('3 enlaces');
    expect(nombre).toContain('QFIN · NASDAQ');
  });

  it('la capa se nombra por el activo y su mercado', () => {
    expect(tituloDeCapaDeEnlaces('QFIN · NASDAQ')).toBe('Enlaces de QFIN · NASDAQ');
  });

  it('ninguna frase de señal depende de ver un glifo', () => {
    for (const f of [
      TEXTO_SENAL_NOTA,
      destinoDeEnlace(enlace('https://a.example/')),
      nombreDeSenalDeEnlaces(2, 'Z · BME'),
    ]) {
      expect(f).not.toMatch(/[✎🔗📝]/u);
    }
  });
});

describe('SPEC-067 CA-10: sólo http/https se ofrecen como enlace, también al pintar', () => {
  const NO_SE_OFRECEN = [
    'javascript:alert(1)',
    'JavaScript:alert(1)',
    '  javascript:alert(1)',
    '\tjavascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'vbscript:msgbox(1)',
    'file:///etc/passwd',
    'no es una url',
    '',
  ];
  const SI_SE_OFRECEN = [
    'https://a.example/',
    'https://a.example:8443/x',
    'https://a.example/p?q=1#f',
    'https://a.example/ruta/ñandú',
    'http://a.example/',
  ];

  it.each(NO_SE_OFRECEN)('no se ofrece: %j', (url) => {
    expect(esAbrible(url)).toBe(false);
  });

  it.each(SI_SE_OFRECEN)('sí se ofrece: %j', (url) => {
    expect(esAbrible(url)).toBe(true);
  });

  it('filtra conservando el ORDEN guardado, y da un href que es el del parser', () => {
    const lista = [
      enlace('https://uno.example/'),
      enlace('javascript:alert(1)'),
      enlace('https://dos.example/x', 'Dos'),
      enlace('data:text/html,hola'),
      enlace('http://tres.example/'),
    ];
    const abribles = enlacesAbribles(lista);
    expect(abribles.map((e) => e.href)).toEqual([
      'https://uno.example/',
      'https://dos.example/x',
      'http://tres.example/',
    ]);
    expect(abribles[1].label).toBe('Dos');
    // Nada abrible → lista vacía → no hay señal de enlaces.
    expect(enlacesAbribles([enlace('javascript:alert(1)'), enlace('vbscript:x')])).toEqual([]);
  });

  it('reutiliza la lista cerrada de `enlace.ts`, no escribe otra', () => {
    const fuente = readFileSync('src/lib/contexto/abribles.ts', 'utf8');
    expect(fuente).toMatch(/ESQUEMAS_PERMITIDOS/);
    expect(fuente).toMatch(/from '\.\/enlace'/);
    expect(fuente).not.toMatch(/['"]https?:['"]/);
    expect(ESQUEMAS_PERMITIDOS).toEqual(['http:', 'https:']);
  });

  it('el dominio es el del parser, sin `www.`', () => {
    expect(dominioDeEnlace('https://www.seekingalpha.com/x')).toBe('seekingalpha.com');
    expect(dominioDeEnlace('https://a.example:8443/x')).toBe('a.example');
  });
});

describe('SPEC-067 CA-11: los módulos nuevos no visitan nada', () => {
  const NUEVOS = [
    'src/lib/contexto/abribles.ts',
    'src/lib/contexto/senal.ts',
    'src/app/_components/enlaces-senal.tsx',
  ];

  it.each(NUEVOS)('%s no importa ni llama a `fetch`', (fichero) => {
    const codigo = readFileSync(fichero, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    expect(codigo).not.toMatch(/\bfetch\b/);
    expect(codigo).not.toMatch(/XMLHttpRequest|sendBeacon|new Image\(|rel=["']prefetch|rel=["']preconnect|favicon/i);
  });

  it('y el enlace que se pinta sale con `rel` que no filtra la ventana de origen', () => {
    const componente = readFileSync('src/app/_components/enlaces-senal.tsx', 'utf8');
    const rels = componente.match(/rel="[^"]*"/g) ?? [];
    expect(rels.length).toBeGreaterThanOrEqual(2); // el directo y los de la capa
    for (const r of rels) {
      expect(r).toContain('noopener');
      expect(r).toContain('noreferrer');
    }
    expect(componente).not.toMatch(/dangerouslySetInnerHTML/);
  });
});
