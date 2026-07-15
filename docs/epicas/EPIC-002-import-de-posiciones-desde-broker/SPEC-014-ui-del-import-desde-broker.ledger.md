---
id: SPEC-014
tipo: ledger
epica: EPIC-002
---
# Ledger — SPEC-014 UI del import desde broker

## Resumen
- Fase: en-revision (implementación completa; pendiente de verificador)
- Rama: `ft/SPEC-014-ui-del-import-desde-broker`
- Asistente de 3 pasos en `/cartera/importar` (Subir → Resolver → Previsualizar/Confirmar)
  que orquesta SPEC-011/012/013 tras server actions con sesión; estado en cliente, binario
  en memoria. Reutiliza `symbol-search.tsx` (con nuevo callback opcional `onSelect`) y el
  design system `tremen-ds`. Verificado con Playwright (E2E).
- Factory de proveedor de búsqueda extraído a `src/lib/market/search-provider-factory.ts`
  (un fichero `'use server'` no puede exportar no-funciones); server.mjs (E2E) actualizado
  con `symbol_aliases` + columnas `import_key`/`importe_eur`.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (entrada al import) | `cartera/page.tsx` (botón); `cartera/importar/page.tsx` | `tests/e2e/importar.spec.ts` › test 1 (importar-cta → /cartera/importar) | | ❌ |
| CA-2 (subida y lectura) | `importar/actions.ts` (`readStatementAction`); `import-wizard.tsx` | `importar.spec.ts` › test 1 (summary "6") | | ❌ |
| CA-3 (fichero inválido) | `importar/actions.ts` (catch `ExtractoIllegibleError`) | `importar.spec.ts` › CA-3 (read-error visible) | | ❌ |
| CA-4 (resolución asistida) | `import-wizard.tsx` (`SymbolSearch onSelect`); `actions.ts` (`confirmSelectionAction`) | `importar.spec.ts` › test 1 (APPLE COMPUTER → AAPL) | | ❌ |
| CA-5 (fusión manual) | `import-wizard.tsx` (fuse-select); `actions.ts` (`fuseAction`) | `importar.spec.ts` › test 1 (REPSOL YPF + fuse-warn) | | ❌ |
| CA-6 (pendientes visibles) | `import-wizard.tsx` (badge pendiente) | `importar.spec.ts` › test 1 (DESCONOCIDO pendiente) | | ❌ |
| CA-7 (previsualizar sin escribir) | `actions.ts` (`previewAction`); `import-wizard.tsx` (buckets) | `importar.spec.ts` › test 1 (count-crear/pendientes) | | ❌ |
| CA-8 (confirmar → cartera) | `actions.ts` (`confirmImportAction`+revalidate) | `importar.spec.ts` › test 1 (result + filas ITX/REP/AAPL) | | ❌ |
| CA-9 (idempotencia visible) | `actions.ts` (`previewAction` re-import) | `importar.spec.ts` › test 1 (0 crear / 4 saltar) | | ❌ |
| CA-10 (aviso sobreventa) | `register.ts` (`detectarSobreventa`, reusado); `import-wizard.tsx` (avisos) | `importar.spec.ts` › test 1 (avisos SANTANDER) | | ❌ |
| CA-11 (acceso protegido) | `src/proxy.ts` (sesión) — sin cambios | `importar.spec.ts` › CA-11 (redirige a /login) | | ❌ |
| CA-12 (coherencia responsive) | `globals.css` (import-*, media 720px) | `importar.spec.ts` › test 1 (viewport móvil + screenshot) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
- `_qa/SPEC-014/preview.png` — paso de previsualización (a-crear/pendientes/avisos).
- `_qa/SPEC-014/mobile.png` — vista móvil (390px), responsive (CA-12).

## Salvedades / follow-ups
- **Auto-confirmación de sugeridos**: en el paso Resolver, los valores con UN único
  candidato se auto-resuelven (se persiste su alias) para no obligar a confirmar lo
  obvio en extractos grandes; el usuario los ve, puede cambiarlos, y confirma el import
  completo al final (CE-3 se cumple por la confirmación final + editabilidad). Decisión
  de UX del implementador; anotada por transparencia.
- **F-SPEC-014-1** (E2E vs unit): los 12 CA se verifican por Playwright (E2E), no por
  vitest; requieren `npm run build` + Postgres efímero. El fixture `.xls` se genera en el
  propio spec (sintético, sin datos personales) y sí puede versionarse.
- **`server.mjs` y `test-db.ts`** mantienen el esquema a mano en paralelo a
  `src/db/schema.ts`/migraciones drizzle: al añadir columnas/tablas hay que tocar los
  tres (ya hecho para symbol_aliases + import_key/importe_eur). Riesgo de drift conocido.

## Cómo retomar (handoff)
Implementación de SPEC-014 **completa y en verde**: unit **142/142**, e2e **15/15**
(3 nuevos de import + sin regresión en cartera/vigiladas/avisos/ingesta), typecheck y
lint limpios, `next build` OK con la ruta `/cartera/importar`. **Cierra EPIC-002 al
completo** (las 4 specs hechas: lee → resuelve → registra → UI).

Ficheros nuevos/tocados:
- `src/app/cartera/importar/{page,actions,import-wizard}.tsx|ts` — pantalla + orquestación.
- `src/app/cartera/page.tsx` — botón "Importar extracto". `src/app/globals.css` — estilos.
- `src/app/_components/symbol-search.tsx` — callback opcional `onSelect` (no rompiente).
- `src/lib/market/search-provider-factory.ts` — factory extraído (reutilizado).
- `src/app/_components/symbol-search-action.ts` — usa el factory.
- `tests/e2e/importar.spec.ts` — E2E (CA-1..CA-12) con fixture sintético.
- `tests/e2e/server.mjs` — esquema E2E con symbol_aliases + columnas del import.

Siguiente: verificador (gate de SPEC-014, con Playwright). Tras merge, EPIC-002 quedaría
lista salvo follow-ups de despliegue (F-SPEC-011-1 SheetJS CDN, F-SPEC-012-1 mercado→MIC).
