import { db } from '../db';
import { messagesTable, conversationsTable, filesTable } from '../db/schema';
import { type SendMessageInput, type Message } from '../schema';
import { eq, or, and } from 'drizzle-orm';

export const sendMessage = async (input: SendMessageInput): Promise<Message> => {
  try {
    // 1. Validate that sender is part of the conversation
    const conversation = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, input.conversation_id))
      .execute();

    if (conversation.length === 0) {
      throw new Error('Conversation not found');
    }

    const conv = conversation[0];
    if (conv.user1_id !== input.sender_id && conv.user2_id !== input.sender_id) {
      throw new Error('Sender is not part of this conversation');
    }

    // 2. If message_type is 'file', ensure file_id is provided and file exists
    if (input.message_type === 'file') {
      if (!input.file_id) {
        throw new Error('file_id is required for file messages');
      }

      const fileResult = await db.select()
        .from(filesTable)
        .where(eq(filesTable.id, input.file_id))
        .execute();

      if (fileResult.length === 0) {
        throw new Error('File not found');
      }
    }

    // 3. Create new message record in database
    const messageResult = await db.insert(messagesTable)
      .values({
        conversation_id: input.conversation_id,
        sender_id: input.sender_id,
        content: input.content,
        message_type: input.message_type,
        file_id: input.file_id || null
      })
      .returning()
      .execute();

    const message = messageResult[0];

    // 4. Update conversation's updated_at timestamp
    await db.update(conversationsTable)
      .set({ updated_at: new Date() })
      .where(eq(conversationsTable.id, input.conversation_id))
      .execute();

    // 5. Real-time event emission would be implemented here
    // (WebSocket/Server-Sent Events integration)

    // 6. Return the created message
    return message;
  } catch (error) {
    console.error('Send message failed:', error);
    throw error;
  }
};