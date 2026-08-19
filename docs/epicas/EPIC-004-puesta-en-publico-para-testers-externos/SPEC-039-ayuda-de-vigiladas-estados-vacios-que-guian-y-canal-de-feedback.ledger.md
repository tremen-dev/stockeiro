---
id: SPEC-039
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-039 Ayuda de vigiladas estados vacios que guian y canal de feedback

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-039-ayuda-estados-vacios-y-feedback`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/auth/guard.ts` (`PUBLIC_PREFIXES` += `/ayuda`), `src/app/ayuda/page.tsx` | `tests/ayuda-rutas-publicas.test.ts` (4 casos: pública, declarada en `PUBLIC_PREFIXES`, `/ayudaX` no, rutas de datos siguen cerradas) · `tests/e2e/ayuda.spec.ts` «CA-1: /ayuda se lee sin sesión» (3) | | 🚧 |
| CA-2 | `src/app/page.tsx`, `src/lib/auth/public-session.ts`, `src/lib/help/content.ts` (`QUE_HACE`, `QUE_NO_HACE`, `CADENCIA_LINEA`) | `tests/e2e/ayuda.spec.ts` «CA-2: la raíz atiende al visitante que llega del foro» (4: explica y da cadencia · los cuatro caminos · los caminos llevan a donde dicen · con sesión sigue al panel) | | 🚧 |
| CA-3 | `src/lib/help/content.ts` (`CADENCIA_LINEA`, una sola constante), `src/app/page.tsx`, `src/app/ayuda/page.tsx`, `src/app/vigiladas/page.tsx` | `tests/ayuda-contenido.test.ts` «CA-3: la cadencia se dice con UNA frase» (2) · `tests/e2e/ayuda.spec.ts` «CA-3: la cadencia se dice en la raíz, en la ayuda y en el estado vacío de Vigiladas» | | 🚧 |
| CA-4 | `src/lib/help/content.ts` (`ZONAS`), `src/app/ayuda/page.tsx` | `tests/ayuda-contenido.test.ts` «CA-4: la zona, como es y no como suena» (4) · `tests/e2e/ayuda.spec.ts` «CA-4: la zona es un rango, es opcional, incluye extremos y la pones tú» | | 🚧 |
| CA-5 | `src/lib/help/content.ts` (`AVISOS`), `src/app/ayuda/page.tsx` | `tests/ayuda-contenido.test.ts` «CA-5: cuándo llega el aviso y de qué tipo» (4) · `tests/e2e/ayuda.spec.ts` «CA-5: entrada vs. permanencia, y la bandeja aunque el correo falle» | | 🚧 |
| CA-6 | `src/lib/help/content.ts` (`MERCADOS` derivado de `OPERATING_MICS` + `marketName`; `MERCADOS_EN_PROSA` escrito a mano), `src/app/ayuda/page.tsx` | `tests/ayuda-contenido.test.ts` «CA-6: los mercados salen del código» (4, incl. la cifra de la prosa contra `OPERATING_MICS.length`) · `tests/e2e/ayuda.spec.ts` «CA-6: los mercados de verdad, con su nombre de dominio y ni uno más» | | 🚧 |
| CA-7 | Texto de `src/lib/help/content.ts` y `src/app/page.tsx` | `tests/ayuda-afirmaciones-prohibidas.ts` (lista cerrada, 9 patrones con motivo + 11 ejemplos que debe cazar + 7 que no) · `tests/ayuda-afirmaciones-prohibidas.test.ts` (22) · `tests/e2e/ayuda.spec.ts` «CA-7» sobre el texto renderizado de `/` y `/ayuda`, pie incluido (4) | | 🚧 |
| CA-8 | `src/lib/help/content.ts` (`EXPLICACION` como `Record<QuoteFailureReason,…>`, `MOTIVO_SIN_DATOS_AUN`, `PRECIOS`), `src/app/ayuda/page.tsx` | `tests/ayuda-contenido.test.ts` «CA-8: sin cotización explicado por todos sus motivos» (4, conjunto comparado con `FAIL_REASON_TEXT`) · `tests/e2e/ayuda.spec.ts` «CA-8: los seis motivos de "sin precio"» | | 🚧 |
| CA-9 | `src/app/vigiladas/page.tsx`, `src/lib/help/content.ts` (`VACIO_VIGILADAS`), `src/app/globals.css` (`.empty-guia`) | `tests/e2e/ayuda.spec.ts` «CA-9: Vigiladas — primer paso, ejemplo con números, cadencia y ayuda» (mide además que el formulario de alta cae dentro de la ventana) | | 🚧 |
| CA-10 | `src/app/avisos/page.tsx`, `src/lib/help/content.ts` (`VACIO_AVISOS`, `VACIO_AVISOS_SIN_VIGILADAS`) | `tests/e2e/ayuda.spec.ts` «CA-10: Avisos — cuándo llegará el primero, y que aún no vigila nada» (incl. contador de no leídos de SPEC-007 intacto) | | 🚧 |
| CA-11 | `src/app/dashboard/page.tsx`, `src/lib/help/content.ts` (`VACIO_PANEL`) | `tests/e2e/ayuda.spec.ts` «CA-11: el Panel de quien acaba de llegar señala UN paso, no tres puertas» (incl. que a un tester se le sigue sin ofrecer Cartera, SPEC-034 CA-9) | | 🚧 |
| CA-12 | `src/app/app-footer.tsx`, `src/lib/feedback/channel.ts`, `src/app/globals.css` (`.app-footer-feedback`) | `tests/feedback-canal.test.ts` «CA-12: el enlace se llama de una sola manera» · `tests/e2e/ayuda.spec.ts` «CA-12» (3: públicas sin sesión · las cuatro autenticadas · el pie de SPEC-035 intacto) | | 🚧 |
| CA-13 | `src/lib/feedback/channel.ts` (`construirMailtoDeFeedback`, `direccionDeFeedback`), `src/app/app-footer.tsx` | `tests/feedback-canal.test.ts` (9 casos: dirección compartida, variable vacía, asunto prefijado, cuerpo con los tres datos, sentinela `unknown`, el mismo dato que `deploymentIdentity`) · `tests/e2e/ayuda.spec.ts` «CA-13: la MISMA versión que responde /api/version» | | 🚧 |
| CA-14 | `src/app/ayuda/page.tsx`, `src/app/page.tsx`, `src/lib/auth/public-session.ts` (edge-safe), `src/lib/help/content.ts` | `tests/ayuda-import-graph.test.ts` (16: grafo transitivo desde las tres entradas, prefijos prohibidos, clientes de BD, pureza de las cuatro fuentes de dominio, solo `base-config`) · `tests/e2e/ayuda.spec.ts` «CA-14» (3: sin recursos ajenos en `/` y `/ayuda`, y sin una sola cookie) | | 🚧 |
| CA-15 | Todo lo anterior | `tests/e2e/ayuda.spec.ts` «CA-15: de la raíz a la primera vigilada, sin ayuda humana» (7 pasos encadenados, un solo test) | | 🚧 |
| CA-16 | `.env.example` (`FEEDBACK_EMAIL` con explicación), `docs/despliegue.md` (§0 tabla + nota + §5 checklist), `src/lib/feedback/channel.ts` | `tests/spec-031-frontera.test.ts` «CA-13.3» (lista cerrada de 10 → 11 claves, más un caso nuevo que fija el número) · `tests/spec-039-frontera.test.ts` (4: explicación en la plantilla, anotación en el runbook, la dirección no se duplica, ninguna otra variable) | | 🚧 |
| CA-17 | — (no degrada) | Suite completa: 1109 unitarios en 81 ficheros + 176 e2e, todos en verde. Geometría de lo nuevo en `tests/e2e/ayuda-responsive.spec.ts` (10 casos a 390/640/700/760/1280 px). SPEC-003, SPEC-007, SPEC-016 y SPEC-029 pasan sin cambios | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-039/. Informe HTML opcional: _qa/SPEC-039/informe.html -->

| CA | Captura |
|---|---|
| CA-1 | `_qa/SPEC-039/ca1-ayuda-sin-sesion.png` |
| CA-2 | `_qa/SPEC-039/ca2-primera-pantalla.png` |
| CA-4 | `_qa/SPEC-039/ca4-ayuda-zonas.png` |
| CA-6 | `_qa/SPEC-039/ca6-ayuda-mercados.png` |
| CA-8 | `_qa/SPEC-039/ca8-ayuda-sin-precio.png` |
| CA-9 | `_qa/SPEC-039/ca9-vigiladas-vacio.png` |
| CA-10 | `_qa/SPEC-039/ca10-avisos-vacio.png` |
| CA-11 | `_qa/SPEC-039/ca11-panel-primer-paso.png` |
| CA-12 | `_qa/SPEC-039/ca12-feedback-en-el-pie.png` |
| CA-15 | `_qa/SPEC-039/ca15-1-panel-recien-llegado.png`, `_qa/SPEC-039/ca15-2-primera-vigilada.png` |
| CA-17 | `_qa/SPEC-039/ancho-{390,640,700,760,1280}-{primera-pantalla,ayuda,vigiladas-vacio}.png` (15) |

## Salvedades / follow-ups
<!-- IDs F-SPEC-039-1, F-SPEC-039-2… con destino (spec futura o EPIC-MEJORA). -->

Los residuales F-SPEC-039-1 a F-SPEC-039-6 los declaró la spec y siguen como allí se
escribieron. Lo que la implementación añade:

- **F-SPEC-039-7 (dominio, para sdd-arquitecto).** La spec pide añadir a
  `docs/fundacion/dominio.md` los términos **Ayuda** y **Canal de feedback**, y **no
  están**. **ADR-025** dice que ese documento lo escribe **sdd-arquitecto en el gate**
  y que la implementación **no escribe ahí nunca**: se levanta el residual y se sigue.
  La UI **no ha inventado rótulos**: «Cómo funciona Stockeiro» para la ayuda y
  «Contar algo o reportar un fallo» para el canal describen la acción, no crean
  sinónimos de un término del glosario. Mismo camino que en SPEC-037.

- **F-SPEC-039-8 (guardia ajena re-encuadrada, no aflojada).**
  `tests/e2e/admin-grifo.spec.ts` (SPEC-037 CA-10/CA-24) comprobaba que un `tester`
  rebotado de `/admin` no recibiera ninguna de **seis** subcadenas de la pantalla de
  operación. Una de ellas, **«el ciclo diario»**, ha dejado de ser exclusiva: CA-3 se
  la dice ahora al propio usuario en el panel de recién llegado («…a medida que **el
  ciclo diario** tenga algo que contarte»), donde no delata ninguna fuga.
  - **Qué vigilaba antes**: que ninguna de las seis frases apareciera en el cuerpo,
    más la ausencia de los bloques `grifo` y `contadores` por `data-testid`.
  - **Qué vigila ahora**: las **cinco** frases que sí son exclusivas de `/admin`
    («símbolos en el ciclo», «símbolos sin precio», «aceptar altas nuevas», «cupo de
    cuentas», «última ejecución registrada») **más** el bloque del ciclo comprobado
    como bloque: que «el ciclo diario» **no aparezca como encabezado** (`h1/h2/h3`) y
    que los **tres** `data-testid` de la pantalla (`grifo`, `contadores`,
    `ultimo-ciclo` — antes solo dos) no estén.
  - La propiedad —*un tester no recibe ni un dato de operación*— queda igual de
    cerrada, y con un bloque más vigilado que antes.

- **F-SPEC-039-9 (residual asumido, sesión en la raíz).** `tieneSesion()`
  (`src/lib/auth/public-session.ts`) **no** revalida la época de credencial contra la
  base: es edge-safe a propósito, para que `/` responda con la base caída (CA-14). Una
  cookie emitida antes de un cambio de contraseña decodifica igual, así que su
  portador sería mandado al panel y el panel lo devolvería a `/login`. **No es un
  agujero**: es un rebote de más, y el mismo que da hoy la raíz, que redirige siempre.
  Los datos los siguen guardando `requireUser` y el middleware (ADR-016). Se anota por
  si alguien se plantea reutilizar esa función como guardia — no lo es, y lo dice su
  cabecera.

- **F-SPEC-039-10 (visto y NO tocado).** El pie tiene ahora tres bloques de contenido
  y la marca; **SPEC-038 le añadirá la versión** y la fila que enseñe será el mismo
  dato que ya viaja en el `mailto:`. No se ha adelantado nada de eso: ni `package.json`,
  ni `next.config.mjs`, ni semver.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Todo lo especificado está implementado y probado; la spec queda en `en-revision`.**
Rama `ft/SPEC-039-ayuda-estados-vacios-y-feedback`, cuatro commits sobre `origin/main`:

1. `f4ba32a` — la ayuda pública, y lo que cuenta sale del código (CA-1, 3-8).
2. `58437d1` — la primera pantalla, y estados vacíos que señalan un paso (CA-2, 9-11, 14).
3. `dcfd39f` — el canal de feedback, con la versión del despliegue puesta (CA-12, 13, 16).
4. `7d80093` — el recorrido de CE-1 en el navegador, y las pantallas medidas (CA-15, 17).

**Los cinco gates en verde** (salida literal en el informe del implementador):
`typecheck`, `lint`, `test` (1109 en 81 ficheros), `test:e2e` (176) y `build`.
`db:scan` también, sin migraciones nuevas — esta spec **no toca el esquema**.

### Lo que conviene saber antes de tocar esto

- **Dónde vive el texto.** Todo el contenido de la ayuda, de la primera pantalla y de
  los tres estados vacíos está en `src/lib/help/content.ts`. Las páginas solo lo
  pintan. La cadencia es **una sola constante** (`CADENCIA_LINEA`) que se repite
  literalmente en tres pantallas: si se edita, se editan las tres a la vez, que es el
  punto de CA-3.
- **Dos cosas se derivan del código y romperán builds futuros a propósito**
  (F-SPEC-039-3): la lista de mercados (`OPERATING_MICS` + `marketName`) y los motivos
  de «sin precio» (`Record<QuoteFailureReason,…>`, que no compila si falta uno). La
  cifra que la prosa escribe a mano —«siete mercados»— se compara con
  `OPERATING_MICS.length`: quien añada el octavo se entera en su PR.
- **La guardia de afirmaciones prohibidas** (`tests/ayuda-afirmaciones-prohibidas.ts`)
  prohíbe la **afirmación**, no la palabra: una raíz prohibida solo cuenta si no viene
  negada en su propia frase (ventana de 60 caracteres que no cruza `.`/`;`/`:`). Es la
  diferencia con SPEC-035, donde la palabra sobraba; aquí la spec **exige** escribir
  «esto no es tiempo real». Antes de juzgar la ayuda, la guardia se ejercita contra
  once frases que tiene que cazar y siete que no puede tocar. Si añades un patrón,
  añade sus dos ejemplos.
- **El cupo del e2e.** Esta spec da de alta **dos** cuentas (`spec039-guia@example.com`,
  reutilizada en ocho pruebas y mantenida siempre vacía; y
  `spec039-recorrido@example.com`, exclusiva de CA-15). Los ficheros ordenan después de
  `admin-*`, que deja el grifo abierto y **sin tope** al terminar.
- **Medidas responsive.** `tests/e2e/ayuda-responsive.spec.ts` resta el `padding`
  propio de cada caja antes de compararla con su contenido, y por eso su holgura es de
  **12 px** y no los 60 de SPEC-037. Las cifras se imprimen en el registro.
- **Los PNG de `_qa/`** de otras specs se regeneraron al correr la suite y se
  restauraron con `git checkout -- _qa/` antes de commitear. Solo entra `_qa/SPEC-039/`.
