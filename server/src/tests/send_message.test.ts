import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, conversationsTable, messagesTable, filesTable } from '../db/schema';
import { type SendMessageInput } from '../schema';
import { sendMessage } from '../handlers/send_message';
import { eq } from 'drizzle-orm';

describe('sendMessage', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  // Create test users, conversation, and file for the tests
  let testUser1Id: number;
  let testUser2Id: number;
  let testUser3Id: number;
  let testConversationId: number;
  let testFileId: number;

  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@test.com',
          username: 'user1',
          password_hash: 'hash1'
        },
        {
          email: 'user2@test.com',
          username: 'user2',
          password_hash: 'hash2'
        },
        {
          email: 'user3@test.com',
          username: 'user3',
          password_hash: 'hash3'
        }
      ])
      .returning()
      .execute();

    testUser1Id = users[0].id;
    testUser2Id = users[1].id;
    testUser3Id = users[2].id;

    // Create test conversation between user1 and user2
    const conversations = await db.insert(conversationsTable)
      .values({
        user1_id: testUser1Id,
        user2_id: testUser2Id
      })
      .returning()
      .execute();

    testConversationId = conversations[0].id;

    // Create test file
    const files = await db.insert(filesTable)
      .values({
        original_name: 'test.txt',
        file_path: '/uploads/test.txt',
        file_size: 1024,
        mime_type: 'text/plain',
        uploaded_by: testUser1Id
      })
      .returning()
      .execute();

    testFileId = files[0].id;
  });

  it('should send a text message successfully', async () => {
    const input: SendMessageInput = {
      conversation_id: testConversationId,
      sender_id: testUser1Id,
      content: 'Hello, world!',
      message_type: 'text'
    };

    const result = await sendMessage(input);

    expect(result.conversation_id).toBe(testConversationId);
    expect(result.sender_id).toBe(testUser1Id);
    expect(result.content).toBe('Hello, world!');
    expect(result.message_type).toBe('text');
    expect(result.file_id).toBe(null);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should send a file message successfully', async () => {
    const input: SendMessageInput = {
      conversation_id: testConversationId,
      sender_id: testUser1Id,
      content: 'Shared a file',
      message_type: 'file',
      file_id: testFileId
    };

    const result = await sendMessage(input);

    expect(result.conversation_id).toBe(testConversationId);
    expect(result.sender_id).toBe(testUser1Id);
    expect(result.content).toBe('Shared a file');
    expect(result.message_type).toBe('file');
    expect(result.file_id).toBe(testFileId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save message to database', async () => {
    const input: SendMessageInput = {
      conversation_id: testConversationId,
      sender_id: testUser1Id,
      content: 'Test message',
      message_type: 'text'
    };

    const result = await sendMessage(input);

    // Verify message was saved to database
    const messages = await db.select()
      .from(messagesTable)
      .where(eq(messagesTable.id, result.id))
      .execute();

    expect(messages).toHaveLength(1);
    expect(messages[0].content).toBe('Test message');
    expect(messages[0].sender_id).toBe(testUser1Id);
    expect(messages[0].conversation_id).toBe(testConversationId);
  });

  it('should update conversation updated_at timestamp', async () => {
    // Get initial timestamp
    const initialConv = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, testConversationId))
      .execute();

    const initialUpdatedAt = initialConv[0].updated_at;

    // Wait a moment to ensure timestamp difference
    await new Promise(resolve => setTimeout(resolve, 10));

    const input: SendMessageInput = {
      conversation_id: testConversationId,
      sender_id: testUser1Id,
      content: 'Update timestamp test',
      message_type: 'text'
    };

    await sendMessage(input);

    // Check that updated_at was updated
    const updatedConv = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, testConversationId))
      .execute();

    expect(updatedConv[0].updated_at > initialUpdatedAt).toBe(true);
  });

  it('should allow user2 to send messages in the conversation', async () => {
    const input: SendMessageInput = {
      conversation_id: testConversationId,
      sender_id: testUser2Id,
      content: 'Message from user2',
      message_type: 'text'
    };

    const result = await sendMessage(input);

    expect(result.sender_id).toBe(testUser2Id);
    expect(result.content).toBe('Message from user2');
  });

  it('should throw error when conversation does not exist', async () => {
    const input: SendMessageInput = {
      conversation_id: 99999,
      sender_id: testUser1Id,
      content: 'Message to non-existent conversation',
      message_type: 'text'
    };

    await expect(sendMessage(input)).rejects.toThrow(/conversation not found/i);
  });

  it('should throw error when sender is not part of conversation', async () => {
    const input: SendMessageInput = {
      conversation_id: testConversationId,
      sender_id: testUser3Id, // user3 is not part of this conversation
      content: 'Unauthorized message',
      message_type: 'text'
    };

    await expect(sendMessage(input)).rejects.toThrow(/sender is not part of this conversation/i);
  });

  it('should throw error when file_id is missing for file messages', async () => {
    const input: SendMessageInput = {
      conversation_id: testConversationId,
      sender_id: testUser1Id,
      content: 'File message without file_id',
      message_type: 'file'
      // Missing file_id
    };

    await expect(sendMessage(input)).rejects.toThrow(/file_id is required for file messages/i);
  });

  it('should throw error when file does not exist', async () => {
    const input: SendMessageInput = {
      conversation_id: testConversationId,
      sender_id: testUser1Id,
      content: 'Message with non-existent file',
      message_type: 'file',
      file_id: 99999 // Non-existent file ID
    };

    await expect(sendMessage(input)).rejects.toThrow(/file not found/i);
  });

  it('should use default message_type when not specified', async () => {
    // Create input without message_type to test default behavior
    const rawInput = {
      conversation_id: testConversationId,
      sender_id: testUser1Id,
      content: 'Message with default type'
    };

    // Parse through Zod schema to apply defaults
    const { sendMessageInputSchema } = await import('../schema');
    const input = sendMessageInputSchema.parse(rawInput);

    const result = await sendMessage(input);

    expect(result.message_type).toBe('text');
  });

  it('should handle null file_id correctly for text messages', async () => {
    const input: SendMessageInput = {
      conversation_id: testConversationId,
      sender_id: testUser1Id,
      content: 'Text message',
      message_type: 'text',
      file_id: null
    };

    const result = await sendMessage(input);

    expect(result.file_id).toBe(null);
    expect(result.message_type).toBe('text');
  });
});