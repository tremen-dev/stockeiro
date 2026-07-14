---
id: SPEC-004
tipo: ledger
epica: EPIC-001
---
# Ledger — SPEC-004 Ingesta de cotizaciones

## Resumen
- Fase: implementación completa (CA-1..CA-7 con test), pendiente de verificación. Spec en `en-progreso`.
- Rama: `ft/SPEC-004-ingesta-de-cotizaciones`
- Gates locales del implementador: **13 tests nuevos verdes** (64/64 en la suite, sin
  regresiones), `eslint` 0 errores, `tsc --noEmit` 0, `next build` verde
  (`/api/cron/refresh` publicada como función).

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/market/refresh.ts` (`symbolUniverse` con `Set` de symbolIds) · `provider.ts` (getQuotes en 1 llamada) | `tests/market-refresh.test.ts` › "CA-1: dedupe… se pide UNA sola vez" | | 🚧 |
| CA-2 | `src/lib/market/refresh.ts` (`symbolUniverse`: distinct watchlist ∪ transactions; huérfanos fuera) | `tests/market-refresh.test.ts` › "CA-2: universo = unión distinct…" | | 🚧 |
| CA-3 | `src/lib/market/quotes.ts` (`upsertQuote`, onConflictDoUpdate por `symbolId`) · `src/db/schema.ts` (`quotes`, symbolId único) | `tests/market-refresh.test.ts` › "CA-3: persistencia… actualiza, no duplica" | | 🚧 |
| CA-4 | `src/lib/market/quotes.ts` (`getPriceMap`) · `src/app/cartera/page.tsx` (pasa precios a `portfolioSummary`) | `tests/market-quotes-pl.test.ts` › "CA-4: …plActual deja de ser —" | | 🚧 |
| CA-5 | `src/db/schema.ts` (`quotes.price`/`asOf`) · `src/lib/market/quotes.ts` (`getQuoteByTicker`, precio sin ajustar) | `tests/market-quotes-pl.test.ts` › "CA-5: base NO ajustada + asOf… intacta pese al split" | | 🚧 |
| CA-6 | `src/lib/market/refresh.ts` (salta símbolo no resuelto, no aborta) · `provider.ts`/`fake-provider.ts` (omite fallos) | `tests/market-refresh.test.ts` › "CA-6: resiliencia por símbolo" | | 🚧 |
| CA-7 | `src/lib/market/cron.ts` (`authorizeCron` tiempo constante, fail-closed; `runCronRefresh`) · `src/app/api/cron/refresh/route.ts` | `tests/cron-refresh.test.ts` › "CA-7: autorización…" / "…401 y ninguna cotización persistida" / "…200 y persiste" | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-004/. Informe HTML opcional: _qa/SPEC-004/informe.html -->

## Salvedades / follow-ups
<!-- IDs F-SPEC-004-1, F-SPEC-004-2… con destino (spec futura o EPIC-MEJORA). -->
- **F-SPEC-004-1** (ops, para DESPLIEGUE): aprovisionar en Vercel (Settings →
  Environment Variables) `TWELVE_DATA_API_KEY` (Twelve Data, ADR-002) y `CRON_SECRET`
  (protege `/api/cron/refresh`, ADR-004). NO bloquea la verificación (tests con
  proveedor fake + Postgres efímero); prerequisito de producción, junto a F-SPEC-001-2.
  `CRON_SECRET` se genera (`openssl rand -hex 32`) y Vercel Cron lo reenvía como
  `Authorization: Bearer <CRON_SECRET>`. Checklist de env en `.env.example`; detalle
  de ops en roadmap → "Antes de desplegar".

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
- **Hecho (implementador):** CA-1..CA-7 implementados con test (verde), gates locales
  en verde. Spec pasada a `en-revision`.
- **Módulos nuevos** (`src/lib/market/`): `provider.ts` (puerto), `fake-provider.ts`
  (tests), `twelve-data-provider.ts` (adaptador real, endpoint `/eod`, NO ejercido en
  tests), `refresh.ts` (universo distinct + refresco resiliente), `quotes.ts` (upsert +
  lectura de precios/asOf), `cron.ts` (autorización + handler). Ruta:
  `src/app/api/cron/refresh/route.ts`. Cron declarado en `vercel.json` (`0 22 * * *`).
- **Entidad:** tabla `quotes` (`src/db/schema.ts` + `src/db/test-db.ts`).
- **Integración SPEC-002:** `src/app/cartera/page.tsx` alimenta `portfolioSummary` con
  los precios ingeridos y muestra el `asOf` (D-2).
- **Pendiente (verificador):** rellenar Verif./Estado; UI e2e opcional del flujo
  ingesta→cartera. El adaptador real Twelve Data queda sin cobertura automática por
  diseño (proveedor fake); su validación contra la API real es F-SPEC-004-1 (despliegue).
- **NO tocar en verificación:** el precio se persiste sin ajustar (RN-12); no añadir
  ajuste por splits/dividendos (fuera de alcance, se registran a mano en cartera).
