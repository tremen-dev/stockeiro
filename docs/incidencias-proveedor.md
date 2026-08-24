# Incidencias abiertas con proveedores de datos externos

> Fallos **del proveedor**, no de Stockeiro: datos incorrectos, símbolos que no
> sirve, endpoints rotos. Se anotan aquí porque su arreglo no está en nuestra
> mano y el caso puede tardar semanas — sin este registro, dentro de tres meses
> nadie recordará qué se comprobó, qué se descartó ni por qué el código tiene la
> forma que tiene. Los defectos **nuestros** van a specs de `EPIC-FIX`; las
> decisiones, a ADR; los bugs del plugin tremen-sdd, a `known-issues.md`.

---

## IP-1 — Marketstack sirve `TPG.XETRA` con la serie de TPG Inc. (Nasdaq)

- **Estado: ✅ REPORTADO a Marketstack (2026-08-24), pendiente de respuesta.**
- **Detectado:** 2026-08-24, en producción, por el usuario.
- **Proveedor:** Marketstack (APILayer), plan Basic (ADR-012, ADR-032).
- **Vía:** formulario de contacto del panel. Texto enviado: apéndice de esta
  ficha.
- **Alcance medido:** 1 símbolo de 62 en producción, **sin operaciones**
  asociadas (solo vigilada) → no hay P/L contaminado.

### Síntoma

`TPG0 @ XETR` (The Platform Group SE & Co. KGaA) aparece en la lista de vigiladas
como *«No se vigila: El proveedor no reconoce este símbolo (puede estar
deslistado)»*. **El motivo es falso**: el valor cotiza con normalidad.

### Causa inmediata — dos proveedores, dos espacios de nombres

El buscador es **Twelve Data** (`twelve-data-search-provider.ts`) y las
cotizaciones son **Marketstack** (`marketstack-provider.ts`). No comparten
tickers para la misma empresa:

| | ticker en Xetra |
|---|---|
| Twelve Data (buscador) | `TPG0` — con **cero** |
| Marketstack (cotizaciones) | `TPG` |

Guardamos lo que dio el buscador y pedimos `TPG0.XETRA`. Marketstack devuelve
cero filas → barrido final de `getQuotes` → `simbolo_desconocido` → el texto
falso. SPEC-020 resolvió el dialecto del **mercado** (`XETR`→`XETRA`); este es el
dialecto del **ticker**, que nadie traduce.

### Por qué NO se arregla cambiando el ticker a `TPG`

Porque el registro de Marketstack está envenenado. Verificado 2026-08-24:

```
date         symbol      exch     open    high     low   close      volume
2026-08-21   TPG.XETRA   XETRA   52.33   53.19   51.64    52.4   2,057,300
2026-08-21   TPG         XNAS    52.33   53.19   51.64    52.4   2,057,300
2026-08-19   TPG.XETRA   XETRA   52.26  53.765   51.35   53.18   2,859,600
2026-08-19   TPG         XNAS    52.26  53.765   51.35   53.18   2,859,600
2026-08-17   TPG.XETRA   XETRA   52.67   53.27  51.545   51.77   2,594,000
2026-08-17   TPG         XNAS    52.67   53.27  51.545   51.77   2,594,000
```

Cinco sesiones (17→21 ago) idénticas **hasta el último decimal**; solo cambia el
campo `exchange`. Es la serie de **TPG Inc. (Nasdaq, USD)** con etiqueta Xetra.
Usarla metería dólares de otra empresa como euros.

**Y RN-09 no lo detendría**: el eco dice `exchange: XETRA` → `fromProviderMic` lo
canoniza a `XETR` → casa exacto con el mercado pedido en el paso 1 y **se
acepta**. La defensa de confirmar-por-eco supone que el proveedor no miente en
`exchange`. Aquí miente. Grieta real, pendiente de ADR propio.

### No es sistemático

La colisión análoga sí está bien resuelta en su base, así que `TPG.XETRA` es un
registro malo suelto y no un motivo para desconfiar de Xetra en general:

```
PHM.BMEX   BMEX   2026-08-21   close  83.30   volume  45,400   (Pharma Mar, BME)
PHM        XNYS   2026-08-21   close 129.00   volume 996,800   (PulteGroup, NYSE)
```

### Alternativas descartadas (con su prueba)

- **Otro símbolo en Marketstack**: `not_found_error` en `/v1/tickers/{symbol}`
  para `TPG0.XETRA`, `TPG0`, `TPGD`, `TPG.XFRA`, `TPG0.XFRA`, `TPGD.XFRA`,
  `TPG0.XSTU`, `TPG.XSTU`. Ojo: su `/v1/tickers?search=` está roto
  (`search=platform` → 0 resultados aunque `/tickers/TPG.XETRA` exista), así que
  **su silencio en búsqueda no prueba ausencia** — hay que sondear a pelo.
- **Twelve Data como respaldo**: `quote`/`eod` de `TPG0 @ XETR` → `404, "available
  starting with the Grow or Venture plan"`. El plan actual no llega.
- **Segundo proveedor de pago**: descartado por alcance. Un símbolo sin
  operaciones no paga ni el coste ni meter dos proveedores de cotización en la
  arquitectura. **Se reabre si el agujero crece** (repetir el recuento de abajo).
- **Precio manual**: rompe RN-12 y la vigilancia.

### Decidido de momento (2026-08-24)

1. Ticket enviado; esperamos.
2. **El mensaje de la UI NO se toca** por ahora (decisión del usuario), aunque se
   sabe falso para este caso.
3. Sin segundo proveedor.

### Qué hacer cuando contesten

- **Si lo corrigen o lo retiran** → re-verificar con los comandos de abajo. Si
  aparece la serie real en EUR, hará falta traducir `TPG0`→ticker de Marketstack:
  eso es una **tabla de alias buscador↔proveedor**, con la misma disciplina que
  `PROVIDER_SUFFIX` (entrada solo con llamada real verificada) **más** la
  comprobación nueva: comparar OHLCV con el del ticker pelado antes de dar el
  alias por bueno.
- **Si no lo corrigen** → `TPG` va a **lista negra**, nunca a alias, y entonces sí
  toca la spec del mensaje honesto (*«nuestro proveedor no cubre este símbolo»*
  en vez de *«puede estar deslistado»*).
- **En cualquier caso** queda pendiente la grieta de RN-09 descrita arriba.

### Cómo re-verificar (2 llamadas)

```bash
MS=$(grep -m1 '^MARKETSTACK_API_KEY=' .env | cut -d= -f2-)
# 1) ¿sigue envenenado? Si las filas coinciden, sigue mal.
curl -s -G https://api.marketstack.com/v1/eod \
  --data-urlencode "access_key=$MS" \
  --data-urlencode "symbols=TPG.XETRA,TPG" --data-urlencode "limit=10"
# 2) ¿ha aparecido el instrumento real?
curl -s -G https://api.marketstack.com/v1/tickers/TPG0.XETRA \
  --data-urlencode "access_key=$MS"
```

Y para volver a medir el alcance en producción (solo lectura): contar filas de
`quote_diagnostics` por `reason`, cruzadas con `symbols`, `watched_symbols` y
`transactions`. El 2026-08-24 daba 62 símbolos / 1 fallo / 0 operaciones.

### Datos del instrumento

The Platform Group SE & Co. KGaA (antes *The Platform Group AG*),
**ISIN DE000A2QEFA1**, Xetra, EUR. Twelve Data lo sitúa además en XSTU, XMUN,
XFRA y XDUS como `TPG0`, y en CBOE (BCXE) como `TPGD`.

---

<details>
<summary>Apéndice — texto enviado a Marketstack el 2026-08-24</summary>

```
Subject: TPG.XETRA returns the Nasdaq TPG (TPG Inc.) series under a Xetra label

Data integrity bug, not a coverage request.

1) Your own ticker record says TPG.XETRA is German.
GET /v1/tickers/TPG.XETRA
-> {"name":"The Platform Group AG","country":"Germany","stock_exchange":
    {"name":"Deutsche Boerse Xetra","mic":"XETRA","country_code":"DE"}}
Intended instrument: The Platform Group SE & Co. KGaA, ISIN DE000A2QEFA1, EUR.

2) But the EOD series is the Nasdaq one, identical field by field.
GET /v1/eod?symbols=TPG.XETRA,TPG&limit=10   (retrieved 2026-08-24)
[tabla de 6 filas: TPG.XETRA y TPG alternados, 2026-08-21/19/17]
All five sessions from 2026-08-17 to 2026-08-21 match to the last decimal
(note 53.765 and 51.545). Only the "exchange" field differs. Volume alone
rules the label out: 2-3M shares/session is a US large-cap profile, not the
Xetra line of a German small cap.

3) Your data is CORRECT for the analogous collision, so this looks isolated:
PHM.BMEX / PHM (Pharma Mar, BME vs PulteGroup, NYSE).

4) The real instrument is unreachable: not_found_error for TPG0.XETRA, TPG0,
TPGD, TPG.XFRA, TPG0.XFRA, TPGD.XFRA, TPG0.XSTU, TPG.XSTU.

5) Minor, related: /v1/tickers?search=platform returns 0 results although
/v1/tickers/TPG.XETRA resolves fine.

Request:
a) Correct or withdraw TPG.XETRA. If you have no Xetra feed for DE000A2QEFA1,
   not_found is far better than another company's series under a German MIC:
   a wrong price is worse than no price.
b) Add the actual Xetra listing of DE000A2QEFA1 if it is within coverage.
c) Update the stale name on that record ("AG" -> "SE & Co. KGaA").
```

</details>
