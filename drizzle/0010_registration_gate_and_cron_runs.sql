-- SPEC-037 / ADR-023 — El grifo del registro y el registro de ejecuciones del ciclo.
--
-- DOS `CREATE TABLE` y UN `INSERT`. Todo ADITIVO (RI-01): ni borra, ni renombra, ni
-- estrecha nada, y el código anterior a esta spec sigue funcionando contra el
-- esquema resultante porque todavía nadie lee estas tablas.
--
-- Las dos son estado OPERATIVO, la tercera categoría de dato del proyecto (ADR-023
-- §Contexto): ni dato de usuario aislado por RN-01, ni dato de mercado compartido
-- por ADR-002. Ninguna lleva `user_id`.
--
-- `registration_settings` es de UNA SOLA FILA y lo impone la base: clave primaria
-- entera más `CHECK ("id" = 1)`. Con la clave sola, un `INSERT` con id 2 pasaría y
-- dejaría dos configuraciones conviviendo — la app leyendo una y el operador mirando
-- la otra. Con el CHECK, el segundo INSERT falla escriba el id que escriba.
--
-- LA FILA SEMILLA la escribe esta migración con `open_manually = true` y
-- `capacity = 50` (ADR-023 pto. 7; el 50 lo fijó el humano el 2026-08-19). Los
-- mismos valores viven arriba en `SEED_REGISTRATION_SETTINGS`
-- (`src/lib/registration/gate.ts`), que es también la respuesta si la fila faltara:
-- cerrar el registro por una fila ausente sería matar el objetivo de la épica en
-- silencio. El 50 es SEMILLA, NO POLÍTICA — se cambia desde `/admin` sin desplegar,
-- que es exactamente lo que CE-6 pide.
--
-- El `INSERT` es idempotente (`ON CONFLICT DO NOTHING`) porque el build migra en
-- todos los entornos con `DATABASE_URL` compartida (F-SPEC-023-1): si esta migración
-- se reaplicara sobre una base que ya tiene la fila, NO puede pisar el ajuste que el
-- operador haya puesto a mano.
--
-- DESPLIEGUE (F-SPEC-037-1): abrir la PR migra producción. Es aditiva y aburrida,
-- pero CUÁNDO se abre la PR es decisión del humano.

CREATE TABLE "cron_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"outcome" text,
	"requested" integer,
	"updated" integer,
	"skipped" integer,
	"triggers_opened" integer,
	"triggers_closed" integer,
	"notifications_entries" integer,
	"notifications_digests" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "registration_settings" (
	"id" integer PRIMARY KEY NOT NULL,
	"open_manually" boolean DEFAULT true NOT NULL,
	"capacity" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text,
	CONSTRAINT "registration_settings_single_row" CHECK ("id" = 1)
);
--> statement-breakpoint
INSERT INTO "registration_settings" ("id", "open_manually", "capacity", "updated_by")
VALUES (1, true, 50, NULL)
ON CONFLICT ("id") DO NOTHING;
