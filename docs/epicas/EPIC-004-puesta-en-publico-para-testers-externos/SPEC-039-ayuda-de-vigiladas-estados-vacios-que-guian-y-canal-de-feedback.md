---
id: SPEC-039
tipo: spec
epica: EPIC-004
estado: borrador
aprobada-por:
historial:
  - {estado: borrador, fecha: 2026-08-19, por: sdd-arquitecto}
---
# SPEC-039 — Ayuda de vigiladas, estados vacíos que guían y canal de feedback

## Problema

**Un desconocido que llegue hoy desde el foro se encuentra un formulario de login y nada
más.** Verificado en el código: `/` (`src/app/page.tsx`) hace `redirect('/dashboard')` y el
middleware manda a `/login` a quien no tiene sesión. Es decir, **la primera pantalla de
Stockeiro es una caja para el email y otra para la contraseña**, sin una sola línea que diga
qué es esto ni por qué merece la pena teclearlas.

Si consigue registrarse, aterriza en un panel con tres tarjetas y, en Vigiladas, en este
estado vacío (`src/app/vigiladas/page.tsx`):

> *"Aún no vigilas ninguna acción. Añade un ticker con su zona de compra y/o venta para
> empezar a vigilarlo."*

Correcto y completamente insuficiente para quien no sabe qué es una zona en este producto,
si el rango es de precio, qué pasa cuando entra, cuándo le van a avisar, **cada cuánto se
mira** ni qué mercados hay de verdad detrás.

Y ahí está el riesgo que la épica marca con nombre propio. **R-4**: *"el público de un foro
de bolsa espera tiempo real […] si la ayuda y el primer pantallazo no lo dicen alto, el
feedback que se recoja será 'no actualiza' y se habrá gastado la publicación"*. La app
refresca **una vez al día tras el cierre** y eso es **D-2, locked**: no es un defecto que
haya que disculpar, es el diseño — pero solo si se dice.

Esta spec cubre **CE-1** (*"se apaña solo […] entiende en la primera pantalla qué hace la app
y con qué cadencia, y crea su primera acción vigilada"*) y **CE-8** (*"tiene un camino
visible desde dentro de la app para mandar feedback"*), y es la mitigación declarada de
**R-4**. **No bloquea publicar**, pero es la spec de la que depende que lo publicado sirva
para algo: sin ella se recogerá feedback sobre un malentendido.

Reglas en juego: **RN-10** (zona = rango, no valor puntual), **RN-11** (entrada inclusive,
sobre el precio observado del ciclo), **RN-12** (último cierre **no ajustado**), **RN-13** y
**RN-14** (un aviso de entrada por episodio; el agregado de permanencia, uno por ciclo),
**RN-15** (el aviso queda in-app aunque falle el correo), **RN-03** (la ayuda es pública, con
la excepción declarada) y **D-2**/**D-4** (diferido; la app no calcula zonas).

## Usuarios / roles afectados

- **Visitante que pincha el enlace del hilo**: antes de dar su email lee qué hace la app,
  **con qué cadencia** y qué mercados cubre. Si no es lo que busca, se va sin registrarse —
  y eso es un buen resultado, no una pérdida.
- **Tester recién registrado**: su pantalla vacía le dice **cuál es el primer paso** y dónde
  está la explicación, en lugar de dejarle adivinar.
- **Tester que ya ha vigilado algo y no ve moverse nada**: encuentra escrito, en la propia
  pantalla, que el dato es de cierre y se actualiza una vez al día — antes de escribir *"no
  actualiza"* en el hilo.
- **Tester que quiere decir algo**: tiene un camino a un clic desde cualquier pantalla, y lo
  que envía llega **con la versión del despliegue** puesta, sin que él sepa qué es eso.
- **Operador**: recibe reportes accionables en vez de *"a mí no me sale"*.

## Criterios de aceptación

Cada CA es verificable con un test: contenido y navegación con **Playwright**; las
correspondencias con el código (mercados, motivos de "sin precio", afirmaciones prohibidas)
con **Vitest**.

- **CA-1 (La ayuda se lee sin sesión — CE-1, RN-03).**
  Dado un navegador **sin cookie de sesión**,
  cuando visita `/ayuda`,
  entonces la lee entera, **sin redirigir a `/login`**; y una ruta que solo **se parezca**
  (p. ej. `/ayudaX`) **no** es pública. La excepción se declara en `PUBLIC_PREFIXES`
  (`src/lib/auth/guard.ts`), como en **CA-15 de SPEC-023** y **CA-2 de SPEC-035**.

- **CA-2 (La primera pantalla explica la app y su cadencia — CE-1, R-4).**
  Dado un visitante **sin sesión** que abre la raíz del dominio,
  cuando aterriza,
  entonces lee **qué hace Stockeiro** y **con qué cadencia se actualizan los datos** (una vez
  al día tras el cierre, **D-2**), y tiene camino visible a crear cuenta, entrar, la ayuda y
  las páginas legales. Y dado un visitante **con sesión**, la raíz **sigue llevándole al
  panel** exactamente como hoy.

- **CA-3 (La cadencia se dice tres veces, donde se necesita — R-4).**
  Dada la app,
  cuando se recorren la primera pantalla, `/ayuda` y el estado vacío de `/vigiladas`,
  entonces **las tres** dicen que los datos son de **cierre diferido y se refrescan una vez
  al día**. No se esconde en un solo sitio que haya que ir a buscar.

- **CA-4 (La ayuda explica la zona como es, no como suena — RN-10, RN-11, D-4).**
  Dada `/ayuda`,
  cuando se lee la parte de vigiladas,
  entonces explica que una zona es un **rango `[min, max]`**, no un valor puntual; que compra
  y venta son **etiquetas independientes y opcionales** (se puede vigilar sin zona, con una o
  con las dos); que se **entra** en zona cuando el precio observado cae dentro **incluidos
  los extremos**; y que **las zonas las pone el usuario**: la app no las calcula ni las
  recomienda (**D-4**).

- **CA-5 (La ayuda explica cuándo llega el aviso y de qué tipo — RN-13, RN-14, RN-15).**
  Dada `/ayuda`,
  cuando se lee la parte de avisos,
  entonces distingue el aviso de **entrada** (uno por episodio, no se repite mientras siga
  dentro) del **agregado de permanencia** (uno por ciclo con todo lo que sigue en zona), y
  dice que el aviso queda **siempre registrado en la bandeja** aunque el correo falle
  (**RN-15**).

- **CA-6 (La ayuda dice qué mercados hay DE VERDAD, y no puede quedarse desfasada).**
  Dada `/ayuda` y `OPERATING_MICS` (`src/lib/market/mic.ts`),
  cuando se comparan,
  entonces la ayuda nombra **exactamente** los mercados soportados, con su nombre de dominio
  (BME, NASDAQ, NYSE, Xetra, Nasdaq Estocolmo, Euronext París, Euronext Ámsterdam), y **un
  test falla si la lista del código cambia y la ayuda no**. Prometer más mercados de los que
  cubre el proveedor es exactamente el defecto que costó **EPIC-FIX** entera.

- **CA-7 (La ayuda no promete lo que D-2 prohíbe — R-4).**
  Dada `/ayuda` y la primera pantalla,
  cuando se analiza su texto renderizado,
  entonces **no contienen ninguna afirmación de tiempo real, intradía, alertas instantáneas
  ni ejecución de órdenes** (**D-1**), comprobado contra una **lista cerrada y versionada de
  afirmaciones prohibidas** que vive junto al test con su motivo escrito — mismo mecanismo
  que **CA-7 de SPEC-035**.

- **CA-8 (La ayuda explica "sin cotización" antes de que asuste — SPEC-016, RN-12).**
  Dada `/ayuda`,
  cuando se lee,
  entonces explica que el precio es el **último cierre no ajustado** con su fecha
  (**RN-12**), y **cubre todos los motivos** por los que una acción puede aparecer sin
  precio: el conjunto de motivos descritos coincide con `QuoteFailureReason` (dominio,
  **SPEC-016**), más el caso *"aún sin datos: se ingiere en el próximo ciclo"* que ya muestra
  `/vigiladas`. Verificado contra el tipo, no de memoria.

- **CA-9 (El estado vacío de Vigiladas guía y enlaza — CE-1).**
  Dado un usuario sin ninguna acción vigilada,
  cuando abre `/vigiladas`,
  entonces ve **el primer paso a la vista** —el formulario de alta accesible sin buscarlo—,
  un ejemplo concreto de qué es una zona, la cadencia (CA-3) y un **enlace a `/ayuda`**.

- **CA-10 (El estado vacío de Avisos dice cuándo llegará el primero — CE-1).**
  Dado un usuario sin avisos,
  cuando abre `/avisos`,
  entonces lee que los avisos llegan **cuando una acción vigilada entra en su zona** y que
  eso se comprueba una vez al día, con enlace a `/vigiladas` si aún no vigila nada y a
  `/ayuda`. El contador de no leídos (**SPEC-007** CA-10) sigue intacto.

- **CA-11 (El panel de quien acaba de llegar guía en vez de dejar un hueco — CE-1,
  frontera con SPEC-034 CA-9).**
  Dado un usuario **sin** acciones vigiladas y **sin** avisos,
  cuando abre `/dashboard`,
  entonces la pantalla le señala **un** siguiente paso —crear su primera vigilada— y ofrece
  la ayuda; para un usuario con datos, el panel es el de siempre. **SPEC-034** quitó la
  tarjeta que el tester no puede abrir; **esta spec llena ese sitio con algo que enseña**.

- **CA-12 (Hay un camino visible para mandar feedback — CE-8).**
  Dada cualquier pantalla autenticada y también `/ayuda`,
  cuando se busca cómo decir algo,
  entonces hay un acceso **visible a un clic** al canal de feedback, y desde él se llega a
  escribir sin pasos intermedios.

- **CA-13 (Lo que se manda llega con la versión puesta — CE-8 + CE-3).**
  Dado el enlace de feedback,
  cuando se activa,
  entonces el mensaje que se compone lleva **prefijada la versión del despliegue**, tomada de
  `deploymentIdentity` (`src/lib/version/identity.ts`, **SPEC-031**). El tester no tiene que
  saber qué es un commit para que su reporte sea útil. **No depende de SPEC-038**: ambas
  beben de la misma fuente, no una de otra.

- **CA-14 (Nada de terceros y nada de dato de usuario en las páginas públicas).**
  Dadas la primera pantalla y `/ayuda`,
  cuando se sirven a un visitante anónimo,
  entonces **no solicitan ningún recurso externo** (ni script, ni tipografía, ni imagen, ni
  baliza) y **no consultan la base de datos** — comprobado con el mismo estilo de prueba de
  grafo de imports de `tests/version-import-graph.test.ts` y con la intercepción de red de
  Playwright. Coherente con **CA-10** y **CA-12 de SPEC-035**.

- **CA-15 (Se puede llegar a vigilar sin ayuda humana — CE-1, extremo a extremo).**
  Dado un visitante anónimo que arranca en la raíz del dominio,
  cuando recorre en Playwright: leer qué es la app → crear cuenta → llegar al panel →
  entender el primer paso → buscar un símbolo → crear su primera vigilada con su zona,
  entonces **lo consigue sin salir de la app y sin ninguna instrucción externa**. Es el
  recorrido literal de CE-1 y se prueba entero, no por partes.

- **CA-16 (No degrada lo entregado).**
  Dada la suite existente,
  cuando se ejecuta completa,
  entonces sigue verde: en particular los CA de **SPEC-003** (alta de vigiladas),
  **SPEC-007** (estado de zona por color de fondo y bandeja), **SPEC-016** (motivos de "sin
  precio") y **SPEC-029** (tipo y mercado en la tabla) siguen pasando sin cambios.

## Entidades y reglas afectadas

**Sin cambios de esquema.** Esta spec no crea ni modifica ninguna tabla y no escribe nada:
es contenido, navegación y estados vacíos.

**Rutas nuevas / modificadas**: `/ayuda` (**pública**, declarada en `PUBLIC_PREFIXES`) y la
raíz `/` (`src/app/page.tsx`), que pasa a **atender al visitante sin sesión** y **conserva**
la redirección al panel para quien la tiene (CA-2).

**Piezas existentes que se extienden, no se duplican:**

- **`src/app/vigiladas/page.tsx`**, **`src/app/avisos/page.tsx`** y
  **`src/app/dashboard/page.tsx`**: solo sus **estados vacíos** y sus enlaces. La tabla, el
  color de fondo por estado de zona, el `asOf` y el contador de no leídos **no se tocan**.
- **El pie compartido (`AppFooter`)** que entrega **SPEC-035**: gana el acceso al canal de
  feedback (CA-12). SPEC-035 lo crea, **SPEC-038** le añade la versión y esta spec el
  feedback; **ninguna lo duplica**.
- **`src/lib/market/mic.ts`** (`OPERATING_MICS`) y `marketName`: **única** fuente de la lista
  de mercados de la ayuda (CA-6).
- **`QuoteFailureReason`** (`src/lib/market/provider.ts`) y `failReasonText`: **única** fuente
  de los motivos de "sin precio" (CA-8).
- **`deploymentIdentity`** (`src/lib/version/identity.ts`, **SPEC-031**): fuente de la
  versión que acompaña al feedback (CA-13).

**Configuración nueva**: la dirección del canal de feedback. Es la misma que el contacto del
titular de **SPEC-035** (**F-SPEC-035-1**) y **no se duplica**: se lee de una sola constante
de configuración, en `.env.example` con su explicación.

**Reglas y decisiones**: **RN-10**, **RN-11**, **RN-12**, **RN-13**, **RN-14**, **RN-15**
(todas **citadas y explicadas al usuario**, ninguna modificada), **RN-03** (con la excepción
declarada de CA-1), **D-1**, **D-2** y **D-4** (*locked*, que esta spec por fin comunica);
**ADR-004** (cadencia), **ADR-005**/**ADR-006** (disparos y avisos), **ADR-012**/**ADR-014**/
**ADR-020** (qué mercados y qué instrumentos hay de verdad), **SPEC-016** (motivos),
**SPEC-031** (versión en el feedback). Dominio: se añaden a `docs/fundacion/dominio.md` los
términos **Ayuda** y **Canal de feedback**. **Ningún término del dominio se reescribe**: la
ayuda los explica en lenguaje llano **citándolos**, no creando sinónimos.

## Fuera de alcance

Aparcado a propósito, no por descuido:

- **Onboarding guiado o tour multipaso**: fuera por decisión escrita de la épica. *Estado
  vacío sí; asistente no.*
- **Bandeja de tickets, formulario de feedback en base de datos, compromiso de respuesta**:
  fuera por decisión escrita (*"el canal de feedback es un enlace, no una bandeja"*). Aquí es
  un enlace y punto.
- **Ayuda de Cartera e Importar**: fuera de la épica; los testers no las ven (**SPEC-034**).
  Se escribirá el día que se les abran.
- **Página de marketing, capturas, testimonios, precios.** La primera pantalla de CA-2 es
  **mínima**: qué hace, con qué cadencia, y por dónde entrar. Ni una pantalla comercial.
- **Traducción / i18n**: fuera de la épica.
- **Vídeo, tutorial o FAQ extensa.** Una sola página de ayuda, centrada en el circuito
  vigiladas → zonas → avisos.
- **Cambiar la interfaz de vigiladas, avisos o panel** más allá de sus estados vacíos y sus
  enlaces. La tabla, el color de zona y el contador son de SPEC-007 y no se reabren.
- **Explicar la cadencia cambiándola.** **D-2** es *locked*: esta spec **comunica** el diseño,
  no lo negocia. Ni un "próximamente en tiempo real".
- **Instrumentar cuántos testers llegan a su primera vigilada.** CE-1 propone esa medida, pero
  la analítica está **fuera de la épica**: se mira en Neon con una consulta.

## Salvedades y follow-ups

- **F-SPEC-039-1 (dependencia de secuencia).** CA-12 añade el feedback al **pie que entrega
  SPEC-035**. Va **después** de SPEC-035. CA-13 depende solo de **SPEC-031** (ya `hecho`), no
  de SPEC-038.
- **F-SPEC-039-2 (contenido, requiere al humano).** La dirección del canal de feedback la da
  el humano, y es la misma que el contacto de **F-SPEC-035-1**. Publicarla en abierto la
  expone a recolectores de correo: es el precio de un canal sin infraestructura, y era la
  decisión de la épica.
- **F-SPEC-039-3 (mantenimiento, buscado).** CA-6 y CA-8 **fallarán a propósito** cuando
  alguien añada un mercado o un motivo de fallo sin actualizar la ayuda. Es la intención: la
  ayuda mintió una vez —cuando decía cubrir mercados que el proveedor no servía— y costó
  EPIC-FIX entera.
- **F-SPEC-039-4 (residual asumido de CE-1).** *"Cuántos llegan a ≥1 vigilada sin escribir al
  autor"* **no se mide** dentro de la app (no hay analítica). Lo que esta spec entrega es que
  el recorrido **sea posible sin ayuda** (CA-15); contar cuántos lo hacen es una consulta a
  Neon.
- **F-SPEC-039-5 (residual asumido de R-2).** La ayuda explica el buscador de símbolos, pero
  la cuota de Twelve Data es **global, no por usuario**: si varios testers buscan a la vez
  puede fallar. La ayuda **no puede arreglarlo**; a lo sumo el mensaje de error debe ser
  honesto, y eso ya lo es (**ADR-020** pto. 5: ningún descarte es mudo).

## Notas para el gate humano

1. **Aquí me he salido un poco del §Alcance literal de la épica, y quiero que lo veas.** La
   lista de "dentro" nombra *ayuda*, *estados vacíos* y *canal de feedback*, pero **no** una
   primera pantalla. La he metido (CA-2) porque **CE-1 dice literalmente "entiende en la
   primera pantalla"** y, verificado en el código, hoy esa primera pantalla es **el formulario
   de login**: `/` redirige a `/dashboard` y el middleware manda a `/login`. Sin tocar eso,
   CE-1 es inalcanzable. Lo he mantenido **mínimo** —qué hace, con qué cadencia, por dónde
   entrar— y no es una página de marketing. **Si prefieres no tocar `/`**, la alternativa es
   poner ese bloque dentro de `/login` y `/register`: cambia CA-2 y nada más.

2. **R-4 es el riesgo que puede gastar la publicación, y lo ataco con repetición
   deliberada (CA-3).** Decir la cadencia una sola vez, en la ayuda, no sirve: nadie lee la
   ayuda antes de quejarse. Va en la primera pantalla, en la ayuda y en el estado vacío de
   vigiladas. Sí, es redundante; la redundancia es el punto.

3. **CA-6 y CA-8 atan la ayuda al código, y eso hará fallar builds futuros.** Es deliberado y
   es la lección de EPIC-FIX: durante semanas la app prometió mercados que el proveedor no
   servía. Prefiero un test rojo en la PR de quien añada un mercado que un tester descubriendo
   que le mentimos.

4. **CA-7 prohíbe escribir cosas, igual que CA-7 de SPEC-035.** Nada de "alertas al
   instante". **D-2** es *locked* y la ayuda es donde más tienta incumplirla, porque suena
   mejor. La lista de afirmaciones prohibidas se versiona junto al test.

5. **El feedback es un `mailto:` con la versión puesta (CA-12/CA-13), no un formulario.** Lo
   decidió la épica (*"un enlace, no una bandeja"*) y coincido: un formulario propio significa
   tabla, moderación y un compromiso de respuesta que hoy no quieres dar. Lo único que he
   añadido por mi cuenta es **prefijar la versión**, porque un reporte sin versión obliga a
   una ida y vuelta que con veinte testers se nota.

6. **Necesito la dirección de feedback, y es la misma que el contacto del titular
   (F-SPEC-035-1).** Un solo dato para las dos specs; que no se dupliquen es un CA.

7. **Secuencia.** Va **la última** de EPIC-004: necesita saber qué ve un tester
   (**SPEC-034**) y el pie de **SPEC-035**. No bloquea publicar — pero publicar sin ella
   significa recoger feedback sobre un malentendido, que es peor que no recogerlo.

8. **Aprobación**: la spec queda en **`borrador`** y **no la firmo yo**. No origina ningún
   ADR: solo comunica decisiones ya tomadas y *locked*.
