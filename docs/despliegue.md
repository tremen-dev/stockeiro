# Guía de despliegue — Stockeiro

> Runbook para poner Stockeiro en producción en **Vercel**, con **Neon** (Postgres),
> **Twelve Data** (cotizaciones) y **Resend** (email). Pensada para repetirse: sigue los
> pasos en orden. Los `follow-ups` de despliegue de las specs (F-SPEC-001-2, F-SPEC-004-1,
> F-SPEC-006-1) se cierran aquí.

## 0. Qué vamos a aprovisionar

| Variable | Servicio | Para qué | Spec |
|---|---|---|---|
| `DATABASE_URL` | Neon | Postgres de producción | ADR-001 / F-SPEC-001-2 |
| `DB_DRIVER` | — | `neon` en producción (por defecto) | ADR-001 |
| `AUTH_SECRET` | — | Firma de sesión (Auth.js) | SPEC-001 / F-SPEC-001-2 |
| `AUTH_TRUST_HOST` | — | `true` tras el proxy de Vercel | SPEC-001 |
| `TWELVE_DATA_API_KEY` | Twelve Data | Ingesta de cotizaciones | ADR-002 / F-SPEC-004-1 |
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

La app **no** corre migraciones al desplegar; se aplican una vez con Drizzle
(migración versionada en `drizzle/`):

```bash
# con la connection string real de Neon:
DATABASE_URL="postgresql://…?sslmode=require" npm run db:migrate
```

- `npm run db:generate` regenera la migración desde `src/db/schema.ts` si cambia el esquema.
- Alternativa rápida sin ficheros de migración: `DATABASE_URL=… npx drizzle-kit push`.
- Repite este paso tras cada cambio de esquema (nueva spec con tabla/columna).

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
- [ ] Esquema aplicado (`npm run db:migrate` contra Neon).
- [ ] `AUTH_SECRET`, `AUTH_TRUST_HOST` puestos.
- [ ] Twelve Data: `TWELVE_DATA_API_KEY`; `CRON_SECRET` generado y puesto.
- [ ] Resend: dominio verificado, `RESEND_API_KEY`, `RESEND_FROM`.
- [ ] `vercel --prod` verde.
- [ ] Smoke test (registro + cron manual + email) OK.

---

## 6. Notas y gotchas

- **Rotación de secretos**: si regeneras `CRON_SECRET`/`AUTH_SECRET`, actualiza la env en Vercel
  y **redeploy** (las envs se leen en build/arranque).
- **Migraciones**: el deploy NO migra solo. Tras una spec que cambie el esquema, ejecuta el paso
  1.1 contra Neon **antes** o justo después del deploy, o la app dará error de tabla/columna.
- **Regiones**: alinea la región de Neon con la de las Functions para latencia baja.
- **Preview deployments**: si quieres que las PR previews funcionen, replica las envs en el
  entorno *Preview* (o usa una BD Neon aparte para preview).
