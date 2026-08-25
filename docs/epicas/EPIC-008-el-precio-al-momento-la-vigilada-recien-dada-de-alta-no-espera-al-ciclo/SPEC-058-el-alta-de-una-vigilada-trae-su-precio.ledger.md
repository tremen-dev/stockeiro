---
id: SPEC-058
tipo: ledger
epica: EPIC-008
---
# Ledger — SPEC-058 El alta de una vigilada trae su precio

## Resumen
- Fase: en-revisión (implementación completa; el veredicto es del verificador)
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

## Evidencia visual
| CA | Captura |
|---|---|
| CA-3 (fuera de zona: precio y fecha en la misma respuesta) | `_qa/SPEC-058/ca3-alta-trae-precio-fuera-de-zona.png` |
| CA-3 + CA-11 (en zona: color de fondo y la frase del ciclo) | `_qa/SPEC-058/ca11-en-zona-el-aviso-es-del-ciclo.png` |
| CA-11 (`/ayuda`, sección de cadencia) | `_qa/SPEC-058/ca11-ayuda-cadencia.png` |

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
