import './env.js';
import { Redis } from '@upstash/redis';

/**
 * One Redis client for the whole server.
 *
 * This used to live inside ratelimit.ts and was not exported, so member
 * sessions would have had to construct a second client and duplicate the
 * credential handling below. Kept here instead: one client, one place that
 * knows how the credentials are named.
 */

// Two naming conventions, because Vercel's Upstash integration does not always
// use the same one: the Marketplace integration sets UPSTASH_REDIS_REST_*,
// while the older Vercel KV wiring sets KV_REST_API_*. Reading only the first
// pair meant a correctly connected database still looked absent.
//
// Deliberately not REDIS_URL: that is a redis:// TCP endpoint, and this client
// speaks HTTP because TCP connections do not survive between invocations.
export const URL_VARS = ['UPSTASH_REDIS_REST_URL', 'KV_REST_API_URL'] as const;
export const TOKEN_VARS = ['UPSTASH_REDIS_REST_TOKEN', 'KV_REST_API_TOKEN'] as const;

function firstSet(names: readonly string[]): string | undefined {
  for (const name of names) {
    const value = process.env[name];
    if (value) return value;
  }
  return undefined;
}

const UPSTASH_URL = firstSet(URL_VARS);
const UPSTASH_TOKEN = firstSet(TOKEN_VARS);

export const hasUpstash = Boolean(UPSTASH_URL && UPSTASH_TOKEN);

export const redis = hasUpstash
  ? new Redis({ url: UPSTASH_URL as string, token: UPSTASH_TOKEN as string })
  : null;

/** Names every variable that was checked and which half is missing. A bare
 *  "config missing" sends you looking at the integration when the cause is
 *  usually a naming mismatch or a deployment predating the variables. */
export function describeMissingUpstash(): string {
  return (
    `Looked for URL in [${URL_VARS.join(', ')}] (${UPSTASH_URL ? 'found' : 'MISSING'}) ` +
    `and token in [${TOKEN_VARS.join(', ')}] (${UPSTASH_TOKEN ? 'found' : 'MISSING'}). ` +
    `Environment variables only reach a NEW deployment — redeploy after adding them.`
  );
}
