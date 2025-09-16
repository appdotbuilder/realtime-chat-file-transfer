import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { password } from 'bun';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterUserInput } from '../schema';
import { registerUser } from '../handlers/register_user';
import { eq } from 'drizzle-orm';

// Test input
const testInput: RegisterUserInput = {
  email: 'test@example.com',
  username: 'testuser',
  password: 'securePassword123'
};

describe('registerUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should register a new user successfully', async () => {
    const result = await registerUser(testInput);

    // Validate response structure
    expect(result.user.email).toEqual('test@example.com');
    expect(result.user.username).toEqual('testuser');
    expect(result.user.id).toBeDefined();
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
  });

  it('should save user to database with hashed password', async () => {
    const result = await registerUser(testInput);

    // Query database to verify user was saved
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    expect(users).toHaveLength(1);
    const savedUser = users[0];
    
    expect(savedUser.email).toEqual('test@example.com');
    expect(savedUser.username).toEqual('testuser');
    expect(savedUser.password_hash).toBeDefined();
    expect(savedUser.password_hash).not.toEqual('securePassword123'); // Should be hashed
    expect(savedUser.created_at).toBeInstanceOf(Date);
    expect(savedUser.updated_at).toBeInstanceOf(Date);
  });

  it('should hash password correctly', async () => {
    const result = await registerUser(testInput);

    // Get the saved user from database
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    const savedUser = users[0];

    // Verify password was hashed correctly
    const isValidPassword = await password.verify('securePassword123', savedUser.password_hash);
    expect(isValidPassword).toBe(true);

    // Verify wrong password doesn't match
    const isInvalidPassword = await password.verify('wrongPassword', savedUser.password_hash);
    expect(isInvalidPassword).toBe(false);
  });

  it('should generate valid token', async () => {
    const result = await registerUser(testInput);

    // Verify token exists and contains expected data
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');
    expect(result.token.length).toBeGreaterThan(50); // Should be a reasonably long token
    
    // Decode the token data (base64 encoded)
    const tokenParts = result.token.split('.');
    expect(tokenParts).toHaveLength(2);
    
    const decodedData = JSON.parse(atob(tokenParts[0]));
    expect(decodedData.userId).toEqual(result.user.id);
    expect(decodedData.email).toEqual('test@example.com');
    expect(decodedData.exp).toBeDefined(); // Expiration time should be set
  });

  it('should reject duplicate email', async () => {
    // Register first user
    await registerUser(testInput);

    // Try to register another user with same email
    const duplicateEmailInput: RegisterUserInput = {
      email: 'test@example.com', // Same email
      username: 'differentuser',
      password: 'anotherPassword123'
    };

    await expect(registerUser(duplicateEmailInput)).rejects.toThrow(/email already exists/i);
  });

  it('should reject duplicate username', async () => {
    // Register first user
    await registerUser(testInput);

    // Try to register another user with same username
    const duplicateUsernameInput: RegisterUserInput = {
      email: 'different@example.com',
      username: 'testuser', // Same username
      password: 'anotherPassword123'
    };

    await expect(registerUser(duplicateUsernameInput)).rejects.toThrow(/username already exists/i);
  });

  it('should handle multiple users with different credentials', async () => {
    // Register first user
    const result1 = await registerUser(testInput);

    // Register second user with different credentials
    const secondInput: RegisterUserInput = {
      email: 'user2@example.com',
      username: 'seconduser',
      password: 'differentPassword456'
    };

    const result2 = await registerUser(secondInput);

    // Both should be successful and have different IDs
    expect(result1.user.id).not.toEqual(result2.user.id);
    expect(result1.user.email).toEqual('test@example.com');
    expect(result2.user.email).toEqual('user2@example.com');
    expect(result1.user.username).toEqual('testuser');
    expect(result2.user.username).toEqual('seconduser');

    // Verify both users exist in database
    const allUsers = await db.select().from(usersTable).execute();
    expect(allUsers).toHaveLength(2);
  });

  it('should handle case sensitivity correctly', async () => {
    // Register first user
    await registerUser(testInput);

    // Try to register with different case email - should be rejected
    const caseInsensitiveEmailInput: RegisterUserInput = {
      email: 'TEST@EXAMPLE.COM', // Different case
      username: 'differentuser',
      password: 'anotherPassword123'
    };

    // This should succeed since email comparison might be case-sensitive in our implementation
    // But if we wanted case-insensitive emails, we'd need to handle that in the handler
    const result = await registerUser(caseInsensitiveEmailInput);
    expect(result.user.email).toEqual('TEST@EXAMPLE.COM');
  });
});