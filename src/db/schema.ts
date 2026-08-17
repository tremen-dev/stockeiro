import { pgTable, uuid, text, timestamp, numeric, date, unique, index } from 'drizzle-orm/pg-core';

/**
 * `users` — identidad mínima y ancla de propiedad (SPEC-001).
 * Toda entidad de dominio futura (posición, acción vigilada, zona, aviso)
 * llevará un `userId` -> users.id para el aislamiento (RN-01, ADR-001).
 */
export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(), // RN-02: email único
  passwordHash: text('password_hash').notNull(),
  // ÉPOCA DE CREDENCIAL (ADR-016 pto. 1): marca de la última vez que cambió la
  // contraseña. El JWT la estampa al hacer login y la frontera Node la revalida:
  // si no coinciden, la sesión ya no autentica (invalidación de sesiones previas).
  passwordChangedAt: timestamp('password_changed_at', { withTimezone: true })
    .notNull()
    .defaultNow(),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

/**
 * `password_reset_tokens` — enlaces de recuperación emitidos (SPEC-023, ADR-015 pto. 3).
 *
 * Tabla propia y no columnas de `users` porque un token es un EVENTO con ciclo de vida
 * (se emite, caduca, se consume) y porque el historial es lo que hace posible el límite
 * de solicitudes por ventana (CA-12).
 *
 * `tokenHash` es el SHA-256 en hex del token en claro (ADR-015 pto. 2): la tabla NUNCA
 * contiene el secreto (CA-5), y localizar la fila exige re-hashear lo recibido. Es único
 * porque es la clave de búsqueda. `consumedAt` null = vivo; el consumo es un UPDATE
 * condicional atómico (ADR-015 pto. 5), no un lee-comprueba-escribe.
 */
export const passwordResetTokens = pgTable('password_reset_tokens', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
  consumedAt: timestamp('consumed_at', { withTimezone: true }), // null = vivo
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/**
 * `symbols` — registro COMPARTIDO de símbolos (ADR-002), no por usuario.
 * Semilla del registro; watchlist/ingesta lo extienden.
 *
 * Identidad = (`ticker`, `micCode`) (ADR-007): un mismo ticker cotiza en varios
 * mercados con distinta divisa (p. ej. `SAN` en BME/LSE/NYSE); el `micCode` (MIC
 * ISO 10383) fija de qué mercado hablamos, y con él se pide la cotización a `/eod`
 * (coherencia símbolo↔cotización, SPEC-008). `exchange`/`name` son metadatos de la
 * búsqueda para mostrar al usuario. `micCode` es nullable para los símbolos
 * sembrados antes de ADR-007 (legacy): en ese caso la identidad recae en `ticker`.
 */
export const symbols = pgTable(
  'symbols',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    ticker: text('ticker').notNull(),
    micCode: text('mic_code'), // MIC ISO 10383; null = símbolo legacy (pre ADR-007)
    exchange: text('exchange'),
    name: text('name'), // instrument_name del proveedor (p. ej. "Microsoft Corp")
    currency: text('currency').notNull(),
  },
  (t) => ({
    uniqTickerMic: unique('symbols_ticker_mic').on(t.ticker, t.micCode),
    tickerIdx: index('symbols_ticker_idx').on(t.ticker),
  }),
);

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
export const transactions = pgTable(
  'transactions',
  {
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
    // Import desde bróker (SPEC-013). Sólo en filas importadas; el alta manual las deja null.
    importKey: text('import_key'), // clave derivada de idempotencia (ADR-010), única por usuario
    importeEur: numeric('importe_eur'), // importe EUR del extracto, metadato (ADR-011)
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // Idempotencia del import (ADR-010): re-importar no duplica. NULL distingue las
    // filas manuales (import_key null) → no chocan entre sí en Postgres.
    uniqUserImportKey: unique('transactions_user_import_key').on(t.userId, t.importKey),
  }),
);

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
 * `quote_diagnostics` — por qué un símbolo NO se pudo cotizar (SPEC-016, ADR-012 pto. 6).
 * COMPARTIDA por símbolo (`symbolId` único), como `quotes`: el motivo no depende del
 * usuario. Tabla propia y no una columna de `quotes` porque un símbolo que NUNCA se
 * cotizó no tiene fila en `quotes` — y es justo el caso que hay que explicar.
 *
 * Existe porque el defecto de cobertura (EPIC-FIX) pasó semanas sin detectarse: el ciclo
 * se saltaba los símbolos (CA-6 de SPEC-004, resiliencia correcta) y tiraba el motivo, así
 * que el usuario veía "sin cotización" igual que si el ciclo no hubiera corrido.
 *
 * `reason` es vocabulario del DOMINIO (`QuoteFailureReason`), nunca el texto del proveedor.
 * La fila se BORRA cuando un ciclo posterior sí obtiene precio (CA-8): sin avisos fantasma.
 */
export const quoteDiagnostics = pgTable('quote_diagnostics', {
  id: uuid('id').defaultRandom().primaryKey(),
  symbolId: uuid('symbol_id')
    .notNull()
    .unique()
    .references(() => symbols.id),
  reason: text('reason').notNull(), // QuoteFailureReason (dominio)
  attemptedAt: timestamp('attempted_at', { withTimezone: true }).notNull().defaultNow(),
});

export type QuoteDiagnostic = typeof quoteDiagnostics.$inferSelect;

/**
 * `zone_triggers` — episodios de entrada en zona por usuario (ADR-005, SPEC-005).
 * Un episodio por (acción vigilada, tipo de zona) mientras el precio permanece
 * dentro: `closedAt` null = dentro AHORA (estado actual + idempotencia, RN-13); al
 * salir de la zona se cierra. El conjunto de filas es el log de disparos que la
 * spec de notificación (CE-2) consumirá — tanto entradas como permanencia.
 *
 * El episodio PERTENECE a su acción vigilada (ADR-017, SPEC-024): es estado derivado
 * del par (zonas, última cotización), nadie lo muestra y se recalcula solo en el ciclo
 * siguiente. Por eso la FK cascadea: dejar de vigilar borra sus episodios en la misma
 * sentencia, sin borrado explícito que otro camino de baja pueda olvidar.
 */
export const zoneTriggers = pgTable('zone_triggers', {
  id: uuid('id').defaultRandom().primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id),
  watchedSymbolId: uuid('watched_symbol_id')
    .notNull()
    .references(() => watchedSymbols.id, { onDelete: 'cascade' }),
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
 *
 * El aviso NO pertenece al episodio: lo referencia (ADR-017, SPEC-024). Si el episodio
 * desaparece —porque el usuario dejó de vigilar— se pierde el vínculo, nunca el aviso:
 * la fila es autocontenida (`payload`, `kind`, `asOf`, `status`, `readAt`) y RN-15 la
 * declara fuente de verdad. De ahí el `set null` en vez de un cascade que la borraría.
 */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    kind: text('kind').notNull(), // 'entry' | 'digest'
    // 'entry'; null en 'digest'. Y null también cuando su episodio se borró (ADR-017).
    zoneTriggerId: uuid('zone_trigger_id').references(() => zoneTriggers.id, { onDelete: 'set null' }),
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

/**
 * `symbol_aliases` — mapeo RECORDADO por usuario del import (SPEC-012, ADR-009):
 * (userId, nombre del valor en el bróker, etiqueta de mercado del bróker) → símbolo
 * canónico resuelto. Aislado por usuario (RN-01): la resolución que confirma un
 * usuario no la ven ni la reutilizan otros. Estabiliza la identidad entre
 * re-imports para que la clave de idempotencia (ADR-010, SPEC-013) no cambie y
 * evita re-preguntar (CA-6). La FUSIÓN manual de eventos corporativos (CA-7) se
 * expresa como dos alias distintos que apuntan al MISMO `symbolId`.
 */
export const symbolAliases = pgTable(
  'symbol_aliases',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id),
    brokerName: text('broker_name').notNull(), // nombre del valor tal como lo da el bróker
    marketLabel: text('market_label').notNull(), // etiqueta de mercado del bróker (p. ej. M.CONTINUO)
    symbolId: uuid('symbol_id')
      .notNull()
      .references(() => symbols.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqUserValor: unique('symbol_alias_user_broker_market').on(t.userId, t.brokerName, t.marketLabel),
    userIdx: index('symbol_alias_user_idx').on(t.userId),
  }),
);

export type SymbolAlias = typeof symbolAliases.$inferSelect;
export type NewSymbolAlias = typeof symbolAliases.$inferInsert;
