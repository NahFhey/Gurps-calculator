/**
 * GURPS VTT Server — Express + Socket.IO
 *
 * Provides:
 * - REST API for campaign and session management
 * - Socket.IO for real-time state sync notifications
 * - Static file serving for the built client (production)
 */

import express from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import compression from 'compression';
import cors from 'cors';
import path from 'path';
import { initDB, setDataDir, saveDB } from './db.js';
import { setupRoutes } from './routes.js';
import { setupSocket } from './socket.js';

export interface StartServerOptions {
  /** Port to listen on. 0 = auto-assign a free port. Default: 3001 */
  port?: number;
  /** Directory for the SQLite database file. */
  dbDir?: string;
  /** Path to the built client dist/ folder for static serving. */
  clientDist?: string;
}

export interface ServerHandle {
  /** The port the server is actually listening on. */
  port: number;
  /** Gracefully shut down the server. */
  close: () => Promise<void>;
}

/**
 * Start the GURPS VTT server.
 *
 * Can be called standalone (CLI) or imported by Electron's main process.
 */
export async function startServer(options?: StartServerOptions): Promise<ServerHandle> {
  const port = options?.port ?? parseInt(process.env.PORT || '3001', 10);
  // When compiled, index.js lives at server/dist/server/src/index.js
  // so ../../../../dist reaches the project root dist/ folder.
  // When run via tsx (dev), import.meta.dirname is server/src/ so ../../dist works.
  const defaultClientDist = import.meta.dirname.includes('dist')
    ? path.join(import.meta.dirname, '../../../../dist')
    : path.join(import.meta.dirname, '../../dist');
  const clientDist = options?.clientDist ?? defaultClientDist;

  // Configure data directory before DB init
  if (options?.dbDir) {
    setDataDir(options.dbDir);
  }

  // Initialize database
  await initDB();
  console.log('[Server] Database initialized');

  // Create Express app
  const app = express();
  const httpServer = createServer(app);

  // Socket.IO with generous buffer for large state payloads
  const io = new SocketServer(httpServer, {
    cors: { origin: '*' },
    maxHttpBufferSize: 100 * 1024 * 1024, // 100MB
  });

  // Middleware
  app.use(compression());
  app.use(cors());
  app.use(express.json({ limit: '100mb' }));

  // API routes
  const apiRouter = setupRoutes(io);
  app.use('/api', apiRouter);

  // Socket.IO handlers
  setupSocket(io);

  // In production, serve the built client
  app.use(express.static(clientDist));
  app.get('/{*path}', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });

  // Start listening
  return new Promise((resolve) => {
    httpServer.listen(port, () => {
      const actualPort = (httpServer.address() as any).port as number;
      console.log(`[Server] GURPS VTT server running on http://localhost:${actualPort}`);
      console.log(`[Server] API available at http://localhost:${actualPort}/api`);

      resolve({
        port: actualPort,
        close: () =>
          new Promise<void>((res) => {
            saveDB();
            io.close();
            httpServer.close(() => res());
          }),
      });
    });
  });
}

// Auto-start when run directly (not imported by Electron)
const entryArg = process.argv[1]?.replace(/\\/g, '/');
const thisUrl = import.meta.url.replace('file:///', '').replace('file://', '');
if (entryArg && (thisUrl.endsWith(entryArg) || entryArg.endsWith('index.js'))) {
  startServer().catch((err) => {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  });
}
