---
id: SPEC-029
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-029 El buscador ofrece cualquier instrumento del mercado soportado, dice de qué tipo es y por qué descarta

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
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
| CA-1 (REIT se encuentra) | `src/lib/market/twelve-data-search-provider.ts` (sin filtro de tipo), `src/lib/market/search.ts` (borrado `m.type === 'stock'`) | `tests/symbol-search.test.ts` › «CA-1: un REIT se encuentra y se puede elegir» (2 casos, fixture real de `/symbol_search` 2026-08-18) | | 🚧 |
| CA-2 (ADR se encuentra) | ídem + `toOperatingMic` (`XNGS`→`XNAS`) | `tests/symbol-search.test.ts` › «CA-2: un ADR se encuentra y se puede elegir» | | 🚧 |
| CA-3 (no regresión: acción común) | ídem | `tests/symbol-search.test.ts` › «CA-3: no hay regresión — la acción común sigue pasando» | | 🚧 |
| CA-4 (ETF entra, y es querido) | ídem | `tests/symbol-search.test.ts` › «CA-4…» (2 casos) + e2e `tests/e2e/buscador-instrumentos.spec.ts` CA-12 (IWDA) | | 🚧 |
| CA-5 (ninguna capa filtra por tipo) | `search.ts`, `twelve-data-search-provider.ts` | `tests/symbol-search.test.ts` › «CA-5: ninguna capa filtra por tipo — el defecto no puede volver» (3 casos: etiqueta inventada en adaptador, en dominio, y cripto/ETF juzgadas solo por mercado) | | 🚧 |
| CA-6 (tipo íntegro, sin normalizar) | `src/lib/market/search-provider.ts` (`SymbolMatch.instrumentType`), `twelve-data-search-provider.ts` | `tests/symbol-search.test.ts` › «CA-6…» (2 casos, incluye fila sin `instrument_type` → vacío y NO descartada) | | 🚧 |
| CA-7 (descarte por mercado, con su mercado) | `twelve-data-search-provider.ts` (`discarded.push`), `search-provider.ts` (`DiscardedSymbol`) | `tests/symbol-search.test.ts` › «CA-7…» (2 casos, el segundo asserta la DISJUNCIÓN estricta de `matches`/`discarded`) + `tests/market-operating-mic.test.ts` CA-3 (el `ZZZ`@`XXXX` que se omitía ahora se reporta) | | 🚧 |
| CA-8 (descarte sin identidad de mercado) | `twelve-data-search-provider.ts` | `tests/symbol-search.test.ts` › «CA-8…» (2 casos: motivo propio y los dos motivos conviviendo) | | 🚧 |
| CA-9 (tres desenlaces distinguibles) | `src/lib/market/search.ts` (`SymbolSearchOutcome` con `results` + `discarded`) | `tests/symbol-search.test.ts` › «CA-9: tres desenlaces distinguibles en el resultado del dominio» (4 casos) | | 🚧 |
| CA-10 (texto de usuario: por qué no hay resultados) | `src/lib/market/search-discard-text.ts` (nuevo), `src/app/_components/symbol-search.tsx` (`data-testid` `search-empty` / `search-discarded` / `search-error`) | `tests/symbol-presentation.test.ts` › «CA-10…» (2 casos, con aserto negativo) + e2e `buscador-instrumentos.spec.ts` › CA-10 (cada estado asserta la AUSENCIA del otro) | | 🚧 |
| CA-11 (traducción del tipo) | `src/lib/market/instrument-type-text.ts` (nuevo) | `tests/symbol-presentation.test.ts` › «CA-11…» (4 casos: conocido, caja/espacios, desconocido en crudo, vacío) | | 🚧 |
| CA-12 (el tipo se ve en el buscador) | `src/app/_components/symbol-search.tsx` (`result-type`, `chip-type`) | e2e `buscador-instrumentos.spec.ts` › CA-12 (ORC→REIT, LX→ADR, UPWK→Acción, IWDA→ETF) | | 🚧 |
| CA-13 (el tipo se ve en la tabla) | `src/lib/watchlist/zone-status.ts` (+`instrumentType`), `src/app/vigiladas/page.tsx` (columna «Tipo», `row-type`) | `tests/symbol-instrument-type.test.ts` › «CA-13…» + e2e `buscador-instrumentos.spec.ts` › CA-13/CA-14/CA-18 | | 🚧 |
| CA-14 (el mercado se ve; dos filas del mismo ticker se distinguen) | `src/lib/market/market-name.ts` (nuevo, mapa total tipado `Record<OperatingMic, string>`), `zone-status.ts` (+`micCode`), `vigiladas/page.tsx` (columna «Mercado», `row-market`), `symbol-search.tsx` (l. 99/147 dejan de pintar `exchange \|\| micCode`) | `tests/symbol-presentation.test.ts` › «CA-14: el mapa … es TOTAL» (4 casos: exhaustividad contra `OPERATING_MICS`, los 7 nombres, NULL→vacío, MIC fuera de los 7 en crudo) + `tests/symbol-instrument-type.test.ts` › «CA-14: dos filas del MISMO ticker…» y «CA-14: el mercado sale de `micCode`, NO de `exchange`» + e2e | | 🚧 |
| CA-15 (el tipo se persiste; los legacy no rompen) | `src/db/schema.ts` (`instrumentType` nullable), `drizzle/0008_puzzling_eddie_brock.sql`, `src/lib/portfolio/symbols.ts` (`SymbolMarket.instrumentType`), `src/lib/market/symbol-selection.ts` (campo oculto) | `tests/symbol-instrument-type.test.ts` › «CA-15: el tipo viaja del buscador al símbolo persistido» (4 casos) y «CA-15: las tres combinaciones que existen de verdad en la base…» + `tests/schema-source.test.ts` CA-6 (guardia de migración, con su canario de SPEC-027) | | 🚧 |
| CA-16 (el import sigue resolviendo, y ahora no-acciones) | `src/lib/import/identity.ts` (consume `.matches`; comentario de D-7 sustituido por ADR-020) | `tests/import-identity.test.ts` › «CA-9 (INVERTIDO por ADR-020 — SPEC-029 CA-16)» (2 casos) + la suite entera de `import-identity` en verde (25 casos) | | 🚧 |
| CA-17 (sesión y resiliencia intactas) | `src/lib/market/search.ts` (`runSymbolSearch`) | `tests/symbol-search.test.ts` › «CA-17…» (4 casos; el último asserta que error / no-existe / todo-descartado son TRES estados distintos) | | 🚧 |
| CA-18 (flujo real de punta a punta con un REIT) | todo lo anterior | e2e `buscador-instrumentos.spec.ts` › «CA-13/CA-14/CA-18…» (el mercado leído en el buscador se compara con el de la tabla, capturado del DOM, no hardcodeado) y › «CA-18: el mismo buscador en /cartera no regresa» | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-029/. Informe HTML opcional: _qa/SPEC-029/informe.html -->

| CA | Captura |
|---|---|
| CA-12 | `_qa/SPEC-029/ca12-reit-en-el-buscador.png` |
| CA-10 (a) no existe | `_qa/SPEC-029/ca10-no-existe.png` |
| CA-10 (b) descartado | `_qa/SPEC-029/ca10-descartado-por-mercado.png` |
| CA-13/CA-14/CA-18 | `_qa/SPEC-029/ca18-reit-vigilado-con-tipo-y-mercado.png` |

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
