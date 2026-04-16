import { relations } from "drizzle-orm";
import { index, pgTableCreator, primaryKey } from "drizzle-orm/pg-core";
import { type AdapterAccount } from "next-auth/adapters";

/**
 * This is an example of how to use the multi-project schema feature of Drizzle ORM. Use the same
 * database instance for multiple projects.
 *
 * @see https://orm.drizzle.team/docs/goodies#multi-project-schema
 */
export const createTable = pgTableCreator(
  (name) => `squishes-checkers_${name}`,
);



export const users = createTable("user", (d) => ({
  id: d
    .varchar({ length: 255 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: d.varchar({ length: 255 }),
  email: d.varchar({ length: 255 }).notNull(),
  emailVerified: d
    .timestamp({
      mode: "date",
      withTimezone: true,
    })
    .$defaultFn(() => /* @__PURE__ */ new Date()),
  image: d.varchar({ length: 255 }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  accounts: many(accounts),
  gamesAsPlayer1: many(games, { relationName: "gamePlayer1" }),
  gamesAsPlayer2: many(games, { relationName: "gamePlayer2" }),
  gamesAsCurrentPlayer: many(games, { relationName: "gameCurrentPlayer" }),
  gamesAsWinner: many(games, { relationName: "gameWinner" }),
  moves: many(gameMoves),
  sentChatMessages: many(chatMessages),
}));

export const accounts = createTable(
  "account",
  (d) => ({
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    type: d.varchar({ length: 255 }).$type<AdapterAccount["type"]>().notNull(),
    provider: d.varchar({ length: 255 }).notNull(),
    providerAccountId: d.varchar({ length: 255 }).notNull(),
    refresh_token: d.text(),
    access_token: d.text(),
    expires_at: d.integer(),
    token_type: d.varchar({ length: 255 }),
    scope: d.varchar({ length: 255 }),
    id_token: d.text(),
    session_state: d.varchar({ length: 255 }),
  }),
  (t) => [
    primaryKey({ columns: [t.provider, t.providerAccountId] }),
    index("account_user_id_idx").on(t.userId),
  ],
);

export const accountsRelations = relations(accounts, ({ one }) => ({
  user: one(users, { fields: [accounts.userId], references: [users.id] }),
}));

export const sessions = createTable(
  "session",
  (d) => ({
    sessionToken: d.varchar({ length: 255 }).notNull().primaryKey(),
    userId: d
      .varchar({ length: 255 })
      .notNull()
      .references(() => users.id),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [index("t_user_id_idx").on(t.userId)],
);

export const sessionsRelations = relations(sessions, ({ one }) => ({
  user: one(users, { fields: [sessions.userId], references: [users.id] }),
}));

export const verificationTokens = createTable(
  "verification_token",
  (d) => ({
    identifier: d.varchar({ length: 255 }).notNull(),
    token: d.varchar({ length: 255 }).notNull(),
    expires: d.timestamp({ mode: "date", withTimezone: true }).notNull(),
  }),
  (t) => [primaryKey({ columns: [t.identifier, t.token] })],
);

// Checkers Game Tables

export const allowedEmails = createTable(
  "allowed_email", 
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    email: d.varchar({ length: 255 }).notNull().unique(),
    isAdmin: d.boolean().notNull().default(false),
    createdAt: d
      .timestamp({ withTimezone: true })
      .$defaultFn(() => new Date())
      .notNull(),
  }),
  (t) => [index("email_idx").on(t.email)],
);

export const games = createTable(
  "game",
  (d) => ({
    id: d.varchar({ length: 255 }).notNull().primaryKey().$defaultFn(() => crypto.randomUUID()),
    player1Id: d.varchar({ length: 255 }).notNull().references(() => users.id),
    player2Id: d.varchar({ length: 255 }).references(() => users.id),
    gameMode: d.varchar({ length: 50 }).notNull().default("multiplayer"), // multiplayer, single_player_ai
    isPrivate: d.boolean().notNull().default(true), // true = invite-only, false = public lobby
    inviteCode: d.varchar({ length: 8 }), // short code for inviting players
    aiDifficulty: d.varchar({ length: 50 }).default("medium"), // easy, medium, hard (for single player)
    aiPlayer: d.varchar({ length: 10 }).default("black"), // red, black (which color AI plays)
    status: d.varchar({ length: 50 }).notNull().default("waiting_for_player"), // waiting_for_player, in_progress, finished, abandoned
    currentTurn: d.varchar({ length: 255 }).references(() => users.id), // whose turn it is
    winnerId: d.varchar({ length: 255 }).references(() => users.id),
    boardState: d.text().notNull(), // JSON representation of the board
    lastMoveAt: d.timestamp({ withTimezone: true }).notNull().$defaultFn(() => new Date()),
    createdAt: d.timestamp({ withTimezone: true }).notNull().$defaultFn(() => new Date()),
    updatedAt: d.timestamp({ withTimezone: true }).$onUpdate(() => new Date()),
  }),
  (t) => [
    index("player1_idx").on(t.player1Id),
    index("player2_idx").on(t.player2Id),
    index("status_idx").on(t.status),
    index("current_turn_idx").on(t.currentTurn),
  ],
);

export const gameMoves = createTable(
  "game_move",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    gameId: d.varchar({ length: 255 }).notNull().references(() => games.id),
    playerId: d.varchar({ length: 255 }).notNull().references(() => users.id),
    moveNumber: d.integer().notNull(),
    fromRow: d.integer().notNull(),
    fromCol: d.integer().notNull(),
    toRow: d.integer().notNull(),
    toCol: d.integer().notNull(),
    capturedPieces: d.text(), // JSON array of captured piece positions
    moveType: d.varchar({ length: 50 }).notNull(), // normal, capture, king_promotion
    createdAt: d.timestamp({ withTimezone: true }).notNull().$defaultFn(() => new Date()),
  }),
  (t) => [
    index("game_move_idx").on(t.gameId),
    index("move_number_idx").on(t.moveNumber),
  ],
);

export const chatMessages = createTable(
  "chat_message",
  (d) => ({
    id: d.integer().primaryKey().generatedByDefaultAsIdentity(),
    gameId: d.varchar({ length: 255 }).notNull().references(() => games.id),
    senderId: d.varchar({ length: 255 }).notNull().references(() => users.id),
    encryptedMessage: d.text().notNull(), // AES encrypted message
    iv: d.varchar({ length: 32 }).notNull(), // Initialization vector for encryption
    createdAt: d.timestamp({ withTimezone: true }).notNull().$defaultFn(() => new Date()),
  }),
  (t) => [
    index("chat_game_idx").on(t.gameId),
    index("chat_created_idx").on(t.createdAt),
  ],
);

// Relations for Checkers Game

export const gamesRelations = relations(games, ({ one, many }) => ({
  player1: one(users, { fields: [games.player1Id], references: [users.id], relationName: "gamePlayer1" }),
  player2: one(users, { fields: [games.player2Id], references: [users.id], relationName: "gamePlayer2" }),
  currentPlayer: one(users, { fields: [games.currentTurn], references: [users.id], relationName: "gameCurrentPlayer" }),
  winner: one(users, { fields: [games.winnerId], references: [users.id], relationName: "gameWinner" }),
  moves: many(gameMoves),
  chatMessages: many(chatMessages),
}));

export const gameMovesRelations = relations(gameMoves, ({ one }) => ({
  game: one(games, { fields: [gameMoves.gameId], references: [games.id] }),
  player: one(users, { fields: [gameMoves.playerId], references: [users.id] }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  game: one(games, { fields: [chatMessages.gameId], references: [games.id] }),
  sender: one(users, { fields: [chatMessages.senderId], references: [users.id] }),
}));
