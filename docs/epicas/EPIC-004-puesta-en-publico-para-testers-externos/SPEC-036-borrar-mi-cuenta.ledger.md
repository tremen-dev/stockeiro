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
| CA-1 | `src/app/cuenta/page.tsx` (pantalla, `requireUser()`); `src/app/app-nav.tsx` (enlace `Cuenta` en `.app-nav-user`, **sin pasar por `canSee`**: no es una sección del catálogo); `src/lib/account/routes.ts` (`CUENTA_PATH`); `src/app/globals.css` (`.app-nav-user`) | `tests/cuenta-rutas.test.ts` › *CA-1: /cuenta exige sesión (RN-03)* (3) + `tests/e2e/cuenta.spec.ts` › *CA-1: /cuenta exige sesión y se alcanza desde la navegación* (5: sin sesión → `/login`; **un tester / un completo / un admin** la ven y llegan **pinchando el enlace**, no tecleando; y el enlace está en `/dashboard`, `/vigiladas`, `/avisos` y `/cuenta`) | Playwright propio contra la app corriendo: anónimo a `/cuenta` acaba en `/login` (200, y el cuerpo no filtra nada de la pantalla); con `tester`, `completo` y `admin` se ve, y se llega **pinchando** el enlace `a[href="/cuenta"]`, presente y visible en `/dashboard`, `/vigiladas`, `/avisos`, `/cartera` y `/cuenta` | ✅ |
| CA-2 | `src/app/cuenta/page.tsx` (`data-testid="zona-de-borrado"`, `que-se-borra`, `que-no-se-borra`); `src/lib/account/deletion.ts` (`label` de cada tabla y `SHARED_LABELS`) — **las dos listas no están escritas en la página**: salen de la misma estructura que ejecuta el borrado, así que no pueden envejecer por separado | `tests/e2e/cuenta.spec.ts` › *CA-2: se dice qué desaparece antes de pulsar* (2: las cinco familias que se borran + lo compartido con su porqué + «irreversible» y «no hay copia»; y **el aviso está por encima del botón**, medido con `getBoundingClientRect`) + `tests/account-deletion-coverage.test.ts` › *las siete tablas que CA-4 nombra están, cada una con su mecanismo* (ata que toda tabla cubierta tenga etiqueta legible) | Leído el texto **literal** de `[data-testid="zona-de-borrado"]` en el navegador: enumera las 7 familias que caen y las 3 compartidas con su porqué, dice «irreversible» y «no hay copia», y la lista termina en y=751 px con el botón en y=937 px (está **por encima**). Contrastado contra el censo real del borrado (CA-4): la lista y lo que cae coinciden | ✅ |
| CA-3 | `src/lib/account/deletion.ts` (`deleteMyAccount` → **`verifyCredentials`**, sin segundo mecanismo); `src/app/cuenta/actions.ts`; `src/app/cuenta/delete-account-form.tsx`; `src/lib/account/messages.ts` (`PASSWORD_INCORRECTA`) | `tests/account-deletion.test.ts` › *CA-3: sin la contraseña actual no se borra ni una fila* (4: censo intacto tabla por tabla, contraseña vacía, la credencial sigue sirviendo, usuario inexistente) + `tests/e2e/cuenta.spec.ts` › *CA-3* (2: error visible, sigue en `/cuenta`, **la sesión sigue viva** —navega a `/vigiladas` sin rebotar— y la cuenta sigue en la base; y con la contraseña buena sí se va) | Flujo real: contraseña incorrecta → «Esa no es tu contraseña actual. No se ha borrado nada.», sigue en `/cuenta`, censo idéntico en las 7 tablas (`prt 1 · tx 4 · ws 2 · zt 2 · notif 2 · alias 1 · users 1`) y la sesión **sigue viva** (`/vigiladas` sin rebote) | ✅ |
| CA-4 | `src/lib/account/deletion.ts` (`purgeUserData`, `DELETION_ORDER` = el orden de ADR-022 pto. 4; `zone_triggers` cae por cascade y **no** tiene sentencia propia) | `tests/account-deletion.test.ts` › *CA-4* (4: **la siembra deja filas en las siete tablas** —sin eso el test siguiente no probaría nada—; censo cero tabla por tabla; los episodios caen con su vigilada; y **ninguna tabla del esquema con `user_id` conserva filas de un usuario que ya no existe**) | Borrado ejecutado desde la pantalla sobre un usuario sembrado en las 7 tablas: censo posterior **cero en las siete**, y consulta de huérfanos (`NOT EXISTS (select 1 from users …)`) a **cero en las 6** tablas con `user_id` | ✅ |
| CA-5 | `src/lib/account/deletion.ts` (`ACCOUNT_DELETION_COVERAGE`: la cobertura se declara **una vez** y de ahí salen el orden del borrado, la lista de CA-2 y esta comprobación) | `tests/account-deletion-coverage.test.ts` (12 casos): el conjunto de tablas del esquema con `user_id` (más `users`) es **exactamente** el conjunto cubierto, en los dos sentidos; el orden explícito es el de ADR-022; `zone_triggers` está declarada `cascade` desde `watched_symbols` y **no** en el orden explícito; y ninguna tabla compartida entra en la cobertura | Censo hecho por mí desde `src/db/schema.ts`: 10 tablas, 6 con `user_id` (`password_reset_tokens`, `transactions`, `watched_symbols`, `zone_triggers`, `notifications`, `symbol_aliases`) + `users` = **exactamente** las 7 cubiertas; las 3 compartidas no tienen columna de dueño y no aparecen. El test introspecciona de verdad (`getTableConfig`) y compara en los dos sentidos | ✅ |
| CA-6 | `src/lib/account/deletion.ts` (`SHARED_TABLES` no se toca; el borrado filtra siempre por `userId`) | `tests/account-deletion.test.ts` › *CA-6: irse no daña a nadie más* (4: `symbols`/`quotes`/`quote_diagnostics` con **mismo recuento y mismos valores** —comparación de las filas enteras—; el otro usuario conserva censo y zonas y sigue viendo el precio; el símbolo sin dueño queda **inerte, no borrado**; y las compartidas no tienen columna `user_id`) + *el borrado no toca las operaciones de otro usuario* (1) + `tests/account-deletion-coverage.test.ts` › *CA-6: lo compartido no entra en el borrado, por construcción* (3) | Dos usuarios sobre el **mismo** símbolo: `symbols`+`quotes`+`quote_diagnostics` idénticas **fila por fila** (snapshot JSON completo antes/después) y el vecino conserva sus 6 tablas byte a byte; en `/vigiladas` sigue viendo `VERIF` con su precio 111,11 | ✅ |
| CA-7 | `src/lib/account/deletion.ts` (`purgeUserData`: una sola transacción, elegida **por capacidad del driver** — `batch()` en neon-http, `transaction()` en postgres-js y PGlite); `src/app/cuenta/actions.ts` (el fallo se traduce a «no se ha borrado nada, vuelve a intentarlo» y se registra en el servidor) | `tests/account-deletion.test.ts` › *CA-7: si una sentencia intermedia falla, la base queda como estaba* (3: una referencia externa tumba el `DELETE FROM users` y el censo queda **entero**; **la carrera de F-SPEC-036-1 simulada de verdad** —una regla que inserta un aviso entre el borrado de `notifications` y el de `users`— cae entera; y el reintento posterior funciona) | PGlite cubre la transacción; **el camino de producción lo he ejercitado yo**: sonda con doble de `fetchFunction` sobre `drizzle-orm/neon-http` — el purge entero viaja en **UNA** petición a `/sql` con `{queries:[6]}` en el orden de ADR-022 y filtrando siempre por ese `userId`; un 400 del servidor propaga el error; y si `batch()` faltara, el fallback **revienta** («No transactions support in neon-http driver») en vez de degradar a 6 sentencias sueltas. Residual: el `BEGIN`/`COMMIT` lo ejecuta el servidor de Neon (contrato documentado), y ningún test del repo lo cubre — ver R-1 | ✅ |
| CA-8 | Sin código propio: es la consecuencia directa de que desaparezca la fila y con ella el índice único (ADR-022 pto. 5). Se apoya en `registerUser` (`src/lib/auth/users.ts`) | `tests/account-deletion.test.ts` › *CA-8: el email vuelve a estar libre (RN-02)* (4: el alta funciona y es **otra** cuenta; censo cero en todas sus tablas; **nace `tester`** aunque la anterior fuera `completo`; y la credencial vieja ya no sirve) + `tests/e2e/cuenta.spec.ts` › *y desde ella se puede volver a registrarse con el mismo email* | Tras el borrado, alta con el **mismo** email → `/dashboard`; id distinto del borrado, rol `tester`, censo cero en sus 6 tablas, y entra de verdad con la contraseña nueva | ✅ |
| CA-9 | **Sin código nuevo** — propiedad heredada de ADR-016: sin fila en `users`, `readSessionRow` devuelve `null`, `isSessionEpochCurrent(claim, undefined)` es `false` y `resolveSessionWithEpoch` resuelve la sesión **anónima**. Lo único que aporta esta spec es el `signOut` de la sesión desde la que se borra (`src/app/cuenta/actions.ts`) | `tests/e2e/cuenta.spec.ts` › *CA-9: la otra sesión, en otro navegador, deja de autenticar en su siguiente petición* — **dos `BrowserContext` distintos**; se comprueba que las dos autentican ANTES, y después la segunda acaba en `/login` en `/avisos`, `/dashboard`, `/vigiladas` y `/cuenta`, sin que su cuerpo contenga el email | Dos `BrowserContext` distintos, ambos autenticando antes. Tras el borrado el segundo acaba en `/login` en `/avisos`, `/dashboard`, `/vigiladas` y `/cuenta`, y su cuerpo **no contiene** ni el email ni el ticker del borrado | ✅ |
| CA-10 | `src/app/cuenta-borrada/page.tsx` (pública, **sin imports de `src/db` ni de sesión**); `src/lib/auth/guard.ts` (`PUBLIC_PREFIXES` += `/cuenta-borrada`); `src/app/cuenta/actions.ts` (`signOut({ redirectTo })`) | `tests/cuenta-rutas.test.ts` › *CA-10* (6: pública, declarada en `PUBLIC_PREFIXES`, `/cuenta-borradaX` **no** lo es, `/cuenta` sigue exigiendo sesión, y el matcher del proxy **no cambia**) + `tests/e2e/cuenta.spec.ts` › *CA-10* (3: se pinta entera, sin `nav`, sin texto de error de Next y **sin cookie de sesión con valor**; se lee tecleando la URL sin sesión; y desde ella se vuelve a registrar) | Aterriza en `/cuenta-borrada`, se pinta entera, sin error de Next, **sin `.app-nav`** (el único `<nav>` es el pie legal de SPEC-035), sin cookie de sesión con valor y sin filtrar el email. Geometría idéntica a `/login` y `/register` (`.auth-wrap` left 430 / width 420 a 1280 px) y sin desbordamiento a los cinco anchos | ✅ |
| CA-11 | `src/lib/account/deletion.ts` (`canDeleteAccount`, y `deleteMyAccount` **relee el rol de la base** — la firma no admite rol de entrada); `src/app/cuenta/page.tsx` (sin formulario para `admin`); `src/lib/account/messages.ts` (`ADMIN_NO_SE_BORRA`: por qué y cómo proceder) | `tests/account-deletion.test.ts` › *CA-11* (3: la decisión es pura; con la contraseña **correcta** se rechaza igual y el censo queda intacto; el rechazo lo decide la base) + `tests/e2e/cuenta.spec.ts` › *CA-11* (2: no hay botón ni campo, y la explicación dice «operador» y «degradar»; **y la acción se rechaza invocándola de verdad** — se abre `/cuenta` siendo `tester`, se promueve a `admin` por debajo y se envía el formulario que ya está en el DOM) | Bypass ejecutado de verdad: `/cuenta` cargada como `tester` (formulario en el DOM), `UPDATE role='admin'` por debajo, envío del formulario → **la acción** rechaza con el mensaje de operador, sigue en `/cuenta`, **ni una fila** borrada y el censo de `admin` no baja. Recargada, no hay formulario y la explicación dice por qué y cómo proceder | ✅ |
| CA-12 | `src/lib/account/deletion.ts` (`canDeleteAccount`: la regla **ancha** de ADR-022 pto. 8, que no cuenta administradores) | `tests/account-deletion.test.ts` › *CA-12: la regla no tiene casos frontera* (4: con **uno**, con **dos uno tras otro**, con **dos a la vez** (`Promise.all`) y con censos de 1, 2 y 3 administradores — en los cuatro escenarios ninguno se borra y el censo de `admin` no baja) | Dos `admin` pulsando **a la vez** (`Promise.all` sobre dos navegadores distintos): ninguno se va, ambas filas siguen en `users` y el censo de `admin` se mantiene en 2. Con **un solo** `admin` tampoco se le ofrece. Control: dos **no**-`admin` simultáneos sí se van los dos, así que la regla no bloquea de más | ✅ |
| CA-13 | `src/lib/account/deletion.ts` (la restricción es sobre el **rol**, y el rol se lee en cada petición: ADR-021 pto. 4) | `tests/account-deletion.test.ts` › *CA-13: degradarse primero SÍ permite irse* (3: `admin`→`tester` y `admin`→`completo` se borran con censo cero; y el email vuelve a estar libre) + `tests/e2e/cuenta.spec.ts` › *CA-13* (sin botón como `admin`, con botón tras el `UPDATE` **sin volver a iniciar sesión**, y el borrado completo) | `admin` → `completo` por SQL: el formulario vuelve **sin volver a iniciar sesión**, el borrado se completa (censo cero en las 7) y el email queda libre | ✅ |
| CA-14 | `src/app/legal/privacidad/page.tsx` (`conEnlaceACuenta`: parte el párrafo de `DERECHOS` por la ruta y le pone un `Link`, **sin reescribir el texto que SPEC-035 dejó veraz**); `src/lib/account/routes.ts` (la ruta viene de ahí, no de un literal, y ese módulo no importa nada — la página legal sigue sin poder tocar la base) | `tests/e2e/cuenta.spec.ts` › *CA-14: el derecho de supresión, ahora clicable* (3: el enlace existe y es visible dentro de `[data-testid="derechos"]`; **lleva a la pantalla** con sesión; y sin sesión lleva a `/login`, que es RN-03 y no un 404) + `tests/e2e/legal.spec.ts` › *el enlace a /cuenta no está roto* (**guardia de SPEC-035 re-encuadrada**, ver F-SPEC-036-6) | `[data-testid="derechos"]` de `/legal/privacidad` tiene **un** `a[href="/cuenta"]` visible dentro de la frase «…desde la propia app, en la pantalla de cuenta (/cuenta)»; con sesión lleva a la pantalla, sin sesión responde **200** y acaba en `/login` (no 404). La guardia de SPEC-035 está re-encuadrada, no aflojada (ver veredicto) | ✅ |
| CA-15 | No se ha cambiado ningún comportamiento existente: `src/lib/auth/guard.ts` solo **añade** un prefijo, `src/app/app-nav.tsx` solo **añade** un enlace fuera del grupo de secciones, y `src/app/globals.css` solo añade reglas nuevas. No se ha tocado `src/proxy.ts`, ni `src/app/app-footer.tsx`, ni `package.json`, ni `next.config.mjs`, ni ninguna migración | Suite completa (ver «Gates»): `npm test` **950/950** (67 ficheros) · `npm run test:e2e` **124/124** · `typecheck` · `lint` · `build` · `db:scan`. En particular siguen verdes `tests/ownership.test.ts` (SPEC-001 CA-6), `tests/session-epoch.test.ts` y `tests/password-reset.test.ts` (SPEC-023 CA-13), `tests/e2e/vigiladas.spec.ts` y `tests/triggers-*.test.ts` (SPEC-024/ADR-017: dejar de vigilar sigue conservando los avisos), `tests/legal-*.test.ts` y `tests/e2e/pie-*.spec.ts` (SPEC-035). **Y la geometría**: `tests/e2e/cuenta-responsive.spec.ts` (3 casos × 5 anchos) | Los seis gates corridos por mí: `typecheck` OK · `lint` OK · `npm test` **950/950** (67 ficheros) · `npm run test:e2e` **124/124** · `build` OK · `db:scan` 10 migraciones, 2 desbloqueadas. De la rama solo se modifica **un** test ajeno (`tests/e2e/legal.spec.ts`) y es justo la frontera de CA-14. Geometría de `/cuenta` medida por mí a **390/640/700/760/1280**: cero desbordamiento horizontal y ningún elemento de `main` fuera del viewport en ninguno | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 15/15 CA cerrados. 2026-08-19, sdd-verificador.**

Verificacion independiente contra la app corriendo (`next start` sobre Postgres efimero,
`tests/e2e/server.mjs`), con Playwright propio y consultas SQL directas a la base: no
reejecutando los tests del implementador, sino repitiendo los flujos y contando filas.

**Los seis gates, corridos por mi:**

| Gate | Resultado |
|---|---|
| `npm run typecheck` | OK (`tsc --noEmit`, sin salida) |
| `npm run lint` | OK (`eslint . --max-warnings=0`, sin salida) |
| `npm test` | **950 passed (950)** en 67 ficheros |
| `npm run test:e2e` | **124 passed** (2,4 min) |
| `npm run build` | OK — `/cuenta` dinamica, `/cuenta-borrada` estatica |
| `npm run db:scan` | 10 migraciones, 2 destructivas desbloqueadas por escrito (SPEC-008, SPEC-024) — **sin migracion nueva** |

**Censo de tablas, hecho desde `src/db/schema.ts` y no de una lista escrita a mano.**
10 tablas. Con `user_id`: `password_reset_tokens`, `transactions`, `watched_symbols`,
`zone_triggers`, `notifications`, `symbol_aliases`. Mas `users`, que es de la persona por
definicion. **Son exactamente las 7 que declara `ACCOUNT_DELETION_COVERAGE`**, en los dos
sentidos: ninguna tabla con dueno queda fuera y ninguna cubierta ha dejado de tener dueno.
Las tres compartidas (`symbols`, `quotes`, `quote_diagnostics`) **no tienen columna de
dueno** y no aparecen en la cobertura. Comprobado en vivo: tras borrar una cuenta sembrada
en las siete, el censo es cero en las siete y la consulta de huerfanos
(`NOT EXISTS (select 1 from users u where u.id = t.user_id)`) da **0 en las seis**; y en el
otro sentido, las tres compartidas quedan **identicas fila por fila** y el usuario vecino
—que compartia el mismo simbolo— conserva sus seis tablas byte a byte.

**La atomicidad en el driver de produccion (`neon-http`), que es lo que ningun test
ejercitaba.** Monte un doble que imita el contrato del driver real: `drizzle-orm/neon-http`
sobre `@neondatabase/serverless` con `neonConfig.fetchFunction` interceptado. Resultado:

- `purgeUserData` **toma la rama `batch()`** con el cliente de produccion.
- El borrado entero viaja en **UNA sola peticion** `POST https://<host>/sql`, con cuerpo
  `{"queries":[...6...]}` en el orden de ADR-022 pto. 4 (`notifications`, `watched_symbols`,
  `transactions`, `symbol_aliases`, `password_reset_tokens`, `users`), cada una
  parametrizada con **ese** `userId` y con su `where`. Ni una tabla compartida, ni
  `zone_triggers` (cae por `cascade`).
- Un `400` del servidor **propaga el error**: nada se da por borrado.
- Y si `batch()` desapareciera, el fallback **no degrada a seis sentencias sueltas**:
  `db.transaction()` de neon-http lanza `No transactions support in neon-http driver`. El
  fallo seria ruidoso, no silencioso.

Lo que **no** se puede cerrar aqui y queda como R-1: el `BEGIN`/`COMMIT` de ese lote lo
ejecuta el servidor de Neon. Es contrato documentado del proveedor
(`@neondatabase/serverless`: *"multiple queries submitted (over HTTP) as a single,
non-interactive Postgres transaction"*) y ningun doble local puede probarlo — probaria el
doble, no Neon. **Si era cubrible** la mitad que depende de este repo, y es la que acabo de
correr: 60 lineas y ningun Neon en CI. Que no este en la suite es residual abierto, no un
CA sin cumplir.

**Los dos puntos que se pidio mirar con lupa.**

1. `tests/e2e/legal.spec.ts` — **re-encuadre legitimo, no guardia aflojada.** Lo que el caso
   viejo vigilaba no era "no hay enlace" sino **"ninguna pagina legal enlaza a una ruta que
   no existe"**: por eso exigia `toHaveCount(0)` mientras `/cuenta` no existia. El caso
   nuevo vigila esa misma propiedad por el lado que ahora corresponde: `toHaveCount(1)`
   **mas** una comprobacion que el viejo no tenia — que `/cuenta` responde **200** y no 404.
   La guardia es **mas fuerte**, no mas debil. Y CA-16 de SPEC-035 (que el derecho se
   *enuncie* y se diga el residual de los correos) sigue intacto en el caso de al lado.
   Cruzar esta frontera estaba escrito en las dos specs.
2. **PNG de `_qa/` de otras specs — limpios.** Acotado a los dos commits de esta spec
   (`git diff --name-only ft/SPEC-035-...HEAD -- _qa`) **solo aparece `_qa/SPEC-036/`**.
   Nada pisado.

**Geometria de `/cuenta`, medida por mi a los cinco anchos** (ancho x 900):

| Ancho | `scrollWidth` / `clientWidth` | Caja de la zona de borrado | Elementos de `main` fuera del viewport |
|---|---|---|---|
| 390 px | 390 / 390 | 1197 px | 0 |
| 640 px | 640 / 640 | 852 px | 0 |
| 700 px | 700 / 700 | 783 px | 0 |
| 760 px | 760 / 760 | 813 px | 0 |
| 1280 px | 1280 / 1280 | 665 px | 0 |

Sin desbordamiento horizontal en ninguno y sin un solo elemento fuera. La diferencia entre
la caja y su contenido es 38-46 px a todos los anchos, que es **exactamente** el
`padding: 22px 24px` de `.danger-zone` mas su `gap`: no hay hueco muerto. `/cuenta-borrada`
tampoco desborda a ninguno de los cinco, y su columna coincide al pixel con `/login` y
`/register` (`.auth-wrap` left 430 / width 420 a 1280 px), asi que no estrena maquetacion.

**Lo irreversible, comprobado como irreversible.** El borrado se ejecuto de verdad desde la
pantalla, con datos reales sembrados en las siete tablas y un vecino sobre el mismo simbolo.
Cayo todo lo suyo, no cayo nada compartido ni ajeno, las dos sesiones murieron a la vez, el
email volvio a estar libre y la cuenta nueva nacio vacia y `tester`.

**Residuales abiertos: R-1 a R-4, mas abajo. Ninguno bloquea publicar.**

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

**Evidencia del verificador** (capturas propias, prefijo `verif-`, en `_qa/SPEC-036/`):

| CA | Evidencia del verificador |
|---|---|
| CA-1 | `verif-ca1-tester.png`, `verif-ca1-completo.png`, `verif-ca1-admin.png` |
| CA-2 | `verif-ca2-que-desaparece.png` |
| CA-3 | `verif-ca3-password-incorrecta.png` |
| CA-9 | `verif-ca9-segunda-sesion.png` |
| CA-10 | `verif-ca10-cuenta-borrada.png` |
| CA-11 | `verif-ca11-accion-rechazada.png`, `verif-ca11-admin-sin-boton.png` |
| CA-13 | `verif-ca13-degradado-ya-puede.png` |
| CA-14 | `verif-ca14-desde-privacidad.png` |
| CA-15 | `verif-cuenta-390px.png`, `verif-cuenta-640px.png`, `verif-cuenta-700px.png`, `verif-cuenta-760px.png`, `verif-cuenta-1280px.png` |

**Las medidas del implementador, sin tener que abrir el fichero** (390 · 640 · 700 · 760 · 1280 px):

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

## Residuales abiertos tras la verificacion (los abre sdd-verificador)

Ninguno bloquea publicar. Los cuatro son para el arquitecto o para EPIC-MEJORA.

- **R-1 (el que mas pesa; baja de nivel F-SPEC-036-7).** El camino `batch()` de `neon-http`
  **si era cubrible sin un Neon en CI**: un doble de `neonConfig.fetchFunction` basta para
  fijar que el purge sale en una sola peticion, con las seis sentencias en orden y filtradas
  por el usuario. Lo he corrido y pasa; **no esta en la suite**, asi que nada impide que un
  refactor futuro lo rompa en silencio. Recomendacion: llevar esa sonda a `tests/` como un
  caso mas. Lo que **seguira** siendo residual despues de eso es solo el `COMMIT`/`ROLLBACK`
  del servidor de Neon, que es contrato del proveedor. Se mantiene la recomendacion del
  implementador de borrar una cuenta de prueba en el primer despliegue.
- **R-2 (ventana TOCTOU del rol; milisegundos, no explotable hoy).** `deleteMyAccount` lee
  el rol, **luego** verifica la contrasena con bcrypt (~100-300 ms) y **despues** borra. Si
  alguien promoviera la cuenta a `admin` en esa ventana, el borrado seguiria adelante. No es
  alcanzable desde la app — no hay UI para nombrar operador (`F-ADR-021-1`), solo un
  `UPDATE` a mano en Neon — y la regla ancha de ADR-022 sigue sin contar administradores,
  que era la carrera que importaba. Se anota por completitud, no como defecto.
- **R-3 (documento de verdad; hereda F-SPEC-036-5).** `docs/fundacion/dominio.md` **sigue
  sin** el termino **Borrado de cuenta** que la seccion "Entidades y reglas afectadas" de
  esta spec dice que se anade. Ningun CA lo cubre, asi que no bloquea el GREEN, pero es un
  entregable de la spec que queda sin entregar. En SPEC-035 esa fila la puso la
  implementacion.
- **R-4 (lenguaje ubicuo; una palabra).** `/cuenta` rotula el rol como **"Tipo de cuenta"**;
  el termino de `docs/fundacion/dominio.md` es **"Rol de cuenta"**. El valor que se ensena
  (`tester`/`completo`/`admin`) si es vocabulario del dominio. Cambio de una linea.

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
