import './env.js';
import crypto from 'crypto';
import type { Request, Response } from 'express';
import { redis } from './redis.js';

/**
 * Member sessions for the Loop loyalty login.
 *
 * The Loop accessToken can redeem points for rewards, so it never leaves the
 * server: it lives in Redis and the browser only ever holds an opaque session
 * id in an httpOnly cookie. That keeps it out of reach of any script that gets
 * onto the page, and makes a session revocable.
 */

const IS_PROD = process.env.NODE_ENV === 'production';

export const SESSION_COOKIE = 'loop_sid';
export const PENDING_COOKIE = 'loop_otp';

const SESSION_PREFIX = 'loop:sess:';
const PENDING_PREFIX = 'loop:otp:';

/** Loop tokens are long-lived; this is the ceiling regardless of what it says. */
const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
/** A WhatsApp OTP attempt that has not completed in this long is abandoned. */
const PENDING_TTL_SECONDS = 15 * 60;

export interface LoopSession {
  token: string;
  memberCode?: string;
  fullName?: string;
  phoneNumber?: string;
}

export interface PendingLogin {
  /** Signature from generate-otp, used to poll status. Never sent to the client. */
  signature: string;
  type: string;
}


export const hasSessionStore = Boolean(redis);

function cookieOptions(maxAgeSeconds: number) {
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    // Only over HTTPS in production; a Secure cookie would simply not be stored
    // by the browser on plain-HTTP localhost, silently breaking dev.
    secure: IS_PROD,
    path: '/',
    maxAge: maxAgeSeconds * 1000,
  };
}

// Reading is manual: Express 4 exposes no req.cookies without cookie-parser,
// and two cookies do not justify a dependency. res.cookie() is built in, so
// only this direction needs writing out.
function readCookie(req: Request, name: string): string | null {
  const raw = req.headers.cookie;
  if (!raw) return null;
  for (const part of raw.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) {
      return decodeURIComponent(part.slice(idx + 1).trim()) || null;
    }
  }
  return null;
}

function newId(): string {
  return crypto.randomBytes(24).toString('base64url');
}

// ----------------------------------------------------
// Short-lived records, keyed by a cookie the browser cannot read
// ----------------------------------------------------

async function putTemp(res: Response, cookie: string, prefix: string, value: unknown, ttl: number) {
  if (!redis) throw new Error('Session store unavailable');
  const id = newId();
  await redis.set(`${prefix}${id}`, JSON.stringify(value), { ex: ttl });
  res.cookie(cookie, id, cookieOptions(ttl));
}

async function getTemp<T>(req: Request, cookie: string, prefix: string): Promise<T | null> {
  if (!redis) return null;
  const id = readCookie(req, cookie);
  if (!id) return null;
  const raw = await redis.get<T | string>(`${prefix}${id}`);
  if (!raw) return null;
  return typeof raw === 'string' ? (JSON.parse(raw) as T) : raw;
}

async function delTemp(req: Request, res: Response, cookie: string, prefix: string) {
  const id = readCookie(req, cookie);
  if (id && redis) await redis.del(`${prefix}${id}`);
  res.clearCookie(cookie, { path: '/' });
}

// Pending OTP attempt

export const startPendingLogin = (res: Response, pending: PendingLogin) =>
  putTemp(res, PENDING_COOKIE, PENDING_PREFIX, pending, PENDING_TTL_SECONDS);

export const readPendingLogin = (req: Request) =>
  getTemp<PendingLogin>(req, PENDING_COOKIE, PENDING_PREFIX);

export const clearPendingLogin = (req: Request, res: Response) =>
  delTemp(req, res, PENDING_COOKIE, PENDING_PREFIX);


// ----------------------------------------------------
// Member session
// ----------------------------------------------------

export async function createSession(res: Response, session: LoopSession): Promise<void> {
  if (!redis) throw new Error('Session store unavailable');
  const id = newId();
  await redis.set(`${SESSION_PREFIX}${id}`, JSON.stringify(session), { ex: SESSION_TTL_SECONDS });
  res.cookie(SESSION_COOKIE, id, cookieOptions(SESSION_TTL_SECONDS));
}

export async function readSession(req: Request): Promise<LoopSession | null> {
  if (!redis) return null;
  const id = readCookie(req, SESSION_COOKIE);
  if (!id) return null;
  const raw = await redis.get<LoopSession | string>(`${SESSION_PREFIX}${id}`);
  if (!raw) return null;
  return typeof raw === 'string' ? (JSON.parse(raw) as LoopSession) : raw;
}

export async function destroySession(req: Request, res: Response): Promise<void> {
  const id = readCookie(req, SESSION_COOKIE);
  if (id && redis) await redis.del(`${SESSION_PREFIX}${id}`);
  res.clearCookie(SESSION_COOKIE, { path: '/' });
}
