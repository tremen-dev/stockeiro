// TEMPORAL — SPEC-027 CA-3. Rompe A LA VEZ el typecheck y el lint para demostrar
// que `if: ${{ !cancelled() }}` hace que los dos gates aparezcan en rojo POR
// SEPARADO y que `Unit tests` se ejecuta igualmente. Este fichero se revierte.

// Rompe el lint: variable declarada y no usada (@typescript-eslint/no-unused-vars,
// que con --max-warnings=0 pasa de aviso a fallo).
const estaVariableNoSeUsa = 42;

// Rompe el typecheck: string no es asignable a number.
export const estoNoCompila: number = 'no soy un number';
