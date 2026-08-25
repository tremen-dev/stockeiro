# Guía de despliegue — Stockeiro

> Runbook para poner Stockeiro en producción en **Vercel**, con **Neon** (Postgres),
> **Marketstack** (cotizaciones), **Twelve Data** (búsqueda de símbolos) y **Resend**
> (email). Pensada para repetirse: sigue los pasos en orden. Los `follow-ups` de despliegue
> de las specs (F-SPEC-001-2, F-SPEC-004-1, F-SPEC-006-1, F-SPEC-011-1, F-SPEC-012-1,
> F-ADR-012-2) se cierran aquí.

> 💳 **Planes contratados de los proveedores externos (el runbook los da por hechos).**
> - **Marketstack** — plan **Basic: 10.000 peticiones/mes** (~$9,99/mes), contratado el
>   **2026-08-23** sobre **cuenta propia del titular** (antes era una cuenta de prueba con
>   un correo que nadie administraba). **`MARKETSTACK_API_KEY` NO cambió**: el plan se
>   contrató sobre la misma clave, así que **no hay ningún paso de rotación** ni nada que
>   tocar en Vercel. Decisión y aritmética en **ADR-032**. La unidad en la que se mide el
>   cupo es `símbolos distintos × ciclos`, **no llamadas** (**ADR-027** pto. 1): hoy 13
>   símbolos × ~31 días ≈ **400 unidades/mes de 10.000**, margen **~25×**, y techo de
>   **~322 símbolos distintos** con ciclo diario. Si alguna vez se plantea cambiar de plan
>   o de proveedor, **la cuenta se rehace en esa unidad y se deja escrita**.
>   Los avisos del proveedor al **75/90/100 %** de consumo llegan ahora al correo del
>   titular: son un **canal del operador, fuera de la app** — la app **no** alerta
>   (ADR-023 pto. 15), solo registra y muestra.
>   ↳ **F-ADR-012-2 queda CERRADO**: la variable está en `.env.example`, en esta guía
>   (§0 y §3.2) y **aprovisionada en Producción** desde el despliegue del 2026-08-18, y
>   desde el 2026-08-23 se sabe además **qué plan la sostiene y de quién es la cuenta**.
> - **Twelve Data** — sigue en **free tier**, y solo para la **búsqueda** de símbolos
>   (ADR-012 pto. 2). No cotiza nada.
> - **Resend** — free tier, 3.000/mes · 100/día (§7).
> - **Neon** y **Vercel** — free/Hobby (el cron de Hobby es diario, §3.3).

> **Estado (2026-08-18):** desplegado y **vivo** en <https://stockeiro.tremen.dev> (dominio
> principal desde 2026-08-17) y en <https://stockeiro-lemon.vercel.app>, con **Neon +
> Marketstack + cron** activos. El esquema se migra **automáticamente en el build** (§1.1).
>
> **Último despliegue: 2026-08-18** (`vercel ls --prod`), y **sí incluye SPEC-023, SPEC-024 y
> SPEC-025**. La recuperación de contraseña está **probada de punta a punta en producción**:
> solicitud → correo desde `@tremen.dev` → enlace a `stockeiro.tremen.dev` → contraseña
> cambiada. Antes de este despliegue, SPEC-023 llevaba **6 días** `hecho` y muda: la lección
> de abajo, repitiéndose por tercera vez.
>
> <sub>Nota de fechas: una versión anterior de esta línea dijo "2026-08-14", que era falso — salió
> de leer el campo *Updated* de `vercel project ls`, que es metadato del **proyecto**, no la fecha
> del despliegue. La fuente correcta es siempre `vercel ls --prod`. Se deja escrito porque es
> exactamente el error que este runbook advierte justo debajo: **la fecha miente**.</sub>
>
> **Atraso medido el 2026-08-18, y por qué importa aquí:** `curl -s
> https://stockeiro.tremen.dev/api/version` respondía **HTTP 404**, es decir, el despliegue vivo
> era **anterior** al merge de SPEC-031. Mergeadas y mudas: **SPEC-026, 027, 029, 031 y 032**,
> más la migración `0008_puzzling_eddie_brock` (`ADD COLUMN instrument_type`, aditiva) **sin
> aplicar en Neon**. El orden para salir de ahí —drenar a mano, comprobar, `ALLOW_MIGRATE`,
> conectar— está en **§13**, y es una precondición, no una sugerencia.
>
> Pendientes:
> - ✅ **Email (Resend)** — F-SPEC-006-1: **CERRADO y PROBADO** el 2026-08-18. `RESEND_API_KEY`
>   y `RESEND_FROM` en Production, dominio `tremen.dev` verificado, y un reset real entregado.
> - ✅ **`APP_BASE_URL`** — F-SPEC-023-3: **CERRADO y PROBADO** el 2026-08-18, con valor
>   `https://stockeiro.tremen.dev` (CNAME en Cloudflare, sin proxy).
> - ✅ **F-SPEC-023-1**: **CERRADO el 2026-08-18** por ops, activando *preview branching* en la
>   integración nativa de Neon (`Create Database Branch For Deployment` = **Preview sí,
>   Production no**, prefijo de variables `DATABASE`). Un build de Preview recibe la
>   `DATABASE_URL` de **su propia rama copy-on-write**, no la de producción. Desde **SPEC-032**
>   hay además una segunda línea que no depende de ese ajuste: la guardia `guard-migrate` (§11).
> - **F-SPEC-011-1**: el build debe alcanzar `cdn.sheetjs.com` (dependencia `xlsx`); ver **§6**.
> - **F-SPEC-020-1**: dialecto de `XSTO` (Estocolmo) sin resolver; sus valores no cotizan y lo dicen.

> ⚠️ **LECCIÓN DEL 2026-08-11 — mergear no era desplegar. Desde SPEC-028, mergear ya es
> desplegar.** EPIC-FIX (SPEC-015/016) estuvo **27 días en `main` sin llegar a producción**: el
> despliegue vivo era del 20-jul y se hizo por CLI desde un árbol de trabajo que no incluía esos
> cambios. Durante ese mes el defecto que la épica arreglaba seguía intacto **y además mudo**,
> porque el diagnóstico que lo habría delatado tampoco estaba desplegado. Ningún paso del ciclo
> tremen-sdd lo detectó: el verificador cierra specs con tests y flujo **local**, no comprueba
> producción.
>
> **La lección no se borra: es la razón de todo lo que hay debajo.** Lo que cambia es el
> remedio. Con el repositorio conectado a Vercel (ADR-018 D-1, **§12**), un merge a `main`
> construye y despliega **sin que nadie teclee nada**, y una puerta automática
> (`.github/workflows/deploy-gate.yml`) espera a que el sha mergeado esté vivo y **se pone roja
> si no llega**. Así que **lo que hay que mirar ahora es el check de la puerta**, no la fecha de
> `vercel ls --prod` — que sigue siendo una pista y sigue **mintiendo** si el árbol desde el que
> se desplegó era viejo.
>
> **Y sigue siendo cierto que una spec no está entregada hasta que su código está VIVO** — eso
> es ahora una regla escrita, **RI-02** en `docs/fundacion/reglas.md`. Desde **SPEC-031** es un
> comando y no un truco distinto por entrega:
> `node scripts/check-alive.mjs --url <origen> --commit <sha>` interroga `/api/version` y
> responde con un código de salida — **§10** documenta el contrato y **§12** qué hacer con cada
> código. Si contesta `unknown`, ese despliegue **no sabe de qué commit viene**: es la firma de
> un despliegue hecho por CLI, que sube sin metadatos de git.

## 0. Qué vamos a aprovisionar

| Variable | Servicio | Para qué | Spec |
|---|---|---|---|
| `DATABASE_URL` | Neon | Postgres de producción | ADR-001 / F-SPEC-001-2 |
| `DB_DRIVER` | — | `neon` en producción (por defecto) | ADR-001 |
| `AUTH_SECRET` | — | Firma de sesión (Auth.js) | SPEC-001 / F-SPEC-001-2 |
| `AUTH_TRUST_HOST` | — | `true` tras el proxy de Vercel | SPEC-001 |
| `MARKETSTACK_API_KEY` | Marketstack | **Cotizaciones** (proveedor de precios). Plan **Basic, 10.000/mes**, **cuenta propia del titular** desde el 2026-08-23. **La clave NO cambió al contratar el plan: no hay rotación.** | ADR-012 / **ADR-032** / F-ADR-012-2 |
| `TWELVE_DATA_API_KEY` | Twelve Data | **Búsqueda** de símbolos (ya no cotiza) | ADR-007 / ADR-012 |
| `CRON_SECRET` | — | Protege `/api/cron/refresh` | ADR-004 / F-SPEC-004-1 |
| `RESEND_API_KEY` | Resend | Envío de avisos por email **y del enlace de reset** | ADR-006 / F-SPEC-006-1 |
| `RESEND_FROM` | Resend | Remitente (dominio verificado) | ADR-006 |
| `APP_BASE_URL` | — | Origen absoluto de los enlaces de **recuperación de contraseña** | SPEC-023 / F-SPEC-023-3 |
| `FEEDBACK_EMAIL` | — | **Opcional.** Buzón del canal de feedback del pie | SPEC-039 / F-SPEC-039-6 |

> ⚠️ **`APP_BASE_URL` debe ser el origen REAL del despliegue** (hoy
> `https://stockeiro.tremen.dev`, el dominio principal desde el 2026-08-17), no el valor de
> ejemplo de `.env.example` (`https://stockeiro.app`, un dominio propio que quizá no exista
> aún). Si apunta a otro sitio, los enlaces de reset llevan a la nada — y lo hacen con aire
> de estar bien configurado. `appBaseUrl()` **falla ruidosamente si la variable falta**, pero
> no puede detectar que esté *mal*: eso solo lo ve el usuario que pincha el enlace.
>
> **Y ojo, que esto cambió**: desde **SPEC-051** la clave se lee **en tiempo de build**
> —`metadataBase` del layout raíz—, así que si falta, **`next build` falla y no hay
> despliegue**. Hasta el 2026-08-25 esta misma línea decía lo contrario («el error es en
> tiempo de petición, así que el deploy sale verde igualmente»), y era falso: el preview del
> PR #58 se cayó exactamente por eso el 2026-08-23. **Preview también la necesita**, y por eso
> se le añadió ese mismo día (§13).

> ℹ️ **`FEEDBACK_EMAIL` es la única variable que añade EPIC-004, y normalmente NO hay que
> ponerla** (SPEC-039 CA-16). El enlace «contar algo o reportar un fallo» del pie compone un
> `mailto:` a esta dirección; si la variable falta o llega vacía, se usa el **contacto del
> titular** del aviso legal (`src/lib/legal/content.ts`), que es la dirección prevista. Solo
> se define para desviar el feedback a otro buzón sin desplegar código. Lo que **sí** es
> prerrequisito de publicar es que ese buzón **exista y alguien lo lea** (F-SPEC-039-6): sin
> él, CE-8 tiene enlace y no tiene canal, que es peor que no tener enlace.

Plantilla completa en `.env.example`. Genera los secretos propios:

```bash
openssl rand -base64 32   # AUTH_SECRET
openssl rand -hex 32      # CRON_SECRET
```

---

## 1. Neon (Postgres)

**Opción A — Integración nativa de Vercel (recomendada).** Aprovisiona la BD y **auto-inyecta
`DATABASE_URL`** en el proyecto de Vercel, sin copiar strings a mano.

1. En el proyecto de Vercel → **Storage → Create Database → Neon** (o Marketplace → Neon).
2. Elige región cercana a la de las Functions (p. ej. `fra1` para Europa).
3. Al conectarla al proyecto, Vercel crea `DATABASE_URL` (y variantes) en las envs.

**Opción B — Consola de Neon (manual).**
1. Crea un proyecto en <https://console.neon.tech> y copia la connection string
   (`postgresql://…?sslmode=require`).
2. La pondrás como `DATABASE_URL` en Vercel (paso 3).

### 1.1 Materializar el esquema en Neon

**El deploy migra solo, si tiene permiso.** `vercel.json` define:

```json
"buildCommand": "node scripts/guard-migrate.mjs && npm run db:migrate && npm run build"
```

Es decir, **cada** deploy (incluido `vercel --prod`) pide permiso a la **guardia** (SPEC-032,
§11) y solo entonces ejecuta `drizzle-kit migrate` con el `DATABASE_URL` de ese entorno
**antes** de construir, aplicando las migraciones versionadas de `drizzle/`. Es
**idempotente** (Drizzle lleva registro de lo ya aplicado) y si la guardia rechaza o la
migración falla, el `&&` corta: **el build falla y no se despliega** — se queda la versión
anterior. **No hay paso manual** tras una spec que cambie el esquema: basta desplegar. En
Production la guardia autoriza siempre, así que un `vercel --prod` se comporta igual que
antes de SPEC-032.

Solo necesitas migrar a mano si quieres tocar la BD **fuera** de un deploy (p. ej. preparar
Neon antes del primer despliegue, o depurar). Ese camino **no pasa por la guardia** a
propósito —no hay `VERCEL_ENV` en tu máquina, y una defensa que estorba es una defensa que
alguien acaba desactivando—, así que `npm run db:migrate` sigue siendo `drizzle-kit migrate`
a secas:

```bash
# con la connection string real de Neon:
DATABASE_URL="postgresql://…?sslmode=require" npm run db:migrate
```

- `npm run db:generate` regenera la migración desde `src/db/schema.ts` si cambia el esquema
  (esto sí es manual, y su fichero `drizzle/NNNN_*.sql` se commitea).
- Alternativa rápida sin ficheros de migración: `DATABASE_URL=… npx drizzle-kit push`.

---

## 2. Resend (email de avisos)

El aviso proactivo (SPEC-006) sale por email. Requiere **dominio verificado** (deliverability).

1. Crea cuenta en <https://resend.com>.
2. **Domains → Add Domain** con tu dominio (p. ej. `tremen.dev`, que es el que este
   proyecto tiene verificado — ver §0). Resend te da registros
   **DNS** (SPF/`MX` de retorno y **DKIM**); añádelos en tu registrador/gestor DNS y espera a
   que Resend marque el dominio **Verified** (minutos–horas).
3. **API Keys → Create** → copia la key (será `RESEND_API_KEY`).
4. Fija `RESEND_FROM` a una dirección de ese dominio. El valor que el código trae por
   defecto (SPEC-056 CA-19) es `"Stockeiro - tremen.dev" <stockeiro@tremen.dev>`.

> Sin dominio verificado, Resend solo permite enviar a tu propio email (modo test). Para los
> testers necesitas el dominio verificado. Free tier: 3.000 emails/mes, 100/día (suficiente MVP).

---

## 3. Vercel (deploy)

Requisitos: Vercel CLI instalado y sesión iniciada (`vercel whoami`).

### 3.1 Vincular el proyecto (una vez)

```bash
vercel link            # elige/crea el proyecto bajo tu scope
```

### 3.2 Configurar las variables de entorno

Con la integración de Neon, `DATABASE_URL` ya está. Añade el resto (a Production; repite para
Preview si quieres previews funcionales):

```bash
vercel env add AUTH_SECRET production          # pega el valor generado
vercel env add AUTH_TRUST_HOST production      # true
vercel env add MARKETSTACK_API_KEY production   # key de Marketstack (plan Basic, 10.000/mes)
vercel env add TWELVE_DATA_API_KEY production   # key de Twelve Data (free, solo búsqueda)
vercel env add CRON_SECRET production           # el generado
vercel env add RESEND_API_KEY production        # key de Resend
vercel env add RESEND_FROM production           # "Stockeiro - tremen.dev" <stockeiro@tremen.dev>
# Si NO usas la integración de Neon, añade también:
vercel env add DATABASE_URL production          # connection string de Neon
```

Comprobar: `vercel env ls`.

> **Importante:** el build necesita `DATABASE_URL` presente (el cliente de DB se instancia al
> importar). Si falta, `next build` falla. La integración de Neon o el `env add` lo resuelven.

### 3.3 Cron (ya configurado)

`vercel.json` declara el cron diario:

```json
{ "crons": [{ "path": "/api/cron/refresh", "schedule": "0 22 * * *" }] }
```

Vercel invoca esa ruta 1×/día y **envía `Authorization: Bearer $CRON_SECRET`** automáticamente
(por eso basta con tener `CRON_SECRET` en las envs). En plan Hobby el cron es diario (nos vale).

### 3.4 Desplegar

**No se despliega: se mergea.** Desde **SPEC-028** (ADR-018 D-1) el repositorio
`tremen-dev/stockeiro` está conectado al proyecto de Vercel por la integración Git nativa, con
rama de producción `main`:

| Qué haces | Qué pasa solo |
|---|---|
| **Mergeas una PR a `main`** | Vercel construye ese commit y **despliega a producción**. Nadie ejecuta ningún comando. Detrás, la puerta post-deploy comprueba que el sha llegó (**§12**) |
| **Abres o actualizas una PR** | Vercel construye un **despliegue de Preview** con su propia URL, publicada como check en la PR, y con su propia rama de Neon (**§13**) |

El artefacto sale de un **commit**, no de un directorio: es lo que mata de raíz la causa 2 de
ADR-018 (*"`vercel --prod` sube el árbol de trabajo local, no `main`"*). Lo que hay que mirar
tras mergear es el **check de la puerta**, y el pipeline entero está documentado en **§12**.

> 🚨 **`vercel --prod --archive=tgz` sigue existiendo, pero pasa a ser un RECURSO DE
> EMERGENCIA** (ADR-018 D-1), no el procedimiento. Se usa cuando la integración no puede
> desplegar y hay que poner algo en producción igualmente — por ejemplo, para **drenar un
> atraso antes de conectar el repositorio** (§13).
>
> Sus dos trampas, ya documentadas y vigentes: sin `--archive=tgz` falla con un engañoso
> **`"Not authorized"`** que no es un problema de permisos (**§6**), y lanzado desde un **git
> worktree** pierde los metadatos de git, porque ahí `.git` es un fichero y no un directorio.
>
> **Y una consecuencia nueva que hay que decir en voz alta:** un despliegue por CLI sube **sin**
> `.git`, así que `/api/version` responderá `commit: unknown` y **la puerta lo delataría** —se
> pone roja con código **2** (§12)—. Deja de ser un detalle de diagnóstico: `unknown` en
> producción es **la firma de un despliegue hecho fuera de proceso**.

---

## 4. Comprobaciones post-despliegue (smoke test)

1. **Auth**: abre la URL, **regístrate**, entra al panel. (valida `DATABASE_URL` + `AUTH_SECRET`)
2. **Vigiladas**: añade una acción con zona; debe aparecer (estado "Sin cotización" hasta el 1er ciclo).
3. **Cartera**: registra una compra; el P/L actual será "—" hasta que haya cotización.
4. **Ingesta+disparo+aviso manual** (sin esperar al cron), con el `CRON_SECRET` real:

   ```bash
   curl -i -H "Authorization: Bearer $CRON_SECRET" https://TU-APP.vercel.app/api/cron/refresh
   ```

   - Sin la cabecera correcta → **401** (CA-7).
   - Con ella → **200** + JSON `{ refresh, triggers, notifications }`. Revisa que el P/L actual
     de la cartera pasa a tener dato y que, si alguna acción entró en zona, llega el **email**
     (Resend) y aparece en `/avisos` con el contador de no-leídos.
5. **Logs**: `vercel logs TU-APP.vercel.app` si algo falla.

---

## 5. Checklist rápido

- [ ] Neon creado y `DATABASE_URL` en Vercel.
- [ ] Esquema: **automático en el build** (`db:migrate` en `buildCommand`, §1.1). Solo manual si
  migras fuera de un deploy.
- [ ] Entorno *Preview* con **BD Neon aparte** (o sin `DATABASE_URL` de producción) — si no, una
  PR migraría producción (§6).
- [ ] `AUTH_SECRET`, `AUTH_TRUST_HOST` puestos.
- [ ] Marketstack: `MARKETSTACK_API_KEY` puesta, y **la cuenta detrás es la del titular con
  plan Basic (10.000/mes)** — no una cuenta de prueba (ADR-032). Twelve Data:
  `TWELVE_DATA_API_KEY` (free, solo búsqueda); `CRON_SECRET` generado y puesto.
- [ ] Resend: dominio verificado, `RESEND_API_KEY`, `RESEND_FROM` — **bloqueante desde SPEC-023**
  (ver **§7** y **§8**). Para los *avisos* era opcional (fallback in-app, RN-15); para la
  *recuperación de contraseña* no hay fallback y sin Resend no funciona.
- [ ] `APP_BASE_URL` con el **origen real del despliegue** (no el ejemplo de `.env.example`) — §0.
- [ ] `E2E_OUTBOX_FILE` **NO** definida en Vercel (desviaría el correo a un fichero) — F-SPEC-023-8.
- [ ] Buzón del canal de feedback **creado y leído por alguien** (F-SPEC-039-6). `FEEDBACK_EMAIL`
  solo hace falta si se desvía a un buzón distinto del contacto del aviso legal.
- [ ] `ALLOW_MIGRATE=1` en el entorno **Preview** — sin ella, **todas** las previews fallan en la
  guardia (§11 y §13).
- [ ] Repositorio conectado a Vercel con rama de producción `main` (§13).
- [ ] **El check de la puerta en verde** para el commit mergeado —`Deploy gate / Alive` en la
  lista de checks de GitHub (§12)—. Es lo que sustituye al viejo *"deploy manual verde"*: dice
  que el build alcanzó `cdn.sheetjs.com` (§6), que la migración pasó y que el sha está **vivo**
  en `https://stockeiro.tremen.dev`.
- [ ] Smoke test (registro + cron manual + email) OK.
- [ ] Import (EPIC-002): subir un extracto en `/cartera/importar` y comprobar la resolución
  contra Twelve Data **real** — cierra **F-SPEC-012-1** (la tabla `MARKET_MAP` etiqueta→MIC de
  `src/lib/import/market-map.ts` es **provisional**: se diseñó por familia de MIC para tolerar
  sub-MICs, pero solo está verificada con el proveedor *fake*).

---

## 6. Notas y gotchas

- 🚨 **`vercel --prod` falla con `"Not authorized"` y NO es un problema de permisos.** Visto el
  2026-08-18. El token es válido (`vercel whoami`, `env add` y `domains add` funcionan); lo que
  pasa es que Vercel responde `missing_files` —normal: pide los blobs— y entonces la CLI lanza
  **cientos de POST paralelos** a `/v2/files` y muere ahí, traduciendo el fallo como error de
  autorización. **Solución: `vercel --prod --archive=tgz`**, que sube un único archivo
  comprimido en vez de cientos de ficheros sueltos. Funciona a la primera. No pierdas tiempo
  revisando tokens, scopes ni equipos: el mensaje miente sobre su causa. Desde SPEC-028 esto
  solo hace falta en el camino de emergencia (§3.4).
- ⚠️ **Desplegar por CLI pierde los metadatos de git — y eso es ahora lo que verás si alguien
  despliega FUERA DE PROCESO.** La CLI sube un directorio, no un commit; y desde un git worktree
  ni siquiera encuentra `.git/config` —ahí `.git` es un **fichero**— y avisa con `Error while
  parsing repo data`. El despliegue funciona, pero sale **sin** rama ni commit asociados, así
  que `/api/version` responde `commit: unknown`.
  Antes de SPEC-028 eso era el estado normal de todos los despliegues. **Ahora es una anomalía
  con nombre**: si producción responde `unknown`, alguien desplegó a mano por encima de la
  integración Git, y la puerta post-deploy se pone roja con código **2** (§12). Es exactamente
  la señal que ADR-018 quería con `/api/version`.
- **Rotación de secretos**: si regeneras `CRON_SECRET`/`AUTH_SECRET`, actualiza la env en Vercel
  y **redeploy** (las envs se leen en build/arranque).
- **Migraciones**: el deploy **SÍ migra solo** — `vercel.json` corre `npm run db:migrate`
  dentro del `buildCommand`, precedido por la guardia `guard-migrate` (ver **§1.1** y **§11**).
  Tras una spec que cambie el esquema no hay paso manual: basta desplegar. Si la guardia
  rechaza o la migración falla, el build falla y no se despliega.
- **Preview deployments**: el `buildCommand` corre en **todos** los entornos, así que un deploy
  de *Preview* también intenta migrar. Hoy hay dos cosas entre eso y un accidente, y conviene
  no confundirlas:
  1. **Contra qué base migra** lo responde el *preview branching* de Neon (cerró F-SPEC-023-1 el
     2026-08-18): cada despliegue de Preview recibe la `DATABASE_URL` de **su propia rama
     copy-on-write**, no la de producción.
  2. **Si tiene permiso para migrar** lo responde la guardia `guard-migrate` (SPEC-032 / ADR-018
     D-2), que vive en el repositorio y **no depende de ese ajuste del panel**: si alguien apaga
     el branching, la guardia sigue ahí. Un Preview sin `ALLOW_MIGRATE=1` **no migra: falla en
     rojo**, que es el comportamiento correcto. Ver **§11**.
- 🚨 **Borrar la rama de git NO borra la rama de Neon.** Es la trampa que tumbó un despliegue de
  producción el **2026-08-19/20**, y no es una suposición: con la **integración gestionada por
  Vercel** —la que este proyecto tiene— la rama de preview de Neon **no cuelga de la PR sino del
  despliegue de Vercel**, y la **retención de despliegues de Vercel** es de **6 meses por
  defecto**. En palabras de Neon: *"Preview branches are automatically deleted when their
  corresponding Vercel deployments are removed. The timing of this cleanup depends on Vercel's
  deployment retention policy, which **retains preview deployments for 6 months by default**"*, y
  por eso *"preview branches can persist long after a PR is closed"*
  (<https://neon.com/docs/guides/vercel-managed-integration>).
  Traducido a este proyecto: **una spec por PR** y un techo de **10 ramas** en el plan Free hacen
  que el sistema reviente **cada ~8 merges**, indefinidamente — y revienta **después** del merge,
  cuando ya se está desplegando. Desde **SPEC-042** hay un mecanismo que lo barre al cerrar la PR
  en vez de un recordatorio: **§13.3**.
- **Dependencia del build con el CDN de SheetJS** (F-SPEC-011-1): `xlsx` es dependencia de
  producción instalada desde `https://cdn.sheetjs.com/...` (el paquete de npm está congelado
  y con CVEs; SPEC-011). El build de Vercel debe poder alcanzar ese host: si no, `npm install`
  falla **antes** de migrar y no se despliega.
- **Regiones**: alinea la región de Neon con la de las Functions para latencia baja.

---

## 7. Añadir email (Resend) a un despliegue ya en producción

La app ya está desplegada y **funciona sin email**: cada aviso se registra in-app (fuente de
verdad y fallback, RN-15) y el usuario lo ve en `/avisos`; solo falta el **envío proactivo por
correo** (SPEC-006 / ADR-006). El `ResendSender` real ya está en el código detrás del puerto
`NotificationSender`; activarlo es **solo configuración**, sin tocar código ni volver a verificar.

Pasos para incorporarlo cuando quieras (cierra **F-SPEC-006-1**):

1. **Cuenta + dominio verificado (Resend).** Sigue la **§2**: crea la cuenta, añade tu dominio en
   *Domains* y publica los registros **DNS** (SPF/DKIM) en tu gestor DNS hasta que Resend lo marque
   *Verified*. Crea una **API Key**.
2. **Añade las variables a Vercel** (Production; repite en Preview si lo usas):

   ```bash
   printf '%s' "re_XXXX_tu_api_key" | vercel env add RESEND_API_KEY production
   printf '%s' '"Stockeiro - tremen.dev" <stockeiro@tremen.dev>' | vercel env add RESEND_FROM production
   ```

   Confirma con `vercel env ls production`.
3. **Redeploy** para que el runtime lea las nuevas variables (las envs se aplican en
   build/arranque). Desde SPEC-028 la vía normal **no** es la CLI: en el panel de Vercel,
   *Deployments → el último de producción → Redeploy*; o mergea cualquier cosa a `main`, que
   despliega solo (§3.4 y §12). La CLI queda para la emergencia:

   ```bash
   vercel --prod --archive=tgz     # solo si la integracion no puede desplegar (§3.4)
   ```

4. **Verifica el envío** (con datos reales que disparen un aviso):
   - Registra/usa un usuario, vigila una acción con una zona que la última cotización cumpla.
   - Dispara el ciclo sin esperar al cron:

     ```bash
     curl -i -H "Authorization: Bearer $CRON_SECRET" https://TU-APP.vercel.app/api/cron/refresh
     ```

   - Debe llegar el **email** de entrada en zona y el aviso aparecer en `/avisos`. Señal de éxito
     adicional: el `status` del aviso pasa de `failed` (in-app, sin email) a `sent`.
   - Si el email no llega: revisa que el dominio esté *Verified*, que `RESEND_FROM` use ese dominio,
     el bounce rate (<4 %) y los `vercel logs`. Mientras tanto, el aviso NO se pierde (queda in-app).

> **Nada que revertir si se desactiva:** si quitas `RESEND_API_KEY`, `ResendSender` lanza y el
> servicio marca el aviso `failed` pero lo conserva in-app (RN-15). El producto sigue usable.
> **Coste:** free tier de Resend 3.000/mes · 100/día (suficiente para el MVP de testers).

> ⚠️ Lo de arriba vale para los **avisos**. Para la **recuperación de contraseña** NO: ese
> correo no se registra in-app a propósito (SPEC-023 CA-3, para que no sea legible desde la
> sesión del intruso al que se pretende expulsar). Sin Resend, la recuperación **no funciona**
> y el usuario no se entera: el formulario acusa recibo igualmente, porque el acuse es genérico
> por diseño (CA-1/CA-2). Es un fallo **silencioso**.

---

## 8. Activar la recuperación de contraseña (SPEC-023)

> ✅ **COMPLETADO el 2026-08-18.** SPEC-023 está viva y probada de punta a punta en producción:
> se solicitó un reset real, llegó el correo desde `@tremen.dev`, el enlace abrió en
> `stockeiro.tremen.dev` y la contraseña se cambió. `/forgot-password` responde **200** en ambos
> dominios (antes: 307). Se conservan los pasos como **procedimiento repetible** —para otro
> entorno, o para reconstruir esto desde cero—, no como tarea pendiente.

Estado original del encargo: spec en `hecho` (16/16 CA, GREEN el 2026-08-12) y sin desplegar
durante 6 días. Pasos, en este orden — el orden importa:

1. **Resend con dominio verificado** (§2 y §7). Es **bloqueante**: sin él no hay recuperación.
2. **Variables en Production** (`vercel env add … production`):
   - `APP_BASE_URL` → el **origen real** del despliegue (ver la advertencia de §0).
   - `RESEND_API_KEY` y `RESEND_FROM` (dominio verificado).
   - Confirma que **`E2E_OUTBOX_FILE` NO existe** (`vercel env ls production`): esa variable
     desvía el correo a un fichero y dejaría la recuperación muda (F-SPEC-023-8).
3. **Merge de la PR #24** a `main`.
4. **Desplegar**: `vercel --prod --archive=tgz` **desde un árbol de trabajo que contenga el
   merge** (sin `--archive` falla con un engañoso `"Not authorized"`; ver §6). Releer la
   lección del 2026-08-11 al principio de este runbook: `vercel --prod` sube **tu árbol
   local**, no lo que hay en `main`. La forma de asegurarlo, y que funcionó aquí:
   ```bash
   git fetch origin
   git switch --detach origin/main          # el arbol pasa a SER main, exactamente
   git status --short -- src drizzle package.json vercel.json   # debe salir vacio
   vercel --prod --archive=tgz
   ```
5. **La migración entra en ese deploy** (`db:migrate` en el `buildCommand`): `CREATE TABLE
   password_reset_tokens` y `ADD COLUMN users.password_changed_at NOT NULL DEFAULT now()`.
   Ambas **aditivas y compatibles hacia atrás**. Si falla, el `&&` corta: no se despliega y se
   queda la versión anterior.
6. ⚠️ **Este deploy cierra la sesión de TODOS los usuarios, una vez.** Un JWT sin época de
   credencial se considera caducado (ADR-016 pto. 6); lo contrario dejaría una puerta
   permanente para cualquier cookie antigua. **Que no coincida con el día en que invites a
   testers**: sería su primera impresión.
7. **Smoke test** (con una cuenta real):
   - `/login` muestra el enlace de "he olvidado mi contraseña"; `/forgot-password` carga.
   - Pide el reset → **llega el correo** → el enlace abre la página de contraseña nueva.
   - Establece una nueva → aterrizas en `/login` (no hay auto-login, CA-14) → entras con la
     nueva y **no** con la vieja.
   - Con sesión abierta en otro navegador: tras el reset, esa sesión **ya no sirve datos**.
   - Email inexistente → **el mismo acuse genérico** y ningún correo (CA-1).
8. **Comprueba que está VIVO**, no solo mergeado (SPEC-031; contrato y códigos en **§10**):
   ```bash
   node scripts/check-alive.mjs --url https://stockeiro.tremen.dev
   ```
   Sale con **0** si el despliegue sabe de qué commit viene, y con **2** si responde
   `unknown` — que es lo que responderá mientras los despliegues se sigan haciendo por CLI.
   Cuando la integración Git rellene el sha (SPEC-028), la forma exacta es
   `--commit $(git rev-parse origin/main)`.

### Nota sobre Preview y la BD de producción (F-SPEC-023-1, cerrado el 2026-08-18)

**Lo que había hasta el 2026-08-17**: `DATABASE_URL` definida para **`Production, Preview`** con
un único valor (`vercel env ls production`). Como el `buildCommand` migra en todos los entornos,
un build de Preview habría migrado producción. La trampa estaba *latente, no activa*, porque no
había integración Vercel↔GitHub que disparase builds.

**Lo que hay desde el 2026-08-18**, y es el cierre de F-SPEC-023-1: la integración nativa de
Neon tiene activado el ***preview branching*** — `Create Database Branch For Deployment` =
**Preview sí, Production no**, con prefijo de variables `DATABASE`. Cada despliegue de Preview
recibe la `DATABASE_URL` de **su propia rama copy-on-write** de Neon. Producción y las PRs ya
no comparten base.

**Y por qué eso no cierra el asunto del todo.** El *preview branching* es un ajuste de un panel
que nadie audita y que nadie versiona: se puede desactivar, se puede desconectar y reconectar el
recurso sin esa casilla, o se puede crear un entorno nuevo que herede la `DATABASE_URL` de
siempre. Por eso SPEC-032 añade la guardia `guard-migrate` (§11), que vive en el repositorio,
se prueba con tests y **sobrevive a cualquier reconfiguración de Vercel**. Las dos responden
preguntas distintas: el branching responde *contra qué base migro*; la guardia, *si tengo
permiso para migrar aquí*.

Residual conocido, declarado como **F-SPEC-032-1**: `ALLOW_MIGRATE=1` en Preview es una
autorización **permanente** que asume que el branching sigue encendido. Si alguien lo apaga, el
permiso sobrevive. La mitigación que hay hoy es que la guardia **imprime en el log del build el
host y el nombre de la base** contra los que autoriza (§11): no lo previene, lo delata.

---

## 9. Verificación automática en las PR (CI)

Desde **SPEC-027** (ADR-018 D-4) existe `.github/workflows/ci.yml`. Corre en **cada PR contra
`main`** y en **cada push a `main`**, en **Node 24** (la versión de Vercel, tomada de `.nvmrc`),
en dos jobs paralelos que aparecen como dos checks separados en la PR:

| Check | Steps (uno por gate) |
|---|---|
| `CI / Checks` | `Typecheck` · `Lint` · `Unit tests` · `Migration scan` |
| `CI / E2E` | `Build` · `End-to-end tests` |

`Migration scan` lo añadió **SPEC-032**: ejecuta `npm run db:scan` y nada más (ver **§11**).
Los cuatro gates de `Checks` se ejecutan **aunque uno falle**, para que el primer rojo no tape a
los demás. Cuando el e2e falla, el job sube un artefacto (`playwright-report/`,
`test-results/` con trazas, `_qa/`) con 7 días de retención; en verde no sube nada.

> ✅ **Estos dos checks IMPIDEN mezclar.** Desde el **2026-08-19** el repositorio es público y
> `main` está protegida por el ruleset **`Protected main`** (`enforcement: active`), que exige
> **PR** y los dos contextos de la tabla en verde —**`Checks`** y **`E2E`**— y **no admite
> excepciones**: la lista de *bypass* está vacía (`bypass_actors: []`), así que la regla frena
> también al dueño del repositorio. Con cualquiera de los dos en rojo, GitHub no deja mezclar.
> Importa especialmente desde **SPEC-028**, porque **mezclar es desplegar**: esta protección es
> lo que sostiene que ADR-018 retirase el gate humano previo a producción.
>
> ⚠️ **Lo que NO cubre**: no exige revisión de nadie (`required_approving_review_count: 0`), no
> exige que la rama esté al día con `main`, y **`Alive` —la puerta post-deploy— no es ni debe ser
> un check requerido**, porque corre en `push` a `main`, después del merge. Las piezas exactas,
> cómo comprobarlas en un comando y qué hacer si alguien las cambia, en **§12.5**.

### Los **tres** workflows del repositorio, y qué pregunta responde cada uno

Desde **SPEC-042** hay **tres** workflows en `.github/workflows/`, y no es acumulación: son tres
preguntas distintas, en tres momentos distintos, y cada rojo pide una reacción distinta.

| Fichero | Pregunta | Cuándo corre | ¿Frena el merge? |
|---|---|---|---|
| `ci.yml` | *¿se puede mezclar?* | en cada PR y en cada push a `main` — **antes** del merge | **Sí**: `Checks` y `E2E` son los checks requeridos (§12.5) |
| `deploy-gate.yml` | *¿llegó?* | en cada push a `main` — **después** del merge | **No** |
| `neon-preview-cleanup.yml` | *¿queda basura?* | **al cerrar la PR** | **No** |

> ⚠️ **El tercero no es, y no debe ser, un check requerido** — exactamente por la misma razón que
> `Alive` tampoco lo es (§12.5, punto 4): corre **al cerrar** la PR, o sea cuando el merge ya
> ocurrió. En una PR abierta no llega a existir, así que exigirlo bloquearía **todas** las PR
> esperando un check que nunca va a aparecer. Un check requerido que se ejecuta después del merge
> es una contradicción.
>
> Y es el **único fichero del repositorio que lleva un secreto** (`NEON_API_KEY`). Vive aparte
> justo por eso: que `ci.yml` y `deploy-gate.yml` no lleven ninguno está congelado en tests de
> otras dos specs, y meterlo dentro habría obligado a editarlos. Qué borra, con qué límites y qué
> cuesta: **§13.3**.

Lo que la CI de las PR **no** hace, y conviene no darlo por hecho:

- **No despliega nada** ni conecta el repo con Vercel: eso lo hace la integración Git y lo
  documenta **§12** (SPEC-028 / ADR-018 D-1). La puerta post-deploy vive en **otro** fichero,
  `.github/workflows/deploy-gate.yml`, a propósito: la CI responde *"¿se puede mezclar?"* antes
  del merge y la puerta responde *"¿llegó?"* después. Un
  runner que ejecuta `npm run build` **no** ejecuta el `buildCommand` de `vercel.json`, así que
  **no** ejecuta `db:migrate`: añadir esta CI **no** activa la trampa de F-SPEC-023-1.
- **No lleva ni un secreto.** Las variables que el build exige van en claro en el YAML con
  valores de juguete (`postgres://ci:ci@localhost:5432/ci`); el e2e levanta su propio Postgres
  efímero y usa proveedores *fake*.
- **No escribe en el repositorio** (`permissions: contents: read`).

---

## 10. ¿Qué está vivo? — `/api/version` y la comprobación de vida

Desde **SPEC-031** (ADR-018 D-6) el despliegue **dice de qué commit viene**, y hay un
comando que lo pregunta. Sustituye al `curl` de una cadena inventada que este runbook
prescribía antes: aquello funcionaba una vez, para una spec, si a alguien se le ocurría una
cadena que solo existiera tras ese cambio.

> **Alcance**: esta sección es el **contrato** del endpoint y del comando, para uso manual.
> El despliegue automático, la puerta post-deploy y la conexión del repo a Vercel los entregó
> **SPEC-028** y se documentan en **§12**, que consume este mismo script desde un paso sin
> secretos.

### El contrato de `/api/version`

Endpoint público (el `matcher` del proxy excluye `/api`), sin caché (`Cache-Control:
no-store`) y **sin base de datos**: responde aunque Neon esté caída, que es justo cuando más
falta hace. Devuelve **exactamente** tres claves y ninguna más:

| Clave | Qué es | Valor si no se sabe |
|---|---|---|
| `commit` | Sha del commit del que se construyó el artefacto | `unknown` |
| `environment` | `production`, `preview` o `development` | `unknown` |
| `builtAt` | Instante del build, ISO-8601 | `unknown` |

```bash
curl -s https://stockeiro.tremen.dev/api/version
# {"commit":"<sha del commit mergeado>","environment":"production","builtAt":"2026-…Z"}
```

Los tres valores van **congelados en el build** (canal `env` de `next.config.mjs`): no se
pueden cambiar sin reconstruir. Si pudieran, la comprobación mentiría.

> ⚠️ **`commit: unknown` significa que ese despliegue no viene de la integración Git.**
> `VERCEL_GIT_COMMIT_SHA` llega vacía y el artefacto **no sabe de dónde viene** — exactamente
> lo que son los despliegues hechos por CLI, que suben un directorio y no un commit. Con el
> repositorio conectado (§13) un despliegue de producción lleva **siempre** el sha del merge,
> así que un `unknown` en producción es una **anomalía**, no el estado normal, y la puerta lo
> pone en rojo con código **2** (§12). En un `npm run build` **local** sí sale un sha real: el
> build cae a `git rev-parse HEAD`.

### El comando

```bash
node scripts/check-alive.mjs --url <origen> [--commit <sha>] [--timeout <s>] [--interval <s>]
```

- `--url` es lo único obligatorio; se consulta `<origen>/api/version`.
- Sin `--commit` es un **smoke test**: basta con que la identidad sea legible y no sea
  `unknown`.
- Con `--commit` espera a que ese sha aparezca, reintentando cada `--interval` segundos
  (por defecto 5) hasta agotar `--timeout` (por defecto 120): un despliegue tarda en
  propagarse, y un fallo de red no es un veredicto.
- **La presencia de `--commit` es lo que separa los dos modos**, y con ella cambia lo que
  significa un `unknown` (SPEC-033). Sin `--commit` la pregunta es *"¿este despliegue sabe
  de dónde viene?"*: `unknown` la responde, y el **2** sale al instante. Con `--commit` la
  pregunta es otra —*"¿ha llegado ya el mío?"*— y ahí `unknown` significa **"todavía no"**:
  se reintenta, y el **2** solo llega **al agotar el plazo**. En cuanto ve el primer
  `unknown` el script escribe **una** línea diciendo que sigue esperando y con qué `builtAt`,
  para que una espera larga no se confunda con un cuelgue.
- No lee **ninguna** variable de entorno y no importa nada fuera de la biblioteca estándar
  de Node: corre con el repositorio clonado y nada instalado.

### Los códigos de salida

Son el contrato, no un detalle de implementación: distinguen *"aún no ha llegado"* de
*"este despliegue no sabe de dónde viene"*, y esa diferencia no se reconstruye después
leyendo un log.

| Código | Significa | Qué hacer |
|---|---|---|
| **0** | El despliegue lleva el commit esperado (o, sin `--commit`, sabe de dónde viene) | Nada: está vivo |
| **1** | No coincide, o se agotó el plazo esperándolo | Mirar el sha *último visto* que imprime: dice qué hay vivo ahora |
| **2** | El despliegue responde `unknown` | **No** es un desacuerdo de shas: ahí no hay metadatos de git. Lo que hay que hacer depende del **modo**. Sin `--commit` (smoke): es **terminal e inmediato**, y con el repositorio conectado (§13) un `unknown` en producción es una **anomalía** —ver el aviso de arriba—, no el estado normal. Con `--commit`: es **transitorio**, el script sigue esperando, y si el 2 llega es porque **se agotó el plazo entero** sin que apareciera nada con metadatos de git (§12.3) |
| **3** | Uso incorrecto, o respuesta ininteligible | Revisar los argumentos; si el cuerpo no es el contrato, el origen no es esta app |

---

## 11. Las dos guardias de migración (SPEC-032)

Desde **SPEC-032** (ADR-018 D-2 y D-5.2) hay dos piezas entre una migración y el daño, y
responden preguntas distintas:

| Pieza | Pregunta que responde | Dónde corre |
|---|---|---|
| `scripts/guard-migrate.mjs` | ¿Tiene **este build** permiso para migrar? | Dentro del `buildCommand` de Vercel |
| `scripts/scan-destructive-sql.mjs` | ¿Hay SQL **destructivo** sin justificar por escrito? | En la CI (`Migration scan`) y en `npm test` |

> **Alcance**: esta sección es el **contrato** de las dos guardias. El despliegue automático,
> la conexión del repo a Vercel y la puerta post-deploy los entregó **SPEC-028** y viven en
> **§12**; lo que la guardia protege —que un build de Preview no migre producción— pasó de
> hipótesis a rutina el día en que el repositorio se conectó.

### 11.1 La guardia del build — `guard-migrate`

`vercel.json` encadena:

```
node scripts/guard-migrate.mjs && npm run db:migrate && npm run build
```

La guardia **no acepta argumentos**: decide leyendo solo el entorno, y **nunca abre la base ni
sale a la red**. La propiedad que fija ADR-018 D-2, en una línea: *un build que no sea de
producción no migra, salvo que el entorno donde corre lo autorice de forma explícita; por
omisión, no migra: falla.*

| `VERCEL_ENV` | `ALLOW_MIGRATE` | Decisión |
|---|---|---|
| `production` | cualquier valor, o ausente | **autoriza** |
| `preview` / `development` / cualquier otro | `1` | **autoriza** |
| `preview` / `development` / cualquier otro | ausente, vacío, `0`, `true`, `yes`, otra cosa | **rechaza** |
| **ausente** | `1` | **autoriza** |
| **ausente** | cualquier otra cosa | **rechaza** |

El valor se compara **tras recortar espacios** contra la cadena literal `1`: `true`, `yes` y `0`
**no** autorizan, y el mensaje de rechazo lo dice.

Códigos de salida — son el contrato, porque cualquier valor distinto de 0 corta el `&&` del
`buildCommand`, y ese corte **es** el mecanismo:

| Código | Significa | Qué hacer |
|---|---|---|
| **0** | Autoriza. Imprime el `VERCEL_ENV` que vio, por qué autorizó, y el **host y el nombre de base** de `DATABASE_URL` (nunca usuario, contraseña ni parámetros) | Nada: el build sigue |
| **1** | Rechaza: ese entorno no tiene permiso. **La base no se ha tocado** | Si el build debía migrar, dar permiso a ese entorno (abajo). Si no, es que ha funcionado |
| **2** | Uso incorrecto (se le pasó un argumento que no conoce) | Invocarla sin argumentos, o con `--help` |

```bash
node scripts/guard-migrate.mjs --help    # imprime el contrato y sale con 0
```

**`ALLOW_MIGRATE`: qué es, dónde debe existir y qué pasa si falta.** Es el permiso explícito de
un entorno, y el único valor que autoriza es `ALLOW_MIGRATE=1`. Solo hace falta en los entornos
de Vercel que **no** sean Production —hoy, en la práctica, **Preview**—. **Ponerla es una acción
de ops que este runbook documenta pero que SPEC-032 no ejecuta** (`F-SPEC-032-2`):

```bash
vercel env add ALLOW_MIGRATE preview     # valor: 1
```

**Si falta**, ese entorno **no migra: su build falla en rojo**, y se queda la versión anterior.
Con el repositorio ya conectado, cada PR dispara un build de Preview, así que sin esa variable
**todas las previews fallan en la guardia**. Es el comportamiento correcto (ADR-018 D-3:
*fallan en rojo y en la PR, nunca en silencio contra producción*), pero conviene que sea una
decisión y no una sorpresa — por eso `ALLOW_MIGRATE` va **antes** de conectar el repositorio en
el orden de **§13**.

En tu máquina no hay `VERCEL_ENV`, así que la guardia rechazaría — por eso el camino manual de
**§1.1** (`DATABASE_URL="…" npm run db:migrate`) **no pasa por ella**.

### 11.2 El escáner de SQL destructivo — `db:scan`

```bash
npm run db:scan                              # el drizzle/ del repositorio
node scripts/scan-destructive-sql.mjs --help
```

Lee los `.sql` de `drizzle/` **en el orden del journal** —sin git, sin rama base, sin GitHub y
sin red— y marca lo que enumera ADR-018 D-5.2: `DROP`, `RENAME`, `TRUNCATE`, `DELETE FROM`,
`ALTER COLUMN … SET NOT NULL` y `ALTER COLUMN … TYPE` / `SET DATA TYPE`. **No** marca lo que
esté dentro de un comentario o de un literal, ni nada aditivo, ni `UPDATE` (el relleno es la
mitad sancionada de *expand/contract*, **RI-01**).

Corre en dos sitios a propósito: el step **`Migration scan`** de la CI (§9), que impide el
olvido, y `npm test`, que te lo dice **antes** de empujar. Una sola implementación, dos
invocadores.

| Código | Significa |
|---|---|
| **0** | Limpio, o todo lo marcado está desbloqueado por escrito |
| **1** | Hay SQL destructivo sin desbloquear, o un desbloqueo inválido o huérfano |
| **2** | Uso incorrecto, o `drizzle/` ilegible |

### 11.3 Cómo se desbloquea una migración destructiva

El desbloqueo es **explícito, escrito y versionado**: vive en `drizzle/destructive-waivers.json`,
aparece en el diff justo al lado del `.sql` que justifica, y sobrevive al cierre de la PR. Una
entrada por migración marcada, con **las cuatro claves**:

```json
{
  "0007_tearful_roughhouse": {
    "spec": "SPEC-024",
    "reason": "…por qué hace falta destruir esto…",
    "rollback": "…cómo se vuelve atrás si sale mal…",
    "statements": 2
  }
}
```

- `spec` · `reason` · `rollback` — los tres son obligatorios y **no pueden estar vacíos**: un
  desbloqueo sin justificación no es un desbloqueo, es una casilla marcada.
- `statements` — cuántas sentencias destructivas autoriza. Ata el permiso a lo que permite: si
  alguien edita una migración ya desbloqueada para colarle una sentencia más, el conteo deja de
  cuadrar y el gate se pone en rojo.
- Un desbloqueo **huérfano** (nombra un fichero que no existe, o que ya no marca nada) también
  falla: un permiso que sobrevive a lo que permitía enseña a no leer el fichero.

No hace falta escribirlo a mano desde cero: cuando el escáner falla, imprime el fichero, la
línea, la sentencia y **el fragmento JSON exacto que hay que pegar**, entre las marcas `8<` y
`>8`, con los campos vacíos por rellenar.

Hoy el repositorio trae sembradas las **dos** entradas históricas —`0001_symbol_market_identity`
(relaja una unicidad, SPEC-008) y `0007_tearful_roughhouse` (habilita borrados en cascada,
SPEC-024)— con su justificación real y su plan de vuelta atrás. Y conviene recordar por qué el
plan de vuelta atrás no es papeleo: **`vercel rollback` devuelve el código, no el esquema.**

> **La regla detrás del gate es RI-01** (`docs/fundacion/reglas.md`, fuente ADR-018 D-5.1):
> migraciones aditivas, *expand/contract*. El escáner es su vigilante, no su sustituto.

---

## 12. Despliegue automático desde `main` y la puerta post-deploy (SPEC-028)

Desde **SPEC-028** (ADR-018 D-1 y D-6) **mergear es desplegar**. Esta sección es el mapa
completo: qué dispara qué, quién lo comprueba, y qué hacer cuando se pone rojo.

### 12.1 El disparador

```
merge a main ──► Vercel construye ese commit
                   node scripts/guard-migrate.mjs   (§11: ¿tiene permiso para migrar?)
                   npm run db:migrate               (drizzle-kit migrate contra Neon)
                   npm run build                    (next build)
                 └─► despliegue de PRODUCCIÓN, alias https://stockeiro.tremen.dev
                       └─► puerta post-deploy: ¿llegó el sha? (§12.2)

PR abierta ────► Vercel construye la cabeza de la PR
                 └─► despliegue de PREVIEW, con su URL propia publicada como check en la PR
                       y su propia rama copy-on-write de Neon (§13.3)
```

Nadie ejecuta ningún comando: el origen del despliegue es la **integración Git**, y su artefacto
sale de un **commit**, no de un directorio. Los tres eslabones del build van encadenados con
`&&` en el `buildCommand` de `vercel.json`, así que **si uno falla no se despliega nada** y se
queda la versión anterior.

**Y una consecuencia que hay que leer antes de mergear, no después**: un cambio de época de
credencial cierra la sesión de **todos** los usuarios en el instante del merge (ADR-016). Antes,
ese instante lo elegía quien desplegaba; ahora lo fija quien mergea.

### 12.2 La puerta

| | |
|---|---|
| **Workflow** | `.github/workflows/deploy-gate.yml` |
| **Se dispara** | en cada `push` a `main` (es decir, en cada merge), y en nada más |
| **Nombre del check** | **`Deploy gate / Alive`**, en la lista de checks del commit en GitHub |
| **Qué hace** | `node scripts/check-alive.mjs --url https://stockeiro.tremen.dev --commit <sha> --timeout 900 --interval 10` |
| **Qué afirma en verde** | que `https://stockeiro.tremen.dev/api/version` responde el **sha mergeado**: ese código está vivo para el usuario |
| **Plazo** | **900 s (15 minutos)**, sondeando cada 10 s |

Interroga el **dominio propio** y no `stockeiro-lemon.vercel.app` a propósito: es el origen que
recorren las personas y el valor de `APP_BASE_URL`, así que de una vez comprueba el despliegue,
el alias de producción y el CNAME de Cloudflare. El coste es que un fallo de DNS pinta la puerta
de rojo aunque el despliegue esté perfecto — y ese es un **rojo correcto**: si el dominio no
responde, la app no está viva para nadie.

El plazo es generoso a sabiendas. ADR-018 midió builds de ~40 s, pero desde entonces el
`buildCommand` ejecuta además la guardia y las migraciones, y la propagación del alias necesita
aire. **Una puerta que se pone roja porque el build fue lento enseña a ignorarla, y una puerta
ignorada no es una puerta.** Si algún día 15 minutos sobran, bajarlo es cambiar un número.

**Y el plazo se usa de verdad — desde el 2026-08-19, y no antes.** Hasta ese día no se usaba
nunca: la puerta salía **roja en 1 segundo**. GitHub Actions arranca el job en el instante del
`push`, Vercel tarda del orden de 35 s en construir y publicar, y en esa ventana
`/api/version` sigue sirviendo el **despliegue anterior** — que si vino de la CLI responde
`commit: unknown` (§10 y §3.4). `check-alive` trataba ese `unknown` como veredicto **terminal**
y salía con **2** al primer sondeo, sin llegar a usar `--timeout` ni `--interval`. Le pasó al
**primer despliegue automático del proyecto**: el merge de la PR #35, sha `0d389c8`, que se
desplegó **bien** y sacó la puerta en rojo igual; relanzado a mano minutos después, verde.
Lo corrige **SPEC-033**: con `--commit`, `unknown` pasa a ser **transitorio** y el **2** solo
llega al agotar el plazo. El precio está asumido y dicho en voz alta: un merge cuyo build falle
deja el job corriendo los 15 minutos antes de ponerse rojo, en vez de 1 segundo. A cambio, el
rojo significa algo — y el script no se queda mudo: en cuanto ve el primer `unknown` escribe
una línea diciendo que sigue esperando y con qué `builtAt`.

### 12.3 Tabla de reacción: qué hacer con cada código

Son los cuatro códigos de salida de `check-alive` (§10), leídos **en este contexto**:

| Código | Qué significa aquí | Qué mirar |
|---|---|---|
| **0** | El sha mergeado está vivo en producción | Nada. Es la evidencia que **RI-02** pide para pasar la spec a `hecho` |
| **1** | No llegó en los 15 minutos | El build de Vercel: ¿falló, y en qué eslabón? La **guardia** (`ALLOW_MIGRATE`), la **migración** (`db:migrate` contra Neon) o el **build** (`next build`, `cdn.sheetjs.com`). El mensaje del script imprime además el **último sha visto**: dice qué hay vivo ahora |
| **2** | Se esperó el plazo **entero** y lo único vivo **no viene de la integración Git**: responde `unknown` | **Dos causas posibles, y el `builtAt` que imprime el script es lo que las separa.** (a) *El build nuevo no llegó* —falló o seguía en curso— y sigue vivo el despliegue **anterior**: `builtAt` **viejo**, de antes del merge → mira el build de Vercel, como en el código **1**. (b) *Alguien desplegó por **CLI*** (§3.4): sube sin `.git`, así que `/api/version` responde `unknown`; `builtAt` **reciente**, de dentro de la espera → es la firma de un despliegue fuera de proceso: averigua quién y por qué antes de volver a mergear. El desempate lo haces tú con el dato delante: no lo automatiza ningún `if`, porque exigiría comparar el reloj del runner con el de la máquina de build (SPEC-033 D-D) |
| **3** | El origen no responde el contrato | El **dominio** y el **DNS**: si el cuerpo no es el JSON de tres claves, lo que hay al otro lado no es esta app (alias mal apuntado, CNAME de Cloudflare, proxy) |

### 12.4 Lo que la puerta NO hace: no revierte nada

ADR-018 lo excluye sin rodeos —*"un check rojo en `main` no revierte nada por sí solo: avisa"*—,
y hay una razón de fondo: un falso rojo (un build lento, una propagación de DNS) dispararía un
rollback que nadie pidió.

La reversión sigue siendo **manual, y con criterio**:

```bash
vercel rollback            # vuelve al despliegue anterior
```

> ⚠️ **`vercel rollback` devuelve el código, no el esquema.** Si el despliegue roto traía una
> migración destructiva, revertir el código deja **código viejo contra un esquema mutilado**, que
> suele ser peor que el fallo original. Lo que hace tolerable el auto-deploy es **RI-01**
> (migraciones aditivas, *expand/contract*, `docs/fundacion/reglas.md`) y el escáner que la
> vigila (§11.2). La red **última** es el historial de **restauración** de Neon (*point-in-time
> restore*), **cuya ventana sigue sin comprobar** — pregunta 7 del gate de ADR-018, cinco minutos
> en la consola de Neon que nadie ha invertido todavía.

Tampoco hay **alerting**: el rojo se ve en GitHub y en ningún otro sitio (ADR-018 §Frontera).
Y no hay puerta para los despliegues de **Preview** (`F-SPEC-028-3`): exigiría la URL de Preview,
que solo se conoce con un token de Vercel — y un token es un secreto, justo lo que ADR-018 D-4.1
evita. La PR ya muestra el check propio de Vercel con su URL.

### 12.5 La CI IMPIDE mezclar: `main` está protegida — y lo que la protección NO cubre

✅ **Léelo entero antes de pulsar *Merge*.** Desde el **2026-08-19** el repositorio es **público**
y GitHub aplica **protección de rama** sobre `main`. Ya no es disciplina ni recomendación: es una
regla que **GitHub hace cumplir**. Abajo van sus piezas con nombre y valor exacto, a propósito:
para que puedas comprobarlas hoy, y para que este apartado quede **comprobablemente desfasado** el
día que alguien las cambie.

| Pieza | Valor exacto, a 2026-08-19 |
|---|---|
| Ruleset | **`Protected main`** (id `21014989`), `enforcement: active`, sobre la rama por defecto |
| Reglas | `pull_request` · `required_status_checks` · `deletion` · `non_fast_forward` |
| Checks requeridos | **`Checks`** y **`E2E`** — en la lista de la PR: `CI / Checks` y `CI / E2E` |
| Excepciones | **ninguna**: `bypass_actors: []` |

Se comprueba sin salir de la terminal:

```bash
gh api repos/tremen-dev/stockeiro/rulesets/21014989 \
  --jq '{name, enforcement, bypass: .bypass_actors, rules: [.rules[].type]}'
```

**1. Todo cambio entra por PR.** `main` **no acepta push directo**. Y están bloqueados además el
**borrado** de la rama (`deletion`) y el ***force-push*** (`non_fast_forward`): el historial desde
el que se despliega producción no se reescribe.

**2. `Checks` y `E2E` tienen que estar en verde para poder mezclar.** Son los dos contextos que el
ruleset exige, con esos nombres exactos; en la lista de checks de la PR aparecen como
`CI / Checks` y `CI / E2E` (§9). Con cualquiera de los dos **en rojo**, GitHub no deja mezclar.
Traducido a lo que importa aquí: un `Typecheck`, `Lint`, `Unit tests`, `Migration scan` o e2e en
rojo **ya no puede llegar a producción por la vía normal**, que es justo la premisa sobre la que
ADR-018 aceptó retirar el gate humano previo a producción.

**3. Y nadie puede saltárselo: la lista de *bypass* está vacía.** Eso **es parte de la protección,
no un detalle de configuración**: sin excepciones, la regla frena también al dueño del
repositorio. **El día que alguien se añada a esa lista, la red vuelve a ser un recordatorio** — y
este apartado, mentira. Si al ejecutar el comando de arriba `bypass_actors` ya no sale vacío, o el
ruleset no está en `active`, deja de fiarte de esta sección y arréglala antes de seguir.

**4. Lo que la protección NO cubre**, dicho en el mismo sitio para que nadie se apoye de más:

- **No exige revisión de nadie** (`required_approving_review_count: 0`). Exige PR y checks
  verdes, **no un segundo par de ojos**: puedes abrir tu PR y mezclarla tú solo.
- **No exige que la rama esté al día con `main`** antes de mezclar (la política *strict* está
  desactivada). Los checks pueden haber corrido contra una base **más vieja** que la que acaba
  desplegándose; si tu rama lleva días abierta, actualízala a mano antes de pulsar *Merge*.
- **`Alive` no es un check requerido, y no debe serlo.** La puerta post-deploy (§12.2) corre en
  `push` a `main`, o sea **después** del merge: en una PR no llega a existir, y exigirla ahí
  bloquearía **todas** las PR para siempre, esperando un check que nunca va a aparecer. La puerta
  no es un permiso para mezclar; es la confirmación de que lo mezclado **llegó**.

**Qué sigue enteramente en tus manos**: el **cuándo**. Mezclar es desplegar (§12.1), y hay cambios
cuyo momento importa — un cambio de época de credencial cierra la sesión de **todos** los usuarios
en el instante del merge (ADR-016).

*De dónde viene este apartado, porque hasta ayer decía lo contrario*: hasta el **2026-08-18** la
CI informaba y no frenaba nada —repo privado + organización en plan free → `403 Upgrade to GitHub
Pro`—, y el humano **aceptó ese riesgo** en el gate, en contra de la recomendación del arquitecto.
El **2026-08-19** el repositorio pasó a público por una razón ajena a ese debate (Vercel no
permite desplegar en plan **Hobby** desde un repositorio **privado de una organización**) y la
protección llegó como **efecto colateral**: el riesgo no se corrigió, **se evaporó**. Con ello
quedan **cerrados `F-SPEC-027-1` y `F-SPEC-028-1`**. Lo que queda es la fragilidad del punto 3: la
protección vive en un ajuste de GitHub que nadie versiona ni audita — el mismo tipo de dependencia
frágil que el *preview branching* de Neon (§13.3).

---

## 13. La configuración que no vive en el repositorio (acciones de ops)

Nada de esta sección se puede ejecutar desde un test ni desde el repositorio: son **acciones de
ops**, y su evidencia se pega en el ledger de la spec que las necesita. Se documentan aquí porque
un pipeline cuya mitad vive en un panel que nadie versiona es un pipeline que se rompe sin avisar.

**El orden es una precondición firmada en el gate del 2026-08-18, no una sugerencia:**

| # | Acción | Cómo | Por qué en esa posición |
|---|---|---|---|
| 1 | **Drenar el atraso a mano** | `git fetch origin` · `git switch --detach origin/main` · `git status --short` vacío · `vercel --prod --archive=tgz` (§3.4 y §8 paso 4) | Pone producción al día por la vía ya probada. Si el primer despliegue automático falla, así se sabe si falló el pipeline o el atraso, y no las dos cosas a la vez |
| 2 | **Verificar que el atraso llegó** | `curl -s https://stockeiro.tremen.dev/api/version` · `node scripts/check-alive.mjs --url https://stockeiro.tremen.dev` | Puerta de salida del paso 1. Saldrá con **2** (`commit: unknown`) y **eso es correcto**: la CLI sube sin `.git`. Lo que se comprueba es que el endpoint **existe** y que la migración pendiente se aplicó |
| 3 | **`ALLOW_MIGRATE=1` en Preview** | `vercel env add ALLOW_MIGRATE preview` (valor `1`) | **Antes de conectar**, porque la guardia es *fail-closed* por diseño |
| 4 | **Conectar el repositorio** | panel de Vercel → *Settings → Git* | Es ADR-018 D-1. A partir de aquí, mergear despliega |
| 5 | **Ver qué se disparó al conectar** | `vercel ls --prod` justo después | Si la conexión lanza un despliegue por su cuenta, conviene verlo y no descubrirlo |
| 6 | **Anotar el techo de ramas de Neon** | consola de Neon | Es el recurso que se agota primero (§13.3) |
| 7 | **`NEON_PROJECT_ID` como *variable* del repositorio** (`F-SPEC-042-1`) | GitHub → *Settings → Secrets and variables → Actions → **Variables** → New repository variable*. El valor está en Neon, *Project settings* | **Variable y no secreto**: no es sensible, y verla en el log es lo que permite diagnosticar un rojo del limpiador. Si falta, `vars.NEON_PROJECT_ID` llega **vacía** y el workflow da rojo — *fail-closed*, igual que `ALLOW_MIGRATE` |
| 8 | **`NEON_API_KEY` como *secreto* del repositorio** (`F-SPEC-042-2`) | La clave se crea en Neon → *Account Settings → API Keys*; se pega en GitHub → *Settings → Secrets and variables → Actions → **Secrets*** | Es el **único secreto del repositorio** y el repositorio es **público**. Al crearla, **comprobar si puede acotarse a este proyecto** y anotar en el ledger qué alcance tiene realmente: una clave de cuenta filtrada puede borrar ramas de cualquier proyecto |
| 9 | **Casilla *Automatically delete head branches*** (`F-SPEC-042-3`) | GitHub → *Settings → General* | Va **después** y **separada** a propósito: **no toca Neon**. Borra ramas de git muertas —había **27** mergeadas vivas el 2026-08-19/20, podadas a mano— y nada más. Leerla como la solución del techo de ramas es volver a encontrárselo |

### 13.1 La conexión Git

- **Repositorio**: `tremen-dev/stockeiro`. **Proyecto**: el de Vercel al que apunta `vercel link`.
- **Rama de producción: `main`.** Cualquier otra rama produce Preview, nunca producción.
- **Integración Git nativa**, no un token ni un workflow que llame a la CLI: es lo que hace que
  el despliegue lleve `meta.githubCommitSha` y que `/api/version` deje de responder `unknown`.

Cómo se comprueba que está conectado, sin fiarse del recuerdo:

```bash
vercel project inspect            # muestra el repositorio conectado y la rama de produccion
vercel ls --prod                  # el despliegue mas reciente es posterior al ultimo merge
vercel inspect <url-del-deploy>   # meta.githubCommitSha = sha del merge; Creator = la integracion
```

En el panel, el despliegue muestra **Source** con la rama y el commit. Si *Source* aparece vacío,
ese despliegue se hizo por CLI y no por la integración (§3.4).

### 13.2 `ALLOW_MIGRATE=1` en el entorno Preview

```bash
vercel env add ALLOW_MIGRATE preview     # valor: 1
```

Es el permiso explícito que la guardia `guard-migrate` exige a todo entorno que no sea Production
(§11.1). **Si falta, todas las previews fallan en la guardia**, en rojo y a propósito: es
*fail-closed* por diseño (ADR-018 D-3). Ponerla es ops; el residual está declarado como
**F-SPEC-032-2**, y su efecto —que una Preview construya verde— es la única prueba imposible de
falsear de que la variable existe.

### 13.3 El *preview branching* de Neon, sus dos techos y quién los barre

La integración nativa de Neon tiene activado el ***preview branching*** (`Create Database Branch
For Deployment` = **Preview sí, Production no**, prefijo de variables `DATABASE`): cada
despliegue de Preview recibe la `DATABASE_URL` de **su propia rama copy-on-write**, no la de
producción. Eso cerró F-SPEC-023-1 el 2026-08-18 (§8).

Sus dos techos, declarados como **F-SPEC-028-2**:

1. **10 ramas** en el plan **Free** de Neon. La número 11 no despliega:
   `Require Active Resource Before Deploy`. **Este techo sigue exactamente donde estaba**: nada
   de lo de abajo lo sube, y no se compra plan.
2. Las ramas de preview **sobreviven al cierre de la PR**, porque cuelgan de la **retención de
   despliegues de Vercel** —6 meses por defecto— y no de la PR (§6). Es decir: se acumulan solas.
   **Este techo ya tiene dueño, y no es una persona.**

#### El incidente del 2026-08-19/20, con su mensaje literal

> 🚨 El techo 2 se cumplió **un día** después de que este runbook lo escribiera, y tumbó un
> despliegue de **producción**. El mensaje, literal, para que sea reconocible si vuelve:
>
> ```
> Branch limit reached. Upgrade your plan or delete unused branches.
> ```
>
> El panel tenía las **10** ramas: `main`, una `preview` creada a mano y **ocho `preview/ft/*`
> de specs ya mergeadas**. Hubo que borrar tres a mano para desbloquear el despliegue.
>
> **Por qué la defensa anterior no era una defensa**: era un párrafo pidiéndole a una persona que
> revisara la consola periódicamente — la misma forma exacta del defecto que fundó ADR-018
> (*"se olvidó 27 días"*) y SPEC-027 (*"la suite depende de que alguien se acuerde"*).
> **Duró un día.**

#### Qué lo barre ahora: `neon-preview-cleanup.yml` (SPEC-042)

`.github/workflows/neon-preview-cleanup.yml` borra la rama de Neon **al cerrar la PR**, mergeada
o no —una PR cerrada sin mezclar deja exactamente la misma rama huérfana, porque la creó el
despliegue de Preview y no el merge—. Es la vía que recomienda Neon
(<https://neon.com/docs/guides/vercel-branch-cleanup>), y consume
`neondatabase/delete-branch-action@v3` con tres entradas.

- **Qué borra, y solo eso**: `preview/${{ github.head_ref }}`. El prefijo `preview/` va
  **literal** en el YAML, delante de la interpolación, y el fichero **no nombra ninguna rama
  fija**. Eso acota **qué se pide borrar**; lo que **no** acota es el alcance de la credencial:
  una clave de Neon, incluso acotada al proyecto, **puede borrar cualquier rama**.
- **Cuidado con el argumento "no tiene ni un `run:`"**, que este runbook llegó a dar por bueno
  el 2026-08-20 y **es falso a medias**. Es cierto que el workflow no ejecuta ni una línea de
  shell **nuestra** —eso es **CA-4.3**, sigue exigido y sigue valiendo—, y quita un sitio donde el
  secreto pudiera acabar impreso en un log **nuestro**. Pero
  `neondatabase/delete-branch-action` es una ***composite action***: su paso final es un
  `shell: bash` que interpola el nombre de rama **textualmente** —dos veces, y con la clave de
  la API en el entorno de ese paso—, así que `github.head_ref` **sí llega a un intérprete de
  comandos**. Dentro de comillas dobles bash expande `$(…)` y las backticks sin necesidad de
  romper la comilla, y git **acepta** esos caracteres en un nombre de rama. Sin filtro, el peor
  caso alcanzable no era *"borré una preview que no tocaba"* sino **ejecución de comandos con la
  única clave con permiso de borrado del proyecto**.
- **Lo que sí acota el peor caso**: el **filtro de caracteres** que el job aplica al nombre de
  rama antes de dárselo a la acción. **Eso es `CA-4.5`**, y el reparto conviene no confundirlo:
  **CA-4.3** exige que **no haya shell nuestra**; **CA-4.5** exige que **lo que le damos a la shell
  ajena vaya saneado**. Ninguno cubre al otro — CA-4.3 no puede impedir la inyección, porque la
  shell que importa no es nuestra. Son tres —`$`, la backtick y la comilla doble—, que son los
  únicos a los que bash reacciona dentro de comillas dobles y que git deja pasar en una ref (la
  barra invertida, el cuarto, git ya la rechaza). Con el filtro puesto, el peor caso vuelve a ser
  *"borré una preview que no tocaba"*. La derivación no se cree: `tests/neon-preview-cleanup-workflow.test.ts`
  4.5 se la vuelve a preguntar a git en cada ejecución de la suite.
- **Y lo que el filtro cuesta**, porque es un hueco nuevo y no una victoria limpia: una PR cuya
  rama contenga uno de esos tres caracteres **no se limpia**, y su rama de Neon **queda
  huérfana** hasta que alguien la borre a mano (`F-SPEC-042-7`). Es el **coste declarado de
  `CA-4.5`**, no el residuo de un apaño suelto: quien lo "limpie" quitando el filtro no está
  simplificando, está **rompiendo un criterio de aceptación**. Es *fail-closed* **y en
  silencio** —de los dos *fail-closed* de este apartado es el que **no avisa**; el otro, dos
  viñetas más abajo, pinta rojo—: no barrer una rama cuesta uno de los diez huecos del techo;
  ejecutar código con esa clave cuesta el proyecto. En este repositorio los nombres de rama los
  generan **agentes** a partir de títulos de spec, así que un `$` puede llegar ahí **sin ninguna
  malicia**.
- **Cómo se diagnostica ese silencio**, porque no es el silencio que uno se imagina: el
  disparador `pull_request: [closed]` **no filtra por rama ni por ruta**, así que el evento **sí
  crea la ejecución** —el `if` se evalúa después, **a nivel de job**—. En Actions **aparece** una
  ejecución completada, en **gris**, con conclusión `skipped` y el job **sin un solo paso**. No
  pinta rojo, no bloquea nada y de un vistazo se pasa por buena; `skipped` es un estado listable
  de la API de ejecuciones de GitHub (`/actions/runs?status=skipped`), no una ausencia. Así que
  **la señal no es que falte la ejecución, sino que la ejecución no hizo nada**: si una PR cerrada
  dejó una ejecución sin trabajo hecho, el primer sitio donde mirar es el nombre de su rama.
- **Qué necesita**: las acciones de ops **7** y **8** de la tabla de arriba. Si faltan, el
  workflow da **rojo** en el primer cierre de PR: es *fail-closed* **y en rojo**, igual que
  `ALLOW_MIGRATE`. Es el contrario del hueco del filtro: **este sí avisa**, aquel no.
- **Qué no hace**: no corre para PRs de un **fork** (`F-SPEC-042-5`) —darles servicio exigiría el
  disparador que entrega secretos a código de terceros, y este repositorio es público—, no vigila
  cuántas ramas quedan, y no barre lo ya acumulado: actúa sobre PRs que se cierren **a partir de
  ahora**.
- **No es un check requerido, y no debe serlo** (§9): corre después del merge.

#### Lo que esto cuesta, escrito y no enterrado

**Las URLs de preview antiguas dejan de conectar.** Es la contrapartida que Neon declara y no hay
forma de tener las dos cosas —o la rama vive y ocupa techo, o muere y su preview se rompe—:
*"Deleting a Neon branch invalidates any Vercel preview deployments that depend on it. Those
deployments will fail on database connections."* Con el flujo *mergear y seguir* de este proyecto
no molesta; el día que se comparta una URL de preview con un tester, **sí molestará**, y el sitio
de enterarse es este párrafo y no ese día.

#### Qué hace ante una rama que ya no existe: **ROJO**, medido el 2026-08-20

Era la única pregunta que este apartado dejaba abierta —el README de la acción **no lo documenta**,
ni para decir que falla ni para decir que no—, y **ya está respondida** (SPEC-042 CA-9). Se midió
**re-ejecutando en Actions** la ejecución **`32371568962`**, la que había borrado la rama de esa
misma spec, **sobre la rama ya borrada**: `conclusion=failure`, **salida 1**. Y el reparto de la
culpa está en el propio log: el paso de **instalación** (`npm i -g neonctl@v2`) salió **verde** y
solo el de borrado en rojo, así que **falla la acción, no el entorno**. Literal:

```
ERROR: Branch preview/ft/SPEC-042-limpieza-automatica-de-ramas-de-preview-en-neon not found.
Available branches: preview, main, preview/ft/SPEC-039-ayuda-estados-vacios-y-feedback,
preview/ft/SPEC-040-movil-completa-el-alta-y-guardia-que-lo-ve,
preview/ft/SPEC-041-vigiladas-legible-y-ordenable
##[error]Process completed with exit code 1.
```

**Cómo volver a medirlo el día que la acción cambie de versión —y por este orden**, porque el
camino corto ya se pasó por alto una vez: un ***Re-run* en Actions** de cualquier ejecución del
limpiador que ya exista. No exige instalar nada, ni credenciales locales, ni cerrar ninguna PR:

```bash
gh run rerun 32371568962         # o el boton "Re-run jobs" en la pagina de la ejecucion
gh run view 32371568962 --log    # la primera linea del paso de borrado ES el veredicto
```

`neonctl branches delete <rama> --project-id <id>` responde lo mismo, pero exige instalar la CLI y
tener la clave a mano: es la **vía de reserva**, no la primera.

#### La consecuencia, con nombre: `F-SPEC-042-8` — rojo cuando no hay nada que borrar

**La acción no es idempotente.** De ahí se sigue, sin más misterio, que el limpiador **da rojo en
toda PR que se cierre sin una rama de preview que borrar.**

**Cuándo pasa de verdad** — tres disparadores, y los tres manuales o excepcionales:

1. un ***re-run*** a mano, como el de arriba;
2. **reabrir** una PR y volver a **cerrarla**: la rama ya se borró en el primer cierre;
3. una PR cuya preview **se borró a mano** para desbloquear el techo — lo que pasó el
   2026-08-19/20 con tres ramas, y el caso que más importa porque llega en el peor momento.

**Con qué frecuencia, con el dato y no con un adjetivo**: en el flujo normal *(abrir, CI, mergear,
cerrar)* **siempre hay algo que borrar**. **0 de 43** PRs de este repositorio se han cerrado sin
mergear, y `vercel.json` **no lleva `ignoreCommand` ni `ignoredBuildStep`**, así que **toda rama
con PR recibe preview** y con ella su rama de Neon. **El único rojo observado hasta hoy lo provocó
el propio *re-run*** con el que se respondió la pregunta de arriba. Y ojo con el contrario: las PRs
de **fork** y las ramas con `$`, backtick o `"` **no dan rojo** — se **saltan** en silencio
(`F-SPEC-042-7`), que es el otro problema y no este.

> 📖 **Regla de lectura de un rojo del limpiador: abre el log antes de encogerte de hombros.**
>
> Un rojo de este workflow puede significar dos cosas opuestas, y **se ven idénticos** en Actions:
> mismo check en rojo, mismo step, misma salida 1. Lo único que las separa es **la primera línea
> del error**.
>
> - Dice **`Branch <nombre> not found.`** → **benigno**. No había rama que borrar. Se cierra ahí y
>   no hay nada que hacer.
> - Dice **cualquier otra cosa** —clave caducada o revocada, `project_id` equivocado, Neon caído,
>   borrado fallido con la rama **todavía viva**— → **grave**: las ramas se están acumulando otra
>   vez **en silencio**. Eso es **el incidente del 2026-08-19/20 volviendo a empezar**, y se
>   confirma en un minuto contando ramas en la consola de Neon.
>
> Lo que hay que vigilar **no es el recuento de rojos**, es no clasificarlos de un vistazo.

**Y no, no se pone `continue-on-error`** — ni en el workflow ni en ningún sitio (SPEC-042 **CA-5.5**,
congelado en `tests/neon-preview-cleanup-workflow.test.ts` · 5.5). Queda escrito con fecha para que
nadie lo reabra creyendo que nadie lo pensó: **se propuso el 2026-08-20 y se aprobó en el gate — y
el humano revocó la decisión el mismo día**, al ver la frecuencia real. **El argumento que la revocó
no es la frecuencia, es la ambigüedad**: `continue-on-error` no taparía solo el rojo benigno,
taparía **los dos**, porque desde fuera son indistinguibles. Y el que importa es el grave,
precisamente porque su síntoma —ramas acumulándose— **no vuelve a dar señal hasta que un despliegue
de producción falla con `Branch limit reached`**, que es el fallo que fundó todo este apartado.
Cambiar un rojo raro y legible por un verde que miente es un mal negocio a cualquier frecuencia.

**La salida limpia está fuera de este runbook**: abrir un *issue* en
`neondatabase/delete-branch-action` pidiendo idempotencia —una entrada tipo `if-exists`, o salir
**0** ante *not found*—. Cuesta cero, no toca ningún CA y es el **sitio correcto** del arreglo,
porque el defecto es de la acción. → `F-SPEC-042-8`.

⚠️ **Un detalle de higiene, para saberlo antes de que importe**: ese mensaje de error **enumera los
nombres de todas las ramas del proyecto**, y los logs de Actions de este repositorio son
**públicos**. Hoy da igual —son nombres de spec, ya públicos en `docs/`—, pero el día que un nombre
de rama diga algo que no deba, lo dirá ahí.

#### Y lo que NO arregla, para que nadie lo confunda

La casilla de GitHub *Automatically delete head branches* (acción de ops **9**) **no toca Neon**.
Borra ramas de git muertas —había **27** mergeadas vivas el 2026-08-19/20, podadas a mano— y nada
más. Quien crea que con esa casilla el problema del techo de Neon está resuelto, se lo volverá a
encontrar.

Y el **techo de 10 ramas** sigue siendo 10: SPEC-042 quita la **acumulación**, no el **techo**.
Con varias PRs abiertas a la vez —que es lo que ya pasa en este proyecto— diez no es mucho. La
**mitad 1** de `F-SPEC-028-2` **sigue abierta a propósito**; su mitad 2 la cierra SPEC-042. Si
algún día el techo vuelve a agotarse con el limpiador vivo, la conversación es de plan, no de
mantenimiento. Refuerzo opcional que **mitiga pero no resuelve** (asíncrono, y Vercel protege
siempre los ~10 despliegues más recientes): bajar la *Deployment Retention Policy* de Vercel para
*Pre-Production Deployments* → `F-SPEC-042-4`. Y la rama `preview` suelta del panel, creada a
mano, ni la creó Vercel ni la borra este workflow: ocupa techo y decidir si sobra es ops →
`F-SPEC-042-6`.

### 13.4 Por qué ese orden

Dos razones distintas, cada una con su paso:

- **#1 y #2 van primero** para no acoplar dos riesgos independientes en un solo día. Es el
  consejo del propio ADR-018 aplicado a cinco specs mudas en vez de a una: si el primer
  despliegue automático falla, hay que poder saber si falló el pipeline o el atraso.
- **`ALLOW_MIGRATE` va antes de conectar** (#3 antes que #4) porque la guardia es *fail-closed*:
  conectar el repositorio sin esa variable deja **todas** las previews en rojo desde el primer
  minuto. Es el comportamiento correcto, pero conviene que sea una decisión y no una sorpresa.
