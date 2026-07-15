import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';

// Constant-time comparison. Hashing to a fixed length keeps timingSafeEqual
// from throwing on length mismatch and avoids leaking the token length.
export function tokensMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest();
  const b = createHash('sha256').update(expected).digest();
  return timingSafeEqual(a, b);
}

// Express middleware. When `token` is undefined, auth is disabled (pass-through).
export function bearerAuth(token: string | undefined) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!token) return next();
    const raw = req.headers['authorization'] ?? '';
    const header = Array.isArray(raw) ? raw[0] : raw;
    const match = /^Bearer\s+(.+)$/i.exec(header);
    if (!match || !tokensMatch(match[1], token)) {
      res.status(401).json({
        jsonrpc: '2.0',
        error: { code: -32001, message: 'Unauthorized' },
        id: null,
      });
      return;
    }
    next();
  };
}
