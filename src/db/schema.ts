import { pgTable, uuid, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * `users` — identidad mínima y ancla de propiedad (SPEC-001).
 * Toda entidad de dominio futura (posición, acción vigilada, zona, aviso)
 * llevará un `userId` -> users.id para el aislamiento (RN-01, ADR-001).
 */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(), // RN-02: email único
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
