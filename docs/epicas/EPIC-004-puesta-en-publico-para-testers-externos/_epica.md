---
id: EPIC-004
tipo: epica
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-19, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-08-19, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# EPIC-004 — Puesta en público para testers externos

## Objetivo

Que Stockeiro deje de ser **la herramienta de su autor** y pase a ser **un producto
que un desconocido puede usar sin ayuda**. Concretamente: publicable en un hilo de
un foro de bolsa, con todo lo que eso obliga — decir quién lo opera y qué hace con
los datos de quien entra, enseñar a usarlo, enseñar **solo lo que está pulido**,
saber qué versión está viva, poder **cerrar la puerta** si viene más gente de la
esperada, y tener por dónde recibir lo que te digan.

**Por qué ahora.** `main` está en verde: 27 specs `hecho`, ninguna en curso. La app
vive en un dominio propio (`stockeiro.tremen.dev`) con despliegue automático y puerta
post-deploy. EPIC-FIX restauró la promesa central (la vigilancia funciona para el
mercado real) y EPIC-003 cerró el único agujero sin remedio del primer minuto: quien
olvidaba la contraseña quedaba fuera para siempre. **No queda defecto conocido que
tape la promesa** — lo que queda no es hacer la app mejor, es hacerla *presentable*.

**Por qué solo Vigiladas + Avisos.** Es el circuito donde vive la promesa (defines
zonas → la app vigila → te avisa) y es lo más trabajado del producto. Cartera e
Importar existen y funcionan, pero el feedback que se busca es sobre la vigilancia; y
cada sección que se enseña es superficie que hay que defender ante desconocidos. Se
descartó "solo Vigiladas" a secas: **vigilar sin avisar no es la promesa**, y un
tester que no recibe avisos evalúa media función.

## Criterios de éxito

- **CE-1 — Se apaña solo.** Un tester que llega desde el foro **sin hablar con nadie**
  se registra, entiende en la primera pantalla qué hace la app **y con qué cadencia**,
  y crea su primera acción vigilada con su zona. Medida: de los primeros testers que
  se registran, cuántos llegan a ≥1 vigilada **sin escribir al autor**.
- **CE-2 — Solo ve lo que debe.** Un usuario con rol tester ve Panel, Vigiladas y
  Avisos, y **nada más**: Cartera e Importar no aparecen en la navegación **ni son
  alcanzables tecleando la URL**. Medida: binario, verificable en test.
- **CE-3 — La app dice qué versión es.** Cualquiera lee dentro de la app la versión
  que está usando, y ese dato **coincide** con lo que responde `/api/version`
  (SPEC-031). Medida: binario.
- **CE-4 — Dice quién es y qué hace con tus datos.** Sin necesidad de sesión se puede
  leer quién opera la app, qué datos guarda, con quién los comparte y que **esto no es
  asesoramiento financiero**. Medida: binario.
- **CE-5 — Te puedes ir.** Un usuario borra su cuenta y sus datos **desde la app**, sin
  pedírselo a nadie. Tras hacerlo no queda rastro suyo y su email vuelve a estar libre.
  Medida: binario, testable.
- **CE-6 — Se puede cerrar el grifo.** El registro se cierra y se reabre **sin
  desplegar**, y además se cierra solo al llegar a un cupo fijado. Quien llega con el
  registro cerrado lee **por qué**, no un error. Medida: binario.
- **CE-7 — Se sabe cómo va.** Una pantalla propia responde en 5 segundos: cuántas
  cuentas hay, cuántas vigiladas, si el último ciclo del cron corrió y cuántos símbolos
  se quedaron sin precio. Medida: binario.
- **CE-8 — Te pueden contestar.** Un tester tiene un camino visible desde dentro de la
  app para mandar feedback. Medida: binario.

## Alcance

- **Dentro:**
  - **Rol por usuario** (`tester` / `completo`) y visibilidad de sección derivada del
    rol. Ocultar Cartera e Importar al tester **en la navegación y en la ruta** — no
    basta con quitar el enlace.
  - **Panel adaptado al rol**: hoy sus tres tarjetas incluyen Cartera, que va a estar
    oculta. Un panel que enlaza a una puerta cerrada es peor que no tener panel.
  - **Versión visible** (número legible por humanos) coherente con `/api/version`.
  - **Páginas legales sin sesión**: titular de la app, política de privacidad (qué
    datos, dónde viven y quién los procesa — Vercel, Neon, Marketstack, Twelve Data,
    Resend), términos de uso y **descargo explícito de no asesoramiento financiero**.
  - **Ayuda centrada en Vigiladas**: qué es una zona, cómo se define, cuándo dispara,
    cuándo llega el aviso, **con qué cadencia** y qué mercados se cubren de verdad.
  - **Borrar mi cuenta** desde la app (derecho de supresión).
  - **El grifo del registro**: interruptor manual + cupo automático, ambos cambiables
    **sin desplegar**, y una pantalla honesta cuando está cerrado.
  - **Pantalla de admin mínima**: el grifo, cuatro contadores y el resultado del último
    ciclo del cron. Nada más.
  - **Estados vacíos que guían** en Vigiladas y Panel: el primer paso a la vista y un
    enlace a la ayuda.
  - **Canal de feedback visible** desde dentro de la app.

- **Fuera (aparcado a propósito, no por descuido):**
  - **Flags por usuario individuales.** Se evaluó y se descartó frente al rol: hoy no
    hay ningún caso que pida abrir Cartera a tres personas concretas, y multiplica los
    estados que hay que verificar. Se reabre el día que ese caso exista.
  - **Analítica de uso y retención.** Con veinte testers es una consulta SQL en Neon y
    no cambia ninguna decisión de la primera semana. Va a "Más adelante".
  - **Alerta proactiva al operador si el cron falla.** Aquí el resultado del último
    ciclo solo se **muestra** en la pantalla de admin. La alerta que busca al operador
    sigue siendo la idea *"Observabilidad del ciclo diario"* del roadmap.
  - **Exportar mis datos** (portabilidad). Entra solo la supresión, que es la que
    bloquea publicar. La portabilidad, cuando alguien la pida.
  - **Onboarding guiado / tour multipaso.** Estado vacío sí; asistente no.
  - **Verificación de email al registrarse.** Hoy no existe y esta épica no la añade.
    Si el grifo abierto trae ruido, se replantea entonces.
  - **Traducción / i18n.** La app es en español y así se publica.
  - **Ayuda de Cartera e Importar.** Los testers no las ven; su ayuda se escribe el día
    que se les abran.
  - **Cambio de plan de Marketstack.** No es una spec, es una acción de ops — va al
    roadmap, §Ops y despliegue (ver R-1).
  - **Soporte y moderación.** El canal de feedback es un enlace, no una bandeja de
    tickets ni un compromiso de respuesta.

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

> **Propuesta orientativa de sdd-producto** — el desglose real, sus fronteras y su
> numeración son de **sdd-arquitecto**. Se escribe aquí solo para dar tamaño a la
> épica en el gate humano, no como compromiso:
>
> 1. Rol por usuario y visibilidad de sección (incluye el Panel adaptado).
> 2. El grifo del registro + la pantalla de admin con los contadores y el último ciclo.
> 3. Versión visible, coherente con `/api/version`.
> 4. Páginas legales y el descargo de no asesoramiento.
> 5. Ayuda de Vigiladas + estados vacíos que enlazan a ella + canal de feedback.
> 6. Borrar mi cuenta.
>
> El orden importa poco salvo en un punto: **4 y 6 son los que bloquean publicar**.

## Riesgos

- **R-1 — La licencia de los datos no cubre este escenario.** El free tier de
  Marketstack **no concede derechos de uso comercial ni de redistribución**. ADR-012 lo
  registró y lo asumió explícitamente *"porque la app se compartirá con testers"* — y
  publicar en un hilo abierto es exactamente ese escenario, ahora en serio. Esta épica
  lo vuelve **visible**: las páginas legales de CE-4 tendrán que declarar de dónde
  vienen los precios. Mitigación conocida y fuera del alcance de la épica: plan Basic
  ($9.99/mes), misma key, cero código.
  ↳ **Resuelto en el gate (2026-08-19, Alberto Fojo): se publica con el free tier y se
  pasa a Basic más adelante.** El riesgo queda **asumido a conciencia**, no ignorado.
  Consecuencia para las specs: las páginas legales de CE-4 no pueden prometer una
  licencia que no se tiene — declaran la fuente de los precios y su carácter
  informativo, sin afirmar derechos de redistribución. Seguimiento: `F-EPIC-004-1`
  en el roadmap, §Ops y despliegue.
  ↳ **CERRADO el 2026-08-23 (Alberto Fojo): contratado el plan Basic (10.000
  peticiones/mes, ~$9.99/mes)** sobre cuenta propia. El riesgo **se extingue**, no se
  mitiga: el plan de pago **sí concede uso comercial**, así que el escenario que R-1
  temía —publicar en un foro abierto sin derechos— deja de existir. La mitigación se
  ejecutó exactamente como estaba escrita: **misma key, cero código, cero despliegue**.
  ↳ **Y sin embargo las páginas legales no cambian**, por decisión explícita del humano
  el mismo día. Siguen declarando la fuente y el carácter meramente informativo del
  dato **sin afirmar derechos** sobre las cotizaciones. Lo que cambia es **el motivo**:
  antes era una restricción de licencia, ahora es **prudencia elegida** —correcta pague
  lo que pague el proyecto—. Es importante no perder este matiz: quien lea el texto
  legal y lo encuentre "conservador de más" debe saber que es a propósito. El motivo
  actualizado vive en `docs/fundacion/dominio.md` y en **ADR-032**.
  ↳ Nota de honestidad sobre por qué se aceleró: no fue la licencia, fue la **cuota**.
  El incidente del 2026-08-19/20 —tres días de precios congelados sin que nadie se
  enterase— midió el consumo real en **~400 unidades/mes** contra las 100 del free tier
  (**ADR-027**). R-1 se cierra de rebote, y conviene recordarlo: el riesgo que tumbó el
  free tier **no fue el que esta épica tenía anotado**.
- **R-2 — La búsqueda de símbolos comparte cuota entre todos.** Va con el free tier de
  Twelve Data, con límite por minuto **global, no por usuario**. Varios testers buscando
  a la vez podrían ver errores. **Hipótesis a validar**, no medida: no se ha reproducido.
- **R-3 — Las cotizaciones no escalan con usuarios, pero sí con símbolos.** Verificado
  en el código: el adaptador hace **una sola llamada por ciclo** con todos los símbolos
  juntos (~30 de 100 al mes), así que más testers no rompen la cuota. Lo que crece es el
  **número de símbolos distintos** en una misma petición, y no está medido dónde topa el
  proveedor. Riesgo bajo, sin instrumentar.
- **R-4 — El público de un foro de bolsa espera tiempo real.** La app refresca una vez
  al día tras el cierre (FOUNDATION D-2, *locked*). Si la ayuda y el primer pantallazo
  no lo dicen alto, el feedback que se recoja será *"no actualiza"* y se habrá gastado
  la publicación. Lo mitiga CE-1, y es la razón de que la cadencia esté **dentro** de él.
- **R-5 — La BD pasa a contener datos financieros de terceros.** Hasta hoy la única
  cartera real es la del autor. El aislamiento entre usuarios vive en **capa de app, no
  en RLS** (F-SPEC-001-1, aparcado como refuerzo futuro). Con desconocidos dentro, un
  fallo de aislamiento deja de ser teórico. Esta épica **no lo cierra**, pero sube la
  prioridad de F-SPEC-001-1.
- **R-6 — Borrar la cuenta choca con lo derivado y lo compartido.** Avisos, episodios de
  zona y transacciones cuelgan del usuario; los **símbolos del registro son compartidos**
  entre usuarios y no deben caer con él. Qué se borra, qué se conserva y qué se anonimiza
  es una decisión de diseño, no un `DELETE`.
- **R-7 — El grifo puede cerrarse en mal momento.** Si el cupo se agota de madrugada,
  quien venga del foro se encuentra la puerta cerrada. Por eso CE-6 exige que esa
  pantalla **explique**, no que devuelva un error.
