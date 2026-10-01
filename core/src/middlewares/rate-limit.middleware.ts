import { Request, Response, NextFunction } from 'express';

interface RateLimitRecord {
  count: number;
  resetTime: number;
}

const ipCache = new Map<string, RateLimitRecord>();

setInterval(() => {
  const now = Date.now();
  for (const [ip, record] of ipCache.entries()) {
    if (now > record.resetTime) {
      ipCache.delete(ip);
    }
  }
}, 60000); // Cleanup every minute

/**
 * Creates an in-memory rate limiter middleware.
 * @param limit Max number of requests allowed in the window.
 * @param windowMs Window size in milliseconds.
 */
export function rateLimiter(limit: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    let record = ipCache.get(ip);

    if (!record || now > record.resetTime) {
      // Create new record or reset expired window
      record = { count: 1, resetTime: now + windowMs };
      ipCache.set(ip, record);
      return next();
    }

    record.count++;
    if (record.count > limit) {
      return res.status(429).json({
        error: 'Muitas requisições. Por favor, tente novamente mais tarde.'
      });
    }

    next();
  };
}
