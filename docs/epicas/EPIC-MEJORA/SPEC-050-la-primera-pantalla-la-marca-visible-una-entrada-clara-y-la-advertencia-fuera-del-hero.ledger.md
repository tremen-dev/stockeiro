---
id: SPEC-050
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-050 La primera pantalla: la marca visible, una entrada clara y la advertencia fuera del hero

## Resumen
- Fase: `borrador` — escrita por sdd-arquitecto el 2026-08-23, **rearbitrada el mismo día** con
  las decisiones del humano (Alberto Fojo). Pendiente de su aprobación formal.
- Rama: `ft/SPEC-050-la-primera-pantalla-la-marca-visible-una-entrada-clara-y-la-advertencia-fuera-del-hero`
- **Nació como `SPEC-049`.** Otra sesión mergeó en `origin/main` una SPEC-049 propia (EPIC-FIX,
  *el gate de versión no dice verde sobre un árbol sucio*) mientras ésta se escribía. Id
  reasignado desde `origin/main`; citas reverificadas contra `9387681`.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->

| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (wordmark en `/`) | | | | ❌ |
| CA-2 (es marca, no microcrédito) | | | | ❌ |
| CA-3 (la barra no se entera) | | | | ❌ |
| CA-4 (una sola definición) | | | | ❌ |
| CA-5 (orden de la pantalla) | | | | ❌ |
| CA-6 (jerarquía de los botones) | | | | ❌ |
| CA-7 («gratis y sin publicidad» sube) | | | | ❌ |
| CA-8 (cuatro caminos, uno de cada) | | | | ❌ |
| CA-9 (`CADENCIA_LINEA` entera) | | | | ❌ |
| CA-10 (sin cromo de alarma) | | | | ❌ |
| CA-11 (ni una palabra nueva de cadencia) | | | | ❌ |
| CA-12 (descargo, legal y marca intactos) | | | | ❌ |
| CA-13 (feedback oculto en `/`, versión subordinada) | | | | ❌ |
| CA-14 (la versión sigue visible y copiable) | | | | ❌ |
| CA-15 (el pie no sabe en qué ruta está) | | | | ❌ |
| CA-16 (con sesión, `/` lleva al panel) | | | | ❌ |
| CA-17 (geometría a los ocho anchos) | | | | ❌ |
| CA-18 (suites verdes; acotación al gate) | | | | ❌ |
| CA-19 (alcance acotado — **criterio de gate, no de suite**) | n-a | n-a | | ❌ |
| CA-20 (sin dependencia y sin ADR) | | | | ❌ |
| CA-21 (el camino anónimo al feedback sobrevive) | | | | ❌ |
| CA-22 (la guardia ajena que se estrecha) | | | | ❌ |

> **CA-19 no lleva fila de test a propósito.** Es criterio de acotación y **ADR-031 pto. 1.2**
> lo saca de la suite: lo verifica sdd-verificador en el gate y **pega aquí la salida**.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Capturas de trabajo: test-results/SPEC-050/ (ignorado por git). Evidencia que se commitea: _qa/SPEC-050/ -->
<!-- Pedir en el gate: la primera pantalla completa a 390, 768 y 1280 px, antes y después. -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-050-1… con destino (spec futura o EPIC-MEJORA). -->

## Cómo retomar (handoff)
- Spec en `borrador` **ya arbitrada**. Los puntos abiertos del primer gate están cerrados por el
  humano el 2026-08-23; falta solo su aprobación formal para pasar a `aprobada`.
- **Decisión del humano recogida en el texto (D-5, CA-13, CA-14, CA-21, CA-22):** en `/` se
  **retira el canal de feedback** y **se queda la versión**. Su matiz —*«el feedback es importante
  para mí, ya que permite a los usuarios decirme qué cosas puedo mejorar»*— está escrito en D-5 y
  atado con **CA-21**, que recorre `/` → `/ayuda` → canal navegando de verdad. Ya no hay cláusula
  de defecto: la anterior («si no contesta, las dos se quedan») ha desaparecido.
- **Una sola aserción ajena se toca, y está autorizada:** `tests/e2e/ayuda.spec.ts:361`
  (SPEC-039 CA-12), bajo **CA-22**. **Un segundo fichero ajeno modificado es RED**: se escala.
  El caso retirado se sustituye por su **inverso** para no perder cobertura sobre `/`.
- **Reencuadre según ADR-031** (hecho al reverificar, no pedido por el humano): ningún CA
  alimenta ya una aserción con `origin/main`/`HEAD`. CA-11, CA-13, CA-15 y CA-20 son ahora
  propiedades del árbol; **CA-19 salió de la suite** y es criterio de gate con evidencia aquí.
- Antes de empezar: `git fetch origin main` y rebasar. Los números de línea son de `9387681`.
- Riesgo de merge conocido: `src/app/globals.css` en dos zonas (`.app-nav .brand` ~323 y el
  bloque `.landing*` ~1232). Solape posible con **SPEC-051** en `src/app/page.tsx`.
