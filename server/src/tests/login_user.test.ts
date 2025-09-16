import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginUserInput } from '../schema';
import { loginUser } from '../handlers/login_user';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

// Simple hash function for testing - matches the one in handler
const hashPassword = (password: string): string => {
  return `hashed_${password}`;
};

// Test user data
const testUser = {
  email: 'test@example.com',
  username: 'testuser',
  password: 'password123'
};

const validLoginInput: LoginUserInput = {
  email: 'test@example.com',
  password: 'password123'
};

describe('loginUser', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  beforeEach(async () => {
    // Create test user with hashed password
    const passwordHash = hashPassword(testUser.password);
    await db.insert(usersTable)
      .values({
        email: testUser.email,
        username: testUser.username,
        password_hash: passwordHash
      })
      .execute();
  });

  it('should successfully login with valid credentials', async () => {
    const result = await loginUser(validLoginInput);

    // Verify user data
    expect(result.user.email).toEqual(testUser.email);
    expect(result.user.username).toEqual(testUser.username);
    expect(result.user.id).toBeDefined();
    expect(result.user.created_at).toBeInstanceOf(Date);
    expect(result.user).not.toHaveProperty('password_hash');

    // Verify token
    expect(result.token).toBeDefined();
    expect(typeof result.token).toBe('string');

    // Verify token can be decoded
    const jwtSecret = process.env['JWT_SECRET'] || 'fallback-secret-for-testing';
    const decoded = jwt.verify(result.token, jwtSecret) as any;
    expect(decoded.userId).toEqual(result.user.id);
    expect(decoded.email).toEqual(testUser.email);
    expect(decoded.exp).toBeDefined(); // Should have expiration
  });

  it('should throw error for non-existent email', async () => {
    const invalidInput: LoginUserInput = {
      email: 'nonexistent@example.com',
      password: 'password123'
    };

    await expect(loginUser(invalidInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should throw error for wrong password', async () => {
    const invalidInput: LoginUserInput = {
      email: testUser.email,
      password: 'wrongpassword'
    };

    await expect(loginUser(invalidInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should throw error for empty password', async () => {
    const invalidInput: LoginUserInput = {
      email: testUser.email,
      password: ''
    };

    await expect(loginUser(invalidInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should handle case-sensitive email correctly', async () => {
    const invalidInput: LoginUserInput = {
      email: 'TEST@EXAMPLE.COM', // Different case
      password: testUser.password
    };

    await expect(loginUser(invalidInput)).rejects.toThrow(/invalid email or password/i);
  });

  it('should generate unique tokens for multiple logins', async () => {
    const result1 = await loginUser(validLoginInput);
    
    // Wait for at least 1 second to ensure different timestamps in JWT
    await new Promise(resolve => setTimeout(resolve, 1100));
    
    const result2 = await loginUser(validLoginInput);

    expect(result1.token).not.toEqual(result2.token);
    
    // Both tokens should be valid
    const jwtSecret = process.env['JWT_SECRET'] || 'fallback-secret-for-testing';
    const decoded1 = jwt.verify(result1.token, jwtSecret) as any;
    const decoded2 = jwt.verify(result2.token, jwtSecret) as any;
    
    // Verify different issued at timestamps
    expect(decoded1.iat).not.toEqual(decoded2.iat);
    expect(decoded2.iat).toBeGreaterThan(decoded1.iat);
  });

  it('should verify user exists in database after login', async () => {
    const result = await loginUser(validLoginInput);

    // Query database to verify user exists
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, result.user.id))
      .execute();

    expect(users).toHaveLength(1);
    expect(users[0].email).toEqual(testUser.email);
    expect(users[0].username).toEqual(testUser.username);
    expect(users[0].created_at).toBeInstanceOf(Date);
  });
});