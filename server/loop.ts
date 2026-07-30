import './env.js';
import crypto from 'crypto';
import { fetchWithTimeout } from './http.js';

/**
 * ESB Loop (loyalty) client.
 *
 * Every public Loop endpoint requires an X-Signature header computed with the
 * merchant's client secret. The spec is explicit that the secret must never
 * reach client-side code, so the browser cannot call Loop at all — everything
 * goes through here, exactly like the ESB ESO-QS proxy next door.
 */

const LOOP_BASE = (process.env.LOOP_API_BASE_URL || 'https://stg7.esb.co.id/esb-loop-lite/api/web').replace(/\/$/, '');
const CLIENT_ID = process.env.LOOP_CLIENT_ID || '';
const CLIENT_SECRET = process.env.LOOP_CLIENT_SECRET || '';
const LOOP_TIMEOUT_MS = parseInt(process.env.LOOP_TIMEOUT_MS || '9000', 10);

/**
 * Which path goes into the signature.
 *
 * The spec is ambiguous here and it is the single most likely reason for a
 * blanket 401. Its prose example signs `/app/auth/login`, but the Postman
 * reference implementation it also ships uses `pm.request.url.path`, which is
 * the FULL path — including the `/esb-loop-lite/api/web` prefix that the
 * staging base URL carries. The executable reference wins by default; this
 * switch exists so the other reading is one env var away rather than a code
 * change made while debugging.
 */
const SIGN_PATH_MODE = process.env.LOOP_SIGN_PATH_MODE === 'endpoint' ? 'endpoint' : 'full';

export const loopMissingCreds = [
  !CLIENT_ID && 'LOOP_CLIENT_ID',
  !CLIENT_SECRET && 'LOOP_CLIENT_SECRET',
].filter(Boolean) as string[];

export const hasLoopCreds = loopMissingCreds.length === 0;

/**
 * Body hashing, transcribed from the spec's reference implementation.
 *
 * Two details that are easy to get wrong and produce a silent 401:
 *  - An empty object hashes as the empty string, not as "{}". So does anything
 *    that is not parseable JSON, and so does a body-less GET.
 *  - Normalisation strips ALL whitespace, including spaces inside string
 *    values. The server does the same on receipt, so this only has to match.
 */
export function hashRequestBody(rawBody: string): string {
  let normalized = '';
  try {
    const parsed = JSON.parse(rawBody);
    if (parsed && typeof parsed === 'object' && Object.keys(parsed).length > 0) {
      normalized = rawBody.replace(/[\r\n\t ]/g, '');
    }
  } catch {
    // Not JSON — treated as no body, same as the reference does.
  }
  return crypto.createHash('sha256').update(normalized).digest('hex').toLowerCase();
}

/** Path as it appears in the string to sign, per SIGN_PATH_MODE. */
export function signedPath(endpointPath: string): string {
  if (SIGN_PATH_MODE === 'endpoint') return endpointPath;
  return new URL(`${LOOP_BASE}${endpointPath}`).pathname;
}

/**
 * X-Signature: Base64(TIMESTAMP:HMAC_SHA256(METHOD:URL:HASHED_BODY:TIMESTAMP, secret):CLIENT_ID)
 *
 * `timestampSeconds` is injectable so the algorithm can be tested against the
 * spec's worked example instead of only against itself.
 */
export function buildSignature(opts: {
  method: string;
  endpointPath: string;
  rawBody?: string;
  timestampSeconds?: number;
  clientId?: string;
  clientSecret?: string;
}): { signature: string; stringToSign: string; timestamp: string } {
  const clientId = opts.clientId ?? CLIENT_ID;
  const clientSecret = opts.clientSecret ?? CLIENT_SECRET;
  const timestamp = String(opts.timestampSeconds ?? Math.floor(Date.now() / 1000));
  const hashedBody = hashRequestBody(opts.rawBody ?? '');

  const stringToSign = `${opts.method.toUpperCase()}:${signedPath(opts.endpointPath)}:${hashedBody}:${timestamp}`;
  const signatureHash = crypto
    .createHmac('sha256', clientSecret)
    .update(stringToSign)
    .digest('hex')
    .toLowerCase();

  const signature = Buffer.from(`${timestamp}:${signatureHash}:${clientId}`, 'utf8').toString('base64');
  return { signature, stringToSign, timestamp };
}

export class LoopError extends Error {
  constructor(
    public readonly status: number,
    public readonly body: string
  ) {
    super(`Loop API Error: ${status} - ${body}`);
    this.name = 'LoopError';
  }
}

/**
 * Call a Loop endpoint. `memberToken` is the accessToken issued by the OTP
 * flow; it is held server-side in the session store and never sent to the
 * browser.
 */
export async function loopFetch<T = any>(
  endpointPath: string,
  options: { method?: 'GET' | 'POST'; body?: unknown; memberToken?: string } = {}
): Promise<T> {
  const method = options.method || 'GET';
  // Compact on purpose: the string that gets hashed must be the string that
  // gets sent, modulo the whitespace stripping both sides apply.
  const rawBody = options.body === undefined ? '' : JSON.stringify(options.body);

  const { signature } = buildSignature({ method, endpointPath, rawBody });

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Signature': signature,
  };
  if (options.memberToken) headers.Authorization = `Bearer ${options.memberToken}`;

  const response = await fetchWithTimeout(
    `${LOOP_BASE}${endpointPath}`,
    { method, headers, ...(rawBody ? { body: rawBody } : {}) },
    LOOP_TIMEOUT_MS
  );

  const text = await response.text();
  if (!response.ok) throw new LoopError(response.status, text);

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new LoopError(response.status, `Non-JSON response: ${text.slice(0, 200)}`);
  }
}
