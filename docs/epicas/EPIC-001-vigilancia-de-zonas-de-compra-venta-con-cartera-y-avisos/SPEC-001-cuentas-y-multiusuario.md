---
id: SPEC-001
tipo: spec
epica: EPIC-001
estado: en-progreso
aprobada-por: humano
historial:
  - {estado: borrador, fecha: 2026-07-13, por: sdd-arquitecto}
  - {estado: aprobada, fecha: 2026-07-13, por: humano}
  - {estado: en-progreso, fecha: 2026-07-13, por: sdd-implementador}
---
# SPEC-001 — Cuentas y multiusuario

## Problema
Stockeiro es multiusuario (CE-4): varias personas gestionan sus propias carteras,
acciones vigiladas y zonas. Antes de poder registrar nada de eso hace falta la
base sobre la que se apoya todo lo demás: identidad, sesión y **aislamiento
estricto de datos por usuario**. Sin esta base no puede construirse ninguna otra
spec de la épica, y una fuga entre usuarios destruiría la confianza (R-6). Reglas
de negocio en juego: **RN-01** (aislamiento), **RN-02** (email único), **RN-03**
(acceso autenticado).

## Usuarios / roles afectados
- **Usuario final** (inversor particular): se registra, inicia y cierra sesión, y
  a partir de aquí todos sus datos quedan ligados a su cuenta.
- (Sin rol administrador en esta spec; fuera de alcance.)

## Criterios de aceptación
Cada CA es verificable con un test (unitario/integración o e2e).

- **CA-1 (Registro con email único).**
  Dado un visitante no autenticado en la página de registro,
  cuando envía un email válido no usado y una contraseña que cumple la política,
  entonces se crea su cuenta, queda autenticado y se le redirige a su panel.
- **CA-2 (Email duplicado rechazado, RN-02).**
  Dado un email ya registrado,
  cuando alguien intenta registrarse con ese mismo email,
  entonces el registro se rechaza con un error claro y no se crea una segunda cuenta.
- **CA-3 (Login correcto).**
  Dado un usuario existente,
  cuando introduce sus credenciales válidas,
  entonces obtiene una sesión autenticada y accede a su panel.
- **CA-4 (Login incorrecto).**
  Dado un usuario existente,
  cuando introduce credenciales inválidas,
  entonces se le deniega el acceso con un error genérico (sin revelar si el email
  existe) y no se crea sesión.
- **CA-5 (Rutas protegidas, RN-03).**
  Dado un visitante sin sesión,
  cuando solicita cualquier ruta de datos o de aplicación (no pública),
  entonces es redirigido a login y no se le sirve ningún dato.
- **CA-6 (Aislamiento de datos, RN-01).**
  Dado el usuario A con al menos un recurso propio y un usuario B autenticado,
  cuando B lista o solicita por id un recurso de A,
  entonces B no ve ni puede leer/modificar ningún dato de A (la consulta filtra por
  el `userId` de la sesión; el acceso directo por id ajeno responde no encontrado /
  no autorizado).
- **CA-7 (Cierre de sesión).**
  Dado un usuario autenticado,
  cuando cierra sesión,
  entonces su sesión se invalida y las rutas protegidas vuelven a exigir login.
- **CA-8 (Persistencia de identidad).**
  Dado un usuario registrado,
  cuando la aplicación se reinicia / la sesión se restablece,
  entonces sigue existiendo y puede volver a iniciar sesión con las mismas
  credenciales (los datos persisten en Postgres, no en memoria).

## Entidades y reglas afectadas
- **Entidad `user`**: identidad mínima (id, email único, credencial/hash,
  metadatos de creación). Es el ancla de propiedad: toda entidad de dominio futura
  (posición, acción vigilada, zona, aviso) llevará `userId` → `user`.
- Reglas: **RN-01**, **RN-02**, **RN-03** (`docs/fundacion/reglas.md`).
- Decisiones: **ADR-001** (Auth.js sobre Neon Postgres; aislamiento en capa de
  aplicación filtrando por `userId`). El patrón de propiedad que aquí se establece
  es el que consumirán las specs de Cartera, Zonas y Avisos.

## Fuera de alcance
Aparcado a propósito, no por descuido:
- Recuperación de contraseña, verificación de email y 2FA.
- Login social / OAuth de terceros (Google, etc.).
- Roles y permisos (admin, compartir cartera entre usuarios).
- Perfil de usuario editable, preferencias, borrado de cuenta (GDPR) — se tratará
  en spec propia.
- Row Level Security a nivel de base de datos (ADR-001 lo deja como refuerzo futuro).
- Cualquier dato de dominio (posiciones, acciones, zonas): son sus propias specs;
  aquí solo se establece el ancla `userId` y el patrón de aislamiento.

## Notas para el gate humano
Resoluciones del gate (aprobado 2026-07-13 por el humano):
- **Política de contraseña → DELEGADA en Auth.js.** No definimos política propia;
  se usa la del proveedor de autenticación (Auth.js/NextAuth). "Contraseña que
  cumple la política" en CA-1 = la que acepte Auth.js. Si en el futuro se quiere
  una política más estricta, será cambio explícito.
- **Aislamiento en capa de app, no RLS** (ADR-001): ACEPTADO para arrancar; CA-6
  lo blinda con test; RLS queda como refuerzo posterior.
- **Sin recuperación de contraseña** en esta spec: ACEPTADO para el arranque
  (flujo de reset será spec propia, fuera de alcance aquí).
- **Errores de login genéricos** (CA-4): ACEPTADO; la seguridad (no revelar si el
  email existe) prima sobre la comodidad de UX.
