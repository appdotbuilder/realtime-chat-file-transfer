import { db } from '../db';
import { filesTable, messagesTable, conversationsTable } from '../db/schema';
import { type File } from '../schema';
import { eq, or, and } from 'drizzle-orm';

export async function getFileInfo(fileId: number, userId: number): Promise<File> {
  try {
    // First, get the file record
    const fileResults = await db.select()
      .from(filesTable)
      .where(eq(filesTable.id, fileId))
      .execute();

    if (fileResults.length === 0) {
      throw new Error('File not found');
    }

    const file = fileResults[0];

    // Check if user has access to this file by verifying:
    // 1. User uploaded the file, OR
    // 2. File is referenced in a message within a conversation the user is part of
    
    // First check if user uploaded the file
    if (file.uploaded_by === userId) {
      return file;
    }

    // Check if file is used in any message within conversations the user is part of
    const accessResults = await db.select()
      .from(messagesTable)
      .innerJoin(conversationsTable, eq(messagesTable.conversation_id, conversationsTable.id))
      .where(
        and(
          eq(messagesTable.file_id, fileId),
          or(
            eq(conversationsTable.user1_id, userId),
            eq(conversationsTable.user2_id, userId)
          )
        )
      )
      .execute();

    if (accessResults.length === 0) {
      throw new Error('Access denied: User does not have permission to view this file');
    }

    return file;
  } catch (error) {
    console.error('Get file info failed:', error);
    throw error;
  }
}