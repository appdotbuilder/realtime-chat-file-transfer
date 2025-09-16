import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { resetDB, createDB } from '../helpers';
import { db } from '../db';
import { usersTable, filesTable, conversationsTable, messagesTable } from '../db/schema';
import { downloadFile } from '../handlers/download_file';
import { writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('downloadFile', () => {
  beforeEach(createDB);
  afterEach(resetDB);

  let testUser1Id: number;
  let testUser2Id: number;
  let testUser3Id: number;
  let testFilePath: string;

  beforeEach(async () => {
    // Create test users
    const users = await db.insert(usersTable)
      .values([
        {
          email: 'user1@test.com',
          username: 'user1',
          password_hash: 'hash1'
        },
        {
          email: 'user2@test.com',
          username: 'user2',
          password_hash: 'hash2'
        },
        {
          email: 'user3@test.com',
          username: 'user3',
          password_hash: 'hash3'
        }
      ])
      .returning()
      .execute();

    testUser1Id = users[0].id;
    testUser2Id = users[1].id;
    testUser3Id = users[2].id;

    // Create test file on disk
    testFilePath = join(process.cwd(), 'test-file.txt');
    writeFileSync(testFilePath, 'test content');
  });

  afterEach(() => {
    // Clean up test file
    if (existsSync(testFilePath)) {
      unlinkSync(testFilePath);
    }
  });

  it('should allow file uploader to download their own file', async () => {
    // Create test file record
    const fileResults = await db.insert(filesTable)
      .values({
        original_name: 'test.txt',
        file_path: testFilePath,
        file_size: 1024,
        mime_type: 'text/plain',
        uploaded_by: testUser1Id
      })
      .returning()
      .execute();

    const fileId = fileResults[0].id;

    const result = await downloadFile(fileId, testUser1Id);

    expect(result.id).toBe(fileId);
    expect(result.original_name).toBe('test.txt');
    expect(result.file_path).toBe(testFilePath);
    expect(result.file_size).toBe(1024);
    expect(result.mime_type).toBe('text/plain');
    expect(result.uploaded_by).toBe(testUser1Id);
    expect(result.created_at).toBeInstanceOf(Date);
  });

  it('should allow users in conversation to download shared files', async () => {
    // Create test file
    const fileResults = await db.insert(filesTable)
      .values({
        original_name: 'shared.txt',
        file_path: testFilePath,
        file_size: 2048,
        mime_type: 'text/plain',
        uploaded_by: testUser1Id
      })
      .returning()
      .execute();

    const fileId = fileResults[0].id;

    // Create conversation between user1 and user2
    const conversationResults = await db.insert(conversationsTable)
      .values({
        user1_id: testUser1Id,
        user2_id: testUser2Id
      })
      .returning()
      .execute();

    const conversationId = conversationResults[0].id;

    // Create message with file attachment
    await db.insert(messagesTable)
      .values({
        conversation_id: conversationId,
        sender_id: testUser1Id,
        content: 'Here is the file',
        message_type: 'file',
        file_id: fileId
      })
      .execute();

    // User2 should be able to download the file
    const result = await downloadFile(fileId, testUser2Id);

    expect(result.id).toBe(fileId);
    expect(result.original_name).toBe('shared.txt');
    expect(result.uploaded_by).toBe(testUser1Id);
  });

  it('should deny access to users not in conversation', async () => {
    // Create test file
    const fileResults = await db.insert(filesTable)
      .values({
        original_name: 'private.txt',
        file_path: testFilePath,
        file_size: 512,
        mime_type: 'text/plain',
        uploaded_by: testUser1Id
      })
      .returning()
      .execute();

    const fileId = fileResults[0].id;

    // Create conversation between user1 and user2 only
    const conversationResults = await db.insert(conversationsTable)
      .values({
        user1_id: testUser1Id,
        user2_id: testUser2Id
      })
      .returning()
      .execute();

    const conversationId = conversationResults[0].id;

    // Create message with file attachment
    await db.insert(messagesTable)
      .values({
        conversation_id: conversationId,
        sender_id: testUser1Id,
        content: 'Private file',
        message_type: 'file',
        file_id: fileId
      })
      .execute();

    // User3 should NOT be able to download the file
    await expect(downloadFile(fileId, testUser3Id)).rejects.toThrow(/access denied/i);
  });

  it('should throw error when file does not exist in database', async () => {
    const nonExistentFileId = 99999;

    await expect(downloadFile(nonExistentFileId, testUser1Id)).rejects.toThrow(/file not found/i);
  });

  it('should throw error when file does not exist on disk', async () => {
    const nonExistentPath = '/non/existent/path/file.txt';

    // Create file record pointing to non-existent file
    const fileResults = await db.insert(filesTable)
      .values({
        original_name: 'missing.txt',
        file_path: nonExistentPath,
        file_size: 1024,
        mime_type: 'text/plain',
        uploaded_by: testUser1Id
      })
      .returning()
      .execute();

    const fileId = fileResults[0].id;

    await expect(downloadFile(fileId, testUser1Id)).rejects.toThrow(/file not found on disk/i);
  });

  it('should handle files in conversations where user is user2', async () => {
    // Create test file
    const fileResults = await db.insert(filesTable)
      .values({
        original_name: 'user2-accessible.txt',
        file_path: testFilePath,
        file_size: 1536,
        mime_type: 'text/plain',
        uploaded_by: testUser1Id
      })
      .returning()
      .execute();

    const fileId = fileResults[0].id;

    // Create conversation where testUser2 is user2
    const conversationResults = await db.insert(conversationsTable)
      .values({
        user1_id: testUser3Id,
        user2_id: testUser2Id
      })
      .returning()
      .execute();

    const conversationId = conversationResults[0].id;

    // Create message with file attachment
    await db.insert(messagesTable)
      .values({
        conversation_id: conversationId,
        sender_id: testUser3Id,
        content: 'File for user2',
        message_type: 'file',
        file_id: fileId
      })
      .execute();

    // User2 should be able to download the file (as user2 in conversation)
    const result = await downloadFile(fileId, testUser2Id);

    expect(result.id).toBe(fileId);
    expect(result.original_name).toBe('user2-accessible.txt');
  });

  it('should handle multiple conversations with same file', async () => {
    // Create test file
    const fileResults = await db.insert(filesTable)
      .values({
        original_name: 'multi-conv.txt',
        file_path: testFilePath,
        file_size: 2048,
        mime_type: 'text/plain',
        uploaded_by: testUser1Id
      })
      .returning()
      .execute();

    const fileId = fileResults[0].id;

    // Create multiple conversations
    const conv1Results = await db.insert(conversationsTable)
      .values({
        user1_id: testUser1Id,
        user2_id: testUser2Id
      })
      .returning()
      .execute();

    const conv2Results = await db.insert(conversationsTable)
      .values({
        user1_id: testUser1Id,
        user2_id: testUser3Id
      })
      .returning()
      .execute();

    // Share file in both conversations
    await db.insert(messagesTable)
      .values([
        {
          conversation_id: conv1Results[0].id,
          sender_id: testUser1Id,
          content: 'File in conv1',
          message_type: 'file',
          file_id: fileId
        },
        {
          conversation_id: conv2Results[0].id,
          sender_id: testUser1Id,
          content: 'File in conv2',
          message_type: 'file',
          file_id: fileId
        }
      ])
      .execute();

    // Both user2 and user3 should be able to download
    const result2 = await downloadFile(fileId, testUser2Id);
    const result3 = await downloadFile(fileId, testUser3Id);

    expect(result2.id).toBe(fileId);
    expect(result3.id).toBe(fileId);
    expect(result2.original_name).toBe('multi-conv.txt');
    expect(result3.original_name).toBe('multi-conv.txt');
  });
});