/**
 * Authentication module — JWT token signing, verification, and Express middleware.
 *
 * Generates a random 256-bit secret on each server start. Tokens are
 * short-lived (24h) and scoped to a specific campaign + role.
 *
 * Token flow:
 *   1. Client creates/joins a campaign → server returns a signed JWT
 *   2. Client sends JWT in `Authorization: Bearer <token>` on subsequent requests
 *   3. Client sends JWT in the Socket.IO `auth` handshake option
 */

import * as jose from 'jose';
import crypto from 'crypto';
import type { Request, Response, NextFunction } from 'express';
import type { Role } from '../../shared/session.js';

// ---------------------------------------------------------------------------
// Secret — generated fresh each server start. All tokens invalidate on restart,
// which is fine for a desktop LAN app (clients just re-join).
// ---------------------------------------------------------------------------

const SECRET = crypto.randomBytes(32);
const ISSUER = 'gurps-vtt';
const AUDIENCE = 'gurps-vtt';
const TOKEN_EXPIRY = '24h';

// ---------------------------------------------------------------------------
// Token payload
// ---------------------------------------------------------------------------

export interface TokenPayload {
  /** Campaign this token is scoped to */
  campaignId: string;
  /** User's role in the campaign */
  role: Role;
  /** Display name for the player */
  displayName: string;
}

// ---------------------------------------------------------------------------
// Sign / verify
// ---------------------------------------------------------------------------

/**
 * Create a signed JWT for a campaign session.
 */
export async function signToken(payload: TokenPayload): Promise<string> {
  return new jose.SignJWT({
    campaignId: payload.campaignId,
    role: payload.role,
    displayName: payload.displayName,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(TOKEN_EXPIRY)
    .sign(SECRET);
}

/**
 * Verify a JWT and return its payload. Returns null if invalid/expired.
 */
export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, SECRET, {
      issuer: ISSUER,
      audience: AUDIENCE,
    });
    return {
      campaignId: payload.campaignId as string,
      role: payload.role as Role,
      displayName: payload.displayName as string,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Express middleware
// ---------------------------------------------------------------------------

/**
 * Augment Express Request with the verified token payload.
 */
declare global {
  namespace Express {
    interface Request {
      auth?: TokenPayload;
    }
  }
}

/**
 * Middleware that extracts and verifies the Bearer token from the
 * Authorization header. Sets `req.auth` on success, returns 401 on failure.
 */
export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Missing or invalid Authorization header' });
    return;
  }

  const token = header.slice(7);
  verifyToken(token)
    .then((payload) => {
      if (!payload) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
      }
      req.auth = payload;
      next();
    })
    .catch(() => {
      res.status(401).json({ error: 'Token verification failed' });
    });
}

/**
 * Middleware that requires the authenticated user to have a specific role.
 * Must be used after `authMiddleware`.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      res.status(401).json({ error: 'Not authenticated' });
      return;
    }
    if (!roles.includes(req.auth.role as Role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }
    next();
  };
}

/**
 * Middleware that requires the authenticated user to be accessing their own campaign.
 * Compares `req.auth.campaignId` with `req.params.id`. Must be used after `authMiddleware`.
 */
export function requireCampaignAccess(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth) {
    res.status(401).json({ error: 'Not authenticated' });
    return;
  }
  const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
  if (req.auth.campaignId !== id) {
    res.status(403).json({ error: 'Access denied to this campaign' });
    return;
  }
  next();
}
