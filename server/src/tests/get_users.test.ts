import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type GetUsersInput } from '../schema';
import { getUsers } from '../handlers/get_users';

// Test users data
const testUsers = [
  {
    email: 'alice@example.com',
    username: 'alice123',
    password_hash: 'hashed_password_1'
  },
  {
    email: 'bob@example.com',
    username: 'bobby',
    password_hash: 'hashed_password_2'
  },
  {
    email: 'charlie@example.com',
    username: 'charlie_dev',
    password_hash: 'hashed_password_3'
  },
  {
    email: 'diana@test.com',
    username: 'diana_admin',
    password_hash: 'hashed_password_4'
  }
];

describe('getUsers', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return all users when no filters are provided', async () => {
    // Create test users
    await db.insert(usersTable).values(testUsers).execute();

    const input: GetUsersInput = {};
    const result = await getUsers(input);

    expect(result).toHaveLength(4);
    expect(result[0]).toHaveProperty('id');
    expect(result[0]).toHaveProperty('email');
    expect(result[0]).toHaveProperty('username');
    expect(result[0]).toHaveProperty('created_at');
    expect(result[0]).not.toHaveProperty('password_hash'); // Sensitive data should be excluded
    expect(result[0].created_at).toBeInstanceOf(Date);
  });

  it('should return empty array when no users exist', async () => {
    const input: GetUsersInput = {};
    const result = await getUsers(input);

    expect(result).toHaveLength(0);
  });

  it('should filter users by username search term', async () => {
    await db.insert(usersTable).values(testUsers).execute();

    const input: GetUsersInput = {
      search: 'alice'
    };
    const result = await getUsers(input);

    expect(result).toHaveLength(1);
    expect(result[0].username).toEqual('alice123');
    expect(result[0].email).toEqual('alice@example.com');
  });

  it('should filter users by email search term', async () => {
    await db.insert(usersTable).values(testUsers).execute();

    const input: GetUsersInput = {
      search: 'test.com'
    };
    const result = await getUsers(input);

    expect(result).toHaveLength(1);
    expect(result[0].email).toEqual('diana@test.com');
  });

  it('should perform case-insensitive search', async () => {
    await db.insert(usersTable).values(testUsers).execute();

    const input: GetUsersInput = {
      search: 'ALICE'
    };
    const result = await getUsers(input);

    expect(result).toHaveLength(1);
    expect(result[0].username).toEqual('alice123');
  });

  it('should find partial matches in username and email', async () => {
    await db.insert(usersTable).values(testUsers).execute();

    const input: GetUsersInput = {
      search: 'bob'
    };
    const result = await getUsers(input);

    expect(result).toHaveLength(1); // Only 'bobby' username matches
    expect(result[0].username).toEqual('bobby');
    expect(result[0].email).toEqual('bob@example.com');
  });

  it('should exclude specified user from results', async () => {
    const insertResult = await db.insert(usersTable).values(testUsers).returning().execute();
    const userToExclude = insertResult[0];

    const input: GetUsersInput = {
      exclude_user_id: userToExclude.id
    };
    const result = await getUsers(input);

    expect(result).toHaveLength(3);
    expect(result.find(u => u.id === userToExclude.id)).toBeUndefined();
  });

  it('should combine search and exclude filters', async () => {
    const insertResult = await db.insert(usersTable).values(testUsers).returning().execute();
    const userToExclude = insertResult.find(u => u.username === 'bobby')!;

    const input: GetUsersInput = {
      search: 'example.com',
      exclude_user_id: userToExclude.id
    };
    const result = await getUsers(input);

    expect(result).toHaveLength(2); // alice and charlie, but not bob
    const usernames = result.map(u => u.username).sort();
    expect(usernames).toEqual(['alice123', 'charlie_dev']);
    expect(result.find(u => u.id === userToExclude.id)).toBeUndefined();
  });

  it('should return empty array when search matches no users', async () => {
    await db.insert(usersTable).values(testUsers).execute();

    const input: GetUsersInput = {
      search: 'nonexistent'
    };
    const result = await getUsers(input);

    expect(result).toHaveLength(0);
  });

  it('should handle exclude_user_id that does not exist', async () => {
    await db.insert(usersTable).values(testUsers).execute();

    const input: GetUsersInput = {
      exclude_user_id: 99999 // Non-existent user ID
    };
    const result = await getUsers(input);

    expect(result).toHaveLength(4); // All users returned since ID doesn't exist
  });

  it('should limit results to prevent performance issues', async () => {
    // Create more than 100 users to test the limit
    const manyUsers = Array.from({ length: 105 }, (_, i) => ({
      email: `user${i}@example.com`,
      username: `user${i}`,
      password_hash: `hashed_password_${i}`
    }));

    await db.insert(usersTable).values(manyUsers).execute();

    const input: GetUsersInput = {};
    const result = await getUsers(input);

    expect(result).toHaveLength(100); // Should be limited to 100
  });

  it('should return users with correct field types', async () => {
    await db.insert(usersTable).values([testUsers[0]]).execute();

    const input: GetUsersInput = {};
    const result = await getUsers(input);

    expect(result).toHaveLength(1);
    const user = result[0];
    expect(typeof user.id).toBe('number');
    expect(typeof user.email).toBe('string');
    expect(typeof user.username).toBe('string');
    expect(user.created_at).toBeInstanceOf(Date);
  });
});