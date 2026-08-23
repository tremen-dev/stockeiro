---
id: SPEC-051
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-051 La vista previa del enlace: la tarjeta que el foro ve antes de entrar

## Resumen
- Fase: `en-revision` — implementada por sdd-implementador el 2026-08-23 sobre la spec
  aprobada por el humano (Alberto Fojo) ese mismo día.
- Rama: `ft/SPEC-051-la-vista-previa-del-enlace-la-tarjeta-que-el-foro-ve-antes-de-entrar`,
  desde `origin/main` en `9387681`. Sin rebase: no ha hecho falta.
- **Nació como `SPEC-050`.** Otra sesión ocupó el id `SPEC-049` (EPIC-FIX) mientras ésta se
  escribía, y la cadena se desplazó. Citas reverificadas contra `9387681`.
- Versión: **0.3.2 → 0.3.3** (PATCH, ADR-024: presentación pura, mismo criterio que
  SPEC-047). `npm run version:check` sobre el árbol **ya commiteado**: `exit=0`,
  *«La version sube de 0.3.2 a 0.3.3»*. Se ejecutó después de commitear a propósito
  (SPEC-049: sobre un árbol sucio el gate se abstiene con 2, y una abstención no es un
  verde).

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->

| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 (`metadataBase` desde `appBaseUrl()`) | `src/app/layout.tsx` (`metadataBase: new URL(appBaseUrl())`) | `tests/tarjeta-frontera.test.ts` › *«aparece UNA sola vez en todo src/…»*, *«su valor se construye con `appBaseUrl()`…»*, *«no hay ningún origen absoluto alternativo en src/»*| `npm test` verde. Comprobado además a mano: `metadataBase` aparece **una sola vez como código** en todo `src/` (`src/app/layout.tsx:57`), el resto son comentarios; `VERCEL_URL` y `NEXT_PUBLIC_SITE_URL` no aparecen. `.env.example` y `tests/spec-031-frontera.test.ts` (`toHaveLength(11)`, línea 149) **no están en el diff**: siguen siendo once. | ✅ |
| CA-2 (la tarjeta completa en `/`) | `src/app/layout.tsx`, `src/app/opengraph-image.png`, `src/app/opengraph-image.alt.txt` | `tests/e2e/tarjeta.spec.ts` › *«están los diez campos de Open Graph, y cada uno una sola vez»*| `npx playwright test` verde (caso 209). Repetido por mi cuenta en Chrome contra `next start`: los **diez** campos presentes y únicos, `og:image:width=1200`, `height=630`, `type=image/png`, `alt` no vacío. | ✅ |
| CA-3 (las palabras son las de cada página) | `src/app/layout.tsx` (el `openGraph` **no** declara `title` ni `description`) | `tests/e2e/tarjeta.spec.ts` › *«{/, /ayuda, /legal/aviso-legal}: og:title y og:description coinciden…»* + *«la primera pantalla anuncia su reclamo, no «Stockeiro» a secas»*| Verde (casos 210–213). Repetido por mi cuenta en dos rutas: `/` → `og:title` = «Stockeiro — vigila tus zonas de compra y venta» (**no** «Stockeiro» a secas); `/legal/aviso-legal` → «Aviso legal · Stockeiro». En ambas coincide con su `<title>` y su `description`. R-3 no se ha materializado. | ✅ |
| CA-4 (URL absoluta y del propio origen) | `src/app/layout.tsx` | `tests/e2e/tarjeta.spec.ts` › *«es absoluta, del origen que se está sirviendo, y no apunta a otro sitio»*| Verde (caso 214). En navegador: `og:image` = `http://localhost:3200/opengraph-image.png?opengraph-image.40o9ok3isrrdl.png` — absoluta, mismo origen que el documento, con el hash que pone el framework. | ✅ |
| CA-5 (`twitter:card` grande, misma imagen) | `src/app/layout.tsx` (`twitter: { card: 'summary_large_image' }`) | `tests/e2e/tarjeta.spec.ts` › *«twitter:card es summary_large_image y reutiliza el og:image»*| Verde (caso 215). Medido a mano: `twitter:card=summary_large_image`, `twitter:title`/`twitter:description` heredados y no vacíos, y `twitter:image === og:image` (cadena idéntica). No hay un segundo fichero de imagen en el árbol. | ✅ |
| CA-6 (convención de fichero, nada a mano) | `src/app/opengraph-image.png`, `src/app/opengraph-image.alt.txt` | `tests/tarjeta-frontera.test.ts` › los cuatro casos de *«SPEC-051 CA-6»*| Verde (los cuatro casos). Comprobado aparte: `public/` **no existe**; cero `<meta property="og:` o `name="twitter:` en `src/`; ninguna referencia a la tarjeta en un `<img>`, `preload` ni `url()`. | ✅ |
| CA-7 (PNG 1200×630 opaco) | `scripts/png.mjs`, `scripts/icon-geometry.mjs` (`rasterizarTarjeta`) | `tests/tarjeta-imagen.test.ts` › *«la firma y la cabecera declaran 1200 × 630»*, *«los chunks obligatorios… con su CRC correcto»*, *«decodifica al tamaño exacto y TODOS sus píxeles son opacos»*| Verde. **Verificado con decodificador propio** (script independiente del repo, sólo `node:zlib`): IHDR **1200×630**, profundidad 8, tipo de color 6, entrelazado 0; chunks `IHDR,IDAT,IEND` con **CRC correcto**; **0** píxeles con alfa ≠ 255. | ✅ |
| CA-8 (tres colores, derivados del CSS) | `scripts/icon-geometry.mjs` (`tokensDeMarca`, sin un hexadecimal tecleado) | `tests/tarjeta-imagen.test.ts` › *«los tres tokens están presentes…»*, *«…no llega al 12 % del lienzo»*, *«y ese borde es MEZCLA de dos tokens…»*| Verde. Medido por mi cuenta sobre los píxeles: **105** colores distintos, de los que los tres tokens exactos (`#111110`, `#F5F1EA`, `#FF6B00`) cubren el **99,72 %**; los intermedios son el **0,28 %**, muy por debajo del 12 % contratado. Ni degradado ni cuarto color. | ✅ |
| CA-9 (ni una letra, ni una fuente) | `scripts/icon-geometry.mjs`, `scripts/png.mjs`, `scripts/build-icon.mjs` | `tests/tarjeta-imagen.test.ts` › *«el PNG no lleva ningún chunk de texto»* + *«las formas son las del wordmark que ya existe…»*; `tests/tarjeta-frontera.test.ts` › los cinco casos de *«SPEC-051 CA-9»*| Verde (los dos casos de píxeles + los cinco de código). Confirmado aparte: los chunks del PNG son exactamente `IHDR,IDAT,IEND` — **ningún** `tEXt`/`iTXt`/`zTXt`; el generador sólo importa de `node:*` y de ficheros vecinos, y no nombra ningún `.ttf/.otf/.woff*`. | ✅ |
| CA-10 (geometría y área segura) | `scripts/icon-geometry.mjs` (`TARJETA`, `aLienzo`) | `tests/tarjeta-imagen.test.ts` › los cinco casos de *«SPEC-051 CA-10»*| Verde (los cinco casos). Medido por mi cuenta: caja de tinta x[418,781] y[172,457] → **alto 285 px** (contrato 220–315); centro (599,5 · 314,5) frente a (600 · 315), **0,5 px** de desvío (contrato ≤ 8); márgenes al cuadrado central de 630: **133 / 134 / 172 / 173 px** (contrato ≥ 60). El acento es una sola región, a la derecha y en la mitad inferior, sin tocar el hueso. | ✅ |
| CA-11 (contraste) | `design/tremen-ds/colors_and_type.css` (consumido, no tocado) | `tests/tarjeta-imagen.test.ts` › *«la S contra el lienzo está por encima de 15:1»*, *«el punto… por encima de 6:1»*| Verde. Recalculado por mi cuenta con la fórmula WCAG 2.x: hueso/fondo = **16,78:1** (≥ 15) y acento/fondo = **6,62:1** (≥ 6). | ✅ |
| CA-12 (legible a tamaño de previsualización) | `scripts/icon-geometry.mjs` (escala 13) | `tests/tarjeta-imagen.test.ts` › los tres casos de *«SPEC-051 CA-12»* (reducción por promedio de área a 240×126)| Verde (los tres casos). La reducción a 240×126 está además committeada en `_qa/SPEC-051/tarjeta-240x126.png` y la he mirado: el punto sigue separado y los dos ojos de la S siguen abiertos. | ✅ |
| CA-13 (reproducible por `icon:build`, sin clave nueva) | `scripts/build-icon.mjs` (escribe los **tres** activos), `scripts/png.mjs` (sobre `node:zlib`) | `tests/tarjeta-frontera.test.ts` › los cinco casos de *«SPEC-051 CA-13»*| Verde (los cinco casos). **Reproducido por mí**: `node scripts/build-icon.mjs --out <tmp>` escribe los **tres** activos y `cmp` los da idénticos a los committeados — PNG, SVG **e ICO** (así que SPEC-047 CA-17 tampoco se ha movido). En el diff, `package.json` cambia **sólo** `version`. | ✅ |
| CA-14 (alcanzable por un anónimo) | `src/proxy.ts` (una línea: el `matcher`) | `tests/e2e/tarjeta.spec.ts` › *«la URL que emite el framework responde 200 con image/png»* + *«y también sin cabecera Accept de navegador…»*| Verde (casos 216–217). **Control propio, y es el decisivo**: la misma petición de rastreador (`User-Agent: facebookexternalhit/1.1`, `Accept: */*`) devuelve **200 / image/png** sobre la tarjeta y **307 → /login** sobre `/dashboard`, que sí está dentro del matcher. La exclusión es lo que sostiene el CA; no pasa por vacuidad. | ✅ |
| CA-15 (sin `Set-Cookie`) | `src/proxy.ts` | `tests/e2e/tarjeta.spec.ts` › *«pedir la imagen no trae Set-Cookie y el contexto sigue sin cookies»*| Verde (caso 218). En esa misma petición de rastreador: **ninguna cabecera `set-cookie`**. En `/dashboard`, en cambio, llegan `authjs.csrf-token` y `authjs.callback-url` — exactamente el daño que este CA evita. | ✅ |
| CA-16 (mismos bytes con y sin sesión) | `src/proxy.ts`; `src/lib/auth/guard.ts` **sin tocar** | `tests/e2e/tarjeta.spec.ts` › *«los bytes servidos con sesión y sin ella son idénticos»*; `tests/tarjeta-guardias-ampliadas.test.ts` › *«`PUBLIC_PREFIXES` no crece…»*| Verde (caso 219). `src/lib/auth/guard.ts` **no aparece en el diff** y `PUBLIC_PREFIXES` sigue con sus siete páginas. Los bytes que descargué del servidor (16 853) coinciden con el fichero committeado. | ✅ |
| CA-17 (las **dos** guardias, nombradas y autorizadas) | `tests/legal-rutas-publicas.test.ts:78`, `tests/cuenta-rutas.test.ts:94` (ampliadas con su porqué al lado) | `tests/tarjeta-guardias-ampliadas.test.ts` › los doce casos (17.1 · 17.2 · 17.3 con mutación de control · 17.4)| Verde (los doce casos), y **revisado sobre el diff, que es donde se juzga**: los únicos ficheros ajenos tocados son los **dos** autorizados; en ambos el cambio es *comentario nuevo + el literal del matcher con una exclusión más*, sin `.skip`, sin borrar casos, sin cambiar `toContain` por nada más laxo y sin tocar la hermana. `tests/deploy-gate-workflow.test.ts` **no está en el diff** y no menciona SPEC-051. | ✅ |
| CA-18 (suites verdes; acotación al gate) | — | `npm test` **1644/1644** y `npx playwright test` **278/278** (salidas abajo); `tests/tarjeta-frontera.test.ts` › los cuatro casos de *«SPEC-051 CA-18: los cuatro verdes citados siguen en su sitio»*. **La segunda mitad —«no se modifica ninguna aserción ajena salvo las dos»— es del gate** (ADR-031 pto. 1.2)| Verde, reejecutado por mí sobre el árbol commiteado y limpio: `npm test` → **108 ficheros / 1644 casos / 0 fallos**; `npx playwright test` → **278 pasados** (4,0 min); `npm run lint` y `npm run typecheck` limpios; `npm run version:check` → `exit=0`. **Segunda mitad (la del gate): CUMPLIDA** — de los 19 ficheros del diff sólo **dos** son tests ajenos, los que CA-17 nombra, y ninguna aserción ajena se ha ablandado ni borrado. | ✅ |
| CA-19 (la landing sigue sin pedir nada fuera) | `src/app/layout.tsx` (importa `@/lib/config/app-url`, que no importa nada) | `tests/e2e/tarjeta.spec.ts` › *«todas las peticiones son del propio origen, y ninguna es la tarjeta»*; `tests/legal-import-graph.test.ts` y `tests/ayuda-import-graph.test.ts` **verdes sin tocar**| Verde (caso 220). `tests/legal-import-graph.test.ts` y `tests/ayuda-import-graph.test.ts` **no aparecen en el diff** y pasan en la suite completa. | ✅ |
| CA-20 (alcance acotado — **criterio de gate, no de suite**) | n-a | n-a — **por ADR-031 pto. 1.2, con el porqué escrito debajo; no es una omisión** | **Verificado a mano sobre el diff del árbol commiteado y limpio (`9387681..HEAD`), salida pegada en §Acotación (CA-20). CUMPLIDO**: 19 ficheros, todos dentro del conjunto que la spec permite; ni un fichero bajo `src/db/`, `drizzle/` ni `src/lib/`; `docs/adr/` no gana ninguno; ninguna otra carpeta `_qa/SPEC-NNN/`; en `package.json` sólo `version`. Salvedad menor, sin efecto: en `src/proxy.ts` el diff añade además un bloque de comentario de 24 líneas junto a la única línea de código cambiada — ver §Acotación. | ✅ |

> **CA-20 no lleva fila de test a propósito, y su `n-a` no está en blanco por descuido.**
> Es criterio de acotación y **ADR-031 pto. 1.2** lo saca de la suite: escrito como
> `git diff … origin/main` reproduciría el molde que SPEC-048 tuvo que desmontar —se pone
> verde por vacuidad al mergear—. Lo verifica sdd-verificador sobre el diff de la rama
> **con el árbol limpio** y **pega aquí la salida**. La implementación no ha inventado
> ningún test para rellenarlo.
>
> Lo que sí se ha hecho, porque sí cabe como propiedad del árbol: la parte de CA-20 que
> dice *«ninguna clave nueva en `scripts`»* la afirma
> `tests/tarjeta-frontera.test.ts` › *«`scripts` de package.json tiene EXACTAMENTE las
> mismas claves»*, y la de *«ningún tercer fichero ajeno»* la afirma
> `tests/tarjeta-guardias-ampliadas.test.ts` › *«los únicos ficheros ajenos de tests/ que
> esta spec nombra son esos dos»*.

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

**GREEN — 2026-08-23, sdd-verificador.** 20/20 CA cerrados: 19 con test verde y 1 (CA-20)
verificado a mano en el gate, que es donde la spec lo puso.

Se verificó **sin el informe del implementador, a propósito**: sólo spec, ledger, diff,
código y lo que se observa al ejecutar. Por defecto ningún CA estaba cumplido.

**Gates automáticos, reejecutados por mí sobre el árbol commiteado y limpio:**

| Gate | Resultado |
|---|---|
| `npm test` | **108 ficheros · 1644 casos · 0 fallos** (156 s) |
| `npx playwright test` | **278 pasados** (4,0 min), suite completa |
| `npm run lint` | limpio (`--max-warnings=0`) |
| `npm run typecheck` | limpio |
| `npm run version:check` | `exit=0` — *«La version sube de 0.3.2 a 0.3.3»* |

Los números del implementador coinciden con los míos; no me he fiado de ellos, los he
vuelto a producir.

**Lo que NO he dado por bueno de palabra, y he medido por mi cuenta:**

1. **El PNG, con un decodificador propio** escrito para este gate (sólo `node:zlib`, sin
   tocar `tests/` ni `scripts/` del repositorio, para no medir con la misma regla que
   dibuja). Confirma CA-7 (1200×630, tipo de color 6, sin entrelazar, CRC bueno en los tres
   chunks, **cero** píxeles no opacos), CA-8 (**99,72 %** en los tres tokens exactos,
   **0,28 %** de borde frente al 12 % contratado), CA-9 (chunks exactamente
   `IHDR,IDAT,IEND`: ningún `tEXt`/`iTXt`/`zTXt`), CA-10 (alto **285 px**, centro a
   **0,5 px** del del lienzo, márgenes de **133/134/172/173 px** al cuadrado central) y
   CA-11 (**16,78:1** y **6,62:1**).
2. **La reproducibilidad, ejecutando el generador yo**: los **tres** activos salen
   idénticos byte a byte a los committeados — el PNG **y también `icon.svg` y
   `favicon.ico`**, que es la prueba directa de que SPEC-047 no se ha movido.
3. **Los metadatos servidos, en un navegador de verdad** contra `next start`, en `/` y en
   `/legal/aviso-legal`: los diez campos de Open Graph, `og:title` distinto por página y
   coincidente con el `<title>`, `og:image` absoluto y del propio origen, `twitter:image`
   idéntico a `og:image`, y el `og:image:alt` **sin salto de línea** dentro del atributo.
4. **El control negativo de CA-14/CA-15, que es lo que impide que ese CA pase por
   vacuidad**: con la **misma** petición de rastreador (`facebookexternalhit/1.1`,
   `Accept: */*`), la tarjeta responde **200 / image/png y sin una sola `set-cookie`**,
   mientras que `/dashboard` —que sigue dentro del matcher— responde **307 → /login** y
   estampa `authjs.csrf-token` y `authjs.callback-url`. Es R-1 reproducido en vivo: la
   exclusión del matcher está haciendo trabajo, y el guardián de sesión no se ha aflojado
   para nadie más.

**Las dos guardias ajenas: exactamente dos, y ampliadas, no aflojadas.** El diff toca
`tests/legal-rutas-publicas.test.ts` y `tests/cuenta-rutas.test.ts` y **ningún otro test
ajeno**. En los dos, el cambio es el porqué escrito al lado más el literal del matcher con
**una** exclusión más; sigue siendo una cadena literal comparada con `toContain`, no hay
`.skip`, no se borra ningún caso y las hermanas que miden la propiedad de verdad no se
tocan. `tests/deploy-gate-workflow.test.ts` **no aparece en el diff** y `package.json` no
gana ninguna clave en `scripts`: la tercera guardia de SPEC-047 se ha evitado por diseño
(D-8) y se comprueba que se ha evitado.

**Lo que queda para el ojo del humano, y no lo cierro yo.** CA-12 y la §Geometría dicen que
la tarjeta cumple los números, y los cumple con holgura. Lo que ningún CA mide es **R-4**:
si un lienzo oscuro con la S y el punto centrados representa al producto en un hilo lleno
de enlaces. La evidencia está committeada, es legible y corresponde a lo que la spec pide
(§Evidencia visual). **Esa mirada es del humano**; si dice que no, la spec ya deja escrito
que la salida legítima no es añadir un degradado ni una frase pintada.

### Acotación (CA-20) — el diff de la rama, con el árbol limpio

```
$ git status --porcelain          # (vacío: árbol limpio)
$ git diff --name-status 9387681..HEAD
A	_qa/SPEC-051/tarjeta-1200x630.png
A	_qa/SPEC-051/tarjeta-240x126.png
A	docs/epicas/EPIC-MEJORA/SPEC-051-…-antes-de-entrar.ledger.md
A	docs/epicas/EPIC-MEJORA/SPEC-051-…-antes-de-entrar.md
M	package.json
M	scripts/build-icon.mjs
M	scripts/icon-geometry.mjs
A	scripts/png.mjs
M	src/app/layout.tsx
A	src/app/opengraph-image.alt.txt
A	src/app/opengraph-image.png
M	src/proxy.ts
M	tests/cuenta-rutas.test.ts
A	tests/e2e/tarjeta.spec.ts
M	tests/legal-rutas-publicas.test.ts
A	tests/tarjeta-frontera.test.ts
A	tests/tarjeta-guardias-ampliadas.test.ts
A	tests/tarjeta-imagen.test.ts
A	tests/tarjeta-raster.ts
19 ficheros
```

Contrastado uno a uno con el conjunto que CA-20 permite:

- **Todos** caen dentro de `src/app/opengraph-image.{png,alt.txt}`, `src/app/layout.tsx`,
  `src/proxy.ts`, `scripts/`, `tests/`, `docs/`, `_qa/SPEC-051/` y `package.json`.
  (`src/app/page.tsx` está permitido y **no ha hecho falta tocarlo**.)
- **Ni un fichero** bajo `src/db/`, `drizzle/` ni `src/lib/`: ni un dato, ni un cálculo, ni
  una regla de negocio (**CE-M1**).
- `docs/adr/` **no gana ningún fichero** (**CE-M3**).
- **Ninguna otra** carpeta `_qa/SPEC-NNN/` en el diff.
- En `package.json`, **sólo** `"version": "0.3.2" → "0.3.3"` (**ADR-024**); `scripts`,
  `dependencies` y `devDependencies` intactos (**D-8**).
- Tests ajenos tocados: **dos**, los que CA-17 nombra y el humano autorizó.

**Salvedad anotada, y por qué no la cuento como incumplimiento.** CA-20 dice *«el cambio en
`src/proxy.ts` afecta a una sola línea: la del `matcher`»*. En el diff, ese fichero cambia
**una sola línea de código** —el literal— pero añade además **24 líneas de comentario**
encima. Lo he mirado con lupa y lo doy por dentro de alcance: (a) la afirmación que lleva
peso es la de **CA-16**, *«el cambio se limita a la cadena del `matcher`»*, y se cumple al
pie de la letra; (b) el comentario no cambia ninguna conducta ni afloja nada; y (c) la
propia spec, en **D-8**, mete explícitamente *«dentro del conjunto de CA-20»* una edición
de comentario equivalente (la cabecera de `scripts/build-icon.mjs`), así que trata la
documentación como alcance legítimo y no como desbordamiento. Queda escrito para que
conste que se vio y no se pasó por alto.

### Nota de entorno para quien lea esto después

Correr `npx playwright test` entero **reescribe capturas committeadas de otras specs** bajo
`_qa/SPEC-001…046/` (varias suites e2e las regeneran en cada pasada). Aparecieron como
`M` en `git status` tras mi ejecución y las **restauré con `git checkout -- _qa/`**: no son
obra de SPEC-051 y el árbol quedó igual de limpio que lo encontré. Se dice aquí porque el
siguiente que corra la suite completa se va a llevar el mismo susto. No hubo, en cambio,
ningún fichero fantasma marcado como borrado por longitud de ruta (`core.longpaths=true`
está puesto y funcionó).

## Evidencia visual
<!-- Capturas de trabajo: test-results/SPEC-051/ (ignorado por git). Evidencia que se commitea: _qa/SPEC-051/ -->
<!-- Pedir en el gate: la tarjeta a 1200×630 y su reducción a 240×126, que es como se ve en un hilo. -->

Committeada en `_qa/SPEC-051/`, las dos que §Notas pto. 4 pide mirar:

- `_qa/SPEC-051/tarjeta-1200x630.png` — copia exacta del entregable
  (`src/app/opengraph-image.png`), para verla sin abrir `src/`.
- `_qa/SPEC-051/tarjeta-240x126.png` — la misma reducida por promedio de área, que es el
  orden de magnitud al que se ve en un hilo. Es el tamaño donde se decide si esto
  funciona: los dos ojos de la S siguen abiertos y el punto sigue siendo una cosa aparte.

De trabajo, no committeada: `test-results/SPEC-051/primera-pantalla.png`, que escribe
`tests/e2e/tarjeta.spec.ts` al ejercitar CA-19.

**Lo que la implementación NO puede juzgar y va al ojo del humano (R-4).** La tarjeta es
el fondo oscuro de la app con la S y el punto naranja centrados, y nada más — ni la
palabra «Stockeiro» pintada, ni reclamo (D-1: eso lo pone el foro como texto desde
`og:title`/`og:description`). Cumple todos los números; si aun así no representa al
producto en un hilo lleno de enlaces, el sitio de decirlo es el gate, y la salida
legítima **no** es añadir un degradado ni una frase pintada.

### Mapa de evidencia visual — verificado por sdd-verificador (2026-08-23)

Las dos capturas que §Notas pto. 4 pide **existen, son legibles y corresponden a lo que la
spec pide**. Las he abierto y mirado:

| Fichero | Qué demuestra | Qué se ve |
|---|---|---|
| `_qa/SPEC-051/tarjeta-1200x630.png` | CA-7 · CA-8 · CA-10 · CA-11 — y es **byte a byte** el entregable (`cmp` contra `src/app/opengraph-image.png`: idénticos, 16 853 B) | Lienzo `#111110` a sangre; la S en hueso y el punto ember centrados, con mucho aire; ni una letra, ni degradado, ni sombra |
| `_qa/SPEC-051/tarjeta-240x126.png` | CA-12 — el tamaño al que se ve en un hilo | El punto sigue siendo **una cosa aparte** de la letra y los **dos ojos** de la S siguen abiertos |

Y una tercera, mía y **no committeada** (queda en el transcript del gate, no ensucia el
diff): la tarjeta **tal y como la sirve el servidor**, abierta en Chrome desde la URL con
hash que emite el framework — Chrome rotula la pestaña `opengraph-image.png (1200×630)`,
que es la confirmación de que lo que llega al rastreador es exactamente el fichero
committeado.

**Lo que sigue abierto y es del humano (R-4).** Todo lo anterior dice que la tarjeta
*cumple*. Que *represente al producto* es otra pregunta y no la contesta ningún píxel
medido: la contesta el ojo de quien va a pegar el enlace. Se la lleva el orquestador.

## Evidencia de ejecución

- `npm test` → **108 ficheros, 1644 casos, 0 fallos.**
- `npx playwright test` → **278 pasados** (5,6 min), suite completa.
- `npm run lint` → limpio (`--max-warnings=0`). `npm run typecheck` → limpio.
- `npm run version:check` → `exit=0`, *«La version sube de 0.3.2 a 0.3.3»*, ejecutado
  **sobre el árbol commiteado** (SPEC-049).
- `node scripts/build-icon.mjs --out <tmp>` → escribe `favicon.ico`, `icon.svg` y
  `opengraph-image.png`; los tres coinciden byte a byte con los committeados.
  `tests/icono-frontera.test.ts` (SPEC-047 CA-17) sigue verde **sin tocarse**: el
  generador escribe ahora un tercer fichero y eso no le quita ni le añade nada.

### Control negativo del `matcher` — la prueba de que CA-14/15/16 no pasan por vacuidad

Antes de dar por bueno el cambio de `src/proxy.ts` se hizo el experimento inverso: quitar
`|opengraph-image.png` del literal, reconstruir (el `matcher` se compila en el build) y
volver a correr `tests/e2e/tarjeta.spec.ts`. Resultado: **8 pasados, 4 fallidos**, y los
cuatro son exactamente los que R-1 predice:

```
Error: http://localhost:3200/opengraph-image.png?opengraph-image.40o9ok3isrrdl.png no responde 200
Error: expect(received).toBe(expected)              (la petición sin cabeceras de navegador)
Error: la tarjeta estampa cookie: ha entrado en el flujo de Auth.js
Error: la tarjeta sirve algo distinto según quién la pida: es un estático, no un dato
```

Los ocho de metadatos (CA-2…CA-5, CA-19) seguían verdes: es decir, **la declaración puede
estar perfecta y la vista previa salir vacía sin que nadie vea un error**, que es
literalmente el riesgo por el que la spec escribió CA-14. `src/proxy.ts` quedó restaurado
y reconstruido antes de commitear.

## Salvedades / follow-ups

- **F-SPEC-051-1 — La línea del `matcher` va por su segundo arrastre, y la spec ya escribió
  qué pasa a la tercera.** `src/proxy.ts` mantiene una lista de alternativas sin anclar ni
  escapar (`favicon.ico` empareja el punto como comodín; `api` empareja cualquier ruta que
  empiece por esas letras), copiada carácter a carácter en dos tests ajenos. SPEC-047
  arrastró tres guardias, ésta dos —y sólo dos porque D-8 esquivó la tercera cambiando el
  diseño, no la aserción—. *Destino*: **EPIC-FIX**, con ficha propia, la próxima vez que
  añadir un activo estático cueste tocar un literal ajeno. §Fuera de alcance ya lo deja
  escrito; esto es el recordatorio operativo.
- **F-SPEC-051-2 — `og:url` es global y dice `/` en todas las rutas.** Es exactamente lo que
  D-5 decide (la tarjeta es global; el enlace que se pega es la raíz) y CA-2 sólo exige que
  sea absoluto, así que **no es un incumplimiento**. Pero conviene que conste: `/ayuda` y
  `/legal/aviso-legal` declaran `og:url` de la raíz mientras sus palabras sí son suyas.
  *Destino*: **EPIC-MEJORA**, y lo reabre lo mismo que reabre «una tarjeta distinta por
  página»: que se empiece a compartir el enlace de una pantalla concreta.
- **F-SPEC-051-3 — `tests/tarjeta-raster.ts` repite el concepto de `Analisis`.** El de
  `tests/icono-raster.ts` es **cuadrado** (`raster.size`) y la tarjeta no lo es, así que
  hacía falta una clase rectangular. Se ha importado de allí todo lo agnóstico a la forma
  del lienzo (`hexARgb`, `caja`, `centroide`, `regionesConexas`, `TOLERANCIA_RGB`) y sólo
  se ha reescrito lo que no cabía; **no se ha tocado el fichero ajeno**, porque CA-17 no lo
  autoriza y un tercer fichero modificado es RED. *Destino*: **EPIC-MEJORA** — si una
  tercera superficie necesita medir píxeles, unificar en un helper agnóstico al lienzo; y
  entonces sí con su gate, porque toca un entregable de SPEC-047.
- **F-SPEC-051-4 — Desde ahora `next build` exige `APP_BASE_URL` en cualquier máquina.**
  `appBaseUrl()` lanza si falta y ahora se evalúa en el layout raíz, así que un clon sin
  `.env` que antes construía, ahora falla. **Está declarado y aceptado como diseño** (R-2:
  una tarjeta que apunta a `localhost` en producción es peor que un build rojo), y tanto CI
  (`.github/workflows/ci.yml`, job `E2E`) como producción (`docs/despliegue.md`) la
  definen. Se anota porque cambia la experiencia de quien clone el repositorio, no porque
  haya que arreglarlo: hacerlo tolerante **sería una decisión nueva** y va al gate.
- **F-SPEC-051-5 — `src/app/opengraph-image.alt.txt` va SIN salto de línea final, a
  propósito.** Next vuelca el contenido crudo del fichero en `og:image:alt`, así que un
  `\n` al final acaba dentro del atributo del `<meta>`. Se detectó al inspeccionar el HTML
  construido. No hay guardia automática para esto; queda dicho aquí y en el mensaje de
  commit para que nadie lo «arregle» añadiéndoselo.

### Levantado por sdd-verificador en el gate (2026-08-23)

- **F-SPEC-051-6 — `docs/despliegue.md` afirma algo que esta entrega ha vuelto falso.** La
  advertencia de §0 sobre `APP_BASE_URL` termina diciendo: *«Y ojo: el error es en tiempo de
  **petición**, no de build, así que el deploy sale verde igualmente»*. Era cierto mientras
  `appBaseUrl()` sólo se llamaba al componer el enlace de reset. Desde SPEC-051 se evalúa en
  el **layout raíz**, así que `next build` **falla** si la clave falta — que es justo lo que
  el propio ledger declara y acepta en **F-SPEC-051-4**. **No es un incumplimiento de ningún
  CA**: ninguno exige tocar ese documento, la conducta nueva está declarada y aceptada como
  diseño (R-2), y CI (`ci.yml:148`, job `E2E`, el único que ejecuta `Build`) y producción
  (`docs/despliegue.md:55-56`, cerrado y probado) definen la variable, así que **no hay
  riesgo de despliegue**. Se levanta porque la propia spec sostiene en **D-8** que *«un
  documento de verdad que afirma algo falso es un defecto, no un detalle»* — y ese criterio
  se aplicó a la cabecera de `scripts/build-icon.mjs` y no a esta frase. *Destino*:
  **EPIC-FIX** o el próximo repaso de `docs/despliegue.md`; es una frase, no un cambio de
  conducta.

## Cómo retomar (handoff)

- **Qué se entregó, en una línea**: `src/app/opengraph-image.png` (16,8 KB, 1200×630,
  opaco, tres colores) más su `.alt.txt`, declarados por Next desde la convención de
  fichero gracias al `metadataBase` del layout, y alcanzables por un rastreador anónimo
  gracias a una línea de `src/proxy.ts`.
- **El generador es el de siempre.** `npm run icon:build` escribe ahora **tres** activos.
  Si tocas `scripts/icon-geometry.mjs` o `scripts/png.mjs`, **ejecuta `npm run icon:build`
  y comete el resultado**: `tests/tarjeta-frontera.test.ts` y `tests/icono-frontera.test.ts`
  comparan byte a byte y se caen el mismo día.
- **La escala de la tarjeta es `TARJETA.escala = 13`** en `scripts/icon-geometry.mjs`. No es
  un número mágico: 22 unidades de rejilla × 13 = 286 px de altura de mayúscula, dentro del
  35–50 % de 630 que fija §Geometría, y la marca entera (28 × 13 = 364 px) cabe en el
  cuadrado central de 630 con sus 60 px de aire. Moverlo rompe CA-10 por los dos lados.
- **Guardias ajenas: son DOS, y siguen siendo dos.** `tests/legal-rutas-publicas.test.ts:78`
  (SPEC-035 CA-2) y `tests/cuenta-rutas.test.ts:94` (SPEC-036 CA-10), ampliadas con su
  porqué al lado de la aserción y con la fecha del arbitraje. La tercera,
  `tests/deploy-gate-workflow.test.ts`, **no se ha abierto**: ni siquiera menciona
  SPEC-051, y `tests/tarjeta-guardias-ampliadas.test.ts` lo comprueba. Un tercer fichero
  ajeno modificado sigue siendo RED.
- **Nada alimenta una aserción con `origin/main`, `main` ni `HEAD`** (ADR-031, RI-03).
  Ninguno de los cuatro ficheros nuevos invoca git: todo lo que afirman es una propiedad
  del árbol de hoy, y por eso funcionan igual en un clon superficial.
  `tests/revision-movil-en-tests.test.ts` los barre y sigue en cero infracciones.
- **Lo que queda para el gate**: **CA-20** entero (el diff de la rama con el árbol limpio,
  con la salida pegada arriba) y la segunda mitad de **CA-18** (que no se modifique ninguna
  aserción ajena salvo las dos que CA-17 nombra). Y la mirada del humano sobre la tarjeta,
  que es la única parte de esto que ningún test puede cerrar.
- **Sin PR y sin merge**: la rama queda tal cual, con el árbol limpio, para sdd-verificador.
