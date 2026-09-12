import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { ZONAS } from '@/lib/help/content';
import {
  LIMITE_ENLACES_POR_SIMBOLO,
  LIMITE_NOTA_CARACTERES,
} from '@/lib/config/limites-contexto';
import { textoDeContexto } from '@/lib/contexto/senal';
import { afirmacionesProhibidasEn } from './ayuda-afirmaciones-prohibidas';

/**
 * SPEC-063 **CA-16**, **CA-17** y la mitad de **CA-10** que no necesita navegador.
 */

const DOMINIO = () => readFileSync('docs/fundacion/dominio.md', 'utf8');
const seccionZonas = () => [ZONAS.titulo, ...ZONAS.parrafos].join('\n');

describe('SPEC-063 CA-16: los términos existen antes que la pantalla', () => {
  it('«Nota de un símbolo» y «Enlace de un símbolo» están en el glosario', () => {
    expect(DOMINIO()).toMatch(/\|\s*Nota de un símbolo\s*\|/);
    expect(DOMINIO()).toMatch(/\|\s*Enlace de un símbolo\s*\|/);
  });

  it('y los dos dicen lo que la app NO hace con ellos, que es la mitad que importa', () => {
    const glosario = DOMINIO().replace(/\s+/g, ' ');
    const nota = glosario.split('| Nota de un símbolo |')[1].split('\n')[0];
    expect(nota).toMatch(/privada/i);
    expect(nota).toMatch(/no la interpreta|no entra en ning/i);
    expect(nota).toMatch(/sobrevive a quitar de vigiladas/i);

    const enlace = glosario.split('| Enlace de un símbolo |')[1].split('\n')[0];
    expect(enlace).toMatch(/no lo visita/i);
    expect(enlace).toMatch(/http/);
  });

  it('los dos topes del gate están escritos en el glosario y en el código, y coinciden', () => {
    const glosario = DOMINIO().replace(/\s+/g, ' ');
    expect(glosario).toContain(`${LIMITE_NOTA_CARACTERES} caracteres`);
    expect(glosario).toMatch(new RegExp(`${LIMITE_ENLACES_POR_SIMBOLO} por símbolo`));
  });
});

describe('SPEC-063 CA-17: la ayuda cuenta qué es esto y qué no es', () => {
  it('dice que es privado, que la app no lo usa y que no abre los enlaces', () => {
    const texto = seccionZonas();
    expect(texto).toMatch(/tuyo y privado/i);
    expect(texto).toMatch(/no lo usa para nada/i);
    expect(texto).toMatch(/no abre tus enlaces/i);
    expect(texto).toMatch(/se van con ella/i); // el borrado de cuenta, dicho al usuario
  });

  it('los dos topes se DERIVAN del código: cambiarlos no puede dejar la ayuda mintiendo', () => {
    expect(seccionZonas()).toContain(`${LIMITE_NOTA_CARACTERES} caracteres`);
    expect(seccionZonas()).toContain(`${LIMITE_ENLACES_POR_SIMBOLO} enlaces`);

    const contenido = readFileSync('src/lib/help/content.ts', 'utf8');
    expect(contenido).toMatch(/LIMITE_NOTA_CARACTERES/);
    expect(contenido).toMatch(/LIMITE_ENLACES_POR_SIMBOLO/);
    expect(contenido).toMatch(/from '@\/lib\/config\/limites-contexto'/);
  });

  it('y sigue sin decir nada que D-1, D-2 o D-4 prohíban', () => {
    expect(afirmacionesProhibidasEn(seccionZonas())).toEqual([]);
  });
});

describe('SPEC-063 CA-10: la señal se dice con una frase, no con un glifo', () => {
  it('nombra lo que hay, en singular y en plural', () => {
    expect(textoDeContexto({ note: 'x', enlaces: [] })).toBe('Tiene nota tuya');
    expect(textoDeContexto({ note: null, enlaces: [{ id: '1', url: 'u', label: null }] })).toBe(
      'Tiene 1 enlace tuyo',
    );
    expect(
      textoDeContexto({
        note: null,
        enlaces: [
          { id: '1', url: 'u', label: null },
          { id: '2', url: 'u', label: null },
        ],
      }),
    ).toBe('Tiene 2 enlaces tuyos');
    expect(
      textoDeContexto({ note: 'x', enlaces: [{ id: '1', url: 'u', label: null }] }),
    ).toBe('Tiene nota tuya y 1 enlace');
  });

  it('la frase no depende de ver un color ni un icono: es texto', () => {
    const frase = textoDeContexto({ note: 'x', enlaces: [] });
    expect(frase).not.toMatch(/[✎🔗📝]/u);
  });
});

describe('SPEC-063 CA-12: el texto del usuario nunca se interpreta como marcado', () => {
  it('ningún fichero de esta spec usa `dangerouslySetInnerHTML`', () => {
    for (const fichero of [
      'src/app/vigiladas/contexto-form.tsx',
      'src/app/vigiladas/columnas-vigiladas.tsx',
      'src/app/vigiladas/watched-table.tsx',
    ]) {
      // Se mira el CÓDIGO, no la explicación: un comentario que dice «aquí no hay
      // `dangerouslySetInnerHTML`» no puede contar como infracción.
      const codigo = readFileSync(fichero, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, '');
      expect(codigo, fichero).not.toMatch(/dangerouslySetInnerHTML/);
    }
  });

  it('y el enlace sale con `rel` que no filtra la ventana de origen', () => {
    const form = readFileSync('src/app/vigiladas/contexto-form.tsx', 'utf8');
    expect(form).toMatch(/rel="noopener noreferrer"/);
  });
});
