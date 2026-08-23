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
| CA-1 (`metadataBase` desde `appBaseUrl()`) | `src/app/layout.tsx` (`metadataBase: new URL(appBaseUrl())`) | `tests/tarjeta-frontera.test.ts` › *«aparece UNA sola vez en todo src/…»*, *«su valor se construye con `appBaseUrl()`…»*, *«no hay ningún origen absoluto alternativo en src/»* | | ❌ |
| CA-2 (la tarjeta completa en `/`) | `src/app/layout.tsx`, `src/app/opengraph-image.png`, `src/app/opengraph-image.alt.txt` | `tests/e2e/tarjeta.spec.ts` › *«están los diez campos de Open Graph, y cada uno una sola vez»* | | ❌ |
| CA-3 (las palabras son las de cada página) | `src/app/layout.tsx` (el `openGraph` **no** declara `title` ni `description`) | `tests/e2e/tarjeta.spec.ts` › *«{/, /ayuda, /legal/aviso-legal}: og:title y og:description coinciden…»* + *«la primera pantalla anuncia su reclamo, no «Stockeiro» a secas»* | | ❌ |
| CA-4 (URL absoluta y del propio origen) | `src/app/layout.tsx` | `tests/e2e/tarjeta.spec.ts` › *«es absoluta, del origen que se está sirviendo, y no apunta a otro sitio»* | | ❌ |
| CA-5 (`twitter:card` grande, misma imagen) | `src/app/layout.tsx` (`twitter: { card: 'summary_large_image' }`) | `tests/e2e/tarjeta.spec.ts` › *«twitter:card es summary_large_image y reutiliza el og:image»* | | ❌ |
| CA-6 (convención de fichero, nada a mano) | `src/app/opengraph-image.png`, `src/app/opengraph-image.alt.txt` | `tests/tarjeta-frontera.test.ts` › los cuatro casos de *«SPEC-051 CA-6»* | | ❌ |
| CA-7 (PNG 1200×630 opaco) | `scripts/png.mjs`, `scripts/icon-geometry.mjs` (`rasterizarTarjeta`) | `tests/tarjeta-imagen.test.ts` › *«la firma y la cabecera declaran 1200 × 630»*, *«los chunks obligatorios… con su CRC correcto»*, *«decodifica al tamaño exacto y TODOS sus píxeles son opacos»* | | ❌ |
| CA-8 (tres colores, derivados del CSS) | `scripts/icon-geometry.mjs` (`tokensDeMarca`, sin un hexadecimal tecleado) | `tests/tarjeta-imagen.test.ts` › *«los tres tokens están presentes…»*, *«…no llega al 12 % del lienzo»*, *«y ese borde es MEZCLA de dos tokens…»* | | ❌ |
| CA-9 (ni una letra, ni una fuente) | `scripts/icon-geometry.mjs`, `scripts/png.mjs`, `scripts/build-icon.mjs` | `tests/tarjeta-imagen.test.ts` › *«el PNG no lleva ningún chunk de texto»* + *«las formas son las del wordmark que ya existe…»*; `tests/tarjeta-frontera.test.ts` › los cinco casos de *«SPEC-051 CA-9»* | | ❌ |
| CA-10 (geometría y área segura) | `scripts/icon-geometry.mjs` (`TARJETA`, `aLienzo`) | `tests/tarjeta-imagen.test.ts` › los cinco casos de *«SPEC-051 CA-10»* | | ❌ |
| CA-11 (contraste) | `design/tremen-ds/colors_and_type.css` (consumido, no tocado) | `tests/tarjeta-imagen.test.ts` › *«la S contra el lienzo está por encima de 15:1»*, *«el punto… por encima de 6:1»* | | ❌ |
| CA-12 (legible a tamaño de previsualización) | `scripts/icon-geometry.mjs` (escala 13) | `tests/tarjeta-imagen.test.ts` › los tres casos de *«SPEC-051 CA-12»* (reducción por promedio de área a 240×126) | | ❌ |
| CA-13 (reproducible por `icon:build`, sin clave nueva) | `scripts/build-icon.mjs` (escribe los **tres** activos), `scripts/png.mjs` (sobre `node:zlib`) | `tests/tarjeta-frontera.test.ts` › los cinco casos de *«SPEC-051 CA-13»* | | ❌ |
| CA-14 (alcanzable por un anónimo) | `src/proxy.ts` (una línea: el `matcher`) | `tests/e2e/tarjeta.spec.ts` › *«la URL que emite el framework responde 200 con image/png»* + *«y también sin cabecera Accept de navegador…»* | | ❌ |
| CA-15 (sin `Set-Cookie`) | `src/proxy.ts` | `tests/e2e/tarjeta.spec.ts` › *«pedir la imagen no trae Set-Cookie y el contexto sigue sin cookies»* | | ❌ |
| CA-16 (mismos bytes con y sin sesión) | `src/proxy.ts`; `src/lib/auth/guard.ts` **sin tocar** | `tests/e2e/tarjeta.spec.ts` › *«los bytes servidos con sesión y sin ella son idénticos»*; `tests/tarjeta-guardias-ampliadas.test.ts` › *«`PUBLIC_PREFIXES` no crece…»* | | ❌ |
| CA-17 (las **dos** guardias, nombradas y autorizadas) | `tests/legal-rutas-publicas.test.ts:78`, `tests/cuenta-rutas.test.ts:94` (ampliadas con su porqué al lado) | `tests/tarjeta-guardias-ampliadas.test.ts` › los doce casos (17.1 · 17.2 · 17.3 con mutación de control · 17.4) | | ❌ |
| CA-18 (suites verdes; acotación al gate) | — | `npm test` **1644/1644** y `npx playwright test` **278/278** (salidas abajo); `tests/tarjeta-frontera.test.ts` › los cuatro casos de *«SPEC-051 CA-18: los cuatro verdes citados siguen en su sitio»*. **La segunda mitad —«no se modifica ninguna aserción ajena salvo las dos»— es del gate** (ADR-031 pto. 1.2) | | ❌ |
| CA-19 (la landing sigue sin pedir nada fuera) | `src/app/layout.tsx` (importa `@/lib/config/app-url`, que no importa nada) | `tests/e2e/tarjeta.spec.ts` › *«todas las peticiones son del propio origen, y ninguna es la tarjeta»*; `tests/legal-import-graph.test.ts` y `tests/ayuda-import-graph.test.ts` **verdes sin tocar** | | ❌ |
| CA-20 (alcance acotado — **criterio de gate, no de suite**) | n-a | n-a | | ❌ |

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
