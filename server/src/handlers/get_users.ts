import { db } from '../db';
import { usersTable } from '../db/schema';
import { type GetUsersInput, type PublicUser } from '../schema';
import { and, or, ilike, ne, type SQL } from 'drizzle-orm';

export const getUsers = async (input: GetUsersInput): Promise<PublicUser[]> => {
  try {
    // Build conditions array
    const conditions: SQL<unknown>[] = [];

    // Add search filter if provided
    if (input.search) {
      const searchTerm = `%${input.search}%`;
      conditions.push(
        or(
          ilike(usersTable.username, searchTerm),
          ilike(usersTable.email, searchTerm)
        )!
      );
    }

    // Exclude the requesting user if specified
    if (input.exclude_user_id !== undefined) {
      conditions.push(ne(usersTable.id, input.exclude_user_id));
    }

    // Build and execute query
    const baseQuery = db.select({
      id: usersTable.id,
      email: usersTable.email,
      username: usersTable.username,
      created_at: usersTable.created_at
    }).from(usersTable);

    const results = conditions.length > 0
      ? await baseQuery
          .where(conditions.length === 1 ? conditions[0] : and(...conditions))
          .limit(100)
          .execute()
      : await baseQuery.limit(100).execute();

    return results;
  } catch (error) {
    console.error('Get users failed:', error);
    throw error;
  }
};