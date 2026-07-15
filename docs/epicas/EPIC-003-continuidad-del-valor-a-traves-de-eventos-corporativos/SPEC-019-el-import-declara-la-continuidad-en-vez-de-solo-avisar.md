---
id: SPEC-019
tipo: spec
epica: EPIC-003
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-07-15, por: sdd-arquitecto}
---
# SPEC-019 — El import declara la continuidad en vez de solo avisar

## Problema
El asistente de import **ya detecta el caso** y **se queda a medias**. Cuando el usuario
fusiona dos nombres del bróker sobre el mismo símbolo (CA-7 de SPEC-012), `fusionarValor`
devuelve `fused = true` y la UI **avisa de un posible split a reconciliar a mano** — porque en
EPIC-002 no había forma de expresarlo: *"NO re-escala cantidades ni precios: la reconciliación
del split es manual"*.

Es exactamente el caso **PharmaMar** del extracto real: dos nombres, un contrasplit 12:1 en
medio. El import **sabe que pasó algo** y solo puede encogerse de hombros.

Con SPEC-017 el concepto ya existe. Esta spec cierra **R-3 de la épica**: **una sola forma** de
decir "esto continúa aquí", con **dos puertas de entrada** — la cartera (SPEC-018) y el import.
Sin ella, el import seguiría siendo un mecanismo paralelo y a medias, que es justo lo que la
épica pide no repetir.

## Usuarios / roles afectados
- **Usuario final**: al importar su extracto, donde antes leía *"posible split, reconcílialo a
  mano"*, ahora **puede declararlo ahí mismo** y seguir. No tiene que acordarse de ir a la
  cartera después.

## Criterios de aceptación
Los CA de UI se verifican con Playwright (patrón SPEC-014). Fixtures **sintéticos**
(`buildIngXls`): el extracto real es dato personal y **no se commitea**.

- **CA-1 (Donde antes solo se avisaba, ahora se puede declarar).**
  Dado un valor del extracto que se fusiona sobre un símbolo ya resuelto (`fused = true`),
  cuando el asistente lo señala, entonces ofrece **declarar la continuidad** con su ratio, en
  vez de limitarse a *"reconcílialo a mano"*.

- **CA-2 (Es el MISMO evento — R-3).**
  Cuando la continuidad se declara desde el import, entonces se persiste **el mismo evento del
  ledger** que declara SPEC-018 (`split` con `targetSymbolId`, ADR-013): **una representación,
  dos puertas**. No hay un camino paralelo ni una tabla propia.

- **CA-3 (Las mismas reglas de integridad).**
  Cuando el ratio o el sucesor son imposibles (otra divisa RN-09, ciclo, sobreventa RN-08),
  entonces el import **rechaza con el mismo error legible** que SPEC-018 y **no importa nada**
  de esa continuidad. Las reglas viven en el dominio (SPEC-017), no duplicadas aquí.

- **CA-4 (Declararla es opcional: el import no se bloquea).**
  Dado el aviso de fusión, cuando el usuario **no** declara la continuidad, entonces el import
  **sigue funcionando como hoy** (SPEC-012/SPEC-013 intactas): se avisa y se importa. Declarar
  es una **salida ofrecida**, no un peaje.

- **CA-5 (Idempotencia — ADR-010).**
  Dado un extracto ya importado con su continuidad declarada, cuando se **re-importa el mismo
  fichero**, entonces **no se duplica** ni la operación ni la continuidad, y la posición
  resultante es **idéntica**.

- **CA-6 (El alias sigue siendo del bróker).**
  Cuando se declara la continuidad desde el import, entonces `symbol_aliases` **conserva su
  papel** —traducir `(nombre de bróker, mercado)` → símbolo (ADR-009)— y **no** se convierte en
  el registro del evento: ese vive en el ledger (ADR-013 pto. 4).

- **CA-7 (Aislamiento — RN-01/RN-03).**
  Sin sesión válida no se declara nada; la continuidad declarada al importar es **del usuario
  que importa** y no afecta a nadie más.

## Entidades y reglas afectadas
- **Import**: `src/lib/import/identity.ts` (`fusionarValor`, `confirmarSeleccion`,
  `runResolucion`) y `src/app/cartera/importar/` (`actions.ts` → `fuseAction`, y el paso 2 del
  asistente de SPEC-014).
- **Dominio**: el evento, la validación y el fold los aporta **SPEC-017**. Esta spec **solo
  conecta**: no re-implementa aritmética ni reglas.
- **`symbol_aliases`** (ADR-009): sin cambios de papel ni de esquema.
- Reglas: **RN-07**, **RN-08**, **RN-09**, **RN-01/RN-03**. Decisiones: **ADR-013** (una
  representación), **ADR-009** (arquitectura del import), **ADR-010** (idempotencia),
  **ADR-011** (divisa y gastos del import).

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **Deducir el ratio del propio extracto** (que el `.xls` de ING diga que hubo un 12:1): sería
  cómodo, pero es **detección** — F-ADR-013-1, fuera de la épica por decisión del gate. El
  usuario aporta el ratio.
- **Re-escalar operaciones ya importadas** del valor viejo: **no se toca el ledger** (ADR-013
  pto. 1). La continuidad se declara y el fold hace el resto.
- **Otros brókers y formatos**: EPIC-002 v1 lee el `.xls` de ING; sigue igual.
- **El modelo** (SPEC-017) y **la cartera** (SPEC-018).

## Notas para el gate humano
1. **Esta es la spec que cierra R-3.** Sin ella la épica funciona —tendrías la salida en la
   cartera— pero el import se queda con **su media solución** (`fused = true` → "reconcílialo a
   mano"), y el dominio con **dos formas** de hablar del mismo evento. Tú pediste
   explícitamente **una sola**.
2. **Es la más pequeña de las tres y la más fácil de aplazar.** Si quieres una épica más corta,
   esta es la candidata: SPEC-017 + SPEC-018 ya cumplen CE-1..CE-4. El coste de aplazarla es
   dejar el aviso a medias del import vivo y aceptar R-3 como deuda **consciente**.
3. **Es el caso real que originó todo**: PharmaMar entró **por el import**. Que el sitio donde
   el problema aparece por primera vez sea también donde se puede resolver tiene valor: es la
   misma lógica por la que SPEC-018 se engancha al motivo de SPEC-016.
4. **CA-4 es deliberado**: declarar es **opcional**. El import ya funciona y no se le pone un
   peaje nuevo — si el usuario no sabe el ratio en ese momento, sigue y lo hace luego desde la
   cartera.
