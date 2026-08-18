---
id: SPEC-027
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-027 CI en cada PR: la suite deja de depender de que alguien se acuerde

## Resumen
- Fase: en-revision (implementación cerrada en local; falta la evidencia viva que solo existe con la PR abierta)
- Rama: `ft/SPEC-027-ci-en-cada-pr` (worktree `.claude/worktrees/followups-024-025`)
- Commits: `c5ba11f` (RED del test estático) · `dbcb7dc` (workflow + `.nvmrc` + scripts) ·
  `6c2a625` (canario y retirada del código muerto) · `674de6f` (runbook)

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 | `.github/workflows/ci.yml` (`on: pull_request/push`, ambos `branches: [main]`) | `tests/ci-workflow.test.ts` › *CA-1* (3 casos). **Evidencia viva pendiente de la PR** (F-SPEC-027-4) | | ❌ |
| CA-2 | `.github/workflows/ci.yml` (steps `Typecheck`, `Lint`, `Unit tests`, `Build`, `End-to-end tests`) | `tests/ci-workflow.test.ts` › *CA-2* (2 casos: el conjunto de nombres es exactamente el esperado; cada `run` invoca un solo script y no encadena) | | ❌ |
| CA-3 | `.github/workflows/ci.yml` (`if: ${{ !cancelled() }}` en los tres gates de `Checks`; ausente en `End-to-end tests`) | `tests/ci-workflow.test.ts` › *CA-3* (2 casos). **Prueba en rojo pendiente de la PR** (F-SPEC-027-4) | | ❌ |
| CA-4 | `.github/workflows/ci.yml` (jobs `checks`/`Checks` y `e2e`/`E2E`, sin `needs`) | `tests/ci-workflow.test.ts` › *CA-4* (3 casos). **Captura de los dos checks pendiente de la PR** | | ❌ |
| CA-5 | `.github/workflows/ci.yml` (`permissions: contents: read`; `env` de juguete en `E2E`; `timeout-minutes` 20/25; `concurrency` con `cancel-in-progress` condicionado) | `tests/ci-workflow.test.ts` › *CA-5* (6 casos, uno por punto: 5.1 sin `secrets.` / 5.1 variables de juguete / 5.2 permissions / 5.3 sin `db:migrate` / 5.4 timeouts / 5.5 concurrency) | | ❌ |
| CA-6 | `.nvmrc` (`24`) + `node-version-file: .nvmrc` en los dos `Set up Node` | `tests/ci-workflow.test.ts` › *CA-6* (2 casos). **Suite completa ejecutada en Node 24 — ver §Mediciones** | | ❌ |
| CA-7 | `package.json` › `scripts.lint` = `eslint . --max-warnings=0`, `scripts["test:e2e"]` = `playwright test`; todo gate del YAML invoca `npm run <script>` | `tests/ci-workflow.test.ts` › *CA-7* (3 casos: los scripts existen; cada gate invoca el suyo; las banderas van tras `--`) | | ❌ |
| CA-8 | `.github/workflows/ci.yml` (`cache: npm` en setup-node; `actions/cache` de `~/.cache/ms-playwright` con clave de `package-lock.json`; sin caché de `node_modules` ni `.next/cache`, con el motivo escrito en el YAML) | `tests/ci-workflow.test.ts` › *CA-8* (4 casos). **Ahorro medido (1ª vs 2ª pasada) pendiente de la PR** | | ❌ |
| CA-9 | `.github/workflows/ci.yml` › step `Upload e2e diagnostics` (`if: failure()`, `playwright-report/` + `test-results/` + `_qa/`, `retention-days: 7`) | Sin test estático (a propósito: lo que se afirma es que el artefacto *existe y abre*). **Prueba en rojo pendiente de la PR** (F-SPEC-027-4) | | ❌ |
| CA-10 | `.github/workflows/ci.yml` › `npm run test:e2e -- --forbid-only …` | Bandera ejercitada en local en Node 24 (27/27 con `--forbid-only`). **Prueba en rojo con un `.only` pendiente de la PR** (F-SPEC-027-4) | | ❌ |
| CA-11 | `tests/schema-source.test.ts` › bloque CA-6: invocación extraída a `generateInto()`, sonda a `withProbe()` | `tests/schema-source.test.ts` › *CA-6* › «la guardia sabe detectar: contra un directorio vacío genera migración». **Probado en los dos sentidos en local — ver §Mediciones** | | ❌ |
| CA-12 | `tests/schema-source.test.ts`: desaparece la inspección `/error\|ENOENT/i` de stdout; el comentario de la sonda se sustituye por lo medido | `tests/schema-source.test.ts` › *CA-6* (la guardia sigue verde sin la inspección). **La medición prescrita CONTRADICE la premisa del CA — ver §Mediciones y F-SPEC-027-3** | | ❌ |
| CA-13 | Sin cambios de expectativas en ningún test existente; único fichero de test existente tocado: `tests/schema-source.test.ts` (+ `tests/position.test.ts`, un import sin usar, autorizado en el gate) | Suite completa verde en Node 22 y Node 24 (308/308 en 32 ficheros). **Tiempos y minutos facturados de CI pendientes de la PR** | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-027/. Informe HTML opcional: _qa/SPEC-027/informe.html -->

Pendiente: las capturas que esta spec necesita son de **la lista de checks de la PR** (CA-4) y
del **artefacto de diagnóstico descargado** (CA-9). Ninguna de las dos existe hasta que la PR
esté abierta. No hay UI de aplicación que capturar: esta spec no toca `src/`.

## Mediciones

### Node 24 — la pieza que podía tumbar la spec, y no la tumba

La máquina no tiene gestor de versiones (`nvm`, `fnm`, `volta`: ninguno). Se descargó el
binario portable **v24.19.0** (`node-v24.19.0-win-x64`, la última 24.x LTS «Krypton» el
2026-08-03) al scratchpad y se ejecutó la suite entera anteponiéndolo al `PATH`. Local sigue en
**v22.19.0**; `.nvmrc` fija **24**, que es lo que corre Vercel (ADR-018).

| Gate | Node 22.19.0 | **Node 24.19.0** | Resultado |
|---|---|---|---|
| `npm run typecheck` | exit 0 | **exit 0** | limpio |
| `npm run lint` (`--max-warnings=0`) | exit 0 | **exit 0** | 0 errores, 0 warnings |
| `npm run test` | 308/308 en 32 ficheros · **97,08 s** | **308/308 en 32 ficheros · 104,55 s** | sin una sola diferencia de comportamiento |
| `npm run build` (variables de juguete) | — | **exit 0 · 33,5 s** | confirma CA-5.1: el build no abre ninguna conexión |
| `npm run test:e2e -- --forbid-only --trace=retain-on-failure --reporter=list,html` | — | **27/27 · 77,9 s** (`CI=1`) | verde a la primera |

**Node 24 no rompe nada.** No hubo que bajar el CI a 22 ni forzar nada. Los `[auth][error]
CredentialsSignin` del log del e2e son los tests de login inválido haciendo su trabajo, no un
fallo.

Caveat honesto: esto es Node 24 **en Windows y contra el `node_modules` ya instalado**. El
runner es `ubuntu-latest` con `npm ci` desde cero, y ahí entra `@embedded-postgres/linux-x64`
con su script de instalación, que **nadie ha ejecutado nunca**. Es el riesgo que solo cierra la
primera pasada real de CI.

### CA-13 — coste del canario

| Referencia | Tests | Duración |
|---|---|---|
| Antes de esta spec (medido por el arquitecto, Node 22) | 282 en 31 ficheros | 145 s |
| Después, Node 22 | 308 en 32 ficheros | **97,08 s** |
| Después, Node 24 | 308 en 32 ficheros | **104,55 s** |

El coste aislado del canario, tomado del desglose por test de Vitest, es **≈ 2,0 s** por pasada
de suite (1,96 s / 1,99 s en dos ejecuciones) — no los **25 s** que estimaba la spec. La suite
completa queda **por debajo** de la referencia de 145 s pese a sumar 26 tests, así que el techo
de **+25 %** no se acerca siquiera. (El resto de la diferencia es varianza de máquina/caché
entre la medición del arquitecto y estas; no se atribuye al cambio.)

### CA-11 — el canario, probado en los dos sentidos

- **Verde**: la misma invocación contra una sonda vacía escribe el esquema entero
  (`0000_*.sql`). Es lo que corre en cada pasada.
- **Rojo**: se rompió la invocación a propósito (commit temporal, revertido: `--out` apuntando a
  `${outRel}-BREAK-TEMPORAL`, que simula el fallo realista de que la salida aterrice en otro
  sitio). Resultado, y es exactamente el que justifica el CA:

  ```
  ✓ drizzle/ está al día respecto de src/db/schema.ts            <-- la guardia, VERDE en falso
  × la guardia sabe detectar: contra un directorio vacío genera migración
    → La guardia de esquema NO PUDO EJECUTARSE. Esto no dice que haya deriva:
      dice que la comprobación de deriva está muerta …
  ```

  La guardia sigue verde estando rota; **solo el canario se pone rojo**, y señala la guardia, no
  la deriva.

### CA-12 — la medición prescrita sale al revés de lo que dice el CA

CA-12 pide ejecutar la guardia con la sonda en **ruta absoluta** y comprobar que «se comporta
igual — verde sin deriva y roja con deriva». **No se comporta igual.** Medido el 2026-08-18 con
la invocación exacta del test (`execFileSync`, `cwd` = raíz, `shell: true`):

| Sonda | `--out` | Resultado |
|---|---|---|
| sembrada con `drizzle/`, **sin** deriva | relativo | `status 0`, stdout `No schema changes, nothing to migrate 😴`, 8 → 8 `.sql` → guardia **verde**, correcto |
| sembrada con `drizzle/`, **con** deriva | relativo | `status 0`, escribe `0008_*.sql`, 8 → 9 → guardia **roja**, correcto |
| sembrada con `drizzle/`, **sin** deriva | **absoluto** | `status 0`, **stdout vacío**, 1395 B en **stderr**, 8 → 8 → guardia **verde** |
| sembrada con `drizzle/`, **con** deriva | **absoluto** | `status 0`, **stdout vacío**, 1403 B en **stderr**, 8 → 8 → guardia **VERDE EN FALSO** |
| vacía, sin deriva | absoluto | funciona: 0 → 1 `.sql` |

El stderr del caso absoluto dice qué pasa, y no es lo que creía nadie:

```
Error: ENOENT: no such file or directory, open
'D:\…\followups-024-025\D:\…\followups-024-025\node_modules\.cache\mx-abs\meta\0000_snapshot.json'
```

`drizzle-kit` **concatena el cwd delante de la ruta absoluta** al buscar el snapshot previo. Por
eso falla **solo cuando la sonda está sembrada** —el caso de la guardia— y no cuando está vacía
—el caso del canario—. Y falla con **código 0**, así que `execFileSync` no lanza.

Consecuencias, sin adornos:

1. **El punto 1 de CA-12 es correcto solo para el directorio vacío.** «`drizzle-kit generate` sí
   acepta un `--out` absoluto y escribe allí» se midió contra sondas vacías; contra una sembrada
   no escribe nada y no lo dice por stdout. La creencia vieja («la sonda debe ser relativa»)
   resulta ser **cierta para la guardia**, aunque el motivo que se le atribuía era falso.
2. **El punto 2 sigue en pie y la retirada del código muerto es correcta**, con una razón más
   que la registrada: la inspección `/error|ENOENT/i` miraba **stdout**, y el único fallo
   realmente mudo escribe en **stderr**. Nunca lo habría cazado.
3. **El canario, tal y como lo define CA-11 (sonda vacía), no cubre este caso concreto.** Si
   alguien «limpia» la sonda a ruta absoluta, la guardia se vuelve muda **y el canario sigue
   verde**, porque su directorio vacío es justo la forma que sí funciona. → **F-SPEC-027-3**.

Se ha dejado escrito en el comentario del test (medición, no test) y **no** se ha escrito ningún
CA ni aserción que fije «la sonda debe ser relativa»: ataría el test a una versión de
drizzle-kit y seguiría sin cubrir las demás formas de morir mudo. La decisión de si CA-12 se da
por cerrado, se reescribe o se refuerza el canario **es del gate, no mía**.

### Validación estática del YAML

`actionlint 1.7.12` sobre `.github/workflows/ci.yml`: **0 hallazgos** (exit 0). No sustituye a
la ejecución real, pero descarta el viaje de ida y vuelta por un error de sintaxis.

## Salvedades / follow-ups

- **F-SPEC-027-1 — La CI informa, pero no impide mezclar.** Ya declarado en la spec (§Fuera de
  alcance): repo privado + org en plan free ⇒ `403 Upgrade to GitHub Pro` tanto en protección de
  rama como en *rulesets*. No se ha intentado configurar nada. Queda escrito en
  `docs/despliegue.md` §9 para que nadie lea un check verde como una barrera. **Decisión del
  humano, con precio** (GitHub Team ~4 $/asiento/mes, 1 asiento).
- **F-SPEC-027-2 — `guard-migrate` (ADR-018 D-2) y escáner de SQL destructivo (D-5.2).** Fuera
  de alcance aquí porque la ventana que protegen no se abre sin integración Vercel↔GitHub.
  **Bloqueante de SPEC-028**: deben entrar *antes* de conectar el repo.
- **F-SPEC-027-3 — El canario tiene un punto ciego medido: la sonda absoluta con directorio
  sembrado.** Abierto por esta implementación (ver §Mediciones, CA-12). El riesgo residual es
  concreto y reproducible: cambiar la sonda de la guardia a ruta absoluta la deja muda **sin que
  el canario lo note**. Tres salidas, todas baratas, ninguna elegida por mí: (a) sembrar también
  la sonda del canario y exigir que reproduzca la última migración tras retirarla del journal;
  (b) que la guardia capture `stderr` y exija que esté vacío (`spawnSync` en vez de
  `execFileSync`); (c) asumirlo y dejarlo escrito. → **decisión del arquitecto/gate.**
- **F-SPEC-027-4 — Cuatro pruebas en rojo y toda la evidencia viva siguen pendientes, y
  necesitan la PR abierta.** El implementador no hace push ni abre PR. Sin PR no existen: la
  ejecución de CA-1, los dos checks de CA-4, el rojo simultáneo de CA-3, el artefacto de CA-9, el
  `.only` de CA-10, el ahorro de caché de CA-8 y los tiempos/minutos facturados de CA-13.
  **Guion listo en §Cómo retomar.**
- **Lectura de CA-7 que conviene que el verificador conozca**: la spec escribe el script como
  `"lint": "eslint ."` y deja `--max-warnings=0` como pregunta del gate. El humano dijo que sí, y
  la bandera se ha puesto **dentro del script de `package.json`**, no en el YAML, precisamente
  porque CA-7 exige que ninguna bandera propia de CI cambie lo que se ejecuta: así `npm run lint`
  significa lo mismo en la máquina del humano y en el runner. Efecto colateral autorizado: se
  borra el import sin usar de `tests/position.test.ts:7` (`type LedgerEntry`).
- **El e2e en Linux no se ha ejecutado nunca.** `@embedded-postgres/linux-x64` tiene
  `hasInstallScript: true` y extrae los binarios de Postgres al instalar. Todo lo medido aquí es
  Windows. Si la primera pasada de CI muere, el sospechoso es ese.
- **Colisión de ids de ADR: resuelta antes de empezar** (commit `e930f1c`): **ADR-018** =
  despliegue continuo (el que gobierna esta spec), **ADR-019** = el esquema de test es el de
  producción (SPEC-026). No se ha renumerado nada.

## Cómo retomar (handoff)

**Hecho y verde en local** (Node 22 y Node 24): los 13 CA tienen implementación; 12 tienen test
o medición registrada. La suite completa pasa: **308/308 unitarios en 32 ficheros**, **27/27
e2e**, typecheck y lint limpios con `--max-warnings=0`, build verde con variables de juguete.
`actionlint` no encuentra nada en el workflow.

**Ficheros tocados** (todos commiteados en `ft/SPEC-027-ci-en-cada-pr`):

| Fichero | Cambio |
|---|---|
| `.github/workflows/ci.yml` | nuevo — dos jobs, un step por gate |
| `.nvmrc` | nuevo — `24` |
| `package.json` | scripts `lint` y `test:e2e`; devDependency `yaml` |
| `tests/ci-workflow.test.ts` | nuevo — 25 casos, CA-1…CA-8 |
| `tests/schema-source.test.ts` | canario (CA-11) + retirada del código muerto y comentario medido (CA-12) |
| `tests/position.test.ts` | borrado el import sin usar (autorizado en el gate) |
| `docs/despliegue.md` | §9 nueva |

**Lo único que falta, y no lo puede hacer el implementador: abrir la PR.** Para el evento
`pull_request` GitHub ejecuta el workflow **de la rama de la PR**, así que la PR se verifica a sí
misma. Guion, en este orden, cada commit temporal **revertido** y **enlazado aquí**:

1. **Pasada limpia (fría).** Debe salir verde. Apuntar: duración de `Checks`, duración de `E2E`,
   minutos facturados, y la versión de Node impresa por `Set up Node` (debe ser 24.x) → CA-1,
   CA-6, CA-13.
2. **Segunda pasada (cachés calientes).** Un commit vacío basta. Apuntar el ahorro frente a la
   primera → CA-8, CA-13.
3. **Rojo de CA-3.** Un commit que rompa **a la vez** typecheck y lint (p. ej. una variable sin
   declarar y un import sin usar en el mismo fichero). Comprobar que `Typecheck` y `Lint`
   aparecen rojos **por separado** y que `Unit tests` **también se ejecuta**. Revertir.
4. **Rojo de CA-10 + artefacto de CA-9.** Un `test.only` en cualquier `.spec.ts` de `tests/e2e/`.
   Debe fallar por `--forbid-only`, y el job debe subir `e2e-diagnostics`: descargarlo, comprobar
   que trae `playwright-report/`, `test-results/` y `_qa/`, y que **la traza abre**. Revertir.
5. **Captura de la lista de checks** de la PR (dos entradas: `CI / Checks` y `CI / E2E`) →
   `_qa/SPEC-027/` para CA-4.
6. Comprobar que la pasada **verde** no deja artefacto (CA-9, segunda mitad).

**Y antes de nada, lo que el gate tiene que decidir**: la medición de CA-12 sale al revés de la
premisa del CA (§Mediciones). Ni el CA se puede cerrar como está escrito, ni yo debo reescribirlo.
Con ello va **F-SPEC-027-3**, que es el único riesgo técnico nuevo que deja esta spec.
