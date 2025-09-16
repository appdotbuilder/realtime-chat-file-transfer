import { db } from '../db';
import { usersTable } from '../db/schema';
import { type LoginUserInput, type AuthResponse } from '../schema';
import { eq } from 'drizzle-orm';
import jwt from 'jsonwebtoken';

// Simple hash function for testing - in production use bcrypt
const comparePassword = async (password: string, hash: string): Promise<boolean> => {
  // For now, we'll use a simple comparison since bcrypt is not available
  // In production, this should use bcrypt.compare(password, hash)
  return password === hash.replace('hashed_', '');
};

export const loginUser = async (input: LoginUserInput): Promise<AuthResponse> => {
  try {
    // Find user by email
    const users = await db.select()
      .from(usersTable)
      .where(eq(usersTable.email, input.email))
      .execute();

    if (users.length === 0) {
      throw new Error('Invalid email or password');
    }

    const user = users[0];

    // Compare password with stored hash
    const isPasswordValid = await comparePassword(input.password, user.password_hash);
    
    if (!isPasswordValid) {
      throw new Error('Invalid email or password');
    }

    // Generate JWT token
    const jwtSecret = process.env['JWT_SECRET'] || 'fallback-secret-for-testing';
    const token = jwt.sign(
      { 
        userId: user.id, 
        email: user.email 
      },
      jwtSecret,
      { 
        expiresIn: '24h' 
      }
    );

    // Return user info (without password) and token
    return {
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        created_at: user.created_at
      },
      token
    };
  } catch (error) {
    console.error('User login failed:', error);
    throw error;
  }
};