---
id: SPEC-018
tipo: spec
epica: EPIC-003
estado: aprobada
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-07-15, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-15, por: humano (Alberto Fojo)}
---
# SPEC-018 — Declarar la continuidad desde la cartera con previsualizacion

## Problema
SPEC-017 pone el concepto en el dominio, pero **nadie puede declararlo**: fuera del asistente
de import **nada reasigna un símbolo**. `/cartera` solo tiene compra, venta, split y dividendo;
`/vigiladas`, añadir y quitar.

Y `/cartera` es **justo donde el usuario descubre el problema**: desde SPEC-016 ve
*"El proveedor no reconoce este símbolo (puede estar deslistado)"* junto al `"—"` de su P/L…
y no puede hacer nada al respecto. Esta spec le da la salida **donde le duele**.

Cumple **CE-1** (la posición continúa), **CE-2** (la app hace la aritmética, con confirmación)
y **CE-4** (no destructivo en silencio) de EPIC-003. Implementa **ADR-013** (ptos. 7 y 8).

## Usuarios / roles afectados
- **Usuario final**: declara que su valor continúa en otro símbolo, **ve el antes/después**
  antes de aceptar, y puede **deshacerlo** si se equivocó. **Cero cuentas a mano**.

## Criterios de aceptación
Los CA de UI se verifican con Playwright (patrón SPEC-014/SPEC-016). Caso guía: **PharmaMar**,
1.200 acciones a 1 €, contrasplit **12:1** (`ratio = 1/12`).

- **CA-1 (La salida está donde se ve el problema).**
  Dada una posición cuyo símbolo no se puede cotizar, cuando el usuario abre `/cartera`,
  entonces junto al motivo (SPEC-016) ve la acción para **declarar que el valor continúa en
  otro símbolo**.

- **CA-2 (El símbolo nuevo se elige del buscador, no se teclea).**
  Cuando el usuario declara la continuidad, entonces elige el sucesor **del buscador**
  (SPEC-008/ADR-007), de modo que llega con su **identidad canónica** `(ticker, operating MIC)`
  y su divisa (ADR-012). No hay campo de texto libre para el ticker.

- **CA-3 (La app hace la aritmética y la enseña ANTES — CE-2).**
  Dado el ratio, cuando el usuario lo introduce, entonces ve un **antes/después** con
  **cantidad viva** y **coste medio** (1.200 → 100 acciones; 1 € → 12 €) **antes de
  confirmar**, y el **valor de la posición no cambia** entre ambos (RN-07). **Nada se persiste
  hasta confirmar.**

- **CA-4 (Confirmar lo hace de verdad — CE-1).**
  Cuando el usuario confirma, entonces la posición pasa a estar **bajo el símbolo nuevo** y su
  **P/L actual vuelve a tener dato** en cuanto haya cotización (RN-06), con su `asOf` (D-2).

- **CA-5 (Las vigiladas siguen al valor, con las zonas re-escaladas).**
  Dada una acción vigilada del símbolo viejo con zonas, cuando se confirma la continuidad,
  entonces la vigilancia pasa al símbolo nuevo y **sus zonas se re-escalan ÷r** (0,80–1,00 €
  → 9,60–12,00 €), **mostrándolo en el antes/después**. No queda vigilando un fantasma ni
  dispara con zonas de la escala vieja.

- **CA-6 (Un ratio imposible se rechaza con un error legible — CE-4).**
  Cuando el ratio dejaría el linaje inconsistente (sobreventa, RN-08) o el sucesor es de otra
  divisa (RN-09), entonces se **rechaza con un mensaje que se entiende** y **nada se
  persiste** (SPEC-017 CA-8/CA-9).

- **CA-7 (Deshacer — CE-4).**
  Dada una continuidad declarada, cuando el usuario la deshace, entonces la posición vuelve
  **exactamente** a como estaba y se dice **qué se ha deshecho**. Ninguna compra ni venta se
  toca.

- **CA-8 (No se inventa nada — RN-06 intacta).**
  Dado que aún no hay cotización del símbolo nuevo, cuando se mira la cartera, entonces el P/L
  actual sigue siendo **"—"**: la continuidad arregla la **identidad**, no fabrica precios.

- **CA-9 (Aislamiento y sesión — RN-01/RN-03).**
  Sin sesión válida no se puede declarar ni deshacer; un usuario **solo** puede declarar
  continuidades sobre **sus** posiciones, y la del vecino no le afecta.

## Entidades y reglas afectadas
- **UI**: `src/app/cartera/page.tsx` + `portfolio-forms.tsx` (patrón de formularios de
  SPEC-002) y el buscador de símbolos de SPEC-008, ya usado en `/cartera/importar` y
  `/vigiladas`. Punto de entrada junto al `data-testid="fail-reason"` de SPEC-016. Design
  system `tremen-ds` (`globals.css`).
- **Dominio**: la declaración, la validación y el deshacer los aporta **SPEC-017**; esta spec
  **no** re-implementa aritmética.
- **Vigiladas**: `watched_symbols` (configuración, mutable — ADR-013 pto. 7); zonas ÷r.
- Reglas: **RN-07**, **RN-04**, **RN-06**, **RN-08**, **RN-09**, **RN-11** (zonas),
  **RN-01/RN-03**, **D-2**, **D-6**. Decisiones: **ADR-013**, **ADR-003**, **ADR-007**,
  **ADR-012**.

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **El modelo y el cálculo**: son **SPEC-017**.
- **El import**: es **SPEC-019**.
- **Declarar la continuidad desde `/vigiladas`**: una acción solo vigilada (sin posición) ya
  tiene salida hoy — quitarla y volver a añadirla eligiendo el símbolo bueno. El agujero **sin
  salida** es la cartera. Si se quisiera, es mejora posterior.
- **Sugerir el sucesor** o **proponer el ratio**: los aporta el usuario. Detectarlos es
  F-ADR-013-1, fuera de la épica.
- **Pantalla de auditoría** de continuidades declaradas: el ledger las guarda; enseñarlas es
  mejora.

## Notas para el gate humano
1. **Dónde se engancha**: en `/cartera`, **pegado al motivo que muestra SPEC-016**. Es donde te
   enteras del problema, así que es donde debe estar la salida. La épica pedía "declararla
   desde la cartera": esto lo concreta.
2. **Decisión que tomé y conviene que mires** (ADR-013 pto. 7): al mover la vigilancia al
   símbolo nuevo, **re-escalo las zonas ÷r** (CA-5). Motivo: una zona **es un precio**, y bajo
   RN-07 los precios escalan ÷r. **Dejarlas sin escalar dispararía avisos falsos en silencio**
   — la clase de fallo que EPIC-FIX vino a matar. Lo enseño en el antes/después para que sea
   **visible y rechazable**, no automático a ciegas. **Alternativa, si prefieres**: **vaciar**
   las zonas y pedirte que las vuelvas a poner. Más conservador, pero te da trabajo y deja la
   acción sin vigilar de verdad hasta que lo hagas.
3. **CA-3 es CE-2 literal**: nada se persiste hasta que ves el antes/después y confirmas. Es la
   barrera contra el ratio mal tecleado — el riesgo **R-2** de la épica: envenena el coste
   medio y es difícil de detectar porque **los números siguen pareciendo números**.
4. **CA-8 protege RN-06**: la continuidad arregla la identidad, no inventa precios. Si el
   símbolo nuevo aún no se ha cotizado, sigue el "—".
