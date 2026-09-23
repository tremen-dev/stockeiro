---
id: SPEC-066
tipo: spec
epica: EPIC-INFRA
estado: en-progreso
aprobada-por: Alberto Fojo (pre-autorizado: tres capas hasta el PR, sin preguntas bloqueantes)
historial:
  - {estado: borrador, fecha: 2026-09-23, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-09-23, por: Alberto Fojo (pre-autorizado: tres capas hasta el PR}
  - {estado: en-progreso, fecha: 2026-09-23, por: sdd-implementador}
---
# SPEC-066 — El registro se defiende: campo trampa, BotID y el correo verificado antes de ocupar plaza

## Problema

Es el follow-up **`F-SPEC-065-1`** (ledger de SPEC-065): *«el alta no tiene anti-abuso»*.
Leído en código el **2026-09-23** sobre `origin/main` (`49ebb93`, versión 0.8.0):

- `registerAction` (`src/app/(auth)/actions.ts`) valida forma, consulta el grifo
  (`registerIfOpen`, ADR-023 pto. 5), crea la fila de `users` e **inicia sesión en el acto**.
  No hay límite de frecuencia, ni captcha, ni campo trampa, ni verificación del correo.
- El único freno es el **cupo** (semilla 50, `src/lib/registration/gate.ts`), y cuenta **toda**
  fila de `users` (`countAccounts`, `src/lib/registration/service.ts`; ADR-022 pto. 9).
- Un correo ya registrado responde *«Ese email ya está registrado»* (`EmailAlreadyRegisteredError`,
  SPEC-001 CA-2): el alta es un **oráculo de enumeración**.
- Desde SPEC-065 la portada es **indexable**: `/register` está a un clic de cualquier rastreador.

Dos daños, ninguno de coste (ADR-042 §Contexto): **aforo** —unas altas basura llenan el cupo y
cierran el registro a gente real (R-7 de EPIC-004)— y **reputación de envío** —una cuenta con un
correo ajeno hace que `tremen.dev` escriba a quien no lo pidió (avisos de SPEC-006, recuperación de
SPEC-023, con el diseño de SPEC-056)—.

El humano (Alberto Fojo, 2026-09-23) decidió **tres capas, todas en esta spec**: campo trampa +
tiempo mínimo en el formulario; **Vercel BotID**; y **verificación del correo** (la cuenta sin
verificar no ocupa plaza, no recibe avisos y se borra a las 24 h). Las decisiones estructurales
están en **ADR-042**; aquí se referencian por punto y no se repiten.

## Usuarios / roles afectados

- **Visitante que se da de alta**: deja de entrar en la app en el acto. Recibe un correo, pulsa
  *activar*, y entra con su contraseña. Si su navegador no ejecuta JavaScript, en Vercel no puede
  darse de alta (ADR-042, Consecuencias).
- **Tester y admin existentes**: **nada cambia**: sus cuentas quedan activadas en la migración
  (ADR-042 pto. 3).
- **Automatismo** (bot, script): recibe la misma respuesta que un alta legítima y no crea nada.
- **Tercero cuyo correo alguien teclea**: recibe como mucho 3 correos de activación en 24 h, y
  sólo si el envío superó las capas 1 y 2; si no hace nada, la cuenta desaparece sola.
- **Operador (humano)**: el recuento de `/admin` pasa a ser de cuentas activadas; comprobaciones
  tras mergear en `docs/despliegue.md` (CA-24).

## Diseño

Las decisiones que constriñen trabajo futuro están en **ADR-042** (pendiente de aprobación). Las
que siguen son locales a esta entrega:

- **D-1 — Épica: EPIC-INFRA.** Es seguridad del sistema ya entregado (EPIC-INFRA: *«seguridad y
  mantenimiento»*), no capacidad de producto para el usuario. EPIC-FIX no encaja (no restaura una
  promesa rota y excluye funcionalidad nueva) y EPIC-MEJORA tampoco (necesita esquema y ADR, CE-M3).
- **D-2 — Rutas nuevas colgando de `/register/`**, que ya es público: `/register/confirmar/<token>`
  (activar) y `/register/reenviar` (pedir otro correo). `PUBLIC_PREFIXES` **no crece** (ADR-042
  alternativas). Las dos van con `noindex` (ya lo da el layout, SPEC-065 D-2); la de confirmar,
  además, con `Referrer-Policy: no-referrer` como la de recuperación (ADR-015 pto. 9), porque lleva
  el token en el path.
- **D-3 — Constantes con nombre, en un solo sitio cada una** (patrón de `reset-tokens.ts`):
  plazo de activación **24 h**, límite **3** correos por cuenta en **24 h** móviles, tiempo mínimo
  **2 s**. Cambiarlas es cambiar un número.
- **D-4 — Fuente única de textos.** Todo texto nuevo que lee una persona (pantalla neutra del alta,
  aviso de cuenta pendiente al entrar, acuse del reenvío, enlace no válido, activación con el grifo
  cerrado, aviso de *cuenta activada* en `/login`) vive en **un** módulo de mensajes y lo importan
  la página y su test. Los motivos de grifo cerrado se **reutilizan** de
  `src/lib/registration/messages.ts`, no se reescriben.
- **D-5 — El puerto de BotID** es una función propia (p. ej. `src/lib/registration/bot-check.ts`)
  que devuelve un veredicto `humano | automatismo` y es la única que importa `botid/server`. La
  server action la recibe inyectable, que es por donde los unitarios simulan bot (ADR-042 pto. 17).
- **D-6 — La purga** cuelga de `runCronCycle` (`src/lib/triggers/cycle.ts`), después de
  `closeCronRun`, para que la cubran los unitarios con fakes que ya existen; el endpoint no cambia.
- **D-7 — Versión MINOR** (0.8.0 → 0.9.0; ADR-024/ADR-033): cambia el flujo visible de alta.

## Criterios de aceptación

Convención de toda la spec: **«respuesta neutra»** es la pantalla de *«revisa tu correo»* del alta
(ADR-042 pto. 6). **«No crea nada»** es: ninguna fila nueva ni modificada en `users` ni en
`email_verification_tokens`, y **ninguna** llamada al puerto de correo.

### Rebanada 1 — Capa 1: campo trampa y tiempo mínimo

- **CA-1 (El campo trampa delata y no se nota).**
  Dado un envío del alta con todo válido y más de 2 s desde el pintado,
  cuando el campo trampa llega **con cualquier valor no vacío**,
  entonces la respuesta es la neutra y no crea nada; y con el campo trampa **vacío** el alta sigue
  su camino. Especímenes mínimos en los dos sentidos, en el test: `"x"`, `" "`, una URL → cazan;
  cadena vacía y campo ausente → no cazan.

- **CA-2 (El campo trampa no lo ve, no lo alcanza y no lo rellena un humano).**
  Dado `/register` servido en el e2e,
  cuando se inspecciona el campo trampa,
  entonces no es visible, no es alcanzable con el tabulador (recorrer el formulario con el teclado
  del primer al último control nunca lo enfoca), no está en el árbol de accesibilidad y declara
  que el navegador no lo autocomplete. Y un alta completa hecha **sólo con teclado** llega a la
  respuesta neutra **y crea la cuenta** (CA-7).

- **CA-3 (Menos de 2 s, o un sello que no es nuestro, es un automatismo).**
  Dado un envío del alta con todo válido y el campo trampa vacío,
  cuando el sello de pintado **falta**, está **manipulado**, está **firmado con otra clave** o
  tiene **menos de 2 s**,
  entonces la respuesta es la neutra y no crea nada; con un sello propio de **≥ 2 s** —incluido
  uno de hace un día— el alta sigue. El tiempo se mide **con el reloj del servidor en los dos
  extremos**: un test que adelante el reloj del cliente no cambia el veredicto. El sello no contiene
  `AUTH_SECRET` ni nada del que se pueda recuperar.

### Rebanada 2 — Capa 2: BotID

- **CA-4 (El veredicto de BotID decide, y su fallo no bloquea).**
  Dado el puerto de D-5 simulado en unitario,
  cuando responde **bot** o **bot verificado**,
  entonces tanto el alta como el reenvío (CA-16) devuelven su respuesta neutra y no crean nada ni
  envían nada;
  cuando responde **humano**, siguen su camino;
  y cuando **lanza** (servicio caído, OIDC ausente), siguen su camino **y** queda una línea en el
  log de error que nombra BotID (ADR-042 pto. 18).
  El orden de ADR-042 pto. 12 se prueba: un envío que ya cae por el campo trampa **no consulta**
  el puerto.

- **CA-5 (BotID es entero o no está, y sólo en modo Basic).**
  Dado el puerto de D-5 y la inicialización del cliente,
  cuando la identidad de build dice que es un despliegue de Vercel (Production o Preview),
  entonces el servidor llama a `checkBotId` **sin** modo desarrollo y con `checkLevel: 'basic'`, y
  el cliente se inicializa protegiendo **exactamente** los POST del alta y del reenvío, también en
  `basic`;
  cuando **no** lo es (local, CI, e2e),
  entonces el servidor usa la vía de desarrollo de la librería (veredicto humano, **sin** llamar a
  la red ni pedir OIDC) y el cliente **no se inicializa**. Se comprueba en unitario sobre las dos
  mitades con la identidad simulada, y en el e2e observando que **ninguna** petición del navegador
  va al prefijo de BotID durante un alta completa. La decisión no lee `NODE_ENV` (ADR-042 pto. 17).

- **CA-6 (Las rutas de BotID salen del proxy sin sesión y sin rastro).**
  Dado el proxy (`src/proxy.ts`),
  cuando llega sin cookies una petición a **cualquier** ruta que `withBotId` reescribe,
  entonces no se redirige a `/login` y no se fija ninguna cookie `authjs.*`; y una ruta que sólo
  **se parece** (el prefijo sin su separador, el prefijo con un carácter de más) sigue exigiendo
  sesión. La lista de rutas **se deriva** de `withBotId(...).rewrites()` en el propio test (ADR-040),
  con centinela de no-vacuidad; especímenes que cazan (quitar la excepción del proxy → rojo) y que
  no (una ruta privada, `/dashboard`, sigue redirigida). Ni el `matcher` ni `PUBLIC_PREFIXES`
  cambian (se comprueba en el gate con el diff, CA-25).

- **CA-7 (La configuración de Next conserva lo que ya tenía).**
  Dado `next.config.mjs` envuelto con `withBotId`,
  cuando se sirve el build,
  entonces `/reset-password/<token>` sigue saliendo con `Referrer-Policy: no-referrer`,
  `/register/confirmar/<token>` sale con la misma cabecera (D-2), y `/api/version` sigue
  respondiendo su contrato (SPEC-031) con la versión nueva.

### Rebanada 3 — Capa 3: la cuenta nace pendiente

- **CA-8 (Un alta crea una cuenta pendiente y un correo, y nada más).**
  Dado el grifo abierto y un correo que no existe,
  cuando se completa el alta (campo trampa vacío, ≥ 2 s, BotID humano),
  entonces existe **una** cuenta **pendiente** (`email_verified_at` nula, escrita así por el camino
  de alta y no por el default de la columna), **un** token vivo guardado sólo como digest, sale
  **un** correo de activación a la dirección almacenada, la respuesta es la neutra, **no hay
  sesión** (ninguna cookie de sesión en la respuesta) y el recuento del cupo **no ha subido**.

- **CA-9 (El alta no dice si el correo existe).**
  Dados tres correos —uno nuevo, uno de una cuenta **pendiente** y uno de una cuenta **activada**—,
  cuando se da de alta cada uno,
  entonces las tres respuestas son **idénticas** (mismo texto y misma forma; se comparan entre sí,
  no contra un literal), la contraseña se **hashea en las tres ramas** y el envío del correo queda
  **fuera** del camino de la respuesta (ADR-015, `after()`); sobre la **activada** no cambia nada
  (ni contraseña, ni época de credencial, ni tokens) y no se envía nada. El texto *«Ese email ya está
  registrado»* ya no se muestra en ningún camino (RN-02 sigue vigente: nunca hay dos filas con el
  mismo correo normalizado).

- **CA-10 (Volver a darse de alta sobre una pendiente es un alta nueva).**
  Dada una cuenta pendiente con un enlace vivo,
  cuando se da de alta de nuevo el mismo correo con otra contraseña y el límite lo permite,
  entonces la contraseña pasa a ser la nueva, el plazo de 24 h se reinicia, el enlace anterior
  **deja de servir**, sale un correo con uno nuevo y la respuesta es la neutra;
  y si el límite de CA-12 está agotado, **no cambia nada** (ni contraseña, ni plazo, ni enlaces) y
  la respuesta es la misma.

- **CA-11 (El enlace: un solo uso, sin secreto en base, con el plazo de la cuenta).**
  Dado un enlace de activación,
  cuando se inspecciona la base, se consume dos veces **a la vez**, se usa pasado el plazo o se
  manipula un carácter,
  entonces la base sólo tiene su digest; de dos consumos simultáneos **exactamente uno** activa;
  usado, caducado, inexistente y manipulado muestran **el mismo** mensaje; y ningún enlace vive más
  allá de las 24 h desde el alta de su cuenta, aunque se haya emitido por un reenvío en la hora 23.

- **CA-12 (Tres correos por cuenta en 24 h, cuente lo que cuente la causa).**
  Dada una cuenta pendiente,
  cuando se piden correos de activación por cualquier mezcla de alta, re-alta y reenvío,
  entonces salen **como mucho 3** en cualquier ventana de 24 h; la cuarta petición devuelve la misma
  respuesta que las anteriores y no envía nada. El límite se lee de su constante (D-3): el test
  pide `límite + 1` y no un literal.

- **CA-13 (Abrir el enlace no activa; pulsar sí, y no inicia sesión).**
  Dado un enlace vivo,
  cuando se hace **GET** a `/register/confirmar/<token>` (una o varias veces),
  entonces se ve un botón de activar y el enlace **sigue vivo**;
  cuando se pulsa,
  entonces la cuenta queda **activada**, el enlace consumido, se llega a `/login` con el aviso de
  *cuenta activada* y **no hay sesión** hasta que se entra con la contraseña. La página no es
  indexable y sale con `Referrer-Policy: no-referrer` (CA-7).

- **CA-14 (El grifo se consulta al activar, y cerrado no quema el enlace).**
  Dada una cuenta pendiente con enlace vivo,
  cuando se pulsa *activar* con el grifo cerrado **a mano** o **por cupo**,
  entonces la cuenta **sigue pendiente**, el enlace **no se consume** y se lee el motivo concreto
  (los textos de `REGISTRO_CERRADO_MOTIVO`, D-4);
  y si el grifo se reabre dentro del plazo, **el mismo enlace** activa la cuenta.

- **CA-15 (El cupo cuenta cuentas activadas).**
  Dado un cupo de N,
  cuando hay N−1 activadas y cualquier número de pendientes,
  entonces el registro **sigue abierto** y `/admin` enseña N−1;
  y cuando hay N activadas, está **cerrado por cupo**, haya las pendientes que haya. La matriz de
  `registrationState` (función pura) no cambia; lo que cambia es el número que se le pasa.

### Rebanada 4 — La cuenta pendiente, por dentro y por fuera

- **CA-16 (Pedir otro correo no enumera y respeta el plazo).**
  Dado `/register/reenviar`, accesible sin sesión,
  cuando se envía un correo **inexistente**, de una cuenta **activada**, de una **pendiente dentro
  del plazo**, de una **pendiente con el límite agotado** y de una **pendiente fuera de plazo**,
  entonces las cinco respuestas son idénticas entre sí; y **sólo** en el tercer caso sale un correo,
  con un enlace nuevo que invalida los anteriores y **no alarga** el plazo. Está protegido por
  BotID (CA-4, CA-5).

- **CA-17 (Entrar con una cuenta pendiente).**
  Dada una cuenta pendiente,
  cuando se entra con la contraseña **correcta**,
  entonces no hay sesión y se lee que falta activar la cuenta, con un enlace a `/register/reenviar`;
  cuando se entra con una contraseña **incorrecta**,
  entonces el mensaje es **idéntico** al de un correo inexistente (SPEC-001 CA-4 intacto).

- **CA-18 (Una cuenta pendiente no recibe más correo que el de activación).**
  Dada una cuenta pendiente,
  cuando pide recuperar la contraseña,
  entonces recibe el mismo acuse que cualquiera (SPEC-023 CA-1) y **no** se emite token ni correo;
  y cuando el ciclo notifica (sembrando en unitario un episodio abierto a su nombre),
  entonces **no** sale ningún aviso hacia ella, y los de las cuentas activadas salen igual que antes.

- **CA-19 (La pendiente caducada se borra, y la purga no toca el ciclo).**
  Dadas una pendiente de **más de 24 h**, una pendiente de **menos de 24 h** y una **activada
  antigua**,
  cuando corre el ciclo diario autorizado,
  entonces desaparece **sólo** la primera, con **todo** lo suyo (el mismo borrado que la baja,
  `purgeUserData`, ADR-022; incluida su fila de `email_verification_tokens`);
  y si la purga **lanza**, el ciclo ya ha ingerido, evaluado y notificado, su fila de `cron_runs`
  queda cerrada con éxito, la respuesta HTTP es **la misma** que sin purga (ADR-023 pto. 16) y queda
  una línea en el log de error que nombra la purga.

- **CA-20 (La migración: aditiva, las de antes activadas y las del código anterior también).**
  Dada la migración nueva de `drizzle/` aplicada sobre una base con cuentas,
  cuando se inspecciona,
  entonces toda cuenta previa queda **activada** con `email_verified_at = created_at`; una fila de
  `users` insertada **sin nombrar la columna** (como lo hace el código anterior durante la
  convivencia, ADR-042 pto. 2) nace **activada**; la tabla `email_verification_tokens` existe con
  digest único; y `db:scan` no encuentra SQL destructivo (SPEC-032). El esquema de test sale de las
  migraciones (ADR-019).

### Rebanada 5 — El correo, la privacidad, el runbook

- **CA-21 (El correo de activación tiene el diseño de SPEC-056 y el enlace que manda).**
  Dado el correo de activación compuesto por la plantilla,
  cuando se lee su texto y su HTML,
  entonces lleva los dos cuerpos (ADR-036); en el texto, el enlace es la **primera** URL absoluta;
  en el HTML aparece como botón **y** como texto copiable; dice el plazo leído de su constante;
  dice qué hacer si no lo has pedido tú (nada: la cuenta se borra sola); y el origen del enlace es
  `APP_BASE_URL`, nunca la cabecera `Host` (ADR-015 pto. 8, SPEC-055). Cumple las guardias de
  plantilla que SPEC-056 ya tiene para los otros tres correos, sin aflojarlas.

- **CA-22 (La privacidad dice la verdad sobre lo nuevo).**
  Dado `/legal/privacidad` (`src/lib/legal/content.ts`),
  cuando se lee,
  entonces describe la tabla `email_verification_tokens` (la guardia de SPEC-035 CA-5 que compara
  categorías con el esquema queda en verde **sin tocarla**), la fecha de verificación en la
  categoría de cuenta, que una cuenta sin activar **se borra en 24 h**, y que el alta pasa una
  comprobación anti-bots de Vercel (en qué consiste y qué ve). La frase de cookies y scripts sigue
  siendo **cierta**: si BotID fija alguna cookie o carga algún script en Vercel, se dice (CA-24 lo
  mide tras mergear). **El texto legal lo aprueba el humano** (es del titular, R-3 de SPEC-065).

- **CA-23 (El recorrido completo, en el navegador).**
  Dado el e2e,
  cuando un visitante se da de alta (esperando ≥ 2 s), lee la respuesta neutra, abre el enlace del
  buzón de disco del e2e, pulsa *activar* y entra con su contraseña,
  entonces llega a `/dashboard`; y el mismo correo intentado **antes** de activar en `/login` enseña
  el aviso de CA-17. Las suites e2e que hoy se dan de alta por la interfaz pasan por **un** ayudante
  compartido que hace este recorrido (o crean la cuenta activada por la base, si lo que prueban no es
  el alta), **sin cambiar lo que afirman** después de entrar.

- **CA-24 (El runbook dice qué es del humano y cómo comprobarlo).**
  Dado `docs/despliegue.md` (ADR-018),
  cuando se lee,
  entonces tiene una sección de esta spec que dice: (a) que **BotID Basic no requiere activarse**
  en el panel y que **Deep Analysis no se activa** (Hobby; y si algún día se pasa a Pro, se decide
  con otro ADR); (b) cómo comprobar que el proyecto tiene **OIDC** habilitado, del que depende la
  comprobación real; (c) la comprobación tras mergear: un alta real desde un navegador en el
  dominio llega al correo; `curl` sin cookies a la ruta del reto de BotID **no** responde `307 →
  /login`; el filtro *BotID* de la pestaña *Firewall* enseña las comprobaciones; y las cookies que
  deja `/register` en un navegador anónimo, anotadas contra lo que promete CA-22; (d) que la purga
  va en el ciclo diario y no tiene pantalla. Se verifica **en el gate, leyendo** (ADR-040).

- **CA-25 (Cero regresión, re-encuadres declarados y nada aflojado).**
  Dada la batería completa (`npm test` y `npx playwright test`) sobre un build del árbol
  commiteado,
  cuando se ejecuta,
  entonces pasa entera; la versión sube a **0.9.0** en los dos ficheros (ADR-024/ADR-033); la lista
  cerrada de `.env.example` sigue en **once** (ADR-042 pto. 20); el `matcher` de `src/proxy.ts` y
  `PUBLIC_PREFIXES` no tienen diff; y los **únicos** `expect` ajenos que cambian son los que esta
  spec **autoriza** por nombre, cada uno anotado en el ledger con *qué vigilaba antes y qué vigila
  ahora* (FOUNDATION, 3.ª convención):
  1. los que afirman el texto *«Ese email ya está registrado»* o que un alta duplicada **falla**
     (SPEC-001 CA-2): pasan a afirmar CA-9;
  2. los que afirman que tras el alta se llega a `/dashboard` (SPEC-001 CA-1 y los ayudantes
     `registrarYEntrar` del e2e): pasan a afirmar el recorrido de CA-23;
  3. los que afirman que el cupo cuenta **toda** fila de `users` (SPEC-037): pasan a afirmar CA-15.
  Cualquier otro `expect` ajeno que se ponga rojo **no se re-encuadra en la rama**: se escala al
  gate. Se comprueba en el gate con el diff (ADR-031/ADR-037), no con una guardia congelada.

## Entidades y reglas afectadas

- **ADR-042** (nuevo, borrador): todas las decisiones estructurales de esta spec.
- **RN-02**: intacta como invariante; lo que se retira es **decirlo** en el alta (CA-9).
- **RN-03**: no se ensancha a páginas; las dos rutas nuevas cuelgan de `/register` (D-2). Las
  rutas del reto de BotID salen del proxy como no-páginas, al estilo de `CRAWLER_PATHS` (CA-6).
- **RN-01**: intacta; el token es por cuenta y la purga usa el borrado de ADR-022.
- **Propuesta de RN-19 para `reglas.md`**, a escribir por sdd-arquitecto **en el gate** si se
  aprueba (ADR-025): *«Una cuenta sólo cuenta como tal —entra, ocupa plaza, recibe avisos— cuando
  su correo está verificado. La cuenta sin verificar caduca a las 24 h de su alta.»*
- **ADR-015** (mecánica de token, reutilizada), **ADR-016** (la re-alta sobre pendiente mueve la
  época de credencial como cualquier cambio de contraseña), **ADR-019** (esquema de test desde
  migraciones), **ADR-022** (borrado; pto. 9 precisado), **ADR-023** (grifo; pto. 3 precisado,
  ptos. 8 y 16 intactos), **ADR-024/ADR-033** (versión), **ADR-036** (dos cuerpos del correo),
  **ADR-040** (derivar el prefijo de BotID, CA-22 y CA-24 sin guardia), **RI-01** (migración
  aditiva, ADR-042 pto. 2).
- **Esquema** (`src/db/schema.ts`): `users.email_verified_at`; tabla `email_verification_tokens`.
- **Términos de `dominio.md`** propuestos, a escribir **en el gate** (ADR-025): *cuenta pendiente
  de activar*, *cuenta activada*, *correo de activación*, *plazo de activación*.

## Fuera de alcance

- **Límite de frecuencia por IP** (Vercel WAF o propio). → `F-SPEC-066-1`.
- **Alerta de altas anómalas** y **recuento de pendientes en `/admin`**: la pantalla de operación
  sigue enseñando cuentas (ahora activadas) y nada más. → `F-SPEC-066-2`.
- **BotID en `/forgot-password`**: ya está limitado por cuenta (SPEC-023 CA-12) y sólo escribe a
  cuentas activadas (CA-18). → `F-SPEC-066-3`.
- **Arreglar la guardia de SPEC-051 que congela `PUBLIC_PREFIXES` por igualdad exacta**
  (`tests/tarjeta-guardias-ampliadas.test.ts`): es el anti-patrón del 3.er corolario de FOUNDATION;
  D-2 lo esquiva en vez de arrastrarlo. → `F-SPEC-066-4` (EPIC-FIX, junto a `F-SPEC-051-1`).
- **Cerrar del todo el pre-secuestro** (atacante que re-registra después de la víctima). →
  `F-SPEC-066-5`.
- **Alta sin JavaScript** en Vercel. → `F-SPEC-066-6`.
- **Que el formulario no se quede colgado si el reto de BotID no carga** (comportamiento de la
  librería). → `F-SPEC-066-7`.
- **BotID Deep Analysis**, captcha visible, lista de espera (`F-ADR-023-3`), tope de vigiladas
  (`F-SPEC-065-2`), Search Console (`F-SPEC-065-3`).

## Notas para el gate humano

1. **Tres decisiones que conviene leer con lupa** (todas en ADR-042):
   - **No se puede entrar sin activar** (pto. 1, pto. 9). Alternativa rechazada: entrar con aviso;
     reabriría el daño de reputación.
   - **Las cuentas existentes quedan activadas** (pto. 3). Si sospechas altas basura ya hechas
     desde que la portada es indexable, se borran a mano; dilo si prefieres otro corte.
   - **Al bot se le miente con la misma pantalla que al humano** (pto. 13). El precio es que un
     humano al que BotID o el reloj confundan con un bot no recibe correo; la pantalla le dice que
     vuelva a darse de alta si no le llega.
2. **Cambia una promesa de SPEC-001**: el alta deja de decir *«ese email ya está registrado»* y deja
   de entrar en la app en el acto (CA-9, CA-25 pto. 1 y 2). Lo pediste («no filtrar si un correo
   existe»); se anota porque retira texto de una spec en `hecho` y autoriza re-encuadrar sus tests.
3. **Textos legales (CA-22)**: el implementador propone la redacción; **tú la apruebas** en la PR.
   Es la única pieza que depende de lo que BotID haga de verdad en el navegador, y eso sólo se mide
   en Vercel (CA-24 c).
4. **Tareas humanas tras mergear** (CA-24): comprobar OIDC, el alta real en el dominio y el filtro
   BotID del Firewall. Recomendado **antes** de enviar el sitemap en Search Console (`F-SPEC-065-3`).
5. **Tamaño.** Cabe en una PR, pero es grande: esquema + 3 páginas + correo + purga + proxy +
   ayudante e2e para ~18 suites que hoy se dan de alta por la interfaz. Si prefieres partir,
   la costura limpia es **A = verificación del correo** (CA-8…CA-23 sin CA-4/5/6/7) y **B = campo
   trampa + BotID** (CA-1…CA-7) después; A primero, porque la respuesta neutra de B es la pantalla
   de A. No se recomienda B antes de A.
6. **Épica (D-1)**: EPIC-INFRA. Si la quieres en otra, es cambiar el frontmatter.
7. **Versión**: MINOR (D-7).
