| Verificado en el gate, no por guardia congelada (correcto según ADR-037): `npm test` **1936/1936** y `npx playwright test` **325/325** a HEAD `56d3034`. Revisado uno a uno el diff `2797c35..HEAD` sobre tests ajenos: **no se borra ni se afloja ni un `expect`** — en `reglas-ingenieria*.test.ts` el patrón se **ancla al encabezado** (`^- **RN-nn** (`) porque RN-17 *cita* a RN-13/RN-14, y las 17 siguen exigiéndose en orden; en los cuatro e2e ajenos lo que se añade es **reconstrucción de premisa** (borrar cotización/diagnóstico), con la aserción intacta. El ciclo conserva su comportamiento: `src/lib/triggers/`, `vercel.json` y el esquema **sin tocar**, `symbolUniverse` sin cambios y `refreshQuotes` llamando a `ingerir` **sin presupuesto**. | ✅ || Ejecutado: los cinco casos pasan. Verificado en git que los documentos de verdad los escribe el **arquitecto** en `411715a`, antes de la primera línea de implementación (`77d84ef`), y que `FOUNDATION.md` **no se toca** (`git diff` vacío). La precisión de RN-16 es solo de redacción: `CICLOS_HASTA_SIN_REFRESCAR` sigue en 1.5, el umbral en 36 h y la medida en `updated_at`. | ✅ || Ejecutado: los cuatro casos pasan. Comprobado que la comparación es **entre los dos caminos reales** —`runRefreshCycle` y `watchAction`, cada uno sobre su PGlite— con `expect(alta.estado).toEqual(ciclo.estado)`; los literales que hay son **anclas positivas añadidas después**, no la comparación. Las dos direcciones están (respuesta buena con diagnóstico previo borrado en ambos · fallo clasificado con el mismo motivo en ambos). Leído el código: `ingerir` es privada y la llaman `refreshQuotes` y `refreshSymbolOnDemand`, y no hay segundo cuerpo. | ✅ || Ejecutado: los dos casos pasan. El barrido cruza el umbral por los dos lados **derivándolo** de `UMBRAL_SIN_REFRESCAR_MS` (no teclea 36) y compara lo que dice la pantalla contra lo que hace el alta, no contra una constante. Verificado por mí que **no hay segundo umbral**: el único hogar es `src/lib/market/sin-refrescar.ts` y `cotizacionVigente` es la negación literal de `estaSinRefrescar`; `grep` no encuentra `36` ni la aritmética del umbral en `refresh.ts` ni en `actions.ts`. | ✅ || Ejecutado: los tres gestos pasan con **una sola** llamada en total (dos altas seguidas · `unwatch` + alta · segundo usuario). El tercero comprueba además que el segundo usuario ve el precio, así que el ahorro no es «no funciona». | ✅ || Ejecutado: los tres casos pasan. La guardia cuenta **invocaciones** (`FakeMarketDataProvider.calls`, que registra cada `getQuotes`), no la forma de la llamada. El caso de cero llamadas siembra `99.99` en el proveedor y la fila sigue enseñando `53.72`: si se hubiera llamado, se vería. | ✅ || Ejecutado (unit 6/6) y verificado en navegador. Las dos direcciones vistas en mis capturas: fuera de zona `vigiladas-aviso-del-ciclo` tiene `count 0`; con REP en zona la frase aparece y es **idéntica** a `AVISO_LO_EMITE_EL_CICLO` (`toHaveText`, no `contains`). `/ayuda` la incluye desde la misma constante. Comprobado que la prosa ya no dice que el ciclo pida los precios y sigue diciendo «único que compara». Pasa la lista cerrada de afirmaciones prohibidas de SPEC-039. | ✅ || Ejecutado: los dos casos pasan. **Control positivo comprobado dentro del mismo test**: tras el alta hay 0 episodios / 0 avisos / 0 envíos, y a continuación `runRefreshCycle` sobre ese mismo estado da `triggers.opened.length === 1`, un `zone_triggers`, **un** aviso `entry` y correo en el `sender` — el cero no está verde por no llegar al motor. La guardia de imports mira el código sin comentarios, así que no confunde la explicación con la infracción. | ✅ || Ejecutado: pasa (~90 s, cuatro bases PGlite). Los cuatro casos se comparan **entre sí** (`toEqual(primero)`) y además contra el ancla positiva `{ ok: true }`, una fila y las cuatro zonas: no puede pasar por «los cuatro fallaron igual». | ✅ || Ejecutado: los tres casos pasan. Afirman `price`, `currency`, `asOf` **y** `updatedAt` idénticos al sembrado, más `sinRefrescar === true` y el `failReason` que toca. Ninguna cotización se borra ni se pone a cero. | ✅ || Ejecutado: los cuatro casos pasan (~3 s reales el del reloj). Verificado por mí que el presupuesto se declara **en un solo sitio**: `grep -rn "3_000|3000" src/` devuelve **una** línea (`refresh.ts:132`). La dirección buena está: `ProveedorLento(5)` con presupuesto 1 000 ms **persiste** `53.72` y deja diagnóstico `null`. `refreshQuotes` sigue sin admitir presupuesto (`conPresupuesto(p, undefined)` devuelve la promesa tal cual). | ✅ || Ejecutado: pasa. Además de `proveedor_no_disponible`, afirma `llamadas === 1` (el adaptador sí se invocó) — no pasa por no llegar al código. Comprobado que `proveedor_no_disponible` ya existía en `QuoteFailureReason`: no hay motivo nuevo. | ✅ || Ejecutado: pasa. `{ ok: true }`, las cuatro zonas `20/25/35/40` tal cual, `quotes` sin fila y `quote_diagnostics` con `simbolo_no_admitido`. | ✅ || Ejecutado: pasa. Las dos direcciones están: divisa **contradictoria** (USD del proveedor sobre símbolo EUR → se guarda EUR) y divisa **ausente** (caso Marketstack → se guarda USD del símbolo, no vacío). Y se afirma la identidad pedida: `[{ticker:SAN,micCode:BMEX}]` y `[{ticker:SAN,micCode:XNYS}]`. | ✅ || Verificado en navegador con Playwright a HEAD `56d3034`: `npx playwright test` → 325/325. Comprobado por mí que el fichero **no llama a `page.reload()` ni una vez** (un solo `page.goto('/vigiladas')` al principio). Captura propia: precio `53.72`, «A fecha» `2026-07-14` y clase `zone-out`/`zone-buy` en la respuesta al envío. | ✅ || Ejecutado: los dos casos pasan. El segundo es el que importa y no es tautológico — compara `updatedAt` **contra el sembrado** (`toBeGreaterThan`) con `price` y `asOf` idénticos, y exige `sinRefrescar === false`. | ✅ || Ejecutado `npm test`: el caso pasa. Leído: la fila queda con `hasQuote`, `state: buy`, `price 53.72`, `currency EUR` (la del símbolo) y `asOf` del proveedor; `quotes` tiene **una** fila y `quote_diagnostics` **cero**. No es vacío: afirma valores concretos, no ausencias. | ✅ |---
id: SPEC-058
tipo: ledger
epica: EPIC-008
---
# Ledger — SPEC-058 El alta de una vigilada trae su precio

## Resumen
- Fase: **hecho** — verificada en GREEN el 2026-08-25 por sdd-verificador
- Rama: `ft/SPEC-058-el-alta-de-una-vigilada-trae-su-precio`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/market/refresh.ts` (`refreshSymbolOnDemand`, `ingerir`) · `src/app/vigiladas/actions.ts` (`watchAction`) | `tests/spec058-alta-con-precio.test.ts` › «CA-1 … tras el alta hay UNA cotización con el precio y el asOf del proveedor, en la divisa del símbolo» | | 🚧 |
| CA-2 | `src/lib/market/quotes.ts` (`upsertQuote`, sin cambios: reescribe `updatedAt` en conflicto) · `refresh.ts` | `tests/spec058-alta-con-precio.test.ts` › «CA-2 … con precio DISTINTO …» y «CA-2 … con EXACTAMENTE el mismo price y el mismo asOf …» | | 🚧 |
| CA-3 | `src/app/vigiladas/actions.ts` (revalidación DESPUÉS del refresco) | `tests/e2e/spec058-alta-con-precio.spec.ts` › «CA-3/CA-11: el alta trae el precio en la misma respuesta…» (sin un solo `page.reload()`) | | 🚧 |
| CA-4 | `src/lib/market/refresh.ts` (`ingerir`: divisa del símbolo, petición por `(ticker, micCode)`) | `tests/spec058-alta-con-precio.test.ts` › «CA-4 … mismo ticker en dos mercados …» (divisa contradictoria **y** divisa ausente) | | 🚧 |
| CA-5 | `src/lib/market/refresh.ts` (`upsertDiagnostic` del cuerpo compartido) | `tests/spec058-alta-con-precio.test.ts` › «CA-5 … sin cotización, con las cuatro zonas tal como se escribieron y su motivo vigente» | | 🚧 |
| CA-6 | `src/lib/market/refresh.ts` (`try/catch` de SPEC-020 CA-9) | `tests/spec058-alta-con-precio.test.ts` › «CA-6 … un adaptador que LANZA degrada a proveedor_no_disponible, sin motivo nuevo» | | 🚧 |
| CA-7 | `src/lib/market/refresh.ts` (`PRESUPUESTO_REFRESCO_BAJO_DEMANDA_MS`, `conPresupuesto`, `PresupuestoAgotado`) | `tests/spec058-alta-con-precio.test.ts` › los cuatro casos de «CA-7 …»: termina y degrada · el presupuesto declarado acota la espera por los dos lados · inyectable agotado degrada · **por debajo** del presupuesto persiste y no deja diagnóstico | | 🚧 |
| CA-8 | `src/lib/market/refresh.ts` (el fallo no toca `quotes`) | `tests/spec058-alta-con-precio.test.ts` › «CA-8 …» × 3 (fallo clasificado · excepción · presupuesto agotado) | | 🚧 |
| CA-9 | `src/app/vigiladas/actions.ts` (alta persistida ANTES; refresco en su propio `try/catch`) | `tests/spec058-alta-con-precio.test.ts` › «CA-9 … acierta, falla clasificado, lanza o no responde: el alta es indistinguible en los cuatro» | | 🚧 |
| CA-10 | `src/app/vigiladas/actions.ts` · `src/lib/market/refresh.ts` (**no** se toca `src/lib/triggers/` ni notificaciones) | `tests/spec058-el-alta-no-dispara.test.ts` › «cero episodios, cero avisos y cero envíos — y el ciclo siguiente SÍ abre uno y SÍ emite uno» (control positivo en el mismo test) + «… ni un import» | | 🚧 |
| CA-11 | `src/lib/help/content.ts` (`AVISO_LO_EMITE_EL_CICLO`, `CADENCIA` reescrita) · `src/app/vigiladas/page.tsx` | `tests/spec058-rotulo-y-frase.test.ts` › los seis casos de «CA-11 …» · `tests/e2e/spec058-alta-con-precio.spec.ts` › las dos direcciones (fuera de zona no está / en zona aparece) y «/ayuda cuenta lo mismo, y con la misma frase» | | 🚧 |
| CA-12 | `src/lib/market/sin-refrescar.ts` (`cotizacionVigente`) · `refresh.ts` | `tests/spec058-alta-con-precio.test.ts` › «CA-12 …» × 3 (una hora: cero llamadas · sin cotización: sí · sin refrescar: sí) | | 🚧 |
| CA-13 | `src/lib/market/refresh.ts` (la condición mira el DATO, no el gesto) | `tests/spec058-alta-con-precio.test.ts` › «CA-13 …» × 3 (dos altas · `unwatch` + alta · segundo usuario) | | 🚧 |
| CA-14 | `src/lib/market/sin-refrescar.ts` (un solo umbral; `cotizacionVigente` es la negación de `estaSinRefrescar`) | `tests/spec058-alta-con-precio.test.ts` › «CA-14 … la MISMA respuesta» (barrido de antigüedades por los dos caminos reales) y «… no hay zona intermedia» | | 🚧 |
| CA-15 | `src/lib/market/refresh.ts` (`ingerir` compartido; `refreshQuotes` = universo entero, `refreshSymbolOnDemand` = universo de uno) | `tests/spec058-un-solo-camino.test.ts` › los cuatro casos: respuesta buena · fallo clasificado · misma identidad pedida · «el alta no tiene un cuerpo de ingesta propio» | | 🚧 |
| CA-16 | `src/lib/market/refresh.ts` · `src/lib/market/sin-refrescar.ts` (rótulo copiado; RN-16 precisada solo en redacción) | `tests/spec058-rotulo-y-frase.test.ts` › los cinco casos de «CA-16 …» · `tests/reglas-ingenieria.test.ts` y `tests/reglas-ingenieria-hecho-vivo.test.ts` (RN-17 en la serie) | | 🚧 |
| CA-17 | — (no hay código propio: es la propiedad de no-regresión) | Sin guardia congelada, por ADR-031/ADR-037: se verifica en el gate corriendo la batería completa y comparando con `origin/main`. Ejecutado: `npm test` **1936/1936** y Playwright **325/325** | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-25, sdd-verificador.** Los 17 CA verificados sobre el árbol
committeado en `56d3034` (rama `ft/SPEC-058-el-alta-de-una-vigilada-trae-su-precio`,
base `origin/main` en `2797c35`), sin editar una línea de código.

### Gates, literales

| Gate | Resultado |
|---|---|
| `npm run typecheck` | `> tsc --noEmit` — sin salida, **exit 0** |
| `npm run lint` | `> eslint . --max-warnings=0` — sin hallazgos, **exit 0** |
| `npm test` | `Test Files 120 passed (120)` · `Tests 1936 passed (1936)` · `Duration 180.92s` |
| `npx playwright test` | `325 passed (5.3m)` (con `APP_BASE_URL=http://localhost:3200` y build previo) |
| `npm run version:check` | `[check-version-bump] Base: origin/main.` · `[check-version-bump] La version sube de 0.4.2 a 0.5.0.` — **exit 0** |

Los cinco se corrieron **sobre el árbol committeado y limpio** (`git status --porcelain`
vacío antes de empezar), que es la única forma de que `version:check` no dé un verde hueco.

### Los tres sitios donde se apretó, y qué se encontró

1. **La lectura de D-2 se sostiene en el código** (es lo que ADR-038 pto. 1 aprueba y
   lo que hacía verificable esta entrega). El camino del alta **no alcanza** el motor ni
   el canal: no hay import de `@/lib/triggers` ni de `@/lib/notifications` en
   `actions.ts` ni en `refresh.ts`, y el comportamiento se mide con control positivo
   (CA-10). El no-negociable de presentación de D-2 se sigue cumpliendo: el precio bajo
   demanda lleva su `asOf` y la pantalla lo enseña («A fecha 2026-07-14» en las
   capturas). Y no hay endpoint nuevo: el alta usa **el mismo** `provider.getQuotes` que
   el ciclo, por el mismo `ingerir`. `FOUNDATION.md` no se toca.
2. **El cero de CA-10 no está verde por no llegar al motor.** El control positivo corre
   `runRefreshCycle` sobre el mismo estado en el mismo test y exige un episodio, un aviso
   `entry` y correo salido.
3. **CA-15 compara los dos caminos reales entre sí**, no contra literales: `runRefreshCycle`
   y `watchAction`, cada uno sobre su propia PGlite, con `expect(alta.estado).toEqual(ciclo.estado)`.
   Los valores escritos a mano que aparecen después son anclas positivas (para que la
   igualdad no sea «los dos no hicieron nada»), no la comparación.

### Lo que se comprobó de más, por desconfianza

- **Un solo umbral** (CA-12/13/14): `cotizacionVigente` es la negación literal de
  `estaSinRefrescar` y vive en `src/lib/market/sin-refrescar.ts`; `grep` sobre `src/` no
  encuentra ningún `36` ni la aritmética del umbral fuera de ese fichero.
- **Un solo presupuesto** (CA-7): `grep -rn "3_000\|3000" src/` devuelve **una** línea,
  `src/lib/market/refresh.ts:132`.
- **CA-17 no se mecanizó como guardia congelada** (ADR-037): ningún test nuevo enumera
  directorios ni congela recuentos; la propiedad se afirma aquí, en el gate.
- **Ningún `expect` ajeno borrado ni aflojado**: revisado el diff `2797c35..HEAD` fichero
  a fichero sobre `tests/`.
- **CA-3 sin recargar**: comprobado que `tests/e2e/spec058-alta-con-precio.spec.ts` no
  contiene ni un `page.reload()` (un solo `page.goto` al principio del test).

### Las tres salvedades del implementador: revisadas y aceptadas

`F-SPEC-058-1` (el texto «Aún no ha pasado el ciclo» deja de describir el caso común),
`F-SPEC-058-2` (la fecha de la entradilla de `/cartera` es global y no del usuario — es
**anterior** a esta spec, confirmado: `src/app/cartera/page.tsx` no se toca en este diff)
y `F-SPEC-058-3` (la latencia real sigue sin medirse, y así lo aprobó el gate). Ninguna
bloquea un CA; las tres se llevan al humano antes del PR.

**Nota de entorno, no de la rama**: `npm run build` falla en este equipo porque
`.env.production.local` —local, ignorado por git, escrito por `vercel env pull`— trae
`APP_BASE_URL="[SENSITIVE]"`, que es exactamente lo que la guardia de SPEC-055 debe
rechazar. Verificado leyendo el fichero: 13 caracteres, sin esquema. Se construyó y se
corrió el e2e con `APP_BASE_URL=http://localhost:3200`.

## Evidencia visual
| CA | Captura |
|---|---|
| CA-3 (fuera de zona: precio y fecha en la misma respuesta) | `_qa/SPEC-058/ca3-alta-trae-precio-fuera-de-zona.png` |
| CA-3 + CA-11 (en zona: color de fondo y la frase del ciclo) | `_qa/SPEC-058/ca11-en-zona-el-aviso-es-del-ciclo.png` |
| CA-11 (`/ayuda`, sección de cadencia) | `_qa/SPEC-058/ca11-ayuda-cadencia.png` |

Las tres capturas se **regeneraron en la verificación**, corriendo la suite completa de
Playwright sobre el build de `56d3034`: el pie de cada una lleva ese commit, así que la
evidencia visual es del árbol que se juzga y no de un estado intermedio. Las capturas de
otras specs que la suite reescribe por el camino se restauraron (`git checkout -- …`), y
solo se commiteó `_qa/SPEC-058/`.

## Salvedades / follow-ups

- **F-SPEC-058-1 — «Aún no ha pasado el ciclo» se queda casi sin casos por la puerta de
  `/vigiladas`.** Tras esta spec, un alta deja **siempre** o una cotización o un
  diagnóstico, así que el estado *sin precio y sin motivo* —`MOTIVO_SIN_DATOS_AUN` en
  `src/lib/help/content.ts`, y el aviso `sin-datos-aun` de la tabla— solo se alcanza ya
  por símbolos que entran por `/cartera` o por filas anteriores a esta entrega. El texto
  («*Acabas de añadirla y todavía no le ha tocado… se ingiere en el próximo ciclo
  diario*») **sigue siendo cierto para esos casos**, pero ya no describe el común. No se
  toca aquí porque no lo pide ningún CA y `tests/ayuda-contenido.test.ts` lo ancla.
  Destino: **EPIC-MEJORA** (redacción de la ayuda) o la spec que abra la segunda puerta
  del refresco bajo demanda (ADR-038 pto. 8), que es cuando el caso desaparecerá del todo.

- **F-SPEC-058-2 — la fecha de la entradilla de `/cartera` es global, no del usuario.**
  `src/app/cartera/page.tsx` calcula `asOf` como el **máximo `as_of` de toda la tabla
  `quotes`**, no solo de las posiciones de quien mira: dos usuarios con carteras distintas
  leen la misma fecha, y basta con que un símbolo ajeno tenga un `as_of` más reciente para
  que la entradilla lo enseñe. **Es anterior a esta spec** —no lo introduce el refresco
  bajo demanda—, pero sale a la luz al haber un segundo escritor de `quotes`: es lo que
  puso rojo a `tests/e2e/ingesta-cartera.spec.ts`. Destino: **EPIC-FIX**.

- **F-SPEC-058-3 — la latencia real del alta sigue sin medirse.** El presupuesto de 3 s es
  un techo razonado, no un percentil observado, y así lo aprobó el gate del 2026-08-25
  (ADR-038 pto. 5 y Consecuencias). Queda anotado aquí para que la primera medición
  contra la API real no tenga que redescubrir la salvedad. Si molesta, la salida es la
  alternativa (d) de ADR-038 —refrescar en segundo plano— **por otro ADR**, no por parche.

## Cómo retomar (handoff)

**Estado: implementación completa.** Los 16 CA con código llevan su test; CA-17 no lleva
guardia por decisión de la spec. Batería completa en verde: `npm run typecheck`,
`npm run lint`, `npm test` (**1936/1936**) y `npx playwright test` (**325/325**).
`npm run version:check` verde tras el bump a **0.5.0**.

### Lo que hay que saber para tocar esto

- **Un solo cuerpo de ingesta.** `ingerir` (privada, en `src/lib/market/refresh.ts`) es lo
  que comparten el ciclo (`refreshQuotes`, universo entero, **sin** presupuesto) y el alta
  (`refreshSymbolOnDemand`, universo de uno, **con** presupuesto). Un segundo camino
  rompería CA-15 por construcción: su test compara **los dos caminos reales entre sí**.
- **La condición de gasto vive en `sin-refrescar.ts`** (`cotizacionVigente`) y es la
  **negación** de `estaSinRefrescar`, no un umbral propio. CA-14 se pone rojo si divergen.
- **El seam de test del proveedor** es `quoteProvider()` de
  `src/lib/market/quote-provider-factory.ts` — el mismo por el que el e2e mete su catálogo
  con `E2E_FAKE_QUOTES=1`. Los tests de la action lo sustituyen con `vi.mock`.

### Dos cosas del entorno local que cuestan una hora si no se saben

1. **`npm run build` falla en este equipo** con *«APP_BASE_URL no es un origen absoluto
   usable: «[SENSITIVE]»»*. Es `.env.production.local` escrito por `vercel env pull` con
   la variable marcada como *Sensitive*, no un defecto de la rama (el propio mensaje de
   SPEC-055 lo explica). Se construye y se corre el e2e así:
   `APP_BASE_URL=http://localhost:3200 npm run build` y luego
   `APP_BASE_URL=http://localhost:3200 npx playwright test`.
2. **La suite e2e reescribe capturas de `_qa/` que no son de esta spec.** Restaurar lo
   ajeno con `git checkout -- _qa/` y commitear solo `_qa/SPEC-058/`.

### Decisiones tomadas por el camino que conviene que el humano vea

- **La rama llegaba con dos tests en rojo** —`tests/reglas-ingenieria.test.ts` y
  `tests/reglas-ingenieria-hecho-vivo.test.ts`—, porque el arquitecto escribió **RN-17** y
  esas guardias congelan la serie de reglas de dominio. Se han arreglado con el mismo
  criterio con el que SPEC-043 las arregló al nacer RN-16: **RN-17 entra en la lista** y el
  recuento se **ancla al encabezado** (`- **RN-nn** (`) en vez de contar cualquier
  `**RN-nn**`, porque RN-17 **cita** a RN-13 y RN-14 en su cuerpo y la lista salía con tres
  reglas de más. No se afloja nada: las diecisiete siguen teniendo que estar y en su orden.
- **Cuatro tests e2e ajenos necesitaban reconstruir su premisa**, nunca aflojar su
  aserción: `avisos-zona` quería una fila **sin cotización**, `diagnostico-cotizacion` una
  **sin motivo** —dos estados que por esta puerta el producto ya no produce, que es
  justamente CE-2— y `cartera`/`ingesta-cartera` reciben símbolos **ya cotizados** por
  specs anteriores de la suite (ver F-SPEC-058-2). Cada cambio va comentado en su sitio.
- **No hay migración y no hace falta ninguna**, como la spec anticipaba: se escribe en
  `quotes` y `quote_diagnostics` por el mismo camino que el ciclo.
