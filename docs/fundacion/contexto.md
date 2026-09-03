# Contexto maestro — Stockeiro

> Documento vivo: TODO lo que un agente (o una persona) necesita para situarse.
> **Y un documento que no guarda copias** (**ADR-040**): lo que se puede derivar se deriva
> —y una guardia compara las dos mitades—, lo que tiene dueño lo **nombra** en vez de
> copiarlo, y lo que no es ni una cosa ni la otra es prosa, que se corrige en el diff y no
> se vigila. Se escribió así el 2026-09-03, después de que este fichero acumulara **once
> afirmaciones falsas** por copiar valores cuyo dueño era otro sitio (**SPEC-060**).

## Dónde vive cada verdad

Antes de escribir aquí un valor, mira si su dueño ya lo dice. Si lo dice, nómbralo.

| Qué | Dueño |
|---|---|
| Estado de specs y épicas | `docs/tablero.md` (generado, nunca a mano) y el frontmatter de cada spec |
| Evidencia de verificación de una spec | su `*.ledger.md` en `docs/epicas/` |
| Censo de decisiones técnicas | `docs/adr/` — un fichero por ADR, inmutables |
| Claves de entorno y para qué sirve cada una | `.env.example` |
| Esquema de base de datos | `src/db/schema.ts` (y las migraciones de `drizzle/`) |
| Cadencia y hora del ciclo diario | `vercel.json` (`crons`), decidida en **ADR-004** y **ADR-039** |
| Versión del producto y de las dependencias | `package.json` |
| Reglas de negocio (RN) y de ingeniería (RI) | `docs/fundacion/reglas.md` |
| Términos del dominio | `docs/fundacion/dominio.md` |
| Visión y qué NO es el producto | `docs/fundacion/vision.md` |
| Decisiones *locked* del proyecto | `FOUNDATION.md` |
| Cómo se despliega y qué variables pide | `docs/despliegue.md` |
| Qué viene ahora | `docs/roadmap.md` |

## Qué es Stockeiro

Un gestor de inversiones en bolsa a largo plazo que **vigila cotizaciones y avisa, no
opera**: avisa cuando una acción entra en una zona de compra o de venta definida por el
usuario, y mantiene su cartera con P/L actual y realizado (ver `docs/fundacion/vision.md`
y las decisiones **D-1**…**D-7** de `FOUNDATION.md` — **D-7 supersedida por ADR-020** el
2026-08-18: el filtro es el mercado, no el tipo de instrumento).

Los invariantes que no se negocian están en `FOUNDATION.md` («No-negociables») y en
`docs/fundacion/reglas.md`: aislamiento por usuario, acceso autenticado, nunca ejecutar
órdenes, mostrar siempre el `asOf` del dato, y P/L actual separado del realizado.

**En qué punto está el proyecto no se cuenta aquí**: lo dice `docs/tablero.md`, que se
genera, y el frontmatter de cada spec. Este documento llegó a narrar como *en curso* una
épica terminada hacía treinta y seis specs; no vuelve a intentarlo.

## Stack y arquitectura (resumen as-built)

Decisión de stack en **ADR-001**; ingesta de mercado en **ADR-002**.

- **Next.js 16 App Router** (React 19) sobre Vercel; Server Components + Server Actions.
  La línea 16.x es piso de seguridad por **ADR-008**. Rutas en `src/app/`: grupo
  `src/app/(auth)/` (login, registro, recuperación y cambio de contraseña),
  `src/app/dashboard/`, `src/app/vigiladas/`, `src/app/cartera/` (con
  `src/app/cartera/importar/`), `src/app/avisos/`, `src/app/cuenta/`, `src/app/admin/`,
  `src/app/ayuda/`, `src/app/legal/`, y las de API:
  `src/app/api/auth/[...nextauth]/route.ts`, `src/app/api/cron/refresh/route.ts` y
  `src/app/api/version/route.ts`.
- **Auth.js v5 (NextAuth beta) con split-config**: `src/lib/auth/base-config.ts` edge-safe
  (solo callbacks jwt/session, sin DB ni bcrypt) para `src/proxy.ts` —el middleware, que
  Next 16 renombró así—; `src/lib/auth/config.ts` en Node añade provider **Credentials**
  con bcrypt (`src/lib/auth/passwords.ts`) + Postgres. Sesión JWT con **época de
  credencial** (`passwordChangedAt`, **ADR-016**) para invalidar sesiones previas al
  cambiar la contraseña.
- **Drizzle ORM** (`drizzle.config.ts`) con migraciones versionadas (`db:generate` /
  `db:migrate`) en `drizzle/`. **El esquema lo posee `src/db/schema.ts`**: ahí están las
  tablas y sus relaciones, y ahí se mira — este documento no las enumera ni califica de
  *nueva* a ninguna.
- **Cliente de datos INTERCAMBIABLE por `DB_DRIVER`** (`src/db/client.ts`), con **tres
  desenlaces y ninguno silencioso**:
  1. **variable ausente** → Neon serverless, que es como corre producción;
  2. **`DB_DRIVER=neon`** → lo mismo, dicho explícitamente;
  3. **`DB_DRIVER=pg`** → Postgres estándar (driver postgres-js), para desarrollo y para
     el e2e contra una instancia efímera;
  4. **cualquier otro valor** → **falla al arrancar**, nombrando la clave, el valor
     recibido, los valores reconocidos y dónde mirar (`.env.example` y `src/db/client.ts`).
     Hasta **SPEC-060** todo lo no reconocido caía en Neon **en silencio**, así que un
     nombre mal escrito mandaba a la base de producción a quien creía estar en local.
- **Persistencia por entorno**: **Neon Postgres** en producción, **PGlite**
  (`src/db/test-db.ts`) en los unitarios y **embedded-postgres** efímero en el e2e.
- **Aislamiento por `userId` en capa de app** (no RLS): `src/lib/data/ownership.ts`
  (`listForOwner` / `findByIdForOwner`), con `userId` como ancla en el esquema.
- **Las capas del producto** viven en `src/lib/`, una carpeta por capacidad:
  `src/lib/market/` (proveedores, refresco y diagnóstico de cotizaciones),
  `src/lib/triggers/` (motor de zonas), `src/lib/notifications/` (avisos),
  `src/lib/portfolio/` (cartera y P/L), `src/lib/watchlist/` (vigiladas),
  `src/lib/import/` (import de posiciones desde bróker), `src/lib/ops/` (operación y
  panel de admin), `src/lib/help/` (ayuda), `src/lib/legal/`, `src/lib/version/`,
  `src/lib/feedback/`, `src/lib/account/`, `src/lib/registration/` y `src/lib/config/`.
  La lista de arriba orienta; el directorio manda.
- **Ciclo diario, ya implementado** (lo estuvo desde **SPEC-004**; este documento lo dio
  por *«previsto, aún no implementado»* durante cincuenta specs). Es un **Vercel Cron**
  declarado en `vercel.json` que llama a `src/app/api/cron/refresh/route.ts`, protegido
  por `CRON_SECRET`; cada ejecución deja constancia en la tabla `cron_runs` (**ADR-023**).
  **La cadencia y la hora no se escriben aquí**: las declara `vercel.json` y las deciden
  **ADR-004** y **ADR-039** (que **SPEC-059** aplicó al mover el disparo a la mañana UTC,
  porque el proveedor aún no había publicado el cierre a la hora anterior). Desde
  **SPEC-058** el ciclo **ya no es el único escritor de `quotes`**: el alta de una vigilada
  pide precio en el acto (**ADR-038**).
- **Proveedores de mercado tras puerto** (**ADR-002**): los precios los trae **Marketstack**
  (**ADR-012**) y la búsqueda de símbolos, **Twelve Data**. Desde el 2026-08-23 las
  cotizaciones corren sobre **plan de pago** (**ADR-032**), así que la premisa de *«capa
  gratuita»* ya no rige para ellas; el presupuesto se mide en `símbolos distintos × ciclos`
  y no en llamadas (**ADR-027**). Que el cambio de plan no tocara una línea de código es la
  prueba de que el puerto estaba bien puesto.
- **Enlaces absolutos desde configuración, nunca desde el `Host`** de la petición
  (`src/lib/config/app-url.ts`): la clave `APP_BASE_URL` es la que los compone, y un valor
  ausente o envenenado se rechaza nombrando la clave y el fichero (**ADR-015**,
  **SPEC-055**).
- **Tests**: **Vitest** (`vitest.config.ts`, unitarios sobre PGlite) y **Playwright** e2e
  (`playwright.config.ts`, `tests/e2e/`) contra Postgres real efímero. Todo vive en
  `tests/`.
- **Design system**: `design/tremen-ds` como capa de UI.
- **Variables de entorno**: **las declara `.env.example`**, una a una, con su ADR y su
  porqué; `docs/despliegue.md` dice cuáles hay que dar de alta en Vercel y en qué entorno.
  Este documento **no las enumera** — llegó a listar dos de las once, y sin la que trae los
  precios. Nombra alguna suelta sólo cuando la prosa necesita explicar una decisión.

## Decisiones: dónde están y cuáles orientan

**El censo completo es `docs/adr/`**, un fichero por decisión, inmutables y con su estado
en el frontmatter. Este documento no lo reproduce: la copia que llevaba se quedó en cuatro
ADR mientras el directorio crecía hasta cuarenta.

Lo que sí conviene saber de entrada, porque enmarca todo lo demás:

- **`FOUNDATION.md`, D-1…D-7** (*locked*): avisa, no opera; no es tiempo real; el disparo es
  por **zona** (un rango), no por valor; la app no calcula zonas; multiusuario aislado; P/L
  actual y realizado siempre separados; y el instrumento es el que cotice en un **mercado
  soportado** (**D-7 supersedida por ADR-020**: se retira la lista blanca de tipos y el tipo
  se **muestra**; el modelo sigue siendo el de la acción, **ADR-003**).
- **Resoluciones del gate de SPEC-001**: política de contraseña **delegada en Auth.js** (sin
  política propia); aislamiento **en capa de app** con test, con **RLS a futuro** como
  refuerzo; errores de login genéricos.
- **ADR-015** — token de recuperación opaco, de un solo uso, guardado hasheado, de
  caducidad corta y con límite de solicitudes por cuenta; el enlace se compone con
  `APP_BASE_URL` y no con la cabecera `Host`.
- **ADR-016** — invalidación de sesiones por época de credencial. Precio asumido:
  revalidación contra la base en cada petición.
- **ADR-018** — *mergear es desplegar*: no hay paso manual entre el merge y producción, y
  el runbook de `docs/despliegue.md` es parte del trabajo, no un anexo.
- **ADR-025** — una spec en `hecho` no se reabre; los rótulos caducados se agrupan en
  **EPIC-FIX**.
- **ADR-033** — la versión del producto sube en el mismo commit en los dos ficheros que la
  llevan.
- **ADR-037** y **ADR-040** — qué se puede vigilar con un test y qué no. Se leen antes de
  escribir una guardia sobre un documento o sobre un directorio ajeno.

## Riesgos y salvedades

**El estado de un riesgo o de una salvedad vive donde se decide, no aquí.** Este documento
llegó a presentar como *«pendientes de spec»* tres preguntas cerradas hacía meses, y a
listar salvedades de dos specs cuyo estado real estaba en sus ledgers.

- Los **riesgos de épica** están en el fichero de la épica que los levantó, bajo
  `docs/epicas/`.
- Las **salvedades** (`F-SPEC-nnn-n`) están en el ledger de la spec que las levantó, con su
  destino escrito.
- Las **decisiones de gate** están en el ADR o en la propia spec, y en su historial.

Lo único que se dice aquí es lo que **sigue abierto y afecta a cualquiera que trabaje**:

- **La `DATABASE_URL` es compartida entre Production y Preview** (`F-SPEC-023-1`): abrir una
  PR migra producción. Por eso las migraciones son aditivas y compatibles hacia atrás
  (**RI-01**), y por eso un `DB_DRIVER` mal escrito era tan caro antes de **SPEC-060**.
- **El aislamiento es en capa de app, no RLS.** Está cubierto por tests, y reforzarlo con
  RLS sigue siendo un refuerzo pendiente, no un agujero conocido.
