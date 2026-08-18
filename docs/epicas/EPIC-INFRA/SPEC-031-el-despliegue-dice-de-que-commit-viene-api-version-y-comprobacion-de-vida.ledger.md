---
id: SPEC-031
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-031 El despliegue dice de qué commit viene: `/api/version` y comprobación de vida

## Resumen
- Fase: spec escrita por el arquitecto y **pasada por el gate humano el 2026-08-18 (Alberto
  Fojo): aprobada con un cambio y una decisión aplazada**. Sin implementación todavía. La
  fuente de verdad del estado es el frontmatter de la spec, y la transición la registra el
  orquestador con `estado.mjs`.
- **Resoluciones del gate**, ya aplicadas al texto de la spec:
  1. **La sentinela del contrato es `unknown`, no `desconocido`** (§CA-3, CA-4, CA-8 código de
     salida 2, CA-11). Decisión del humano **en contra de la recomendación del arquitecto**,
     por coherencia con la regla del proyecto (código e identificadores en inglés) y con las
     claves del JSON. Se aparta de la **letra** de ADR-018 D-6, no de su decisión: D-6 fija
     propiedades, no nombres. **ADR-018 no se ha tocado** y sus citas literales se conservan.
  2. **ADR-018 D-7 ("hecho" exige "vivo"): aplazada** → **F-SPEC-031-1**.
- Rama: `ft/SPEC-031-identidad-del-despliegue`
  (worktree `.claude/worktrees/spec-031`, basado en `origin/main` @ `2702111`)
- Origen: punto **3** del desglose orientativo de **ADR-018**. El punto 4 es **SPEC-028**
  (id reservado, referenciado por nombre desde ADR-018 y desde el ledger de SPEC-027).

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 Endpoint público, cuerpo exacto | `src/app/api/version/route.ts` | `tests/version-endpoint.test.ts` (CA-1: 5 casos) · `tests/e2e/version.spec.ts` (CA-1, sin sesión) | | ❌ |
| CA-2 Identidad congelada en el build | `src/lib/version/identity.ts` (`deploymentIdentity`, resuelto al cargar) · `next.config.mjs` (`env`) · `src/lib/version/build-identity.mjs` | `tests/version-endpoint.test.ts` (CA-2: mutar `process.env` entre dos peticiones) · `tests/version-build-channel.test.ts` (8 casos: `env`, derivación, `grep VERCEL_GIT_` sobre `src/`) | | ❌ |
| CA-3 `unknown` (ausente / vacío / mal formado) | `src/lib/version/identity.ts` (`resolveIdentity`, `UNKNOWN`) | `tests/version-identity.test.ts` (31 casos) · `tests/version-endpoint.test.ts` («sha vacío → 200 y `unknown`») | | ❌ |
| CA-4 Fallback a git local, fail-safe | `src/lib/version/build-identity.mjs` (`gitHeadSha`, `buildIdentity`) | `tests/version-build-identity.test.ts` (10 casos: binario sustituido, dir sin repo, `PATH` recortado) · `tests/e2e/version.spec.ts` (CA-4 en build local) | | ❌ |
| CA-5 Responde con la BD caída | `src/app/api/version/route.ts` (único import: la identidad) | `tests/version-import-graph.test.ts` (grafo transitivo) · `tests/version-endpoint.test.ts` (sin `DATABASE_URL`) | | ❌ |
| CA-6 `Cache-Control: no-store` + render dinámico | `src/app/api/version/route.ts` (`no-store`, `dynamic = 'force-dynamic'`) | `tests/version-endpoint.test.ts` (CA-6: 2 casos) · `tests/e2e/version.spec.ts` (CA-6) | | ❌ |
| CA-7 No dice nada de ciclos (frontera ADR-018, contra el código) | `src/app/api/version/route.ts` | `tests/version-import-graph.test.ts` (prefijos prohibidos: `src/lib/market`, `src/lib/triggers`, `src/lib/notifications`, `src/app/api/cron`) · `tests/e2e/version.spec.ts` (CA-7) | | ❌ |
| CA-8 `scripts/check-alive.mjs`: contrato, stdlib, sin secretos | `scripts/check-alive.mjs` (cabecera con los 4 códigos, `--help`, cero imports) | `tests/check-alive.test.ts` → CA-8 (9 casos: imports stdlib, ninguna dep de `package.json`, cero `process.env`, `--help`, usos incorrectos) | | ❌ |
| CA-9 Salida 0 cuando coincide (y modo *smoke*) | `scripts/check-alive.mjs` | `tests/check-alive.test.ts` → CA-9 (4 casos, subproceso contra servidor `node:http`) | | ❌ |
| CA-10 Salida 1 cuando no llega, con esperado y visto | `scripts/check-alive.mjs` | `tests/check-alive.test.ts` → CA-10 (2 casos: sha discrepante y origen mudo; se asierta código, texto y tiempo transcurrido) | | ❌ |
| CA-11 Salida 2 en `unknown`; reintento; 3 si el cuerpo no es el contrato | `scripts/check-alive.mjs` | `tests/check-alive.test.ts` → CA-11 (7 casos: `unknown` con y sin `--commit`, 500→200, ECONNREFUSED→200, no-JSON, claves de menos, claves de más) | | ❌ |
| CA-12 El runbook retira el `curl \| grep` | `docs/despliegue.md` (lección del 2026-08-11 reescrita · §8 paso 8 · **§10** nueva: contrato y códigos) | `tests/runbook-check-alive.test.ts` (6 casos, troceando el documento por secciones) | | ❌ |
| CA-13 Nada queda conectado (CI, `vercel.json`, red) | Ninguno: es la ausencia de cambios lo que se verifica | `tests/spec-031-frontera.test.ts` (10 casos: steps de `ci.yml`, `vercel.json` congelado, `.env.example`, URLs de los 8 ficheros nuevos) | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
Pendiente. **Esta spec debe poder cerrarse sin desplegar nada**: es la razón por la que
ADR-018 pide no fusionar los puntos 3 y 4 del desglose. Si al verificar aparece un CA que
exige un despliegue real, es un defecto de la spec, no del verificador — pararse y devolverla.

## Evidencia visual
No aplica: esta spec no cambia ninguna pantalla. La evidencia es textual (respuestas HTTP,
códigos de salida de subproceso, salida de los tests estáticos).

## Salvedades / follow-ups

- **F-SPEC-031-1 — ADR-018 D-7 ("hecho" pasa a significar "vivo"): decisión APLAZADA.**
  Abierta en el gate del **2026-08-18**: el humano **ni la adopta ni la descarta**. Razón:
  mientras no exista **SPEC-028**, la comprobación de vida solo puede afirmar *"hay un
  despliegue nuevo"* (por `builtAt`), no *"contiene este commit"* —hoy `VERCEL_GIT_COMMIT_SHA`
  llega vacía—, así que adoptarla sería adoptar una regla que aún no se puede cumplir.
  **Destino: el gate de SPEC-028**, que es cuando la regla pasa a ser cumplible. Quien escriba
  SPEC-028 debe llevarla a ese gate junto con la pregunta 3 del gate de ADR-018, de la que
  procede. **No bloquea SPEC-031**: esta spec es el prerrequisito técnico de D-7, no su
  adopción, y se cierra igual sin ella. **ADR-018 no se modifica** (inmutable): D-7 sigue
  siendo una recomendación pendiente de firma.

Fronteras heredadas que **siguen abiertas y no se cierran aquí**:

- **F-SPEC-027-2** — `guard-migrate` (ADR-018 D-2) y escáner de SQL destructivo (D-5.2).
  **Bloqueante de SPEC-028**, no de esta: SPEC-031 no toca ni una línea de SQL.
- **F-SPEC-027-1** — la CI informa pero no impide mezclar (plan de GitHub). Sin efecto aquí.
- **F-SPEC-023-1** — `DATABASE_URL` compartida Production/Preview. La cierra la acción de ops
  del punto 2 del desglose (BD de Preview separada), no esta spec.

Dato de contexto verificado el **2026-08-18**, no es una salvedad de esta spec pero conviene
que no se pierda: **`SPEC-022` no existe** ni en `origin/main` ni en ninguna rama remota. La
referencian por nombre ADR-018 (§Frontera con SPEC-022) y el ledger de SPEC-023, pero el id
está libre en el árbol — o se escribió en una sesión paralela y nunca se subió, o se perdió.
No afecta a **CA-7**, que se verifica contra el **código del ciclo de refresco** ya existente
y no contra un documento; la spec ya está redactada así.

## Cómo retomar (handoff)
Estado real: **implementada y lista para el verificador**. La spec está en `en-revision`.
Rama `ft/SPEC-031-identidad-del-despliegue`, worktree `.claude/worktrees/spec-031`, sobre
`origin/main` @ `2702111`. **Sin push y sin PR**: eso lo hace el orquestador tras el gate
adversarial.

Commits (en orden):

1. `cd1ac9e` — `feat(SPEC-031): /api/version dice de qué commit viene el despliegue` (CA-1…CA-7).
   Incluye la spec y este ledger, que el arquitecto dejó sin commitear.
2. `38b5fa1` — `feat(SPEC-031): scripts/check-alive.mjs, la comprobación de vida reutilizable`
   (CA-8…CA-11).
3. El tercero cierra CA-12 y CA-13 (runbook y frontera) y deja la spec en `en-revision`.

### Qué se ha construido, en cuatro piezas

- `src/lib/version/identity.ts` — función pura `resolveIdentity` + la constante
  `deploymentIdentity`, resuelta **una sola vez al cargar el módulo**. Aquí vive la sentinela
  `unknown` y la regla de mirar el **contenido**, no la presencia.
- `src/lib/version/build-identity.mjs` + `next.config.mjs` — el canal de tiempo de build.
  `next.config.mjs` es el **único fichero del repo** que menciona `VERCEL_GIT_*`; el módulo
  recibe el sha como parámetro justamente para que `grep VERCEL_GIT_ src/` no devuelva nada
  (CA-2c). Es `.mjs` porque un `next.config.mjs` no puede importar TypeScript.
- `src/app/api/version/route.ts` — el endpoint. Su **único** import es la identidad: eso es lo
  que hace ciertas las propiedades de CA-5 y CA-7, y el test de grafo lo vigila.
- `scripts/check-alive.mjs` — primer y único habitante de `scripts/`. Cero imports, cero
  lecturas de `process.env`.

### Cómo reproducir la verificación

```bash
npm ci                 # OJO: el worktree no traía node_modules y la resolución caía al
                       # repo padre, que no tiene `yaml` (dep de SPEC-027)
npm run typecheck      # limpio
npm run lint           # limpio
npm run test           # 45 ficheros, 524 tests (486 antes de esta spec + 38 nuevos)
npm run build && npm run test:e2e   # 39 tests, incluidos los 4 de tests/e2e/version.spec.ts
```

Y la cadena completa contra la app real, que es la evidencia que ningún test estático da:

```bash
npm run build && npx next start -p 3210          # con DATABASE_URL/AUTH_SECRET de juguete
node scripts/check-alive.mjs --url http://127.0.0.1:3210            # -> 0
node scripts/check-alive.mjs --url http://127.0.0.1:3210 --commit ffff…ffff --timeout 3   # -> 1
```

En esa prueba el endpoint respondió el sha del árbol **con el que se construyó**, que no era
el del `HEAD` del momento — es decir: el instrumento detectó por sí solo *"lo vivo es más
viejo que lo que tienes delante"*, que es exactamente el fallo de 27 días que abre
`docs/despliegue.md`.

### Lo que NO se ha tocado, a propósito

`.github/workflows/ci.yml` (ni un step), `vercel.json` (`git diff origin/main -- vercel.json`
vacío), `.env.example`, `docs/adr/ADR-018-*.md` (inmutable). Ninguna variable de entorno
nueva: las tres del canal de build **se calculan**, no se configuran.

### Salvedades abiertas por el implementador

**Ninguna nueva.** No apareció trabajo necesario fuera de los CA. `F-SPEC-031-1` (adopción de
D-7) sigue como estaba, aplazada al gate de SPEC-028, y esta spec cierra sin ella.
