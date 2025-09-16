import { db } from '../db';
import { conversationsTable, usersTable } from '../db/schema';
import { type CreateConversationInput, type Conversation } from '../schema';
import { eq, or, and } from 'drizzle-orm';

export const createConversation = async (input: CreateConversationInput): Promise<Conversation> => {
  try {
    // Ensure user can't chat with themselves
    if (input.user1_id === input.user2_id) {
      throw new Error('Cannot create conversation with yourself');
    }

    // Verify both users exist
    const users = await db.select()
      .from(usersTable)
      .where(or(
        eq(usersTable.id, input.user1_id),
        eq(usersTable.id, input.user2_id)
      ))
      .execute();

    if (users.length !== 2) {
      throw new Error('One or both users do not exist');
    }

    // Check if conversation already exists between these two users
    // Conversation can exist in either direction (user1->user2 or user2->user1)
    const existingConversation = await db.select()
      .from(conversationsTable)
      .where(or(
        and(
          eq(conversationsTable.user1_id, input.user1_id),
          eq(conversationsTable.user2_id, input.user2_id)
        ),
        and(
          eq(conversationsTable.user1_id, input.user2_id),
          eq(conversationsTable.user2_id, input.user1_id)
        )
      ))
      .execute();

    // If conversation exists, return it
    if (existingConversation.length > 0) {
      return existingConversation[0];
    }

    // Create new conversation
    const result = await db.insert(conversationsTable)
      .values({
        user1_id: input.user1_id,
        user2_id: input.user2_id
      })
      .returning()
      .execute();

    return result[0];
  } catch (error) {
    console.error('Conversation creation failed:', error);
    throw error;
  }
};