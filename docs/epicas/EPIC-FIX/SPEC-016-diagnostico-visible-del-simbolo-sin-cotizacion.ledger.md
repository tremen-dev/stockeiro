---
id: SPEC-016
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-016 Diagnostico visible del simbolo sin cotizacion

## Resumen
- Fase: en-revision (implementación completa; pendiente de verificador)
- Rama: `ft/SPEC-016-diagnostico-visible-del-simbolo-sin-cotizacion`
- El puerto deja de tragarse el motivo (ADR-012 pto. 6): `getQuotes` pasa a devolver
  `{quotes, failures}` con **motivos clasificados del dominio**. Se persisten en la tabla
  nueva `quote_diagnostics` (por símbolo) y se muestran en `/vigiladas` y `/cartera`.
  **RN-06 intacto**: sin precio NO se calcula P/L; solo deja de ser un guion mudo.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (motivo propagado y CLASIFICADO) | `market/provider.ts` (`QuoteFailureReason`, `ProviderFailure`, `QuotesResult`); `marketstack-provider.ts` (`classify` + `matchRequest`, este último **arregla F-SPEC-016-3**); `fail-reason-text.ts` | `tests/quote-diagnostics.test.ts` › CA-1 (**4 casos**: traducción del error real · el texto crudo no sale a la UI · **el fallo se atribuye a SU mercado** · **el motivo del que falla es el suyo, no el de su gemelo**) + e2e | Vocabulario y traducción CORRECTOS: el fixture es la respuesta real del free tier (casa con ADR-012, incl. el artefacto `**symbol**`) y el aserto es `toEqual` estricto, no de adorno. `FAIL_REASON_TEXT` no filtra texto de proveedor (aserto negativo `/plan\|403\|upgrade/i` en unit **y** en e2e). **2ª vuelta: F-SPEC-016-3 CERRADO.** `matchRequest` empareja por identidad completa. Los 2 tests nuevos NO son de adorno: verificado extrayendo el adaptador **pre-arreglo** (`git show 516add6:…`) y pasándole el mismo caso → reproduce el fallo, luego el test lo caza de verdad. `quotes` y `failures` ya son disjuntos y el motivo cae en su mercado (ver Veredicto, 2ª vuelta) | ✅ |
| CA-2 (se persiste el último diagnóstico) | `db/schema.ts` (`quote_diagnostics`); `market/quotes.ts` (`upsertDiagnostic`); `refresh.ts` | `quote-diagnostics.test.ts` › CA-2 (motivo + attemptedAt; 1 fila por símbolo) | Verificado. `upsertDiagnostic` es upsert por `symbol_id` (UNIQUE) → el 2º ciclo actualiza y el test lo prueba (`toHaveLength(1)`). `attemptedAt` persistido y asertado. Esquema concordante en los **4** sitios (schema.ts / 0005 / test-db.ts / e2e-server.mjs): comparados campo a campo, sin drift | ✅ |
| CA-3 (distinguir "sin datos aún" de "no se puede cotizar") | `zone-status.ts` (`failReason`); `vigiladas/page.tsx` | `quote-diagnostics.test.ts` › CA-3 + `e2e/diagnostico-cotizacion.spec.ts` › CA-3/CA-4 | Verificado en unit **y en navegador**. Los dos estados son distinguibles por `data-testid` distinto (`sin-datos-aun` vs `fail-reason`) y el e2e asserta la ausencia del otro (`toHaveCount(0)`) en ambos sentidos — no basta con que aparezca el propio | ✅ |
| CA-4 (visible en /vigiladas) | `vigiladas/page.tsx`; `globals.css` (`.quote-fail`/`.quote-pending`) | `quote-diagnostics.test.ts` › CA-4 + e2e › CA-3/CA-4 (`data-reason`, screenshot) | Verificado en navegador (Playwright, 17/17). El estado de zona sigue `none` (RN-11/SPEC-007 intacto) y el motivo lo acompaña sin sustituirlo. Captura: `vigiladas-motivo.png` | ✅ |
| CA-5 (visible en /cartera junto al "—") | `cartera/page.tsx`; `market/quotes.ts` (`getDiagnosticMap`) | `quote-diagnostics.test.ts` › CA-5/CA-6 + e2e › CA-5/CA-6 (screenshot) | Verificado en navegador. El e2e asserta el "—" **y** el motivo a la vez: el guion no se sustituye por el motivo. Captura: `cartera-motivo.png` | ✅ |
| CA-6 (RN-06 intacto) | sin cambios en `portfolio/position.ts` ni `service.ts` | `quote-diagnostics.test.ts` › CA-5/CA-6 (plActual null, actualTotal null, realizado aparte) | Verificado por lectura y por test. `git diff` confirma **cero cambios** en `portfolio/`: el motivo es DECORACIÓN (`{dash(p.plActual)}` y aparte el `<span>`), no un dato que entre en el cálculo. `plActual`/`actualTotal` null y `realizadoPL` '0.00' sin contaminar (D-6) | ✅ |
| CA-7 (la resiliencia no se rompe) | `refresh.ts` (se salta y sigue) | `quote-diagnostics.test.ts` › CA-7; `market-refresh.test.ts` › CA-6 (SPEC-004) sigue verde | Verificado. **El test de SPEC-004 se REFORZÓ, no se relajó**: el `git diff` muestra que `toEqual(['AAPL'])` conserva la igualdad estricta de array (`.map(s => s.ticker)`) y **añade** `expect(skipped[0].reason).toBeTruthy()`. Suite completa 26 ficheros / 166 tests sin regresión | ✅ |
| CA-8 (el diagnóstico se limpia al resolverse) | `market/quotes.ts` (`clearDiagnostic`); `refresh.ts` | `quote-diagnostics.test.ts` › CA-8 (desaparece y la fila vuelve a la normalidad) | Verificado. `clearDiagnostic` se llama en el camino de éxito de `refresh.ts` (l. 89) y el test comprueba las dos caras: el diagnóstico desaparece **y** `state !== 'none'`. Sin fantasmas por esta vía (ver Observación 2) | ✅ |
| CA-9 (aislamiento RN-01) | `zone-status.ts` (filtra por `userId`) | `quote-diagnostics.test.ts` › CA-9 | Verificado. `zoneStatusForUser` parte `FROM watchedSymbols WHERE userId = ?`, así que el `leftJoin` de diagnóstico solo puede aflorar símbolos propios. Que la tabla sea compartida por símbolo NO filtra: en `/cartera`, `getDiagnosticMap` se resuelve en servidor (RSC) y solo se indexa por los tickers del propio usuario; el mapa no se serializa al cliente | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

### 🟢 GREEN — 2026-07-15 (sdd-verificador), 2ª vuelta, commit 705c733

**9/9 CA cerrados. El RED de la 1ª vuelta (F-SPEC-016-3) está arreglado y comprobado.**

Gates: `tsc` 0 · `eslint` 0 errores (1 warning preexistente ajeno) · `vitest` **26 ficheros /
168 tests** (eran 166: +2, cuadra con lo declarado) · `build` OK · `playwright` **17/17**.
Sin regresión.

**El arreglo hace lo que dice.** Extraje el adaptador **pre-arreglo** (`git show
516add6:src/lib/market/marketstack-provider.ts`) y le pasé el mismo caso que el test nuevo, para
comprobar que el test no es de adorno. Fallo 403 en el segundo de dos mercados:

| | `quotes` | `failures` |
|---|---|---|
| **pre-arreglo** | `[SAN:BMEX]` | `[SAN:BMEX=mercado_no_cubierto, SAN:XNYS=simbolo_desconocido]` |
| **arreglado** | `[SAN:BMEX]` | `[SAN:XNYS=mercado_no_cubierto]` |

La fila de arriba es exactamente el defecto: `SAN:BMEX` cotiza a 11,984 € **y** sale como fallido,
y el 403 que era de XNYS acaba colgado de BMEX mientras XNYS hereda un `simbolo_desconocido` que
no le toca. Abajo, resuelto: `quotes` y `failures` disjuntos y cada motivo en su mercado. **Los 2
tests nuevos cazan el bug de verdad** (aserto `toEqual` estricto sobre `quotes` y `failures`, con
el fallo en el SEGUNDO pedido, que es el orden que lo destapa; 404 y 403).

**Alcance respetado.** `git diff 516add6..705c733` toca solo `marketstack-provider.ts` (+33) y
`tests/quote-diagnostics.test.ts` (+43), más ledger/spec/tablero. **`refresh.ts` y `provider.ts`
sin tocar**, como pedía el apartado "Qué NO hay que tocar". Ninguna mejora colada.

**El borde sin test, juzgado (lo probé yo).** El implementador pedía criterio sobre la fila de
error **sin MIC parseable**. Ya no está sin probar — lo ejercité:
- **Un solo mercado** → `failures=[ITX:BMEX=mercado_no_cubierto]`: el motivo real **se conserva**.
  La ambigüedad no existe y no se degrada nada. Correcto.
- **Dos mercados (ambiguo)** → pre-arreglo: `[SAN:BMEX=mercado_no_cubierto, SAN:XNYS=simbolo_desconocido]`
  (**adivina, y adivina mal**). Arreglado: `[SAN:BMEX=simbolo_desconocido, SAN:XNYS=simbolo_desconocido]`.

Veredicto sobre el borde: **aceptable**. Es estrictamente mejor que antes (deja de adivinar),
es coherente con ADR-012 ("no se adivina"), **CE-F2 se mantiene** (ningún símbolo desaparece: los
dos salen reportados) y solo se alcanza si Marketstack dejara de hacer eco del símbolo pedido —
contradiciendo el comportamiento verificado el 2026-07-15 y el fixture real de CA-1. Matiz honesto
que dejo anotado: en ese caso el motivo no se "calla" (como dice el handoff), sino que se degrada
a `simbolo_desconocido`, que es una afirmación distinta —"puede estar deslistado"— y no una
ausencia. Es impreciso, no falso-dirigido, e inalcanzable con el proveedor real → **F-SPEC-016-7**,
no bloqueante.

**Salvedades F-SPEC-016-1 y F-SPEC-016-2**: ratificadas legítimas (1ª vuelta). **F-SPEC-016-4/5/6**:
mis 3 observaciones no bloqueantes, correctamente registradas con destino EPIC-MEJORA.

**Cierra la ⚠️ de CA-10 de SPEC-015**: los símbolos sin operating MIC canónico (incl. legacy con
`micCode` null) ya no dejan de cotizarse en silencio — emiten `sin_identidad_de_mercado` desde el
adaptador real (`market-operating-mic.test.ts:183`) y se ve en `/vigiladas`. Con ello **EPIC-FIX
cumple CE-F2**.

---

### 🔴 RED — 2026-07-15 (sdd-verificador), 1ª vuelta, commit 1d901ab
<!-- Se conserva por trazabilidad: qué se devolvió y qué lo cerró. -->

> Cerrado por el commit `705c733`. El finding único (F-SPEC-016-3) está arreglado y verificado
> arriba; los 8 CA restantes ya se cerraron en esta vuelta y no se re-verificaron de cero.

**8 de 9 CA cerrados con evidencia sólida. CA-1 ⚠️ por un defecto REPRODUCIDO en el adaptador.**

Gates todos en verde: `tsc --noEmit` 0 · `eslint` 0 errores (1 warning **preexistente**,
confirmado: `LedgerEntry` en `tests/position.test.ts` viene del commit `2059d48` de 2026-07-14,
SPEC-002 — no es de esta spec) · `vitest` **26 ficheros / 166 tests** · `build` OK ·
`playwright` **17/17** (incluidos los 2 nuevos de SPEC-016).

La calidad general es alta y las tres decisiones de diseño del implementador se sostienen bajo
auditoría: el cambio de contrato del puerto está **explícitamente autorizado** por ADR-012 pto. 6
("*`getQuotes` pasa a poder informar, por símbolo, por qué no hubo precio… El detalle de forma y
de UI lo fija SPEC-016*") y **no se ha excedido**: `git diff` confirma cero cambios en `portfolio/`,
disparos y avisos. La tabla propia está bien justificada (un símbolo nunca cotizado no tiene fila
en `quotes`). Y `refresh.ts:80` (`failed.get(key) ?? 'proveedor_no_disponible'`) es un acierto:
hace **estructuralmente imposible** saltarse un símbolo sin motivo, que es justo CE-F2.

#### F-SPEC-016-3 — `MarketstackProvider` atribuye el fallo al MERCADO EQUIVOCADO (bloqueante)

`marketstack-provider.ts:112` empareja la fila de error **solo por ticker**:

```js
const [t] = String(row.symbol ?? '').split('.');   // descarta el MIC que acaba de parsear
const req = askable.find((r) => r.ticker === t);   // ← devuelve el PRIMER SAN, sea cual sea su mercado
```

El camino de ÉXITO (l. 124) sí empareja por `ticker` **y** `micCode`. La incoherencia dentro de la
misma función indica descuido, no decisión.

**Reproducido** (sonda sobre el adaptador REAL, no un fake — mismo ticker en dos mercados, que es
el escenario que ADR-012 usa como ejemplo estrella: `SAN.BMEX` 11,984 € vs `SAN.XNYS` 13,63 $):

- Petición: `[{SAN,BMEX}, {SAN,XNYS}]` · Respuesta: `SAN.XNYS` error 404 + `SAN.BMEX` close 11.984
- **Obtenido**: `quotes=[SAN:BMEX 11.984]` y `failures=[{SAN:BMEX simbolo_desconocido}, {SAN:XNYS simbolo_desconocido}]`
- **Esperado**: `failures=[{SAN:XNYS simbolo_desconocido}]`

Dos consecuencias:
1. **Se viola el invariante de `QuotesResult`**: `SAN:BMEX` sale a la vez en `quotes` y en
   `failures` — "resuelto" y "no resuelto" al mismo tiempo. Hoy `refresh.ts` lo tolera **por
   suerte** (consulta `returned` antes que `failed`), no por diseño; cualquier consumidor futuro
   que recorra `failures` (p. ej. el alerting al operador que la spec deja para EPIC-MEJORA)
   daría por fallido un símbolo que cotizó bien.
2. **El motivo puede ser FALSO**: si el que falla es el mercado no cubierto (403) y no es el
   primero de la lista, el usuario lee *"El proveedor no reconoce este símbolo (puede estar
   deslistado)"* cuando la verdad es *"no cubre este mercado"*. En la spec cuyo producto **es**
   el motivo, un motivo mentiroso es el defecto que la spec vino a matar, reaparecido un nivel
   más abajo.

**Por qué es bloqueante y no salvedad**: el disparador no es hipotético. "El mismo ticker en dos
mercados" es escenario de dominio de primera clase, ya modelado y probado
(`tests/market-mic-code.test.ts:35`, un usuario vigilando `SAN@BMEX` y `SAN@XNYS` a la vez), y es
la razón de ser de ADR-007. Ese test solo pasa hoy porque inyecta el **fake**, que sí empareja por
`quoteKey` completo; el adaptador real no. Y el arreglo es de una línea. Una salvedad se acepta
cuando es cara o estructural — no cuando es un `find` al que le falta un `&&`.

**Arreglo propuesto** (lo decide el implementador): emparejar por identidad completa, aprovechando
el MIC que la fila de error **ya trae** (`symbol: "SAN.BMEX"`), y traducirlo con el
`fromProviderMic` que ya existe. Lo que no case por MIC debe caer al barrido final de `pedidos`,
que ya cubre "pedido sin respuesta". Añadir el test que falta: mismo ticker en dos mercados contra
`MarketstackProvider`, con el fallo en el **segundo** de los pedidos.

#### Sobre las salvedades declaradas por el implementador

- **F-SPEC-016-1** (el e2e siembra `quote_diagnostics` por SQL en vez de correr el ciclo):
  **legítima, y basta para CA-4/CA-5**. Esos CA hablan de *lo que el usuario ve dado un
  diagnóstico*, y eso se prueba en navegador de punta a punta. El tramo ciclo→BD que el e2e se
  salta está cubierto en unit con el adaptador real (`market-operating-mic.test.ts:183`,
  `quote-diagnostics.test.ts` CA-2). No es un hueco encubierto: es reparto de responsabilidades
  entre niveles. Se mantiene como mejora.
- **F-SPEC-016-2** (`proveedor_no_disponible` sin test propio): **legítima**, riesgo bajo — es el
  `default` de `classify()` y además el fallback de `refresh.ts:80`, ambos ejercitados de refilón.

#### Observaciones (no bloquean)

1. `getDiagnosticMap` trae los diagnósticos de **todos** los símbolos del sistema para luego usar
   solo los del usuario. No filtra nada al cliente (RSC, ver CA-9), pero es trabajo de más que
   crecerá con la base de símbolos. Candidato a EPIC-MEJORA.
2. Un símbolo que sale del universo (se deja de vigilar) conserva su fila de diagnóstico; si se
   vuelve a vigilar antes del siguiente ciclo, se muestra el motivo del intento anterior. Es
   información cierta y fechada (`attemptedAt`), y CA-8 solo exige la limpieza vía ciclo → fuera
   de alcance, pero conviene tenerlo presente.
3. La UI no muestra `attemptedAt` aunque se persiste (CA-2 solo exige persistirlo, CA-4 no lo
   pide). Con el motivo ya visible, enseñar "intentado el X" reforzaría D-2. Mejora, no defecto.

#### Qué NO hay que tocar al arreglar

Los 8 CA restantes están cerrados con evidencia; el arreglo debe limitarse a
`marketstack-provider.ts` + su test. En particular, **no** hay que retocar `refresh.ts:80` ni el
contrato de `QuotesResult`: son correctos.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-016/. Informe HTML opcional: _qa/SPEC-016/informe.html -->

| CA | Captura | Qué demuestra |
|---|---|---|
| CA-3 / CA-4 | `_qa/SPEC-016/vigiladas-motivo.png` | `/vigiladas`: el motivo (`data-reason=mercado_no_cubierto`) acompaña al estado de zona, que sigue "Sin cotización" (RN-11). Distinguible de "aún sin datos" |
| CA-5 / CA-6 | `_qa/SPEC-016/cartera-motivo.png` | `/cartera`: el P/L actual sigue "—" (RN-06) **con** el motivo al lado — el guion deja de ser mudo sin inventar dato |

## Decisiones de diseño (la spec dejaba la forma abierta)

**1. El puerto cambia de contrato: `getQuotes` devuelve `QuotesResult`, no `ProviderQuote[]`.**
El motivo tenía que cruzar el puerto o CA-1 era imposible. Alternativa descartada: meter un
`error` dentro de `ProviderQuote` — obligaría a todo consumidor a comprobar si cada "cotización"
es en realidad un fallo, y ensucia el tipo que el dominio usa para calcular. Con `{quotes, failures}`
el que solo quiere precios sigue leyendo `quotes` y nada más. Afecta a los 3 adaptadores
(`marketstack`, `fake`, `twelve-data`) — los tres actualizados; `twelve-data-provider` sigue sin
uso para cotizaciones (ADR-012) pero se mantuvo compilando y con su test verde.

**2. Motivos del dominio, no texto del proveedor** (`QuoteFailureReason`, 4 categorías). El
adaptador TRADUCE (`classify()` en `marketstack-provider.ts`) igual que traduce el dialecto de MIC
(ADR-012): "**symbol** ITX is not available with your plan" es vocabulario de Marketstack, no de
Stockeiro. Si mañana se cambia de proveedor, la UI no se entera. El test CA-1 usa la respuesta
**real** del free tier (verificada 2026-07-15) como fixture, no una inventada.

**3. Tabla propia `quote_diagnostics`, no una columna en `quotes`.** Determinante: el caso que
más duele —el símbolo que NUNCA se ha podido cotizar— no tiene fila en `quotes`. Una columna
exigiría insertar filas de cotización sin cotización (`price` null), y eso rompería a todo el que
lee `quotes` dando por hecho que hay precio (RN-06 se defiende hoy por ausencia de fila). Tabla
aparte = `quotes` intacta y el diagnóstico se borra con `clearDiagnostic` sin tocar precios.
Compartida por símbolo (no por usuario): el motivo no depende de quién mire (igual que `quotes`).

**4. Esquema en los 3 sitios**: `src/db/schema.ts` + migración `0005_quote_diagnostics` +
`src/db/test-db.ts` + `tests/e2e/server.mjs`. Los tres llevan el esquema en paralelo.

## Salvedades / follow-ups
<!-- IDs F-SPEC-016-1, F-SPEC-016-2… con destino (spec futura o EPIC-MEJORA). -->

- **Cierra la ⚠️ de CA-10 de SPEC-015.** El verificador la marcó parcial porque los símbolos sin
  operating MIC canónico dejaban de cotizarse **en silencio**, y difirió la visibilidad aquí. Con
  esta spec, ese caso emite `sin_identidad_de_mercado` y se ve en `/vigiladas` (CA-4). Es la
  razón por la que SPEC-016 no era opcional para CE-F2.
- **F-SPEC-016-1** — El E2E siembra `quote_diagnostics` por SQL directo (`sembrarDiagnostico`) en
  vez de hacer correr el ciclo real contra el fake. Prueba lo que le toca (que la UI lo pinta y lo
  distingue), pero el camino ciclo→BD→UI completo solo está cubierto en unit. `E2E_FAILURES` ya
  existe en `quote-provider-factory.ts` para hacerlo end-to-end si se añade un disparo del cron
  desde el E2E. Destino: EPIC-MEJORA.
- **F-SPEC-016-2** — `proveedor_no_disponible` (caída/5xx del proveedor) no tiene test propio: es
  el `default` de `classify()` y se cubre por descarte. Los otros 3 motivos sí tienen aserto
  directo. Destino: EPIC-MEJORA.
- **No cierra F-ADR-012-2 ni F-SPEC-015-1**: siguen abiertas y son de despliegue/verificación de
  dialectos, ajenas a esta spec.
  - **Actualización 2026-08-11**: F-ADR-012-2 resultó estar ya cerrada (la clave sí estaba en
    Vercel). F-SPEC-015-1 escondía un defecto real —`XNAS`/`XNYS` se piden mal— que arregla
    **SPEC-020**. Y una ironía que conviene no olvidar: **este diagnóstico estuvo 27 días sin
    desplegarse**, así que el usuario siguió viendo "sin cotización" mudo, exactamente el
    silencio que esta spec vino a matar. La spec estaba `hecho`; el producto, no.
- **F-SPEC-016-3 — ARREGLADO** (2ª vuelta, tras el RED del verificador). El emparejado de la fila
  de error se hacía **solo por ticker**, así que con el mismo ticker en dos mercados el motivo
  acababa en el mercado equivocado y el símbolo que sí cotizaba salía además como fallido. Ahora
  `matchRequest()` empareja por **identidad completa** (ticker + operating MIC), aprovechando que
  Marketstack hace eco del símbolo pedido (`SAN.BMEX`). El acierto del verificador: el camino de
  éxito ya lo hacía bien: era una incoherencia dentro de la misma función.
  Decisión propia sobre el borde que no cubría el finding: si la fila de error **no trae MIC
  parseable**, se empareja solo cuando hay **un único** pedido con ese ticker; con dos mercados
  **no se adivina** (ADR-012) y cae al barrido final de `pedidos`, donde igualmente se reporta —
  antes callar el motivo exacto que colgárselo al mercado que no es. Tests nuevos: los 2 casos de
  CA-1 con el fallo en el **segundo** pedido (el orden que destapa el bug), uno con 404 y otro con
  403 — este último es donde el motivo salía mentiroso.
- **F-SPEC-016-4** — `getDiagnosticMap` trae los diagnósticos de **todos** los símbolos del sistema
  para usar solo los del usuario. No filtra nada al cliente (se resuelve en RSC, el verificador lo
  confirmó en CA-9), pero es trabajo que crece con la base de símbolos. Destino: EPIC-MEJORA.
- **F-SPEC-016-5** — Un símbolo que sale del universo (se deja de vigilar) conserva su fila de
  diagnóstico; si se vuelve a vigilar antes del siguiente ciclo, se ve el motivo del intento
  anterior. Es información cierta y fechada (`attemptedAt`), y CA-8 solo exige la limpieza vía
  ciclo. Destino: EPIC-MEJORA.
- **F-SPEC-016-6** — La UI no muestra `attemptedAt` aunque se persiste (CA-2 solo exige
  persistirlo). Con el motivo ya visible, enseñar "intentado el X" reforzaría D-2.
  Destino: EPIC-MEJORA.
- **F-SPEC-016-7** *(abierto por sdd-verificador, 2ª vuelta)* — Cuando una fila de error no se
  puede atribuir a un pedido concreto (sin MIC parseable **y** con el mismo ticker en dos
  mercados), el símbolo cae al barrido de `pedidos` y se reporta como `simbolo_desconocido` — que
  no es "sin motivo", sino un motivo distinto ("puede estar deslistado") del real. Se ACEPTA: no
  se adivina (ADR-012), CE-F2 se mantiene (el símbolo se reporta) y el camino solo se alcanza si
  Marketstack dejara de hacer eco del símbolo pedido, contra lo verificado el 2026-07-15. Si
  alguna vez se alcanza, `proveedor_no_disponible` sería más honesto que `simbolo_desconocido`.
  Destino: EPIC-MEJORA.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**2ª vuelta: el RED del verificador (F-SPEC-016-3) está ARREGLADO.** El cambio se limitó a lo que
pedía el veredicto: `marketstack-provider.ts` (nuevo `matchRequest`, emparejado por identidad
completa) + 2 tests nuevos en CA-1. **No se tocó** `refresh.ts:80` ni el contrato de
`QuotesResult`: el verificador los juzgó correctos.

**Implementación COMPLETA y verde.** Gates en local: `npx tsc --noEmit` 0 errores · `npx eslint`
0 errores (1 warning **preexistente**: `LedgerEntry` sin usar en `tests/position.test.ts`, del
commit `2059d48` de SPEC-002 — no es de esta spec) · `npx vitest run` 26 ficheros / 168 tests ·
`npm run build` OK · `npx playwright test` 17/17.

Qué falta: **sdd-verificador** (columnas Verif./Estado del ledger + veredicto), push y PR. No
fusionado. Capturas del E2E en `_qa/SPEC-016/` (`vigiladas-motivo.png`, `cartera-motivo.png`).

Tests: `tests/quote-diagnostics.test.ts` (CA-1..CA-9, **11 casos**) y
`tests/e2e/diagnostico-cotizacion.spec.ts` (2 tests: CA-3/CA-4 en vigiladas, CA-5/CA-6 en cartera).

Puntos de atención para quien verifique:
1. `refresh.ts` cambió `RefreshResult.skipped` de `string[]` a `SkippedSymbol[]`.
   `tests/market-refresh.test.ts` › CA-6 (SPEC-004, resiliencia) se ajustó a la nueva forma
   **añadiendo** el aserto del motivo — se reforzó, no se relajó para que pasara.
2. El arreglo de F-SPEC-016-3 introduce un borde que el finding no cubría: fila de error **sin MIC
   parseable**. Se resuelve emparejando solo si no hay ambigüedad (un único pedido con ese
   ticker); con dos mercados no se adivina y cae al barrido de `pedidos`. Está en el código, no
   tiene test propio (Marketstack siempre hace eco del símbolo pedido, verificado 2026-07-15) —
   júzgalo.
