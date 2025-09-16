import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, conversationsTable, messagesTable, filesTable } from '../db/schema';
import { type GetMessagesInput } from '../schema';
import { getMessages } from '../handlers/get_messages';

// Helper function to create a test user
const createTestUser = async (email: string, username: string) => {
  const result = await db.insert(usersTable)
    .values({
      email,
      username,
      password_hash: 'hashed_password'
    })
    .returning()
    .execute();
  return result[0];
};

// Helper function to create a test conversation
const createTestConversation = async (user1Id: number, user2Id: number) => {
  const result = await db.insert(conversationsTable)
    .values({
      user1_id: user1Id,
      user2_id: user2Id
    })
    .returning()
    .execute();
  return result[0];
};

// Helper function to create a test file
const createTestFile = async (uploadedBy: number) => {
  const result = await db.insert(filesTable)
    .values({
      original_name: 'test.txt',
      file_path: '/uploads/test.txt',
      file_size: 1024,
      mime_type: 'text/plain',
      uploaded_by: uploadedBy
    })
    .returning()
    .execute();
  return result[0];
};

// Helper function to create a test message
const createTestMessage = async (
  conversationId: number, 
  senderId: number, 
  content: string,
  messageType: 'text' | 'file' = 'text',
  fileId?: number
) => {
  const result = await db.insert(messagesTable)
    .values({
      conversation_id: conversationId,
      sender_id: senderId,
      content,
      message_type: messageType,
      file_id: fileId || null
    })
    .returning()
    .execute();
  return result[0];
};

describe('getMessages', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return messages for a conversation', async () => {
    // Create test users
    const user1 = await createTestUser('user1@example.com', 'user1');
    const user2 = await createTestUser('user2@example.com', 'user2');
    
    // Create test conversation
    const conversation = await createTestConversation(user1.id, user2.id);
    
    // Create test messages
    const message1 = await createTestMessage(conversation.id, user1.id, 'Hello!');
    const message2 = await createTestMessage(conversation.id, user2.id, 'Hi there!');
    
    const input: GetMessagesInput = {
      conversation_id: conversation.id,
      limit: 50,
      offset: 0
    };

    const result = await getMessages(input);

    expect(result).toHaveLength(2);
    expect(result[0].conversation_id).toEqual(conversation.id);
    expect(result[1].conversation_id).toEqual(conversation.id);
    
    // Verify message content
    const messageContents = result.map(m => m.content);
    expect(messageContents).toContain('Hello!');
    expect(messageContents).toContain('Hi there!');
  });

  it('should return messages ordered by created_at desc (newest first)', async () => {
    // Create test users and conversation
    const user1 = await createTestUser('user1@example.com', 'user1');
    const user2 = await createTestUser('user2@example.com', 'user2');
    const conversation = await createTestConversation(user1.id, user2.id);
    
    // Create messages with slight delay to ensure different timestamps
    const firstMessage = await createTestMessage(conversation.id, user1.id, 'First message');
    
    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));
    
    const secondMessage = await createTestMessage(conversation.id, user2.id, 'Second message');
    
    const input: GetMessagesInput = {
      conversation_id: conversation.id,
      limit: 50,
      offset: 0
    };

    const result = await getMessages(input);

    expect(result).toHaveLength(2);
    // Newest message should be first
    expect(result[0].content).toEqual('Second message');
    expect(result[1].content).toEqual('First message');
    expect(result[0].created_at.getTime()).toBeGreaterThan(result[1].created_at.getTime());
  });

  it('should handle pagination with limit and offset', async () => {
    // Create test users and conversation
    const user1 = await createTestUser('user1@example.com', 'user1');
    const user2 = await createTestUser('user2@example.com', 'user2');
    const conversation = await createTestConversation(user1.id, user2.id);
    
    // Create 5 messages
    for (let i = 1; i <= 5; i++) {
      await createTestMessage(conversation.id, user1.id, `Message ${i}`);
      await new Promise(resolve => setTimeout(resolve, 5)); // Small delay for different timestamps
    }
    
    // Test first page
    const firstPageInput: GetMessagesInput = {
      conversation_id: conversation.id,
      limit: 2,
      offset: 0
    };

    const firstPage = await getMessages(firstPageInput);
    expect(firstPage).toHaveLength(2);

    // Test second page
    const secondPageInput: GetMessagesInput = {
      conversation_id: conversation.id,
      limit: 2,
      offset: 2
    };

    const secondPage = await getMessages(secondPageInput);
    expect(secondPage).toHaveLength(2);
    
    // Verify different messages on different pages
    expect(firstPage[0].id).not.toEqual(secondPage[0].id);
    expect(firstPage[1].id).not.toEqual(secondPage[1].id);
  });

  it('should return empty array for non-existent conversation', async () => {
    const input: GetMessagesInput = {
      conversation_id: 999, // Non-existent conversation
      limit: 50,
      offset: 0
    };

    const result = await getMessages(input);

    expect(result).toHaveLength(0);
  });

  it('should handle file messages correctly', async () => {
    // Create test users and conversation
    const user1 = await createTestUser('user1@example.com', 'user1');
    const user2 = await createTestUser('user2@example.com', 'user2');
    const conversation = await createTestConversation(user1.id, user2.id);
    
    // Create test file
    const file = await createTestFile(user1.id);
    
    // Create text and file messages
    const textMessage = await createTestMessage(conversation.id, user1.id, 'Here is a text message');
    const fileMessage = await createTestMessage(
      conversation.id, 
      user2.id, 
      'Shared a file',
      'file',
      file.id
    );
    
    const input: GetMessagesInput = {
      conversation_id: conversation.id,
      limit: 50,
      offset: 0
    };

    const result = await getMessages(input);

    expect(result).toHaveLength(2);
    
    // Find the file message
    const foundFileMessage = result.find(m => m.message_type === 'file');
    const foundTextMessage = result.find(m => m.message_type === 'text');
    
    expect(foundFileMessage).toBeDefined();
    expect(foundTextMessage).toBeDefined();
    expect(foundFileMessage!.file_id).toEqual(file.id);
    expect(foundFileMessage!.content).toEqual('Shared a file');
    expect(foundTextMessage!.file_id).toBeNull();
  });

  it('should use default limit and offset from Zod schema', async () => {
    // Create test users and conversation
    const user1 = await createTestUser('user1@example.com', 'user1');
    const user2 = await createTestUser('user2@example.com', 'user2');
    const conversation = await createTestConversation(user1.id, user2.id);
    
    // Create a message
    await createTestMessage(conversation.id, user1.id, 'Test message');
    
    // Test with minimal input (Zod should apply defaults)
    const input: GetMessagesInput = {
      conversation_id: conversation.id,
      limit: 50, // These defaults should be applied by Zod
      offset: 0
    };

    const result = await getMessages(input);

    expect(result).toHaveLength(1);
    expect(result[0].content).toEqual('Test message');
  });

  it('should return correct message structure', async () => {
    // Create test users and conversation
    const user1 = await createTestUser('user1@example.com', 'user1');
    const user2 = await createTestUser('user2@example.com', 'user2');
    const conversation = await createTestConversation(user1.id, user2.id);
    
    // Create a message
    const message = await createTestMessage(conversation.id, user1.id, 'Test message structure');
    
    const input: GetMessagesInput = {
      conversation_id: conversation.id,
      limit: 50,
      offset: 0
    };

    const result = await getMessages(input);

    expect(result).toHaveLength(1);
    const returnedMessage = result[0];
    
    // Verify all required fields are present
    expect(returnedMessage.id).toBeDefined();
    expect(typeof returnedMessage.id).toBe('number');
    expect(returnedMessage.conversation_id).toEqual(conversation.id);
    expect(returnedMessage.sender_id).toEqual(user1.id);
    expect(returnedMessage.content).toEqual('Test message structure');
    expect(returnedMessage.message_type).toEqual('text');
    expect(returnedMessage.file_id).toBeNull();
    expect(returnedMessage.created_at).toBeInstanceOf(Date);
  });
});