import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import {
  registerUserInputSchema,
  loginUserInputSchema,
  getUsersInputSchema,
  createConversationInputSchema,
  getConversationsInputSchema,
  sendMessageInputSchema,
  getMessagesInputSchema,
  uploadFileInputSchema
} from './schema';

// Import handlers
import { registerUser } from './handlers/register_user';
import { loginUser } from './handlers/login_user';
import { getUsers } from './handlers/get_users';
import { createConversation } from './handlers/create_conversation';
import { getConversations } from './handlers/get_conversations';
import { sendMessage } from './handlers/send_message';
import { getMessages } from './handlers/get_messages';
import { uploadFile } from './handlers/upload_file';
import { downloadFile } from './handlers/download_file';
import { getFileInfo } from './handlers/get_file_info';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Authentication routes
  registerUser: publicProcedure
    .input(registerUserInputSchema)
    .mutation(({ input }) => registerUser(input)),

  loginUser: publicProcedure
    .input(loginUserInputSchema)
    .mutation(({ input }) => loginUser(input)),

  // User management routes
  getUsers: publicProcedure
    .input(getUsersInputSchema)
    .query(({ input }) => getUsers(input)),

  // Conversation management routes
  createConversation: publicProcedure
    .input(createConversationInputSchema)
    .mutation(({ input }) => createConversation(input)),

  getConversations: publicProcedure
    .input(getConversationsInputSchema)
    .query(({ input }) => getConversations(input)),

  // Message routes
  sendMessage: publicProcedure
    .input(sendMessageInputSchema)
    .mutation(({ input }) => sendMessage(input)),

  getMessages: publicProcedure
    .input(getMessagesInputSchema)
    .query(({ input }) => getMessages(input)),

  // File management routes
  uploadFile: publicProcedure
    .input(uploadFileInputSchema)
    .mutation(({ input }) => uploadFile(input)),

  downloadFile: publicProcedure
    .input(z.object({ 
      fileId: z.number(), 
      userId: z.number() 
    }))
    .query(({ input }) => downloadFile(input.fileId, input.userId)),

  getFileInfo: publicProcedure
    .input(z.object({ 
      fileId: z.number(), 
      userId: z.number() 
    }))
    .query(({ input }) => getFileInfo(input.fileId, input.userId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();