/**
 * Shared fetch with an abort timeout.
 *
 * Lifted out of app.ts so the Loop client uses the same one: an upstream that
 * hangs must not sit there burning the function's maxDuration, and there is no
 * reason for two copies of that rule to drift apart.
 */
export async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
