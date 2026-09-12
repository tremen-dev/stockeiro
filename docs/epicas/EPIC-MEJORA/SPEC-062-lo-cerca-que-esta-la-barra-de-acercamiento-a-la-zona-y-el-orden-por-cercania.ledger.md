---
id: SPEC-062
tipo: ledger
epica: EPIC-MEJORA
---
# Ledger — SPEC-062 Lo cerca que esta la barra de acercamiento a la zona y el orden por cercania

## Resumen
- Fase: **en-revisión** — implementada el 2026-09-13, pendiente del veredicto del verificador
- Rama: `ft/SPEC-062-lo-cerca-que-esta-de-su-zona`
- Versión: **0.6.0** (minor: capacidad visible nueva; `package.json` + `package-lock.json` en el mismo commit, ADR-033)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `src/lib/watchlist/acercamiento.ts` (`distanciaAZona`, `acercamientoDeVigilada`: `null` = ausencia) | `tests/spec062-acercamiento.test.ts` › «CA-1 …» × 6 (sin cotización · zona a medias · sin zonas · precio no positivo · **sí hay medida** · cero ≠ ausencia) | | 🚧 |
| CA-2 | `acercamiento.ts` (`distanciaAZona`: borde más cercano / precio, con sentido) | `tests/spec062-acercamiento.test.ts` › «CA-2 …» × 4, con los dos especímenes de la spec (4,12 → 3,2% bajar · 3,70 → 2,7% subir) y el contraste contra el denominador equivocado | | 🚧 |
| CA-3 | `acercamiento.ts` (pregunta a `entraEnZona` antes de restar) | `tests/spec062-acercamiento.test.ts` › «CA-3 …» × 3 (centro y los dos extremos exactos) | | 🚧 |
| CA-4 | `acercamiento.ts` (llama a `entraEnZona`; no reimplementa la pertenencia) | `tests/spec062-acercamiento.test.ts` › «CA-4 … barrido que cruza los dos bordes», con centinela de no-vacuidad por los dos lados | | 🚧 |
| CA-5 | `acercamiento.ts` (`Decimal` de principio a fin) | `tests/spec062-acercamiento.test.ts` › «CA-5 …» × 2: el caso discriminante `1,15 / 1,10` difiere en `number` y sale exacto en decimal | | 🚧 |
| CA-6 | `src/app/vigiladas/columnas-vigiladas.tsx` (bloque `.acercamiento` dentro de `estado-caja`) · `src/lib/watchlist/zone-status.ts` (el dato viaja ya resuelto) | `tests/spec062-vista-y-vocabulario.test.ts` › «CA-6 …» × 7 (PGlite) · `tests/e2e/spec062-acercamiento.spec.ts` › tabla y **tarjeta a 390 px**, mismo texto y mismo nombre accesible | | 🚧 |
| CA-7 | `acercamiento.ts` (`acercamientoDeVigilada`: dentro gana · menor distancia · empate → compra) | `tests/spec062-acercamiento.test.ts` › «CA-7 …» × 5, incluido el **espejo** que prueba que el empate no depende del orden de evaluación · e2e `Z6VENTA` | | 🚧 |
| CA-8 | `acercamiento.ts` (`fraccionDeBarra`, acotada) · `src/lib/config/escala-acercamiento.ts` (`ESCALA_ACERCAMIENTO_PCT = 10`, un solo hogar) · `src/app/globals.css` | `tests/spec062-acercamiento.test.ts` › «CA-8 …» × 5 · e2e › «la fracción pintada coincide con la calculada, fila a fila» (dos medidas, ADR-035) y «a media distancia, media barra» | | 🚧 |
| CA-9 | `acercamiento.ts` (`textoDeAcercamiento`, `FLECHA`) | `tests/spec062-acercamiento.test.ts` › «CA-9/CA-10 …» × 2 · e2e › `Z6DEBAJO` (subir) contra `Z6LEJOS` (bajar), misma zona y precios a cada lado | | 🚧 |
| CA-10 | `columnas-vigiladas.tsx` (`role="img"` + `aria-label`; carril y texto `aria-hidden`) · `acercamiento.ts` (`nombreAccesibleDeAcercamiento`) | `tests/spec062-acercamiento.test.ts` › «… el nombre accesible dice lo mismo …» · e2e › «el nombre accesible dice la frase entera, sin flechas ni barras» | | 🚧 |
| CA-11 | `src/lib/watchlist/sort.ts` (`cercania`, `ausenciaAlFinal`, `distancia`) · `src/app/vigiladas/watched-table.tsx` (el `<th>` de Estado marca también `cercania`) | `tests/spec062-orden-por-cercania.test.ts` › 9 casos (asc · desc · la ausencia no se invierte · desempate estable · los otros criterios intactos) · e2e › el orden real en pantalla, **derivado** del escenario | | 🚧 |
| CA-12 | `sort.ts` (`ordenarVigiladas` copia y no muta) | `tests/spec062-orden-por-cercania.test.ts` › «CA-12 …» × 3 · e2e › «reordenar no cambia lo que dice ninguna fila» | | 🚧 |
| CA-13 | `acercamiento.ts` (`porcentajeVisible`: «menos de 0,1%», un decimal, coma) | `tests/spec062-acercamiento.test.ts` › «CA-13 …» × 4 · e2e › `Z6CASI` a 0,04% sigue con `zone-out` y `Z6DENTRO` con `zone-buy` | | 🚧 |
| CA-14 | `columnas-vigiladas.tsx` (`data-sin-refrescar`) · `globals.css` (`opacity: .55`) | `tests/spec062-vista-y-vocabulario.test.ts` › «CA-14 …» × 2 (con marca y sin ella; la medida NO cambia) · e2e › `Z6VIEJA` marcada, `Z6CERCA` no | | 🚧 |
| CA-15 | `acercamiento.ts` (textos) · `src/lib/help/content.ts` (prosa) | `tests/spec062-acercamiento.test.ts` › «CA-15 …» × 2, **en las dos direcciones**: los textos de la spec no se cazan, y una frase que aconseja sí | | 🚧 |
| CA-16 | `docs/fundacion/reglas.md` (**RN-18**) · `docs/fundacion/dominio.md` («Acercamiento a zona») | `tests/spec062-vista-y-vocabulario.test.ts` › «CA-16 …» × 3 · `tests/reglas-ingenieria*.test.ts` (RN-18 en la serie) | | 🚧 |
| CA-17 | `src/lib/config/escala-acercamiento.ts` · `src/lib/help/content.ts` (`ZONAS`, dos párrafos nuevos) | `tests/spec062-vista-y-vocabulario.test.ts` › «CA-17 …» × 4 (deriva el tramo · no teclea el número · dice qué no es y avisa del split · sin afirmaciones prohibidas) | | 🚧 |
| CA-18 | — (propiedad de no-regresión, sin guardia congelada: ADR-031/ADR-037) | Batería completa a HEAD de la rama: `npm test` y `npx playwright test` **338/338** | | 🚧 |
| CA-19 | `tests/vigiladas-orden.test.ts` y `tests/e2e/vigiladas-orden.spec.ts` (dos guardias re-encuadradas, con su declaración escrita al lado) | Las propias guardias re-encuadradas · `tests/spec062-orden-por-cercania.test.ts` › «los criterios que ya existían siguen ofrecidos, en su orden» | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-062/. Informe HTML opcional: _qa/SPEC-062/informe.html -->

| CA | Captura |
|---|---|
| CA-6 (tabla) | `_qa/SPEC-062/tabla-cercania-1280.png` — las nueve filas del escenario a 1280 px |
| CA-6 (tarjeta) | `_qa/SPEC-062/tarjetas-cercania-390.png` — las mismas, como tarjetas a 390 px |

## Salvedades / follow-ups
<!-- IDs F-SPEC-062-1, F-SPEC-062-2… con destino (spec futura o EPIC-MEJORA). -->

- **F-SPEC-062-1 — Una zona escrita antes de un split enseña una distancia con cara de dato
  exacto.** Es el aviso 2 del dictamen de sdd-mercados y **no se resuelve aquí**: el precio es
  el último cierre **no ajustado** (RN-12) y las zonas las escribió el usuario a mano. Lo que
  esta spec hace es **acotar el daño** —un solo decimal, y un párrafo en `/ayuda` que dice que
  si ha habido split conviene revisar la zona— y dejarlo escrito. El estado de zona ya sufre
  lo mismo desde SPEC-003 y dice «Fuera». **Destino**: lo reabriría el stand-by de eventos
  corporativos (roadmap, «Más adelante»), o un tester que reporte el caso.
- **F-SPEC-062-2 — La escala vive en `src/lib/config/` por una restricción de otra spec.**
  `ESCALA_ACERCAMIENTO_PCT` habría ido junto a la función que la usa, pero `/ayuda` **cuenta
  el mismo tramo** y tiene prohibido por guardia alcanzar `src/lib/watchlist/` (SPEC-039
  CA-14: la ayuda responde con la base caída). Sacarla a `config/` mantiene **un solo hogar**
  sin tocar la guardia ajena. **Destino**: ninguno — se documenta para que nadie la «arregle»
  moviéndola de vuelta y rompa el grafo de imports de la ayuda.
- **F-SPEC-062-3 — El aviso por acercamiento sigue sin casa.** Queda fuera por decisión del
  humano del 2026-09-13. **Destino**: roadmap, «Más adelante» («Zonas calientes»), donde ya
  consta que la mitad visual la entrega esta spec y que el aviso necesita gate y ADR propios.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

### Lo que hay que saber para tocar esto

1. **La medida vive en un solo sitio y no habla con la base**:
   `src/lib/watchlist/acercamiento.ts`. La consume `zoneStatusForUser` (servidor) y viaja
   resuelta en la fila. Si algún día parece práctico recalcularla en el cliente, **no**: sería
   la segunda definición de RN-18, que es justo lo que `sort.ts` lleva evitando desde SPEC-041
   con el `state`.
2. **El cero y la ausencia son cosas distintas.** `null` = no se sabe; `porcentaje: '0'` =
   dentro de la zona. Media spec son casos que defienden esa frontera, incluido el «menos de
   0,1%» de CA-13, que existe para que el redondeo no pueda fabricar una entrada en zona y
   hacer parecer roto al motor de disparo.
3. **La barra vive en la celda de Estado**, no en una columna propia. La tabla de nueve
   columnas ya no cabe a 730–760 px y una décima empuja justo ahí (lo dicen las guardias de
   `tarjetas-geometria.spec.ts`). Si algún día la celda queda apretada, la salida es
   **apilar**, no encoger (ADR-034 §10).

### Dos cosas que costaron tiempo y conviene no volver a descubrir

4. **El carril de la barra no lleva `border`, y es una decisión medida.** Con `border: 1px` el
   carril mide 64 px por fuera y 62 por dentro, y un relleno al 100% —posicionado contra la
   caja interior— cubría el **96,9%** de lo que se ve. Lo cazó la guardia de CA-8 al comparar
   la fracción pintada contra la calculada, que es exactamente para lo que está (ADR-026 /
   ADR-035: dos medidas, nunca una medida contra un umbral). El contraste lo da el color.
5. **El e2e necesita un `build` de ESTE árbol.** `npx playwright test` arranca `next start`,
   así que sin `npm run build` previo falla con *«Could not find a production build»*, y con
   un build viejo daría verde sobre código que no es el que se está tocando. Para construir en
   un worktree recién creado hacen falta `APP_BASE_URL`, `AUTH_SECRET` y `DATABASE_URL`
   (cualquiera válida: el e2e la reescribe al arrancar su Postgres efímero).

### Decisiones tomadas por el camino que conviene que el humano vea

6. **Dos guardias ajenas re-encuadradas, declaradas en CA-19** (`tests/vigiladas-orden.test.ts`
   y `tests/e2e/vigiladas-orden.spec.ts`): congelaban la lista de criterios de orden por
   **igualdad exacta contra una lista literal**, que es el patrón que ADR-037 declara no
   superviviente. Ahora afirman **pertenencia + posición**: «Ticker» sigue el primero y los
   tres criterios de SPEC-041 siguen ofrecidos en su orden. Se pueden seguir poniendo rojas
   —quitando «Nombre» del selector o destronando a «Ticker»—; dejan de ponerse rojas porque
   alguien añada un criterio.
   ⚠️ Quien las toca es quien se beneficia, y por eso está escrito aquí y en la spec.
7. **RN-18 entra en la serie de dominio**, y con ella las dos listas-censo de
   `tests/reglas-ingenieria*.test.ts`, por la misma vía por la que entraron RN-16 (SPEC-043) y
   RN-17 (SPEC-058): el arquitecto abre el hueco en el gate (ADR-025).
8. **La barra se apaga con el precio viejo** (`data-sin-refrescar`, `opacity: .55`). No estaba
   en la letra de CA-14 —que pedía «la misma marca que el precio»— y se decidió al
   implementar: sin ella, la única señal era estar en la misma celda que `.quote-stale`, y una
   barra casi llena convence más que un aviso en gris. Es lo que el dictamen de sdd-mercados
   llamaba «donde más daño hace».
