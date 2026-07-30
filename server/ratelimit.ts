import './env.js';
import type { NextFunction, Request, Response } from 'express';
import { Ratelimit } from '@upstash/ratelimit';
import { redis, hasUpstash, describeMissingUpstash } from './redis.js';

const IS_PROD = process.env.NODE_ENV === 'production';

const TOO_MANY = 'Terlalu banyak permintaan. Silakan coba lagi nanti.';

// Defensive about `socket`: this runs inside a serverless handler where the
// request object is not always a full Node IncomingMessage, and a TypeError
// here would take down the whole invocation rather than one request.
function clientIp(req: Request): string {
  return req.ip || req.socket?.remoteAddress || 'unknown';
}

function reject(req: Request, res: Response, resetAt: number, label: string) {
  console.warn(`[RATE LIMIT: ${label}] ${clientIp(req)} on ${req.method} ${req.path}`);
  res.setHeader('Retry-After', Math.max(1, Math.ceil((resetAt - Date.now()) / 1000)));
  return res.status(429).json({ success: false, error: TOO_MANY });
}

// ----------------------------------------------------
// IN-MEMORY (per-instance, best effort)
// ----------------------------------------------------

// Exported so the long-lived dev server can sweep them; under serverless the
// process is short-lived enough that unbounded growth never materialises.
export type RateBucket = Map<string, { count: number; resetAt: number }>;
export const rateBuckets: RateBucket[] = [];

/**
 * Per-process counter. On serverless each instance keeps its own bucket, so the
 * effective limit is multiplied by the number of warm instances. That is
 * acceptable for coarse throttling but NOT for anything that spends money —
 * see createSharedRateLimiter for those.
 */
export function createMemoryRateLimiter(windowMs: number, max: number, label: string) {
  const bucket: RateBucket = new Map();
  rateBuckets.push(bucket);

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = clientIp(req);
    const now = Date.now();
    let entry = bucket.get(ip);
    if (!entry || now > entry.resetAt) {
      entry = { count: 0, resetAt: now + windowMs };
      bucket.set(ip, entry);
    }
    entry.count++;
    if (entry.count > max) {
      return reject(req, res, entry.resetAt, label);
    }
    next();
  };
}

// ----------------------------------------------------
// SHARED (Upstash Redis, correct across instances)
// ----------------------------------------------------

export { hasUpstash };

/**
 * Sliding-window limiter backed by Redis, so the count is shared by every
 * serverless instance. Use this for endpoints that create real orders against
 * the merchant's ESB credentials.
 *
 * Missing configuration is an operator error, so in production this refuses
 * every request rather than silently degrading into no protection at all. In
 * development it falls back to the in-memory counter, which is equivalent
 * there because there is only one process.
 */
export function createSharedRateLimiter(windowMs: number, max: number, label: string) {
  if (!redis) {
    if (IS_PROD) {
      console.error(
        `[FATAL] No Upstash REST credentials found. ${describeMissingUpstash()} ` +
          `The "${label}" limiter cannot protect this endpoint, so it is refusing all traffic.`
      );
      return (_req: Request, res: Response) =>
        res.status(503).json({ success: false, error: 'Layanan pemesanan sedang tidak tersedia.' });
    }
    console.warn(`[WARN] Upstash not configured; "${label}" limiter falls back to in-memory (dev only).`);
    return createMemoryRateLimiter(windowMs, max, label);
  }

  const limiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(max, `${Math.round(windowMs / 1000)} s`),
    prefix: `matchaman:rl:${label}`,
    analytics: false,
  });

  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { success, reset } = await limiter.limit(clientIp(req));
      if (!success) return reject(req, res, reset, label);
      next();
    } catch (err) {
      // A Redis blip must not stop a cafe from taking orders, so this fails
      // open — but loudly, because a sustained outage means the cap is gone.
      console.error(`[RATE LIMIT: ${label}] Upstash unreachable, allowing request:`, err);
      next();
    }
  };
}
