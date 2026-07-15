---
id: SPEC-017
tipo: spec
epica: EPIC-003
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-07-15, por: sdd-arquitecto}
---
# SPEC-017 — El evento de continuidad y la posicion derivada por linaje

## Problema
El dominio **no sabe decir que dos símbolos son el mismo valor**. `recordSplit` + **RN-07**
hacen la aritmética pero asumen que el símbolo no cambia; `fusionarValor` enlaza pero declara
que *no re-escala* y solo vive en el import. Nadie puede expresar *"el símbolo viejo y el
nuevo son el mismo valor, y entre medias hay un 12:1"* — el caso **PharmaMar** (contrasplit
12:1 + cambio de nombre) del extracto real.

Consecuencia: las transacciones cuelgan del símbolo viejo, la posición no continúa y el **P/L
actual se queda en "—" para siempre** (RN-06), rompiendo **CE-3 de EPIC-001** para ese valor.

Esta spec pone **el concepto que falta** en el dominio: el evento de continuidad y la posición
derivada por **linaje**. Implementa **ADR-013**. Es la base de SPEC-018 (UI) y SPEC-019
(import): sin ella no hay nada que declarar.

## Usuarios / roles afectados
- **Usuario final**: indirectamente — su posición vuelve a ser una sola y su P/L vuelve a
  tener dato. No toca nada aquí: la declaración es SPEC-018.
- **Sistema/ciclo diario**: deja de pedir cotización de símbolos muertos.

## Criterios de aceptación
Cada CA es verificable con un test de dominio (sin UI). El caso guía es **PharmaMar**:
1.200 acciones a 1 €, contrasplit **ratio = 1/12**, sucesor con ticker nuevo.

- **CA-1 (El evento existe y se persiste).**
  Dado un `split` del ledger, cuando se le da un **símbolo sucesor**, entonces se persiste
  `targetSymbolId` junto a su `ratio` y su `occurredOn`; y un `split` **sin** sucesor se
  sigue guardando y comportando **exactamente como hoy** (SPEC-002 CA-7 intacta).

- **CA-2 (La posición continúa, con la aritmética de RN-07).**
  Dadas 1.200 acciones compradas a 1 € en el símbolo viejo y una continuidad de `ratio = 1/12`
  al nuevo, cuando se deriva la posición, entonces hay **una sola posición**, bajo el símbolo
  **nuevo**, con **cantidad viva 100** y **coste medio 12 €**.

- **CA-3 (RN-07: el valor y el P/L no cambian).**
  Dada la misma posición, cuando se declara la continuidad, entonces el **coste base total
  sigue siendo 1.200 €** y el **P/L actual, a igualdad de valor de mercado, es el mismo antes
  y después**. La continuidad **no crea ni destruye valor**.

- **CA-4 (El realizado no se toca — D-6).**
  Dada una venta anterior a la continuidad con su P/L realizado ya materializado, cuando se
  declara la continuidad, entonces el **realizado no cambia** y **no se mezcla** con el actual.

- **CA-5 (La posición cotiza por el símbolo vigente).**
  Dado un linaje, cuando se deriva la posición, entonces toma **ticker, divisa y precio del
  símbolo terminal** (el vigente) — no del muerto. Con precio del nuevo, el P/L actual **deja
  de ser "—"** (RN-06).

- **CA-6 (El símbolo sucedido sale del universo de refresco).**
  Dado un símbolo con sucesor, cuando corre el ciclo (ADR-004), entonces **no se pide al
  proveedor** y **no genera diagnóstico** (SPEC-016). El aviso que destapó el problema
  **desaparece al resolverlo**.

- **CA-7 (Cadena de más de un salto).**
  Dado A→B y B→C, cuando se deriva la posición, entonces se pliega **el linaje entero** con
  los ratios **compuestos** en orden, y se reporta bajo **C**.

- **CA-8 (Integridad: no se acepta un enlace imposible).**
  Cuando se declara una continuidad, entonces se **rechaza con error legible** si: el sucesor
  es de **otra divisa** (RN-09); formaría un **ciclo**; el símbolo **ya tiene sucesor**; o
  **dos linajes convergerían** en el mismo símbolo (fusión de empresas: fuera de alcance).

- **CA-9 (Integridad: un ratio que rompería el linaje se rechaza).**
  Dada una venta posterior a la fecha de la continuidad, cuando el ratio declarado dejaría esa
  venta en **sobreventa** (RN-08), entonces la declaración se **rechaza** y **nada se
  persiste**. *(Sin esto, el fold lanza `OversellError` y la cartera entera deja de
  renderizar.)*

- **CA-10 (Deshacer restaura el estado exacto).**
  Dada una continuidad declarada, cuando se retira su evento, entonces el linaje **se parte**
  y **cada símbolo vuelve exactamente a la posición que tenía** — cantidad, coste base y
  realizado idénticos. **Ninguna compra ni venta se ha tocado.**

- **CA-11 (Orden total estable entre símbolos).**
  Dadas entradas de dos símbolos del linaje **con la misma fecha**, cuando se pliegan, entonces
  el orden es **determinista y estable** (`occurredOn`, luego `createdAt`, luego `id`) y el
  resultado no depende del orden en que se leyeron los símbolos.

- **CA-12 (Aislamiento — RN-01).**
  Dado que la continuidad la declara un usuario, cuando otro usuario deriva sus posiciones,
  entonces **no le afecta**: el enlace vive en el ledger del que lo declaró.

## Entidades y reglas afectadas
- **Ledger** (`transactions`, ADR-003): el evento `split` gana `targetSymbolId` **opcional**
  (migración `0006`). Esquema en **tres sitios en paralelo**: `src/db/schema.ts`,
  `src/db/test-db.ts` (PGlite) y `tests/e2e/server.mjs` (embedded PG).
- **Derivación** (`portfolio/service.ts`): `rawPositions` agrupa por **linaje**, no por
  `symbolId`. **`computePosition` (`portfolio/position.ts`) NO se toca**: ya es un fold ciego
  al símbolo y ya implementa RN-07 (ADR-013).
- **Universo de refresco** (`market/refresh.ts`, ADR-004): `symbolUniverse` excluye símbolos
  con sucesor.
- Reglas: **RN-07** (split), **RN-04** (coste medio con gastos), **RN-05/RN-06** (realizado /
  actual), **RN-08** (no sobreventa), **RN-09** (divisa única), **RN-01** (aislamiento),
  **D-6** (nunca mezclar). Decisiones: **ADR-013** (esta), **ADR-003** (ledger), **ADR-004**
  (ciclo), **ADR-007**/**ADR-012** (identidad).

## Fuera de alcance
Aparcado a propósito, no por descuido:
- **La UI para declararla**: es **SPEC-018**. Aquí solo el dominio y los datos.
- **El enganche del import**: es **SPEC-019**.
- **Las vigiladas siguen al símbolo nuevo y sus zonas se re-escalan**: es **SPEC-018** (ADR-013
  pto. 7), porque va con la previsualización que el usuario confirma.
- **Detección automática** del evento (`split_factor` de Marketstack): fuera de EPIC-003 por
  decisión del gate (F-ADR-013-1).
- **Deslistado sin sucesor**, **fusiones entre empresas distintas**, **dividendos/fiscalidad**:
  fuera de la épica.
- **Materializar la posición**: ADR-003 ya dijo que derivar cuesta y que materializar es
  optimización futura. Sigue siéndolo.

## Notas para el gate humano
1. **El descubrimiento que abarata la épica**: `computePosition` ya es un **fold ciego al
   símbolo** y **ya hace la aritmética de RN-07**. La continuidad **no necesita matemáticas
   nuevas**: solo cambia **qué entradas forman una posición** (`rawPositions` agrupa por linaje
   en vez de por símbolo). Por eso esta spec, siendo el corazón de la épica, toca **poco
   código** — y los tests de cálculo existentes siguen valiendo tal cual.
2. **Por qué enlazar y no mover** (R-1): mover reescribiría el ledger y diría que compraste
   100 a 12 € el día que compraste 1.200 a 1 € — una operación que **nunca ocurrió**. Lo
   prohíbe ADR-003 y lo prohíbe tu desempate (**gana CE-3**). Regalo del enlace: **deshacer
   (CA-10) sale casi gratis**.
3. **Un split es una continuidad sin cambio de identidad**, y un cambio de ticker es una
   continuidad de `ratio = 1`. Por eso **no hay un tercer mecanismo** (R-3): es el evento que
   ya existía, con una columna más.
4. **CA-9 no es cosmética**: sin ella, un ratio malo no solo falsea el P/L — hace que el fold
   lance `OversellError` y **la página de cartera deje de cargar**. Es CE-4 en su forma más
   literal.
5. **CA-6 cierra el bucle de SPEC-016**: el diagnóstico *"el proveedor no reconoce este
   símbolo"* es lo que te hace ver que hace falta una continuidad — y **desaparece solo**
   cuando la declaras.
6. **Limitación consciente**: si el sucesor cotiza en **otra divisa** (p. ej. la empresa se
   muda a NASDAQ y pasa a USD), **no se puede continuar** (CA-8), porque rompería RN-09. Es
   coherente, pero deja al usuario sin salida en ese caso. Registrado como **F-ADR-013-2**.
