import { db } from '../db';
import { filesTable, usersTable } from '../db/schema';
import { type UploadFileInput, type File } from '../schema';
import { eq } from 'drizzle-orm';

export const uploadFile = async (input: UploadFileInput): Promise<File> => {
  try {
    // Verify that the user exists
    const user = await db.select()
      .from(usersTable)
      .where(eq(usersTable.id, input.uploaded_by))
      .execute();

    if (user.length === 0) {
      throw new Error('User not found');
    }

    // Insert file record
    const result = await db.insert(filesTable)
      .values({
        original_name: input.original_name,
        file_path: input.file_path,
        file_size: input.file_size,
        mime_type: input.mime_type,
        uploaded_by: input.uploaded_by
      })
      .returning()
      .execute();

    const file = result[0];
    return file;
  } catch (error) {
    console.error('File upload failed:', error);
    throw error;
  }
};