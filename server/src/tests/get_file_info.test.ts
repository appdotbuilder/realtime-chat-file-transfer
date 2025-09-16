import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, filesTable, conversationsTable, messagesTable } from '../db/schema';
import { getFileInfo } from '../handlers/get_file_info';

describe('getFileInfo', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  it('should return file info for file owner', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'owner@example.com',
        username: 'fileowner',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();
    
    const userId = userResult[0].id;

    // Create test file uploaded by the user
    const fileResult = await db.insert(filesTable)
      .values({
        original_name: 'test-document.pdf',
        file_path: '/uploads/abc123.pdf',
        file_size: 2048,
        mime_type: 'application/pdf',
        uploaded_by: userId
      })
      .returning()
      .execute();
    
    const fileId = fileResult[0].id;

    // Get file info
    const result = await getFileInfo(fileId, userId);

    // Verify file info is returned correctly
    expect(result.id).toEqual(fileId);
    expect(result.original_name).toEqual('test-document.pdf');
    expect(result.file_path).toEqual('/uploads/abc123.pdf');
    expect(result.file_size).toEqual(2048);
    expect(result.mime_type).toEqual('application/pdf');
    expect(result.uploaded_by).toEqual(userId);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should return file info for user in conversation with file message', async () => {
    // Create two users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        username: 'user1',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        username: 'user2',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create a file uploaded by user1
    const fileResult = await db.insert(filesTable)
      .values({
        original_name: 'shared-image.jpg',
        file_path: '/uploads/xyz789.jpg',
        file_size: 1024,
        mime_type: 'image/jpeg',
        uploaded_by: user1Id
      })
      .returning()
      .execute();

    const fileId = fileResult[0].id;

    // Create conversation between users
    const conversationResult = await db.insert(conversationsTable)
      .values({
        user1_id: user1Id,
        user2_id: user2Id
      })
      .returning()
      .execute();

    const conversationId = conversationResult[0].id;

    // Create message with file attachment
    await db.insert(messagesTable)
      .values({
        conversation_id: conversationId,
        sender_id: user1Id,
        content: 'Check out this image!',
        message_type: 'file',
        file_id: fileId
      })
      .execute();

    // User2 should be able to access file info since file was shared in their conversation
    const result = await getFileInfo(fileId, user2Id);

    expect(result.id).toEqual(fileId);
    expect(result.original_name).toEqual('shared-image.jpg');
    expect(result.file_size).toEqual(1024);
    expect(result.mime_type).toEqual('image/jpeg');
  });

  it('should throw error for non-existent file', async () => {
    // Create test user
    const userResult = await db.insert(usersTable)
      .values({
        email: 'user@example.com',
        username: 'testuser',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const userId = userResult[0].id;

    // Try to get info for non-existent file
    await expect(getFileInfo(999, userId)).rejects.toThrow(/file not found/i);
  });

  it('should throw access denied error for unauthorized user', async () => {
    // Create two users
    const ownerResult = await db.insert(usersTable)
      .values({
        email: 'owner@example.com',
        username: 'fileowner',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const unauthorizedResult = await db.insert(usersTable)
      .values({
        email: 'unauthorized@example.com',
        username: 'unauthorized',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const ownerId = ownerResult[0].id;
    const unauthorizedId = unauthorizedResult[0].id;

    // Create file owned by first user
    const fileResult = await db.insert(filesTable)
      .values({
        original_name: 'private-file.txt',
        file_path: '/uploads/private123.txt',
        file_size: 512,
        mime_type: 'text/plain',
        uploaded_by: ownerId
      })
      .returning()
      .execute();

    const fileId = fileResult[0].id;

    // Unauthorized user tries to access file
    await expect(getFileInfo(fileId, unauthorizedId)).rejects.toThrow(/access denied/i);
  });

  it('should allow access when user is user1 in conversation', async () => {
    // Create two users
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        username: 'user1',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        username: 'user2',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create file uploaded by user2
    const fileResult = await db.insert(filesTable)
      .values({
        original_name: 'document.doc',
        file_path: '/uploads/doc456.doc',
        file_size: 4096,
        mime_type: 'application/msword',
        uploaded_by: user2Id
      })
      .returning()
      .execute();

    const fileId = fileResult[0].id;

    // Create conversation (user1 as user1_id, user2 as user2_id)
    const conversationResult = await db.insert(conversationsTable)
      .values({
        user1_id: user1Id,
        user2_id: user2Id
      })
      .returning()
      .execute();

    const conversationId = conversationResult[0].id;

    // Create message with file
    await db.insert(messagesTable)
      .values({
        conversation_id: conversationId,
        sender_id: user2Id,
        content: 'Here is the document',
        message_type: 'file',
        file_id: fileId
      })
      .execute();

    // User1 should have access since they are user1_id in the conversation
    const result = await getFileInfo(fileId, user1Id);

    expect(result.id).toEqual(fileId);
    expect(result.original_name).toEqual('document.doc');
    expect(result.file_size).toEqual(4096);
  });

  it('should allow access when user is user2 in conversation', async () => {
    // Create two users  
    const user1Result = await db.insert(usersTable)
      .values({
        email: 'user1@example.com',
        username: 'user1',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const user2Result = await db.insert(usersTable)
      .values({
        email: 'user2@example.com',
        username: 'user2',
        password_hash: 'hashed_password'
      })
      .returning()
      .execute();

    const user1Id = user1Result[0].id;
    const user2Id = user2Result[0].id;

    // Create file uploaded by user1
    const fileResult = await db.insert(filesTable)
      .values({
        original_name: 'presentation.ppt',
        file_path: '/uploads/ppt789.ppt',
        file_size: 8192,
        mime_type: 'application/vnd.ms-powerpoint',
        uploaded_by: user1Id
      })
      .returning()
      .execute();

    const fileId = fileResult[0].id;

    // Create conversation (user1 as user1_id, user2 as user2_id)
    const conversationResult = await db.insert(conversationsTable)
      .values({
        user1_id: user1Id,
        user2_id: user2Id
      })
      .returning()
      .execute();

    const conversationId = conversationResult[0].id;

    // Create message with file
    await db.insert(messagesTable)
      .values({
        conversation_id: conversationId,
        sender_id: user1Id,
        content: 'Please review this presentation',
        message_type: 'file',
        file_id: fileId
      })
      .execute();

    // User2 should have access since they are user2_id in the conversation
    const result = await getFileInfo(fileId, user2Id);

    expect(result.id).toEqual(fileId);
    expect(result.original_name).toEqual('presentation.ppt');
    expect(result.file_size).toEqual(8192);
    expect(result.mime_type).toEqual('application/vnd.ms-powerpoint');
  });
});