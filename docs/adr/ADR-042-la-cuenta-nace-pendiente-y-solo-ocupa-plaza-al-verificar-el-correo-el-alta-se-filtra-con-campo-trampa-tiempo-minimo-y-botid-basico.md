---
id: ADR-042
tipo: adr
estado: borrador
historial:
  - {estado: borrador, fecha: 2026-09-23, por: sdd-arquitecto}
---
# ADR-042: La cuenta nace pendiente y solo ocupa plaza al verificar el correo; el alta se filtra con campo trampa, tiempo mínimo y BotID básico

- Deciders: propone **sdd-arquitecto** (2026-09-23, al escribir **SPEC-066**). Las **tres capas**
  (campo trampa + tiempo mínimo, Vercel BotID, verificación del correo) las decidió **el humano
  (Alberto Fojo)** en la petición que abre la spec; este ADR fija **cómo** encajan con el modelo
  de cuenta, el grifo (ADR-023) y el despliegue. **Pendiente de aprobación humana.**
  **Precisa** —sin superseder— **ADR-023 pto. 3** y **ADR-022 pto. 9** (qué cuenta como *cuenta*
  para el cupo) y **reutiliza** la mecánica de token de **ADR-015**.
- Specs relacionadas: **SPEC-066** (lo origina); **SPEC-001** (su CA-2 cambia de texto, ver
  pto. 6); **SPEC-023** / ADR-015 (mecánica de token que se reutiliza); **SPEC-037** / ADR-023
  (grifo y ciclo); **SPEC-036** / ADR-022 (borrado); **SPEC-056** / ADR-036 (correo);
  **SPEC-065** (portada indexable, que vuelve urgente el riesgo; `F-SPEC-065-1`).

## Contexto

Hasta hoy el alta de Stockeiro no tiene **ningún** freno contra automatismos: ni límite de
frecuencia, ni captcha, ni campo trampa, ni verificación del correo. Lo único que la acota es el
**cupo de cuentas** (semilla 50, ADR-023) y el grifo manual de `/admin`. Desde SPEC-065 la portada
es **indexable**, así que `/register` es encontrable por cualquier rastreador. Dos daños
plausibles, ninguno de coste:

1. **Aforo.** Unas decenas de altas basura llenan el cupo y **cierran el registro a gente real**
   —la condición de fallo que R-7 de EPIC-004 describió para el foro—, porque el cupo hoy cuenta
   **toda** fila de `users` (`countAccounts`, ADR-022 pto. 9).
2. **Reputación de envío.** Stockeiro manda correo desde `tremen.dev` (avisos, recuperación;
   ADR-006, SPEC-056). Una cuenta dada de alta con un correo **ajeno** hace que nuestro dominio
   escriba a un tercero que no lo pidió. Es lo que tumba la entregabilidad de un dominio pequeño,
   y `tremen.dev` es la marca paraguas.

Leído en código el 2026-09-23: `registerAction` (`src/app/(auth)/actions.ts`) crea la cuenta e
**inicia sesión en el acto**; un correo ya registrado devuelve *«Ese email ya está registrado»*
(SPEC-001 CA-2), que es un **oráculo de enumeración**; `users` no tiene ninguna marca de
verificación.

Verificado contra el paquete real (`botid@1.5.11`, leído su `dist/` el 2026-09-23, y la
documentación de Vercel de la misma fecha), no de memoria:

- `checkBotId()` (`botid/server`) decide **modo desarrollo** con
  `developmentOptions.isDevelopment ?? process.env.NODE_ENV !== 'production'`. En modo desarrollo
  devuelve **humano** (o lo que diga `developmentOptions.bypass`: `'HUMAN' | 'BAD-BOT' |
  'GOOD-BOT'`). **Fuera de ese modo exige el token OIDC de Vercel y lanza si no lo hay.** El e2e
  de este proyecto corre `next start` (`NODE_ENV=production`) **fuera de Vercel**: con la
  configuración por defecto, **cada alta del e2e lanzaría**.
- `initBotId()` (`botid/client/core`) **parchea `fetch`** para las rutas protegidas y, antes de
  enviar, **espera** a un reto que carga de una ruta propia (`/149e9513-…/…/a-4-a/c.js`), que
  `withBotId` (`botid/next/config`) reescribe hacia `api.vercel.com`. Esa ruta **cae dentro del
  `matcher` de `src/proxy.ts`** y no es pública: sin sesión —que es el caso de todo el que se
  registra— el proxy la mandaría a `/login` y **el reto no cargaría nunca**. Es la cuarta vez que
  este molde muerde (icono SPEC-047, tarjeta SPEC-051, `robots.txt` SPEC-065).
- BotID **no** protege envíos de formulario nativos (sin `fetch`); **sí** protege las server
  actions de Next, que viajan por `fetch` al path de la página.
- Niveles: **Basic**, gratis en todos los planes; **Deep Analysis**, sólo Pro/Enterprise, a
  1 $ por cada 1.000 llamadas a `checkBotId()`. Stockeiro está en **Hobby** (`docs/despliegue.md`).

## Decisión

### A. La cuenta nace pendiente

1. **Dos estados de cuenta: *pendiente de activar* y *activada*.** Se representa con
   `users.email_verified_at` (`timestamptz`, nula = pendiente). Una cuenta pendiente **no puede
   iniciar sesión, no ocupa plaza en el cupo y no recibe ningún correo** salvo el de activación.

2. **Compatibilidad hacia atrás durante la convivencia (RI-01, `F-SPEC-023-1`).** Abrir la PR
   migra la base de producción mientras el código anterior sigue sirviendo altas. Por eso la
   columna lleva **`DEFAULT now()`**: una fila insertada por el código anterior —que no conoce la
   columna— nace **activada**, que es lo que ese código le prometió a quien se registró (sesión en
   el acto). El camino de alta **nuevo** escribe `NULL` **explícitamente**. El precio —un camino
   de inserción futuro que olvide el `NULL` crea cuentas activadas— se paga con un test del
   camino de alta, no con un default peligroso en la otra dirección.

3. **Las cuentas existentes quedan activadas** en la migración (`email_verified_at =
   created_at`). Obligar a re-verificar dejaría fuera, sin aviso, a los testers que ya usan la
   app —ninguno podría entrar hasta encontrar un correo que nunca pidió—, y el riesgo que motiva
   esto nace con la portada indexable, que tiene horas. Si el operador sospecha de altas basura
   anteriores, las borra a mano; no se diseña para ello.

### B. El token de activación es el de ADR-015, con otro plazo

4. **Misma mecánica que la recuperación** (ADR-015 ptos. 1, 2, 5, 6, 7): secreto opaco de 32
   bytes de CSPRNG, sólo su SHA-256 en base, un solo uso con consumo por `UPDATE` condicional
   atómico, el GET no consume, y emitir uno nuevo invalida los vivos. Tabla propia
   `email_verification_tokens`, gemela de `password_reset_tokens` y por el mismo motivo (un token
   es un evento, y el historial es lo que permite limitar). Cae con la cuenta (ADR-022).

5. **El plazo es de la cuenta, no del enlace: 24 h desde el alta.** Todo enlace caduca, como
   tarde, a las 24 h de `created_at`. Reenviar **no alarga** el plazo; volver a darse de alta
   sobre una cuenta pendiente **sí** lo reinicia (es un alta nueva: pto. 7). Límite de correos de
   activación: **3 por cuenta en 24 h móviles**, cuente lo que cuente la causa (alta, re-alta o
   reenvío). Pasado el límite, la petición no hace nada y lo dice igual que si lo hubiera hecho.

### C. El alta deja de enumerar

6. **La respuesta al alta es la misma exista o no el correo.** Correo nuevo, pendiente o activado:
   misma pantalla (*«revisa tu correo»*) y el mismo trabajo dominante (el hash de la contraseña),
   con el envío fuera del camino de la respuesta (`after()`, como ADR-015). **Se retira el texto
   *«Ese email ya está registrado»* de SPEC-001 CA-2**; **RN-02 no cambia** —sigue sin poder haber
   dos cuentas con el mismo correo—, lo que cambia es que ya no se **dice**. Sobre un correo
   **activado** el alta no cambia nada y no envía nada; la pantalla lo cubre con una frase que
   vale para los dos casos (*«si ya tenías cuenta con este correo, no te llegará nada: entra o
   recupera la contraseña»*).

7. **Re-alta sobre una cuenta pendiente = alta nueva.** Sustituye la contraseña, reinicia el
   plazo, invalida los enlaces vivos y envía uno nuevo (si el límite del pto. 5 lo permite; si no,
   no toca nada). Es lo que protege a la víctima del caso común de *pre-secuestro*: quien dio de
   alta su correo antes que ella no se queda con la contraseña cuando ella se registre después.
   El residual —el atacante re-registra **después** de la víctima y ésta pulsa el enlace que le
   llegó de esa re-alta— se acepta y se anota (`F-SPEC-066-5`).

8. **Activar no inicia sesión.** El enlace lleva a una página pública que **no consume al
   abrirse** (los escáneres de correo pinchan enlaces) y pide un clic; el POST activa y manda a
   `/login` con un aviso. Mismo criterio que SPEC-023 CA-14: una ruta pública no autentica.

9. **Iniciar sesión con una cuenta pendiente**: con la contraseña **correcta**, no hay sesión y
   se dice que falta activar, con enlace para pedir otro correo (quien sabe la contraseña ya sabe
   que la cuenta existe: no es enumeración). Con la contraseña **incorrecta**, el error genérico de
   siempre, indistinguible del de un correo inexistente.

### D. El cupo cuenta cuentas activadas

10. **Precisa ADR-023 pto. 3 y ADR-022 pto. 9**: *«cuentas»* en la condición del grifo son las
    **activadas vivas**. Una pendiente no ocupa plaza. El grifo se consulta **dos veces**: al dar
    de alta (con el grifo cerrado no se crea nada ni se manda correo) y **al activar**, que es el
    momento en que la cuenta **toma** plaza. Si al activar el grifo está cerrado, la cuenta sigue
    pendiente, **el enlace no se consume** y se enseña el motivo (ADR-023 pto. 3); si se reabre
    dentro del plazo, el mismo enlace sirve. El exceso por activaciones simultáneas en la última
    plaza es el residual de ADR-023 pto. 8, que sigue aceptado.

11. **La cuenta pendiente se borra a las 24 h.** La barre el **ciclo diario existente**
    (`/api/cron/refresh`), con el mismo borrado que la baja voluntaria (`purgeUserData`,
    ADR-022: cae todo lo propio). Se ejecuta **después de cerrar la fila de `cron_runs`**, con su
    fallo **contenido y registrado en el log**: el ciclo es la promesa del producto y una purga no
    puede tumbarlo, y lo que no se purgue hoy se purga mañana. **La respuesta del cron no cambia**
    (ADR-023 pto. 16) y `cron_runs` no gana columnas. Vida máxima de una pendiente: < 48 h (24 h
    de plazo + hasta un día de espera al ciclo); pasado el plazo **ya no se puede activar** aunque
    el ciclo no haya pasado, porque sus enlaces han caducado.

### E. Antes de crear nada: campo trampa, tiempo mínimo y BotID

12. **Orden en el camino de alta**: forma del formulario → campo trampa y tiempo mínimo → BotID →
    grifo → alta. Los filtros baratos van primero; la llamada de red, después.

13. **Al automatismo detectado se le responde lo mismo que a un alta legítima**: la pantalla de
    *«revisa tu correo»* del pto. 6. No se crea nada, no se envía nada, no se le dice qué le
    delató. Es la respuesta **indistinguible** que el pto. 6 ya exige para no enumerar, así que no
    añade superficie. El coste lo paga el falso positivo humano, que no recibe correo; la pantalla
    le dice qué hacer si no llega (volver a darse de alta), y la re-alta es inocua (pto. 7).

14. **Campo trampa**: un campo que un humano **no ve, no alcanza con el teclado, no oye con un
    lector de pantalla y su navegador no autocompleta**. Cualquier valor no vacío = automatismo.

15. **Tiempo mínimo: 2 s entre pintar el formulario y recibir el envío, medidos en el
    servidor.** El instante de pintado viaja en el formulario **firmado** (HMAC con una subclave
    derivada de `AUTH_SECRET` y una etiqueta propia): sin firma válida, o con menos de 2 s, =
    automatismo. Así no depende del reloj del cliente ni se falsifica sin el secreto. **Sin cota
    superior**: una pestaña abierta desde ayer es un humano lento, no un bot.

16. **BotID, en modo Basic y sólo Basic**, fijado en los dos lados (`checkLevel: 'basic'` en el
    `protect` del cliente y en `checkBotId`), para que un clic en el panel no cambie el coste.
    Deep Analysis no está disponible en Hobby y, de estarlo, se cobra por llamada. Protege **dos**
    POST: el alta y el reenvío del correo de activación (los dos hacen que salga correo hacia una
    dirección que teclea un desconocido). Un bot *verificado* (`isVerifiedBot`: un rastreador
    conocido) cuenta como automatismo: ninguno tiene nada que hacer creando cuentas.

17. **BotID es entero o no está**: en un despliegue de **Vercel** (Production **y** Preview) cliente
    y servidor están activos y el servidor hace la comprobación real; **fuera de Vercel** (local,
    CI, e2e) el cliente **no se inicializa** —no se carga ningún recurso de BotID— y el servidor
    responde *humano* por la vía de desarrollo de la propia librería (`isDevelopment: true`). La
    decisión *«¿estoy en Vercel?»* se toma una vez, en build, con la identidad de despliegue que
    ya calcula `next.config.mjs` (ADR-024 pto. 4), no con `NODE_ENV`. Los tests simulan bot a
    través de un **puerto** propio que envuelve `checkBotId`, no parcheando la librería.

18. **Si BotID falla (red, OIDC, servicio caído) el servidor deja pasar** (*fail-open*) y lo
    registra en el log. Bloquear altas humanas por la caída de un tercero sería peor que dejar
    pasar a un bot que aún tiene delante el campo trampa, el tiempo mínimo, la verificación del
    correo y el cupo.

19. **Las rutas de BotID salen del proxy antes de Auth.js**, como `robots.txt` (SPEC-065 D-5):
    sin redirección a `/login` y sin cookies `authjs.*`. **Ni el `matcher` ni `PUBLIC_PREFIXES`
    se tocan** (`F-SPEC-051-1`). El prefijo **se deriva de lo que la librería reescribe**
    (`withBotId(...).rewrites()`), no se copia: si la librería lo cambia al actualizarse, la
    excepción la sigue o una guardia se pone roja (ADR-040).

20. **Ninguna variable de entorno nueva.** BotID autentica con el token OIDC que Vercel inyecta; la
    firma del tiempo mínimo deriva de `AUTH_SECRET`. La lista cerrada de `.env.example` (SPEC-031
    CA-13.3) sigue en once.

## Consecuencias

### Positivas

- **El cupo deja de poder llenarse con correos que nadie controla**: sólo ocupa plaza quien abre
  un correo en su buzón. Una ráfaga de altas basura, aunque atraviese las tres capas, deja filas
  pendientes que desaparecen solas en menos de 48 h y **no cierra el registro**.
- **`tremen.dev` escribe como mucho 3 correos en 24 h a una dirección que nadie ha confirmado**,
  y sólo si el envío superó el campo trampa, el tiempo mínimo y BotID.
- **El alta deja de ser un oráculo de enumeración**, que era un agujero anterior a todo esto.
- **Cero coste recurrente**: Basic es gratis; el ciclo que purga ya existe; ninguna variable nueva.

### Negativas / follow-ups

- **Nueva dependencia de tercero en el camino de alta** (`botid`, MIT, de Vercel). Si el reto de
  BotID no carga en el navegador, la librería **espera** antes de enviar: el alta puede quedarse
  colgada en el cliente, y el *fail-open* del servidor no lo arregla. Se acepta: el reto se sirve
  desde el mismo Vercel que sirve la app. Se anota (`F-SPEC-066-7`).
- **El alta exige JavaScript** (BotID no protege envíos nativos). Antes funcionaba sin él por la
  mejora progresiva de las server actions; sin JS, en Vercel, el alta se trata como automatismo.
- **El alta ya no entra en la app en el acto**: un paso más (abrir el correo) en el primer minuto
  del tester que llega del foro. Es el precio del pto. 1 y se asume.
- **El texto de SPEC-001 CA-2 se retira** y sus tests se re-encuadran (pto. 6), autorizado aquí y
  en SPEC-066, no por quien implementa.
- **El e2e se alarga**: cada alta espera ≥ 2 s y pasa por el buzón de disco del e2e.
- Quedan fuera y anotados: límite de frecuencia por IP, alerta de altas anómalas / recuento de
  pendientes en `/admin`, BotID en `/forgot-password`, y el residual de pre-secuestro.

## Alternativas consideradas

- **Que las pendientes cuenten para el cupo.** Rechazada: es exactamente el ataque —un bot llena
  el cupo con cuentas que nunca activará—, sólo que con caducidad de 24 h. Cerraría el registro a
  humanos un día entero por ráfaga.
- **Permitir entrar sin verificar** (con un aviso). Rechazada: la cuenta sin verificar podría
  vigilar acciones y generar avisos… a un correo ajeno, que es el daño de reputación que esto
  viene a evitar. Y la cuenta pendiente dejaría de ser inocua.
- **Consumir el token con el GET del enlace.** Rechazada por ADR-015 pto. 6: los escáneres de
  correo lo quemarían —o, peor, activarían cuentas registradas por bots con correos ajenos cuyo
  proveedor pincha los enlaces—.
- **Un captcha visible** (Turnstile, hCaptcha). Rechazada por el humano en favor de BotID, que es
  invisible, de la misma plataforma y sin un tercero más en `/legal/privacidad`.
- **BotID Deep Analysis.** Rechazada: no existe en Hobby y se cobra por llamada; Basic más las
  otras dos capas cubre el caso (bots baratos llenando un formulario público).
- **Campo trampa con respuesta de error** (403 o *«envío no válido»*). Rechazada: le enseña al bot
  qué le delató y, con el pto. 6, rompería la indistinguibilidad que ya se paga para no enumerar.
- **Tiempo mínimo medido en el cliente.** Rechazada: el cliente es del atacante.
- **Un proceso nuevo para purgar** (otro cron). Rechazada: Hobby limita los cron, y el ciclo diario
  ya corre, ya está autorizado y ya deja constancia.
- **Default `NULL` en `email_verified_at`.** Rechazada por el pto. 2: durante la convivencia, las
  altas del código anterior nacerían pendientes, no podrían volver a entrar tras el despliegue y
  se purgarían a las 24 h.
- **Añadir una página pública nueva a `PUBLIC_PREFIXES`.** Rechazada: las páginas de activación y
  reenvío cuelgan de `/register/…`, que ya es público; la lista no crece y no arrastra la guardia
  de SPEC-051 que la congela.

<!-- REGLA: un ADR aceptado es INMUTABLE. Para cambiar la decisión, escribe otro ADR que lo supersede (estado del viejo -> bloqueada + nota "superseded por ADR-NNN"). -->
