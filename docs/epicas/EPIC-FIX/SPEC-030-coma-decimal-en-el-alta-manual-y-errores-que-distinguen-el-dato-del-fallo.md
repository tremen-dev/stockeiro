---
id: SPEC-030
tipo: spec
epica: EPIC-FIX
estado: en-revision
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-08-18, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-08-18, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-08-18, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-08-18, por: sdd-implementador}
---
# SPEC-030 — Coma decimal en el alta manual y errores que distinguen el dato del fallo

## Problema

El usuario es español, escribe los decimales con **coma**, y la app **le dice que sus datos
son inválidos sin decirle qué**.

Reportado por el humano en producción el 2026-08-18: vigilar `UPWK` con una zona devolvía
«**Datos inválidos.**». La búsqueda funcionaba y el símbolo se elegía bien; fallaba al
**guardar**. Confirmado por él mismo: «*usé coma, no punto. con punto acabo de probar y
funciona*».

### Causa raíz — la coma llega cruda a `decimal.js`

`src/lib/watchlist/service.ts:30` (`str`) y `:38` (`validatePair`) construyen
`new Decimal(...)` con **el string tal cual salió del formulario**. Comprobado con la
`decimal.js` del propio proyecto:

```
"12,5"     -> THROW [DecimalError] Invalid argument: 12,5
"1.234,56" -> THROW [DecimalError] Invalid argument: 1.234,56
"12€"      -> THROW [DecimalError] Invalid argument: 12€
"12.5"     -> 12.5   OK
```

Ese `throw` **no** es `InvalidZoneError`, así que cae en el `catch` genérico de
`src/app/vigiladas/actions.ts:41-44`:

```ts
} catch (e) {
  if (e instanceof InvalidZoneError) return { error: e.message };
  return { error: 'Datos inválidos.' };   // ← todo lo demás acaba aquí
}
```

### Dos defectos, no uno

1. **La coma decimal se rechaza.** Los campos son texto libre con `inputMode="decimal"`
   (`watch-form.tsx:27-35`, `portfolio-forms.tsx:14-22`) y **no hay ninguna normalización de
   coma en el alta manual**. El usuario escribe como escribe su idioma y la app lo rechaza.
   No es un caso de borde: **todos** los testers serán españoles.
2. **El error es opaco y mezcla dos cosas incompatibles.** «Datos inválidos.» significa hoy, a
   la vez: *"has escrito mal un número"* (culpa del dato, con arreglo evidente) y *"se ha
   caído la base de datos"* (culpa nuestra, sin arreglo posible por su parte). Y **no se
   registra nada**: el `catch` se traga la excepción sin log, así que un fallo de
   infraestructura en producción es **invisible** para nosotros e **inaccionable** para él.
   Es el patrón de fallo mudo que **CE-F2** persigue.

### Alcance real: mayor que `/vigiladas`

El mismo `catch` ciego está en **`src/app/cartera/actions.ts:46-48`** (registrar compra:
`quantity`, `price`, `gastos`) y **`:76-80`** (registrar venta, donde además ya convive con
`OversellError` y `NoPositionError` bien tratados, lo que hace más visible que el `default` es
un cajón de sastre). Los tres puntos de entrada manual de números del producto tienen el mismo
defecto y el mismo arreglo.

### Aviso para quien implemente: NO reutilizar el parser del import

El único `replace(/,/g, '')` del repositorio está en
**`src/lib/import/ing-xls-reader.ts:36`**, y ahí la coma es **separador de MILES en-US** (así
la exporta el informe de ING). Hace **exactamente lo contrario** de lo que aquí hace falta:
aplicado a `12,5` daría **125**, un error silencioso de dos órdenes de magnitud en una zona de
compra. Es código correcto **en su contexto** y debe quedarse como está (CA-15).

### Encaje en la épica

Rompe **CA-1/CA-2 de SPEC-003** (vigilar con zonas) y **CA-1 de SPEC-002** (registrar compra)
para cualquier importe con decimales escrito en español: capacidades dadas por `hecho` que no
cumplen su promesa con el uso real (**CE-F1**), fallando de forma ilegible (**CE-F2**).

## Usuarios / roles afectados

- **Usuario final (el humano y los testers españoles del foro).** Escribe `12,5` porque es su
  idioma. Debe poder guardar zonas y operaciones con coma, y cuando de verdad se equivoque,
  **saber en qué campo y qué se espera** en vez de leer «Datos inválidos.».
- **Nosotros, operando la app.** Un fallo de infraestructura en producción debe **dejar
  traza**; hoy se lo traga el `catch`.

## Criterios de aceptación

Cada CA es verificable con un test. CA-1..CA-9 son de función pura (Vitest, fichero nuevo
`tests/decimal-input.test.ts`). CA-10..CA-14 son de servicio/mapeo de errores (Vitest). CA-15
es de regresión. CA-16 y CA-17 son e2e (Playwright).

### El número se entiende como lo escribe un español

- **CA-1 (Coma decimal — el caso reportado).**
  Dado el valor `"12,5"` escrito en un campo numérico del alta manual,
  cuando se normaliza,
  entonces el resultado es el decimal **`12.5`** y **no lanza**.
  *Este es el caso exacto que el humano reportó; es el test que fija el defecto.*

- **CA-2 (El punto sigue funcionando — no regresión).**
  Dados `"12.5"`, `"100"`, `"0.001"`,
  cuando se normalizan,
  entonces dan `12.5`, `100` y `0.001`. El comportamiento que **hoy** funciona no cambia.

- **CA-3 (Espacios, incluido el no separable).**
  Dados `"1 234,56"` y `"1 234,56"` (espacio no separable, el que llega al pegar desde
  Excel o desde una web),
  cuando se normalizan,
  entonces dan **`1234.56`**: los espacios interiores se eliminan como separador de miles.

- **CA-4 (Miles y decimales, en los dos dialectos).**
  Dados `"1.234,56"` (español) y `"1,234.56"` (inglés),
  cuando se normalizan,
  entonces **ambos** dan `1234.56`: cuando aparecen los dos separadores, **el de más a la
  derecha es el decimal** y el otro son miles.

- **CA-5 (Separador repetido: ambiguo, se rechaza).**
  Dados `"1,234,567"` (solo comas, varias) y `"1.234.567"` (solo puntos, varios),
  cuando se normalizan,
  entonces **se rechazan** con un error de dato, **no** se interpretan. Se aplica la misma
  política que ADR-012: **no se adivina** — adivinar mal aquí es un error de tres órdenes de
  magnitud en una zona de compra, y silencioso.

- **CA-6 (Separador único seguido de exactamente 3 dígitos: ambiguo, se rechaza).**
  Dado un valor con **un solo** separador (coma o punto, una sola aparición) al que siguen
  **exactamente tres dígitos**, y cuya parte entera es un **grupo de miles plausible** —de 1 a
  3 dígitos y sin cero a la izquierda—,
  cuando se normaliza,
  entonces **se rechaza** con error de dato: `1.234` **no** se lee como 1,234 **ni** como
  1234, se pregunta. La regla es **simétrica**: coma y punto se tratan igual, porque la
  ambigüedad es la misma en los dos dialectos.
  *Decisión del humano en el gate del 2026-08-18*, que **sustituye** a la regla «un solo
  separador siempre es decimal» de la primera redacción de esta spec. Motivo: **es dinero**, y
  un malentendido silencioso en una zona de compra es peor que un error que obliga a reescribir
  cuatro caracteres.

  La tabla de casos límite fija **los dos lados**, y el test debe cubrir las dos columnas:

  | Valor | Resultado | Por qué |
  |---|---|---|
  | `12,5` | `12.5` | 1 dígito tras el separador → decimal |
  | `12.5` | `12.5` | ídem; el comportamiento que hoy funciona no se toca |
  | `12,75` | `12.75` | 2 dígitos → decimal |
  | `1,2345` | `1.2345` | 4 dígitos → ningún dialecto agrupa de cuatro en cuatro → decimal |
  | `0.001` | `0.001` | parte entera `0`: **ningún grupo de miles empieza por cero** → decimal (**CA-2 sigue en pie**) |
  | `0,500` | `0.5` | mismo motivo: `0` no puede ser un grupo de miles |
  | `1234,567` | `1234.567` | parte entera de 4 dígitos: como miles habría que haber escrito `1.234,567` → decimal |
  | `1.234,56` | `1234.56` | hay **dos** separadores distintos: decide CA-4, no este CA |
  | `1,234.56` | `1234.56` | ídem |
  | `1.234` | **rechazado** | ¿1,234 o mil doscientos treinta y cuatro? No se adivina |
  | `1,234` | **rechazado** | simétrico del anterior |
  | `12,345` | **rechazado** | parte entera `12`, grupo de miles plausible |
  | `123.456` | **rechazado** | parte entera `123`, grupo de miles plausible |
  | `10,000` | **rechazado** | ¿diez mil o diez con tres decimales? |

  El detalle del **grupo de miles plausible** no es adorno: si alguien "simplifica" la regla a
  «tres dígitos detrás → rechazo», las filas de `0.001`, `0,500` y `1234,567` lo tumban. Son
  las que impiden que esta enmienda rompa lo que ya funcionaba.

- **CA-7 (El rechazo por ambigüedad dice qué escribir).**
  Dado un valor rechazado por CA-5 o por CA-6,
  cuando se compone el mensaje para el usuario,
  entonces el texto **no se limita a decir que el valor no vale**: muestra el valor rechazado y
  nombra las **dos salidas concretas** —escribirlo **sin separador de miles** (`1234`) o **con
  los decimales explícitos** (`1234,00`)—.
  Es un motivo de rechazo **distinguible** del de CA-8 (algo que no es un número en absoluto):
  el error de dato lleva su motivo clasificado, y el test asserta las dos direcciones —que el
  mensaje del ambiguo trae la orientación y que el de `"abc"` **no** la finge—.

- **CA-8 (Lo que no es un número se rechaza como dato, no como fallo).**
  Dados `"12€"`, `"abc"`, `"-"`, `"1e3"`, `"12,5,3"`,
  cuando se normalizan,
  entonces todos producen un error de **dato** identificable (no una `DecimalError` cruda que
  se escape al `catch` genérico), y **ninguno** llega a `new Decimal`.

- **CA-9 (El vacío sigue significando "no informado").**
  Dado un campo **opcional** vacío o solo con espacios (zonas de compra/venta, gastos),
  cuando se normaliza,
  entonces se trata como **ausente** (`null`), no como error: la semántica actual de
  `has()`/`str()` (`watchlist/service.ts:25-30`) y de `gastos` (`cartera/actions.ts:23`) se
  conserva intacta, y la validación de par incompleto de **RN-10** sigue siendo la que decide
  (CA-14).

### El error dice qué pasa, y de quién es la culpa

- **CA-10 (Error de dato: nombra el campo y el valor).**
  Dado un valor no numérico en un campo concreto (p. ej. `"12,5,3"` en *Zona de compra
  (mínimo)*),
  cuando se intenta guardar,
  entonces el mensaje **nombra el campo**, **muestra el valor rechazado** y **dice qué se
  espera** (cifras con coma o punto decimal, con un ejemplo). No es «Datos inválidos.».

- **CA-11 (Error de infraestructura: mensaje distinto y con traza).**
  Dado un fallo **no** atribuible al dato (p. ej. la escritura en base de datos lanza),
  cuando se intenta guardar,
  entonces (a) el usuario lee un mensaje **distinguible** del de dato, que dice que el fallo
  es **nuestro** y que reintente; y (b) queda **traza en el log del servidor** con la acción y
  la excepción original. Hoy no hay ni lo uno ni lo otro.

- **CA-12 (Los dos errores no se confunden).**
  Dados los dos escenarios anteriores,
  cuando se comparan sus salidas,
  entonces los mensajes son **distintos** y el de dato **no** escribe log de infraestructura
  (el test asserta las dos direcciones, no solo la propia — patrón de SPEC-016 CA-3).

- **CA-13 (Los tres puntos de entrada manual quedan cubiertos, sin puerta trasera).**
  Dados **todos** los campos numéricos de texto libre del alta manual —`buyMin`, `buyMax`,
  `sellMin`, `sellMax` (`/vigiladas`); `quantity`, `price`, `gastos` de compra y de venta
  (`/cartera`)—,
  cuando se envía cada uno con coma decimal,
  entonces **todos** la aceptan. Requisito de diseño verificable: los tres puntos leen sus
  números por **una sola puerta** (un helper común), de modo que añadir un campo numérico
  nuevo sin normalizarlo sea difícil, no una cuestión de acordarse.

- **CA-14 (Los errores de dominio que ya existían siguen intactos).**
  Dados (a) una zona con solo el mínimo, (b) una zona con mínimo > máximo, (c) una venta por
  encima de la cantidad viva y (d) una venta sin posición,
  cuando se intenta guardar,
  entonces siguen saliendo **sus** mensajes de siempre (`InvalidZoneError` de **RN-10**,
  `OversellError` de **RN-08**, `NoPositionError`) y **no** el mensaje genérico ni el de
  número mal escrito. La comparación `min > max` se hace sobre los valores **ya
  normalizados**, así que `"12,5"` y `"13"` forman una zona válida y `"13"`/`"12,5"` una
  inválida.

### Lo que no debe moverse

- **CA-15 (El parser del import no se toca y sigue con su semántica en-US).**
  Dada la suite de `tests/ing-statement-reader.test.ts` y `tests/import-register.test.ts`,
  cuando se aplica esta spec,
  entonces pasan **sin modificar ninguna expectativa**: en `ing-xls-reader.ts:36` la coma
  sigue siendo **separador de miles** (`"1,234.56"` del informe de ING → `1234.56`) y ese
  fichero **no** usa el normalizador nuevo. El test es la garantía de que nadie "unifica" los
  dos parsers.
  Se asserta también el **otro** lado del mismo error: el normalizador se aplica **solo en la
  puerta del alta manual** (las server actions de `/vigiladas` y `/cartera`), nunca a los
  precios que llegan del proveedor. Hay literales vivos que CA-6 rechazaría si alguien lo
  colara ahí —`'11.984'` y `'3.615'` en `src/lib/market/quote-provider-factory.ts:12-13`,
  `'12.852'` en `tests/market-provider-dialect.test.ts`, `'280.093'` en
  `tests/ing-statement-reader.test.ts`—: son datos de máquina en formato en-US, no texto de
  una persona, y su suite tiene que seguir verde sin tocar una expectativa.

### El usuario lo ve funcionar

- **CA-16 (Vigilar con coma, en el navegador).**
  Dado un usuario autenticado en `/vigiladas` que elige una acción del buscador,
  cuando escribe la zona de compra como **`12,5` / `13,5`** y pulsa Vigilar,
  entonces la fila aparece en la tabla con esa zona, **sin mensaje de error**, y el estado de
  zona se evalúa contra `12.5`–`13.5` (**RN-11**).

- **CA-17 (Comprar con coma, en el navegador).**
  Dado un usuario autenticado en `/cartera`,
  cuando registra una compra con cantidad `1,5`, precio `12,5` y gastos `0,95`,
  entonces la posición aparece con esos importes, sin mensaje de error, y el coste base
  refleja `1,5 × 12,5 + 0,95` (**RN-04**).

## Entidades y reglas afectadas

### Ningún cambio de esquema, ningún ADR

Esto **no decide nada nuevo**: cumple lo que las reglas ya dicen (**RN-04**, **RN-05**,
**RN-10**) con la entrada que el usuario real escribe. No hay migración, no hay entidad nueva y
**no hace falta ADR** — igual que el defecto B de SPEC-024, que era la aplicación pendiente de
una decisión ya tomada. Es cableado y una función pura.

### Módulo nuevo: normalización de entrada numérica

- **`src/lib/format/decimal-input.ts`** (nombre orientativo; identificadores en inglés). Una
  función pura, sin dependencias de framework, con esta política **en este orden**:
  1. Recortar y **eliminar los espacios interiores**, incluidos `U+00A0` y `U+202F` (CA-3).
  2. Cadena vacía → **ausente** (`null`), no error (CA-9).
  3. Si están **los dos** separadores: el **de más a la derecha** es el decimal; las
     apariciones del otro se eliminan. Si el decimal aparece más de una vez → ambiguo (CA-4).
  4. Si hay **un solo tipo** de separador y aparece **más de una vez** → **ambiguo, se
     rechaza** (CA-5). Aplica igual a la coma y al punto.
  5. Si hay **un solo** separador (una sola aparición, coma o punto):
     - si le siguen **exactamente 3 dígitos** **y** la parte entera es un **grupo de miles
       plausible** (1 a 3 dígitos, sin cero inicial) → **ambiguo, se rechaza** (CA-6);
     - en cualquier otro caso → es el **decimal** (`12,5`, `12.5`, `1,2345`, `0.001`,
       `0,500`, `1234,567`). La condición del grupo de miles es la que salva estos tres
       últimos: sin ella, la enmienda del gate rompería CA-2.
  6. Validar el resultado contra una forma numérica **estricta** (signo opcional, dígitos,
     un punto decimal opcional). Todo lo demás → error de dato (CA-8). Esto rechaza también la
     notación científica (`1e3`), que `decimal.js` aceptaría: nadie teclea eso en una zona de
     compra, y aceptarla solo amplía la superficie de sorpresas.
  7. Solo entonces, `new Decimal(...)`, que por construcción **ya no puede lanzar**.
- **`InvalidNumberError`**, error de dominio hermano de `InvalidZoneError`
  (`watchlist/service.ts:11`), que lleva **el campo** (su etiqueta en español, la que ve el
  usuario), **el valor rechazado** y **el motivo clasificado** —`no_es_numero` (CA-8) o
  `ambiguo` (CA-5/CA-6)—, para que el mensaje de CA-10 se pueda componer sin que la capa de UI
  adivine nada. El motivo no es cosmético: es lo que permite que el ambiguo añada la
  orientación de **CA-7** (`1234` o `1234,00`) y que `"abc"` no la lleve. Vocabulario cerrado
  del dominio, como `QuoteFailureReason` (SPEC-016).
- **Un solo lector de campos numéricos** (CA-13): un helper que, dado el `FormData`, el nombre
  del campo y su etiqueta, devuelve el valor normalizado o lanza `InvalidNumberError`. Los
  campos **opcionales** devuelven `null` cuando vienen vacíos. Es la "única puerta".

### Dónde se aplica, y por qué ahí

En la **frontera de entrada** (las server actions), **no** dentro de los servicios de dominio:

- `src/app/vigiladas/actions.ts` — `watchAction` (l. 34-38: `buyMin`/`buyMax`/`sellMin`/`sellMax`).
- `src/app/cartera/actions.ts` — `addBuyAction` (l. 43) y `addSellAction` (l. 70-74).

El motivo: lo que llega por el formulario es **texto de una persona con un idioma**; lo que el
servicio recibe (`Decimal.Value`) es un valor de dominio. Meter la interpretación de locale en
`watchSymbol`/`recordBuy` haría que **el import y cualquier entrada futura hereden una
suposición de idioma** que no les toca —y el import, precisamente, usa el convenio contrario
(CA-15)—. Consecuencia buena y buscada: **los servicios y sus tests no cambian**; el
normalizador se prueba solo y el error se mapea solo.

### El `catch` deja de ser ciego

Los tres bloques (`vigiladas/actions.ts:41-44`, `cartera/actions.ts:46-48` y `:76-80`) pasan a
distinguir, con una **función de mapeo pura y compartida** (que es lo que hace CA-10..CA-12
testables sin montar un servidor):

| Qué ocurrió | Qué ve el usuario | Log |
|---|---|---|
| `InvalidNumberError` | campo + valor + qué se espera | no |
| `InvalidZoneError` (RN-10) | su mensaje actual, sin cambios | no |
| `OversellError` (RN-08) / `NoPositionError` | sus mensajes actuales, sin cambios | no |
| cualquier otra cosa | «fallo nuestro, inténtalo de nuevo» (texto **distinto**) | **sí**, con la acción y la excepción |

La normalización se hace **antes** del `try`, de modo que el `try` solo envuelva la llamada al
servicio: así el cajón de sastre queda reducido a lo que de verdad es infraestructura.

Sobre el log: registra la acción y el error; **no vuelca el formulario entero** (lleva importes
y posiciones del usuario, **RN-01**/**D-5**). El valor rechazado sí puede ir en el mensaje al
usuario —es suyo y lo acaba de escribir—, pero no hace falta en el log de infraestructura.

### Transversal

- Reglas: **RN-04** (coste base), **RN-05** (P/L realizado), **RN-08** (no sobreventa),
  **RN-10** (zona = rango, par completo, min ≤ max), **RN-11** (entrada en zona), **RN-01**
  (qué no se registra en el log).
- Decisiones: **ADR-003** (importes en `numeric`, sin float, con `decimal.js` en el dominio —
  esta spec **refuerza** esa decisión: la precisión no se pierde porque nunca se pasa por
  `parseFloat`), **ADR-012** (política de "no se adivina", que CA-5 aplica), **ADR-009**
  (import tras puerto, cuyo parser queda intacto), **ADR-018/SPEC-027** (CI en cada PR).
- Términos de `docs/fundacion/dominio.md`: *Zona de compra*, *Zona de venta*, *Cantidad*,
  *Precio medio de compra*, *Comisión* (el campo se llama `gastos` en el modelo, ADR-003).
  Ninguno cambia.

### Dónde se verifica: en CI, no a mano (SPEC-027)

Desde **SPEC-027** hay CI en cada PR (`.github/workflows/ci.yml`), con **un step por gate**.
Esta spec no se da por terminada con "la suite pasa en mi máquina": el PR tiene que salir
verde en **typecheck**, **lint** (`npm run lint` = `eslint . --max-warnings=0`; un warning
tumba el gate), **unit** (`npm run test`) y **e2e** (`npm run test:e2e`, con `--forbid-only`:
un `.only` olvidado en los e2e nuevos de CA-16/CA-17 tumba el gate).

Dos consecuencias concretas: **CA-15 lo comprueba CI, no la buena voluntad** —si alguien
"unifica" el parser del import, el gate de unit se pone rojo en la PR, que es exactamente
donde tiene que verse—; y **`tests/ci-workflow.test.ts` no se puede romper** (es un test
estático del propio workflow). Esta spec no tiene ningún motivo para tocar
`.github/workflows/ci.yml` ni `package.json`.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Normalización o formateo en el cliente** (reescribir el campo mientras se teclea, forzar
  `type="number"`, máscara de entrada). El servidor es la autoridad y con eso el defecto queda
  cerrado; hacerlo también en el cliente es pulido → EPIC-MEJORA. Nota: `type="number"` **no**
  es la solución — su comportamiento con la coma depende del locale del navegador y del
  sistema operativo, así que cambiaría un fallo determinista por uno que depende de la máquina
  del tester.
- **Mostrar los importes formateados a español** (`12,50 €`) en las tablas de `/vigiladas` y
  `/cartera`. Hoy salen con punto. Es **presentación**, no corrección, y es una asimetría que
  se notará («me deja escribir 12,5 pero me lo enseña como 12.5»). → **F-SPEC-030-1**
  (EPIC-MEJORA), y conviene mirarlo pronto porque afecta a la primera impresión de los testers.
- **Validar el signo y el rango** de los importes (rechazar precios o cantidades negativas o
  cero). Hoy `new Decimal("-5")` se acepta y se guarda; esta spec **no cambia** ese
  comportamiento, ni para bien ni para mal, porque sería funcionalidad nueva en una spec de
  defecto. → **F-SPEC-030-2** (candidato a spec propia; una zona de compra negativa no tiene
  sentido de dominio).
- **El parser del extracto de ING** (`ing-xls-reader.ts`): intacto por diseño (CA-15).
- **Multi-locale de verdad** (detectar el idioma del navegador y parsear en consecuencia). El
  producto es de un usuario español y sus testers son españoles; la política de CA-3..CA-5
  acepta de hecho los dos dialectos sin necesidad de saber quién escribe. Sobredimensionado.
- **El buscador de símbolos**: es **SPEC-029**. No comparten código ni se bloquean entre sí.

## Notas para el gate humano

1. **Tu caso concreto es CA-1 y CA-16**: `12,5` guardado desde `/vigiladas`, en el navegador.
   No se da por bueno hasta que se vea funcionar ahí.
2. **DECIDIDO (humano, 2026-08-18): el `1.234` ambiguo se rechaza, no se adivina.** Ya no es
   una pregunta abierta. La primera redacción de esta spec dejaba `"1.234"` interpretado como
   **1,234** y avisaba de que quien escribiera "mil doscientos treinta y cuatro" sería
   malentendido **en silencio**. El humano eligió lo contrario y su motivo queda registrado:
   **es dinero**, y un malentendido silencioso en una zona de compra es peor que un error que
   obliga a reescribir cuatro caracteres. Ahora `1.234` y `1,234` —**la regla es simétrica**—
   se rechazan pidiendo que lo aclare: `1234` o `1234,00` (**CA-6**, con el texto en **CA-7**).
   Lo que **sigue funcionando exactamente igual**: `12,5`, `12.5`, `1.234,56`, `1,234.56`,
   `12,75`, `1,2345`, `0.001` y `0,500`. La condición de "grupo de miles plausible" de CA-6 es
   justo lo que evita que la enmienda se lleve por delante `0.001` (que ya estaba en CA-2).
3. **Lo ambiguo se rechaza en vez de adivinarse, en sus dos formas** (CA-5 y CA-6): separador
   repetido (`1,234,567`, `1.234.567`) y separador único con tres dígitos detrás (`1.234`,
   `10,000`). Prefiero un error legible a un importe mal leído en silencio, que es justo la
   clase de fallo que EPIC-FIX combate — y es la política de ADR-012 ("no se adivina") aplicada
   a la entrada manual.
4. **El mensaje «Datos inválidos.» desaparece** y se parte en tres: uno que te dice qué campo
   y qué valor no entendió, otro que además te dice **cómo escribirlo** cuando el valor es
   ambiguo (CA-7), y otro que admite que el fallo es nuestro. Este segundo, además,
   **deja log** — hoy un fallo de base de datos en producción no deja rastro ninguno.
5. **No toco el import.** El parser del extracto de ING trata la coma como separador de
   **miles** (así lo exporta ING) y debe seguir así; CA-15 existe para que nadie los unifique
   "por limpieza". Si se unificaran, `12,5` pasaría a valer **125**.
6. **Sin migración y sin ADR**: no se decide nada nuevo, se cumple lo que RN-04/RN-05/RN-10 ya
   dicen. No añade ninguna migración, así que el próximo despliegue manual a producción no
   toca el esquema por culpa de esta spec — a diferencia de SPEC-029, que sí trae la 0008.
7. **Follow-up que te va a saltar a la vista enseguida** (**F-SPEC-030-1**): podrás **escribir**
   `12,5`, pero las tablas te lo seguirán **mostrando** como `12.5`. Formatear la salida a
   español es presentación y lo he dejado fuera; dime si lo quieres dentro y se añade.
8. **Independiente de SPEC-029.** Las dos se pueden aprobar, implementar y verificar por
   separado y en cualquier orden: no comparten ficheros. Esta no depende de ADR-020.

---
*Historial de la spec: redactada el 2026-08-18. **Enmendada el 2026-08-18** tras el gate humano:
el separador único seguido de tres dígitos (`1.234`, `1,234`) **se rechaza** en vez de
interpretarse (la nota 2 pasa de pregunta abierta a decisión registrada, con su motivo: es
dinero). Cambios en los CA: **CA-5 reescrito** (queda solo el separador repetido), **CA-6
nuevo** (la regla nueva, con su tabla de casos límite y la condición de "grupo de miles
plausible" que salva `0.001`), **CA-7 nuevo** (el mensaje dice qué escribir), **CA-15** ampliado
(los precios del proveedor no cruzan el normalizador) y los antiguos CA-6..CA-15 renumerados a
**CA-8..CA-17**. La spec sigue en `borrador`: su aprobación la registra el orquestador.*
