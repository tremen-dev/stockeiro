---
id: SPEC-064
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-064 El bloque de contexto se pinta sobre el vacio

## Resumen
- Fase: **en-revisión** — implementada el 2026-09-13, pendiente del veredicto del verificador
- Rama: `fix/SPEC-064-el-panel-sin-fondo`
- Versión: **0.7.1** (patch: arreglo visual, sin capacidad nueva; ADR-033)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/app/globals.css` (`.contexto-bloque`: `background: var(--bg-elev)` + `border: 1px solid var(--line)`) | `tests/e2e/geometria.ts` (**M6**, `medirSuperficieDeTexto`) · `tests/e2e/spec064-superficie.spec.ts` › «ni un texto de la capa se pinta sobre el vacío» y «a los ocho anchos» | | 🚧 |
| CA-2 | — (es la prueba de eficacia de la guardia, ADR-026 §7) | `spec064-superficie.spec.ts` › «quitarle el fondo la pone roja, y devolverlo la deja verde», con `DEFECTO_SIN_SUPERFICIE` | | 🚧 |
| CA-3 | La misma superficie | M6 calcula el contraste sobre el fondo **compuesto**, con la misma fórmula WCAG de SPEC-046 CA-6(f) | | 🚧 |
| CA-4 | `globals.css` (nada del anclaje ni del acotado se toca) | `tests/e2e/vigiladas-capa-edicion.spec.ts` (SPEC-046 entera) · `tests/e2e/spec063-contexto.spec.ts` › «la lista SIGUE leyéndose detrás» · `tarjetas-geometria.spec.ts` (M5) | | 🚧 |
| CA-5 | — | Batería completa | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual

| Qué | Captura |
|---|---|
| El panel arreglado, parte alta | `_qa/SPEC-064/panel-arreglado-1280.png` |
| El panel arreglado, parte baja (contexto y enlaces) | `_qa/SPEC-064/panel-arreglado-abajo-1280.png` |
| A 390 px | `_qa/SPEC-064/panel-arreglado-390.png` |

## Salvedades / follow-ups

- **F-SPEC-064-1 — «Mucha información para un modal tan pequeño».** Observación del humano
  el 2026-09-13, sobre el arreglo ya puesto: la capa contiene ahora **dos formularios de
  zonas, la nota con su contador, la lista de enlaces y dos campos más**, y aunque el bloque
  vaya plegado, desplegado es denso. **No entra aquí**: esto es EPIC-FIX y arregla lo que
  está roto —el fondo—, y la densidad es una **mejora de presentación** sobre algo que
  funciona. **Destino: EPIC-MEJORA**, con tres candidatos concretos ya identificados, por
  orden de lo que quita más ruido con menos riesgo:
  1. **El párrafo de ayuda del bloque** («Es tuyo y privado…») repite lo que `/ayuda` ya
     dice desde SPEC-063 CA-17: cabe moverlo al `title` del resumen o retirarlo.
  2. **El contador de caracteres** puede aparecer sólo cuando queda poco, en vez de estar
     siempre («Te quedan 882 de 1000» no informa de nada a los 882).
  3. **Dirección y etiqueta** pueden ir en **una fila** por encima del canto de 720 px,
     donde sobra ancho; apiladas por debajo (ADR-034 §10).
  ⚠️ Cualquiera de las tres cambia la altura de la capa, así que la guardia que protege
  ADR-030 §1 —la lista se sigue viendo detrás— es la que manda: con margen de unos 20 px
  hoy, ese es el presupuesto real de la mejora.

## Cómo retomar (handoff)

1. **La causa raíz, en una línea**: `dialog.editar-vigilada` va **sin fondo a propósito**
   (SPEC-046) y la superficie la pone la tarjeta que contiene. Todo bloque que viva en la
   capa y **fuera** de `.auth-form` tiene que traer la suya. Ahora hay una guardia que lo
   exige, así que el próximo se entera en su PR y no en producción.
2. **La medida nueva es M6** (`medirSuperficieDeTexto`, en el módulo compartido). Recorre
   **lo que la capa contenga** y, por cada elemento con texto propio, sube por sus ancestros
   componiendo fondos hasta encontrar uno opaco. Si sale de la capa sin encontrarlo, es
   violación. Se escribió así —y no «que `.contexto-bloque` tenga `background`»— para que
   siga valiendo si mañana la superficie la pone otro elemento.
3. **Por qué las otras cinco medidas no lo vieron**: M1/M2 miden desborde, M3 integridad de
   palabra, M5 área táctil y la de SPEC-046 CA-6(f) el contraste del texto **de la tabla**
   con el velo puesto — o sea, lo que se ve *por detrás* de la capa. Ninguna miraba **dentro**.
   Está escrito en la cabecera de M6 para que no haya que volver a deducirlo.
4. **Segundo defecto de la misma familia, arreglado aquí**: los enlaces salían en el **azul
   por defecto del navegador**. Un bloque nuevo no hereda lo que el producto ya tiene si
   nadie se lo da; ahora usan `var(--accent)` y hay un caso que lo comprueba resolviendo el
   token **en la propia página**, sin teclear ningún color en el test.
