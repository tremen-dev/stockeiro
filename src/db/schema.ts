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

/**
 * `quotes` — última cotización COMPARTIDA por símbolo (ADR-004, SPEC-004). Una
 * fila por símbolo (`symbolId` único): el refresco hace upsert, no acumula
 * histórico. `price` es el último cierre NO ajustado (RN-12) y `asOf` su fecha de
 * referencia (D-2), que se muestra al usuario. La leen todos los usuarios que
 * referencian el símbolo (P/L actual, RN-06).
 */
export const quotes = pgTable('quotes', {
  id: uuid('id').defaultRandom().primaryKey(),
  symbolId: uuid('symbol_id')
    .notNull()
    .unique()
    .references(() => symbols.id),
  price: numeric('price').notNull(),
  currency: text('currency').notNull(),
  asOf: timestamp('as_of', { withTimezone: true }).notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export type Quote = typeof quotes.$inferSelect;
export type NewQuote = typeof quotes.$inferInsert;

/**
 * `zone_triggers` — episodios de entrada en zona por usuario (ADR-005, SPEC-005).
 * Un episodio por (acción vigilada, tipo de zona) mientras el precio permanece
 * dentro: `closedAt` null = dentro AHORA (estado actual + idempotencia, RN-13); al
 * salir de la zona se cierra. El conjunto de filas es el log de disparos que la
 * spec de notificación (CE-2) consumirá — tanto entradas como permanencia.
 */
export const zoneTriggers = pgTable('zone_triggers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  watchedSymbolId: uuid('watched_symbol_id')
    .notNull()
    .references(() => watchedSymbols.id),
  symbolId: uuid('symbol_id')
    .notNull()
    .references(() => symbols.id),
  zoneKind: text('zone_kind').notNull(), // 'buy' | 'sell'
  price: numeric('price').notNull(), // precio que originó el disparo (RN-12, no ajustado)
  asOf: timestamp('as_of', { withTimezone: true }).notNull(), // asOf de la cotización (D-2)
  openedAt: timestamp('opened_at', { withTimezone: true }).notNull().defaultNow(),
  closedAt: timestamp('closed_at', { withTimezone: true }), // null = episodio abierto (en zona)
});

export type ZoneTrigger = typeof zoneTriggers.$inferSelect;
export type NewZoneTrigger = typeof zoneTriggers.$inferInsert;

/**
 * `notifications` — avisos emitidos por usuario (ADR-006, SPEC-006). Es el registro
 * in-app (fuente de verdad y fallback, RN-15): la fila existe aunque el envío externo
 * falle (`status='failed'`). Idempotencia del envío (RN-14):
 *  - 'entry' (aviso individual): único por `zoneTriggerId` → uno por episodio de disparo.
 *  - 'digest' (aviso agregado): único por (`userId`, `cycleRef`) → uno por usuario y ciclo.
 * Cada aviso lleva su `asOf` (D-2). Los NULL cuentan como distintos en Postgres, así que
 * las filas 'entry' (cycleRef null) y 'digest' (zoneTriggerId null) conviven sin chocar.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(), // 'entry' | 'digest'
    zoneTriggerId: uuid('zone_trigger_id').references(() => zoneTriggers.id), // 'entry'; null en 'digest'
    cycleRef: text('cycle_ref'), // 'digest'; null en 'entry'
    payload: text('payload').notNull(), // resumen legible del aviso
    channel: text('channel').notNull(), // 'email' | 'in_app'
    status: text('status').notNull(), // 'sent' | 'failed'
    asOf: timestamp('as_of', { withTimezone: true }).notNull(), // D-2
    readAt: timestamp('read_at', { withTimezone: true }), // null = no leído (SPEC-007)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqEntry: unique('notif_entry_trigger').on(t.zoneTriggerId), // 1 entry por episodio
    uniqDigest: unique('notif_digest_cycle').on(t.userId, t.cycleRef), // 1 digest por (usuario, ciclo)
  }),
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
