/**
 * Vercel serverless entry point.
 *
 * An optional catch-all ([[...path]]) rather than a plain index, so Express
 * receives the original full URL (/api/esb/menu?...) and every route inside
 * server/app.ts keeps working unchanged.
 */
import app from '../server/app';

export default app;
