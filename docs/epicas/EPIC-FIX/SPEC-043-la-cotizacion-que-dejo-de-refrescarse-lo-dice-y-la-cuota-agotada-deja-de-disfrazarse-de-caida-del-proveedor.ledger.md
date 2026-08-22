---
id: SPEC-043
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-043 La cotizacion que dejo de refrescarse lo dice, y la cuota agotada deja de disfrazarse de caida del proveedor

## Resumen
- Fase: **hecho** — spec aprobada en el gate humano (Alberto Fojo, 2026-08-21),
  implementada el mismo día y **verificada en GREEN por sdd-verificador el 2026-08-21**:
  los **16 CA en verde**, con los dos de lupa (CA-7 y CA-3) atacados con escenario propio.
- Rama: `ft/SPEC-043-la-cotizacion-que-dejo-de-refrescarse-lo-dice`
- Decisión que la acompaña: **ADR-027** (`docs/adr/ADR-027-…`), **aprobada** el 2026-08-21 y
  por tanto inmutable. El vocabulario (`dominio.md`) y **RN-16** (`reglas.md`) ya están
  escritos: son el rótulo del que copia esta implementación.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (cuota_agotada por `usage_limit_reached`) | `src/lib/market/provider.ts` (valor nuevo en `QuoteFailureReason`) · `src/lib/market/marketstack-provider.ts` (`classifyGlobal` recibe el **estado HTTP**, que antes se descartaba) | `tests/spec043-cuota-agotada.test.ts` → «CA-1: la cuota agotada tiene nombre propio» (2 casos: clasificación y persistencia por símbolo vía `refreshQuotes` + `getDiagnosticMap`) | Ejercido con la suite completa (1400/1400). Leído `classifyGlobal`: el 429 con `usage_limit_reached` sale `cuota_agotada` y **se persiste por símbolo** (`getDiagnosticMap` devuelve 2 y 13 filas, todas con ese motivo). **Visto en navegador**: `data-reason="cuota_agotada"` en las dos pantallas, con el texto del dominio y sin una palabra cruda del proveedor. | ✅ |
| CA-2 (429 por segundo sigue transitorio) | `src/lib/market/marketstack-provider.ts` (`classifyGlobal`, rama del tope por segundo **antes** de la presunción) | `tests/spec043-cuota-agotada.test.ts` → «CA-2» (3 casos: `rate_limit_reached`, `too_many_requests`, y que los dos 429 no se confunden) | **Mirado con lupa por encargo.** El orden de ramas es el correcto: `rate_limit_reached` / `too_many_requests` se comprueba **antes** que la presunción de cuota. El test no es decorativo: con el orden invertido, un 429 con `rate_limit_reached` saldría `cuota_agotada` y los tres casos de CA-2 se pondrían rojos. Verde. | ✅ |
| CA-3 (429 mudo se presume cuota) | `src/lib/market/marketstack-provider.ts` (`classifyGlobal` + el porqué de la presunción escrito en su cabecera) | `tests/spec043-cuota-agotada.test.ts` → «CA-3» (4 casos: cuerpo ilegible, código no reconocido, el 503 mudo que **no** se contagia, y que la razón está escrita junto al código) | **Mirado con lupa por encargo.** La presunción está **acotada al 429**: la condición es `status === 429` y el `return` final sigue siendo `proveedor_no_disponible`. Comprobado el contagio por el otro lado: un 503 mudo sigue siendo caída (test verde) y ningún estado distinto de 429 entra en la rama. El porqué está escrito en la cabecera de la función y hay un test que lee el fichero y lo exige. | ✅ |
| CA-4 (texto sin promesa de reintento) | `src/lib/market/fail-reason-text.ts` (`cuota_agotada`) · `src/lib/help/content.ts` (`EXPLICACION.cuota_agotada`) | `tests/spec043-formulas-prohibidas.ts` (lista cerrada, 7 patrones, con sus ejemplos prohibidos y permitidos) + `tests/spec043-cuota-agotada.test.ts` → «CA-4» (6 casos, incluida la guardia probándose a sí misma y que `proveedor_no_disponible` **conserva** su contrato) | Lista de **7 patrones** con motivo escrito y con la regla de negación **heredada** de SPEC-039 (`violacionesDe` se importa, no se copia). Los 7 ejemplos prohibidos se cazan y los 5 permitidos pasan. **Verificado en navegador**: en `/ayuda`, el bloque «Nos hemos quedado sin cuota de precios» no contiene «próximo ciclo» ni «se reintentará» (guardia propia del verificador, verde). `proveedor_no_disponible` **conserva** su promesa de ciclo. | ✅ |
| CA-5 (resiliencia y contrato del ciclo — no regresión) | Sin cambio de diseño: la rama nueva vive dentro de `fetchBody`/`classifyGlobal` y no toca el flujo | `tests/spec043-cuota-agotada.test.ts` → «CA-5» (2 casos: `runCronCycle` devuelve 200 con el mismo cuerpo; el camino feliz sigue actualizando) | Sin regresión: **1400 unitarios** (92 ficheros) y **235 e2e** verdes en esta rama, más `npm run build`, `typecheck` y `lint` limpios. `runCronCycle` con cuota agotada devuelve **200** con `refresh`/`triggers`/`notifications`, y el camino feliz sigue actualizando (`updated=[ITX]`, `skipped=[]`). | ✅ |
| CA-6 (ayuda explica el motivo y su cuenta no miente) | `src/lib/help/content.ts` (`EXPLICACION.cuota_agotada` + **`MOTIVOS_EN_PROSA`**, del que sale la intro de `SIN_PRECIO_SECCION`) | `tests/spec043-cuota-agotada.test.ts` → «CA-6» (3 casos: la explicación existe y no repite la etiqueta corta; la cifra en prosa atada a `MOTIVOS_SIN_PRECIO.length`; el «seis» suelto ya no está) | **Abierta `/ayuda` en el navegador**: el motivo nuevo tiene explicación propia y la intro dice «es uno de estos **siete**»; el «seis» ya no está (guardia propia del verificador, verde). La cifra sale de `MOTIVOS_EN_PROSA` y está atada a `MOTIVOS_SIN_PRECIO.length`. | ✅ |
| CA-7 (definición por `updated_at`, no por `as_of`) | **`src/lib/market/sin-refrescar.ts`** (nuevo: umbral y `estaSinRefrescar`) · `src/lib/market/quotes.ts` (`QuoteView.updatedAt`) | `tests/spec043-sin-refrescar.test.ts` → «CA-7» (8 casos; los dos que sostienen la decisión son el **contrapositivo del fin de semana** y el **retraso desigual de publicación**, los dos con el `expect` que demuestra que por `as_of` serían falsos positivos; más la guardia de que el cron de `vercel.json` sigue corriendo todos los días) | **Mirado con lupa por encargo, y verificado con escenario adversarial propio** en el navegador, con `as_of` y `updated_at` moviéndose en direcciones **opuestas**: fila con `as_of` de **hoy** y `updated_at` de hace 60 h → **marcada**; fila con `as_of` de hace una semana y `updated_at` de hace 11 h → **sin marcar** (fin de semana y retraso desigual de publicación). Umbral comprobado en pantalla: 35 h no marca, 37 h sí. `estaSinRefrescar` **solo recibe `updatedAt`**, y `as_of` no entra en ninguna decisión de frescura en todo `src/`. | ✅ |
| CA-8 (`/vigiladas` lo dice con precio y con estado de zona) | `src/app/vigiladas/watched-table.tsx` (marca **independiente** de `r.state`) · `src/lib/watchlist/zone-status.ts` (`updatedAt` + `sinRefrescar`) | `tests/e2e/sin-refrescar.spec.ts` → «CA-8» (fila en zona de compra, con precio, marcada y con motivo; y la fila fresca de control **sin** marcar) + `tests/spec043-sin-refrescar.test.ts` → «CA-13» | **Visto en `/vigiladas`**: las tres filas con precio 22 y estado «En zona de compra» —o sea `state !== 'none'`, que es justo donde el aviso se escondía— y aun así `Z6CUOTA` y `Z6MUDA` llevan la marca con su fecha; `Z6VIVA`, refrescada anoche, no. La marca convive con el estado de zona, no lo sustituye. | ✅ |
| CA-9 (`/cartera` lo dice con P/L calculado) | `src/app/cartera/page.tsx` (marca **independiente** de `p.plActual`) | `tests/e2e/sin-refrescar.spec.ts` → «CA-9» (P/L actual = 210, sin «—», y aun así marcada) | **Visto en `/cartera`**: `Z6CUOTA` con **P/L actual 210.00** —sin «—»— y la marca con el motivo debajo; `Z6VIVA`, con el mismo 210.00, sin marca. La condición vieja (`plActual === null`) ya no gobierna nada. | ✅ |
| CA-10 (sin diagnóstico no se inventa el motivo) | `src/lib/market/sin-refrescar.ts` (`marcaSinRefrescar`, el motivo es opcional) | `tests/spec043-sin-refrescar.test.ts` → «CA-10» (2 casos) + `tests/e2e/sin-refrescar.spec.ts` → «CA-10» (`Z6MUDA`: sin `data-reason` y sin nombrar causa alguna) | **Visto en las dos pantallas**: `Z6MUDA` (y `V1JUSTO`, del escenario del verificador) salen **sin `data-reason`** y su texto no nombra proveedor, cuota, mercado ni deslistado — solo el hecho y la fecha. Comprobado con guardia propia además de la de la spec. | ✅ |
| CA-11 (la marca desaparece sola) | Sin cambio: el upsert de `quotes` ya reescribe `updated_at` y `clearDiagnostic` ya limpia (SPEC-016 CA-8) | `tests/spec043-sin-refrescar.test.ts` → «CA-11» (2 casos; el segundo prueba que la fila se reescribe **aunque el precio no cambie**, que es de lo que cuelga todo CA-7) + `tests/e2e/sin-refrescar.spec.ts` → «CA-11» | Verde en unitario y en e2e: al reescribir la fila desaparecen marca y motivo en la visita siguiente, y **la fila congelada de al lado sigue marcada** (no se limpia la pantalla entera). El caso del que cuelga CA-7 —el upsert mueve `updated_at` **con el mismo precio y el mismo `as_of`**— está probado. | ✅ |
| CA-12 (una sola definición y umbral derivado de la cadencia) | `src/lib/market/sin-refrescar.ts` (`HORAS_POR_CICLO` × `CICLOS_HASTA_SIN_REFRESCAR` = 36 h; y la marca, en una sola redacción) | `tests/spec043-sin-refrescar.test.ts` → «CA-12» (4 casos: ninguna pantalla escribe el número ni su aritmética; las dos importan del mismo módulo; la marca sale de una sola función; y RN-16 cita el mismo umbral que el código) | Comprobado por fuera del test: `grep "36" src/` **no devuelve nada** fuera de `sin-refrescar.ts`. Las dos pantallas importan `estaSinRefrescar` del mismo módulo y la marca sale de `marcaSinRefrescar`: se lee **idéntica** en las dos capturas. RN-16 cita las mismas 36 h. | ✅ |
| CA-13 (RN-06 y RN-11 intactos: marcar no es borrar) | `src/lib/watchlist/zone-status.ts` y `src/app/cartera/page.tsx`: la marca es **aditiva**, no sustituye ni el estado ni el P/L | `tests/spec043-sin-refrescar.test.ts` → «CA-13» (2 casos: `state` sigue siendo `buy` con su precio; `plActual` = 50 y no pasa a `null`) | **Visto en pantalla, que es donde importa**: la fila marcada mantiene «En zona de compra», su color de fondo y su precio, y el P/L actual sigue siendo **210.00**. Marcar no borra. En unitario, `state='buy'` y `plActual=50`, no `null`. | ✅ |
| CA-14 (no se alerta a nadie — ADR-023 pto. 15) | Ninguno: la frontera se cumple **no escribiendo nada** | `tests/spec043-frontera.test.ts` (4 casos: ciclo completo con cuota agotada y fila congelada sin un solo correo ni fila en `notifications`; el ciclo que no corrió; ni un `import` del canal desde los tres ficheros nuevos; y ninguna tabla nueva) | Ciclo completo con cuota agotada y fila congelada: **0 correos** en el sender y **0 filas** en `notifications`. El ciclo que nunca corrió tampoco despierta a nadie. Y no se **puede**: ni un import de `lib/notifications` ni de un cliente de correo en los tres ficheros nuevos, ni tabla ni migración añadida. | ✅ |
| CA-15 (geometría a 360 y 1280 — ADR-026) | `src/app/globals.css` (`.quote-stale` hereda la caja acotada que SPEC-040 CA-4 puso en `.estado-caja`) | `tests/e2e/sin-refrescar-geometria.spec.ts` (3 casos con el módulo compartido: M1+M2 en `/vigiladas` y `/cartera` a 360 y 1280 con filas marcadas y sin marcar, y el ancho de la tabla con/sin marca — **con prueba de eficacia**, ADR-026 §7: al reinyectar la caja sin acotar, la medida se pone roja) | M1 y M2 con el módulo de ADR-026 en las dos pantallas: **0 violaciones** a 360 y a 1280 px (`geometria-vigiladas.txt`: 44 y 113 elementos medidos; `geometria-cartera.txt`: 74 y 103), con filas marcadas y sin marcar en la misma tabla. La tabla **no se estira** al marcar, y la **prueba de eficacia** (ADR-026 §7) pone la medida roja al reinyectar la caja sin acotar. Medida independiente del verificador a 360 px: desborde de documento **0** en las dos pantallas. | ✅ |
| CA-16 (el incidente real reproducido — CE-F1) | Todo lo anterior junto | `tests/spec043-cuota-agotada.test.ts` → «CA-16» (2 casos: trece símbolos, **una** llamada, un 429 `usage_limit_reached`, la firma `requested=13 / updated=0 / skipped=13` reproducida y trece `cuota_agotada`; y las trece filas conservando precio y estado de zona) + `tests/e2e/sin-refrescar.spec.ts` → «CA-16» (las trece marcadas en **las dos pantallas**) | El incidente reproducido de punta a punta: trece símbolos, **una** llamada, un 429 `usage_limit_reached`, la firma `requested=13 / updated=0 / skipped=13` y **trece** `cuota_agotada` persistidos, conservando precio y estado de zona. **Visto en el navegador**: trece filas marcadas con su motivo en `/vigiladas` y trece en `/cartera`. | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

### 🟢 GREEN — 2026-08-21 · 16/16 CA

**Puertas automáticas**, todas en la rama `ft/SPEC-043-…`, HEAD `ce8381c`, en el worktree
`.claude/worktrees/spec-043`:

| Puerta | Resultado |
|---|---|
| `npm run typecheck` | limpio |
| `npm run lint` (`--max-warnings=0`) | limpio |
| `npx vitest run` | **1400 pasan** / 1400, 92 ficheros |
| `npm run build` | limpio |
| `npx playwright test` | **235 pasan** / 235 |
| `node scripts/check-version-bump.mjs` | `0.2.0 → 0.2.1`, correcto (ADR-024) |

**Lo que se ejerció de verdad, más allá de correr los tests del implementador.** El
verificador montó su **propio escenario** en el navegador —siembra propia, tickers propios,
aserciones propias— y lo tiró contra la app construida (`next build` + `next start` sobre el
Postgres efímero del e2e). Tres guardias, las tres verdes:

1. **`as_of` y `updated_at` en direcciones opuestas** (el ataque a CA-7). Cuatro filas: una
   con `as_of` de **hoy** y `updated_at` de hace 60 h —**marcada**—, una con `as_of` de hace
   una semana y `updated_at` de hace 11 h —**sin marcar**—, y las dos del borde del umbral,
   35 h y 37 h. Es la prueba que la suite de la spec no tenía: allí todas las filas
   comparten `as_of`, aquí el `as_of` **contradice** al `updated_at` fila a fila. La pantalla
   marca exactamente las que RN-16 dice, y el `as_of` no influye en ninguna.
2. **`/cartera` con P/L calculado y geometría a 360 px**: la marca convive con `210.00` y el
   desborde de documento es **0** en las dos pantallas.
3. **`/ayuda` en el navegador**: explica el motivo nuevo, dice «uno de estos **siete**» y el
   bloque de `cuota_agotada` no promete ningún reintento.

**Los dos puntos que el encargo pidió mirar con lupa:**

- **CA-7 se mide por `updated_at` y solo por `updated_at`.** `estaSinRefrescar` **no recibe**
  `as_of`: no puede mirarlo aunque quisiera, y no hay una segunda decisión de frescura en
  ningún sitio de `src/`. Los dos casos que justifican la decisión están comprobados **en
  pantalla**, no solo en unitario: el fin de semana (`as_of` viejo + fila reescrita anoche →
  sin marca) y el retraso desigual de publicación (`as_of` fresco + fila sin reescribir →
  marcada).
- **CA-3 no se come a CA-2.** El tope por segundo se comprueba **antes** que la presunción, y
  la presunción está acotada a `status === 429` con `proveedor_no_disponible` como último
  `return`. Comprobado el contagio por los dos lados: `rate_limit_reached` con 429 sigue
  siendo transitorio, y un 503 mudo sigue siendo caída.

**Ningún test ni comprobación tocó la API real de Marketstack**: todo va con `fetchImpl`
inyectado o con el fake tras el puerto. Comprobado además que ningún test de la rama
referencia `api.marketstack` ni la clave de producción.

**Revisado el F-SPEC-043-4** (las dos expectativas ajenas reescritas), que el encargo pedía
leer y no ojear: (a) `tests/market-operating-mic.test.ts` cambia **el motivo esperado**, no lo
que SPEC-015 CA-8 afirma —y ese ejemplo era, literalmente, el defecto—; (b) las dos guardias
de la serie RN dejan de vigilar **un número** («no nace ninguna RN-16») y pasan a vigilar **lo
que defendían**: que ninguna RI se cuele en la serie de dominio y ninguna RN en la de
ingeniería. La congelación sigue viva: RN-16 entra en la lista con su enunciado y cualquier
otro movimiento de la serie las pone rojas.

**Ruido conocido y descartado**: correr la suite e2e completa reescribió **188** capturas de
`_qa/SPEC-001` a `SPEC-041` (**F-SPEC-043-3**). Se descartaron con `git checkout -- _qa`; no
entran en este veredicto ni en el commit. Lo único que se añade es `_qa/SPEC-043/`.

**Sin salvedades.** Los follow-ups del ledger (F-ADR-027-1/2/3, F-SPEC-043-1/2/3/4) quedan
abiertos donde estaban: ninguno bloquea un CA de esta spec.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-043/. Informe HTML opcional: _qa/SPEC-043/informe.html -->
Pendiente **de commitear por el verificador**, que es a quien le toca esta sección. Las
guardias e2e ya **producen** los ficheros al correr, en `_qa/SPEC-043/`:

| CA | Fichero que genera la guardia |
|---|---|
| CA-8 | `vigiladas-sin-refrescar.png` |
| CA-9 | `cartera-sin-refrescar.png` |
| CA-15 | `geometria-vigiladas.txt`, `geometria-cartera.txt` (las cifras de M1/M2 a 360 y 1280) |
| CA-16 | `incidente-vigiladas.png`, `incidente-cartera.png` (las trece filas) |

**El implementador NO commiteó ninguna captura**, ni las suyas ni las ajenas: ver
**F-SPEC-043-3**, porque correr la suite entera reescribe las de todas las specs y ese
diff se descartó a propósito.

### Lo que el verificador sí commitea (2026-08-21)

Las de esta spec, y solo las de esta spec. Las cuatro primeras las produjeron las guardias
e2e de la rama; las cuatro últimas son del **escenario propio del verificador**:

| CA | Fichero en `_qa/SPEC-043/` | Qué se ve |
|---|---|---|
| CA-8, CA-10, CA-13 | `vigiladas-sin-refrescar.png` | Tres filas con precio 22 y «En zona de compra»: `Z6CUOTA` marcada **con** motivo, `Z6MUDA` marcada **sin** causa inventada, `Z6VIVA` sin marcar. Las tres con la **misma** «A fecha 2026-08-18» — por `as_of` no se distinguirían |
| CA-9, CA-13 | `cartera-sin-refrescar.png` | P/L actual **210.00** con la marca debajo; la fila fresca, mismo 210.00, sin marca |
| CA-16 | `incidente-vigiladas.png`, `incidente-cartera.png` | Las **trece** filas del 19 de agosto, marcadas y con `cuota_agotada`, en las dos pantallas |
| CA-15 | `geometria-vigiladas.txt`, `geometria-cartera.txt` | M1/M2 a 360 y 1280: **0 violaciones**, 44/113 y 74/103 elementos medidos |
| **CA-7** | `verif-vigiladas-updated-at.png` | **La captura decisiva**: `V1CALIENTE` con `as_of` de **hoy** está marcada y `V1VIEJA` con `as_of` de hace una semana **no**. Justo al revés de lo que daría medir por `as_of`. Y el umbral: 35 h sin marca, 37 h con ella |
| CA-15 | `verif-vigiladas-360.png`, `verif-cartera-360.png` | Medida independiente a 360 px: desborde de documento 0 |
| CA-4, CA-6 | `verif-ayuda-motivos.png` | `/ayuda` con el motivo nuevo explicado y «uno de estos siete» |

## Salvedades / follow-ups

### Levantadas al implementar (2026-08-21)

- **F-SPEC-043-3 (hallazgo de proceso, no de esta spec): correr la suite e2e completa
  reescribe TODAS las capturas de `_qa/`.** Medido: un `npx playwright test` deja **~60
  PNG modificados** de SPEC-001 a SPEC-041, porque cada spec vuelve a hacer sus
  `page.screenshot()` sobre los mismos ficheros y los bytes nunca salen idénticos. No es
  un fallo de nadie ni un dato corrupto —son las mismas pantallas—, pero **cualquiera que
  ejecute la suite entera se encuentra un diff enorme de origen aparentemente
  desconocido** y acaba, o bien commiteándolo dentro de un cambio ajeno, o bien
  descartándolo a ciegas. Aquí se descartó con `git checkout -- _qa` y **no se ha
  commiteado ni una captura**. Merece decisión propia (¿`_qa/` versionado o generado?),
  que es de proceso y no de producto.
- **F-SPEC-043-4: dos expectativas ajenas estaban escritas sobre el defecto, y se han
  corregido.** No es alcance nuevo: es que el arreglo las volvió falsas.
  - `tests/market-operating-mic.test.ts` (SPEC-015 CA-8) usaba **`usage_limit_reached`**
    como ejemplo de fallo global y esperaba que saliera como `proveedor_no_disponible`.
    Eso **era literalmente el defecto** que ADR-027 pto. 4 cierra. Lo que ese test afirma
    —que un fallo global no tumba el ciclo y sale por símbolo— no ha cambiado y sigue
    verde; lo que ha cambiado es el motivo esperado.
  - `tests/reglas-ingenieria.test.ts` (SPEC-032 CA-15) y
    `tests/reglas-ingenieria-hecho-vivo.test.ts` (SPEC-028 CA-14.3) prohibían **una RN-16
    por número**. RN-16 la escribió el arquitecto **al aprobar esta spec** (ADR-025), así
    que las dos guardias estaban rojas antes de tocar una línea de `src/`. Se han
    reescrito para vigilar **lo que de verdad defendían** —que ninguna regla de
    ingeniería se cuele en la serie de dominio— en vez de un número que caduca. **La
    congelación de la serie sigue intacta**: RN-16 entra en la lista con su enunciado, y
    cualquier otro movimiento sigue poniéndolas rojas.
- **Retoque de texto que no es un CA pero sí una consecuencia**: la explicación de
  `proveedor_no_disponible` en `/ayuda` decía *«se cayó, tardó demasiado o se agotó la
  cuota del día»*. Con `cuota_agotada` ya existiendo, esa frase era la vieja confusión
  escrita en la ayuda. Ahora dice *«…o nos frenó por pedirle varias cosas demasiado
  seguidas»*, que es el 429 que **sí** le corresponde (CA-2). Su contrato —transitorio,
  el próximo ciclo puede ir bien— se conserva y hay un test que lo exige.
- **La versión sube a `0.2.1`** (ADR-024 / gate de SPEC-038 CA-12): la rama toca código
  de aplicación, y esto es un defecto corregido, no una funcionalidad.

### Abiertas desde el diseño, antes de implementar:

- **F-ADR-027-1** (gate humano, **no la resuelve esta spec**): **CE-F3 de EPIC-FIX**
  (*coste cero de arranque*) y la realidad medida ya no caben juntos — 13 símbolos × ~31
  días ≈ 400 unidades/mes contra las 100 del free tier de Marketstack. Ningún cambio de
  código lo arregla. Decisión de producto y coste.
- **F-ADR-027-2**: el proveedor avisa al 75/90/100 % de consumo **por correo al titular** y
  la app **no** conecta esa señal — hacerlo sería la alerta proactiva que **ADR-023 pto. 15**
  deja fuera por decisión escrita.
- **F-ADR-027-3** (→ EPIC-MEJORA): nadie mira el **consumo previsto**, que crece con cada
  símbolo nuevo vigilado. Un contador en Operación sería barato, pero es funcionalidad.
- **F-SPEC-043-1** (→ idea de roadmap, **no** CA): el **aviso de permanencia** (RN-14)
  sigue diciendo *«sigue en zona»* sobre una cotización sin refrescar. Verificado el
  2026-08-21: el cuerpo **sí** lleva fecha (`src/lib/notifications/service.ts:140`,
  `` `Siguen en zona: ${lista}. (asOf ${cycleRef})` ``), o sea que no es mudo — pero repite
  la **misma señal débil** que ya falló en pantalla, y además `cycleRef` sale de
  **`max(quotes.asOf)` GLOBAL** (línea 67), **no por símbolo**: basta **un** símbolo fresco
  para que el digest entero parezca fresco. **El arreglo natural, una vez exista RN-16, es
  que RN-14 consuma esa misma regla** en vez de redecidir qué es viejo. Fuera de alcance
  aquí porque tocar el motor o el contenido de los avisos es cambiar el producto.
- **F-SPEC-043-2** (→ candidato a **spec propia**): **saltar el ciclo los fines de semana**.
  Propuesto y **rechazado** en el gate del 2026-08-21. (i) No rescata ningún plan: ~286
  unidades/mes contra 100 del free tier, y un 1,1 % de ahorro sobre Basic. (ii) **Choca con
  CA-7**: 72 h de hueco viernes→lunes contra un umbral de 36 h marcaría **todo** el universo
  como sin refrescar el fin de semana, y devolvería la necesidad del calendario de sesiones
  que medir por `updated_at` eliminó. (iii) El ciclo del sábado **no es inútil**: el
  proveedor publica el EOD con retraso desigual por símbolo (medido: `APP` con `date`
  `2026-08-19` mientras `AAPL` e `ITX` ya traían `2026-08-20`), así que matarlo pierde el
  cierre del viernes hasta el lunes para los rezagados. (iv) «Fin de semana» es la parte
  fácil: BMEX, XPAR, XNAS y XNYS tienen **festivos distintos**. **Condición escrita para el
  día que se retome: entra A LA VEZ que un umbral consciente del calendario, nunca antes.**
- **Decisión consciente, no salvedad** (2026-08-21): `outcome='success'` con `updated=0` y
  `skipped=13` **se queda como está**. Se miró en el incidente que lo destapó y se decidió
  no moverlo; tocarlo abre el contrato de **ADR-023**. Queda escrito para que el próximo que
  lo lea sepa que no es un descuido.
- **Constancia de despliegue, no bloqueante** (2026-08-21): la `MARKETSTACK_API_KEY` de
  producción es de una **cuenta de prueba que el humano no administra**, así que los avisos
  de consumo al 75/90/100 % **van a un buzón que nadie lee** — ese canal **no existe en la
  práctica** y no puede citarse como mitigación (ver F-ADR-027-2). Se dará de alta cuenta
  propia y se **rotará la clave**. **Nada de esta spec depende de esa clave**: los CA se
  verifican con el fake y con `fetchImpl`, no contra la API real.

## Cómo retomar (handoff)

Estado real: **implementada y en `en-revision`**. Los 16 CA tienen código y test; lo que
falta es el gate adversarial (`sdd-verificador`), que es quien rellena **Verif.** y
**Estado** de la matriz y esta sección de evidencia.

**Rama**: `ft/SPEC-043-la-cotizacion-que-dejo-de-refrescarse-lo-dice`. **Sin push, sin
PR, sin merge** — eso es del humano.

### Los commits, en orden

| Commit | Qué trae |
|---|---|
| `b0b6388` | `chore`: spec a `en-progreso` y el `## Resumen` de este ledger, que seguía diciendo `borrador` |
| `358b11d` | `feat`: bloque **A** — `cuota_agotada`, el estado HTTP en `classifyGlobal`, la lista de fórmulas prohibidas y la cifra en prosa de la ayuda (CA-1 a CA-6) |
| `345c1e2` | `feat`: bloque **B** — `sin-refrescar.ts`, `QuoteView.updatedAt`, y las dos pantallas (CA-7 a CA-13). Sube la versión a `0.2.1` |
| `39c1201` | `test`: **CA-14** (la frontera de ADR-023 pto. 15) y la mitad de ciclo de **CA-16** |
| `f3e5629` | `test`: las guardias e2e de las dos pantallas y de la geometría (CA-8, CA-9, CA-10, CA-11, CA-15 y la mitad visual de CA-16) |

### Cómo se corre todo

```
npm run typecheck && npm run lint && npx vitest run
DATABASE_URL=postgres://ci:ci@localhost:5432/ci   AUTH_SECRET=ci-not-a-real-secret-ci-not-a-real-secret   AUTH_TRUST_HOST=true APP_BASE_URL=http://localhost:3200   npm run build && npx playwright test
```

Las variables son las de juguete del job de e2e de `ci.yml`: `next build` solo exige que
**existan** —el cliente de BD se instancia al importar— y el launcher del e2e reinyecta
las suyas, incluida la `DATABASE_URL` del Postgres efímero que él mismo levanta.

Medido el 2026-08-21 en esta rama: **1400 unitarios en verde** (91 ficheros) y **235 e2e
en verde**. `typecheck` y `lint` limpios.

> ⚠️ **Antes de commitear después de correr el e2e completo**, mira `git status`: la suite
> reescribe las capturas de **todas** las specs (**F-SPEC-043-3**). Lo de esta spec vive
> en `_qa/SPEC-043/`; lo demás se descarta con `git checkout -- _qa`.

### Los tres sitios donde mirar primero si algo se rompe

1. **`src/lib/market/sin-refrescar.ts`** — el umbral y la definición, en un solo sitio
   (CA-12). Si aparece un segundo literal `36` en una pantalla, hay dos definiciones y una
   de las dos está mal; hay un test que lo caza.
2. **`classifyGlobal`** en `src/lib/market/marketstack-provider.ts` — la taxonomía del
   429. El orden de las ramas **importa**: el tope por segundo se comprueba **antes** que
   la presunción de cuota, o CA-2 se lo come CA-3.
3. **`quotes.updated_at`**, nunca `as_of`. Es la decisión central de la spec y está
   razonada en cuatro sitios (CA-7, RN-16, la fila de `dominio.md` y la cabecera del
   módulo). Los tests están construidos **para caerse** si se cambia la medida: en el
   escenario e2e todas las filas comparten `as_of` a propósito.

### Lo que el verificador debería mirar con más lupa

- Que la marca aparece **con precio y con estado de zona** (ése era el defecto) y que el
  P/L actual y el estado de zona **siguen calculándose** (CA-13): marcar no es borrar.
- Que ningún test toca la **API real** de Marketstack. Todo va con `fetchImpl` inyectado o
  con el fake tras el puerto.
- **F-SPEC-043-4**: dos expectativas de otras specs se han corregido porque estaban
  escritas sobre el defecto. Merecen lectura, no un vistazo.
