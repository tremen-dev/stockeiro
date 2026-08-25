---
id: SPEC-056
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-056 Los tres correos: diseño propio, la marca en cabecera y pie, y el texto plano como alternativa

## Resumen
- Fase: `en-revision` — **implementada** por sdd-implementador el **2026-08-25** sobre la rama
  de su worktree. Antes, `borrador` — escrita por sdd-arquitecto el **2026-08-25**. Ese mismo día el humano (Alberto
  Fojo) **resolvió en el gate las seis decisiones abiertas**, y sdd-arquitecto las dejó escritas en la
  spec (§Notas para el gate, ahora con su resolución al lado; D-11; CA-19 y CA-20), y el orquestador
  registró la aprobación. La implementación la movió a `en-progreso` al empezar y a `en-revision` al
  terminar, las dos con `estado.mjs`.
- Rama: `ft/SPEC-056-los-tres-correos-diseno-marca-y-texto-plano`, desde `origin/main` en `825046f`
  (renombrada por el orquestador; el slug original era `ft/SPEC-056-plantillas-de-correo`).
- ADR que la acompaña: **ADR-036** (`docs/adr/ADR-036-el-correo-lleva-dos-cuerpos-…-enmienda-a-adr-006.md`).
  **La spec no se puede implementar sin él**: CA-1 y CA-2 son literalmente su decisión, y así se ha
  implementado. **Aviso para el orquestador**: el fichero del ADR sigue con `estado: borrador` en su
  frontmatter, mientras que la spec que lo estrena está aprobada y entregada. La implementación **no
  toca documentos de verdad**, así que esa transición queda pendiente de quien la firma — igual que se
  hizo con ADR-034 y ADR-035 en SPEC-054 (`d32a4dc`).
- Ids verificados contra `origin/main` y contra todas las ramas locales y remotas: **SPEC-056** libre
  (054 mergeada; 055 y 052 en vuelo en otras sesiones) y **ADR-036** libre (último en `main`: ADR-035).
  El scaffold propuso `SPEC-055` porque este worktree no ve las ramas en vuelo; renombrado a mano.
- Versión: **PATCH, entregada como `0.4.2`** (ADR-024 D; ADR-033 para los dos ficheros). Se subió
  **dos veces**, y conviene que quede escrito: la primera a `0.4.1`, que era el PATCH correcto sobre
  la base de la rama (`825046f`, `0.4.0`); mientras tanto **SPEC-055 mergeó** y dejó `origin/main`
  en `497eccf` con `0.4.1`, así que aquella subida dejó de serlo y hubo que ir a `0.4.2`.
  `npm run version:check` se ejecutó **tras commitear** (SPEC-049) y dijo:
  `[check-version-bump] La version sube de 0.4.1 a 0.4.2.`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (el puerto admite dos cuerpos) | `src/lib/notifications/sender.ts` — `html?: string` | `tests/spec056-puerto-y-remitente.test.ts` › CA-1 (4 casos) + el `@ts-expect-error` que ejerce `npm run typecheck` | `npm run typecheck` verde. Mutación `body?: string` en `sender.ts` → **7 errores de tsc**, incluido `Unused '@ts-expect-error'` en `tests/spec056-puerto-y-remitente.test.ts:63`. `fake-sender.ts` y `outbox-file-sender.ts` **no aparecen en el diff** contra `825046f`: los dos siguen exactamente como estaban. | ✅ |
| CA-2 (ResendSender manda `text` y `html`) | `src/lib/notifications/resend-sender.ts` | `tests/spec056-puerto-y-remitente.test.ts` › CA-2 (3 casos, `fetchImpl` inyectado) | 18/18 en su fichero. Mutación «`ResendSender` deja de mandar `html`» → **1 rojo**. Ninguna de las dos llamadas usa `fetch` real: el espía recibe las dos. | ✅ |
| CA-3 (la plantilla es pura y vive sobre el puerto) | `src/lib/notifications/templates/` (4 ficheros) | `tests/spec056-plantillas.test.ts` › CA-3 (4 casos, grafo transitivo + centinela) | 92/92 en `spec056-plantillas`. Mutación «`marco.ts` importa `@/db/schema`» → **1 rojo**. El centinela de no-vacuidad del recorrido está en el propio fichero. | ✅ |
| CA-4 (marca en cabecera, en los tres) | `templates/marco.ts` › `cabecera()` | `tests/spec056-plantillas.test.ts` › CA-4 (7 casos) | Mutación «entra un `<img src>` de seguimiento tras la cabecera» → **6 rojos**. Capturas propias a 900 px y 360 px: `Stockeiro.` + `tremen.dev` arriba, antes del contenido, en los tres. | ✅ |
| CA-5 (marca en pie, con la fórmula de la app) | `templates/marco.ts` › `pie()` y `componer()` | `tests/spec056-plantillas.test.ts` › CA-5 (9 casos) | Mutación «se cae `pie()`» → **7 rojos**. Volcado de los tres cuerpos de texto leído a mano: los tres terminan en `Stockeiro, un proyecto de tremen.dev`. | ✅ |
| CA-6 (fuente única: nada tecleado) | `templates/marco.ts` (lee `MARCA`); `resend-sender.ts` | `tests/spec056-plantillas.test.ts` › CA-6 (5 casos). **Con una excepción declarada** — ver Salvedades | Mutación «se teclea la marca a mano en `marco.ts`» → **1 rojo**; «se cae el pie» → 7 rojos. **Pero queda UNA aparición tecleada** del literal `tremen.dev`: `<stockeiro@tremen.dev>` en `resend-sender.ts:44`. Es la S-1 del implementador y **la exige D-11 razón 5**, que prohíbe derivar la dirección de `MARCA`. La spec pide aquí dos cosas incompatibles; la excepción está acotada a una línea y un caso la vigila. **Salvedad aceptada, no ✅** (ver Veredicto). | ⚠️ |
| CA-7 (documento declarado + preheader) | `templates/marco.ts` › `documento()`, `preheader()` | `tests/spec056-plantillas.test.ts` › CA-7 (9 casos) | Mutación «se cae el `preheader`» → **6 rojos**. Escaneo propio de los tres HTML de `_qa/`: `<!DOCTYPE html>`, `lang="es"`, charset, viewport, `color-scheme`/`supported-color-schemes` con `dark light` y `<title>` = asunto. | ✅ |
| CA-8 (maquetación de correo: tablas, 600 px, estilo en línea) | `templates/marco.ts`, `templates/paleta.ts` (`ANCHO_MAXIMO`) | `tests/spec056-plantillas.test.ts` › CA-8 (12 casos) | Mutación «`max-width:600px` → `width:900px`» → **3 rojos**. Medido en Chromium: tarjeta **600 px** a 900 px de viewport y **336 px** a 360 px; `scrollWidth == clientWidth` en los seis casos (sin scroll horizontal). Escaneo propio: **0** `<table>` sin `role="presentation"`, **0** `<style>`. | ✅ |
| CA-9 (nada que el cliente tire ni ejecute) | `templates/marco.ts`, `templates/correos.ts` | `tests/spec056-plantillas.test.ts` › CA-9 (3 casos + **control positivo** de los doce patrones) | Mutación «entra un `display:flex`» → **3 rojos**. Escaneo propio e independiente de los tres HTML con las doce construcciones: **ninguna aparición**. El control positivo del fichero (fragmento infractor construido a propósito) impide que la lista pase sin mirar nada. | ✅ |
| CA-10 (cero terceros; toda URL absoluta es un `href`) | `templates/marco.ts`, `templates/correos.ts` | `tests/spec056-plantillas.test.ts` › CA-10 (6 casos) | Mutación «entra un `<img src>`» → **6 rojos**. Escaneo propio: cero `<img`, cero ` src=`, cero `url(`, cero `<link`. Todas las URL absolutas: `https://tremen.dev` ×2 (cabecera y pie, las dos `href`) y, en recuperación, la del reset ×2 — una como `href` del botón y otra como texto visible. | ✅ |
| CA-11 (paleta derivada de los tokens) | `templates/paleta.ts` › `COLOR`, `PILA_DE_FUENTES` | `tests/spec056-plantillas.test.ts` › CA-11 (8 casos; deriva de `colors_and_type.css` en cada ejecución) | Mutación «séptimo color `#FFFFFF` en `filete`» → **3 rojos**. Escaneo propio de los tres HTML: exactamente `#111110 #1A1815 #2A2620 #F5F1EA #FF6B00 rgba(245, 241, 234, 0.66)`, que es lo que yo mismo leí de `design/tremen-ds/colors_and_type.css` (`:root` 45/48; `.v-tremendo` 78/79/82/84/86, resolviendo `--accent → --ember`). `PILA_DE_FUENTES` = `--font-sans` sin `Geist`. | ✅ |
| CA-12 (contraste medido) | `templates/paleta.ts` (los seis tokens que se usan) | `tests/spec056-plantillas.test.ts` › CA-12 (5 casos + **control** negro/blanco = 21:1) | **Recalculado por mí** con una implementación WCAG 2.x propia, componiendo el alfa del secundario sobre cada fondo — sobre lienzo `#111110` / tarjeta `#1A1815`: hueso **16,78 / 15,74**; acento **6,62 / 6,20**; secundario **7,68 / 7,41**; rótulo del botón sobre acento **6,62**. Umbrales ≥ 15 / ≥ 6 / ≥ 4,5 cumplidos en los dos fondos. Control: negro sobre blanco = **21,0000**. | ✅ |
| CA-13 (dos cuerpos; el de texto sin etiquetas) | `templates/marco.ts` › `componer()` | `tests/spec056-plantillas.test.ts` › CA-13 (9 casos) | Mutación «una etiqueta `<b>` se cuela en el texto plano» → **6 rojos**. Volcado de los tres cuerpos: ninguna `<`, ninguna entidad, ninguna coartada de «si no ves bien este correo». | ✅ |
| CA-14 (los dos cuerpos dicen lo mismo) | `templates/correos.ts` (una función devuelve los dos) | `tests/spec056-plantillas.test.ts` › CA-14 (3 casos, dato a dato) | Volcado de los tres cuerpos leído a mano: entrada (ticker, precio, zona, `asOf`), resumen (los tres tickers con su zona, el recuento y el `asOf`) y recuperación (URL y `30`) aparecen en **los dos** cuerpos. El resumen gana **una línea** en el texto para llevar el recuento (S-2): usa las palabras exactas del asunto, y la primera línea sigue siendo la de hoy byte a byte. | ✅ |
| CA-15 (el enlace de reset, primero en el texto y visible en el HTML) | `templates/correos.ts` › `correoDeRecuperacion`; `src/lib/auth/password-reset.ts` | `tests/spec056-plantillas.test.ts` › CA-15 (4 casos) y `tests/spec056-emisores.test.ts` (el flujo real) | Mutación «`MARCA.url` por delante en el texto» → **5 rojos**; «una URL de marca en la primera línea» → **3 rojos**. Volcado: la primera URL absoluta del texto es el enlace, desnudo y en su propia línea. En el HTML aparece dos veces (botón + texto copiable). Botón medido en Chromium: **297 × 48 px** a 900 px y **280 × 68 px** a 360 px (suelo de 44 px de ADR-034). | ✅ |
| CA-16 (asuntos byte-idénticos) | `templates/correos.ts` (los tres `subject`) | `tests/spec056-plantillas.test.ts` › CA-16 (4 casos) | Comparados **byte a byte contra `825046f`**: `service.ts:100` y `:139` y `password-reset.ts:46` de la base dan las mismas tres cadenas que `correos.ts` produce hoy. Mutación «alguien “mejora” un asunto» → **1 rojo**. | ✅ |
| CA-17 (el registro in-app sigue siendo texto; sin migración) | `src/lib/notifications/service.ts` — el `payload` NO se toca | `tests/spec056-emisores.test.ts` › CA-17 (5 casos, sobre la base de test) | `payload` en `service.ts:129` y `:173` **idéntico** al de `825046f:109` y `:148` (el diff no toca esas líneas). Mutaciones «el payload gana una etiqueta» → 2 rojos y «el payload cambia de formato» → 1 rojo. `git diff --name-status` no lista **ningún** fichero bajo `drizzle/`; `npm run db:scan` → 11 migraciones, las de siempre. La fila sale con sus once columnas de siempre. | ✅ |
| CA-18 (cero regresión; ninguna guardia aflojada) | — (no hay código propio: es la propiedad de la entrega) | Las cuatro suites nombradas, verdes y **sin tocar**; ver Salvedades para el `numstat` | **Medido sobre el diff real**, no sobre el relato: `git diff --name-status 825046f..HEAD` lista 21 ficheros y **ninguno** es un test preexistente; `--numstat -- tests/` da `185/0`, `772/0`, `316/0` — tres ficheros nuevos, **cero borrados**. Ninguna aserción sobre `body` pudo modificarse porque ningún fichero que las contiene se abrió. Gates **tras commitear**: typecheck ✔, lint ✔, `npm test` **1820/1820 (115 ficheros)**, `npm run test:e2e` **323 passed (4.6 m)** incluido `tests/e2e/recuperacion.spec.ts`, `npm run version:check` → *La version sube de 0.4.1 a 0.4.2*. | ✅ |
| CA-19 (el remitente por defecto ya no cita `stockeiro.app`) | `src/lib/notifications/resend-sender.ts` › `REMITENTE_POR_DEFECTO` | `tests/spec056-puerto-y-remitente.test.ts` › CA-19 (6 casos) | Mutaciones: «la dirección vuelve a `stockeiro.app`» → **4 rojos**; «el nombre visible pasa de 25 caracteres» → **4 rojos**; «el separador pasa a ` · `» → el fichero **ni colecta** (rojo). `grep -rn "stockeiro.app" src/` → **ninguna aparición**. El nombre visible mide 22 caracteres y es ASCII puro. | ✅ |
| CA-20 (código, `.env.example` y `despliegue.md` coinciden; siguen once claves) | `.env.example` (1 línea), `docs/despliegue.md` (§2, §3.2, §7) | `tests/spec056-puerto-y-remitente.test.ts` › CA-20 (5 casos, comparados entre sí) | Los tres valores **extraídos a mano** por mí coinciden byte a byte: `resend-sender.ts:44`, `.env.example:58` y `docs/despliegue.md:189`, `:218` y `:394`. `git diff --numstat -- .env.example` = **`1 1`**: una línea, y es la de `RESEND_FROM`; **`APP_BASE_URL` sigue intacto** en `:30` — esa es la comprobación de la propiedad sobre el diff, que ningún test puede hacer. Once claves. Las únicas menciones vivas a `stockeiro.app` son `.env.example:30` y `docs/despliegue.md:107`, las dos de `APP_BASE_URL` (SPEC-052/055). Mutaciones: env viejo → 3 rojos, guía vieja → 1 rojo, clave nueva → 1 rojo. | ✅ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-25**, con **una salvedad declarada y aceptada (CA-6 ⚠️)**. 19 CA en ✅, 1 en ⚠️.
Verificado en el worktree `D:/src/wt-56`, rama
`ft/SPEC-056-los-tres-correos-diseno-marca-y-texto-plano`, contra la base de la rama `825046f`.
No leí el informe del implementador antes de medir: lo que sigue sale de ejecutar y de mirar el diff.

### Los gates, ejecutados por mí

| Gate | Salida |
|---|---|
| `npm run typecheck` | sin salida (verde) |
| `npm run lint` | sin salida (verde) |
| `npm test` | `Test Files 115 passed (115)` · `Tests 1820 passed (1820)` |
| `npm run build` + `npm run test:e2e` | `323 passed (4.6m)` |
| `npm run version:check` | `La version sube de 0.4.1 a 0.4.2.` |
| `npm run db:scan` | 11 migraciones, 2 con SQL destructivo ya desbloqueadas (SPEC-008, SPEC-024) |
| `core/scripts/valida.mjs` | `[valida] OK` |

Tras la e2e, las capturas ajenas de `_qa/` (SPEC-001…054) quedaron modificadas y las restauré con
`git checkout -- _qa/`. En mi commit entra **solo** `_qa/SPEC-056/`.

### Las guardias no son ciegas: 24 mutaciones, 24 rojos

No me fié de que el ledger dijera que ya se había hecho: **volví a mutar yo**, una a una, revirtiendo
después (`git status` limpio entre tandas). Este proyecto tiene precedente de guardias que pasaban
sin medir nada (SPEC-040, SPEC-055), así que esto no es ceremonia.

| Mutación | Se pone rojo |
|---|---|
| `filete` pasa a `#FFFFFF` (séptimo color) | CA-11, 3 casos |
| entra un `display:flex` en cada párrafo | CA-9, 3 casos |
| se cae `pie()` del marco | CA-5 y CA-6, 7 casos |
| alguien «mejora» el asunto del reset | CA-16, 1 caso |
| la primera línea del texto del reset lleva una URL de marca | CA-15, 3 casos |
| se cae el `preheader` | CA-7, 6 casos |
| entra un `<img src="https://px…/o.gif">` tras la cabecera | CA-4 y CA-10, 6 casos |
| `marco.ts` importa `@/db/schema` | CA-3, 1 caso |
| `MARCA.url` se cuela por delante del enlace en el texto | CA-15, 5 casos |
| una etiqueta `<b>` se cuela en el texto plano | CA-13, 6 casos |
| la marca se teclea a mano en `marco.ts` | CA-6, 1 caso |
| el contenedor pierde el `max-width:600px` | CA-8, 3 casos |
| `ResendSender` deja de mandar `html` | CA-2, 1 caso |
| la dirección vuelve a `avisos@stockeiro.app` | CA-19 y CA-20, 4 casos |
| `.env.example` vuelve al remitente viejo | CA-20, 3 casos |
| `docs/despliegue.md` vuelve al remitente viejo | CA-20, 1 caso |
| el nombre visible pasa a `MARCA.linea` (38 caracteres) | CA-19, 4 casos |
| entra una clave nueva en `.env.example` | CA-20, 1 caso |
| el nombre visible usa ` · ` (U+00B7, sin comillas) | el fichero **ni colecta**: rojo |
| `body` pasa a opcional en el puerto | **`tsc`: 7 errores**, incluido el `@ts-expect-error` sin error que esperar |
| el `payload` de entrada gana un `<b>` | CA-17, 2 casos |
| el `payload` de resumen cambia de formato | CA-17, 1 caso |
| `service.ts` deja de mandar `html` | 2 casos |
| `password-reset.ts` deja de mandar `html` | 1 caso |

Y dos controles positivos viven **dentro** de los propios ficheros de test, que es lo que impide que
pasen sin mirar nada: CA-9 comprueba que sus doce patrones reconocen un fragmento infractor hecho a
propósito, y CA-12 que su fórmula reproduce negro-sobre-blanco = 21:1 y blanco-sobre-blanco = 1:1.

### Lo que medí sin pasar por los tests del proyecto

Porque hay CA que son propiedades que **ningún test puede afirmar sobre sí mismo**:

- **CA-18 es una propiedad del diff.** `git diff --name-status 825046f..HEAD` lista 21 ficheros y
  **ninguno** es un test preexistente; `--numstat -- tests/` da `185/0`, `772/0`, `316/0`. Cero
  borrados, cero modificaciones: el diff sobre `tests/` **solo añade**. Ninguna aserción sobre
  `body` pudo aflojarse porque ningún fichero que las contiene se abrió.
- **CA-20 y el acotado de R-6.** `git diff --numstat -- .env.example` = `1 1`. Una línea, y es
  `RESEND_FROM`. `APP_BASE_URL="https://stockeiro.app"` sigue en `:30` sin tocar — territorio de
  SPEC-052. Nota sobre S-4: el implementador re-encuadró su propia guardia para dejar de congelar el
  literal de esa línea vecina; el re-encuadre es correcto (habría caducado con SPEC-052 sin defecto
  detrás) **y la propiedad que dejó de vigilar la he verificado yo donde corresponde, en el diff**.
- **CA-16 y CA-17 contra la base.** Comparé los tres `subject` y las dos plantillas de `payload`
  con `git show 825046f:…`: idénticos.
- **CA-11 y CA-12 con mis propias lecturas.** Derivé los seis tokens de
  `design/tremen-ds/colors_and_type.css` y recalculé el contraste con una implementación WCAG propia.

### La salvedad: CA-6 (⚠️, aceptada)

CA-6 pide que en `src/lib/notifications/` **no** aparezca tecleado el literal `tremen.dev`. Queda
exactamente **una** aparición: `<stockeiro@tremen.dev>` dentro de `REMITENTE_POR_DEFECTO`
(`src/lib/notifications/resend-sender.ts:44`).

No es un descuido ni un atajo: **la spec pide aquí dos cosas incompatibles**. D-11 razón 5 —arbitrada
por el humano el 2026-08-25— prohíbe derivar la **dirección** de `MARCA`, y CA-19 exige que su
dominio sea `tremen.dev`. Lo tecleado se reduce al **buzón**; el **nombre visible** sí sale de
`MARCA.nombre`. La guardia no se ablandó para que pasara: un caso exige que la excepción sea
**exactamente una línea y exactamente en ese fichero**, y una segunda la pondría roja. La acepto
porque la alternativa —derivar la dirección de `MARCA`— es precisamente lo que la spec prohíbe; si
el humano prefiere la lectura estricta, eso es un cambio de spec, no un defecto de la entrega.

### Dos cosas que el humano tiene que ver, y ninguna bloquea

1. **El texto del resumen gana una línea** (S-2): `Resumen: N acción(es) en zona.` detrás de la de
   hoy. **La exige CA-14**, que pide el recuento en los dos cuerpos y hoy el texto no lo llevaba.
   Usa las palabras exactas del asunto, la primera línea sigue siendo byte a byte la de hoy y
   ninguna aserción existente miraba ese cuerpo. Lo verifiqué en el volcado, no en el ledger.
2. **ADR-036 sigue con `estado: borrador`** mientras la spec que lo estrena está entregada. No es
   un CA y no lo firma quien implementa ni quien verifica: queda **para el orquestador/humano**,
   igual que ADR-034 y ADR-035 en SPEC-054 (`d32a4dc`).

Y lo que esta verificación **no** prueba, dicho sin rodeos: **cómo se ve en Outlook** y **que Resend
entregue de verdad la parte HTML**. `ResendSender` no se ejerce contra la red en ninguna suite. Eso
lo cierran **F-SPEC-056-1** y **F-SPEC-056-4**, y hasta que F-SPEC-056-4 se haga, el remitente real
en Production **no ha cambiado** por muy `hecho` que esté esta spec.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-056/. Informe HTML opcional: _qa/SPEC-056/informe.html -->

Un correo no se pantalla con Playwright como una página, así que la evidencia de esta spec **no es
automática**. Su forma quedó **acordada con el humano en el gate del 2026-08-25** (nota 5) y está
escrita también en la cabecera de §Criterios de aceptación de la spec, que es donde el verificador
mira:

- El implementador escribe los **tres HTML generados** (con datos de muestra) en
  `_qa/SPEC-056/entrada.html`, `_qa/SPEC-056/resumen.html` y `_qa/SPEC-056/recuperacion.html`.
- El verificador los abre en un navegador y captura los tres, más una captura a **360 px** de ancho
  para comprobar que el contenedor de 600 px se comporta.
- Queda dicho lo que esa evidencia **no** prueba: cómo se ve en Outlook. Eso solo lo cierra
  F-SPEC-056-1.

Aviso de higiene (memoria del proyecto): la e2e completa reescribe capturas ajenas en `_qa/`. Si se
ejecuta, restaurar lo que no es de esta spec con `git checkout -- _qa/` y commitear solo
`_qa/SPEC-056/`.

**Entregado por la implementación** (2026-08-25): los tres ficheros están en disco y committeados.

**Capturado por el verificador** (2026-08-25) con el Chromium de `@playwright/test` del propio
proyecto, abriendo los tres HTML como `file://`. Seis capturas, y las medidas que las acompañan:

| Captura | CA que sostiene | Qué se ve / qué se midió |
|---|---|---|
| `_qa/SPEC-056/entrada.png` (900 px) | CA-4, CA-5, CA-8, CA-11 | Marca arriba (`Stockeiro.` + `tremen.dev`), `ITX a 45.20` con el precio en ember, `(asOf 2026-08-24)` y el pie con la fórmula de la app. Tarjeta **600 px** sobre lienzo a sangre. |
| `_qa/SPEC-056/resumen.png` (900 px) | CA-4, CA-5, CA-8 | `Resumen: 3 acción(es) en zona`, las tres posiciones con filete entre ellas y su zona a la derecha, `asOf` y pie. Tarjeta **600 px**. |
| `_qa/SPEC-056/recuperacion.png` (900 px) | CA-4, CA-5, CA-15 | Botón ember `Establecer una contraseña nueva` (**297 × 48 px**), la **misma URL debajo, desnuda y copiable**, el plazo de 30 min y el pie. |
| `_qa/SPEC-056/entrada-360.png` | CA-8 | Tarjeta fluida a **336 px**; `scrollWidth == clientWidth == 360`: **sin scroll horizontal**. |
| `_qa/SPEC-056/resumen-360.png` | CA-8 | Igual: **336 px**, la lista de posiciones no desborda. |
| `_qa/SPEC-056/recuperacion-360.png` | CA-8, CA-15 | **La captura que pedía el gate.** A 360 px la URL del reset se parte por `word-break` y cabe entera; el botón crece a **280 × 68 px** (≥ 44, ADR-034) y sigue dentro. `scrollWidth == clientWidth == 360`. |

Fondo de página medido en los seis: `rgb(17, 17, 16)` = `#111110` = `--bg` de `.v-tremendo`.

Los tres `.html` **no cambiaron** al correr la suite completa dos veces: la salida es determinista,
como decía el implementador, y eso lo comprobé con `git status` limpio, no de palabra.

| Fichero | Qué enseña |
|---|---|
| `_qa/SPEC-056/entrada.html` | Entrada en zona: `ITX` a `45.20`, zona de compra, `asOf 2026-08-24` |
| `_qa/SPEC-056/resumen.html` | Resumen de permanencia con tres posiciones (`ITX`, `SAN`, `TEF`) |
| `_qa/SPEC-056/recuperacion.html` | Recuperación: botón, URL desnuda copiable y el plazo de 30 min |

Dos notas para quien capture:

- **No hay que regenerarlos a mano.** Los escribe el propio test que los afirma
  (`tests/spec056-plantillas.test.ts`), así que `npm test` los deja siempre al día y el último caso
  del fichero comprueba que lo que hay en disco es byte a byte lo que la plantilla produce. La salida
  es determinista: reescribirlos no ensucia el árbol.
- **La captura a 360 px es la que importa** (nota 5 del gate): el contenedor es fluido por
  construcción (`width:100%` con `max-width:600px`) y **no hay ni una regla `@media`**, así que si algo
  fuera a desbordar, desbordaría ahí. La implementación lo miró en Chromium a 360 px antes de entregar
  y el correo se lee entero, con la URL del reset partida por `word-break` y sin scroll horizontal;
  esa mirada **no es la verificación**, solo el motivo de no entregarlo a ciegas.
- Y lo que esta evidencia **no** prueba, dicho otra vez: cómo se ve en Outlook. Eso solo lo cierra
  **F-SPEC-056-1**.

## Salvedades / follow-ups
<!-- IDs F-SPEC-056-1, F-SPEC-056-2… con destino (spec futura o EPIC-MEJORA). -->

Nacen con la spec, antes de implementar. Ninguno bloquea el gate.

- **F-SPEC-056-1 (DESPLIEGUE)** — **Un envío real de los tres correos** tras desplegar, mirado en al
  menos un cliente de escritorio y uno móvil. Es la única prueba de que la parte HTML se entrega y se
  pinta: `ResendSender` no se ejerce en la suite (ADR-036, contexto pto. 1) y CA-2 solo afirma que la
  petición lleva el campo. Se cierra como se cerró **F-SPEC-006-1** (`docs/despliegue.md:53-54`, «un
  reset real entregado»).
- **F-SPEC-056-2 (observación, tras desplegar)** — Vigilar el *bounce rate* de Resend (exige < 4 %) y
  la carpeta de spam durante los días siguientes (R-5). Si empeora, el sospechoso número uno es el
  marcado nuevo.
- **F-SPEC-056-3 (higiene → EPIC-INFRA)** — Renombrar `body` → `text` en `NotificationMessage`, en un
  cambio **aislado** que no toque conducta. El nombre correcto es `text` (ADR-036, alternativas); se
  aparta de aquí para que un fallo en esta entrega signifique lo que dice.
- **F-SPEC-056-4 (DESPLIEGUE, nace del gate del 2026-08-25)** — **Fijar `RESEND_FROM` en el entorno
  de Production de Vercel** al valor que CA-19 deja en el código
  (`"Stockeiro - tremen.dev" <stockeiro@tremen.dev>`), y **comprobarlo con un envío real** que salga
  desde `@tremen.dev` y no rebote.

  **Esto NO lo entrega la spec y es la confusión que hay que evitar al cerrarla.** La spec cambia el
  **valor por defecto del código** y **los dos ficheros que lo documentan** (CA-19, CA-20) — eso es
  trabajo de ficheros, implementable y verificable. Fijar la variable en Vercel es una acción de
  despliegue del humano. **Mientras no se haga, el remitente real en producción sigue siendo el que
  hoy esté configurado**, por muy `hecho` que esté esta spec. Misma marca y mismo trato que
  F-SPEC-006-1, que se cerró con «un reset real entregado» (`docs/despliegue.md:53-54`).

  Nota de contexto para quien lo ejecute: la documentación caduca que motivó esto —`.env.example:58`,
  `docs/despliegue.md:183` y `:187` citando `stockeiro.app`— **sí queda corregida por la spec**. Lo
  que **no** se toca son las menciones a `stockeiro.app` que cuelgan de `APP_BASE_URL`
  (`.env.example:30`, `docs/despliegue.md:107`): son territorio de SPEC-052 y SPEC-055.

### Lo que la implementación añade (2026-08-25)

Ninguno de estos cuatro es un follow-up de trabajo pendiente: son **lecturas y hechos** que el gate y
el verificador tienen que ver escritos, porque los cuatro son sitios donde alguien podría creer que se
hizo trampa.

- **S-1 — La única excepción a CA-6, declarada y acotada.** CA-6 dice que en
  `src/lib/notifications/` no puede aparecer `tremen.dev` **tecleado a mano**; D-11 razón 5 dice que la
  **dirección** del remitente **no** se derive de `MARCA`. Las dos cosas a la vez son imposibles, y la
  spec pide las dos. Resuelto así, y está escrito en el código y en el test:

  ```ts
  export const REMITENTE_POR_DEFECTO = `"Stockeiro - ${MARCA.nombre}" <stockeiro@tremen.dev>`;
  ```

  El **nombre visible** sale de `MARCA.nombre` (que es lo que CA-19 exige comprobar); lo tecleado se
  reduce al **buzón**, que es configuración de despliegue. La guardia no se ablandó para que pasara:
  `tests/spec056-puerto-y-remitente.test.ts` lleva un caso que exige que la excepción sea **exactamente
  una línea** y que esté **exactamente en `resend-sender.ts`** — una segunda la pone roja. Si el gate
  prefiere la lectura estricta (ni el buzón tecleado), la salida es una constante de despliegue en otro
  módulo, y eso es un cambio de spec, no una decisión de la implementación.

- **S-2 — El texto del resumen gana UNA línea, y la exige CA-14.** CA-14 pide que «el recuento» aparezca
  **en los dos** cuerpos. El texto de hoy (`Siguen en zona: …. (asOf …)`) no lleva el número por ningún
  lado: solo lo lleva el asunto. Así que el cuerpo de texto del resumen pasa a ser dos líneas:

  ```
  Siguen en zona: ITX (compra), SAN (venta), TEF (compra). (asOf 2026-08-24)
  Resumen: 3 acción(es) en zona.
  ```

  La primera línea es **exactamente** la de hoy —y por eso sigue siendo un preheader útil (D-9) en vez
  de un eco del asunto—; la segunda usa **las palabras del asunto** y ni una nueva, que es la frontera
  que D-10 y CE-M1 fijan. Ninguna aserción existente miraba ese cuerpo. Si al gate le parece copy nuevo,
  la alternativa es aflojar CA-14 para el recuento, y eso no lo decide quien implementa.

- **S-3 — Una guardia ajena se puso roja, y se arregló lo mío.**
  `tests/tarjeta-guardias-ampliadas.test.ts` (SPEC-051 CA-17.1) afirma que la lista de ficheros de
  `tests/` que nombran «SPEC-051» es cerrada. Un fichero nuevo de esta spec la nombraba **en un
  comentario** (citando de dónde venía la lectura de los tokens), y la guardia lo cazó. **No se tocó ni
  una coma de ella**: se reescribió mi comentario para citar el fichero (`tests/tarjeta-imagen.test.ts`)
  en vez del id. Es la convención funcionando y por eso queda escrito.

- **S-4 — Una guardia PROPIA re-encuadrada antes de caducar.** El caso del acotado de R-6 congelaba el
  literal de la línea vecina de `.env.example` (`APP_BASE_URL="https://stockeiro.app"`). Eso es
  exactamente la foto del árbol que `FOUNDATION.md` señala: se habría puesto roja el día que **SPEC-052**
  cambiase ese ejemplo, sin defecto detrás. **Qué vigilaba antes**: el literal de esa línea. **Qué vigila
  ahora**: que `APP_BASE_URL` y `RESEND_FROM` sigan declaradas **una vez cada una** y que en
  `.env.example` haya **un solo** remitente. Se re-encuadró en el commit del bump de versión, con su
  motivo en el mensaje.

### Cómo se probó que las guardias no son ciegas

Precedente reciente del proyecto (SPEC-040, SPEC-055): una guardia que no puede fallar no es una
guardia. **Doce mutaciones, doce rojos**, todas revertidas después:

| Mutación | Qué se pone rojo |
|---|---|
| `.env.example` vuelve al valor viejo | CA-20 (2 casos) |
| la dirección vuelve a `stockeiro.app` | CA-19 y CA-20 (4 casos) |
| `ResendSender` deja de mandar `html` | CA-2 (1 caso) |
| `body` pasa a opcional en el puerto | `npm run typecheck` (5 errores, incluido el `@ts-expect-error` sin error que esperar) |
| se cae el pie del marco | CA-5 y CA-6 (7 casos) |
| entra un séptimo color (`#FFFFFF`) | CA-11 (3 casos) |
| entra un `display:flex` | CA-9 (3 casos) |
| `MARCA.url` se cuela delante del enlace de reset | CA-15 (5 casos) |
| se teclea «un proyecto de tremen.dev» en una plantilla | CA-6 (1 caso) |
| una plantilla importa `@/db/schema` | CA-3 (1 caso) |
| alguien «mejora» un asunto | CA-16 (1 caso) |
| entra un `<img>` de seguimiento | CA-10 y CA-4 (6 casos) |

Y dos guardias llevan **control positivo dentro del propio fichero**, para que no puedan pasar sin
mirar nada: CA-9 comprueba que sus doce patrones reconocen un fragmento infractor construido a
propósito, y CA-12 comprueba que su fórmula de contraste reproduce los pares canónicos de WCAG
(negro sobre blanco = 21:1, blanco sobre blanco = 1:1).

### Los gates, con su salida literal

Ejecutados **después de commitear** (SPEC-049), sobre `0.4.2`:

- `npm run typecheck` → sin salida (verde).
- `npm run lint` → sin salida (verde).
- `npm test` → **`Test Files 115 passed (115)` · `Tests 1820 passed (1820)`**.
- `npm run test:e2e` (suite completa, tras `npm run build`) → **`323 passed (6.1m)`**, incluida
  `tests/e2e/recuperacion.spec.ts`, que saca el enlace del buzón en disco.
- `npm run version:check` → `[check-version-bump] La version sube de 0.4.1 a 0.4.2.`
- Tras la e2e, las capturas ajenas de `_qa/` se restauraron con `git checkout -- _qa/`; en el commit
  solo entra `_qa/SPEC-056/`.

**La evidencia de CA-18**, que es la que más cuesta creer sin números — `git diff --numstat` de la
entrega entera contra la base de la rama (`825046f`):

```
tests/  185  0  tests/spec056-emisores.test.ts
        772  0  tests/spec056-plantillas.test.ts
        316  0  tests/spec056-puerto-y-remitente.test.ts
```

**Cero borrados y cero ficheros de test preexistentes tocados**: los tres son nuevos. El diff sobre
`tests/` es, literalmente, solo añadir. Y `.env.example` sale con `1 1`: **una línea, y solo su valor**.
`tests/spec-031-frontera.test.ts` (`toHaveLength(11)`) sigue verde y sin tocar.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Hecho: los veinte CA están implementados y con test.** Cinco commits sobre la spec en
`ft/SPEC-056-los-tres-correos-diseno-marca-y-texto-plano`, en el orden que el handoff del arquitecto
recomendaba —primero la frontera, luego el módulo puro, y el enganche al final—:

| Commit | Qué entra |
|---|---|
| `251ed91` | CA-1, CA-2, CA-19, CA-20 — el puerto gana `html?`, `ResendSender` manda las dos partes, y el remitente pasa a `"Stockeiro - tremen.dev" <stockeiro@tremen.dev>` |
| `25bd29f` | CA-3 a CA-16 — `src/lib/notifications/templates/` (marco único, tres correos) y la evidencia de `_qa/SPEC-056/` |
| `c1a30a9` | CA-17 y el enganche — `service.ts` y `password-reset.ts` cruzan el puerto con los dos cuerpos |
| `e3751c3` | `0.4.0` → `0.4.1`, PATCH sobre la base de la rama |
| `0bf3d42` | `0.4.1` → `0.4.2`, porque `origin/main` avanzó a `497eccf` (SPEC-055) mientras tanto, más el re-encuadre de S-4 |

**Lo siguiente: el verificador.** Nada bloquea. Lo que le conviene mirar primero, por orden de
probabilidad de discusión:

1. **S-1** (la excepción declarada a CA-6) y **S-2** (la línea que el resumen gana por CA-14). Son las
   dos únicas decisiones de lectura que la implementación tomó, y las dos están arriba con su porqué y
   su alternativa. Ninguna afloja una guardia; las dos se pueden revertir con un cambio de spec.
2. **La evidencia visual**, incluida la captura a **360 px** (nota 5 del gate). Los tres HTML están en
   `_qa/SPEC-056/` y se abren en cualquier navegador sin servidor.
3. **CA-18**, con el `numstat` de arriba: cero borrados sobre `tests/`.

**Lo que NO se ha hecho, y es a propósito:**

- **`RESEND_FROM` en el entorno de Production de Vercel** sigue sin tocar: es **F-SPEC-056-4**, acción
  del humano. El remitente real en producción **no ha cambiado** por mucho que esto esté entregado.
- **`APP_BASE_URL`** no se ha tocado en ningún sitio (ni la clave, ni sus menciones a `stockeiro.app`
  en `.env.example:30` y `docs/despliegue.md`): territorio de SPEC-052 y SPEC-055 (R-6).
- **`src/lib/config/app-url.ts`** no se ha abierto siquiera.
- **`drizzle/`** no gana ningún fichero y `notifications` no gana ninguna columna (CA-17).
- **`estado.mjs` sobre ADR-036**: el ADR sigue en `borrador`. La implementación no firma documentos de
  verdad; queda para el orquestador, como ADR-034 y ADR-035 en SPEC-054.

**Sobre el merge (R-6, y ha cambiado desde que se escribió la spec):** `origin/main` ya **no** es
`825046f` sino `497eccf` — **SPEC-055 mergeó** mientras esto se implementaba. Buena noticia: SPEC-055
**no tocó `.env.example`**, así que ahí no hay choque con ella. Lo que queda por reconciliar al rebasar
es lo previsto: `docs/roadmap.md`, `docs/tablero.md` y la versión (`0.4.2` ya está por encima de la
`0.4.1` de `main`). **SPEC-052 sigue en vuelo** y sí ronda `.env.example`: el solape con ella se reduce
a una línea con valor distinto (`RESEND_FROM` frente a `APP_BASE_URL`), que es el conflicto más barato
que existe. Quien mergee el segundo, rebasa y reconcilia.

**Para reproducir los gates en limpio** (este worktree se creó sin `node_modules`):

```bash
npm ci
npm run typecheck && npm run lint && npm test
DATABASE_URL="postgres://ci:ci@localhost:5432/ci" AUTH_SECRET="ci-not-a-real-secret-ci-not-a-real-secret"   AUTH_TRUST_HOST=true APP_BASE_URL="http://localhost:3200" npm run build
DATABASE_URL="postgres://ci:ci@localhost:5432/ci" AUTH_SECRET="ci-not-a-real-secret-ci-not-a-real-secret"   AUTH_TRUST_HOST=true APP_BASE_URL="http://localhost:3200" npm run test:e2e
git checkout -- _qa/   # la e2e reescribe capturas ajenas
```
