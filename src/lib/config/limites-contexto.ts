/**
 * SPEC-063 CA-14 — **los dos topes del contexto de un símbolo**, decididos en el gate del
 * 2026-09-13 por el humano.
 *
 * Viven aquí, juntos y fuera de `src/lib/contexto/`, por el mismo motivo que la escala de
 * SPEC-062 (`escala-acercamiento.ts`): los lee **la capa que valida** y los cuenta **la
 * página pública de ayuda**, que tiene prohibido por guardia alcanzar el código que habla
 * con la base (SPEC-039 CA-14). Un solo hogar, dos lectores, y subir o bajar un tope es
 * cambiar **un número** — no buscar por el árbol ni migrar nada.
 *
 * No son reglas de dominio y no están en `reglas.md`: son decisiones de producto sobre
 * cuánto cabe, no sobre qué significa lo que cabe.
 */

/** Cuántos caracteres cabe que tenga la nota de un símbolo. */
export const LIMITE_NOTA_CARACTERES = 1000;

/** Cuántos enlaces cabe que tenga un símbolo, por usuario. */
export const LIMITE_ENLACES_POR_SIMBOLO = 5;

/**
 * Cuánto cabe que midan la etiqueta y la dirección de un enlace.
 *
 * No son del gate —nadie pidió un número— sino **defensa de la pantalla**: una etiqueta de
 * mil caracteres rompe la fila y una URL sin techo es una puerta abierta a llenar la base
 * por accidente. 2 048 es el techo práctico que respetan los navegadores.
 */
export const LIMITE_ETIQUETA_CARACTERES = 80;
export const LIMITE_URL_CARACTERES = 2048;
