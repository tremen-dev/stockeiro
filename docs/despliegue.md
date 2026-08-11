# Guía de despliegue — Stockeiro

> Runbook para poner Stockeiro en producción en **Vercel**, con **Neon** (Postgres),
> **Marketstack** (cotizaciones), **Twelve Data** (búsqueda de símbolos) y **Resend**
> (email). Pensada para repetirse: sigue los pasos en orden. Los `follow-ups` de despliegue
> de las specs (F-SPEC-001-2, F-SPEC-004-1, F-SPEC-006-1, F-SPEC-011-1, F-SPEC-012-1,
> F-ADR-012-2) se cierran aquí.

> **Estado (2026-08-11):** desplegado en <https://stockeiro-lemon.vercel.app> con **Neon +
> Marketstack + cron** activos. El esquema se migra **automáticamente en el build** (§1.1).
> Pendientes:
> - **Email (Resend)** — F-SPEC-006-1: la app funciona con avisos **in-app** (RN-15); ver **§7**.
> - **F-SPEC-011-1**: el build debe alcanzar `cdn.sheetjs.com` (dependencia `xlsx`); ver **§6**.
> - **F-SPEC-020-1**: dialecto de `XSTO` (Estocolmo) sin resolver; sus valores no cotizan y lo dicen.

> ⚠️ **LECCIÓN DEL 2026-08-11 — mergear no es desplegar.** EPIC-FIX (SPEC-015/016) estuvo
> **27 días en `main` sin llegar a producción**: el despliegue vivo era del 20-jul y se hizo
> por CLI desde un árbol de trabajo que no incluía esos cambios. Durante ese mes el defecto
> que la épica arreglaba seguía intacto **y además mudo**, porque el diagnóstico que lo
> habría delatado tampoco estaba desplegado. Ningún paso del ciclo tremen-sdd lo detectó: el
> verificador cierra specs con tests y flujo **local**, no comprueba producción.
> **Antes de dar una spec por entregada, comprueba que su código está VIVO.** La forma
> barata: `vercel ls --prod` para la fecha del despliegue y `curl` del CSS/HTML público
> buscando una clase o cadena que solo exista tras ese cambio. Los despliegues por CLI no
> dejan metadatos de git, así que la fecha es la única pista — y miente si el árbol era viejo.

## 0. Qué vamos a aprovisionar

| Variable | Servicio | Para qué | Spec |
|---|---|---|---|
| `DATABASE_URL` | Neon | Postgres de producción | ADR-001 / F-SPEC-001-2 |
| `DB_DRIVER` | — | `neon` en producción (por defecto) | ADR-001 |
| `AUTH_SECRET` | — | Firma de sesión (Auth.js) | SPEC-001 / F-SPEC-001-2 |
| `AUTH_TRUST_HOST` | — | `true` tras el proxy de Vercel | SPEC-001 |
| `MARKETSTACK_API_KEY` | Marketstack | **Cotizaciones** (proveedor de precios) | ADR-012 / F-ADR-012-2 |
| `TWELVE_DATA_API_KEY` | Twelve Data | **Búsqueda** de símbolos (ya no cotiza) | ADR-007 / ADR-012 |
| `CRON_SECRET` | — | Protege `/api/cron/refresh` | ADR-004 / F-SPEC-004-1 |
| `RESEND_API_KEY` | Resend | Envío de avisos por email | ADR-006 / F-SPEC-006-1 |
| `RESEND_FROM` | Resend | Remitente (dominio verificado) | ADR-006 |

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

**El deploy migra solo.** `vercel.json` define:

```json
"buildCommand": "npm run db:migrate && npm run build"
```

Es decir, **cada** deploy (incluido `vercel --prod`) ejecuta `drizzle-kit migrate` con el
`DATABASE_URL` de ese entorno **antes** de construir, aplicando las migraciones versionadas
de `drizzle/`. Es **idempotente** (Drizzle lleva registro de lo ya aplicado) y si la
migración falla, el `&&` corta: **el build falla y no se despliega** — se queda la versión
anterior. **No hay paso manual** tras una spec que cambie el esquema: basta desplegar.

Solo necesitas migrar a mano si quieres tocar la BD **fuera** de un deploy (p. ej. preparar
Neon antes del primer despliegue, o depurar):

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
2. **Domains → Add Domain** con tu dominio (p. ej. `stockeiro.app`). Resend te da registros
   **DNS** (SPF/`MX` de retorno y **DKIM**); añádelos en tu registrador/gestor DNS y espera a
   que Resend marque el dominio **Verified** (minutos–horas).
3. **API Keys → Create** → copia la key (será `RESEND_API_KEY`).
4. Fija `RESEND_FROM` a una dirección de ese dominio, p. ej. `Stockeiro <avisos@stockeiro.app>`.

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
vercel env add TWELVE_DATA_API_KEY production   # key de Twelve Data
vercel env add CRON_SECRET production           # el generado
vercel env add RESEND_API_KEY production        # key de Resend
vercel env add RESEND_FROM production           # Stockeiro <avisos@tu-dominio>
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

```bash
vercel            # deploy de preview (URL temporal para probar)
vercel --prod     # deploy a producción
```

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
- [ ] Twelve Data: `TWELVE_DATA_API_KEY`; `CRON_SECRET` generado y puesto.
- [ ] Resend: dominio verificado, `RESEND_API_KEY`, `RESEND_FROM` — **pendiente por diseño**, se
  añade cuando se quiera el email (ver **§7**); la app funciona con avisos in-app mientras tanto.
- [ ] `vercel --prod` verde (build alcanza `cdn.sheetjs.com`, §6).
- [ ] Smoke test (registro + cron manual + email) OK.
- [ ] Import (EPIC-002): subir un extracto en `/cartera/importar` y comprobar la resolución
  contra Twelve Data **real** — cierra **F-SPEC-012-1** (la tabla `MARKET_MAP` etiqueta→MIC de
  `src/lib/import/market-map.ts` es **provisional**: se diseñó por familia de MIC para tolerar
  sub-MICs, pero solo está verificada con el proveedor *fake*).

---

## 6. Notas y gotchas

- **Rotación de secretos**: si regeneras `CRON_SECRET`/`AUTH_SECRET`, actualiza la env en Vercel
  y **redeploy** (las envs se leen en build/arranque).
- **Migraciones**: el deploy **SÍ migra solo** — `vercel.json` corre `npm run db:migrate`
  dentro del `buildCommand` (ver **§1.1**). Tras una spec que cambie el esquema no hay paso
  manual: basta desplegar. Si la migración falla, el build falla y no se despliega.
- **Preview deployments** ⚠️: el `buildCommand` corre en **todos** los entornos, así que un
  deploy de *Preview* **también migra** la BD a la que apunte su `DATABASE_URL`. Si el entorno
  *Preview* comparte la Neon de producción, **una PR migraría producción**. Usa una **BD Neon
  aparte para Preview** (no es una recomendación estética: con `db:migrate` en el build es lo
  que separa producción de las PRs).
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
   printf '%s' "re_XXXX_tu_api_key"                 | vercel env add RESEND_API_KEY production
   printf '%s' "Stockeiro <avisos@tu-dominio.com>"  | vercel env add RESEND_FROM production
   ```

   Confirma con `vercel env ls production`.
3. **Redeploy** para que el runtime lea las nuevas variables (las envs se aplican en build/arranque):

   ```bash
   vercel --prod
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
