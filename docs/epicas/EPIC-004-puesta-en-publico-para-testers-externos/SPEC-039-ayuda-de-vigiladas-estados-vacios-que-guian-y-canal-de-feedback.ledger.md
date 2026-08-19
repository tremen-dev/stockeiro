---
id: SPEC-039
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-039 Ayuda de vigiladas estados vacios que guian y canal de feedback

## Resumen
- Fase: hecho <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-039-ayuda-estados-vacios-y-feedback`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/auth/guard.ts` (`PUBLIC_PREFIXES` += `/ayuda`), `src/app/ayuda/page.tsx` | `tests/ayuda-rutas-publicas.test.ts` (4 casos: pública, declarada en `PUBLIC_PREFIXES`, `/ayudaX` no, rutas de datos siguen cerradas) · `tests/e2e/ayuda.spec.ts` «CA-1: /ayuda se lee sin sesión» (3) | Navegador anonimo contra la app corriendo: `/ayuda` **200** y se lee entera, sin rebote; `/ayudaX` -> `/login`; `/vigiladas`, `/avisos`, `/dashboard`, `/cuenta`, `/admin` y `/cartera` -> `/login`. `isPublicPath` empareja por segmento completo, leido en `guard.ts` | ✅ |
| CA-2 | `src/app/page.tsx`, `src/lib/auth/public-session.ts`, `src/lib/help/content.ts` (`QUE_HACE`, `QUE_NO_HACE`, `CADENCIA_LINEA`) | `tests/e2e/ayuda.spec.ts` «CA-2: la raíz atiende al visitante que llega del foro» (4: explica y da cadencia · los cuatro caminos · los caminos llevan a donde dicen · con sesión sigue al panel) | Anonimo en `/`: lee `QUE_HACE`, `CADENCIA_LINEA` y `QUE_NO_HACE`, y los cuatro caminos (Crear cuenta, Entrar, `/ayuda`, `/legal`) pinchados uno a uno. **Con** cookie de sesion, `/` -> `/dashboard`. Y ni una cookie estampada al anonimo (ver CA-14) | ✅ |
| CA-3 | `src/lib/help/content.ts` (`CADENCIA_LINEA`, una sola constante), `src/app/page.tsx`, `src/app/ayuda/page.tsx`, `src/app/vigiladas/page.tsx` | `tests/ayuda-contenido.test.ts` «CA-3: la cadencia se dice con UNA frase» (2) · `tests/e2e/ayuda.spec.ts` «CA-3: la cadencia se dice en la raíz, en la ayuda y en el estado vacío de Vigiladas» | Extraido el texto **renderizado** de las tres pantallas: la frase de `CADENCIA_LINEA` aparece literal e identica en `/`, en `/ayuda` (seccion cadencia) y en el estado vacio de `/vigiladas` | ✅ |
| CA-4 | `src/lib/help/content.ts` (`ZONAS`), `src/app/ayuda/page.tsx` | `tests/ayuda-contenido.test.ts` «CA-4: la zona, como es y no como suena» (4) · `tests/e2e/ayuda.spec.ts` «CA-4: la zona es un rango, es opcional, incluye extremos y la pones tú» | Contrastado contra el motor, no contra la prosa: `entraEnZona` usa `gte`/`lte` (extremos dentro, RN-11); `validatePair` (`watchlist/service.ts`) exige min <= max y **ambos o ninguno** por etiqueta, y **no** cruza compra con venta — que es justo lo que la ayuda dice | ✅ |
| CA-5 | `src/lib/help/content.ts` (`AVISOS`), `src/app/ayuda/page.tsx` | `tests/ayuda-contenido.test.ts` «CA-5: cuándo llega el aviso y de qué tipo» (4) · `tests/e2e/ayuda.spec.ts` «CA-5: entrada vs. permanencia, y la bandeja aunque el correo falle» | Contrastado contra el esquema: `notif_entry_trigger` unico por `zoneTriggerId` (uno por episodio) y `notif_digest_cycle` unico por (`userId`,`cycleRef`) — con un solo ciclo al dia, «uno al dia por persona» es cierto. El motor es *edge-triggered*, asi que «sale y vuelve a entrar -> avisa otra vez» tambien. Y `/avisos` **si** marca el fallo: `status === 'failed'` -> «envio por email fallo» | ✅ |
| CA-6 | `src/lib/help/content.ts` (`MERCADOS` derivado de `OPERATING_MICS` + `marketName`; `MERCADOS_EN_PROSA` escrito a mano), `src/app/ayuda/page.tsx` | `tests/ayuda-contenido.test.ts` «CA-6: los mercados salen del código» (4, incl. la cifra de la prosa contra `OPERATING_MICS.length`) · `tests/e2e/ayuda.spec.ts` «CA-6: los mercados de verdad, con su nombre de dominio y ni uno más» | `/ayuda` renderiza **7** mercados con los nombres exactos de `MARKET_NAME` sobre `OPERATING_MICS`, en su orden. La prosa dice «siete» y `MERCADOS_EN_PROSA.cifra` se compara con `OPERATING_MICS.length`. «El buscador no te lo ofrece» contrastado con `twelve-data-search-provider.ts`: lo que no normaliza a operating MIC va a `discarded` (ADR-020, SPEC-029) | ✅ |
| CA-7 | Texto de `src/lib/help/content.ts` y `src/app/page.tsx` | `tests/ayuda-afirmaciones-prohibidas.ts` (lista cerrada, 9 patrones con motivo + 11 ejemplos que debe cazar + 7 que no) · `tests/ayuda-afirmaciones-prohibidas.test.ts` (22) · `tests/e2e/ayuda.spec.ts` «CA-7» sobre el texto renderizado de `/` y `/ayuda`, pie incluido (4) | **Barrido propio** (regex de raiz, SIN la regla de negacion del implementador) sobre el texto renderizado de `/`, `/ayuda`, `/vigiladas`, `/avisos` y `/dashboard`, pie incluido: 24 apariciones de raices peligrosas, **las 24 negadas en su propia frase**. Cero afirmaciones de tiempo real, intradia, instantaneidad, ejecucion de ordenes, broker, recomendacion o garantia | ✅ |
| CA-8 | `src/lib/help/content.ts` (`EXPLICACION` como `Record<QuoteFailureReason,…>`, `MOTIVO_SIN_DATOS_AUN`, `PRECIOS`), `src/app/ayuda/page.tsx` | `tests/ayuda-contenido.test.ts` «CA-8: sin cotización explicado por todos sus motivos» (4, conjunto comparado con `FAIL_REASON_TEXT`) · `tests/e2e/ayuda.spec.ts` «CA-8: los seis motivos de "sin precio"» | Los seis motivos renderizados = las 5 claves de `FAIL_REASON_TEXT` + `aun_sin_datos`. `EXPLICACION` es `Record<QuoteFailureReason,...>`: un motivo nuevo sin explicar **no compila**. Y lo confirme en la app: mi primera vigilada mostro «Aun sin datos: se ingiere en el proximo ciclo diario», el sexto caso de la ayuda | ✅ |
| CA-9 | `src/app/vigiladas/page.tsx`, `src/lib/help/content.ts` (`VACIO_VIGILADAS`), `src/app/globals.css` (`.empty-guia`) | `tests/e2e/ayuda.spec.ts` «CA-9: Vigiladas — primer paso, ejemplo con números, cadencia y ayuda» (mide además que el formulario de alta cae dentro de la ventana) | Cuenta recien creada por mi: el vacio lleva primer paso, ejemplo con numeros (Inditex 20-25 EUR), la cadencia y el enlace a `/ayuda`. El formulario de alta va **inmediatamente debajo** y cae dentro de la ventana sin scroll a 640/700/760/1280 px (top medido 700-710 con vh 800). A 390 px hay que bajar: residual V-SPEC-039-1 | ✅ |
| CA-10 | `src/app/avisos/page.tsx`, `src/lib/help/content.ts` (`VACIO_AVISOS`, `VACIO_AVISOS_SIN_VIGILADAS`) | `tests/e2e/ayuda.spec.ts` «CA-10: Avisos — cuándo llegará el primero, y que aún no vigila nada» (incl. contador de no leídos de SPEC-007 intacto) | Verificado en la app con las **dos** ramas: sin vigiladas sale `avisos-vacio-sin-vigiladas` con enlace a `/vigiladas`; con vigiladas, la otra. Cadencia y enlace a `/ayuda` presentes. Sin avisos no hay contador de no leidos, y la bandeja llena sigue siendo la de SPEC-007 (`listNotificationsForUser` intacto) | ✅ |
| CA-11 | `src/app/dashboard/page.tsx`, `src/lib/help/content.ts` (`VACIO_PANEL`) | `tests/e2e/ayuda.spec.ts` «CA-11: el Panel de quien acaba de llegar señala UN paso, no tres puertas» (incl. que a un tester se le sigue sin ofrecer Cartera, SPEC-034 CA-9) | Panel de mi cuenta recien creada: bloque `panel-primer-paso` con **un** enlace de accion (`/vigiladas`) y la ayuda al lado. `main a[href="/cartera"]` = 0: a un `tester` no se le ofrece ninguna puerta que su rol no abra (SPEC-034 CA-9 intacta) | ✅ |
| CA-12 | `src/app/app-footer.tsx`, `src/lib/feedback/channel.ts`, `src/app/globals.css` (`.app-footer-feedback`) | `tests/feedback-canal.test.ts` «CA-12: el enlace se llama de una sola manera» · `tests/e2e/ayuda.spec.ts` «CA-12» (3: públicas sin sesión · las cuatro autenticadas · el pie de SPEC-035 intacto) | Enlace `feedback-enlace` presente y con `mailto:` valido en **ocho** pantallas: `/dashboard`, `/vigiladas`, `/avisos`, `/cuenta`, `/ayuda`, `/login`, `/register` y `/legal`. Vive en el pie del layout raiz, asi que esta a un clic desde cualquier sitio; la etiqueta es una sola (`ETIQUETA_FEEDBACK`) | ✅ |
| CA-13 | `src/lib/feedback/channel.ts` (`construirMailtoDeFeedback`, `direccionDeFeedback`), `src/app/app-footer.tsx` | `tests/feedback-canal.test.ts` (9 casos: dirección compartida, variable vacía, asunto prefijado, cuerpo con los tres datos, sentinela `unknown`, el mismo dato que `deploymentIdentity`) · `tests/e2e/ayuda.spec.ts` «CA-13: la MISMA versión que responde /api/version» | Comparado dato a dato contra la app: el `mailto:` lleva `subject=[Stockeiro 2ee12b91c6...]` y el cuerpo repite commit/entorno/construido; `/api/version` responde `{"commit":"2ee12b91c6...","environment":"unknown","builtAt":"2026-08-19T22:54:05.087Z"}` — **identicos** | ✅ |
| CA-14 | `src/app/ayuda/page.tsx`, `src/app/page.tsx`, `src/lib/auth/public-session.ts` (edge-safe), `src/lib/help/content.ts` | `tests/ayuda-import-graph.test.ts` (16: grafo transitivo desde las tres entradas, prefijos prohibidos, clientes de BD, pureza de las cuatro fuentes de dominio, solo `base-config`) · `tests/e2e/ayuda.spec.ts` «CA-14» (3: sin recursos ajenos en `/` y `/ayuda`, y sin una sola cookie) | Intercepcion de red propia: `/` y `/ayuda` hacen **0** peticiones fuera de su origen y dejan **0** cookies en un navegador anonimo. Y con la base **matada de verdad** (proceso de Postgres terminado): `/` **200**, `/ayuda` **200** con su contenido completo, `/api/version` **200** — mientras `/register` daba **500**, que es la prueba de que la base estaba caida | ✅ |
| CA-15 | Todo lo anterior | `tests/e2e/ayuda.spec.ts` «CA-15: de la raíz a la primera vigilada, sin ayuda humana» (7 pasos encadenados, un solo test) | **Lo recorri yo**, anonimo y sin nada del proyecto: `/` -> «Como funciona, con detalle» -> `/ayuda` -> «creala aqui» -> alta con email y contrasena -> `/dashboard` con su primer paso -> «Vigilar mi primera accion» -> buscar «ITX» -> elegir Inditex (BME) -> zona 20/25 -> **Vigilar**. La fila aparecio con su zona `20 - 25`. Sin salir de la app y sin una sola instruccion externa | ✅ |
| CA-16 | `.env.example` (`FEEDBACK_EMAIL` con explicación), `docs/despliegue.md` (§0 tabla + nota + §5 checklist), `src/lib/feedback/channel.ts` | `tests/spec-031-frontera.test.ts` «CA-13.3» (lista cerrada de 10 → 11 claves, más un caso nuevo que fija el número) · `tests/spec-039-frontera.test.ts` (4: explicación en la plantilla, anotación en el runbook, la dirección no se duplica, ninguna otra variable) | Contadas las claves de `.env.example` yo mismo: **once**, y la nueva es `FEEDBACK_EMAIL` y solo esa, con explicacion de varias lineas. Runbook: fila en la tabla de la seccion 0, nota propia y punto de checklist en la 5. `hola@tremen.dev` aparece **una unica vez** en todo `src/` (`legal/content.ts:40`); el canal la lee de `TITULAR.contacto`. `STOCKEIRO_COMMIT/ENVIRONMENT/BUILT_AT` siguen sin aparecer | ✅ |
| CA-17 | — (no degrada) | Suite completa: 1109 unitarios en 81 ficheros + 176 e2e, todos en verde. Geometría de lo nuevo en `tests/e2e/ayuda-responsive.spec.ts` (10 casos a 390/640/700/760/1280 px). SPEC-003, SPEC-007, SPEC-016 y SPEC-029 pasan sin cambios | Los **seis** gates corridos por mi, todos verdes: `typecheck`, `lint`, `test` (**1109** en **81** ficheros), `test:e2e` (**176**), `build` y `db:scan`. SPEC-003 (alta y rango invalido), SPEC-007 (color de zona y bandeja), SPEC-016 (motivos) y SPEC-029 (tipo y mercado) pasan sin cambios. `vercel.json` y `tests/version-import-graph.test.ts` intactos; el unico test ajeno tocado es `admin-grifo.spec.ts` (ver veredicto) | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-20 — 17/17 CA cerrados.**

Esta spec no entrega un mecanismo: entrega **afirmaciones**. Por eso la verificación no ha
sido comprobar que las páginas existan sino **leerlas y contrastar cada frase contra el
código y las decisiones**. No he encontrado ni una que prometa de más.

### Auditoría de veracidad de la ayuda, afirmación por afirmación

| Lo que dice la app | Contra qué lo contrasté | ¿Cierto? |
|---|---|---|
| «se refrescan una vez al día, después del cierre de mercado» | `vercel.json`: un solo cron `0 22 * * *`; ADR-004 pto. 1 | sí — 22:00 UTC es posterior al cierre de los 7 mercados |
| «Hay un solo ciclo diario: se piden los precios, se comparan con las zonas y se emiten los avisos» | `runCronCycle` tras `/api/cron/refresh` (ingesta + disparos + envío) | sí |
| «un valor que entra a media sesión y sale antes del cierre puede no aparecer» | RN-12 + `evaluateTriggers` sobre el precio del ciclo | sí, y decirlo es el punto entero |
| «cada precio lleva al lado la fecha» | columna `A FECHA` de `/vigiladas` (`r.asOf`) | sí |
| «el mínimo no puede ser mayor que el máximo» | `validatePair` → `InvalidZoneError` | sí |
| «compra y venta, las dos o ninguna; tampoco se exige que compra esté por debajo de venta» | `validatePair` valida cada par por separado y **no** los cruza | sí |
| «se entra con los extremos incluidos: 20 en 20–25 está dentro» | `entraEnZona` → `gte` / `lte` | sí |
| «las zonas las pones tú; no las calcula, no las sugiere, no las recomienda» | D-4 *locked*; no hay nada en `src/` que derive zonas | sí |
| «el aviso de entrada no se repite mientras siga dentro; si sale y vuelve, avisa otra vez» | motor *edge-triggered* + `unique(notif_entry_trigger)` | sí |
| «el de permanencia es uno al día por persona» | `unique(userId, cycleRef)` + un solo ciclo diario | sí |
| «todo aviso queda en la bandeja aunque el correo falle, **y la bandeja lo marca**» | `notifications.status` + `/avisos` pinta «envío por email falló» | sí, incluido el «lo marca» |
| «último precio de cierre no ajustado, con su fecha» | RN-12 y ADR-004 pto. 2 | sí |
| «estos siete mercados y solo estos» + los 7 nombres | `OPERATING_MICS` × `MARKET_NAME` | sí, exactos y en orden |
| «si cotiza en otra plaza, el buscador no te lo ofrece» | `toOperatingMic`: lo que no casa va a `discarded` (ADR-020, SPEC-029) | sí — y además lo dice, no lo calla |
| «si ves uno, es uno de estos seis» | 5 claves de `FAIL_REASON_TEXT` + `aun_sin_datos`, que es lo que `/vigiladas` muestra de verdad | sí |
| «no ejecuta órdenes, no está conectada a ningún bróker» | D-1 *locked* | sí |

**Y por el otro lado**: barrido propio de raíces prohibidas —sin usar la guardia del
implementador— sobre el texto **renderizado** de `/`, `/ayuda`, `/vigiladas`, `/avisos` y
`/dashboard`. 24 apariciones de raíces peligrosas, **las 24 negadas dentro de su propia
frase**. Cero promesas de tiempo real.

### El recorrido de CE-1, hecho por mí

Anonimo y sin saber nada del proyecto: raíz → ayuda → registro → panel → primera vigilada de
Inditex con zona 20–25. **No dudé en ningún punto**: la primera pantalla dice qué es y con
qué cadencia antes de pedir el email, la ayuda contesta «qué es una zona» antes de que
haya que rellenar una, y el panel señala un solo paso con su botón. Se puede sin ayuda
externa.

### Las guardias que cambiaron

- **`tests/e2e/admin-grifo.spec.ts`: evolución legítima y neta más estricta, no aflojada.**
  *Antes*: 6 subcadenas ausentes del cuerpo + ausencia de **2** `data-testid`. *Ahora*: 5
  subcadenas —cae «el ciclo diario», que dejó de ser exclusiva de `/admin` porque CA-3 se
  la dice al propio usuario en el panel— **más** la ausencia del **encabezado**
  `h1/h2/h3` «el ciclo diario» **más** la ausencia de **3** `data-testid` (entra
  `ultimo-ciclo`). Comprobado en `src/app/admin/page.tsx`: la frase vive **solo** en el
  `<h2>` de la `<section data-testid="ultimo-ciclo">`, así que el bloque no puede filtrarse
  sin que salte el testid. La propiedad —*un tester no recibe ni un dato de operación*—
  queda igual de cerrada, con un bloque más vigilado que antes.
- **`tests/spec-031-frontera.test.ts`: no relaja nada de `/api/version`.** El cambio es
  **solo** la lista de claves de `.env.example` (10 → 11) y un caso nuevo que fija el
  número. La garantía de que `/api/version` responde con la base caída no vive en ese
  fichero, y la comprobé a mano matando Postgres: `/api/version` **200** mientras
  `/register` daba **500**. `vercel.json` y `tests/version-import-graph.test.ts`, intactos.

### Los PNG de `_qa/`

`git diff --name-only origin/main...HEAD -- _qa` devuelve **26 ficheros, los 26 bajo
`_qa/SPEC-039/`**. Ni uno de otra spec. Limpio. (Tras correr yo la suite volví a dejar
`_qa/` como estaba.)

### Las dos filas nuevas del glosario (ADR-025)

Existen y **dicen la verdad**, comprobado afirmación por afirmación contra el código: la
derivación de mercados y motivos, el `Record` total que no compila si falta un motivo, la
cifra en prosa atada a `OPERATING_MICS.length`, la única constante de cadencia repetida en
tres pantallas, la lista cerrada de afirmaciones prohibidas, la dirección leída de
`TITULAR.contacto` y la clave única de entorno. **Una sola imprecisión**, anotada abajo
como V-SPEC-039-4.

### Gates (los seis, corridos por mí)

`typecheck` 0 · `lint` 0 · `test` **1109 en 81 ficheros** · `test:e2e` **176** · `build` 0 ·
`db:scan` (11 migraciones, 2 con SQL destructivo ya desbloqueadas por escrito). Salida
literal en el informe de verificación.

### Geometría a 390 / 640 / 700 / 760 / 1280 px

`/` y `/ayuda` sin desborde a ninguno de los cinco anchos; `/dashboard`, `/avisos` y
`/vigiladas` **vacías**, tampoco. Los tres defectos de maquetación que sí encontré son de
pantallas y componentes que **esta spec no toca** y ya estaban en `origin/main`: probado
por doble vía —el CSS y los componentes implicados son idénticos a `origin/main` (mismas
líneas, mismo contenido; esta spec solo añade CSS al final del fichero), y quitando del DOM
el bloque entero que esta spec añade el defecto sigue exactamente igual—. Van abajo como
residuales para EPIC-FIX.

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

**Nota del verificador (2026-08-20).** Las 26 capturas existen y ninguna es de otra spec.
Cuatro de ellas —`ca1-ayuda-sin-sesion.png`, `ca4-ayuda-zonas.png`, `ca6-ayuda-mercados.png`
y `ca8-ayuda-sin-precio.png`— son **el mismo fichero byte a byte** (md5
`b2f671aa8c93b3e568990f41249671f5`): es honesto, porque `/ayuda` es una sola página y la
captura es `fullPage`, pero el mapa sugiere cuatro pruebas distintas donde hay una. No
invalida nada; se anota para que nadie la lea como cuatro evidencias.

Mis propias capturas y medidas se tomaron contra la app corriendo (`tests/e2e/server.mjs`
sobre Postgres efimero) y no se versionan: lo que queda escrito es la medida, que es lo
comprobable.

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

### Residuales que levanta el verificador (2026-08-20)

Ninguno bloquea publicar. Los tres primeros **ya estaban en `origin/main`** y no los
introduce esta spec —probado por doble vía: CSS y componentes idénticos a `origin/main`, y
el defecto persiste al quitar del DOM el bloque entero que esta spec añade—, pero los
encontré recorriendo CE-1 y caen justo encima del camino que esta épica quiere que un
desconocido complete, así que se anotan con su medida.

- **V-SPEC-039-1 (maquetación, EPIC-FIX; preexistente).** A **390 px**, en `/vigiladas`, el
  formulario de alta se **recorta por la derecha**: `.symbol-picker` y
  `.symbol-search-input` miden **444 px** dentro de una columna de **350 px**, y
  `body { overflow-x: hidden }` los corta en vez de dejarlos desplazar. En pantalla se ve
  el campo de búsqueda, los «max» de las dos zonas y el botón **Vigilar** cortados. Es el
  paso decisivo de CE-1 en un móvil. Origen: `.symbol-picker` /
  `.symbol-search-input` (SPEC-008), idénticos a `origin/main` (mismas líneas 338 y 351 de
  `globals.css`); al borrar del DOM el `.empty` completo de esta spec la medida no cambia.
- **V-SPEC-039-2 (maquetación, EPIC-FIX; preexistente).** `.cards`
  (`design/tremen-ds/components/cards.css:15`) es `grid-template-columns: repeat(3, 1fr)`
  **sin ninguna variante responsive**. A 390 px el panel de un `tester` reparte sus dos
  tarjetas en columnas de ~110 px y los títulos se parten letra a letra
  («Ac / cio / ne / s»). Es la segunda pantalla que ve un tester recién registrado. El
  directorio `design/` **no lo toca esta rama**.
- **V-SPEC-039-3 (maquetación, EPIC-FIX; preexistente).** Con al menos una fila en la
  tabla, `/vigiladas` **desplaza la página en horizontal** entre ~721 y ~800 px de ancho
  (medido a 760: `scrollWidth` 819 sobre `clientWidth` 760). Causa: `.table-scroll {
  overflow-x: auto }` vive dentro de `@media (max-width: 720px)`, así que por encima de
  720 px no hay contenedor que absorba la tabla. Regla idéntica en `origin/main`
  (`globals.css:330`).
- **V-SPEC-039-4 (documentación, para sdd-arquitecto).** La fila **Canal de feedback** de
  `docs/fundacion/dominio.md` dice que `deploymentIdentity` es *«la misma fuente que
  responde `/api/version` y que **enseña el pie**»*. Hoy el pie **no enseña la versión**:
  la consume para componer el `mailto:`, pero no la pinta —eso lo trae SPEC-038, que no ha
  entrado (F-SPEC-039-10 lo dice bien)—. La frase está escrita en presente y describe un
  futuro. Todo lo demás de las dos filas nuevas es cierto.
- **V-SPEC-039-5 (documentación, para sdd-documentalista).** **F-SPEC-039-6 sigue escrito
  en la spec como abierto** (*«El buzón `hola@tremen.dev` todavía no existe»*) y este ledger
  dice que los residuales 1 a 6 *«siguen como allí se escribieron»*, mientras
  `docs/fundacion/dominio.md` —mismo commit `2ee12b9`— declara que el buzón **existe desde
  el 2026-08-19** y que el residual está **cerrado**. Los dos documentos de verdad se
  contradicen. Confirmado con el humano que el buzón existe: lo que falta es que la spec lo
  refleje.
- **V-SPEC-039-6 (guardia con punto ciego, informativo).**
  `tests/e2e/ayuda-responsive.spec.ts` mide el desborde como
  `document.scrollWidth - clientWidth`. Como `body` lleva `overflow-x: hidden`, un hijo que
  se sale **se recorta sin mover ese número**: por eso la suite está verde y V-SPEC-039-1
  existe. Para la próxima guardia de geometría conviene medir también
  `getBoundingClientRect().right > innerWidth` elemento a elemento, que es como lo encontré.
- **V-SPEC-039-7 (coste, informativo).** `/dashboard` ejecuta ahora `listWatched` en
  **todas** las visitas para decidir si es un recién llegado; el segundo consulta
  (`listNotificationsForUser`) sí hace cortocircuito. `/avisos` lo hace mejor: solo consulta
  cuando la bandeja está vacía. No es un defecto de CA con veinte testers; se anota por si
  el panel crece.
- **V-SPEC-039-8 (promesa de la spec, ya con destino).** La última frase de CA-13
  —*«si SPEC-038 ya está entregada, el prefijo incluirá el semver sin ningún cambio
  aquí»*— es **falsa**: `construirMailtoDeFeedback` lee `identidad.commit`, no un campo
  genérico. **No afecta al veredicto**: lo verificable de CA-13 hoy —que el asunto lleve la
  identidad del despliegue y que sea exactamente la de `/api/version`— se cumple, y el
  arquitecto ya lo declaró y lo asignó en **F-SPEC-038-7**. Se apunta aquí para que quien
  cierre SPEC-038 no lo pierda de vista.

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
