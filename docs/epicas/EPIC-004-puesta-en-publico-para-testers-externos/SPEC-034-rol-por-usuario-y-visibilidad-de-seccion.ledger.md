---
id: SPEC-034
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-034 Rol por usuario y visibilidad de seccion

## Resumen
- Fase: en-revision (implementación completa; falta el gate del verificador)
- Rama: `ft/SPEC-034-rol-por-usuario-y-visibilidad-de-seccion`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `drizzle/0009_user_role.sql`, `src/db/schema.ts` (`users.role`, `check('users_role_check')`) | `tests/roles-schema.test.ts` › *SPEC-034 CA-1* (5 casos: columna `text NOT NULL`; CHECK y no enum de Postgres; acepta los tres valores; rechaza `root`/`''`/`TESTER`/`operador`/`Admin`/`NULL`; RI-01 sin hallazgos del escáner + el código anterior sigue funcionando) | | 🚧 |
| CA-2 | `drizzle/0009_user_role.sql` (1.ª sentencia: `ADD COLUMN … DEFAULT 'admin'`) | `tests/roles-schema.test.ts` › *SPEC-034 CA-2* › «sembrando ANTES de la migración, todas quedan admin sin ningún UPDATE manual» (aplica las 9 migraciones previas, siembra 3 cuentas, comprueba que la columna aún no existe, aplica la 10.ª) + «admin ve las seis» | | 🚧 |
| CA-3 | `drizzle/0009_user_role.sql` (2.ª sentencia: `ALTER COLUMN … SET DEFAULT 'tester'`), `src/db/schema.ts`, `src/lib/auth/users.ts` (`PublicUser.role`) | `tests/roles-schema.test.ts` › *SPEC-034 CA-3* (3 casos: `registerUser` → tester; `INSERT` crudo sin la columna → tester; el default aplicado es `'tester'`) · e2e `tests/e2e/roles.spec.ts` › *CA-3/CA-5/CA-9* (`rolDe(email) === 'tester'` tras el registro por la UI) | | 🚧 |
| CA-4 | `src/lib/auth/sections.ts` (`ROLES`, `SECTIONS`, `canSee`, `visibleSections`, `isRole`) | `tests/section-visibility.test.ts` (30 casos: las **18 combinaciones una a una** contra una tabla escrita a mano; cadena `tester ⊂ completo ⊂ admin` en los dos eslabones; y el grafo de imports que prueba que el módulo no alcanza `src/db/` ni importa Next/Auth.js/driver de BD) | | 🚧 |
| CA-5 | `src/app/app-nav.tsx` (consulta `canSee`, no una lista propia) | e2e `tests/e2e/roles.spec.ts` › *CA-3/CA-5/CA-9* (tester: 0 enlaces a `/cartera` y `/cartera/importar`, ni el texto; Panel/Vigiladas/Avisos presentes) y › *CA-5/CA-9 completo y admin* (los cuatro enlaces; y **0** enlaces a `/admin`, que es SPEC-037). Contador de no leídos intacto en `tests/e2e/roles.spec.ts` › *CA-14* (`.nav-count` = 1 → 0) | | 🚧 |
| CA-6 | `src/lib/auth/session.ts` (`requireSectionUser`), `src/app/cartera/page.tsx`, `src/app/cartera/importar/page.tsx` | e2e `tests/e2e/roles.spec.ts` › *CA-6/CA-8* — para `/cartera` y `/cartera/importar`: URL final `/dashboard`, el cuerpo no contiene ninguno de 7 rastros (`tu cartera`, `registrar compra`, `registrar venta`, `importar extracto`, `p/l realizado`, `coste medio`, `sube el extracto`), 0 `<table>` y 0 `input[name=quantity]` | | 🚧 |
| CA-7 | `src/lib/auth/session.ts` (`sectionUserOrNull`), `src/app/cartera/actions.ts`, `src/app/cartera/importar/actions.ts` (las **8** actions) | `tests/cartera-actions-role.test.ts` (15 casos): «la lista de actions se prueba ENTERA» compara las `export async function …Action` **leídas del fuente** contra las cubiertas; 8 casos «*X* no crea, no modifica y no borra ninguna fila» (censo de `transactions` y `symbol_aliases` antes/después + el motivo correcto); **control positivo** con rol `completo` (escribe transacción y alias de verdad) y con `admin`; y sin sesión | | 🚧 |
| CA-8 | `src/lib/auth/section-messages.ts` (`notaDeRebote`), `src/lib/auth/session.ts` (`bounceTo`), `src/app/dashboard/page.tsx` (`leerRebote`, `data-testid="nota-sin-acceso"`) | e2e `tests/e2e/roles.spec.ts` › *CA-6/CA-8* (nota visible, nombra la sección, dice «no está disponible en la versión de pruebas», sin `404` ni pantalla de error de Next; y **desaparece** al visitar `/dashboard` sin rebote) y › *CA-8: un valor inventado en la URL no pinta ninguna nota* | | 🚧 |
| CA-9 | `src/app/dashboard/page.tsx` (tarjetas y subtítulo por `canSee`) | e2e `tests/e2e/roles.spec.ts` › *CA-3/CA-5/CA-9* (tester: **2** tarjetas, sin «Cartera y P/L» y sin ningún `a[href="/cartera"]` en `main`) y › *CA-5/CA-9 completo y admin* (**3** tarjetas, intactas) | | 🚧 |
| CA-10 | `src/lib/auth/session-row.ts`, `src/lib/auth/session-boundary.ts` (rol releído en cada petición) | e2e `tests/e2e/roles.spec.ts` › *CA-10* — un solo contexto de navegador, vaivén completo `completo → tester → completo → admin → completo`, comprobando acceso y enlace en cada salto; la sesión no cambia de identidad (mismo `id` y `credentialEpoch` **decodificados del JWT real**) y no se pasa por `/login` | | 🚧 |
| CA-11 | `src/lib/auth/base-config.ts` (**sin cambios**), `src/types/next-auth.d.ts` (`role` en `Session.user`, **no** en `JWT`) | `tests/session-role.test.ts` › *CA-11* (7 casos: la callback `jwt` real con un `user` que trae rol → el token solo tiene `id` y `credentialEpoch`; el serializado no menciona `role` ni ninguno de los tres valores; rotación sin `user`; grafo de imports de `base-config.ts` sin `src/db/` ni driver ni bcrypt; el bloque `declare module 'next-auth/jwt'` sin `role`) · e2e `tests/e2e/roles.spec.ts` › *CA-10* decodifica el **JWT emitido de verdad** y comprueba lo mismo tras cuatro cambios de rol | | 🚧 |
| CA-12 | `src/lib/auth/session-row.ts` (`readSessionRow`: un `SELECT` con `{epoch, role}`), `src/lib/auth/session-boundary.ts` | `tests/session-role.test.ts` › *CA-12* — **doble de la base que cuenta**: exactamente 1 consulta, sobre `users`, con columnas `['password_changed_at','role']`; época caducada = 1 consulta; sin `id` = 0 consultas. Y *CA-12 (integración)*: instrumentando el cliente PGlite real, **una sola sentencia** toca `users` y trae las dos columnas | | 🚧 |
| CA-13 | Sin cambios de código: `src/lib/data/ownership.ts` y los servicios siguen filtrando por `userId` (RN-01 no depende del rol) | `tests/role-isolation.test.ts` (6 casos): admin y tester con datos propios; el admin recorre las 6 secciones de su rol y no ve email/ticker/id/aviso del otro; el tester tampoco; **control positivo** (cada uno ve lo suyo entero); la cartera del admin no crece; y promover al tester a admin no le abre ni una fila ajena | | 🚧 |
| CA-14 | Sin cambios de código (Vigiladas y Avisos nunca se cerraron) | e2e `tests/e2e/roles.spec.ts` › *CA-14* — con rol `tester`: añadir vigilada con las cuatro zonas, estado de zona `zone-buy` + etiqueta + `asOf`, contador de no leídos, marcar leído, y quitar de vigiladas estando en zona sin perder el aviso (SPEC-003, SPEC-007, SPEC-024, SPEC-029) | | 🚧 |
| CA-15 | `tests/ownership.test.ts`, `tests/spec-032-frontera.test.ts`, `tests/deploy-gate-workflow.test.ts`, `tests/destructive-sql-scan.test.ts` y 7 ficheros e2e ajustados | Suite completa: `npm test` **844/844 en 59 ficheros**, `npm run test:e2e` **45/45**, `npm run typecheck` y `npm run lint` limpios, `npm run db:scan` salida 0. Cambios de expectativa detallados en F-SPEC-034-4 y F-SPEC-034-6 | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-034/. Informe HTML opcional: _qa/SPEC-034/informe.html -->

| CA | Captura |
|---|---|
| CA-5 / CA-9 (tester) | `_qa/SPEC-034/ca5-ca9-panel-y-menu-de-tester.png` |
| CA-5 / CA-9 (completo) | `_qa/SPEC-034/ca5-ca9-panel-de-completo.png` |
| CA-5 / CA-9 (admin) | `_qa/SPEC-034/ca5-ca9-panel-de-admin.png` |
| CA-6 / CA-8 (rebote desde Cartera) | `_qa/SPEC-034/ca6-ca8-rebote-desde-cartera.png` |
| CA-6 / CA-8 (rebote desde Importar) | `_qa/SPEC-034/ca6-ca8-rebote-desde-importar.png` |
| CA-8 (panel sin rebote: la nota NO aparece) | `_qa/SPEC-034/ca8-panel-limpio-sin-rebote.png` |
| CA-10 (completo dentro de Cartera) | `_qa/SPEC-034/ca10-completo-dentro-de-cartera.png` |
| CA-10 (degradado, fuera en el clic siguiente) | `_qa/SPEC-034/ca10-degradado-fuera-en-el-clic-siguiente.png` |
| CA-10 (promovido de vuelta) | `_qa/SPEC-034/ca10-promovido-de-vuelta.png` |
| CA-14 (vigiladas en zona con asOf) | `_qa/SPEC-034/ca14-tester-vigiladas-en-zona.png` |
| CA-14 (avisos marcados) | `_qa/SPEC-034/ca14-tester-avisos-marcados.png` |
| CA-14 (quitar en zona sin perder el aviso) | `_qa/SPEC-034/ca14-tester-quitar-y-aviso-vivo.png` |

## Salvedades / follow-ups
<!-- IDs F-SPEC-034-1, F-SPEC-034-2… con destino (spec futura o EPIC-MEJORA). -->

Las cinco primeras vienen de la spec y **no se cierran aquí**:

- **F-SPEC-034-1 (DESPLIEGUE).** Abrir la PR migra producción (`vercel.json` migra en el
  build y `DATABASE_URL` es compartida). Las tres sentencias son aditivas (RI-01) y el
  código vigente sigue funcionando con ellas, pero **cuándo se abre la PR es decisión del
  humano**. Sin cambios respecto a lo escrito en la spec.
- **F-SPEC-034-2 (orden de despliegue).** Entre la migración y el código nuevo, todas las
  cuentas son `admin` y nadie ve nada distinto porque nada lee la columna todavía. Sigue
  siendo cierto: `readSessionRow` es lo único que la lee, y llega con el código nuevo.
- **F-SPEC-034-3 (residual asumido).** Una petición de un `tester` a `/cartera` atraviesa el
  middleware Edge y solo se corta en Node. Verificado tal cual: `src/proxy.ts` y
  `src/lib/auth/guard.ts` **no se han tocado**; el corte vive en `requireSectionUser`. No se
  sirve ni un dato (CA-6), pero el redirect se paga un salto más tarde.
- **F-SPEC-034-4 (higiene de tests) — ATENDIDA como pedía la spec.** Se declara el rol en el
  arranque de las pruebas que ejercitan Cartera/Importar, **sin relajar el default**. Helper
  nuevo `tests/e2e/roles.ts` (`ponerRol`, `rolDe`, un `UPDATE`, que es lo que hará el
  operador en Neon). Ficheros tocados: `cartera.spec.ts`, `importar.spec.ts`,
  `ingesta-cartera.spec.ts`, `diagnostico-cotizacion.spec.ts`, `decimales.spec.ts`,
  `buscador-instrumentos.spec.ts` (solo su test de `/cartera`) y `recuperacion.spec.ts`
  (solo el CA-13, que usa `/cartera` como "ruta con datos"). Ningún test unitario necesitó
  cambio: operan sobre los servicios, no sobre las server actions.
- **F-SPEC-034-5 (condición previa al *merge*, hereda F-ADR-021-3). ABIERTA, del humano.**
  El backfill deja `admin` a **todas** las cuentas existentes. **Confirmar el censo de
  `users` en Neon antes de abrir la PR**; si hay alguna cuenta que no sea del operador, se
  degrada a mano antes de desplegar. No se ha tocado nada de esto por iniciativa propia.

Nuevas, abiertas por esta implementación:

- **F-SPEC-034-6 (deuda ajena tocada, para el gate humano).** Tres guardias de otras specs
  **no detectaban un defecto de SPEC-034: detectaban que SPEC-034 existe**. Se re-encuadran
  sin tocar la propiedad que vigilan, y se declaran aquí porque son ficheros de otras specs:
  1. `tests/ownership.test.ts` mantenía **su propia copia del DDL de `users`** y reventó en
     cuanto la tabla ganó una columna — exactamente el fallo que ADR-019 describe. Pasa a
     montar el esquema con `makeTestDb()` (migraciones) y a crear a mano solo `notes`, su
     tabla-fixture, que no existe en ninguna migración.
  2. `tests/spec-032-frontera.test.ts` CA-14.3 afirmaba *"drizzle/ tiene nueve .sql"*. Lo que
     su CA dice es que **esa** spec no añadió ninguna; ahora comprueba que las nueve siguen
     ahí, en su sitio y en su orden, en lugar de que sean las únicas que existirán jamás.
  3. `tests/deploy-gate-workflow.test.ts` CA-9 diffeaba `de3a6ee...HEAD`, lo que convertía un
     CA sobre el diff de **una PR** en una condena perpetua. La ventana pasa a ser la de su
     propia entrega, `de3a6ee...0d389c8` (merge de SPEC-028, PR #35).
     Además, `tests/destructive-sql-scan.test.ts` CA-8 pasa de "nueve migraciones" a "diez":
     es un recuento de calibración, y sigue marcando exactamente `0001` y `0007`.
  **Nada de esto relaja un gate**; si el humano prefiere otro encuadre, es un cambio local a
  esos tres ficheros. Destino: EPIC-INFRA si se quiere una convención escrita sobre cómo
  caducan los "tests de frontera" de una spec.
- **F-SPEC-034-7 (higiene local, no afecta a CI).** `npm run lint` fallaba en cualquier
  máquina con worktrees de sesiones paralelas: `eslint .` analizaba
  `.claude/worktrees/**/.next/**` (miles de ficheros de build ajenos, **ignorados por git**) y
  daba ~18.500 problemas. Se añade `'.claude/**'` a los `ignores` de `eslint.config.mjs`,
  junto a `node_modules/**` y `.next/**`. En CI, que clona limpio, no había síntoma.
- **F-SPEC-034-8 (dominio, para sdd-arquitecto).** La spec pide añadir a
  `docs/fundacion/dominio.md` los términos **Rol de cuenta** (`tester`/`completo`/`admin`) y
  **Sección**. **No lo he hecho**: es un documento de verdad y el implementador no los edita.
  Queda pendiente de quien sí puede tocarlo, antes del cierre de la spec.
- **F-SPEC-034-9 (arrastrado del árbol de trabajo).** El `.gitignore` llegó ya modificado a
  esta rama (añadía `.claude/settings.local.json` y `.claude/worktrees/`, sin commitear) y
  entró en el primer commit de SPEC-034. Es correcto y no es mío: se anota para que nadie lo
  lea como parte de esta spec.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Estado: implementación completa, los 15 CA con test, cuatro gates en verde.** La spec queda
en `en-revision`; el `hecho` es del verificador.

**Rama** `ft/SPEC-034-rol-por-usuario-y-visibilidad-de-seccion`, sobre
`ft/EPIC-004-puesta-en-publico`. Seis commits:

| Commit | Qué entra |
|---|---|
| `8fbf71a` | `feat` — el catálogo de secciones y la cadena (CA-4) |
| `895368b` | `feat` — la columna `role`, migración `0009_user_role` y backfill (CA-1/2/3) |
| `7d5ecb9` | `feat` — el rol en la frontera de Node, en la consulta que ya se pagaba (CA-11/12) |
| `e01af71` | `feat` — cerrar Cartera e Importar: página, action y menú (CA-5/6/7/8/9) |
| `6d07cde` | `fix` — tres guardias ajenas re-encuadradas (F-SPEC-034-6) |
| `7f31da2` | `test` — el navegador: menú, URL, rebote, vaivén de rol (CA-5/6/8/9/10/14) |

**Dónde vive lo nuevo:**
- `src/lib/auth/sections.ts` — el catálogo puro. **Un solo sitio donde se decide.**
  SPEC-037 debe leer `canSee(role, 'operacion')` de aquí, no inventar un segundo mecanismo.
- `src/lib/auth/section-messages.ts` — la frase del rebote, compartida por el panel y las
  server actions para que digan lo mismo.
- `src/lib/auth/session-row.ts` — `readSessionRow`, la lectura por petición. Sustituye a
  `getCredentialEpoch`, que se ha retirado de `password-reset.ts` (no lo usaba nadie más).
- `src/lib/auth/session.ts` — `requireUser` (ahora devuelve `role`), `requireSectionUser`
  (páginas, redirige) y `sectionUserOrNull` (server actions, devuelve `null`).
- `tests/e2e/roles.ts` — `ponerRol` / `rolDe` para el e2e.

**Lo que esta spec deliberadamente NO hace**, y conviene no "arreglar" por sorpresa:
- No pinta ningún enlace a `/admin`: la ruta es de **SPEC-037**, y hay un test que exige 0
  enlaces a ella.
- No añade ninguna ruta pública: `PUBLIC_PREFIXES` y `src/proxy.ts` están intactos.
- No hay UI para cambiar el rol (F-ADR-021-1): se cambia con un `UPDATE`.

**Antes del merge, dos cosas del humano:** el censo de `users` (F-SPEC-034-5) y una mirada al
re-encuadre de las tres guardias ajenas (F-SPEC-034-6).
