---
id: SPEC-033
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-033 La puerta post-deploy deja de perder la carrera: con --commit, unknown es transitorio

## Resumen
- Fase: **implementada por sdd-implementador el 2026-08-19**, en `en-revision`. Pendiente del
  **verificador**. La fuente de verdad del estado es el frontmatter de la spec.
- Escrita por sdd-arquitecto el 2026-08-19 y **aprobada en el gate humano** (Alberto Fojo) el
  mismo día, con sus tres decisiones cerradas: el veredicto sigue siendo el **2**, el `builtAt`
  **informa pero no decide**, y hay **permiso firmado** para editar un caso —uno— de
  `tests/check-alive.test.ts`.
- Rama: `ft/SPEC-033-carrera-check-alive` (worktree `.claude/worktrees/spec-033`), sobre
  `origin/main` @ `0d389c8` — el mismo merge cuyo job `Alive` salió rojo y que motiva esta spec.
- **Sin ADR nuevo.** ADR-018 D-6 ya decide que la puerta *espera y falla si no llega en un plazo*;
  esta spec devuelve el script a esa letra. Justificación en §Entidades y en §Notas punto 4.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 la carrera se deja de perder (`unknown`→sha → 0) | `scripts/check-alive.mjs` (rama `unknown` con `esperado !== null`: deja de salir y sigue el bucle) | `tests/check-alive-carrera.test.ts` › *SPEC-033 CA-1* (2 casos: el 0, y el contador ≥ 4 peticiones) | | 🚧 |
| CA-2 el plazo se usa de verdad; 2 al expirar | `scripts/check-alive.mjs` (`ultimaIdentidad` + veredicto de plazo agotado con `SALIDA.DESCONOCIDO`) | `tests/check-alive-carrera.test.ts` › *SPEC-033 CA-2* (2 casos: código + tiempo 2,7 s ≤ t < 12 s; y el texto de SPEC-031 que sobrevive) | | 🚧 |
| CA-3 el 2 es comprensible: esperado, `unknown`, `builtAt`, las dos causas | `scripts/check-alive.mjs` (bloque `Dos causas posibles, y el builtAt de arriba es lo que las separa`) | `tests/check-alive-carrera.test.ts` › *SPEC-033 CA-3* (2 casos: los tres datos; y las dos causas + desempate) | | 🚧 |
| CA-4 una línea al primer `unknown`, exactamente una | `scripts/check-alive.mjs` (`avisadoDeLaEspera`, línea `sigo esperando a …`) | `tests/check-alive-carrera.test.ts` › *SPEC-033 CA-4* (2 casos: la línea lleva el `builtAt`; y aparece 1 vez con 4 sondeos `unknown`) | | 🚧 |
| CA-5 modo *smoke* intacto: terminal e inmediato | `scripts/check-alive.mjs` (rama `esperado === null`, con el mensaje de SPEC-031 sin tocar) | `tests/check-alive-carrera.test.ts` › *SPEC-033 CA-5* + `tests/check-alive.test.ts` › *SPEC-031 CA-11* › «modo smoke también es 2» (**palabra por palabra**, sin editar) | | 🚧 |
| CA-6 ningún código de salida cambia de significado | `scripts/check-alive.mjs` (`SALIDA` intacto; salidas 0/1/3 sin tocar) | `tests/check-alive.test.ts` **22/22** (con la única edición de CA-8) + `tests/spec-031-frontera.test.ts` **verde sin tocarlo** | | 🚧 |
| CA-7 `scripts/` con tres habitantes; la puerta no cambia | `.github/workflows/deploy-gate.yml`: **solo el comentario** del código 2 (`git diff` → 13 `+` / 5 `−`, todas líneas `#`) | `tests/deploy-gate-workflow.test.ts` **34/34 sin tocarlo** (5.5 cuenta los tres ficheros de `scripts/`; 4.2 y 7.2 vigilan `secrets.`, `node-version:` y `continue-on-error` sobre el texto crudo) | | 🚧 |
| CA-8 los tests ajenos tocados son exactamente los declarados | n-a (es una propiedad del diff) | `git diff --stat 0d389c8..HEAD` → bajo `tests/` solo `check-alive-carrera.test.ts` (nuevo) y `check-alive.test.ts` (1 caso retitulado). Los 7 prohibidos, verdes y sin tocar | | 🚧 |
| CA-9 la regla nueva escrita en cabecera, §10, §12.2 y §12.3 | `scripts/check-alive.mjs` (cabecera + `USO`; el bloque de códigos acaba en la **línea 32**, dentro de la ventana de 60) · `docs/despliegue.md` §10 (fila del **2** y bloque «El comando»), §12.2 (el incidente con fecha y sha) y §12.3 (fila del **2**) | `tests/check-alive-carrera.test.ts` › *SPEC-033 CA-9.1* (cabecera y `--help`) + `tests/runbook-check-alive.test.ts` y `tests/runbook-despliegue-automatico.test.ts` **verdes sin tocarlos** | | 🚧 |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
**n-a**: esta spec no toca UI. No hay captura que hacer y `_qa/SPEC-033/` no debe existir. La
evidencia es la salida de los subprocesos contra servidores de juguete en *loopback*.

## Salvedades / follow-ups
<!-- IDs F-SPEC-033-1, F-SPEC-033-2… con destino (spec futura o EPIC-MEJORA). -->

**Sin follow-ups**: los nueve CA quedan cubiertos, nada se quedó a medias y no apareció trabajo
necesario fuera de ellos. Dos cosas que sí conviene que el verificador sepa, declaradas aquí y no
descubiertas por él (que es la lección de `F-SPEC-032-3`):

1. **El fichero nuevo lleva un bloque de más: `SPEC-033 CA-9.1`.** CA-8 lo describe como el sitio
   «donde viven CA-1 … CA-5», y esa frase se ha respetado en lo que restringe —la **lista de
   ficheros**, que sigue siendo exactamente dos—. El bloque extra son dos casos que afirman que la
   cabecera del script y su `--help` dicen la regla nueva (*smoke* / *transitorio* / SPEC-033), y
   que el bloque de códigos de salida sigue dentro de la ventana de 60 líneas. Sin ellos, CA-9.1
   sería el único punto de esta spec verificable solo a ojo, y la regla del rol es que **un CA sin
   test no está implementado**. No se creó ningún fichero adicional para alojarlos, precisamente
   para no tocar la lista cerrada de CA-8.
2. **El caso retitulado de `tests/check-alive.test.ts` pasó a rojo antes de pasar a verde.** Con la
   aserción de tiempo añadida (`>= 1800 ms`) falla contra el script viejo, que salía en ~50 ms. Es
   la comprobación que la spec pedía: sin ella el caso «seguiría pasando sin tocarlo», que era
   justamente el argumento para tocarlo.

## Cómo retomar (handoff)
Implementación **completa** en la rama `ft/SPEC-033-carrera-check-alive` (worktree
`.claude/worktrees/spec-033`), sobre `origin/main` @ `0d389c8`. **Sin push y sin PR**: lo hace el
orquestador tras el verificador.

Tres commits, en orden RED → GREEN → docs:

| Sha | Qué |
|---|---|
| `2b8fd46` | `test(SPEC-033)`: RED. Spec y ledger (venían *untracked*), `tests/check-alive-carrera.test.ts` nuevo y la única edición autorizada de `tests/check-alive.test.ts` |
| `4407bab` | `feat(SPEC-033)`: `scripts/check-alive.mjs` — `unknown` transitorio con `--commit`, el aviso único, el veredicto con las dos causas, cabecera y `--help` |
| `f528a45` | `docs(SPEC-033)`: el comentario del código 2 en `deploy-gate.yml` y las tres reescrituras de `docs/despliegue.md` |

Cómo verificarlo, todo **en local, sin desplegar y sin red** (la ventana se simula con `node:http`
en *loopback* y el script corre como subproceso real):

```bash
npm ci                                   # el worktree no traía node_modules propio
npx vitest run tests/check-alive-carrera.test.ts tests/check-alive.test.ts
npx vitest run tests/spec-031-frontera.test.ts tests/spec-032-frontera.test.ts \
  tests/ci-workflow.test.ts tests/deploy-gate-workflow.test.ts \
  tests/runbook-check-alive.test.ts tests/runbook-despliegue-automatico.test.ts \
  tests/reglas-ingenieria-hecho-vivo.test.ts        # los 7 prohibidos, verdes SIN tocarlos
npm run typecheck && npm run lint && npm test
git diff --stat 0d389c8..HEAD                        # CA-7.4 y CA-8: la lista de ficheros
```

Resultados obtenidos el 2026-08-19: **33/33** los dos primeros ficheros, **140/140** los siete
prohibidos, **769/769** la suite entera, typecheck y lint limpios, y el diff toca **7 ficheros**
—ninguno de ellos `ci.yml`, `vercel.json`, `src/` ni `drizzle/`—.

Lo que queda para después del verificador, y no es de esta rama:
- **El propio merge de esta spec es su mejor verificación**: su job `Alive` debe salir **verde a la
  primera**, sin relanzarlo. Ese run sirve además como evidencia **RI-02** para desbloquear el
  cierre de **SPEC-028**, que sigue en `en-revision` con cuatro CA 🚀.
- **EPIC-FIX no se cierra**: es una épica *bucket*, transversal y siempre abierta.
