/**
 * SPEC-062 CA-8 / CA-17 — **la escala de la barra de acercamiento**, en puntos
 * porcentuales: la barra está llena a distancia 0 y vacía a partir de aquí.
 *
 * ## Qué es, y qué NO es
 *
 * Es **escala de lectura**, no umbral del dominio. No significa «a partir de aquí,
 * compra», no dispara nada y no aparece en `reglas.md`: RN-18 define la **distancia**, que
 * es la medida; esto es sólo el tramo en el que esa medida se dibuja. Por eso vive en el
 * código y no en los documentos de verdad (D-4 sigue entero: la app no recomienda).
 *
 * ## Por qué vive aquí y no junto a la función que lo usa
 *
 * Porque lo usan **dos sitios que no pueden verse entre sí**: la barra de `/vigiladas`
 * (`src/lib/watchlist/acercamiento.ts`) y la página pública de ayuda, que **cuenta** el
 * tramo en prosa. Y `/ayuda` tiene prohibido por guardia alcanzar `src/lib/watchlist/`
 * (SPEC-039 CA-14: tiene que responder con la base caída y sin saber nada de vigiladas).
 *
 * La alternativa —escribir el número en la ayuda a mano— es exactamente lo que **ADR-040**
 * prohíbe y lo que hizo que la ayuda prometiera mercados que el proveedor no servía
 * (EPIC-FIX). Un solo hogar, dos lectores, y cambiar el número **no puede** dejar la ayuda
 * diciendo otra cosa.
 */
export const ESCALA_ACERCAMIENTO_PCT = 10;
