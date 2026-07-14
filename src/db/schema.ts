import { pgTable, uuid, text, timestamp, numeric, date, unique } from 'drizzle-orm/pg-core';

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

/**
 * `symbols` — registro COMPARTIDO de símbolos (ADR-002), no por usuario.
 * Semilla del registro; watchlist/ingesta lo extienden. Un símbolo por ticker.
 */
export const symbols = pgTable('symbols', {
  id: uuid('id').defaultRandom().primaryKey(),
  ticker: text('ticker').notNull().unique(),
  currency: text('currency').notNull(),
});

export type Symbol = typeof symbols.$inferSelect;

/**
 * `transactions` — ledger inmutable de operaciones (ADR-003). La posición y el
 * P/L se DERIVAN de estos eventos. Importes en `numeric` (sin float) para no
 * perder precisión (SPEC-002). Campos según `type`:
 *  - buy/sell: quantity, price, gastos
 *  - split:    ratio
 *  - dividend: amount
 * Toda fila lleva `userId` (aislamiento RN-01).
 */
export const transactions = pgTable('transactions', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  symbolId: uuid('symbol_id')
    .notNull()
    .references(() => symbols.id),
  type: text('type').notNull(), // 'buy' | 'sell' | 'split' | 'dividend'
  occurredOn: date('occurred_on').notNull(),
  quantity: numeric('quantity'),
  price: numeric('price'),
  gastos: numeric('gastos'),
  ratio: numeric('ratio'),
  amount: numeric('amount'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Transaction = typeof transactions.$inferSelect;
export type NewTransaction = typeof transactions.$inferInsert;

/**
 * `watched_symbols` — acciones vigiladas por usuario con sus zonas (SPEC-003).
 * Zonas opcionales e independientes (RN-10): cada par (min,max) puede ser null.
 * Una entrada por (userId, symbolId). Referencia el símbolo compartido (ADR-002).
 */
export const watchedSymbols = pgTable(
  'watched_symbols',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    symbolId: uuid('symbol_id')
      .notNull()
      .references(() => symbols.id),
    buyMin: numeric('buy_min'),
    buyMax: numeric('buy_max'),
    sellMin: numeric('sell_min'),
    sellMax: numeric('sell_max'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqUserSymbol: unique('watched_user_symbol').on(t.userId, t.symbolId),
  }),
);

export type WatchedSymbol = typeof watchedSymbols.$inferSelect;
export type NewWatchedSymbol = typeof watchedSymbols.$inferInsert;
