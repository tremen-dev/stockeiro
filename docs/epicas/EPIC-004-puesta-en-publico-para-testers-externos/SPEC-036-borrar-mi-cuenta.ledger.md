---
id: SPEC-036
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-036 Borrar mi cuenta

## Resumen
- Fase: en-revisión (implementación terminada, 2026-08-19) <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-036-borrar-mi-cuenta` (apilada sobre `ft/SPEC-035-paginas-legales-titular-y-descargo`)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/app/cuenta/page.tsx` (pantalla, `requireUser()`); `src/app/app-nav.tsx` (enlace `Cuenta` en `.app-nav-user`, **sin pasar por `canSee`**: no es una sección del catálogo); `src/lib/account/routes.ts` (`CUENTA_PATH`); `src/app/globals.css` (`.app-nav-user`) | `tests/cuenta-rutas.test.ts` › *CA-1: /cuenta exige sesión (RN-03)* (3) + `tests/e2e/cuenta.spec.ts` › *CA-1: /cuenta exige sesión y se alcanza desde la navegación* (5: sin sesión → `/login`; **un tester / un completo / un admin** la ven y llegan **pinchando el enlace**, no tecleando; y el enlace está en `/dashboard`, `/vigiladas`, `/avisos` y `/cuenta`) | | ❌ |
| CA-2 | `src/app/cuenta/page.tsx` (`data-testid="zona-de-borrado"`, `que-se-borra`, `que-no-se-borra`); `src/lib/account/deletion.ts` (`label` de cada tabla y `SHARED_LABELS`) — **las dos listas no están escritas en la página**: salen de la misma estructura que ejecuta el borrado, así que no pueden envejecer por separado | `tests/e2e/cuenta.spec.ts` › *CA-2: se dice qué desaparece antes de pulsar* (2: las cinco familias que se borran + lo compartido con su porqué + «irreversible» y «no hay copia»; y **el aviso está por encima del botón**, medido con `getBoundingClientRect`) + `tests/account-deletion-coverage.test.ts` › *las siete tablas que CA-4 nombra están, cada una con su mecanismo* (ata que toda tabla cubierta tenga etiqueta legible) | | ❌ |
| CA-3 | `src/lib/account/deletion.ts` (`deleteMyAccount` → **`verifyCredentials`**, sin segundo mecanismo); `src/app/cuenta/actions.ts`; `src/app/cuenta/delete-account-form.tsx`; `src/lib/account/messages.ts` (`PASSWORD_INCORRECTA`) | `tests/account-deletion.test.ts` › *CA-3: sin la contraseña actual no se borra ni una fila* (4: censo intacto tabla por tabla, contraseña vacía, la credencial sigue sirviendo, usuario inexistente) + `tests/e2e/cuenta.spec.ts` › *CA-3* (2: error visible, sigue en `/cuenta`, **la sesión sigue viva** —navega a `/vigiladas` sin rebotar— y la cuenta sigue en la base; y con la contraseña buena sí se va) | | ❌ |
| CA-4 | `src/lib/account/deletion.ts` (`purgeUserData`, `DELETION_ORDER` = el orden de ADR-022 pto. 4; `zone_triggers` cae por cascade y **no** tiene sentencia propia) | `tests/account-deletion.test.ts` › *CA-4* (4: **la siembra deja filas en las siete tablas** —sin eso el test siguiente no probaría nada—; censo cero tabla por tabla; los episodios caen con su vigilada; y **ninguna tabla del esquema con `user_id` conserva filas de un usuario que ya no existe**) | | ❌ |
| CA-5 | `src/lib/account/deletion.ts` (`ACCOUNT_DELETION_COVERAGE`: la cobertura se declara **una vez** y de ahí salen el orden del borrado, la lista de CA-2 y esta comprobación) | `tests/account-deletion-coverage.test.ts` (12 casos): el conjunto de tablas del esquema con `user_id` (más `users`) es **exactamente** el conjunto cubierto, en los dos sentidos; el orden explícito es el de ADR-022; `zone_triggers` está declarada `cascade` desde `watched_symbols` y **no** en el orden explícito; y ninguna tabla compartida entra en la cobertura | | ❌ |
| CA-6 | `src/lib/account/deletion.ts` (`SHARED_TABLES` no se toca; el borrado filtra siempre por `userId`) | `tests/account-deletion.test.ts` › *CA-6: irse no daña a nadie más* (4: `symbols`/`quotes`/`quote_diagnostics` con **mismo recuento y mismos valores** —comparación de las filas enteras—; el otro usuario conserva censo y zonas y sigue viendo el precio; el símbolo sin dueño queda **inerte, no borrado**; y las compartidas no tienen columna `user_id`) + *el borrado no toca las operaciones de otro usuario* (1) + `tests/account-deletion-coverage.test.ts` › *CA-6: lo compartido no entra en el borrado, por construcción* (3) | | ❌ |
| CA-7 | `src/lib/account/deletion.ts` (`purgeUserData`: una sola transacción, elegida **por capacidad del driver** — `batch()` en neon-http, `transaction()` en postgres-js y PGlite); `src/app/cuenta/actions.ts` (el fallo se traduce a «no se ha borrado nada, vuelve a intentarlo» y se registra en el servidor) | `tests/account-deletion.test.ts` › *CA-7: si una sentencia intermedia falla, la base queda como estaba* (3: una referencia externa tumba el `DELETE FROM users` y el censo queda **entero**; **la carrera de F-SPEC-036-1 simulada de verdad** —una regla que inserta un aviso entre el borrado de `notifications` y el de `users`— cae entera; y el reintento posterior funciona) | | ❌ |
| CA-8 | Sin código propio: es la consecuencia directa de que desaparezca la fila y con ella el índice único (ADR-022 pto. 5). Se apoya en `registerUser` (`src/lib/auth/users.ts`) | `tests/account-deletion.test.ts` › *CA-8: el email vuelve a estar libre (RN-02)* (4: el alta funciona y es **otra** cuenta; censo cero en todas sus tablas; **nace `tester`** aunque la anterior fuera `completo`; y la credencial vieja ya no sirve) + `tests/e2e/cuenta.spec.ts` › *y desde ella se puede volver a registrarse con el mismo email* | | ❌ |
| CA-9 | **Sin código nuevo** — propiedad heredada de ADR-016: sin fila en `users`, `readSessionRow` devuelve `null`, `isSessionEpochCurrent(claim, undefined)` es `false` y `resolveSessionWithEpoch` resuelve la sesión **anónima**. Lo único que aporta esta spec es el `signOut` de la sesión desde la que se borra (`src/app/cuenta/actions.ts`) | `tests/e2e/cuenta.spec.ts` › *CA-9: la otra sesión, en otro navegador, deja de autenticar en su siguiente petición* — **dos `BrowserContext` distintos**; se comprueba que las dos autentican ANTES, y después la segunda acaba en `/login` en `/avisos`, `/dashboard`, `/vigiladas` y `/cuenta`, sin que su cuerpo contenga el email | | ❌ |
| CA-10 | `src/app/cuenta-borrada/page.tsx` (pública, **sin imports de `src/db` ni de sesión**); `src/lib/auth/guard.ts` (`PUBLIC_PREFIXES` += `/cuenta-borrada`); `src/app/cuenta/actions.ts` (`signOut({ redirectTo })`) | `tests/cuenta-rutas.test.ts` › *CA-10* (6: pública, declarada en `PUBLIC_PREFIXES`, `/cuenta-borradaX` **no** lo es, `/cuenta` sigue exigiendo sesión, y el matcher del proxy **no cambia**) + `tests/e2e/cuenta.spec.ts` › *CA-10* (3: se pinta entera, sin `nav`, sin texto de error de Next y **sin cookie de sesión con valor**; se lee tecleando la URL sin sesión; y desde ella se vuelve a registrar) | | ❌ |
| CA-11 | `src/lib/account/deletion.ts` (`canDeleteAccount`, y `deleteMyAccount` **relee el rol de la base** — la firma no admite rol de entrada); `src/app/cuenta/page.tsx` (sin formulario para `admin`); `src/lib/account/messages.ts` (`ADMIN_NO_SE_BORRA`: por qué y cómo proceder) | `tests/account-deletion.test.ts` › *CA-11* (3: la decisión es pura; con la contraseña **correcta** se rechaza igual y el censo queda intacto; el rechazo lo decide la base) + `tests/e2e/cuenta.spec.ts` › *CA-11* (2: no hay botón ni campo, y la explicación dice «operador» y «degradar»; **y la acción se rechaza invocándola de verdad** — se abre `/cuenta` siendo `tester`, se promueve a `admin` por debajo y se envía el formulario que ya está en el DOM) | | ❌ |
| CA-12 | `src/lib/account/deletion.ts` (`canDeleteAccount`: la regla **ancha** de ADR-022 pto. 8, que no cuenta administradores) | `tests/account-deletion.test.ts` › *CA-12: la regla no tiene casos frontera* (4: con **uno**, con **dos uno tras otro**, con **dos a la vez** (`Promise.all`) y con censos de 1, 2 y 3 administradores — en los cuatro escenarios ninguno se borra y el censo de `admin` no baja) | | ❌ |
| CA-13 | `src/lib/account/deletion.ts` (la restricción es sobre el **rol**, y el rol se lee en cada petición: ADR-021 pto. 4) | `tests/account-deletion.test.ts` › *CA-13: degradarse primero SÍ permite irse* (3: `admin`→`tester` y `admin`→`completo` se borran con censo cero; y el email vuelve a estar libre) + `tests/e2e/cuenta.spec.ts` › *CA-13* (sin botón como `admin`, con botón tras el `UPDATE` **sin volver a iniciar sesión**, y el borrado completo) | | ❌ |
| CA-14 | `src/app/legal/privacidad/page.tsx` (`conEnlaceACuenta`: parte el párrafo de `DERECHOS` por la ruta y le pone un `Link`, **sin reescribir el texto que SPEC-035 dejó veraz**); `src/lib/account/routes.ts` (la ruta viene de ahí, no de un literal, y ese módulo no importa nada — la página legal sigue sin poder tocar la base) | `tests/e2e/cuenta.spec.ts` › *CA-14: el derecho de supresión, ahora clicable* (3: el enlace existe y es visible dentro de `[data-testid="derechos"]`; **lleva a la pantalla** con sesión; y sin sesión lleva a `/login`, que es RN-03 y no un 404) + `tests/e2e/legal.spec.ts` › *el enlace a /cuenta no está roto* (**guardia de SPEC-035 re-encuadrada**, ver F-SPEC-036-6) | | ❌ |
| CA-15 | No se ha cambiado ningún comportamiento existente: `src/lib/auth/guard.ts` solo **añade** un prefijo, `src/app/app-nav.tsx` solo **añade** un enlace fuera del grupo de secciones, y `src/app/globals.css` solo añade reglas nuevas. No se ha tocado `src/proxy.ts`, ni `src/app/app-footer.tsx`, ni `package.json`, ni `next.config.mjs`, ni ninguna migración | Suite completa (ver «Gates»): `npm test` **950/950** (67 ficheros) · `npm run test:e2e` **124/124** · `typecheck` · `lint` · `build` · `db:scan`. En particular siguen verdes `tests/ownership.test.ts` (SPEC-001 CA-6), `tests/session-epoch.test.ts` y `tests/password-reset.test.ts` (SPEC-023 CA-13), `tests/e2e/vigiladas.spec.ts` y `tests/triggers-*.test.ts` (SPEC-024/ADR-017: dejar de vigilar sigue conservando los avisos), `tests/legal-*.test.ts` y `tests/e2e/pie-*.spec.ts` (SPEC-035). **Y la geometría**: `tests/e2e/cuenta-responsive.spec.ts` (3 casos × 5 anchos) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-036/. Informe HTML opcional: _qa/SPEC-036/informe.html -->

| CA | Evidencia |
|---|---|
| CA-1 | `_qa/SPEC-036/ca1-cuenta-tester.png`, `ca1-cuenta-completo.png`, `ca1-cuenta-admin.png` |
| CA-2 | `_qa/SPEC-036/ca2-que-desaparece.png` |
| CA-3 | `_qa/SPEC-036/ca3-password-incorrecta.png` |
| CA-9 | `_qa/SPEC-036/ca9-segunda-sesion-en-login.png` |
| CA-10 | `_qa/SPEC-036/ca10-cuenta-borrada.png` |
| CA-11 | `_qa/SPEC-036/ca11-admin-sin-boton.png`, `ca11-accion-rechazada.png` |
| CA-13 | `_qa/SPEC-036/ca13-degradado-ya-puede.png` |
| CA-14 | `_qa/SPEC-036/ca14-desde-privacidad.png` |
| CA-15 | `_qa/SPEC-036/medidas-cuenta.txt`, `medidas-nav-dashboard.txt`, `medidas-nav-cuenta.txt`, `medidas-cuenta-borrada.txt` — **las medidas en píxeles**, no una captura: es lo que faltó en SPEC-035 |

**Las medidas, sin tener que abrir el fichero** (390 · 640 · 700 · 760 · 1280 px):

- `/cuenta`: **ningún desbordamiento horizontal** a ningún ancho (`documento == ventana`
  en los cinco) y **ningún elemento de `main` fuera del viewport**.
- Zona de borrado: **665 px** de caja en escritorio y **1197 px** a 390 px — crece porque
  el texto pasa a más líneas y las dos listas se apilan, que es lo legítimo. Lo que
  importa es el **hueco muerto: 2 px** a los cinco anchos (caja 665/852/783/813/1197
  frente a contenido 663/850/781/811/1195). Es exactamente la medida que en SPEC-035
  valía 320 px de caja para 39 px de texto.
- Navegación (`AppNav`, que es de toda la app): **64 px** en escritorio y **102 px** a
  390 px, donde envuelve a dos filas. Factor **1,6×**, con el tope del test en 3×.
- `/cuenta-borrada`: sin desbordamiento a ningún ancho.

## Salvedades / follow-ups
<!-- IDs F-SPEC-036-1, F-SPEC-036-2… con destino (spec futura o EPIC-MEJORA). -->

Los cuatro que ya traía la spec, con lo que ha pasado con cada uno:

- **F-SPEC-036-1 (residual asumido, de la spec).** La carrera con el ciclo diario **no se
  ha serializado**, tal y como decide la spec. Lo que sí se ha hecho es **probarla**:
  `tests/account-deletion.test.ts` › *la carrera con el ciclo diario falla entera, no a
  medias* monta una regla de Postgres que inserta un aviso justo entre el borrado de
  `notifications` y el de `users`, y comprueba que la transacción cae **entera** y que el
  censo queda idéntico. La acción traduce ese fallo a «no se ha borrado nada, vuelve a
  intentarlo» (`REINTENTA`) y lo registra con `console.error`: la ventana es de
  milisegundos y como no se registre no se investiga nunca.
- **F-SPEC-036-2 (residual asumido, F-ADR-022-1).** Los correos ya entregados no vuelven.
  Se dice **en la propia pantalla**, antes de pulsar (`data-testid="residual-correo"`),
  además de en `/legal/privacidad`, que ya lo decía desde SPEC-035.
- **F-SPEC-036-3 (DESPLIEGUE).** Confirmado: **cero migraciones nuevas** (`drizzle/` no
  cambia, `npm run db:scan` sigue viendo 10 migraciones y las mismas 2 desbloqueadas) y
  **cero variables de entorno nuevas**. No activa F-SPEC-023-1.
- **F-SPEC-036-4 (higiene).** Sin cambios: los `symbols` sin referencias se quedan, y hay
  un test que lo fija como comportamiento querido y no como descuido
  (*el símbolo que se queda sin nadie NO se borra: queda inerte*).

Y los que abre esta implementación:

- **F-SPEC-036-5 (documento de verdad, para el arquitecto).** La spec dice, en «Entidades
  y reglas afectadas», que *«se añade a `docs/fundacion/dominio.md` el término **Borrado
  de cuenta**»*. **No lo he añadido**: `docs/fundacion/` es documento de verdad y mi rol lo
  tiene prohibido, y además ningún CA lo cubre. Queda pendiente para quien tenga la pluma
  (precedente: en SPEC-035 esa fila la puso la implementación, así que si la convención
  del proyecto es esa, es un cambio de una línea).
- **F-SPEC-036-6 (guardia re-encuadrada, no aflojada).** `tests/e2e/legal.spec.ts` tenía
  el caso *«esta spec NO crea el enlace a /cuenta: eso es SPEC-036»*, que exigía
  `toHaveCount(0)` de `main a[href="/cuenta"]` en `/legal/privacidad`. **Vigilaba** que
  una página legal no tuviera un enlace roto a una pantalla inexistente. **Ahora vigila**
  lo mismo por el otro lado: que el enlace **esté** (`toHaveCount(1)`) y que la ruta a la
  que apunta responda **200** y no un 404 — sin sesión, RN-03 la lleva a `/login`, que es
  una pantalla y no un error. La propiedad («ningún enlace roto en una página legal») se
  conserva entera; lo que cambia es cuál de los dos estados del mundo es el correcto.
- **F-SPEC-036-7 (residual técnico, declarado).** `purgeUserData` elige el primitivo
  atómico **por capacidad del driver**: `batch()` si existe (neon-http, que es
  **producción**) y `transaction()` si no (PGlite en los tests unitarios, postgres-js en
  el e2e). Los dos dan la misma garantía —el `batch()` de neon-http manda todas las
  sentencias en una petición envuelta en `BEGIN`/`COMMIT`; su `transaction()` interactivo
  lanza a propósito porque cada consulta es un HTTP distinto—, pero **el camino que corre
  en producción no está ejercitado por ningún test**, porque ni PGlite ni postgres-js
  exponen `batch()` y levantar un Neon en CI no entra en esta spec. Mitigación: la
  elección es por capacidad y no por `DB_DRIVER`, así que una variable mal puesta no puede
  degradarlo a seis sentencias sueltas. **Conviene ejercitarlo a mano en el primer
  despliegue** (borrar una cuenta de prueba en el entorno real y comprobar el censo).
- **F-SPEC-036-8 (aseo, EPIC-MEJORA).** `/cuenta` es hoy **solo** la salida. El cambio de
  contraseña desde sesión (EPIC-003) y el de email no tienen sitio, y esta pantalla es el
  sitio natural cuando lo tengan. No entra aquí: la spec lo pone explícitamente fuera de
  alcance.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

- **Estado:** los 15 CA implementados con test. Spec en `en-revisión`; el `hecho` es del
  verificador.
- **Rama:** `ft/SPEC-036-borrar-mi-cuenta`, apilada sobre
  `ft/SPEC-035-paginas-legales-titular-y-descargo`. **Se mergean juntas** (F-SPEC-035-7):
  hasta que esta entre, `/legal/privacidad` promete un derecho que la app no sabe ejercer.
- **Por dónde empezar a leer:** `src/lib/account/deletion.ts`. Ahí está todo lo que
  decide —qué cae, en qué orden, quién puede irse y cómo se hace atómico— y las tres cosas
  que salen de la misma estructura (el borrado, la lista de la pantalla y la comprobación
  contra el esquema). La pantalla y la acción son envoltorio.
- **Ficheros nuevos:** `src/lib/account/deletion.ts`, `src/lib/account/routes.ts`,
  `src/lib/account/messages.ts`, `src/lib/account/profile.ts`, `src/app/cuenta/page.tsx`,
  `src/app/cuenta/actions.ts`, `src/app/cuenta/delete-account-form.tsx`,
  `src/app/cuenta-borrada/page.tsx`, `tests/account-deletion.test.ts`,
  `tests/account-deletion-coverage.test.ts`, `tests/cuenta-rutas.test.ts`,
  `tests/e2e/cuenta.spec.ts`, `tests/e2e/cuenta-responsive.spec.ts`.
- **Ficheros tocados:** `src/lib/auth/guard.ts` (un prefijo público más),
  `src/app/app-nav.tsx` (el enlace a `/cuenta`), `src/app/globals.css` (bloque nuevo al
  final), `src/app/legal/privacidad/page.tsx` (el enlace de CA-14),
  `tests/e2e/legal.spec.ts` (la guardia re-encuadrada, F-SPEC-036-6).
- **Lo que NO se ha tocado, a propósito:** `src/proxy.ts` (matcher intacto, y hay test que
  lo mira), `src/app/app-footer.tsx` (es de SPEC-035 y lo amplían SPEC-038 y SPEC-039),
  `package.json` y `next.config.mjs` (el semver es de SPEC-038), `src/db/schema.ts` y
  `drizzle/` (esta spec **no migra**), y `docs/fundacion/dominio.md` (F-SPEC-036-5).
- **Cuidado con los emails del e2e:** la base del e2e es **una sola y compartida entre
  todas las specs**. Los correos de `tests/e2e/cuenta.spec.ts` llevan prefijo `spec036-`
  porque `ca3@example.com` ya lo registraba `tests/e2e/auth.spec.ts`, y la colisión solo
  aparece al correr la suite **entera** (por separado el fichero pasaba). Si añades casos,
  namespacia el correo.
- **Cuidado al commitear:** la suite e2e **reescribe los PNG de `_qa/` de otras specs**.
  En esta rama se restauraron con `git checkout -- _qa/` antes de commitear; lo único de
  `_qa/` que entra es `_qa/SPEC-036/`.
- **Dónde mirar primero si algo falla:** si el borrado no es atómico en producción, es
  F-SPEC-036-7 (el camino `batch()` de neon-http). Si la pantalla se descuadra, las
  medidas de referencia están en `_qa/SPEC-036/medidas-*.txt` y el test que las produce es
  `tests/e2e/cuenta-responsive.spec.ts`.
