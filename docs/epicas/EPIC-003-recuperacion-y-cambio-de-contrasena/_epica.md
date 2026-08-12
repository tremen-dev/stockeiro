---
id: EPIC-003
tipo: epica
estado: aprobada
historial:
  - {estado: borrador, fecha: 2026-08-11, por: sdd-producto}
  - {estado: aprobada, fecha: 2026-08-11, por: humano (Alberto Fojo)}
aprobada-por: humano (Alberto Fojo)
---
# EPIC-003 — Recuperación y cambio de contraseña

## Objetivo
Que un usuario **no pierda para siempre el acceso a su cuenta**, y que pueda
**rotar su contraseña por sí mismo**.

Hoy el `password_hash` de `users` es la **única** credencial que existe: no hay
reset, no hay rol administrador, no hay canal de contacto. Un usuario que olvida
su contraseña queda fuera **de forma definitiva**; la única salida es tocar el
hash a mano en la base de datos de producción — algo que no escala, que exige
acceso a datos personales de terceros y que ningún usuario puede pedir sin un
canal por el que pedirlo.

Esta épica no abre alcance nuevo: **le da domicilio a un compromiso que el
proyecto ya adquirió**. SPEC-001 aparcó el reset en "Fuera de alcance" y su gate
humano del 2026-07-13 lo resolvió literalmente como *"flujo de reset será spec
propia, fuera de alcance aquí"*. Esa spec propia nunca se creó. EPIC-001 está
`hecho` (terminal) y no admite specs nuevas; EPIC-FIX es solo para capacidad
entregada que se rompió; EPIC-MEJORA excluye por escrito la funcionalidad que
**cambia lo que el usuario puede hacer**. Sin esta épica, el compromiso se queda
sin lugar donde vivir.

**Por qué ahora.** La app está desplegada desde el 2026-07-14 y va a compartirse
con **testers externos** en un foro de bolsa. El titular puede rescatarse a sí
mismo tocando Neon; un tester, no —y no debería: recuperar la cuenta de otra
persona a mano significa manipular su credencial. Un tester que pierde la
contraseña se pierde como usuario, y lo hace en el primer minuto de su relación
con el producto.

**Por qué también el cambio desde sesión.** Es el mismo motor —establecer una
contraseña nueva— por otra puerta, y cubre el hueco simétrico: hoy un usuario que
*recuerda* su contraseña pero sospecha que está comprometida tampoco tiene forma
de cambiarla. Recuperar sin poder rotar deja la mitad del problema en pie.

## Criterios de éxito
Medibles. La épica cumple su promesa cuando:

- **CE-1 (Nadie queda fuera para siempre).** Un usuario que ha olvidado su
  contraseña **recupera el acceso solo**, desde la propia app, sin intervención
  humana sobre la base de datos. Objetivo: **0 recuperaciones que exijan acción
  manual** del operador.
- **CE-2 (Recuperar no revela quién existe).** La respuesta a "he olvidado mi
  contraseña" es **idéntica** —en mensaje y en comportamiento observable— exista o
  no ese email registrado. No se puede usar el formulario de recuperación para
  averiguar el padrón de usuarios. Preserva la decisión de seguridad de **CA-4 de
  SPEC-001**, que ya eligió esta incomodidad de UX a propósito.
- **CE-3 (El enlace caduca y sirve una sola vez).** Un enlace de recuperación
  **expira** y **no se puede reutilizar**: un enlace viejo, ya usado o interceptado
  después de su ventana **no da acceso**. Objetivo: 0 accesos concedidos por un
  enlace consumido o caducado.
- **CE-4 (Rotar la contraseña es autoservicio).** Un usuario con sesión activa
  cambia su contraseña **demostrando que conoce la actual**, sin pasar por el
  correo y sin ayuda del operador.
- **CE-5 (No degrada lo entregado).** Ninguna spec de esta épica altera el
  aislamiento por usuario (**RN-01**), la unicidad de email (**RN-02**), la
  exigencia de sesión en rutas de datos (**RN-03**) ni la exactitud del P/L. Las
  rutas nuevas son **públicas por diseño** y esa excepción se declara y se prueba,
  no se hereda por descuido.

## Alcance
- **Dentro:**
  - **Solicitud de recuperación** desde la pantalla de login ("he olvidado mi
    contraseña"), con **respuesta genérica** (CE-2).
  - **Entrega por email** al titular de la cuenta de un **enlace de un solo uso y
    con caducidad**, sobre el canal transaccional ya existente
    (`NotificationSender` / `ResendSender`, ADR-006).
  - **Página pública para establecer contraseña nueva** a partir de ese enlace, y
    su incorporación explícita a las rutas públicas del guard de acceso.
  - **Caducidad y consumo único** del enlace (CE-3), incluida su invalidación al
    usarse y el comportamiento ante un enlace ya gastado.
  - **Cambio de contraseña desde sesión** (CE-4), exigiendo la contraseña actual.
  - **Límite mínimo de solicitudes** de recuperación por cuenta/ventana, para que
    el formulario no sea un cañón de correo contra un tercero.
  - **Prerrequisito de despliegue asumido**: aprovisionar Resend con **dominio
    verificado** (cierra **F-SPEC-006-1**, que pasa de *"pendiente por diseño"* a
    **bloqueante de esta épica**). Efecto colateral bienvenido: desbloquea también
    los avisos por email de SPEC-006, hoy limitados a in-app (**RN-15**).
- **Fuera (aparcado a propósito, no por descuido):**
  - **Verificación de email en el registro.** Sigue aparcada desde SPEC-001. Su
    ausencia tiene una consecuencia que hay que decir en voz alta: **quien se
    registra con un email equivocado o ajeno no podrá recuperar la cuenta**, y el
    enlace irá a parar a un tercero (ver R-1). Es la siguiente pieza natural, pero
    no entra aquí: haría de esta épica otra cosa.
  - **Segundo factor (2FA)** y **login social / OAuth**: siguen fuera, como en
    SPEC-001.
  - **Roles y permisos**, incluido un **administrador que recupere cuentas ajenas**.
    El autoservicio (CE-1) existe precisamente para no necesitarlo.
  - **Perfil editable, preferencias y borrado de cuenta (GDPR).** SPEC-001 los dejó
    "para spec propia" y siguen sin épica; esta no los adopta. Cambiar la contraseña
    **no** es abrir la gestión de perfil.
  - **Política de contraseña propia.** Sigue **delegada en Auth.js** por resolución
    del gate de SPEC-001; esta épica **no reabre** esa decisión. Si algún día se
    quiere una política estricta, será cambio explícito y con su ADR.
  - **Recuperación por otros canales** (SMS, preguntas de seguridad, códigos de
    respaldo): el email es el único canal de v1.
  - **Anti-abuso avanzado** (captcha, WAF, reputación de IP): dentro solo el límite
    mínimo citado arriba; lo demás es infraestructura, no producto.

## Specs
<!-- El estado por spec vive en el frontmatter de cada spec; el tablero agregado se regenera con /sdd-tablero (docs/tablero.md). No mantengas listas de specs a mano aquí. -->

## Riesgos
- **R-1 (El email es el único factor).** Quien controla el buzón controla la
  cuenta. Y como el registro **no verifica el email** (fuera de alcance), un error
  de tecleo en el alta produce las dos caras del daño: la cuenta queda
  irrecuperable *y* el enlace de recuperación acaba en el buzón de un desconocido.
  Mitigación de producto: caducidad corta y un solo uso (CE-3); la verificación de
  email queda **nombrada** como la siguiente pieza, no olvidada.
- **R-2 (Enumeración de usuarios).** Si el mensaje, el tiempo de respuesta o
  cualquier comportamiento observable difieren entre un email registrado y uno que
  no lo está, el formulario se convierte en un padrón consultable. SPEC-001 ya pagó
  este precio en comodidad (CA-4) y **esta épica no puede desandarlo** (CE-2). Ojo
  a la ruta silenciosa: `verifyCredentials` ya iguala tiempos con un hash señuelo
  precisamente por esto.
- **R-3 (El token es filtrable por naturaleza).** Viaja por correo y se queda
  guardado en el buzón, en el historial del navegador y —si viaja en la URL— en
  cabeceras `Referer` y en logs. Debe caducar, gastarse al primer uso y no quedar
  almacenado en claro. El mecanismo concreto es **decisión técnica (ADR de
  sdd-arquitecto)**, no de producto.
- **R-4 (Sesiones vivas después del reset).** La sesión es **JWT sin estado**
  (ADR-001): no hay revocación desde el servidor. Si alguien recupera su
  contraseña *porque sospecha que le han entrado*, las sesiones del atacante
  podrían **sobrevivir al cambio**, que es justo lo contrario de lo que el usuario
  cree estar consiguiendo. **Debe cerrarse en spec**: o se invalidan las sesiones
  previas, o se declara explícitamente que no se invalidan y por qué.
- **R-5 (Sin fallback si el email no llega).** Los avisos tienen red: si el correo
  falla, el aviso sobrevive in-app (**RN-15**). Aquí **no hay red posible** —el
  email *es* el canal de recuperación—. Un dominio mal verificado, un rebote o una
  carpeta de spam dejan al usuario exactamente igual de fuera que hoy. Por eso el
  dominio verificado es prerrequisito y no adorno.
- **R-6 (Preview comparte la base de datos de producción).** `DATABASE_URL` está
  definida con un valor único para *Production* y *Preview*, y el build migra en
  **todos** los entornos: **una PR con cambio de esquema migraría producción**.
  Esta épica añade almacenamiento para los tokens, así que **toca de lleno**.
  Registrado en el runbook (§6) y en el roadmap; no lo resuelve esta épica, pero
  condiciona cómo se despliega su primera spec.

## Desglose orientativo en specs (propuesta, NO autoritativa)
> El desglose real y su secuencia son competencia de **sdd-arquitecto**. Esto es
> solo una hipótesis de trabajo para dimensionar la épica.

| # | Spec candidata | Idea |
|---|---|---|
| 1 | Recuperación de contraseña por email | Solicitud con respuesta genérica → token con caducidad y un solo uso → email con enlace → página pública de contraseña nueva. Cubre CE-1, CE-2, CE-3 y cierra R-4. |
| 2 | Cambio de contraseña desde sesión | Pantalla de cuenta mínima; exige la contraseña actual y reutiliza el motor de "establecer contraseña nueva". Cubre CE-4. |
