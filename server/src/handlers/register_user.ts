import { password } from 'bun';
import { db } from '../db';
import { usersTable } from '../db/schema';
import { type RegisterUserInput, type AuthResponse } from '../schema';
import { eq, or } from 'drizzle-orm';

export async function registerUser(input: RegisterUserInput): Promise<AuthResponse> {
  try {
    // Check if user already exists with same email or username
    const existingUsers = await db.select()
      .from(usersTable)
      .where(or(
        eq(usersTable.email, input.email),
        eq(usersTable.username, input.username)
      ))
      .execute();

    if (existingUsers.length > 0) {
      const existingUser = existingUsers[0];
      if (existingUser.email === input.email) {
        throw new Error('Email already exists');
      }
      if (existingUser.username === input.username) {
        throw new Error('Username already exists');
      }
    }

    // Hash password using Bun's built-in password utilities
    const passwordHash = await password.hash(input.password);

    // Create user in database
    const result = await db.insert(usersTable)
      .values({
        email: input.email,
        username: input.username,
        password_hash: passwordHash
      })
      .returning()
      .execute();

    const newUser = result[0];

    // Generate simple token (in production, use proper JWT library)
    const jwtSecret = process.env['JWT_SECRET'] || 'default-secret-key';
    const tokenData = {
      userId: newUser.id,
      email: newUser.email,
      exp: Date.now() + (24 * 60 * 60 * 1000) // 24 hours from now
    };
    const tokenString = JSON.stringify(tokenData);
    const signature = await password.hash(tokenString + jwtSecret);
    const token = btoa(tokenString) + '.' + signature.slice(0, 32);

    // Return user info (without password) and token
    return {
      user: {
        id: newUser.id,
        email: newUser.email,
        username: newUser.username,
        created_at: newUser.created_at
      },
      token
    };
  } catch (error) {
    console.error('User registration failed:', error);
    throw error;
  }
}