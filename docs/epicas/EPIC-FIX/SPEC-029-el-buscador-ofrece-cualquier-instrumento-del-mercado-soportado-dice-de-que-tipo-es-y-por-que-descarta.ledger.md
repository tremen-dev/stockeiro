---
id: SPEC-029
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-029 El buscador ofrece cualquier instrumento del mercado soportado, dice de qué tipo es y por qué descarta

## Resumen
- Fase: hecho <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-029-el-buscador-ofrece-cualquier-instrumento-del-mercado-soportado`
- Base: `origin/main` @ `83ebdb8`, con SPEC-030 ya implementada y verificada encima.
- Commits: `be6100c` (dominio, puerto, esquema y UI) · `6fe8f7c` (e2e).
- Migración nueva: `drizzle/0008_puzzling_eddie_brock.sql` (`ALTER TABLE symbols ADD COLUMN instrument_type text`).

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (REIT se encuentra) | `src/lib/market/twelve-data-search-provider.ts` (sin filtro de tipo), `src/lib/market/search.ts` (borrado `m.type === 'stock'`) | `tests/symbol-search.test.ts` › «CA-1: un REIT se encuentra y se puede elegir» (2 casos, fixture real de `/symbol_search` 2026-08-18) | Verificado. `tests/symbol-search.test.ts` (24 casos) verde. **Sondeo del proveedor REAL 2026-08-18**: `/symbol_search?symbol=orchid island capital` devuelve `ORC` / `XNYS` / `REIT` / `USD` — el fixture es fiel a la realidad de hoy. **Navegador contra el adaptador REAL** (sin catálogo fake): «orchid island capital» en `/vigiladas` ofrece `ORC · Orchid Island Capital Inc. · NYSE · REIT · USD`, seleccionable. Antes decía «Sin resultados». | ✅ |
| CA-2 (ADR se encuentra) | ídem + `toOperatingMic` (`XNGS`→`XNAS`) | `tests/symbol-search.test.ts` › «CA-2: un ADR se encuentra y se puede elegir» | Verificado. Sondeo real: `LX` / `XNGS` / `American Depositary Receipt` / `USD`. **Navegador contra el adaptador real**: «lexinfintech» ofrece `LX · NASDAQ · ADR · USD` — segmento `XNGS` normalizado a `XNAS` (ADR-012) y presentado como NASDAQ. | ✅ |
| CA-3 (no regresión: acción común) | ídem | `tests/symbol-search.test.ts` › «CA-3: no hay regresión — la acción común sigue pasando» | Verificado. Test verde; `UPWK`@`XNAS`/USD intacto. Ninguna suite previa regresa: 424/424 en 37 ficheros. | ✅ |
| CA-4 (ETF entra, y es querido) | ídem | `tests/symbol-search.test.ts` › «CA-4…» (2 casos) + e2e `tests/e2e/buscador-instrumentos.spec.ts` CA-12 (IWDA) | Verificado. Unit + e2e verdes. La inversión de CA-2 de SPEC-008 está anotada dentro del propio test como decisión de ADR-020, no colada. | ✅ |
| CA-5 (ninguna capa filtra por tipo) | `search.ts`, `twelve-data-search-provider.ts` | `tests/symbol-search.test.ts` › «CA-5: ninguna capa filtra por tipo — el defecto no puede volver» (3 casos: etiqueta inventada en adaptador, en dominio, y cripto/ETF juzgadas solo por mercado) | Verificado por inspección adversarial, no solo por test. `grep` sobre `src/` y `tests/`: **no queda ninguna comparación con 'stock'** (solo menciones en comentarios históricos), ni `Set`/array/`includes` de tipos permitidos en adaptador, dominio o UI. El mapa `KNOWN` de `instrument-type-text.ts` no es lista blanca: su `default` es la etiqueta cruda. Etiquetas inventadas (`Closed-End Fund`, `Zzz Instrumento Que Nadie Ha Previsto`) atraviesan adaptador, dominio, persistencia y pantalla. | ✅ |
| CA-6 (tipo íntegro, sin normalizar) | `src/lib/market/search-provider.ts` (`SymbolMatch.instrumentType`), `twelve-data-search-provider.ts` | `tests/symbol-search.test.ts` › «CA-6…» (2 casos, incluye fila sin `instrument_type` → vacío y NO descartada) | Verificado. La etiqueta viaja íntegra (`REIT`, `American Depositary Receipt`, `Common Stock`, `ETF`); fila sin `instrument_type` deja el campo vacío y **no** se descarta. Comprobado además en base tras el alta real: `symbols.instrument_type = 'REIT'`. | ✅ |
| CA-7 (descarte por mercado, con su mercado) | `twelve-data-search-provider.ts` (`discarded.push`), `search-provider.ts` (`DiscardedSymbol`) | `tests/symbol-search.test.ts` › «CA-7…» (2 casos, el segundo asserta la DISJUNCIÓN estricta de `matches`/`discarded`) + `tests/market-operating-mic.test.ts` CA-3 (el `ZZZ`@`XXXX` que se omitía ahora se reporta) | Verificado. El descarte lleva `micCode`/`exchange` crudos y motivo `mercado_no_soportado`. **La disjunción se prueba con igualdad de conjuntos** (`tests/symbol-search.test.ts:227-235`: los dos `map(ticker)` con `toEqual` de array completo, más intersección vacía explícita), no con un `length`. Lección de F-SPEC-016-3 aplicada. | ✅ |
| CA-8 (descarte sin identidad de mercado) | `twelve-data-search-provider.ts` | `tests/symbol-search.test.ts` › «CA-8…» (2 casos: motivo propio y los dos motivos conviviendo) | Verificado. Fila sin `mic_code` va a descartes con `sin_identidad_de_mercado`; los dos motivos conviven en la misma respuesta, cada fila con el suyo. | ✅ |
| CA-9 (tres desenlaces distinguibles) | `src/lib/market/search.ts` (`SymbolSearchOutcome` con `results` + `discarded`) | `tests/symbol-search.test.ts` › «CA-9: tres desenlaces distinguibles en el resultado del dominio» (4 casos) | Verificado en dominio (4 casos) y **en navegador contra el proveedor real**: los tres desenlaces se distinguen de verdad — «reliance industries» (todo descartado), «zzzzznoexisteestevalor» (no existe), «banco santander» (candidatos). | ✅ |
| CA-10 (texto de usuario: por qué no hay resultados) | `src/lib/market/search-discard-text.ts` (nuevo), `src/app/_components/symbol-search.tsx` (`data-testid` `search-empty` / `search-discarded` / `search-error`) | `tests/symbol-presentation.test.ts` › «CA-10…» (2 casos, con aserto negativo) + e2e `buscador-instrumentos.spec.ts` › CA-10 (cada estado asserta la AUSENCIA del otro) | Verificado, aserto negativo incluido. Dos `data-testid` distintos (`search-empty` / `search-discarded`) y cada test asserta la **ausencia** del otro. **Tensión CA-7 vs CA-10 dirimida por el verificador a favor de la lectura del implementador**: CA-7 exige el `mic_code` crudo «para poder decirle al usuario qué mercado es», CA-14 exige el MIC fuera de los 7 «en crudo» y la nota 3 exige el tipo desconocido en crudo; luego «texto crudo del proveedor» en CA-10 solo puede referirse a su **prosa/motivo**, que es justo lo que suprimía SPEC-016 CA-1. Bajo esa lectura queda cumplido: el motivo es vocabulario cerrado del dominio y el e2e asserta que `mic_code`, `instrument_type` y `Common Stock` no aparecen en la UI del descarte. | ✅ |
| CA-11 (traducción del tipo) | `src/lib/market/instrument-type-text.ts` (nuevo) | `tests/symbol-presentation.test.ts` › «CA-11…» (4 casos: conocido, caja/espacios, desconocido en crudo, vacío) | Verificado (10 casos). Conocido→dominio; caja y espacios tolerados; desconocido **en crudo**, con aserto `not.toMatch(/otro/i)`; vacío→cadena vacía. En pantalla la celda queda realmente vacía, sin «—» ni hueco. | ✅ |
| CA-12 (el tipo se ve en el buscador) | `src/app/_components/symbol-search.tsx` (`result-type`, `chip-type`) | e2e `buscador-instrumentos.spec.ts` › CA-12 (ORC→REIT, LX→ADR, UPWK→Acción, IWDA→ETF) | Verificado en navegador **contra el proveedor real**: ORC→REIT, LX→ADR, SAN@BMEX→Acción, SAN@XNYS→ADR, cada uno junto a su mercado y su divisa, antes de elegirlo. | ✅ |
| CA-13 (el tipo se ve en la tabla) | `src/lib/watchlist/zone-status.ts` (+`instrumentType`), `src/app/vigiladas/page.tsx` (columna «Tipo», `row-type`) | `tests/symbol-instrument-type.test.ts` › «CA-13…» + e2e `buscador-instrumentos.spec.ts` › CA-13/CA-14/CA-18 | Verificado. Columna «Tipo» alimentada desde `zone-status.ts`. Visto en navegador con datos reales: `ORC · REIT`, `SAN · Acción`, `SAN · ADR`. | ✅ |
| CA-14 (el mercado se ve; dos filas del mismo ticker se distinguen) | `src/lib/market/market-name.ts` (nuevo, mapa total tipado `Record<OperatingMic, string>`), `zone-status.ts` (+`micCode`), `vigiladas/page.tsx` (columna «Mercado», `row-market`), `symbol-search.tsx` (l. 99/147 dejan de pintar `exchange \|\| micCode`) | `tests/symbol-presentation.test.ts` › «CA-14: el mapa … es TOTAL» (4 casos: exhaustividad contra `OPERATING_MICS`, los 7 nombres, NULL→vacío, MIC fuera de los 7 en crudo) + `tests/symbol-instrument-type.test.ts` › «CA-14: dos filas del MISMO ticker…» y «CA-14: el mercado sale de `micCode`, NO de `exchange`» + e2e | Verificado, y es el CA mejor probado. Mapa **total tipado** `Record<OperatingMic,string>` más test de exhaustividad contra `OPERATING_MICS`; los tres bordes cubiertos (NULL→vacío, MIC fuera de los 7→crudo, los 7→nombre). Sale de `micCode` y no de `exchange`, con un test que lo fuerza (dos símbolos del mismo MIC con `exchange` distinto rotulan igual). **Coherencia buscador↔tabla confirmada de verdad**: el e2e captura `[data-testid=result-market]` del DOM y lo compara con `[data-testid=row-market]` (`tests/e2e/buscador-instrumentos.spec.ts:97,111`), no hardcodea. En navegador con datos reales, dos filas `SAN` distinguibles solo por esa celda (BME vs NYSE). **F-SPEC-024-1 cerrado.** | ✅ |
| CA-15 (el tipo se persiste; los legacy no rompen) | `src/db/schema.ts` (`instrumentType` nullable), `drizzle/0008_puzzling_eddie_brock.sql`, `src/lib/portfolio/symbols.ts` (`SymbolMarket.instrumentType`), `src/lib/market/symbol-selection.ts` (campo oculto) | `tests/symbol-instrument-type.test.ts` › «CA-15: el tipo viaja del buscador al símbolo persistido» (4 casos) y «CA-15: las tres combinaciones que existen de verdad en la base…» + `tests/schema-source.test.ts` CA-6 (guardia de migración, con su canario de SPEC-027) | Verificado. Migración `drizzle/0008_puzzling_eddie_brock.sql` **generada, no escrita a mano**: el `prevId` del snapshot 0008 encadena con el `id` del 0007, `_journal` coherente y el diff de snapshots toca **solo** `public.symbols`. Es **aditiva y nullable** (`ALTER TABLE symbols ADD COLUMN instrument_type text`), compatible hacia atrás con la base compartida Production/Preview (F-SPEC-023-1). `tests/schema-source.test.ts` CA-6 verde **con su canario de SPEC-027** («la guardia sabe detectar»). Aplicada desde cero sobre un Postgres real da `instrument_type text NULL`. Las tres combinaciones comprobadas **en navegador**: con tipo y mercado (ORC), sin tipo y con mercado (celda Tipo vacía), legacy sin ninguno (las dos celdas vacías); la página no falla. | ✅ |
| CA-16 (el import sigue resolviendo, y ahora no-acciones) | `src/lib/import/identity.ts` (consume `.matches`; comentario de D-7 sustituido por ADR-020) | `tests/import-identity.test.ts` › «CA-9 (INVERTIDO por ADR-020 — SPEC-029 CA-16)» (2 casos) + la suite entera de `import-identity` en verde (25 casos) | Verificado. `tests/import-identity.test.ts` entero verde. CA-9 invertido **y anotado** como decisión de ADR-020. El filtro de mercado sigue operando (`IWDA` resuelto a `XAMS`). Nota de conteo: la suite tiene 15 casos, no los 25 que dice la columna «Test» — desliz de redacción, no fallo. | ✅ |
| CA-17 (sesión y resiliencia intactas) | `src/lib/market/search.ts` (`runSymbolSearch`) | `tests/symbol-search.test.ts` › «CA-17…» (4 casos; el último asserta que error / no-existe / todo-descartado son TRES estados distintos) | Verificado (4 casos). Sin sesión → `unauthorized` y el proveedor **no** se consulta (`calls` vacío). Fallo del proveedor → `error`. El último caso asserta con `not.toEqual` que error, no-existe y todo-descartado son tres resultados distintos. | ✅ |
| CA-18 (flujo real de punta a punta con un REIT) | todo lo anterior | e2e `buscador-instrumentos.spec.ts` › «CA-13/CA-14/CA-18…» (el mercado leído en el buscador se compara con el de la tabla, capturado del DOM, no hardcodeado) y › «CA-18: el mismo buscador en /cartera no regresa» | Verificado dos veces: e2e (35/35) y **a mano en navegador contra el proveedor real**. Buscar «orchid island capital», elegirlo, poner zonas 7–8 y guardar deja la fila `ORC · REIT · NYSE` sin pantalla de error, y el texto de mercado es literalmente el leído en el buscador. `/cartera` no regresa: el mismo buscador ofrece ahí `LX · NASDAQ · ADR · USD`. | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-18, sdd-verificador.** 18/18 CA cerrados. Ninguna salvedad bloqueante.

Gates corridos por el verificador en el worktree
`.claude/worktrees/fix-buscador-y-decimales` (`149bcb2`), no heredados del informe del
implementador:

| Gate | Comando | Salida |
|---|---|---|
| typecheck | `npm run typecheck` (`tsc --noEmit`) | exit 0, sin salida |
| lint | `npm run lint` (`eslint . --max-warnings=0`) | exit 0, 0 warnings |
| unit | `npm test` (`vitest run`) | **Test Files 37 passed (37) · Tests 424 passed (424)** · exit 0 |
| build | `npm run build` | `✓ Compiled successfully in 5.8s` · exit 0 |
| e2e | `npx playwright test --forbid-only` | **35 passed (1.4m)** · exit 0 |

`tests/ci-workflow.test.ts`: 25 casos verdes. `git diff 83ebdb8..HEAD -- .github/ package.json`
sale **vacío**: la spec no ha tocado el workflow ni el `package.json`, como exigía.

Lo que el verificador comprobó **además** de los tests, porque una spec que nace de un
defecto de producción no se cierra con la suite verde:

1. **Sondeo del proveedor REAL** (`/symbol_search`, clave del `.env`, 2026-08-18): `ORC`
   sigue siendo `XNYS`/`REIT`/`USD` y `LX` sigue siendo `XNGS`/`American Depositary
   Receipt`/`USD`. Los fixtures de los tests **no** se han quedado atrás.
2. **Flujo real en navegador contra el adaptador REAL de Twelve Data** —no contra el
   catálogo fake—, con Postgres efímero migrado desde `drizzle/`. Las dos búsquedas que
   reportó el humano encuentran su valor, con tipo y mercado, y se pueden vigilar. La
   fila queda `ORC | REIT | NYSE` y el símbolo se persiste con `instrument_type='REIT'`.
3. **Los tres desenlaces, en vivo**: «reliance industries» (todo descartado, 10 filas con
   su MIC nombrado), «zzzzznoexisteestevalor» (no existe), «banco santander» (candidatos).
4. **CA-14 con datos reales**: dos `SAN` vigilados —BMEX y XNYS— se distinguen en la tabla
   solo por las celdas nuevas (`Acción`/`BME` vs `ADR`/`NYSE`).
5. **Legacy en vivo**: sembrados en base un símbolo sin `micCode` ni tipo y otro con
   mercado y sin tipo; las celdas quedan **vacías** y la página no falla.
6. **CA-5 por inspección, no por confianza**: no sobrevive ninguna comparación con
   `'stock'` ni ninguna lista blanca de tipos en ninguna capa.
7. **SPEC-030 no se ha roto**: sus tests unitarios y sus 5 e2e siguen verdes dentro de las
   pasadas de arriba.

### Observaciones que NO bloquean (para el siguiente que pase por aquí)

- **Fila del proveedor sin `symbol`**: `twelve-data-search-provider.ts:62` la salta con un
  `continue` mudo — no entra en `matches` ni en `discarded`. Es el único hueco que queda en
  la exhaustividad, y es defendible (sin ticker no hay nada que nombrarle al usuario), pero
  la disjunción probada es «no está en las dos», no «está en alguna». Si algún día importa,
  merece su propio motivo.
- **Comentario desactualizado** en `src/app/_components/symbol-search-action.ts:10`: sigue
  diciendo «el comportamiento (auth, **filtrado a acciones**, resiliencia)». Ya no hay
  filtrado a acciones. Es prosa, no código; CA-16 sí actualizó el de `identity.ts`.
- **`getOrCreateSymbol` no rellena el tipo de un símbolo que ya existe**: solo lo escribe en
  el `INSERT`. El comentario de `src/db/schema.ts:73` (y el texto de la spec) dicen que los
  símbolos sin tipo «se rellenan solos cuando alguien vuelva a elegir ese valor en el
  buscador», y eso hoy **no** ocurre. Ningún CA lo pide —CA-15 habla del símbolo que *se
  crea*— y el backfill está explícitamente fuera de alcance (F-ADR-020-3), pero la promesa
  escrita no se cumple y conviene corregir el texto o el comportamiento.
- **F-SPEC-029-2 es real, no hipotético.** El ledger lo describe como «caso peor». Se
  reproduce con una búsqueda corriente: «reliance industries» contra el proveedor real
  pinta **10 descartes** con el mismo ticker repetido 5 veces (`RLI` en XFRA, XSTU, XWBO,
  XDUS, XMUN). No rompe CA-10 —cada línea nombra su mercado, y el desplegable tiene
  `max-height:280px; overflow-y:auto`, así que no desborda la página—, así que **no es un
  rojo**; pero es el comportamiento normal para cualquier valor extranjero no cubierto, no
  un extremo. Recomiendo subirle la prioridad en EPIC-MEJORA.
- **Sin CSS propio para lo nuevo**: `globals.css` no se ha tocado, así que `symbol-discards`
  se pinta con las viñetas y la sangría por defecto del navegador (visible en
  `_qa/SPEC-029/ca10-descartado-por-mercado.png` y en la captura del verificador). Se lee
  bien y es accionable, pero desentona con el resto de la pantalla y el proyecto se va a
  enseñar a testers. Pulido, no defecto.
- **Riesgo de despliegue ya enunciado por la spec (nota 6), confirmado por el verificador**:
  la `0008` se aplicará en el próximo despliegue MANUAL sobre la base buena. Es aditiva y
  nullable; el riesgo es el que la spec dice, ni más ni menos.

### Sobre la tensión CA-7 / CA-10

Dirimida **a favor de CA-7**, como propuso el implementador, y la razón queda escrita para
que no haya que rehacerla: la propia spec exige texto crudo del proveedor en pantalla en
tres sitios distintos (el `mic_code` del descarte en CA-7, el MIC fuera de los 7 en CA-14, la
etiqueta de tipo desconocida en la nota 3). Si «texto crudo del proveedor» de CA-10 se leyera
en su sentido más amplio, CA-10 contradiría a CA-7, CA-11 y CA-14 a la vez. La única lectura
coherente —y la que casa con el precedente que CA-10 cita, SPEC-016 CA-1, donde lo que se
suprimía era la **prosa de error** del proveedor— es la del **motivo**. Bajo esa lectura el
aserto negativo está implementado y probado, en unit y en e2e. **CA-10 no queda incumplido.**

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-029/. Informe HTML opcional: _qa/SPEC-029/informe.html -->

| CA | Captura |
|---|---|
| CA-12 | `_qa/SPEC-029/ca12-reit-en-el-buscador.png` |
| CA-10 (a) no existe | `_qa/SPEC-029/ca10-no-existe.png` |
| CA-10 (b) descartado | `_qa/SPEC-029/ca10-descartado-por-mercado.png` |
| CA-13/CA-14/CA-18 | `_qa/SPEC-029/ca18-reit-vigilado-con-tipo-y-mercado.png` |

Capturas del **verificador**, tomadas contra el **proveedor real de Twelve Data** (no contra
el catálogo fake), en la pasada manual del 2026-08-18:

| CA | Captura |
|---|---|
| CA-1/CA-2/CA-12 (el REIT reportado, con datos reales) | `_qa/SPEC-029/verif-ca1-ca12-proveedor-real-orc.jpg` |
| CA-7/CA-10 (descartes reales: «reliance industries», 10 MIC nombrados) | `_qa/SPEC-029/verif-ca7-ca10-descartes-proveedor-real.jpg` |
| CA-13/CA-14/CA-15 (tabla: ORC/REIT/NYSE, dos SAN distinguidos, legacy con celdas vacías) | `_qa/SPEC-029/verif-ca13-ca14-ca15-tabla-proveedor-real.jpg` |

Nota: las capturas de otras specs (`_qa/SPEC-003`, `_qa/SPEC-007`, `_qa/SPEC-016`,
`_qa/SPEC-024`, `_qa/SPEC-030`…) aparecen modificadas en el commit `6fe8f7c` porque
`/vigiladas` tiene dos columnas más. Se regeneraron al correr la suite e2e; ningún
comportamiento de esas specs cambia y sus tests siguen en verde.

## Gates (local, 2026-08-18)

| Gate | Comando | Resultado |
|---|---|---|
| typecheck | `npm run typecheck` | limpio |
| lint | `npm run lint` (`eslint . --max-warnings=0`) | limpio, 0 warnings |
| unit | `npm test` (`vitest run`) | **424 pasan / 37 ficheros** (388 antes de esta spec) |
| e2e | `npm run test:e2e -- --forbid-only` | **35 pasan** (30 antes de esta spec) |

`tests/ci-workflow.test.ts` sigue en verde: no se ha tocado `.github/workflows/ci.yml`
ni `package.json`.

## Salvedades / follow-ups
<!-- IDs F-SPEC-029-1, F-SPEC-029-2… con destino (spec futura o EPIC-MEJORA). -->

- **F-SPEC-029-1 — Ampliar los mercados soportados** (XLON, XMIL, XFRA, PINX…). Ya
  registrado por la spec como fuera de alcance. Esta spec solo hace que el descarte se
  VEA; añadir un MIC al buscador sin que Marketstack lo cotice movería el fallo
  silencioso un paso más allá. → spec propia, con dictamen de `sdd-mercados`.
- **F-SPEC-029-2 — La lista de descartes no está acotada ni deduplicada.** Descubierto
  al implementar CA-10, no especificado. La lista solo se pinta cuando NO hay ningún
  candidato, así que hoy el caso peor es una búsqueda muy genérica cuyas filas caigan
  todas fuera de los 7 mercados: el desplegable mostraría una fila por cada MIC no
  soportado, con el mismo ticker repetido. No rompe ningún CA (CA-10 pide nombrar el
  mercado de lo descartado, y eso se cumple) y no se ha tocado por no ampliar alcance a
  ojo. → EPIC-MEJORA: agrupar por ticker y/o cortar en N con un «y M más».
- **Nota, no salvedad — el nombre del valor descartado sí es texto del proveedor.** El
  aserto negativo de CA-10 se ha implementado sobre el MOTIVO (vocabulario cerrado del
  dominio, sin prosa ni códigos del proveedor) y sobre la ausencia de `instrument_type`
  en la UI del descarte. El `name` («Tesco PLC») y el `mic_code` («XLON») sí se pintan,
  porque CA-7 los pide explícitamente en `DiscardedSymbol` «para poder decirle al
  usuario *qué* mercado es»: sin ellos el mensaje no sería accionable. Se deja anotado
  por si el verificador lee el aserto negativo en su sentido más amplio.
- **Riesgo ya enunciado por la spec (nota 6), sin acción del implementador**: el próximo
  despliegue MANUAL a producción aplicará la `0008`. Es `ADD COLUMN` nullable, aditivo y
  compatible hacia atrás, pero es un `ALTER TABLE` sobre la base buena (`DATABASE_URL`
  compartida Production/Preview, F-SPEC-023-1).

## Cómo retomar (handoff)

Todo lo especificado está implementado y en verde en local; la spec está en
`en-revision` a la espera de `sdd-verificador`. No hay trabajo pendiente conocido.

- **Dónde mirar primero**: `src/lib/market/search-provider.ts` es el contrato nuevo
  (`{matches, discarded}`, `SymbolMatch.instrumentType`, `SearchDiscardReason`). Todo lo
  demás cuelga de ahí.
- **Los tres módulos de presentación nuevos** son hermanos de `fail-reason-text.ts`:
  `instrument-type-text.ts` (traduce lo conocido, muestra lo desconocido en crudo),
  `market-name.ts` (mapa TOTAL, traduce siempre) y `search-discard-text.ts`. Si algo
  parece incoherente entre los dos primeros, la regla que los une está escrita en la
  cabecera de `market-name.ts`.
- **Para correr los e2e hace falta `npm run build` antes**: `tests/e2e/server.mjs` lanza
  `next start`, no `next dev`, así que un `.next` viejo hace pasar/fallar cosas que no
  son. Se perdió media hora aquí.
- **Si `tests/schema-source.test.ts` CA-6 se pone rojo**, la respuesta es generar la
  migración con `npm run db:generate`, nunca tocar el arnés.
- **El catálogo E2E de `search-provider-factory.ts` está compartido** entre specs. Los
  cinco símbolos de SPEC-029 (`ORC`, `LX`, `UPWK`, `IWDA`, `TSCO`) están marcados como
  tales y no los usa nadie más; los 6 originales no se han tocado salvo por el
  renombrado `type` → `instrumentType` (`'stock'` → `'Common Stock'`).
