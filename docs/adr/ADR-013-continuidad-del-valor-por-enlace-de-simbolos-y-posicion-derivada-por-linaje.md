---
id: ADR-013
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-07-15, por: sdd-arquitecto}
---
# ADR-013: Continuidad del valor por enlace de simbolos y posicion derivada por linaje

- Deciders: propone **sdd-arquitecto**; aprueba el **humano** (gate). Origina EPIC-003, aprobada en el gate del 2026-07-15 con dos decisiones de producto: **alcance solo continuidad con sucesor** y **la app aplica RN-07 con confirmación**.
- Specs relacionadas: origina **SPEC-017** (evento y posición por linaje), **SPEC-018** (declararla desde la cartera) y **SPEC-019** (unificar el import). **Reinterpreta ADR-003** (modelo de cartera) extendiendo su modelo de eventos; **no lo supersede**. Consume **ADR-007**/**ADR-012** (identidad del símbolo) y **ADR-004** (universo de refresco). Toca `fusionarValor` de **ADR-009**.

## Contexto

**El hueco, verificado en código (2026-07-15).** El dominio tiene **media solución dos
veces, y las dos mitades no se tocan**:

1. **`recordSplit`** (`portfolio/service.ts`) + **RN-07** hacen **la aritmética** —*"un
   split de ratio r ajusta la cantidad viva (×r) y el precio medio (÷r); no cambia el valor
   de la posición ni su P/L"*— pero **asumen que el símbolo no cambia**: buscan por ticker y
   cuelgan la transacción del mismo `symbolId`.
2. **`fusionarValor`** (`import/identity.ts:173`) **enlaza** un valor a un símbolo ya
   resuelto, pero declara *"NO re-escala cantidades ni precios: la reconciliación del split
   es manual"*, y solo se alcanza desde el asistente de import: `symbol_aliases` está
   indexada por `(userId, brokerName, marketLabel)` — es un **traductor del `.xls` de ING**.

**Ningún mecanismo puede expresar *"el símbolo viejo y el nuevo son el mismo valor, y entre
medias hay un 12:1"***. Fuera del import, **nada reasigna `symbolId`**. Caso real: **PharmaMar,
contrasplit 12:1 + cambio de nombre**, en el extracto de ING que originó EPIC-002.

**Lo destapó SPEC-016**: ahora el usuario **ve** *"El proveedor no reconoce este símbolo"*…
y descubre que no puede hacer nada. Antes el hueco estaba tapado por el silencio.

**Hallazgo que decide el diseño (verificado leyendo el código).** `computePosition`
(`portfolio/position.ts`) es un **fold puro y CIEGO AL SÍMBOLO**: recibe una lista de
`LedgerEntry`, la ordena por `occurredOn`+`seq` y la pliega. **Ya implementa RN-07**
(`case 'split': qty = qty.times(r)`, dejando `costTotal` intacto → el coste medio queda ÷r).
Quien agrupa por símbolo es `rawPositions` (`service.ts:185`), con un `Map` `bySymbol`.

> **La aritmética de la continuidad ya está escrita y probada. Lo único que falta es
> decidir qué entradas forman una posición.** No hay que tocar `computePosition`.

**La tensión (R-1 de la épica).** ADR-003 fija el ledger como **inmutable** y la posición
como **derivada**. Continuar un valor obliga a elegir: ¿las transacciones **se mueven** al
símbolo nuevo, o los símbolos **se enlazan** y el ledger se lee **en cadena**? Producto fijó
el desempate: **si CE-1 (el P/L vuelve) y CE-3 (la historia no se falsea) chocan, gana CE-3**.

## Decisión

1. **No se mueve nada: se ENLAZAN los símbolos y la posición se deriva por LINAJE.** Lo
   dicta el propio ADR-003, que ya se comprometió a *"el ledger da precio medio, ventas
   parciales y **eventos corporativos sin reescritura**"* y *"auditable e inmutable: el
   histórico de operaciones es la fuente; el P/L se recalcula"*. **Ninguna transacción se
   modifica jamás.** CE-3 se cumple **por construcción**, no por disciplina.

2. **El evento de continuidad es el `split` que YA EXISTE, con un `targetSymbolId`
   opcional.** No se añade un tercer mecanismo (R-3): se le da al evento que ya modela la
   aritmética la capacidad de **nombrar un sucesor**.
   - `split` con `targetSymbolId` **null** → exactamente lo de hoy (SPEC-002 CA-7 **intacta**).
   - `split` con `targetSymbolId` → *"desde `occurredOn`, esta posición **continúa** en ese
     símbolo, con cantidad ×r y precio medio ÷r"*.
   - **Un cambio de ticker o de nombre sin split es `ratio = 1` con sucesor.** La identidad
     cambia; la aritmética es la identidad.
   - **PharmaMar es `ratio = 1/12` con sucesor**: 1.200 acciones a 1 € → 100 a 12 €.
   El evento cuelga del símbolo **viejo** (`symbolId` = el que termina, `targetSymbolId` = el
   que sigue) y vive en el ledger del usuario → **aislado por RN-01 sin nada extra**.

3. **La posición se deriva por linaje, no por símbolo.** `rawPositions` agrupa por **linaje**
   (la cadena de símbolos enlazados) en vez de por `symbolId`, y pliega **todas** las
   entradas del linaje con `computePosition`, **sin cambiarlo**. La posición se reporta bajo
   el **símbolo terminal** (el vigente), que es el que cotiza y da el ticker y la divisa.

4. **`symbol_aliases` NO es la base y no se toca.** Está indexada por el **nombre del bróker**:
   es *parsing* del `.xls`, no un evento de dominio. Sigue igual. Lo que gana el import
   (SPEC-019) es **declarar el mismo evento del ledger** — una sola representación (R-3),
   dos puertas de entrada.

5. **Reglas de integridad del enlace** (sirven a CE-4). Se **rechaza** declarar una
   continuidad que:
   - lleve a un símbolo de **otra divisa** → rompería **RN-09** (divisa única por posición);
   - forme un **ciclo** (A→B→A);
   - dé a un símbolo **más de un sucesor** por usuario;
   - **haga converger dos linajes** en el mismo símbolo → eso es una **fusión de empresas**,
     explícitamente **fuera del alcance** de EPIC-003;
   - deje el linaje **inconsistente**, p. ej. un ratio que haga que una venta posterior
     quede en **sobreventa** (RN-08). *(Sin esta regla, un ratio malo no solo falsea el P/L:
     hace que `computePosition` lance `OversellError` y la cartera entera deje de
     renderizar.)*

6. **El símbolo sucedido sale del universo de refresco.** `symbolUniverse` (ADR-004) hoy
   incluye todo símbolo referenciado por una transacción → el símbolo muerto se seguiría
   pidiendo al proveedor, fallaría y generaría un diagnóstico de SPEC-016 **para siempre**.
   Un símbolo con sucesor **deja de pedirse**. Cierra el círculo: el aviso que destapó el
   problema **desaparece cuando el problema se resuelve**.

7. **Las vigiladas siguen al símbolo nuevo, con sus zonas re-escaladas ÷r.**
   `watched_symbols` **no es el ledger**: es configuración del usuario, ya mutable
   (`watchSymbol` actualiza zonas). Se mueve la fila al símbolo terminal. **Y las zonas se
   re-escalan ÷r**, igual que el precio medio: una zona de compra de 0,80–1,00 € tras un
   contrasplit 12:1 es 9,60–12,00 €. **Dejarlas sin escalar dispararía avisos falsos en
   silencio** — la clase exacta de fallo que EPIC-FIX vino a matar. El re-escalado entra en
   la previsualización que el usuario confirma (CE-2), así que es **visible**, no automático
   a ciegas.

8. **Deshacer = retirar el evento de continuidad.** Es posible **sin falsear nada
   precisamente porque no se movió ninguna compra ni venta**: se parte el linaje y cada
   símbolo vuelve **exactamente** a su posición anterior. No se borran `buy`/`sell`/
   `dividend`: esos son hechos que le pasaron al dinero del usuario. Un enlace de identidad
   **declarado por el usuario** es una afirmación sobre el mundo, y una afirmación se puede
   retractar.

## Consecuencias

### Positivas
- **CE-3 sale gratis**: si no se reescribe, no se puede falsear. El histórico sigue diciendo
  *"compré 1.200 a 1 €"*, que es lo que pasó de verdad.
- **CE-4 sale casi gratis**: la reversibilidad es una consecuencia del enlace, no una
  funcionalidad que haya que construir y mantener.
- **La aritmética no se toca**: `computePosition`, `costeMedio` y `plActual` quedan
  **intactos** y sus tests siguen valiendo. RN-07/RN-04/RN-06/D-6 se respetan porque los
  respeta el código que ya estaba. El cambio es **dónde se corta el grupo**, no cómo se suma.
- **R-3 resuelto sin un tercer mecanismo**: un evento (`split`), dos formas de usarlo.
  `recordSplit` es el caso degenerado de la continuidad.
- **Cierra el bucle de SPEC-016**: el diagnóstico que hace visible el problema desaparece
  solo cuando el usuario lo resuelve (punto 6).
- **Encaja con ADR-003 sin superseder**: se añade una columna a un tipo de evento existente.
  ADR-003 sigue vigente entero.

### Negativas / follow-ups
- **La derivación se complica**: `rawPositions` pasa de un `Map` por símbolo a resolver una
  cadena. ADR-003 ya avisó de que derivar cuesta y que materializar sería la salida si
  molesta; esto añade un poco más. **Sigue siendo optimización futura, no ahora.**
- **`symbols` se llena de símbolos muertos**: el viejo no se borra nunca (lo referencian
  transacciones). Es correcto —es historia— pero el registro crece. Sin acción.
- **El ratio lo teclea el usuario**: no hay validación contra la realidad del mercado. Un
  12:1 tecleado como 1:12 pasa las reglas del punto 5 (no rompe la integridad) pero da un
  P/L absurdo. Mitigación: la previsualización antes/después (CE-2) lo enseña; el usuario
  es quien sabe cuántas acciones tiene. **Detectarlo solo con `split_factor` de Marketstack
  es F-ADR-013-1**, fuera de EPIC-003 por decisión del gate.
- **`seq` entre símbolos**: `computePosition` desempata por `occurredOn`+`seq`. Al mezclar
  entradas de varios símbolos hay que garantizar un orden total estable; la query ya ordena
  por `occurredOn, createdAt, id`, así que basta con preservarlo al concatenar. **Detalle
  fino que la spec debe fijar y probar.**
- **Divisa distinta = no se puede continuar** (punto 5). Si una empresa se muda de BME (EUR)
  a NASDAQ (USD), el usuario se queda sin salida dentro de este alcance. Es coherente con
  RN-09, pero es una limitación real: **F-ADR-013-2**, a reevaluar si aparece el caso.

## Alternativas consideradas

- **Mover las transacciones al símbolo nuevo** (`UPDATE ... SET symbol_id = nuevo, quantity =
  quantity/12, price = price*12`). **Rechazada, y es la alternativa importante.** Reescribe
  el ledger, que es justo lo que ADR-003 prohíbe. Falsea la historia: pasarías a "haber
  comprado" 100 acciones a 12 € el día en que compraste 1.200 a 1 € — **una operación que
  nunca ocurrió**. Rompe **CE-3**, y producto ya dijo que en el choque **gana CE-3**. Además
  destruye la reversibilidad: para deshacer habría que recordar el estado previo. Y arrastra
  el `importKey` de ADR-010 (idempotencia): re-importar el extracto volvería a crear las
  filas originales, que ahora chocarían con las movidas.
- **Tabla propia `symbol_successions`** (symbolId → successor, ratio, userId). Rechazada:
  crea un **segundo sitio** donde vive un evento de la cartera, cuando el ledger ya existe y
  ya es por usuario, ya está aislado (RN-01) y ya se pliega. Sería R-3 otra vez — el
  problema que la épica pide no repetir.
- **Continuidad global (compartida por todos los usuarios)**, como `symbols` o `quotes`. Es
  tentadora —un contrasplit es un hecho **del mercado**, no de un usuario— y evitaría que
  cada uno declare PharmaMar por su cuenta. **Rechazada para v1**: el ratio lo teclea una
  persona, y un error de uno **corrompería la cartera de todos**, rompiendo RN-01 con un
  radio de explosión enorme. El coste (cada usuario lo declara) es aceptable; el riesgo, no.
  Reevaluable si algún día hay una **fuente de eventos fiable** (F-ADR-013-1).
- **Un tipo de evento nuevo `continuity`**, distinto de `split`. Rechazada: sería un tercer
  mecanismo con la **misma aritmética** que `split`. Un split *es* una continuidad sin cambio
  de identidad; modelarlos por separado duplicaría RN-07 en dos sitios.
- **Resolver la continuidad solo en la UI** (mostrar las dos posiciones juntas sin unificar
  el cálculo). Rechazada: el P/L, el coste medio y RN-08 seguirían mal; sería maquillaje.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
