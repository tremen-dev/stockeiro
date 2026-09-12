---
id: SPEC-063
tipo: ledger
epica: EPIC-009
---
# Ledger — SPEC-063 La nota y los enlaces del simbolo, escritos donde se mira la accion

## Resumen
- Fase: **en-revisión** — implementada el 2026-09-13, pendiente del veredicto del verificador
- Rama: `ft/SPEC-063-la-nota-y-los-enlaces-del-simbolo`
- Versión: **0.7.0** (minor: capacidad nueva; `package.json` + `package-lock.json` en el mismo commit, ADR-033)
- Migración: `drizzle/0011_symbol_notes_and_links.sql` — **aditiva**, dos `CREATE TABLE` y nada más

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `drizzle/0011_symbol_notes_and_links.sql` · `src/db/schema.ts` (`symbolNotes`, `symbolLinks`) | `tests/spec063-contexto.test.ts` › «CA-1 …» × 2 (la migración solo CREA · las tablas de siempre siguen aceptando lo de siempre) · `npm run db:scan` | | 🚧 |
| CA-2 | `src/lib/contexto/service.ts` (`guardarNota` con `onConflictDoUpdate`; `position` = uno más que el mayor) | `tests/spec063-contexto.test.ts` › «CA-2 …» × 3 (sustituye y no duplica · orden estable entre lecturas · quitar el del medio no descoloca) | | 🚧 |
| CA-3 | `service.ts` (todo filtra por `userId`; `simboloDeVigiladaPropia`) | `tests/spec063-contexto.test.ts` › «CA-3 …» × 3 (dos usuarios, mismo símbolo · borrar con id ajeno no borra · escribir desde fila ajena es imposible) | | 🚧 |
| CA-4 | El modelo entero (cuelga del símbolo) · `src/lib/account/deletion.ts` (censo + sentencias) | `tests/spec063-contexto.test.ts` › «CA-4 …» × 3 (unwatch conserva y devuelve · borrar cuenta se lo lleva sin tocar lo compartido ni al vecino · las dos tablas en el censo) · `tests/account-deletion-coverage.test.ts` (guardia ajena que ya existía) | | 🚧 |
| CA-5 | `src/app/vigiladas/contexto-form.tsx` · `watched-table.tsx` (dentro del `<dialog>` de ADR-030) · `actions.ts` | `tests/e2e/spec063-contexto.spec.ts` › «la nota se escribe en el panel de la fila, y sigue ahí al reabrirlo» | | 🚧 |
| CA-6 | `service.ts` (vaciar **borra** la fila) · `contexto-form.tsx` (dos formularios, no uno) | `tests/spec063-contexto.test.ts` › «CA-6 …» × 2 · e2e › «un enlace se añade, se ve con su etiqueta y se quita» | | 🚧 |
| CA-7 | `contexto-form.tsx` **fuera** del bloque que conmuta con la confirmación de zonas | `tests/e2e/spec063-contexto.spec.ts` › «guardar la nota deja las cuatro zonas donde estaban» | | 🚧 |
| CA-8 | `globals.css` (`.contexto-*`, apilar y no encoger) | e2e › «con el bloque nuevo dentro, nada se sale de la pantalla a ningún ancho» (M1 a los ocho anchos) y «el foco vuelve a su fila al cerrar» | | 🚧 |
| CA-9 | `columnas-vigiladas.tsx` (señal en la celda de activo) · `page.tsx` (`contextosDeUsuario`, dos consultas) | `tests/spec063-contexto.test.ts` › «CA-9 …» × 2 · e2e › «con contexto aparece la señal, sin contexto no hay marca» | | 🚧 |
| CA-10 | `src/lib/contexto/senal.ts` (`textoDeContexto`) · `columnas-vigiladas.tsx` (`role="img"` + `aria-label`) | `tests/spec063-vocabulario-y-ayuda.test.ts` › «CA-10 …» × 2 · e2e › `aria-label` = «Tiene nota tuya» y «Tiene nota tuya y 1 enlace» | | 🚧 |
| CA-11 | `src/lib/contexto/enlace.ts` (`normalizarEnlace`: parser + lista cerrada de esquemas) | `tests/spec063-enlace.test.ts` › **9 especímenes que deben rechazarse** y **6 que no**, más los motivos · e2e › `javascript:` rechazado y el bueno aceptado sin recargar | | 🚧 |
| CA-12 | `contexto-form.tsx` (texto como contenido; sin `dangerouslySetInnerHTML`) | `tests/spec063-vocabulario-y-ayuda.test.ts` › «CA-12 …» × 2 · e2e › una nota con `<script>` se ve tal cual y **no** deja rastro en `window` | | 🚧 |
| CA-13 | `enlace.ts` y `service.ts` (ninguno pide la red) · `contexto-form.tsx` (`rel="noopener noreferrer"`) | `tests/spec063-enlace.test.ts` › «CA-13 …» (guardia estructural) · e2e › «guardar un enlace no hace que el navegador pida esa dirección» | | 🚧 |
| CA-14 | `src/lib/config/limites-contexto.ts` (1000 / 5, un solo hogar) · `service.ts` (los aplica el servidor) | `tests/spec063-contexto.test.ts` › «CA-14 …» × 3 (nota justa y pasada · el enlace 6 se rechaza contando · quitar abre hueco) · `tests/spec063-enlace.test.ts` › topes de URL y etiqueta | | 🚧 |
| CA-15 | `enlace.ts` (`rotuloDeEnlace`: dominio sin `www.`) | `tests/spec063-enlace.test.ts` › «CA-15 …» × 3 · e2e › «sin etiqueta, el enlace se presenta por su dominio» | | 🚧 |
| CA-16 | `docs/fundacion/dominio.md` («Nota de un símbolo», «Enlace de un símbolo») | `tests/spec063-vocabulario-y-ayuda.test.ts` › «CA-16 …» × 3 | | 🚧 |
| CA-17 | `src/lib/help/content.ts` (dos párrafos, con los topes **derivados**) | `tests/spec063-vocabulario-y-ayuda.test.ts` › «CA-17 …» × 3 (qué es y qué no · derivación · afirmaciones prohibidas) | | 🚧 |
| CA-18 | — (propiedad de no-regresión) | Batería completa: `npm test` y `npx playwright test` sobre un build del árbol commiteado | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-063/. Informe HTML opcional: _qa/SPEC-063/informe.html -->

| CA | Captura |
|---|---|
| CA-5 / CA-8 | `_qa/SPEC-063/panel-contexto-1280.png` — el panel con la nota y los enlaces |
| CA-9 (tarjeta) | `_qa/SPEC-063/tarjetas-senal-390.png` — la señal en la lista a 390 px |

## Salvedades / follow-ups
<!-- IDs F-SPEC-063-1, F-SPEC-063-2… con destino (spec futura o EPIC-MEJORA). -->

- **F-SPEC-063-1 — Una nota puede quedarse sin pantalla que la enseñe.** Es `R-6` de la
  épica y sigue viva: si el usuario deja de vigilar una acción **y** no tiene posición en
  ella, su nota sigue guardada y **no hay sitio donde verla**. No es una fuga —es suya, está
  aislada y su cuenta se la lleva— pero tampoco está resuelta: hoy se recupera **volviendo a
  vigilar** el valor, que es lo que hace el test de CA-4. **Destino**: la segunda spec de la
  épica (Cartera) cubre la mitad; la otra mitad —decir al quitar de vigiladas que lo escrito
  se conserva— cabe en ella o en EPIC-MEJORA.
- **F-SPEC-063-2 — Los enlaces no se reordenan.** `position` existe y da orden estable, pero
  no hay forma de mover uno: se quita y se vuelve a añadir. Con un tope de cinco no parece
  urgente y **no estaba pedido**. **Destino**: EPIC-MEJORA, si alguien lo pide.
- **F-SPEC-063-3 — La nota no se busca ni se filtra.** Fuera de alcance por escrito. Con
  listas de decenas de filas no está observado; se reabre cuando alguien tenga cien.

## Cómo retomar (handoff)

### Lo que hay que saber para tocar esto

1. **Cuelga del símbolo, no de la vigilada.** Es la decisión de la épica y explica casi todo
   el diseño: `unwatch` no lo toca, dos usuarios sobre el mismo símbolo tienen contextos
   distintos, y lo que viaja desde la pantalla —el id de la **fila**— hay que traducirlo a
   `symbolId` **filtrando por dueño** (`simboloDeVigiladaPropia`). Esa traducción es la que
   impide escribir contexto desde una fila ajena.
2. **El filtro de enlaces parsea, no describe.** `new URL(...)` + lista cerrada de esquemas.
   Una expresión regular de «URL buena» rechazaría direcciones legítimas y seguiría sin ver
   `jAvAsCrIpT:` con espacios delante. Si mañana hay que aceptar otro esquema, se añade a
   `ESQUEMAS_PERMITIDOS` y los especímenes de las **dos** direcciones lo vigilan.
3. **Los topes se aplican en el servidor.** El `maxlength` del navegador es cortesía; las
   acciones son alcanzables sin pasar por el formulario, así que quien cuenta es el servicio.

### Dos defectos que aparecieron al implementar, y cómo se arreglaron

4. **La nota se veía en blanco después de guardarla.** El `textarea` es controlado y su
   estado nace del `contexto` del montaje: si el panel se reabría **antes** de que llegara la
   revalidación, se quedaba con el valor viejo para siempre. Lo cazó la guardia de CA-5 —que
   cerraba y reabría sin esperar— y no un usuario. Arreglado sincronizando estado con prop
   **cuando el servidor cambia** (ajuste en render, no efecto), y añadiendo el **acuse de
   recibo** («Nota guardada»), que además es lo que la guardia espera ahora en vez de dormir.
5. **El escenario del e2e heredaba contexto entre casos.** No es un descuido de la siembra:
   `sembrarVigiladas` borra vigiladas, y **la nota sobrevive a eso a propósito** (CA-4). El
   e2e de esta spec limpia además `symbol_notes` y `symbol_links` de su cuenta. Quien escriba
   el siguiente e2e sobre esta superficie tiene que hacer lo mismo.

### Lo que la batería completa destapó, y que no estaba en la spec

6. **`/legal/privacidad` no describía las tablas nuevas.** Hueco real, no de test: hay una
   guardia (`F-SPEC-035-3`) que exige que **toda** tabla con datos personales se explique en
   `src/lib/legal/content.ts`, y las dos de esta spec no estaban. Se añaden con su texto —qué
   se guarda, y que la app **no lo usa ni visita los enlaces**—. Esto es CE-5 de la épica por
   una puerta que la spec no había nombrado.
7. **Dos censos que crecen con cada tabla con dueño**: el orden explícito del borrado
   (`tests/account-deletion-coverage.test.ts`) y lo que viaja por el cable en la petición
   única de Neon (`tests/account-deletion-neon-http.test.ts`). Se **extienden**, que es su
   mantenimiento previsto: el literal existe para delatar un reordenamiento involuntario. El
   recuento de sentencias, en cambio, pasa a **derivarse** de `DELETION_ORDER` en vez de ser
   un `6` escrito.
8. **La siembra del test de borrado no sembraba lo nuevo**, así que su propio centinela
   («si no, el test de abajo no prueba nada») se ponía rojo. Correcto: ahora siembra nota y
   enlace, y el borrado se comprueba sobre ellas.
9. **El campo de texto no llegaba al suelo táctil.** La guardia M5 de SPEC-054 lo midió:
   21 px primero, **43,00** después de darle el estilo compartido — y un 43 no es un 44 mal
   redondeado (ADR-035 §1). Se agranda el control con `min-height: 44px`, que es la salida
   legítima; bajar el suelo habría sido `F-ADR-026-1` cumpliéndose por escrito.
10. **El panel crecido tapaba la lista entera**, y rompía la promesa de **ADR-030 §1** que
    **SPEC-046 CA-6(f)** mide. Es el hallazgo serio de la ronda, y tuvo dos respuestas:
    - el bloque de contexto va **plegado por defecto**, y **siempre** —no «sólo cuando está
      vacío»—, porque un desplegado condicional habría pasado la guardia de hoy y roto la
      promesa justo para quien más contexto tiene;
    - y la capa se **acota por encima del canto** (`calc(100dvh - 470px)`), que es la salida
      que ADR-030 y ADR-026 §4 declaran legítima cuando el contenido no cabe. El margen que
      había **antes** de esta spec era de unos 30 px: no se rompió por poco, se rompió porque
      ya estaba al límite.
    Y se añade una guardia **propia** que protege la propiedad de la vecina en el caso que
    esta spec introduce: con la nota llena y el bloque desplegado, la lista **sigue** viéndose.
    Sin ella, plegar habría «arreglado» el rojo de hoy sin arreglar nada.

### Tres guardias ajenas re-encuadradas (ADR-037), declaradas

11. Tres guardias congelaban **el directorio de migraciones**, que esta spec hace crecer por
    primera vez desde SPEC-037. Ninguna se afloja; las tres se **re-encuadran**, y en las tres
    queda escrito qué vigilaban antes y qué vigilan ahora:
    - **SPEC-037 CA-1** cogía *la última* migración del árbol y exigía que fuera la suya.
      Ahora **la busca por nombre** —una de las cuatro formas que ADR-037 declara
      supervivientes— y sigue exigiendo que sea aditiva, que es lo que el CA quería.
    - **SPEC-041 CA-1** congelaba *la última migración* para demostrar que aquella spec no
      trajo esquema. Ahora afirma la propiedad que sigue siendo verdad para siempre: **la
      columna del nombre del activo existía antes** de su entrega.
    - **SPEC-032 CA-8** contaba *once* migraciones como calibración. Ahora compara **dos
      medidas** —lo que el escáner recorre contra lo que el diario declara—, que calibra lo
      mismo, caza además el fichero que nadie registró, y no lo rompe quien migre mañana.
    ⚠️ Aquí, otra vez, **quien toca las guardias es quien se beneficia**. Por eso están las
    tres nombradas, con su antes y su después, y por eso ninguna cambia lo que exigía.

### Decisiones tomadas por el camino que conviene que el humano vea

12. **Los dos topes del gate viven en `src/lib/config/limites-contexto.ts`**, no junto al
   servicio, por lo mismo que la escala de SPEC-062: los cuenta `/ayuda`, que tiene prohibido
   alcanzar el código que habla con la base (SPEC-039 CA-14). Un solo hogar, dos lectores.
13. **La señal de la fila va en la celda de Activo**, no en una columna nueva — la tabla de
   nueve columnas no cabe a 730–760 px, el mismo motivo que llevó la barra de SPEC-062 a la
   celda de Estado.
14. **El tope de enlaces no es una restricción de la base.** Es decisión de producto: subirlo
   o bajarlo tiene que ser cambiar un número, no migrar. Lo mismo con el esquema de la URL:
   validarlo con un `CHECK` sería una segunda definición de la regla, condenada a divergir.
