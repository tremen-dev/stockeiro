-- SPEC-034 / ADR-021 — Rol de cuenta en `users`.
--
-- Tres sentencias, todas ADITIVAS (RI-01): ni borran, ni renombran, ni estrechan.
-- El código anterior a esta spec sigue funcionando contra el esquema resultante,
-- que es lo que hace este despliegue aburrido (F-SPEC-034-2): entre que la
-- migración corre y que el código nuevo está vivo, nadie ve nada distinto porque
-- todavía nadie lee la columna.
--
-- EL DEFAULT ES ASIMÉTRICO Y ES A PROPÓSITO (ADR-021 pto. 8):
--
--   1) La columna se AÑADE con DEFAULT 'admin', así que todas las cuentas que ya
--      existían quedan 'admin'. Es lo que hace la solución autocontenida: el
--      despliegue queda operable sin ningún UPDATE manual posterior. Su condición
--      de verificación es F-SPEC-034-5 / F-ADR-021-3 — el humano confirma el censo
--      de `users` ANTES de abrir la PR y degrada a mano cualquier cuenta ajena.
--
--   2) Acto seguido el default pasa a 'tester', de modo que toda cuenta NUEVA nace
--      así. Un DEFAULT 'tester' de una sola pasada convertiría al operador en
--      tester en el mismo despliegue que le quita Cartera y la pantalla de
--      operación: eso es un incidente, no una migración.
--
-- El dominio se cierra con CHECK y no con un enum de Postgres: `ALTER TYPE ... ADD
-- VALUE` es incómodo de revertir y de aplicar en dos despliegues, y RI-01 empuja a
-- lo aditivo. La lista de valores sale de `ROLES` (src/lib/auth/sections.ts).

ALTER TABLE "users" ADD COLUMN "role" text DEFAULT 'admin' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'tester';--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_role_check" CHECK ("role" in ('tester', 'completo', 'admin'));
