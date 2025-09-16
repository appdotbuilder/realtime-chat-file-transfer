import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { filesTable, usersTable } from '../db/schema';
import { type UploadFileInput } from '../schema';
import { uploadFile } from '../handlers/upload_file';
import { eq } from 'drizzle-orm';

// Test user data
const testUser = {
  email: 'testuser@example.com',
  username: 'testuser',
  password_hash: 'hashed_password'
};

// Test file input
const testFileInput: UploadFileInput = {
  original_name: 'test-document.pdf',
  file_path: '/uploads/files/test-document-123.pdf',
  file_size: 1024 * 1024, // 1MB
  mime_type: 'application/pdf',
  uploaded_by: 1 // Will be set after user creation
};

describe('uploadFile', () => {
  let userId: number;

  beforeEach(async () => {
    await createDB();
    
    // Create test user first
    const userResult = await db.insert(usersTable)
      .values(testUser)
      .returning()
      .execute();
    
    userId = userResult[0].id;
    testFileInput.uploaded_by = userId;
  });

  afterEach(resetDB);

  it('should upload a file successfully', async () => {
    const result = await uploadFile(testFileInput);

    // Basic field validation
    expect(result.original_name).toEqual('test-document.pdf');
    expect(result.file_path).toEqual('/uploads/files/test-document-123.pdf');
    expect(result.file_size).toEqual(1024 * 1024);
    expect(result.mime_type).toEqual('application/pdf');
    expect(result.uploaded_by).toEqual(userId);
    expect(result.id).toBeDefined();
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should save file to database', async () => {
    const result = await uploadFile(testFileInput);

    // Query database to verify file was saved
    const files = await db.select()
      .from(filesTable)
      .where(eq(filesTable.id, result.id))
      .execute();

    expect(files).toHaveLength(1);
    expect(files[0].original_name).toEqual('test-document.pdf');
    expect(files[0].file_path).toEqual('/uploads/files/test-document-123.pdf');
    expect(files[0].file_size).toEqual(1024 * 1024);
    expect(files[0].mime_type).toEqual('application/pdf');
    expect(files[0].uploaded_by).toEqual(userId);
    expect(files[0].created_at).toBeInstanceOf(Date);
  });

  it('should handle different file types', async () => {
    const imageFileInput: UploadFileInput = {
      original_name: 'profile-pic.jpg',
      file_path: '/uploads/images/profile-pic-456.jpg',
      file_size: 512 * 1024, // 512KB
      mime_type: 'image/jpeg',
      uploaded_by: userId
    };

    const result = await uploadFile(imageFileInput);

    expect(result.original_name).toEqual('profile-pic.jpg');
    expect(result.mime_type).toEqual('image/jpeg');
    expect(result.file_size).toEqual(512 * 1024);
  });

  it('should handle large files up to 50MB', async () => {
    const largeFileInput: UploadFileInput = {
      original_name: 'large-video.mp4',
      file_path: '/uploads/videos/large-video-789.mp4',
      file_size: 50 * 1024 * 1024, // 50MB (max allowed)
      mime_type: 'video/mp4',
      uploaded_by: userId
    };

    const result = await uploadFile(largeFileInput);

    expect(result.file_size).toEqual(50 * 1024 * 1024);
    expect(result.mime_type).toEqual('video/mp4');
  });

  it('should throw error when user does not exist', async () => {
    const invalidUserInput: UploadFileInput = {
      ...testFileInput,
      uploaded_by: 999 // Non-existent user ID
    };

    await expect(uploadFile(invalidUserInput)).rejects.toThrow(/user not found/i);
  });

  it('should create multiple files for same user', async () => {
    const file1Input: UploadFileInput = {
      original_name: 'document1.pdf',
      file_path: '/uploads/files/document1-123.pdf',
      file_size: 1024,
      mime_type: 'application/pdf',
      uploaded_by: userId
    };

    const file2Input: UploadFileInput = {
      original_name: 'document2.pdf',
      file_path: '/uploads/files/document2-456.pdf',
      file_size: 2048,
      mime_type: 'application/pdf',
      uploaded_by: userId
    };

    const result1 = await uploadFile(file1Input);
    const result2 = await uploadFile(file2Input);

    expect(result1.id).toBeDefined();
    expect(result2.id).toBeDefined();
    expect(result1.id).not.toEqual(result2.id);
    expect(result1.uploaded_by).toEqual(userId);
    expect(result2.uploaded_by).toEqual(userId);

    // Verify both files exist in database
    const allFiles = await db.select()
      .from(filesTable)
      .where(eq(filesTable.uploaded_by, userId))
      .execute();

    expect(allFiles).toHaveLength(2);
  });
});