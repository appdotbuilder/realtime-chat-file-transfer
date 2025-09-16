import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, conversationsTable } from '../db/schema';
import { type GetConversationsInput } from '../schema';
import { getConversations } from '../handlers/get_conversations';
import { eq } from 'drizzle-orm';

describe('getConversations', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return empty array when user has no conversations', async () => {
    // Create a user with no conversations
    const userResult = await db.insert(usersTable)
      .values({
        email: 'test@example.com',
        username: 'testuser',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;
    const input: GetConversationsInput = { user_id: userId };

    const result = await getConversations(input);

    expect(result).toHaveLength(0);
  });

  it('should return conversations where user is user1', async () => {
    // Create test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        username: 'user1',
        password_hash: 'hashed_password1'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        username: 'user2',
        password_hash: 'hashed_password2'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create conversation with user1 as user1_id
    const conversationResult = await db.insert(conversationsTable)
      .values({
        user1_id: user1Id,
        user2_id: user2Id
      })
      .returning()
      .execute();

    const input: GetConversationsInput = { user_id: user1Id };
    const result = await getConversations(input);

    expect(result).toHaveLength(1);
    expect(result[0].user1_id).toEqual(user1Id);
    expect(result[0].user2_id).toEqual(user2Id);
    expect(result[0].id).toEqual(conversationResult[0].id);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return conversations where user is user2', async () => {
    // Create test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        username: 'user1',
        password_hash: 'hashed_password1'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        username: 'user2',
        password_hash: 'hashed_password2'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create conversation with user2 as user2_id
    const conversationResult = await db.insert(conversationsTable)
      .values({
        user1_id: user1Id,
        user2_id: user2Id
      })
      .returning()
      .execute();

    const input: GetConversationsInput = { user_id: user2Id };
    const result = await getConversations(input);

    expect(result).toHaveLength(1);
    expect(result[0].user1_id).toEqual(user1Id);
    expect(result[0].user2_id).toEqual(user2Id);
    expect(result[0].id).toEqual(conversationResult[0].id);
    expect(result[0].created_at).toBeInstanceOf(Date);
    expect(result[0].updated_at).toBeInstanceOf(Date);
  });

  it('should return multiple conversations for a user', async () => {
    // Create test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        username: 'user1',
        password_hash: 'hashed_password1'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        username: 'user2',
        password_hash: 'hashed_password2'
      })
      .returning()
      .execute();

    const user3Result = await db.insert(usersTable)
      .values({
        email: 'user3@example.com',
        username: 'user3',
        password_hash: 'hashed_password3'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;
    const user3Id = user3Result[0].id;

    // Create multiple conversations involving user1
    await db.insert(conversationsTable)
      .values([
        {
          user1_id: user1Id,
          user2_id: user2Id
        },
        {
          user1_id: user2Id,
          user2_id: user1Id
        },
        {
          user1_id: user1Id,
          user2_id: user3Id
        }
      ])
      .execute();

    const input: GetConversationsInput = { user_id: user1Id };
    const result = await getConversations(input);

    expect(result).toHaveLength(3);
    
    // Verify each conversation involves user1
    result.forEach(conversation => {
      expect(
        conversation.user1_id === user1Id || conversation.user2_id === user1Id
      ).toBe(true);
      expect(conversation.created_at).toBeInstanceOf(Date);
      expect(conversation.updated_at).toBeInstanceOf(Date);
    });
  });

  it('should return conversations ordered by updated_at desc', async () => {
    // Create test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        username: 'user1',
        password_hash: 'hashed_password1'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        username: 'user2',
        password_hash: 'hashed_password2'
      })
      .returning()
      .execute();

    const user3Result = await db.insert(usersTable)
      .values({
        email: 'user3@example.com',
        username: 'user3',
        password_hash: 'hashed_password3'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;
    const user3Id = user3Result[0].id;

    // Create conversations with different creation times
    const conversation1Result = await db.insert(conversationsTable)
      .values({
        user1_id: user1Id,
        user2_id: user2Id
      })
      .returning()
      .execute();

    // Wait a bit to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10));

    const conversation2Result = await db.insert(conversationsTable)
      .values({
        user1_id: user1Id,
        user2_id: user3Id
      })
      .returning()
      .execute();

    // Update the first conversation to have a newer updated_at
    await db.update(conversationsTable)
      .set({ updated_at: new Date() })
      .where(eq(conversationsTable.id, conversation1Result[0].id))
      .execute();

    const input: GetConversationsInput = { user_id: user1Id };
    const result = await getConversations(input);

    expect(result).toHaveLength(2);
    
    // Verify ordering - most recently updated should be first
    expect(result[0].updated_at >= result[1].updated_at).toBe(true);
  });

  it('should not return conversations for other users', async () => {
    // Create test users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        username: 'user1',
        password_hash: 'hashed_password1'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        username: 'user2',
        password_hash: 'hashed_password2'
      })
      .returning()
      .execute();

    const user3Result = await db.insert(usersTable)
      .values({
        email: 'user3@example.com',
        username: 'user3',
        password_hash: 'hashed_password3'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;
    const user3Id = user3Result[0].id;

    // Create conversation between user2 and user3 (not involving user1)
    await db.insert(conversationsTable)
      .values({
        user1_id: user2Id,
        user2_id: user3Id
      })
      .execute();

    const input: GetConversationsInput = { user_id: user1Id };
    const result = await getConversations(input);

    expect(result).toHaveLength(0);
  });
});