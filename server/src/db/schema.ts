import { serial, text, pgTable, timestamp, integer, varchar, pgEnum } from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Enum for message types
export const messageTypeEnum = pgEnum('message_type', ['text', 'file']);

// Users table
export const usersTable = pgTable('users', {
  id: serial('id').primaryKey(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  username: varchar('username', { length: 30 }).notNull().unique(),
  password_hash: text('password_hash').notNull(),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Conversations table
export const conversationsTable = pgTable('conversations', {
  id: serial('id').primaryKey(),
  user1_id: integer('user1_id').notNull().references(() => usersTable.id),
  user2_id: integer('user2_id').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
  updated_at: timestamp('updated_at').defaultNow().notNull(),
});

// Files table
export const filesTable = pgTable('files', {
  id: serial('id').primaryKey(),
  original_name: varchar('original_name', { length: 255 }).notNull(),
  file_path: text('file_path').notNull(),
  file_size: integer('file_size').notNull(),
  mime_type: varchar('mime_type', { length: 100 }).notNull(),
  uploaded_by: integer('uploaded_by').notNull().references(() => usersTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Messages table
export const messagesTable = pgTable('messages', {
  id: serial('id').primaryKey(),
  conversation_id: integer('conversation_id').notNull().references(() => conversationsTable.id),
  sender_id: integer('sender_id').notNull().references(() => usersTable.id),
  content: text('content').notNull(),
  message_type: messageTypeEnum('message_type').notNull().default('text'),
  file_id: integer('file_id').references(() => filesTable.id),
  created_at: timestamp('created_at').defaultNow().notNull(),
});

// Relations
export const usersRelations = relations(usersTable, ({ many }) => ({
  sentMessages: many(messagesTable),
  uploadedFiles: many(filesTable),
  conversationsAsUser1: many(conversationsTable, { relationName: 'user1' }),
  conversationsAsUser2: many(conversationsTable, { relationName: 'user2' }),
}));

export const conversationsRelations = relations(conversationsTable, ({ one, many }) => ({
  user1: one(usersTable, {
    fields: [conversationsTable.user1_id],
    references: [usersTable.id],
    relationName: 'user1',
  }),
  user2: one(usersTable, {
    fields: [conversationsTable.user2_id],
    references: [usersTable.id],
    relationName: 'user2',
  }),
  messages: many(messagesTable),
}));

export const messagesRelations = relations(messagesTable, ({ one }) => ({
  conversation: one(conversationsTable, {
    fields: [messagesTable.conversation_id],
    references: [conversationsTable.id],
  }),
  sender: one(usersTable, {
    fields: [messagesTable.sender_id],
    references: [usersTable.id],
  }),
  file: one(filesTable, {
    fields: [messagesTable.file_id],
    references: [filesTable.id],
  }),
}));

export const filesRelations = relations(filesTable, ({ one, many }) => ({
  uploader: one(usersTable, {
    fields: [filesTable.uploaded_by],
    references: [usersTable.id],
  }),
  messages: many(messagesTable),
}));

// TypeScript types for table schemas
export type User = typeof usersTable.$inferSelect;
export type NewUser = typeof usersTable.$inferInsert;

export type Conversation = typeof conversationsTable.$inferSelect;
export type NewConversation = typeof conversationsTable.$inferInsert;

export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;

export type File = typeof filesTable.$inferSelect;
export type NewFile = typeof filesTable.$inferInsert;

// Export all tables and relations for proper query building
export const tables = {
  users: usersTable,
  conversations: conversationsTable,
  messages: messagesTable,
  files: filesTable,
};