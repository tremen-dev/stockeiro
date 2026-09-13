---
id: SPEC-063
tipo: spec
epica: EPIC-009
estado: hecho
aprobada-por: humano (Alberto Fojo)
historial:
  - {estado: borrador, fecha: 2026-09-13, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-13, por: humano (Alberto Fojo)}
  - {estado: en-progreso, fecha: 2026-09-13, por: sdd-implementador}
  - {estado: en-revision, fecha: 2026-09-13, por: sdd-implementador}
  - {estado: hecho, fecha: 2026-09-13, por: sdd-verificador}
---
# SPEC-063 — La nota y los enlaces del símbolo, escritos donde se mira la acción

## Problema

Lo único que un usuario puede escribir sobre una acción son **cuatro números**: `buy_min`,
`buy_max`, `sell_min`, `sell_max` (`watched_symbols`, `src/db/schema.ts:174`). El resto de
columnas del símbolo —`name`, `micCode`, `instrumentType`— son **metadato del proveedor**,
compartido entre usuarios (ADR-007), y no son suyas.

Así que la app guarda **la conclusión** del análisis y tira **el análisis**: el porqué vive
en una pestaña de TradingView, en un hilo del foro o en la cabeza, y entre el día en que se
fija la zona y el día —semanas después— en que salta el aviso, se ha perdido.

Esta spec entrega la primera mitad de EPIC-009: **una nota y varios enlaces por usuario y
símbolo**, escritos y leídos **donde ya se mira la acción** (el panel que abre la fila de
`/vigiladas`, SPEC-046/ADR-030), con una **señal en la fila** de que ese contexto existe.
Cubre **CE-1**, **CE-2**, **CE-3**, **CE-4** y **CE-5** de la épica.

**Cuelgan del símbolo del usuario, no de la vigilada** (decisión del humano del 2026-09-12,
razonada en la épica): sobreviven a quitar de vigiladas, y por eso la segunda spec podrá
enseñarlos en `/cartera` sin mover ni una fila.

Reglas heredadas: **RN-01** (aislamiento), **RN-03** (acceso autenticado), **RI-01**
(migración aditiva y compatible hacia atrás). Decisiones que la enmarcan: **ADR-007** (el
símbolo es compartido y no es de nadie), **ADR-022** (el borrado de cuenta se lleva todo lo
propio y no toca lo compartido), **ADR-030** (lo que abre una fila vive anclado a la
ventana), **ADR-034** (tabla y tarjeta salen de una sola descripción), **ADR-025** (el
vocabulario lo escribe el arquitecto en el gate).

**Esta spec SÍ cambia el esquema**, y es lo que la saca de EPIC-MEJORA. La migración es
**aditiva**: dos tablas nuevas, ninguna columna existente tocada, ningún `drop` (RI-01,
guardias de SPEC-032). Importa más que de costumbre porque **abrir una PR migra producción**
(`F-SPEC-023-1`).

## Usuarios / roles afectados

- **Usuario final** (cualquier rol con la sección Vigiladas, incluido `tester`, ADR-021):
  escribe su nota y sus enlaces desde el panel de la fila, los vuelve a encontrar ahí, y ve
  desde la lista qué acciones llevan contexto.
- **Sistema (ciclo, motor de disparo, avisos)**: **no cambia ni una línea**. Nada de lo que
  se escribe aquí entra en ninguna comparación, en ningún aviso ni en ninguna petición al
  proveedor.
- **Operador**: dos tablas más en el censo de borrado de cuenta (ADR-022) y en las guardias
  de migración (SPEC-032). Cero coste de proveedor.

## Criterios de aceptación

Unitarios con **Vitest** sobre PGlite con el esquema de las migraciones reales (ADR-019);
**e2e Playwright** los que dicen pantalla; la geometría, con el módulo compartido
(ADR-026 §1).

### Rebanada 1 — El modelo: aditivo, aislado y con su borrado

- **CA-1 (Dos tablas nuevas, ninguna columna vieja tocada).**
  La migración **añade** el sitio donde viven la nota y los enlaces y **no modifica ni borra**
  nada de lo que ya existe: ni una columna alterada, ni un `drop`, ni un `NOT NULL` nuevo
  sobre tabla poblada (RI-01). Verificable con las guardias que ya existen (`db:scan`,
  SPEC-032) y comprobando que el esquema anterior sigue aceptando las escrituras de siempre.

- **CA-2 (Una nota por usuario y símbolo; varios enlaces, en un orden estable).**
  Un usuario tiene **como mucho una** nota para un símbolo dado —escribir otra la sustituye,
  no la duplica— y **varios** enlaces, cada uno con su etiqueta. Releídos, los enlaces salen
  **siempre en el mismo orden**, y ese orden no depende del azar de la base: dos lecturas
  seguidas dan la misma secuencia, y añadir uno nuevo no reordena los anteriores.

- **CA-3 (Es de un solo usuario, y ninguna lectura lo cruza).**
  Dos usuarios con el **mismo símbolo** ven **su** nota y **sus** enlaces, y ninguno alcanza
  los del otro ni conociendo el identificador (RN-01). Las dos direcciones: cada uno lee lo
  suyo con contenido distinto, y una lectura pedida con el id ajeno **no devuelve nada**.

- **CA-4 (Quitar de vigiladas NO borra lo escrito; borrar la cuenta SÍ).**
  Tres propiedades, y las tres se afirman por separado:
  - quitar la acción de vigiladas deja la nota y los enlaces **intactos**, y volver a
    vigilarla los devuelve **tal como estaban**;
  - **borrar la cuenta** se los lleva **enteros** (ADR-022), y las tablas nuevas entran en el
    censo `ACCOUNT_DELETION_COVERAGE` — que ya tiene guardia: quien añada una tabla con
    `userId` y no la borre se entera en su PR;
  - lo **compartido no se toca**: `symbols` y `quotes` siguen ahí y ningún otro usuario
    pierde nada.

### Rebanada 2 — Escribir y borrar, donde se mira la acción

- **CA-5 (Se escribe desde el panel que ya abre la fila).**
  El usuario abre el panel de una vigilada (ADR-030 §2: capa anclada a la ventana, foco que
  entra y vuelve) y ahí escribe su nota y gestiona sus enlaces, **sin navegar a otra
  pantalla** y **sin perder de vista de qué acción habla** (el nombre accesible de la capa ya
  lo dice). Guardar deja lo escrito visible al reabrir.

- **CA-6 (Se borra, y borrar es explícito).**
  La nota se puede vaciar y cada enlace se puede quitar de uno en uno; después de hacerlo, lo
  borrado **no vuelve** al reabrir. Vaciar la nota **no** borra los enlaces, y quitar todos
  los enlaces **no** borra la nota: son dos cosas.

- **CA-7 (Editar contexto no toca las zonas, y editar zonas no toca el contexto).**
  Guardar la nota deja las **cuatro zonas exactamente como estaban**, y guardar zonas
  (SPEC-044) deja la nota y los enlaces exactamente como estaban. Se afirma leyendo las dos
  cosas antes y después, no contando filas.

- **CA-8 (El panel sigue siendo el panel).**
  Tras añadir el bloque de contexto, el panel **conserva lo que SPEC-046 midió**: se abre
  anclado a la ventana, el foco vuelve al control que lo abrió al cerrar, `Escape` cierra, y
  la geometría se mide con el módulo compartido a los anchos de siempre — incluida la vista
  de tarjeta por debajo de 720 px (ADR-034). Si no cabe, la salida es **apilar**, nunca
  encoger ni esconder (ADR-034 §10).

### Rebanada 3 — La fila dice que hay contexto (CE-2)

- **CA-9 (Se ve desde la lista, sin abrir nada).**
  Una acción con nota o con enlaces se distingue **de un vistazo** de una que no tiene, en
  **las dos formas** (tabla y tarjeta, de la misma descripción de columnas). Las dos
  direcciones: con contexto aparece la señal; sin contexto **no hay hueco ni marca**.

- **CA-10 (La señal no la lleva solo el color ni solo la forma).**
  La señal tiene **nombre accesible** que dice qué hay (que hay nota, que hay enlaces, y
  cuántos), y no depende de distinguir un color. No añade una columna nueva —la tabla ya no
  cabe a 730–760 px— y no desborda a ningún ancho.

### Rebanada 4 — Un enlace del usuario no es un vector (CE-4)

- **CA-11 (Solo `http` y `https`, y el rechazo tiene motivo).**
  Al guardar un enlace, el esquema se valida contra una lista de permitidos y **todo lo demás
  se rechaza con motivo visible**, sin guardarlo y sin tragárselo en silencio. Especímenes en
  **las dos direcciones**, y la segunda no es adorno:
  - **debe rechazarse**: `javascript:`, `data:`, `vbscript:`, `file:`, y las variantes con
    mayúsculas o espacios delante que un filtro ingenuo deja pasar;
  - **NO debe rechazarse**: un `https://` normal, uno con puerto, uno con *query* y
    fragmento, y uno con caracteres no ASCII en la ruta. Un filtro que cace de más acaba
    aflojado.

- **CA-12 (El texto nunca se interpreta como marcado).**
  Una nota que contenga `<script>`, comillas o HTML se **ve tal cual** y no se ejecuta ni se
  interpreta: lo que se guarda es texto llano y lo que se pinta es texto llano. Se comprueba
  por su efecto en el navegador —el marcado aparece como caracteres— y no sólo leyendo el
  código.

- **CA-13 (La app no visita lo que el usuario pega).**
  Ni al guardar, ni al listar, ni al pintar la fila: **cero peticiones de servidor** a la URL
  del usuario —nada de validarla abriéndola, sacarle el título o previsualizarla—. Es
  superficie de SSRF y coste de red por fila, y está prohibido por CE-4 de la épica. El
  enlace se abre **en el navegador del usuario**, en pestaña nueva y sin arrastrar la
  referencia de origen.

### Rebanada 5 — Los límites, escritos, y los errores que distinguen el dato del fallo

- **CA-14 (Hay un tope, y el usuario lo sabe antes de chocar).**
  La nota tiene un máximo de **1 000 caracteres** y los enlaces un máximo de **5 por
  símbolo** (decidido en el gate del 2026-09-13), los dos declarados **en un solo sitio del
  código** — de modo que cambiarlos sea cambiar un número y no buscar por el árbol. Al acercarse o pasarse, la pantalla lo dice con
  el número real —no «error»— y **lo ya escrito no se pierde**. La misma cortesía que SPEC-030
  fijó para el alta manual: el mensaje distingue *lo que escribiste no vale* de *algo ha
  fallado*.

- **CA-15 (Una etiqueta vacía no deja un enlace mudo).**
  Un enlace sin etiqueta se presenta por algo que el usuario reconozca —su dominio—, y **no**
  por una etiqueta inventada ni por la URL entera desbordando la caja. Es la misma regla que
  SPEC-041 CA-3 aplicó al nombre del activo: sin dato no se inventa un dato.

### Rebanada 6 — Dominio, ayuda y cero regresión

- **CA-16 (El término existe antes que la pantalla).**
  El vocabulario —cómo se llaman la nota y los enlaces en este producto— entra en
  `docs/fundacion/dominio.md` escrito por **sdd-arquitecto en el gate** (ADR-025), y la UI
  **copia** de ahí su rótulo.

- **CA-17 (La ayuda cuenta qué es esto y qué no es).**
  `/ayuda` dice que la nota es **privada**, que la app **no la lee ni la usa para nada** —no
  entra en avisos, ni en cálculos, ni se comparte— y que los enlaces **no los visita ella**.
  Sigue sin decir nada que D-1, D-2 o D-4 prohíban (mecanismo ya versionado de afirmaciones
  prohibidas).

- **CA-18 (Cero regresión).**
  Batería completa verde y **ninguna guardia ajena aflojada ni borrada**. Siguen cumpliéndose
  sobre `/vigiladas`: SPEC-007 (color de fondo), SPEC-041 (orden), SPEC-043 (sin refrescar),
  SPEC-044/SPEC-046 (editar zonas y el panel), SPEC-062 (la barra de acercamiento, que vive
  en la misma fila) y ADR-034/ADR-035 (tarjetas y geometría). Se verifica **en el gate**
  corriendo la batería y revisando el diff sobre tests ajenos, no con una guardia congelada
  (ADR-031, ADR-037).

## Entidades y reglas afectadas

- **Esquema (aditivo, RI-01)**: un sitio para la **nota** —una por `(usuario, símbolo)`— y
  otro para los **enlaces** —varios por `(usuario, símbolo)`, con etiqueta y orden—. Las dos
  con `userId` como ancla (RN-01) y las dos en el censo de borrado de cuenta (ADR-022). La
  forma exacta la fija la implementación dentro de esas propiedades; lo que **no** es
  negociable es que sean **aditivas** y que el borrado las cubra.
- **Ninguna regla de negocio nueva.** Esto no mide nada del mercado ni cambia ningún
  cálculo: es dato del usuario sobre un símbolo. Si al implementar apareciera la tentación
  de que la nota influya en algo —un aviso, un orden, un filtro—, eso es alcance nuevo y sale
  de aquí.
- **Término de dominio (propuesto)**: la **nota** y los **enlaces** de un símbolo, con su
  nota de que son **privados** y que la app no los interpreta.
- **Superficies que se tocan**: el panel de edición de `/vigiladas`, la descripción única de
  columnas, el censo de borrado de cuenta, `/ayuda` y las migraciones.

## Fuera de alcance

- **Cartera**: enseñar el mismo contexto en `/cartera` es la **segunda spec** de la épica.
- **La nota en el correo** de aviso, marcado enriquecido, adjuntos e imágenes.
- **Título, icono o previsualización del enlace** (CA-13 lo prohíbe explícitamente).
- **Notas por operación**, notas fechadas o diario; **compartir**; **buscar o filtrar** por
  el texto; **recordatorios** con fecha.

## Notas para el gate humano

1. **La migración se mergea, y mergear es desplegar** (ADR-018, `F-SPEC-023-1`): al abrir la
   PR, producción migra. Por eso todo es aditivo y por eso conviene que esta spec entre
   **sola** en su PR.
2. **Colisión conocida**: **SPEC-045** (silenciar) está aprobada y sin implementar sobre el
   **mismo panel**, y **SPEC-062** acaba de tocar la misma fila. Quien llegue el segundo
   rebasa y reconcilia; el panel no se rediseña, se le añade un sitio.
3. **Los dos topes, decididos en el gate**: **1 000 caracteres** de nota y **5 enlaces** por
   acción. Quedan declarados en un solo sitio del código (CA-14) y contados al usuario antes
   de que choque con ellos, no después.
