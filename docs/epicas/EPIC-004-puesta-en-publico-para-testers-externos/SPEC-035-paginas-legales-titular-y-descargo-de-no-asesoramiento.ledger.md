---
id: SPEC-035
tipo: ledger
epica: EPIC-004
---
# Ledger — SPEC-035 Paginas legales titular y descargo de no asesoramiento

## Resumen
- Fase: en-revision <!-- refleja el estado de la spec; la fuente de verdad es el frontmatter de la spec -->
- Rama: `ft/SPEC-035-paginas-legales-titular-y-descargo`

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/auth/guard.ts` (`PUBLIC_PREFIXES` += `/legal`); `src/app/legal/page.tsx`, `.../aviso-legal/page.tsx`, `.../privacidad/page.tsx`, `.../terminos/page.tsx` | `tests/e2e/legal.spec.ts` › *CA-1: las cuatro se leen sin sesión, y las de datos no* (4 rutas + «las rutas de datos siguen exigiendo sesión») | | 🚧 |
| CA-2 | `src/lib/auth/guard.ts`; `src/proxy.ts` (matcher intacto) | `tests/legal-rutas-publicas.test.ts` › *CA-2: /legal y sus subrutas son públicas* (4) + *el matcher del proxy no cambia* (2) | | 🚧 |
| CA-3 | `src/lib/legal/content.ts` (`TITULAR`); `src/app/legal/aviso-legal/page.tsx` | `tests/e2e/legal.spec.ts` › *CA-3: quién opera esto y cómo escribirle* (3, incl. «ninguna página legal contiene texto de relleno»); lista en `tests/legal-afirmaciones-prohibidas.ts` (`MARCADORES_DE_POSICION`) | | 🚧 |
| CA-4 | `src/app/legal/aviso-legal/page.tsx` (`data-testid="titular"`); `src/app/legal/privacidad/page.tsx` (`data-testid="responsable"`); `src/lib/legal/content.ts` (`MARCA`) | `tests/e2e/legal.spec.ts` › *CA-4: el responsable es la persona, no la marca* (4) | | 🚧 |
| CA-5 | `src/lib/legal/content.ts` (`CATEGORIAS_DE_DATO`); `src/app/legal/privacidad/page.tsx` | `tests/legal-datos-y-esquema.test.ts` (5: los dos conjuntos son EXACTAMENTE el mismo) + `tests/e2e/legal.spec.ts` › *la privacidad describe las siete categorías de dato del esquema* | | 🚧 |
| CA-6 | `src/lib/legal/content.ts` (`ENCARGADOS`); `src/app/legal/privacidad/page.tsx` | `tests/e2e/legal.spec.ts` › *la privacidad nombra a los cinco terceros y para qué interviene cada uno* | | 🚧 |
| CA-7 | `src/lib/legal/content.ts` (`DATOS_DE_MERCADO`, `FUENTE_DE_PRECIOS`); `src/app/legal/terminos/page.tsx` y `.../privacidad/page.tsx` (`data-testid="datos-de-mercado"`) | `tests/e2e/legal.spec.ts` › *CA-7: de dónde vienen los precios y qué son* (2 rutas × fuente + diferido + informativo) | | 🚧 |
| CA-8 | `tests/legal-afirmaciones-prohibidas.ts` (lista cerrada, 13 entradas con motivo); redacción de `src/lib/legal/content.ts` y de las 4 páginas | `tests/e2e/legal.spec.ts` › *CA-8: y NADA más que eso* (4 rutas) | | 🚧 |
| CA-9 | `src/app/app-footer.tsx`; `src/lib/legal/content.ts` (`DESCARGO_BREVE`, `DESCARGO_COMPLETO`); `src/app/legal/terminos/page.tsx` (`#no-asesoramiento`) | `tests/e2e/pie-legal.spec.ts` › *CA-9: el descargo de no asesoramiento, donde se ve* (5 públicas + «también con sesión iniciada» + «/legal/terminos contiene el texto completo») | | 🚧 |
| CA-10 | `src/app/app-footer.tsx` (sin sesión, sin BD); `src/app/layout.tsx` | `tests/e2e/pie-legal.spec.ts` › *CA-10* (4) + `tests/legal-import-graph.test.ts` › *el pie no lee la sesión* y *no alcanza ningún módulo prohibido* | | 🚧 |
| CA-11 | `src/app/app-footer.tsx`; `src/lib/legal/content.ts` (`MARCA`) | `tests/e2e/pie-legal.spec.ts` › *CA-11: de quién es esto* (6 rutas + «también con sesión iniciada») | | 🚧 |
| CA-12 | `src/app/layout.tsx` (`next/font/google`); `design/tremen-ds/colors_and_type.css` (fuera el `@import` remoto); `src/app/globals.css` (tokens reapuntados) | `tests/e2e/legal.spec.ts` › *CA-12: ni un recurso de terceros* (4 rutas, interceptando `page.on('request')`) + `tests/legal-sin-terceros.test.ts` (3) | | 🚧 |
| CA-13 | `src/proxy.ts` (la ruta pública sale antes de instanciar Auth.js); `src/lib/legal/content.ts` (`COOKIES_Y_ANALITICA`); `src/app/legal/privacidad/page.tsx` | `tests/e2e/legal.spec.ts` › *CA-13* (recorrer `/legal` no deja NINGUNA cookie; en `/login` solo las de Auth.js) | | 🚧 |
| CA-14 | `src/lib/legal/content.ts` (módulo puro: 0 imports); las 4 páginas; `src/app/layout.tsx`; `src/app/app-footer.tsx` | `tests/legal-import-graph.test.ts` (21 casos: 6 entradas × existe / prefijos prohibidos / clientes de BD, + recorrido no vacío + pureza del módulo) | | 🚧 |
| CA-15 | `src/app/app-footer.tsx` montado en el layout raíz → alcanza al grupo `(auth)` | `tests/e2e/pie-legal.spec.ts` › *CA-15: se llega desde donde hace falta llegar* (3) | | 🚧 |
| CA-16 | `src/lib/legal/content.ts` (`DERECHOS`); `src/app/legal/privacidad/page.tsx` (`data-testid="derechos"`) | `tests/e2e/legal.spec.ts` › *CA-16* (2: enunciado + ruta + residual F-ADR-022-1; y «esta spec NO crea el enlace a /cuenta») | | 🚧 |
| CA-17 | — (no degradar) | `npm test` 878/878 · `npx playwright test` 95/95 · `npm run typecheck` · `npm run lint` — todos en verde, incl. `tests/guard.test.ts` (CA-15 de SPEC-023) con la lista ampliada | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-035/. Informe HTML opcional: _qa/SPEC-035/informe.html -->

## Salvedades / follow-ups

### Cerrados en esta implementación

- **F-SPEC-035-1 — ✅ CERRADO (ya venía cerrado de la spec).** Titular, domicilio y
  contacto están en `src/lib/legal/content.ts` como texto real.
- **F-SPEC-035-5 (domicilio particular) — ✅ CERRADO el 2026-08-19.** El humano
  **confirmó explícitamente** publicar el domicilio particular *Estrada de Viveiro 62,
  15337 Porto do Barqueiro, Mañón, A Coruña*. Era el único cabo que quedaba abierto:
  se había aportado tras la advertencia, pero sin un "publícalo" expreso. Ya lo hay,
  así que el dato entra en `/legal/aviso-legal` sin salvedad. Si algún día prefiere un
  apartado de correos o un coworking, el cambio es editar `TITULAR.domicilio`: ningún
  CA se mueve.
- **F-SPEC-035-6 (buzón `hola@tremen.dev`) — ✅ CERRADO el 2026-08-19.** El humano
  **creó el buzón** ese día. El aviso legal ya no apunta a una dirección muerta y CE-5
  tiene canal para ejercer derechos. De rebote queda resuelto también **F-SPEC-039-6**,
  que usa la misma dirección como canal de feedback (CE-8) — anotado aquí como
  referencia; cerrarlo en su ledger es de SPEC-039, no de esta spec.

### Siguen abiertos

- **F-SPEC-035-2 (residual asumido de R-1).** Sin cambios. Que las páginas no afirmen
  derechos que no se tienen **no crea** los derechos que faltan: publicar precios del
  free tier de Marketstack en abierto sigue siendo el riesgo que el gate asumió. Esta
  spec lo hace visible y honesto; lo resuelve **F-EPIC-004-1**.
- **F-SPEC-035-3 (mantenimiento).** Vivo y funcionando: `tests/legal-datos-y-esquema.test.ts`
  se pondrá rojo el día que alguien añada una tabla con `userId`. El mensaje de fallo
  dice explícitamente qué hacer (describir el dato en `src/lib/legal/content.ts`) y qué
  **no** hacer (relajar la comprobación).
- **F-SPEC-035-4 (futuro).** Sigue sin haber versionado ni fecha de última actualización
  de los textos legales. `/legal/terminos` dice ahora, por escrito, que esta es la
  primera versión y que no hay historial anterior — con lo que la ausencia queda al
  menos declarada. Cuando cambien, hará falta.

### Nuevos, abiertos en esta implementación

- **F-SPEC-035-7 (frontera con SPEC-036, BLOQUEA PUBLICAR).** `/legal/privacidad`
  nombra la ruta `/cuenta` como el sitio donde se borra la cuenta, tal y como exige
  **CA-16**. Esa pantalla **todavía no existe**: la entrega SPEC-036. Mientras no entre,
  la página enuncia un derecho cuya vía no está construida. No es un defecto de esta
  spec (CA-16 pide justo eso, y hay un test que impide crear aquí el **enlace** para no
  dejar un enlace roto), pero **036 y 035 tienen que publicarse juntas**. Si se decidiera
  publicar sin supresión, hay que reescribir `DERECHOS` en
  `src/lib/legal/content.ts` — y CE-5 se queda sin cumplir.
- **F-SPEC-035-8 (hallazgo de as-built, CORREGIDO aquí, con residual documental).**
  El sistema de diseño cargaba Geist con `@import url('https://fonts.googleapis.com/…')`
  en `design/tremen-ds/colors_and_type.css`. Consecuencia: **todas** las páginas de
  Stockeiro pedían un recurso a un tercero — no solo las de `/legal` (CA-12), también
  `/reset-password`, sobre la que **ADR-015 pto. 9** afirma por escrito *"esta página no
  carga recursos de terceros, así que la política no cuesta nada"*, y la misma frase se
  repite en el comentario de `next.config.mjs`. **Era falso desde que se escribió.**
  Arreglado: las familias las resuelve `next/font/google` en tiempo de build y se sirven
  desde `/_next/static`, sin dependencias nuevas en `package.json`. Ahora esas dos
  afirmaciones son ciertas. **Residual:** ni el ADR ni el runbook mencionan el episodio,
  y no me corresponde editarlos. Merece una nota en ADR-015 —o un ADR de "sin recursos
  de terceros" que generalice la disciplina a toda la app— que decida el arquitecto.
- **F-SPEC-035-9 (cambio de comportamiento del middleware, verificado).** Para que
  **CA-13** fuera verdad y no una excepción, `src/proxy.ts` resuelve ahora las rutas
  públicas **antes** de instanciar Auth.js. Antes, `auth()` envolvía cualquier ruta del
  matcher y estampaba `authjs.csrf-token` y `authjs.callback-url` incluso en páginas sin
  formulario ni sesión: leer el aviso legal dejaba dos cookies. Efecto colateral a vigilar:
  `/login`, `/register`, `/forgot-password` y `/reset-password` **ya no reciben esas
  cookies desde el middleware**. Se ha comprobado que no importa —`signIn` corre en una
  server action de Node— y toda la e2e de auth y de recuperación sigue verde (95/95),
  pero queda escrito por si algún flujo futuro de Auth.js las diera por puestas.
- **F-SPEC-035-10 (deuda visual mínima).** `.auth-wrap` tenía `min-height: 100vh`, lo que
  con el pie en el layout raíz lo empujaba fuera de pantalla en todas las páginas de auth.
  Ahora es `flex: 1 1 auto` dentro de un `.frame` en columna. Los formularios siguen
  centrados y el pie queda abajo, pero **no hay test de regresión visual** en el proyecto:
  esto se ha comprobado por razonamiento y con la e2e funcional, no con una captura.

### Re-encuadre de guardia (declarado por el aviso 4 del encargo)

- **`tests/legal-rutas-publicas.test.ts` › «el matcher del proxy no cambia».** En su
  primera versión el test afirmaba `expect(proxy).not.toContain('legal')` sobre el
  **fichero entero**. Se rompió en cuanto `src/proxy.ts` ganó los comentarios que
  explican por qué `/legal` se decide en el guard y no en el matcher — es decir, se
  rompió porque el fichero mejoró.
  - **Qué vigilaba antes:** que la cadena `legal` no apareciera en `src/proxy.ts`.
  - **Qué vigila ahora:** que **dentro del literal del `matcher`** no aparezca ninguna
    ruta de producto (`legal`, `login`, `register`, `forgot-password`, `reset-password`),
    más la comprobación literal de que el matcher sigue siendo exactamente el de siempre.
  - **Por qué es la misma propiedad, y no menos:** lo que CA-2 protege es que la
    excepción a RN-03 viva en `PUBLIC_PREFIXES` y **no** en el matcher; que el fichero
    mencione `/legal` en un comentario es justamente lo que se quiere que siga escrito
    ahí. La versión nueva cubre además las cuatro rutas públicas anteriores, que la
    versión vieja no miraba.

### Fuera de mi alcance, visto de paso

- **SPEC-038 y SPEC-039** heredan `src/app/app-footer.tsx`. Está preparado para crecer
  (tres bloques independientes, sin sesión y sin BD) y **no** lleva ni versión ni enlace
  de feedback: no son de esta spec. Aviso para quien las implemente: la e2e de CA-9/CA-10
  exige **exactamente un** `a[href="/legal/terminos"]` en el pie; añadir enlaces nuevos
  no lo rompe, duplicar ese sí.
- **`package.json` y `next.config.mjs` no se han tocado** (el semver es de SPEC-038). El
  arreglo de tipografías no necesitó ninguna dependencia nueva.
- **`docs/despliegue.md` §0** describe bien los cinco proveedores; la lista de `ENCARGADOS`
  sale de ahí y de los ADR, y coincide.

## Cómo retomar (handoff)

**Estado: implementación completa, los 17 CA cubiertos con test. Spec en `en-revision`.**

- **Rama:** `ft/SPEC-035-paginas-legales-titular-y-descargo`, salida de `origin/main`
  limpio (SPEC-034 ya mergeada). Sin push.
- **Commits:** 5, todos con `Refs: SPEC-035`.
  1. `/legal` es pública por diseño, declarada en el único sitio que decide.
  2. La lista de datos guardados sale del esquema, no de la memoria.
  3. Páginas legales públicas, pie compartido y tipografía sin terceros.
  4. Titular, Marca, Descargo y Fuente de precios entran al glosario.
  5. El ledger (este fichero).
- **Verde comprobado:** `npm run typecheck` ✓ · `npm run lint` (`--max-warnings=0`) ✓ ·
  `npm test` **878/878** ✓ · `npx playwright test` **95/95** ✓ (la suite entera, no solo
  la nueva). El e2e exige `npm run build` previo.
- **Ficheros nuevos:** `src/lib/legal/content.ts`, `src/app/app-footer.tsx`, las cuatro
  `src/app/legal/**/page.tsx`, `tests/legal-afirmaciones-prohibidas.ts`,
  `tests/legal-rutas-publicas.test.ts`, `tests/legal-datos-y-esquema.test.ts`,
  `tests/legal-import-graph.test.ts`, `tests/legal-sin-terceros.test.ts`,
  `tests/e2e/legal.spec.ts`, `tests/e2e/pie-legal.spec.ts`.
- **Ficheros tocados:** `src/lib/auth/guard.ts`, `src/proxy.ts`, `src/app/layout.tsx`,
  `src/app/globals.css`, `design/tremen-ds/colors_and_type.css`,
  `docs/fundacion/dominio.md`.
- **Dónde mirar primero si algo falla:** los tres puntos donde la implementación tuvo que
  corregir el as-built son `src/proxy.ts` (F-SPEC-035-9), `src/app/layout.tsx` +
  `design/tremen-ds/colors_and_type.css` (F-SPEC-035-8) y `.auth-wrap` en
  `src/app/globals.css` (F-SPEC-035-10).
- **Lo que NO se ha hecho, a propósito:** la pantalla `/cuenta` y su enlace (SPEC-036), la
  versión visible en el pie (SPEC-038) y el enlace de feedback (SPEC-039).
- **Antes de publicar:** F-SPEC-035-7 — esta spec y SPEC-036 salen juntas, o la privacidad
  nombra una ruta que no existe.
