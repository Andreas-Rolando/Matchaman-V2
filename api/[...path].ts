/**
 * Vercel serverless entry point.
 *
 * A catch-all ([...path]) rather than a plain index, so Express receives the
 * original full URL (/api/esb/menu?...) and every route inside server/app.ts
 * keeps working unchanged.
 *
 * Single brackets, not double: [[...path]] is a Next.js *router* convention for
 * an optional catch-all, and the /api directory does not use the Next router.
 * Named that way, nothing matched /api/esb/* — requests fell straight through to
 * the SPA rewrite in vercel.json and came back as index.html, which the client
 * then tried to parse as JSON.
 */
import app from '../server/app';

export default app;
