---
id: EPIC-FIX
tipo: epica
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-07-15, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-07-15, por: humano (Alberto Fojo)}
---
# EPIC-FIX — Defectos en producción

## Objetivo
Épica **bucket** (transversal, no de producto nuevo) que agrupa los **defectos de
producción**: casos en que una capacidad **ya entregada y verificada** no cumple su
promesa con datos o uso reales. No añade alcance; **restaura** lo prometido. Igual
que EPIC-INFRA protege la salud técnica, EPIC-FIX protege la **verdad funcional**:
que lo que el tablero da por `hecho` funcione de verdad para el usuario real.

Por qué existe: los bugs llegan de forma reactiva y con urgencia, pero necesitan
gobernarse con specs testables igual que una feature — sin forzar una visión de
producto ni ensuciar la épica original, que ya está cerrada.

### Caso que la motiva — cobertura del mercado español (2026-07-15)
La vigilancia de zonas (**CE-1**) y el P/L actual (**CE-3**) de EPIC-001 **no
funcionan para la cartera real del usuario**. El free tier de Twelve Data **no cubre
BME/M.CONTINUO**: `/eod?symbol=ITX` devuelve `404 "This symbol is available starting
with the Pro plan"`. La cartera real es **~82% mercado continuo español** (204 de 250
operaciones del extracto de ING).

Agravante: el fallo es **silencioso**. El ciclo diario responde `200`, se salta los
símbolos españoles (resiliencia por símbolo, CA-6 de SPEC-004) y el usuario solo ve
*"sin cotización"* en `/vigiladas`, sin explicación. El motivo real que devuelve el
proveedor se descarta. Es el mismo *fallo silencioso* que SPEC-008 vino a eliminar,
reaparecido en otro punto.

La app está **desplegada y el cron corre a diario** — o sea: el producto lleva desde
el despliegue sin cumplir su promesa para su mercado principal, sin avisar.

## Criterios de éxito
Medibles, por spec:

- **CE-F1 (La promesa se restaura, y se prueba con el mercado real).** Toda spec de
  esta épica cierra con una verificación que demuestra el defecto **corregido** y
  **sin regresión** en lo ya entregado. Para el caso que la motiva: las acciones de
  **M.CONTINUO** de la cartera real muestran **P/L actual con dato** (deja de ser "—",
  RN-06) y sus zonas **se evalúan** (RN-11), con su `asOf` visible (D-2).
- **CE-F2 (Ningún fallo silencioso).** Cuando un símbolo no se puede cotizar, el
  usuario **ve que pasa y por qué** — no un "sin cotización" indistinguible de "aún no
  ha corrido el ciclo". Objetivo: 0 símbolos descartados sin traza visible.
- ~~**CE-F3 (Coste cero de arranque).** El arreglo funciona en la **capa gratuita** del
  proveedor elegido, sin gasto recurrente (restricción del humano, gate 2026-07-15).~~
  **RETIRADO el 2026-08-23 (Alberto Fojo). No se cumplió, y se deja escrito que no se
  cumplió.** Se tacha en vez de borrarse porque un criterio de éxito que se cae enseña
  más que uno que se logra.
  - **Qué falló.** No el arreglo: el criterio. La capa gratuita de Marketstack no podía
    sostener la promesa de esta misma épica —**CE-1** de EPIC-001, cero zonas perdidas—
    y **ningún cambio de código lo arreglaba**. `100` unidades/mes de free tier contra
    un consumo real de **~400** (13 símbolos × ~31 días). **ADR-027** lo dejó anotado
    como **F-ADR-027-1**, con esa frase exacta: *"ya no caben juntos"*.
  - **Por qué no se vio antes.** Porque la cuenta estaba hecha en la unidad equivocada.
    Se contaron **llamadas** (~30/mes, "caben de sobra en las 100") donde el proveedor
    factura **símbolos** (una petición de 13 tickers consume 13 créditos). El error
    viajó tres saltos —ADR-002 → ADR-012 → esta épica— sin que nadie lo tocase, y se
    pagó con **tres días de precios congelados** (2026-08-19/20) que nadie detectó.
  - **Cómo se resuelve.** Eligiendo el gasto, no forzando el criterio: **plan Basic,
    10.000 peticiones/mes (~$9.99/mes)**, contratado el 2026-08-23 sobre cuenta propia.
    Margen ~25× sobre el consumo actual. Misma key, cero código, cero despliegue.
  - **La lección, que es lo único que sobrevive al criterio.** "Coste cero" no es un
    criterio de éxito: es una **restricción de presupuesto**, y como tal no debió
    escribirse al lado de criterios que se verifican con un test. Un criterio de éxito
    dice *qué tiene que ser verdad para el usuario*; el dinero que cuesta que lo sea es
    otra conversación. La unidad canónica para dimensionar un proveedor —**símbolos
    distintos × ciclos**— la fija ahora **ADR-027 pto. 1**, y **ADR-032** deja la cuenta
    de este plan hecha en esa unidad.

## Alcance
- **Dentro:**
  - Defectos que impiden cumplir un criterio de éxito **ya prometido** por una épica
    cerrada (empezando por la cobertura de mercado de EPIC-001).
  - Cambiar el **proveedor de datos de mercado** si el actual no puede cumplir la
    promesa: el puerto `MarketDataProvider` ya existe → **adaptador nuevo, sin tocar
    dominio**.
  - **Hacer visible** el motivo por el que un símbolo no cotiza (CE-F2).
  - **Canonizar la identidad de mercado** (operating MIC vs segment MIC): es la **raíz
    común** del descarte silencioso y del mapeo `M.CONTINUO→XMAD` del import
    (F-SPEC-012-1). Se arregla aquí porque es el mismo defecto, no dos.
- **Fuera (aparcado a propósito, no por descuido):**
  - **Funcionalidad nueva**: si el arreglo destapa una capacidad que falta, va a su
    épica de producto, no aquí.
  - **Múltiples cuentas para estirar el free tier**: **rechazado**. Va contra los
    términos del proveedor — el mismo motivo por el que se descartó Yahoo (ADR-002/
    ADR-007), sería incoherente — y un cierre de cuentas rompería CE-1, que es
    justo lo que esta épica viene a arreglar. ~~**Además es innecesario**: el consumo
    real (~30 llamadas/mes) cabe de sobra en las 100 del free tier.~~ **Esa última
    frase era falsa y está medida como tal** (ADR-027 pto. 3): contaba llamadas donde
    el proveedor cuenta símbolos, y el consumo real era de ~400 unidades/mes. **El
    rechazo sigue en pie sin ella** —se sostiene por términos de uso y por coherencia
    con el rechazo de Yahoo, que no dependían de la cifra— y desde el 2026-08-23 es
    además **discutible por irrelevante**: con el plan Basic (10.000/mes) no hay free
    tier que estirar.
  - **Reintentos/backoff** finos del proveedor y **alerting** del ciclo: mejora, no
    defecto (EPIC-MEJORA).
  - **Reconstruir el histórico** de cotizaciones: solo se guarda la última por
    símbolo (ADR-004); sigue igual.
  - **Ajuste automático por eventos corporativos**: EPIC-002 lo dejó fuera; que el
    proveedor nuevo exponga `split_factor`/`dividend` no lo mete aquí.

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

## Riesgos
- **R-F1 (Licencia del free tier — RIESGO ASUMIDO por el humano).** El free tier de
  Marketstack **no concede derechos de uso comercial**, y la app se compartirá con
  testers en un foro. Si un uso sin ánimo de lucro y sin ingresos cuenta como
  "comercial" es **ambiguo**, y el humano **asume esa ambigüedad conscientemente**
  (gate 2026-07-15) para no gastar en los primeros meses. **Consecuencia si el
  proveedor lo hace valer**: corte de servicio → CE-1 roto. **Mitigación**: pasar al
  plan Basic ($9.99/mes) es **cambiar de plan con la misma key y el mismo adaptador**
  — minutos, cero código. El riesgo es barato de revertir; por eso es asumible.
  ↳ **CERRADO el 2026-08-23 (Alberto Fojo): contratado el plan Basic (10.000
  peticiones/mes) sobre cuenta propia.** El riesgo se **extingue** —el plan de pago sí
  concede uso comercial—, no se mitiga. Y la mitigación resultó ser **exactamente** lo
  que este riesgo prometía: misma key, mismo adaptador, cero código, cero despliegue.
  Merece constar, porque un riesgo cuya vía de escape se verifica al ejecutarla es un
  riesgo que estaba **bien evaluado**.
  ↳ Con una ironía que vale más que el acierto: **el riesgo no se materializó nunca**.
  Marketstack jamás reclamó nada. Lo que tumbó el free tier fue la **cuota** —un eje
  que R-F1 no vigilaba— y R-F1 se cerró de rebote. Ver **CE-F3 (retirado)** y
  **ADR-027**.
- **R-F2 (Dependencia de un único proveedor).** Cambiar de Twelve Data a otro no
  elimina el riesgo de fondo: que el proveedor cambie límites, precios o cobertura y
  vuelva a romper CE-1. Mitigación estructural: el **puerto** ya existe (ADR-002), así
  que sustituir es un adaptador. Lección: **verificar la cobertura del mercado real
  ANTES de fijar un proveedor** — ADR-002 no lo hizo y por eso estamos aquí.
- **R-F3 (Identidad de mercado ambigua).** ADR-007 fijó la identidad como
  `(ticker, mic_code)` pero **nunca dijo cuál MIC**: ISO 10383 distingue **operating
  MIC** (`BMEX`, `XNAS`) de **segment MIC** (`XMAD`, `XNGS`), y cada proveedor elige
  distinto. Es la raíz del descarte silencioso y de F-SPEC-012-1. Si no se canoniza,
  el bug reaparece con el proveedor siguiente. Decisión técnica: ADR de sdd-arquitecto.
- **R-F4 (Confianza).** El usuario ya vio la app "funcionando" mientras no cotizaba su
  cartera. Un arreglo que solo funcione a medias (unos mercados sí y otros no, otra vez
  en silencio) es peor que el bug: por eso CE-F2 es criterio de éxito, no una mejora.

## Notas para el gate humano
Decisiones ya tomadas contigo (gate 2026-07-15), para que las confirmes al aprobar:

1. **Proveedor: Marketstack**, con dictamen de **sdd-mercados** verificado **contra la
   API real** (no solo documentación): cubre los **7 mercados** del extracto (`BMEX`,
   `XNAS`, `XNYS`, `XETRA`, `XSTO`, `XPAR`, `XAMS`); `ITX.BMEX`→53,72 €, `SAN.BMEX`→
   11,984 €, `TEF.BMEX`→3,615 € (cierre 2026-07-14, **batch de 3 en 1 llamada**);
   devuelve `close` **no ajustado** (RN-12) y el **MIC pedido** en `exchange` (el eco
   **casa** → mata el descarte silencioso). Alternativas descartadas: Twelve Data Pro
   **$229/mes** (23× más caro), **Yahoo** (ToS + fiabilidad, rechazo ratificado),
   **Stooq** (sin API). La decisión técnica formal es un **ADR** de sdd-arquitecto que
   reinterpretará **ADR-002**.
2. ~~**Capa gratuita, riesgo de licencia asumido** (R-F1). Es tu decisión explícita; la
   dejo escrita con su consecuencia y su mitigación.~~ **Superado el 2026-08-23**: se
   contrató el **plan Basic (10.000/mes)** y con él caen **R-F1** (cerrado) y **CE-F3**
   (retirado). La mitigación que se dejó escrita aquí en el gate del 2026-07-15 se
   ejecutó tal cual **cinco semanas después**: misma key, cero código.
3. **Sin múltiples cuentas** (fuera de alcance, con motivo).
4. **La canonización del MIC entra en esta épica** (R-F3): es la misma raíz que el
   defecto, y arregla de paso **F-SPEC-012-1** del import.
5. **El fallo silencioso se arregla aquí** (CE-F2), no en una épica aparte: forma parte
   del defecto, no es una mejora.

Pregunta abierta: ¿mantenemos **Twelve Data (free) para la BÚSQUEDA de símbolos**
(SPEC-008/ADR-007, cuyo `/symbol_search` sí funciona en free) y usamos Marketstack
**solo para cotizaciones**? ADR-007 separó los puertos a propósito, así que se puede.
La alternativa es unificar todo en Marketstack. Es decisión técnica (ADR), pero tiene
coste de producto: dos proveedores = dos cosas que pueden romperse.
