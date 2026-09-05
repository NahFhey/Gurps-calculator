/**
 * GURPS VTT Server — Express + Socket.IO
 *
 * Provides:
 * - REST API for campaign and session management
 * - Socket.IO for real-time state sync notifications
 * - Static file serving for the built client (production)
 *
 * Security:
 * - JWT authentication on all protected routes and socket connections
 * - CORS restricted to configurable allowlist (default: localhost origins)
 * - Rate limiting on all endpoints (stricter on session join)
 * - 10MB payload cap (down from 100MB)
 */

import express from 'express';
import type { Express, Request } from 'express';
import { createServer } from 'http';
import { Server as SocketServer } from 'socket.io';
import compression from 'compression';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import path from 'path';
import { pathToFileURL } from 'url';
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
  /**
   * Allowed CORS origins. Comma-separated string or array.
   * Default: localhost on common dev ports.
   * Set to '*' to allow all (NOT recommended for production).
   */
  corsOrigins?: string | string[];
}

export interface ServerHandle {
  /** The port the server is actually listening on. */
  port: number;
  /** Gracefully shut down the server. */
  close: () => Promise<void>;
}

/** Match the asset namespace, including individual byte endpoints. */
function isAssetRequest(req: Request): boolean {
  return /^\/api\/campaigns\/[^/]+\/assets(?:\/|$)/i.test(req.originalUrl.split('?')[0]);
}

export function setupApiMiddleware(app: Express): void {
  const json = express.json({ limit: '10mb' });
  app.use((req, res, next) => {
    if (isAssetRequest(req)) next();
    else json(req, res, next);
  });
  app.use('/api/campaigns/:id/assets', rateLimit({
    windowMs: 60 * 1000,
    max: 600,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many asset requests, please try again later' },
  }));
  app.use('/api', rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    skip: isAssetRequest,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later' },
  }));
}

/** Parse CORS origins from env or options. */
function parseCorsOrigins(input?: string | string[]): string[] | string {
  if (!input) {
    // Default: localhost on common ports (Vite dev, Electron, etc.)
    return [
      'http://localhost:3000',
      'http://localhost:3001',
      'http://localhost:5173',
      'http://127.0.0.1:3000',
      'http://127.0.0.1:3001',
      'http://127.0.0.1:5173',
    ];
  }
  if (input === '*') return '*';
  if (Array.isArray(input)) return input;
  return input.split(',').map((s) => s.trim());
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

  // Parse CORS origins
  const allowedOrigins = parseCorsOrigins(
    options?.corsOrigins ?? process.env.CORS_ORIGINS,
  );

  // Socket.IO with CORS lockdown and reduced buffer
  const io = new SocketServer(httpServer, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
    maxHttpBufferSize: 10 * 1024 * 1024, // 10MB (down from 100MB)
  });

  // ---------------------------------------------------------------------------
  // Middleware
  // ---------------------------------------------------------------------------
  app.use(compression());

  // CORS — restricted to configured origins
  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }));

  setupApiMiddleware(app);

  // Stricter rate limiter for session join: 10 attempts per minute per IP
  // Prevents brute-forcing join codes
  app.use('/api/sessions/join', rateLimit({
    windowMs: 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many join attempts, please try again later' },
  }));

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
      console.log(`[Server] CORS origins: ${JSON.stringify(allowedOrigins)}`);

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
const entryArg = process.argv[1];
if (entryArg && import.meta.url === pathToFileURL(entryArg).href) {
  startServer().catch((err) => {
    console.error('[Server] Failed to start:', err);
    process.exit(1);
  });
}
