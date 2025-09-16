import { db } from '../db';
import { filesTable, messagesTable, conversationsTable } from '../db/schema';
import { type File } from '../schema';
import { eq, or, and } from 'drizzle-orm';
import { existsSync } from 'fs';

export async function downloadFile(fileId: number, userId: number): Promise<File> {
  try {
    // 1. Find file record in database by ID
    const fileResults = await db.select()
      .from(filesTable)
      .where(eq(filesTable.id, fileId))
      .execute();

    if (fileResults.length === 0) {
      throw new Error('File not found');
    }

    const file = fileResults[0];

    // 2. Verify user has access to this file (through conversation messages)
    // User has access if:
    // - They uploaded the file, OR
    // - The file was used in a message in a conversation they participate in
    const hasAccess = file.uploaded_by === userId;

    if (!hasAccess) {
      // Check if user has access through conversations
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
        throw new Error('Access denied');
      }
    }

    // 3. Check if file still exists on disk/storage
    if (!existsSync(file.file_path)) {
      throw new Error('File not found on disk');
    }

    // 4. Log download activity for security/audit purposes
    console.log(`File download: User ${userId} downloading file ${fileId} (${file.original_name})`);

    // 5. Return file metadata and path for download
    return {
      id: file.id,
      original_name: file.original_name,
      file_path: file.file_path,
      file_size: file.file_size,
      mime_type: file.mime_type,
      uploaded_by: file.uploaded_by,
      created_at: file.created_at
    };
  } catch (error) {
    console.error('File download failed:', error);
    throw error;
  }
}