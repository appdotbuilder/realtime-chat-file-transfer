import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { conversationsTable, usersTable } from '../db/schema';
import { type CreateConversationInput } from '../schema';
import { createConversation } from '../handlers/create_conversation';
import { eq, or, and } from 'drizzle-orm';

describe('createConversation', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let user1Id: number;
  let user2Id: number;
  let user3Id: number;

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

    user1Id = users[0].id;
    user2Id = users[1].id;
    user3Id = users[2].id;
  });

  const testInput: CreateConversationInput = {
    user1_id: 0, // Will be set in each test
    user2_id: 0  // Will be set in each test
  };

  it('should create a new conversation between two users', async () => {
    const input = { user1_id: user1Id, user2_id: user2Id };
    const result = await createConversation(input);

    // Verify conversation properties
    expect(result.user1_id).toEqual(user1Id);
    expect(result.user2_id).toEqual(user2Id);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
    expect(result.updated_at).toBeInstanceOf(Date);
  });

  it('should save conversation to database', async () => {
    const input = { user1_id: user1Id, user2_id: user2Id };
    const result = await createConversation(input);

    // Verify conversation was saved
    const conversations = await db.select()
      .from(conversationsTable)
      .where(eq(conversationsTable.id, result.id))
      .execute();

    expect(conversations).toHaveLength(1);
    expect(conversations[0].user1_id).toEqual(user1Id);
    expect(conversations[0].user2_id).toEqual(user2Id);
    expect(conversations[0].created_at).toBeInstanceOf(Date);
    expect(conversations[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return existing conversation if it already exists (same order)', async () => {
    // Create first conversation
    const input = { user1_id: user1Id, user2_id: user2Id };
    const firstResult = await createConversation(input);

    // Try to create same conversation again
    const secondResult = await createConversation(input);

    // Should return the same conversation
    expect(secondResult.id).toEqual(firstResult.id);
    expect(secondResult.user1_id).toEqual(firstResult.user1_id);
    expect(secondResult.user2_id).toEqual(firstResult.user2_id);

    // Verify only one conversation exists in database
    const conversations = await db.select()
      .from(conversationsTable)
      .where(or(
        and(
          eq(conversationsTable.user1_id, user1Id),
          eq(conversationsTable.user2_id, user2Id)
        ),
        and(
          eq(conversationsTable.user1_id, user2Id),
          eq(conversationsTable.user2_id, user1Id)
        )
      ))
      .execute();

    expect(conversations).toHaveLength(1);
  });

  it('should return existing conversation if it already exists (reverse order)', async () => {
    // Create conversation with user1 -> user2
    const firstInput = { user1_id: user1Id, user2_id: user2Id };
    const firstResult = await createConversation(firstInput);

    // Try to create conversation with user2 -> user1 (reverse order)
    const secondInput = { user1_id: user2Id, user2_id: user1Id };
    const secondResult = await createConversation(secondInput);

    // Should return the same conversation
    expect(secondResult.id).toEqual(firstResult.id);

    // Verify only one conversation exists in database
    const conversations = await db.select()
      .from(conversationsTable)
      .where(or(
        and(
          eq(conversationsTable.user1_id, user1Id),
          eq(conversationsTable.user2_id, user2Id)
        ),
        and(
          eq(conversationsTable.user1_id, user2Id),
          eq(conversationsTable.user2_id, user1Id)
        )
      ))
      .execute();

    expect(conversations).toHaveLength(1);
  });

  it('should allow creating different conversations with different users', async () => {
    // Create conversation between user1 and user2
    const input1 = { user1_id: user1Id, user2_id: user2Id };
    const result1 = await createConversation(input1);

    // Create conversation between user1 and user3
    const input2 = { user1_id: user1Id, user2_id: user3Id };
    const result2 = await createConversation(input2);

    // Should be different conversations
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.user2_id).toEqual(user2Id);
    expect(result2.user2_id).toEqual(user3Id);

    // Verify both conversations exist in database
    const allConversations = await db.select()
      .from(conversationsTable)
      .execute();

    expect(allConversations).toHaveLength(2);
  });

  it('should throw error when user tries to chat with themselves', async () => {
    const input = { user1_id: user1Id, user2_id: user1Id };

    await expect(createConversation(input)).rejects.toThrow(/cannot create conversation with yourself/i);
  });

  it('should throw error when first user does not exist', async () => {
    const nonExistentUserId = 99999;
    const input = { user1_id: nonExistentUserId, user2_id: user2Id };

    await expect(createConversation(input)).rejects.toThrow(/one or both users do not exist/i);
  });

  it('should throw error when second user does not exist', async () => {
    const nonExistentUserId = 99999;
    const input = { user1_id: user1Id, user2_id: nonExistentUserId };

    await expect(createConversation(input)).rejects.toThrow(/one or both users do not exist/i);
  });

  it('should throw error when both users do not exist', async () => {
    const nonExistentUserId1 = 99999;
    const nonExistentUserId2 = 88888;
    const input = { user1_id: nonExistentUserId1, user2_id: nonExistentUserId2 };

    await expect(createConversation(input)).rejects.toThrow(/one or both users do not exist/i);
  });
});