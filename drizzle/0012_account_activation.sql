-- SPEC-066 / ADR-042 — La cuenta nace pendiente y sólo ocupa plaza al verificar el correo.
--
-- Todo ADITIVO (RI-01): una tabla nueva, una columna nueva que admite NULL, una FK y un
-- relleno. Ni borra, ni renombra, ni estrecha nada.
--
-- EL DEFAULT now() DE `users.email_verified_at` ES A PROPÓSITO (ADR-042 pto. 2): abrir la
-- PR migra producción mientras el código anterior sigue sirviendo altas (F-SPEC-023-1).
-- Ese código no conoce la columna, así que sus filas nacen ACTIVADAS, que es lo que le
-- prometió a quien se registró (sesión en el acto). El camino de alta nuevo escribe NULL
-- explícitamente.
--
-- EL RELLENO (ADR-042 pto. 3): toda cuenta que ya existía queda activada con su propia
-- fecha de alta como fecha de verificación. `ADD COLUMN ... DEFAULT now()` ya las deja
-- activadas; el UPDATE sólo cambia la fecha por la de su alta, que es la verdad
-- disponible. No toca una fila NULL: si algún día se reaplicase, no activaría a nadie.
--
-- `email_verification_tokens` es gemela de `password_reset_tokens` (ADR-042 pto. 4): sólo
-- el digest, único; el secreto nunca toca la base.

CREATE TABLE "email_verification_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "email_verification_tokens_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "email_verified_at" timestamp with time zone DEFAULT now();--> statement-breakpoint
ALTER TABLE "email_verification_tokens" ADD CONSTRAINT "email_verification_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
UPDATE "users" SET "email_verified_at" = "created_at" WHERE "email_verified_at" IS NOT NULL;
