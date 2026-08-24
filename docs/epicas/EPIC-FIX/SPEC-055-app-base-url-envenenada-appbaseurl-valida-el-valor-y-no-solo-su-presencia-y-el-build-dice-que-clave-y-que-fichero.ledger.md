---
id: SPEC-055
tipo: ledger
epica: EPIC-FIX
---
# Ledger — SPEC-055 APP_BASE_URL envenenada: appBaseUrl valida el valor y no solo su presencia, y el build dice que clave y que fichero

## Resumen
- Fase: **borrador** — escrita por sdd-arquitecto el 2026-08-24, **sin aprobar**. Espera gate humano.
- Rama: `ft/SPEC-055-app-base-url-envenenada-appbaseurl-valida-el-valor-y-no-solo-su-presencia-y-el-build-dice-que-clave-y-que-fichero`
  (la abre el humano; la spec se escribió sobre `main` sin commitear)
- Esta entrega **toca `src/`**: el gate `Version bump` exigirá subida de versión.

## Matriz de criterios de aceptación
<!-- Escritores: sdd-implementador rellena Implementado y Test; sdd-verificador rellena Verif. y Estado. Nunca al revés. -->
<!-- Estados por CA: ✅ cerrado · ⚠️ parcial/con salvedad · 🚧 en curso · ❌ sin empezar · n-a -->
<!-- Un CA está ✅ solo cuando Implementado + Test + Verif. aplicables están en verde. Una salvedad se marca ⚠️, nunca ✅. -->
| CA | Qué exige (resumen; la fuente es la spec) | Implementado (fichero) | Test (fichero/caso) | Verif. | Estado |
|---|---|---|---|---|---|
| CA-1 | Clave ausente / `'   '` sigue lanzando con `/APP_BASE_URL no definida/` y la firma `appBaseUrl(env)` no cambia — **contrato con SPEC-052 CA-14** | | | | ❌ |
| CA-2 | Valor que no parsea (`[SENSITIVE]`, sin esquema, `//evil.com`, comillas dentro) → lanza con diagnóstico; cada fila evalúa su propio «antes» | | | | ❌ |
| CA-3 | Protocolo distinto de `http:`/`https:` (`ftp:`, `file:`, `javascript:`) → lanza; cada fila demuestra que hoy llega vivo al enlace de correo | | | | ❌ |
| CA-4 | Ruta / query / fragmento / credenciales → lanza; barra final sigue tolerada (`https://a.com/` → `https://a.com`); la fila de la ruta calcula la discrepancia entre los dos consumidores | | | | ❌ |
| CA-5 | Los valores vivos siguen valiendo y se **leen** de `.github/workflows/ci.yml` y `tests/e2e/server.mjs`, con centinela de extracción no vacía | | | | ❌ |
| CA-6 | El mensaje nombra clave + valor delimitado + forma esperada con ejemplo + `.env.production.local` manda sobre `.env`; aplicado a **todas** las filas | | | | ❌ |
| CA-7 | `[SENSITIVE]` añade la pista de `vercel env pull` / *Sensitive*; `[REDACTED]` se rechaza igual **sin** pista; valor recortado en el mensaje | | | | ❌ |
| CA-8 | Con la clave envenenada, recuperación falla **igual** para cuenta existente e inexistente y **sin tocar la BD**; el «antes» (oráculo 200/500 + enlace vivo quemado) se mide en el mismo fichero. `password-reset.ts` **sin modificar** | | | | ❌ |
| CA-9 | Única fuente del origen absoluto = `appBaseUrl()`; guardia estática sobre `src/` **con centinela** (cero puntos de uso ⇒ rojo) | | | | ❌ |
| CA-10 | Cero claves nuevas: `tests/spec-031-frontera.test.ts` (11, `toHaveLength(11)`) y `tests/tarjeta-frontera.test.ts` verdes **sin tocarse** | | | | ❌ |
| CA-11 | ADR-026 §7: reimplementación de 3 líneas de la `appBaseUrl()` anterior en el test; cada valor rechazado la atraviesa (o estalla sin diagnóstico). Centinela: tabla no vacía y con las tres familias | | | | ❌ |
| CA-12 | La tabla crece sin tocar aserciones: ni `toHaveLength(` ni `toEqual([` sobre ella (`F-SPEC-048-2`) | | | | ❌ |
| CA-13 | Cabecera de `app-url.ts` y comentario de `layout.tsx` dicen la otra mitad; `layout.tsx` cambia **sólo comentario** y `tarjeta-frontera.test.ts:75` sigue verde | | | | ❌ |

## Veredicto del verificador
<!-- GREEN/RED + fecha + resumen. Lo escribe SOLO sdd-verificador. -->

### Verificación de gate (fuera de la suite, a pegar aquí)

No cabe en la batería y se hace una vez, con la salida literal pegada (mismo tratamiento que
SPEC-052 CA-16):

| Escena | Qué se espera | Salida |
|---|---|---|
| `npm run build` con `APP_BASE_URL='[SENSITIVE]'` en el entorno, **antes** del arreglo | `Failed to collect configuration for /_not-found` → `Invalid URL`, sin nombrar clave ni fichero | |
| `npm run build` con `APP_BASE_URL='[SENSITIVE]'`, **después** | falla nombrando `APP_BASE_URL`, el valor, la forma esperada y `.env.production.local` | |
| `npm run build` con `APP_BASE_URL=http://localhost:3200` | verde | |
| `npm run test` / `typecheck` / `lint` | verdes; `tests/spec-031-frontera.test.ts` y `tests/tarjeta-frontera.test.ts` **sin tocar** | |
| `git diff --name-only` de la rama | exactamente: la spec, este ledger, `src/lib/config/app-url.ts`, `src/app/layout.tsx`, `tests/app-base-url.test.ts` | |

## Evidencia visual
<!-- Tabla CA → captura en _qa/SPEC-055/. Informe HTML opcional: _qa/SPEC-055/informe.html -->

**No aplica.** Esta spec no toca UI: el defecto vive en configuración, en el build y en un
camino de servidor. Toda la evidencia es de test y de salida de consola.

## Salvedades / follow-ups
<!-- IDs F-SPEC-055-1, F-SPEC-055-2… con destino (spec futura o EPIC-MEJORA). -->

Abiertos ya por el arquitecto, antes de implementar:

- **`F-SPEC-055-1` — despliegue en sub-ruta (`https://host/app`).** CA-4 **rechaza** ese
  valor en vez de reconciliar a los dos consumidores. Arreglar `buildResetUrl` para que
  respete un prefijo de ruta es otro trabajo, con riesgo sobre enlaces ya enviados. Hoy
  ningún despliegue lo pide. Destino: spec futura, sólo si aparece el caso.
- **`F-SPEC-055-2` — validar el resto de claves de entorno con el mismo patrón**
  (`RESEND_FROM` como dirección, `DATABASE_URL` como URL, `AUTH_SECRET` como longitud
  mínima…). Generalización obvia que no cabe en una spec de FIX: cada clave tiene su forma y
  su consumidor. Destino: **EPIC-INFRA**.

## Dependencias con otra spec en vuelo

- **`D-SPEC-055-1` → SPEC-052** (rama `ft/SPEC-052-sin-app-base-url-el-build-ya-no-sale-verde`,
  `en-revision`, sin pushear). Esta spec **no toca** `docs/despliegue.md` ni `.env.example`
  porque son suyos. Lo que les pide, dos líneas:
  1. `docs/despliegue.md` §0: `vercel env pull` deja `[SENSITIVE]` en las variables marcadas
     como *Sensitive* en Vercel, y en un build de producción `.env.production.local` **manda
     sobre** `.env`.
  2. Comentario de `APP_BASE_URL` en `.env.example`: la forma aceptada — origen `http`/
     `https`, sin ruta ni barra final.
  **Ninguna de las dos hace falta para que los trece CA pasen.** Si SPEC-052 ya ha mergeado
  cuando esto se implemente, pueden colgarse de esta spec; lo decide el humano en el gate.

- **Contrato compartido, no fichero: el literal `APP_BASE_URL no definida`.** SPEC-052 CA-14
  lo congela en `tests/entornos-de-despliegue.test.ts` (en su rama, `:697-740`), junto con la
  firma `appBaseUrl(env)`. **Cambiarlos pone RED a SPEC-052 sin tocar ninguno de sus
  ficheros.** CA-1 de esta spec existe para que eso no ocurra por descuido.
  **Intersección de ficheros entre las dos specs: vacía** (comprobado con
  `git diff --name-only origin/main...ft/SPEC-052-…`).

## Cómo retomar (handoff)
<!-- Estado real del trabajo para la siguiente sesión: qué está hecho, qué falta, dónde seguir. -->

**Hecho:** la spec, en `borrador`, y este ledger. Nada de código, nada de tests, nada
commiteado. Los ficheros se escribieron sobre `main` sin commitear, a propósito: la rama la
abre el humano.

**Falta:** el gate humano. Hay **dos preguntas abiertas** esperándole en §Notas pto. 6 (si
`javascript:`/`file:` merecen mensaje propio, y la longitud del recorte del valor) y **una
decisión** en §Notas pto. 5 (si D-3 punto 3 —rechazar una ruta— debe quedar como ADR
inmutable en vez de como `F-SPEC-055-1`).

**Dónde seguir cuando se apruebe:** `src/lib/config/app-url.ts:13` es el único punto de
implementación real. Antes de escribir una línea, leer §Problema entero: la tabla de los
cinco eslabones y la tabla del oráculo de enumeración son el mapa, y CA-8 no se entiende sin
la segunda.
