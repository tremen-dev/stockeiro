---
id: ADR-025
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-08-19, por: sdd-arquitecto}
---
# ADR-025: Los términos del dominio los escribe el arquitecto en el gate, y un retoque descubierto tras el cierre no reabre la spec

- Deciders: propone **sdd-arquitecto** (2026-08-19), a petición del humano (Alberto Fojo) al
  cerrar los residuales documentales de **SPEC-035** y **SPEC-036**. Pendiente de aprobación
  por el humano. **No es una decisión de producto ni de stack**: es una decisión de proceso
  sobre **quién tiene la pluma** de los documentos de verdad y **por dónde entra** un cambio
  de código descubierto tarde. Se escribe como ADR y no como una línea suelta porque tiene
  que ser **citable** y **oponible**: la próxima vez que un implementador se pregunte si
  puede tocar el glosario, la respuesta debe traer su motivo, no solo su prohibición.
- Specs relacionadas: nace de **F-SPEC-036-5** (el término «Borrado de cuenta» que
  **SPEC-036** pide y su implementación no escribió) y de **F-SPEC-036-9** (el rótulo «Tipo
  de cuenta» de `/cuenta`, que contradice el dominio y quedó bloqueado por el gate
  `require-spec`). Tiene precedentes en las tres últimas specs de **EPIC-004**: **SPEC-034**
  y **SPEC-036** (los implementadores se negaron) frente a **SPEC-035** (la implementación
  sí escribió cuatro filas del glosario, en `3162ee1`). Consume **ADR-021** (de donde sale
  el término «Rol de cuenta») y **ADR-022** (de donde sale «Borrado de cuenta»).

## Contexto

Hay **dos criterios vivos a la vez** en el proyecto para el mismo acto, y solo uno puede ser
correcto.

**Los hechos, sin interpretar.** Cuando una spec dice en su §Entidades *"se añade a
`docs/fundacion/dominio.md` el término X"*:

| Spec | Qué pasó | Quién escribió la fila |
|---|---|---|
| **SPEC-034** | El implementador **se negó**: `docs/fundacion/` es documento de verdad y su rol lo prohíbe. Quedó como residual. | El arquitecto, al cerrar (`e3d3aff`) |
| **SPEC-035** | La implementación **escribió** las cuatro filas (Titular, Marca, Descargo, Fuente de precios) en mitad de su tanda (`3162ee1`) | El implementador |
| **SPEC-036** | El implementador **se negó**, con el mismo motivo, y además señaló el precedente contrario de SPEC-035 (**F-SPEC-036-5**) | Nadie, hasta este ADR |

El contrato de rol dice que `FOUNDATION.md` y `docs/fundacion/` son de **sdd-arquitecto** y
**sdd-producto**, y el hook `protegeVerdad` de `.sdd.json` está para eso. Así que el criterio
de SPEC-034 y SPEC-036 es el correcto **por la letra**, y `3162ee1` fue una excepción que
nadie autorizó. Pero declarar eso y parar deja el problema real sin resolver, que no es
*quién* sino **cuándo**:

- Si el término se escribe **al cerrar**, durante toda la implementación existe un vocablo
  del producto que **está decidido pero no está escrito** en el único sitio del que se copia.
  El glosario dice de sí mismo *"si un término falta, se añade aquí antes de usarse"*, y esa
  frase se incumple por construcción cada vez que se deja para el final.
- Y deja **residuales documentales sistemáticos**: el implementador no puede, el verificador
  no puede, y ningún CA lo cubre — así que la spec llega a `hecho` con una promesa de su
  §Entidades sin cumplir. Ha pasado en dos de las tres últimas specs.

**El segundo caso, que es el mismo problema por el otro lado.** `/cuenta` rotula el rol como
«Tipo de cuenta» cuando el dominio dice «**Rol de cuenta**» (**F-SPEC-036-9**). Es una línea
de `src/app/cuenta/page.tsx`, no la fija ningún test, y no rompe nada. Pero **SPEC-036 está
en `hecho`**, que es terminal, y el gate L1 `require-spec` deniega escribir en `src/` sin una
spec `aprobada` o `en-progreso`. El implementador **podía** haberlo escrito con un `sed`
esquivando el hook, y **decidió no hacerlo**, dejándolo como residual con su motivo. Esa
decisión es la correcta y este ADR la sanciona: un control que se puede rodear cuando molesta
no es un control, es una sugerencia. Pero un residual sin destino no es una decisión, es un
aplazamiento — y ahora mismo el proyecto **no tiene escrito** por dónde entra ese retoque.

Nótese que aquí el término **ya existía** («Rol de cuenta» entró con SPEC-034, antes de que
se implementara SPEC-036): el fallo no fue de calendario sino de que **nadie comprobó** que
el rótulo de la pantalla saliera del glosario. Las dos mitades de este ADR son la misma
enfermedad: el lenguaje ubicuo no tiene dueño en el momento en que se teclea.

## Decisión

### 1. Los términos de dominio los escribe **sdd-arquitecto**, y los escribe **en el gate de aprobación de la spec que los pide**

No en la implementación y **no al cerrar**. La secuencia queda:

1. La spec en `borrador` declara en §Entidades el término que hace falta y **con qué
   definición**, para que el humano lo lea en el gate junto con lo demás.
2. **En el mismo acto en que la spec pasa a `aprobada`**, el arquitecto escribe la fila en
   `docs/fundacion/dominio.md`. El término entra **aprobado por el humano**, no colado.
3. A partir de ahí, la implementación **copia** de ahí el rótulo — de la UI, del identificador
   en castellano, del texto de error — y **no lo inventa**. El glosario es fuente, no acta.

**El implementador no escribe nunca en `docs/fundacion/` ni en `FOUNDATION.md`.** Ni una fila,
ni una coma, ni aunque la spec se lo pida por escrito: si la spec lo pide, es que el arquitecto
no hizo su parte, y la respuesta correcta es la que dieron SPEC-034 y SPEC-036 — negarse y
levantar el residual. `3162ee1` (SPEC-035) queda **regularizado, no bendecido**: su contenido
es correcto y se queda, pero la ruta fue equivocada y no es precedente.

**El verificador lo comprueba.** Si la §Entidades de la spec nombra un término, el verificador
mira que la fila **exista** antes de emitir GREEN. Deja de ser un residual que se descubre al
final y pasa a ser una condición que se ve al principio.

### 2. Una spec en `hecho` no se reabre, y el gate no se rodea

`hecho` es terminal. Un defecto descubierto después **no** se arregla transicionando la spec
hacia atrás, **no** se arregla con `SDD_SKIP_GATE=1` y **no** se arregla con un `sed` que
escriba en una ruta vigilada por detrás del hook. Anular en silencio un control del proyecto
para ahorrarse un trámite es peor que el defecto que se pretende corregir, porque el defecto
se ve y la anulación no.

### 3. Un retoque trivial de `src/` descubierto tras el cierre tiene **dos destinos, y los elige el arquitecto**

«Trivial» quiere decir aquí: **rótulo, texto visible, typo o nombre** que no cambia
comportamiento y que ningún test fija. Cualquier otra cosa —lógica, datos, contrato— no es un
retoque y va por su spec como todo lo demás.

- **(a) Arrastre.** Si existe (o va a escribirse) una spec **`aprobada` o `en-progreso`** que
  ya toca **esa misma superficie**, el residual **cuelga de ella**: el arquitecto lo escribe
  en su §Entidades citando el id del residual (`F-SPEC-NNN-M`), y si el retoque es observable,
  como un CA. Es el camino **preferente**: cuesta dos líneas, el hook se abre solo porque esa
  spec está viva, y el cambio viaja con quien de todas formas iba a tocar ese fichero.
- **(b) Lote en EPIC-FIX.** Si no hay tal spec a la vista, el residual **espera en EPIC-FIX** y
  se cierra con una **spec-lote de rótulos y textos** que agrupa varios: una spec, N retoques,
  un solo gate. Agrupar es deliberado — abrir una spec por cada palabra convierte el proceso en
  su propia carga.

La elección entre (a) y (b) la hace **el arquitecto al triar el residual**, no el implementador
sobre la marcha, y **se escribe** en el residual. Un residual sin destino escrito se considera
abierto.

### 4. Aplicación inmediata a los dos residuales que originan este ADR

- **F-SPEC-036-5**: **cerrado por este ADR**. «Borrado de cuenta» ya está en
  `docs/fundacion/dominio.md`, escrito por el arquitecto y contrastado contra el código
  entregado (`src/lib/account/deletion.ts`, `ACCOUNT_DELETION_COVERAGE`).
- **F-SPEC-036-9**: va por la vía **(b)**. Ninguna de las specs vivas de EPIC-004 toca
  `/cuenta` —**SPEC-037** trabaja sobre `/admin` y el registro, no sobre esa pantalla—, así que
  no hay a qué colgarlo. Queda como **primer punto del lote de rótulos de EPIC-FIX**. Si
  ningún otro se acumula antes de publicar, el lote se escribe con ese único punto: un rótulo
  que contradice al glosario en una pantalla que va a ver un tester externo no espera
  indefinidamente a tener compañía.

## Consecuencias

### Positivas

- **Desaparece una clase entera de residual.** Los dos casos de las tres últimas specs
  (SPEC-034 y SPEC-036) no habrían existido: el término se escribe antes de implementar.
- **La implementación deja de tener que elegir** entre desobedecer a la spec y desobedecer a
  su rol. Hoy esa contradicción se le trasladaba entera, y la resolvía cada uno a su manera —
  que es exactamente lo que produjo dos criterios opuestos.
- **El humano aprueba el vocabulario cuando aprueba la spec**, que es cuando tiene delante el
  contexto para juzgarlo, y no en un commit de cierre que nadie mira.
- **El gate `require-spec` deja de tener excepciones tentadoras.** Con dos destinos escritos,
  «es que era una línea» deja de ser un argumento: hay a dónde llevarla.
- **La decisión del implementador de SPEC-036 queda sancionada**, y con ella el principio
  general: ante un control que estorba, se levanta el residual, no se rodea el control.

### Negativas / follow-ups

- **El arquitecto hace un viaje más por gate.** Aprobar una spec deja de ser mover un
  frontmatter: puede llevar una fila de glosario detrás. Es trabajo real y es el precio.
- **El vocablo entra antes que su implementación.** Entre la aprobación y el `hecho`, el
  glosario describe algo que todavía no existe en la app. Se asume: el glosario es el lenguaje
  del **producto**, no el inventario de lo desplegado, y una spec aprobada ya es compromiso.
  Si una spec aprobada se abandonara, retirar su fila es parte de abandonarla.
- **F-ADR-025-1 (follow-up).** Nada **automático** comprueba que un rótulo de `src/` coincida
  con el glosario: F-SPEC-036-9 se descubrió leyendo, no fallando. Un test que ate los términos
  del dominio a los textos de la UI —al estilo del que ata `ACCOUNT_DELETION_COVERAGE` al
  esquema, o del de afirmaciones prohibidas de SPEC-035— cerraría el agujero de verdad. No
  entra aquí: es código y necesita su spec.
- **El lote de EPIC-FIX puede envejecer.** Un residual cosmético sin compañía se queda esperando
  a un lote que no llega. Mitigación explícita en el pto. 4: lo que sea visible para un usuario
  no espera compañía.

## Alternativas consideradas

- **Que el implementador escriba el término durante la implementación** (el precedente de
  SPEC-035). **Rechazada**: `docs/fundacion/` es documento de verdad con dueño declarado y con
  un hook que lo protege; sancionar la excepción vacía el hook de sentido y convierte cada spec
  en una negociación sobre quién puede tocar el glosario. Además, escribir el término **desde
  la implementación** lo saca del gate: el humano aprueba la spec sin haber visto la definición
  que se va a canonizar. Tiene una virtud real —el término existe cuando se teclea la
  pantalla— y este ADR la conserva escribiéndolo **antes**, no delegándolo.

- **Que el término lo escriba el arquitecto al cerrar la spec** (el precedente de SPEC-034).
  **Rechazada**: es lo que veníamos haciendo y produce justo lo que queremos evitar. Durante
  toda la implementación no hay de dónde copiar, el glosario incumple su propia primera línea,
  y la fila acaba en un commit de cierre desconectado de la decisión que la motivó.

- **Que ningún término se añada por spec, y el glosario se revise en tandas periódicas.**
  **Rechazada**: desacopla el vocablo de la decisión que lo crea (ADR-021 → «Rol de cuenta»,
  ADR-022 → «Borrado de cuenta»), que es precisamente el rastro que hace útil este glosario.
  Una tanda periódica es un residual con calendario.

- **Permitir `SDD_SKIP_GATE=1` para retoques cosméticos.** **Rechazada de plano**: la
  clasificación de «cosmético» la haría quien tiene prisa, la haría sobre su propio trabajo, y
  no dejaría rastro. La diferencia entre un rótulo y una regla de negocio no la puede arbitrar
  una variable de entorno.

- **Reabrir la spec cerrada** (`hecho` → `en-progreso`) para el retoque. **Rechazada**: destruye
  la propiedad más útil de `hecho`, que es que lo verificado se quedó quieto. Un ledger con
  GREEN emitido y luego código cambiado por debajo es un ledger que miente, y el estado dejaría
  de significar nada.

- **Una spec por cada retoque.** **Rechazada**: el coste de gate excede el del defecto y
  produce un tablero lleno de specs de una línea. Por eso el lote de EPIC-FIX agrupa, y por eso
  la vía (a) es la preferente cuando hay a qué colgarse.

- **Escribir esto como una línea en `FOUNDATION.md` y no como ADR.** **Rechazada como sitio
  único**: el `FOUNDATION.md` recoge la regla, pero no cabe en él el motivo, y sin motivo la
  regla se re-litiga cada vez que estorba —dos implementadores ya la razonaron desde cero, cada
  uno por su cuenta—. La regla vive en los dos sitios a propósito: el porqué aquí, el qué
  donde se trabaja.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
