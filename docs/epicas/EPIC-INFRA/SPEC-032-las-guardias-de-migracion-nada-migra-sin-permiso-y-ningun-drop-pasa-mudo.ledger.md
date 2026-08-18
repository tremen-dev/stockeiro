---
id: SPEC-032
tipo: ledger
epica: EPIC-INFRA
---
# Ledger — SPEC-032 Las guardias de migración: nada migra sin permiso y ningún DROP pasa mudo

## Resumen
- Fase: spec redactada el 2026-08-18 por sdd-arquitecto y **aprobada en el gate humano el
  2026-08-18 (Alberto Fojo)**, con una enmienda: se añade **CA-15** y la spec pasa de 14 a
  **15 CA**. La transición de estado la registra el orquestador con `estado.mjs`; **la fuente de
  verdad del estado es el frontmatter de la spec**, no esta línea.
- Rama: `ft/SPEC-032-guardias-de-migracion` (worktree `.claude/worktrees/spec-032`, basada en
  `origin/main` @ `65ed40e`, que ya incluye SPEC-031 mergeada).
- Origen: **F-SPEC-027-2** (ledger de SPEC-027). Implementa **ADR-018 D-2** (guardia
  *fail-closed* delante de `db:migrate`), **D-5.2** (escáner de SQL destructivo con desbloqueo
  escrito) y, desde el gate, **D-5.1**: la política de migraciones aditivas se adopta como regla
  del proyecto y se escribe como **RI-01** en `docs/fundacion/reglas.md`, en una sección de
  reglas de ingeniería aparte de la serie de dominio (**CA-15**). Eso responde la **pregunta 2
  del gate de ADR-018**, abierta desde el 2026-08-17.
- Por qué ahora: es el **último bloqueante de SPEC-028**. Los otros dos ya están vivos —
  **SPEC-031** (`hecho`, mergeada el 2026-08-18) y **F-SPEC-023-1** (cerrado por ops el
  2026-08-18 con *preview branching* de Neon: rama copy-on-write por despliegue de Preview,
  `Create Database Branch For Deployment` = Preview sí / Production no, prefijo `DATABASE`).
- Artefactos previstos por la spec (ninguno escrito todavía; los escribe sdd-implementador):
  `scripts/guard-migrate.mjs`, `scripts/scan-destructive-sql.mjs`,
  `drizzle/destructive-waivers.json`, script npm `db:scan`, step de CI `Migration scan`,
  cambio del `buildCommand` en `vercel.json`, ampliación de `tests/ci-workflow.test.ts`,
  sección nueva en `docs/despliegue.md` y **`RI-01` en `docs/fundacion/reglas.md`**.
- **Todos los CA son cerrables en local y en CI, sin desplegar y sin red** (CA-14). Es la misma
  restricción que hizo verificable a SPEC-031.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|
| CA-1 — la guardia existe, stdlib-only, `--help`, códigos de salida | | | | ❌ |
| CA-2 — tabla de decisión *fail-closed* completa | | | | ❌ |
| CA-3 — dice qué autorizó y contra qué host/base, sin credenciales | | | | ❌ |
| CA-4 — cableada en `vercel.json` antes de `db:migrate`, no en `package.json` | | | | ❌ |
| CA-5 — nunca abre la base ni sale a la red | | | | ❌ |
| CA-6 — el escáner existe, autosuficiente, sin git ni red | | | | ❌ |
| CA-7 — marca lo que enumera D-5.2 y no marca folklore (`UPDATE` fuera) | | | | ❌ |
| CA-8 — calibración medida: exactamente `0001` y `0007` de 9 | | | | ❌ |
| CA-9 — desbloqueo explícito, escrito y versionado (`destructive-waivers.json`) | | | | ❌ |
| CA-10 — el rojo dice fichero, línea, sentencia y qué escribir | | | | ❌ |
| CA-11 — step propio `Migration scan` en el job `Checks` + `GATES` a seis | | | | ❌ |
| CA-12 — `npm test` invoca el mismo script (red local) | | | | ❌ |
| CA-13 — runbook: las dos guardias, `ALLOW_MIGRATE`, y Preview al día | | | | ❌ |
| CA-14 — nada queda conectado; la suite pasa sin red | | | | ❌ |
| CA-15 — `RI-01` (migraciones aditivas) en `docs/fundacion/reglas.md`, sección `RI-xx` aparte | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->
Pendiente: la spec ni siquiera está aprobada.

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-032/. Informe HTML opcional: _qa/SPEC-032/informe.html -->
**No aplica.** Ninguna pantalla cambia y no hay flujo de usuario que capturar: la evidencia de
esta spec son códigos de salida de dos scripts, un YAML parseado y un runbook. Lo que sí debe
quedar pegado en el ledger al implementar: la **salida real** de los dos scripts en sus tres
decisiones (autoriza / rechaza / uso incorrecto), y la ejecución de la CI con el step
`Migration scan` en verde y —al menos una vez, a propósito— en rojo.

## Salvedades / follow-ups
<!-- IDs F-SPEC-032-1, F-SPEC-032-2… con destino (spec futura o EPIC-MEJORA). -->
Abiertos ya en el nacimiento de la spec (declarados en §Fuera de alcance y §Notas para el gate):

- **F-SPEC-032-1 — `ALLOW_MIGRATE=1` en el entorno Preview es una autorización permanente que
  asume que el *preview branching* de Neon sigue encendido.** Si alguien lo apaga, o reconecta el
  recurso sin esa casilla, el permiso sobrevive y vuelve a apuntar a producción: la guardia
  pregunta *"¿tengo permiso?"*, no *"¿contra qué base?"*. Mitigación entregada aquí: CA-3 obliga a
  imprimir host y base en el log del build (delata, no previene). Cierre real —comprobar desde el
  build que un Preview no apunta a la base de producción— exige conocer la identidad de esa base
  o un marcador de la integración de Neon **no verificado**; no se inventa aquí. → **SPEC-028**.
- **F-SPEC-032-2 — poner `ALLOW_MIGRATE=1` en el entorno Preview de Vercel.** Acción de **ops**,
  no código; esta spec la documenta (CA-13.1) pero no la ejecuta. Hoy no rompe nada porque sin
  integración Git no se disparan builds de Preview; el día que SPEC-028 conecte el repo **sin**
  esa variable, todas las previews fallarán en la guardia — que es el comportamiento correcto
  (ADR-018 D-3), pero conviene que sea decisión y no sorpresa. → **SPEC-028 / ops**.

Heredados, sin cambio y sin efecto sobre los CA de esta spec:

- **F-SPEC-027-1** — la CI **informa pero no impide** mezclar (repo privado + org en plan free →
  `403 Upgrade to GitHub Pro`). Se aplica también al gate nuevo: `Migration scan` en rojo publica,
  no bloquea. La guardia de build **no** se ve afectada: no depende de GitHub en absoluto.
- **F-SPEC-027-5** — `actions/checkout@v4` y `actions/setup-node@v4` deprecadas. Deuda con fecha,
  ajena a esta spec.
- **F-SPEC-031-1** — adoptar **D-7** (*"hecho" exige "vivo"*), aplazado al gate de **SPEC-028**.
  Esta spec no lo toca.
- **Pregunta 7 del gate de ADR-018** — la ventana real de restauración de Neon sigue sin medirse,
  y es la red última ante una migración destructiva. Comprobación de ops.

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->
**Hecho**: la spec, en `borrador`. **Nada de código**: no hay `scripts/guard-migrate.mjs`, ni
escáner, ni `drizzle/destructive-waivers.json`, y `vercel.json` sigue con el `buildCommand`
antiguo. No hay commit ni push: los dos ficheros de `docs/epicas/EPIC-INFRA/` están *untracked*.

**El gate humano ya se celebró (2026-08-18, Alberto Fojo) y la spec quedó aprobada.** Las cuatro
decisiones que esperaban respuesta están resueltas, y las resoluciones son contrato:

1. ✅ **D-5.1 se adopta como regla del proyecto**, y va a `docs/fundacion/reglas.md` **en sección
   aparte** —"Reglas de ingeniería (RI-xx)", **RI-01**—, tal como propuso el arquitecto y porque
   hoy ese fichero contiene solo reglas de dominio RN-01…RN-15 que vigilan sdd-cartera y
   sdd-mercados. Entra como **CA-15**, con el texto literal ya redactado en la spec. Responde la
   pregunta 2 del gate de ADR-018, abierta desde el 2026-08-17. **La escribe el implementador**;
   el arquitecto no tocó ese fichero.
2. ✅ **El desbloqueo es un fichero versionado** (`drizzle/destructive-waivers.json`), **no una
   etiqueta en la PR**: el desvío de la letra de D-5.2 queda **sancionado por el humano** (vive en
   el repo, se revisa con el diff, no desaparece al cerrar la PR y no necesita la API de GitHub
   que F-SPEC-027-1 nos niega). No es una decisión del arquitecto pendiente de firma: está
   firmada.
3. ✅ **La guardia se queda**, aceptando el análisis de que con *preview branching* baja a
   *tripwire* y auditoría: **es la única red si alguien apaga el branching**. `F-SPEC-032-1` sigue
   declarado como residual y **CA-3 es su mitigación**.
4. ✅ **CA-12 se queda**: el escáner corre también dentro de `npm test`.

Orden natural de implementación: (a) la guardia y sus tests
(CA-1…CA-5) más el cambio de `vercel.json`; (b) el escáner con sus fixtures sintéticos
(CA-6, CA-7, CA-10); (c) sembrar los dos desbloqueos históricos (`0001`, `0007`) y fijar la
calibración (CA-8, CA-9); (d) cablear CI y suite (CA-11, CA-12); (e) runbook (CA-13); (f)
revisar la frontera (CA-14); (g) escribir `RI-01` en `docs/fundacion/reglas.md` (CA-15). El paso
(c) exige leer ADR-018 §D-5.2 y SPEC-024: la justificación y el plan de vuelta atrás de esas dos
migraciones ya están escritos ahí y no hay que inventarlos. El paso (g) es **solo la regla**: la
sección `RI-xx` nueva y `RI-01` con el texto literal de CA-15, sin tocar ninguna `RN`.

**No se escribió ADR-021, tampoco tras el gate**, y el motivo está en §Entidades y en la nota 8:
todo lo decidido aquí es mecanismo dentro del margen que ADR-018 concede a la spec, y la única
decisión con vocación de constreñir el futuro —adoptar D-5.1— **ya vive en un ADR aprobado**
(ADR-018 D-5.1). Lo que faltaba no era decidirla sino escribirla donde se lee al trabajar, y eso
es CA-15. Un ADR-021 que repitiese D-5.1 sería una segunda fuente de verdad de la misma decisión.
