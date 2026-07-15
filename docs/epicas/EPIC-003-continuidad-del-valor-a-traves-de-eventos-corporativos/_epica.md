---
id: EPIC-003
tipo: epica
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-07-15, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-07-15, por: humano (Alberto Fojo)}
---
# EPIC-003 — Continuidad del valor a traves de eventos corporativos

## Objetivo
Que **un valor sobreviva a los eventos que cambian su identidad**. Cuando una empresa
hace un contrasplit y cambia de nombre, o simplemente cambia de ticker, hoy la cartera
**no sabe decir que el de antes y el de ahora son la misma cosa** — y la posición se
queda coja para siempre.

El problema **no es "reasignar símbolos"**. Eso es un mecanismo, y es el mecanismo
incompleto: permitiría apuntar una fila a otro símbolo, pero se dejaría la aritmética
del **RN-07**, que es justo la mitad que falta. El problema es la **continuidad**: el
valor es el mismo, la historia es la misma, y entre medias pasó algo que cambió las
cantidades y el nombre.

### El hueco, verificado en código (2026-07-15)
El dominio tiene **media solución, dos veces, y las dos mitades no se tocan**:

1. **`recordSplit`** (`src/lib/portfolio/service.ts`) + **RN-07** hacen **la aritmética**
   —*"un split de ratio r ajusta la cantidad viva (×r) y el precio medio (÷r); no cambia
   el valor de la posición ni su P/L"*— pero **asumen que el símbolo no cambia**: buscan
   por ticker y cuelgan la transacción del mismo `symbolId`.
2. **`fusionarValor`** (`src/lib/import/identity.ts:173`) **enlaza** un valor a un símbolo
   ya resuelto, pero su propio comentario dice: *"NO re-escala cantidades ni precios: la
   reconciliación del split es manual"*. Y **solo se alcanza desde el asistente de
   import** (`fuseAction`): la tabla `symbol_aliases` está indexada por
   `(userId, brokerName, marketLabel)` — es un **traductor del `.xls` de ING**, no un
   editor de la cartera.

O sea: el ledger sabe decir *"hubo un contrasplit 12:1"* y sabe decir *"esto que el bróker
llama X es el símbolo Y"*. **Ningún mecanismo puede expresar *"el símbolo viejo y el nuevo
son el mismo valor, y entre medias hay un 12:1"***. Ese concepto de dominio **no existe**.

Verificado también: **fuera del import no hay nada que reasigne `symbolId`**. `/vigiladas`
solo tiene `watchAction`/`removeAction`; la cartera solo `recordBuy`/`recordSell`/
`recordSplit`/`recordDividend`. Ninguna toca el `symbolId` de lo ya registrado.

### Cómo salió y a quién le duele
Salió al cerrar **SPEC-016**, que hace visible *por qué* un símbolo no se cotiza. Hasta
entonces el hueco estaba **tapado por el silencio**: ahora el usuario ve *"el proveedor no
reconoce este símbolo"*… y descubre que **no puede hacer nada al respecto**. Hacer visible
el problema es lo que lo vuelve exigible.

Duele distinto según cómo entró la acción:
- **Vigilada a mano**: hay salida chapucera pero real — quitarla y volver a añadirla
  eligiendo el candidato del buscador (`watchSymbol` hace upsert por `(userId, symbolId)`).
  Pierdes las zonas y las reescribes.
- **Con posiciones en cartera**: **no hay salida**. Las transacciones cuelgan del
  `symbolId` viejo y no hay forma de continuarlas. Y el caso en que hace falta —renombrado,
  cambio de ticker— es exactamente cuando el ledger **sigue vivo** y el P/L actual se queda
  en **"—" para siempre**. Rompe **CE-3** (cartera con P/L al día) de EPIC-001 para ese
  valor.

**No es hipotético**: **PharmaMar hizo un contrasplit 12 a 1 y cambió de nombre**, y eso
viene en el extracto real de ING que originó EPIC-002. Fue una de las tres decisiones
fundacionales del import.

## Criterios de éxito
Medibles, por spec:

- **CE-1 (La posición continúa).** Dado un valor que cambió de identidad (contrasplit +
  cambio de nombre, o cambio de ticker), cuando el usuario declara la continuidad, entonces
  **la posición pasa a cotizar por el símbolo nuevo** y su **P/L actual vuelve a tener dato**
  (deja de ser "—", RN-06). Medible con el caso PharmaMar del extracto real.
- **CE-2 (La aritmética la hace la app, y se ve antes de aceptarla).** El usuario aporta el
  ratio y **confirma**; la app aplica **RN-07** (cantidad ×r, precio medio ÷r) y muestra el
  **antes/después** antes de nada. Objetivo: **0 cuentas a mano** por parte del usuario.
- **CE-3 (La historia no se falsea).** Tras la continuidad, el **P/L realizado ya
  materializado no cambia** (D-6: jamás se mezcla con el actual) y **el valor de la posición
  y su P/L tampoco** (RN-07 lo dice explícito: el split no cambia ninguno de los dos). El
  histórico sigue siendo **auditable**: se puede ver qué se compró de verdad y a qué precio.
- **CE-4 (Reversible o, al menos, no destructivo en silencio).** Declarar una continuidad
  con un ratio equivocado **no puede corromper el coste medio (RN-04) sin remedio**. El
  usuario debe poder darse cuenta y deshacerlo, o el sistema debe impedirlo.

## Alcance
- **Dentro:**
  - **Continuidad con sucesor**: el valor sigue existiendo bajo otra identidad —
    **contrasplit/split con cambio de nombre** y **cambio de ticker**. Hay un símbolo nuevo
    al que continuar. *(Decisión del gate 2026-07-15.)*
  - **Declararla desde la cartera**, no solo desde el asistente de import: es donde el
    usuario descubre el problema (SPEC-016) y donde hoy no hay salida.
  - **Aplicar RN-07 con confirmación**: el usuario da el ratio y valida el antes/después.
    *(Decisión del gate 2026-07-15.)*
  - Que las **acciones vigiladas** del valor sigan a su símbolo nuevo (que no se queden
    vigilando un fantasma).
- **Fuera (aparcado a propósito, no por descuido):**
  - **Deslistado sin sucesor** (el valor muere y no continúa en ningún sitio): es **otra
    capacidad** —cerrar o archivar una posición muerta—, no continuidad. Merece su épica;
    aquí solo se decide que **no** se resuelve. *(Decisión del gate 2026-07-15.)*
  - **Detección automática del evento**: que Marketstack exponga `split_factor`/`dividend`
    (anotado en ADR-012) lo haría más viable, pero el roadmap ya dice que automatizarlo
    *"requiere una fuente de eventos fiable"* y **esa fuente no está validada**. Sigue en
    "Más adelante". Esta épica **habilita** el camino; no lo recorre.
  - **Dividendos y fiscalidad**: `recordDividend` ya existe; su tratamiento fiscal sigue
    fuera del producto (visión: "no cubre fiscalidad").
  - **Fusiones y adquisiciones entre empresas distintas** (dos valores que se convierten en
    uno, o canjes con efectivo): es un evento **distinto** del cambio de identidad de un
    mismo valor, y su aritmética no es RN-07. Fuera hasta que haya caso real.
  - **Reescribir el histórico de cotizaciones**: solo se guarda la última por símbolo
    (ADR-004); sigue igual.

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

## Riesgos
- **R-1 (Choque con la inmutabilidad del ledger — el riesgo central).** **ADR-003** fija el
  ledger como **inmutable**. Continuar un valor obliga a responder si las transacciones
  **se mueven** al símbolo nuevo (¿reescribir el ledger?) o si los símbolos **se enlazan** y
  el ledger se lee en cadena. Es **la decisión técnica de la épica** y es de
  **sdd-arquitecto** (ADR): aquí solo se fija el requisito de producto — **la historia no se
  falsea (CE-3) y el P/L vuelve a tener dato (CE-1)**. Si las dos cosas chocan, gana CE-3:
  antes un P/L en "—" que un histórico mentiroso.
- **R-2 (Corromper el coste medio en silencio).** Un ratio equivocado envenena el coste
  medio (RN-04, que incluye gastos) y, con él, todo el P/L futuro. Y es **difícil de
  detectar**: los números siguen pareciendo números. De ahí **CE-2** (confirmación con
  antes/después) y **CE-4** (no destructivo en silencio). Es el mismo principio que R-F4 de
  EPIC-FIX: un arreglo a medias que además miente es peor que el hueco.
- **R-3 (Dos mecanismos que se solapan).** Existen ya `fusionarValor` (import) y
  `recordSplit` (cartera). Si esta épica añade un **tercero** en vez de **unificar**, el
  dominio acaba con tres formas parciales de decir lo mismo y el usuario con tres sitios
  donde intentarlo. Mitigación: que el ADR decida **una** representación del evento.
- **R-4 (Alcance que se estira).** "Eventos corporativos" invita a meter dividendos,
  fusiones, canjes y fiscalidad. El alcance dice **con sucesor y nada más**; lo demás,
  cuando haya caso real y no antes.
- **R-5 (Poco caso real para validar).** El caso vivo y documentado es **PharmaMar**. Con
  una sola muestra hay riesgo de diseñar para ella y que el segundo caso no encaje.
  Mitigación: verificar contra el extracto real de ING, que es la única fuente de verdad
  disponible hoy.

## Notas para el gate humano
Decisiones ya tomadas contigo (2026-07-15), para que las confirmes al aprobar:

1. **Va como épica propia**, no como follow-up de SPEC-016. Motivo: no es un defecto
   (EPIC-FIX es para lo que se prometió y no cumple; esto **nunca existió**) ni un pulido
   (EPIC-MEJORA). Es un **concepto de dominio ausente** que rompe CE-3 en un caso real, y
   toca **el ledger**, que es lo más delicado que hay. Encaja además con la cláusula que
   EPIC-FIX dejó escrita en su "fuera de alcance": *"si el arreglo destapa una capacidad que
   falta, va a su épica de producto, no aquí"*.
2. **Alcance: solo continuidad con sucesor.** El deslistado sin sucesor queda fuera, con
   motivo (es cerrar, no continuar).
3. **La app hace la aritmética del RN-07, con confirmación.** Ni manual del todo (te deja el
   trabajo de siempre) ni automática a ciegas (un ratio malo corrompe el coste medio en
   silencio).

Lo que **no** decido yo y hay que resolver — es **técnico, va a ADR de sdd-arquitecto**:

- **¿Mover las transacciones o enlazar los símbolos?** Es R-1, el corazón del asunto, y
  choca de frente con ADR-003. Mi requisito de producto es el de arriba: **la historia no se
  falsea**; el mecanismo es suyo.
- **¿Se unifica con `fusionarValor` y `recordSplit`, o convive?** (R-3.) Preferencia de
  producto: **una sola forma** de decir "esto continúa aquí", alcanzable desde la cartera y
  desde el import.
- **¿Qué pasa con el coste medio (RN-04) y el realizado ya materializado?** RN-07 y D-6 ya
  dan la respuesta funcional (el split **no** cambia el valor de la posición ni su P/L; el
  realizado no se toca). Falta traducirlo a datos.

**Posición en el roadmap**: propongo **"Después"** —lo primero comprometido tras EPIC-FIX—,
no "Ahora". Razón: rompe CE-3, pero **solo para los valores que han pasado por un evento
corporativo**, no para la cartera entera; EPIC-FIX era el 82% de la cartera sin cotizar y por
eso mandaba. En cuanto EPIC-FIX cierre del todo, esta es la siguiente.
