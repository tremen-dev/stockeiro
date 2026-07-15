---
id: SPEC-015
tipo: spec
epica: EPIC-FIX
estado: en-revision
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-07-15, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-15, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-07-15, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-07-15, por: sdd-implementador}
---
# SPEC-015 — Proveedor de cotizaciones con cobertura del mercado real

## Problema
La vigilancia de zonas (**CE-1**) y el P/L actual (**CE-3**) **no funcionan para el
mercado principal del usuario**: el free tier de Twelve Data no cubre BME/M.CONTINUO
(`/eod?symbol=ITX` → `404 "available starting with the Pro plan"`) y su cartera real es
**~82% mercado continuo**. La app está desplegada y el cron corre a diario, así que lleva
desde el despliegue **sin cumplir su promesa**, y encima **en silencio**.

Esta spec **restaura la promesa**: sustituye el adaptador de cotizaciones por
**Marketstack** (cobertura verificada contra la API real) y **canoniza la identidad de
mercado en el operating MIC**, que es la raíz común del descarte silencioso y del mapeo
erróneo del import (F-SPEC-012-1). Implementa **ADR-012**; reinterpreta **ADR-002** y
precisa **ADR-007**. Reglas: **RN-12** (cierre NO ajustado), **RN-09** (divisa del
símbolo), **RN-06** (sin precio, sin P/L), **D-2** (`asOf`). Dominio: sdd-mercados.
**No cambia el dominio**: es un adaptador tras el puerto ya existente. La UI del fallo
visible es **SPEC-016**.

## Usuarios / roles afectados
- **Usuario final** (indirecto pero es el punto): vuelve a ver el **P/L actual con dato**
  y sus zonas **evaluadas** para sus acciones españolas. Hoy ve "—" y "sin cotización".
- **Sistema** (ciclo diario): pide los precios al adaptador nuevo; el resto del ciclo
  (disparos SPEC-005, avisos SPEC-006) no se entera del cambio.

## Criterios de aceptación
Cada CA es verificable con un test. Se usa un **fake** tras `MarketDataProvider`
(patrón de SPEC-004); el adaptador real de Marketstack se escribe pero **no se llama en
tests** (su validación contra la API real es follow-up de despliegue, F-ADR-012-2).

- **CA-1 (Cobertura del mercado real — el defecto, corregido).**
  Dado un símbolo de M.CONTINUO con identidad `(ITX, BMEX)` referenciado por un usuario,
  cuando se ejecuta el ciclo de refresco,
  entonces se obtiene su cotización y **se persiste** — deja de aparecer en `skipped`, y
  su P/L actual deja de ser "—" (RN-06).
- **CA-2 (Identidad canónica = operating MIC, ADR-012).**
  Dado un símbolo,
  cuando se persiste su identidad,
  entonces `symbols.micCode` guarda el **operating MIC** (`BMEX`, `XNAS`, `XNYS`, `XETR`,
  `XSTO`, `XPAR`, `XAMS`), nunca el de segmento (`XMAD`, `XNGS`…).
- **CA-3 (La búsqueda normaliza segmento → operating).**
  Dado que el proveedor de búsqueda (Twelve Data, SPEC-008) devuelve un candidato con
  `micCode` de **segmento** (p. ej. `XNGS` para MSFT, `XMAD` para ITX),
  cuando el usuario lo elige,
  entonces el símbolo se persiste con el **operating MIC** correspondiente (`XNAS`,
  `BMEX`): la normalización ocurre en el **adaptador**, no en el dominio.
- **CA-4 (El eco casa — muere el descarte silencioso).**
  Dado un símbolo pedido con su operating MIC,
  cuando el proveedor devuelve la cotización con su `exchange`,
  entonces **empareja** con la petición (`quoteKey`) y el símbolo se **actualiza**; no se
  descarta por desajuste de MIC.
- **CA-5 (Cierre NO ajustado + asOf — RN-12/D-2).**
  Dada una cotización devuelta con `close` y `adj_close`,
  cuando se persiste,
  entonces se guarda el **`close` (NO ajustado)** —nunca el ajustado— con su `date` como
  `asOf`, y la **divisa del símbolo** (RN-09).
- **CA-6 (Traducción del dialecto del proveedor).**
  Dado un símbolo con operating MIC canónico cuyo proveedor usa otro código (p. ej.
  `XETR` → `XETRA`, que no es MIC ISO válido),
  cuando el adaptador construye la petición,
  entonces **traduce** al dialecto del proveedor y el dominio **sigue guardando el
  canónico**.
- **CA-7 (Dedupe y batch — ADR-002 intacto).**
  Dados N símbolos distintos referenciados por varios usuarios,
  cuando se ejecuta el refresco,
  entonces se pide **cada símbolo una sola vez** y en **una sola llamada** (batch); el
  coste escala con símbolos distintos, no con usuarios.
- **CA-8 (Resiliencia por símbolo — CA-6 de SPEC-004 se mantiene).**
  Dado un conjunto donde el proveedor falla para un símbolo,
  cuando se ejecuta el refresco,
  entonces ese se salta y **los demás SÍ se actualizan**; el ciclo no se aborta.
- **CA-9 (`MARKET_MAP` corregido — cierra F-SPEC-012-1).**
  Dada la etiqueta de mercado `M.CONTINUO` del import (ADR-009/SPEC-012),
  cuando se resuelve la identidad de un valor,
  entonces se filtra por **`BMEX`** (operating), no por `XMAD`; el resto de etiquetas se
  revisa igual.
- **CA-10 (Backfill de los símbolos ya persistidos).**
  Dados símbolos existentes con `micCode` de **segmento** (`XNGS`…) o `null` (legacy),
  cuando se aplica la migración,
  entonces quedan con su **operating MIC**; los que **no se puedan mapear** quedan
  **marcados y no se cotizan** hasta resolverse (no se inventa su mercado).
- **CA-11 (El dominio no conoce al proveedor).**
  Dado el puerto `MarketDataProvider`,
  cuando el dominio (refresco, cartera, disparos) opera,
  entonces depende **solo del puerto**; sustituir el adaptador no toca dominio, y un fake
  cubre los tests.

## Entidades y reglas afectadas
- **`MarketstackProvider`** (nuevo adaptador de `MarketDataProvider`, ADR-012): `/v1/eod/
  latest`, símbolo `TICKER.MIC`, batch; toma `close`/`date`; traduce el dialecto.
  Sustituye a `TwelveDataProvider` como adaptador de cotizaciones.
- **`TwelveDataSymbolSearchProvider`** (SPEC-008/ADR-007): **se mantiene** (free tier) y
  gana la **normalización segmento→operating** (CA-3).
- **`market/mic.ts`** (nuevo, dominio): catálogo de operating MIC soportados y mapa ISO
  **segmento→operating**. Es conocimiento de **mercado** (ISO 10383), no de proveedor.
- **`symbols.micCode`**: pasa a contener **siempre** el operating MIC → **migración** de
  los ya persistidos (CA-10).
- **`market-map.ts`** (`MARKET_MAP`, ADR-009): `M.CONTINUO→BMEX` (CA-9).
- Reglas: **RN-12** (no ajustado), **RN-09** (divisa), **RN-06** (sin precio, sin P/L),
  **RN-01/RN-03** (el ciclo no cambia su modelo de acceso), **D-2** (`asOf`).
  Decisiones: **ADR-012** (esta), **ADR-002** (reinterpretada), **ADR-007** (precisada),
  **ADR-004** (cadencia/base intactas), **ADR-009** (`MARKET_MAP`).

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Mostrar al usuario por qué** un símbolo no cotiza: **SPEC-016** (CE-F2). Aquí el
  motivo se **propaga** por el puerto, pero la UI es de la otra spec.
- **Histórico de cotizaciones**: sigue una fila por símbolo (ADR-004).
- **Cadencia**: sigue 1×/día tras cierre (ADR-004). No se toca el cron.
- **Ajuste por eventos corporativos**: que Marketstack exponga `split_factor`/`dividend`
  no lo mete aquí (EPIC-002 lo dejó fuera; sigue fuera).
- **Cambiar el proveedor de BÚSQUEDA**: se queda Twelve Data (su búsqueda funciona; la de
  Marketstack no encuentra Madrid — verificado, ADR-012).
- **Reintentos/backoff y alerting** del ciclo: mejora (EPIC-MEJORA), no defecto.
- **Llamada real a Marketstack en tests**: fake; la validación real es follow-up de
  despliegue.

## Notas para el gate humano
1. **La cobertura está verificada contra la API real**, no supuesta: `ITX.BMEX`→53,72 €,
   `SAN.BMEX`→11,984 €, `TEF.BMEX`→3,615 € (cierre 2026-07-14, batch de 3 en 1 llamada,
   **free tier**). Es la comprobación que le faltó a ADR-002.
2. **Dos proveedores** (búsqueda en Twelve Data, cotizaciones en Marketstack). No es
   capricho: la búsqueda de Marketstack **no encuentra los valores de Madrid**
   (verificado). ADR-007 separó los puertos justo para esto. ¿Conforme?
3. **Migración de datos (CA-10)**: tus símbolos en producción tienen MIC de segmento o
   `null`. El backfill los pasa a operating; **lo que no se pueda mapear quedará marcado y
   sin cotizar** en vez de adivinar su mercado. ¿Conforme con esa cautela?
4. **`MARKETSTACK_API_KEY`** habrá que añadirla a `.env.example` y a Vercel
   (**F-ADR-012-2**), como se hizo con `TWELVE_DATA_API_KEY`. Hasta entonces, producción
   seguirá sin cotizar aunque el código esté mergeado.
5. **Riesgo de licencia asumido** (R-F1 de EPIC-FIX): free tier sin derechos comerciales.
   Mitigación a un clic: plan Basic $9.99, misma key, cero código.
