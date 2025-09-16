import { db } from '../db';
import { messagesTable, conversationsTable, filesTable } from '../db/schema';
import { type GetMessagesInput, type Message } from '../schema';
import { eq, desc, and } from 'drizzle-orm';

export const getMessages = async (input: GetMessagesInput): Promise<Message[]> => {
  try {
    // Note: In a real application, you would validate that the requesting user 
    // is part of the conversation by checking user permissions/session
    // For now, we'll query messages directly for the conversation
    
    // Build the base query with left join for file information
    const results = await db.select({
      id: messagesTable.id,
      conversation_id: messagesTable.conversation_id,
      sender_id: messagesTable.sender_id,
      content: messagesTable.content,
      message_type: messagesTable.message_type,
      file_id: messagesTable.file_id,
      created_at: messagesTable.created_at
    })
    .from(messagesTable)
    .where(eq(messagesTable.conversation_id, input.conversation_id))
    .orderBy(desc(messagesTable.created_at))
    .limit(input.limit)
    .offset(input.offset)
    .execute();

    return results;
  } catch (error) {
    console.error('Get messages failed:', error);
    throw error;
  }
};