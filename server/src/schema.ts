import { z } from 'zod';

// User schema
export const userSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  username: z.string(),
  password_hash: z.string(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type User = z.infer<typeof userSchema>;

// Public user schema (without sensitive data)
export const publicUserSchema = z.object({
  id: z.number(),
  email: z.string().email(),
  username: z.string(),
  created_at: z.coerce.date()
});

export type PublicUser = z.infer<typeof publicUserSchema>;

// User registration input
export const registerUserInputSchema = z.object({
  email: z.string().email(),
  username: z.string().min(3).max(30),
  password: z.string().min(8)
});

export type RegisterUserInput = z.infer<typeof registerUserInputSchema>;

// User login input
export const loginUserInputSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

export type LoginUserInput = z.infer<typeof loginUserInputSchema>;

// Chat conversation schema
export const conversationSchema = z.object({
  id: z.number(),
  user1_id: z.number(),
  user2_id: z.number(),
  created_at: z.coerce.date(),
  updated_at: z.coerce.date()
});

export type Conversation = z.infer<typeof conversationSchema>;

// Chat message schema
export const messageSchema = z.object({
  id: z.number(),
  conversation_id: z.number(),
  sender_id: z.number(),
  content: z.string(),
  message_type: z.enum(['text', 'file']),
  file_id: z.number().nullable(),
  created_at: z.coerce.date()
});

export type Message = z.infer<typeof messageSchema>;

// File schema
export const fileSchema = z.object({
  id: z.number(),
  original_name: z.string(),
  file_path: z.string(),
  file_size: z.number(),
  mime_type: z.string(),
  uploaded_by: z.number(),
  created_at: z.coerce.date()
});

export type File = z.infer<typeof fileSchema>;

// Input schemas for creating conversations
export const createConversationInputSchema = z.object({
  user1_id: z.number(),
  user2_id: z.number()
});

export type CreateConversationInput = z.infer<typeof createConversationInputSchema>;

// Input schemas for sending messages
export const sendMessageInputSchema = z.object({
  conversation_id: z.number(),
  sender_id: z.number(),
  content: z.string(),
  message_type: z.enum(['text', 'file']).default('text'),
  file_id: z.number().nullable().optional()
});

export type SendMessageInput = z.infer<typeof sendMessageInputSchema>;

// Input schema for file upload
export const uploadFileInputSchema = z.object({
  original_name: z.string(),
  file_path: z.string(),
  file_size: z.number().max(50 * 1024 * 1024), // 50MB max
  mime_type: z.string(),
  uploaded_by: z.number()
});

export type UploadFileInput = z.infer<typeof uploadFileInputSchema>;

// Input schema for getting conversations
export const getConversationsInputSchema = z.object({
  user_id: z.number()
});

export type GetConversationsInput = z.infer<typeof getConversationsInputSchema>;

// Input schema for getting messages
export const getMessagesInputSchema = z.object({
  conversation_id: z.number(),
  limit: z.number().optional().default(50),
  offset: z.number().optional().default(0)
});

export type GetMessagesInput = z.infer<typeof getMessagesInputSchema>;

// Input schema for getting users (for finding chat partners)
export const getUsersInputSchema = z.object({
  search: z.string().optional(),
  exclude_user_id: z.number().optional()
});

export type GetUsersInput = z.infer<typeof getUsersInputSchema>;

// Authentication response schema
export const authResponseSchema = z.object({
  user: publicUserSchema,
  token: z.string()
});

export type AuthResponse = z.infer<typeof authResponseSchema>;