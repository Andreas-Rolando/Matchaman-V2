import type { IncomingMessage, ServerResponse } from 'node:http';
import app from '../server/app';

/**
 * Vercel serverless entry point.
 *
 * Every /api/* path reaches this one function through an explicit rewrite in
 * vercel.json, NOT through a [...catch-all] filename.
 *
 * That distinction is the whole point of this file. Vercel's /api directory
 * registers each file as a function at its *literal* path, so `api/[...path].ts`
 * was only ever reachable as the URL `/api/[...path]` — every real request
 * (/api/esb/outlets and friends) matched no function, fell through to the SPA
 * rewrite, and came back as index.html, which the browser then failed to parse
 * as JSON. A plain filename plus an explicit rewrite has no such ambiguity.
 *
 * The rewrite carries the original path in `__vpath`, because Express routes
 * entirely off req.url and the rewrite destination would otherwise arrive here
 * as /api/index. When that parameter is absent the URL is left untouched, so
 * this keeps working if the platform ever passes the original path through.
 */
export default function handler(req: IncomingMessage, res: ServerResponse) {
  const url = new URL(req.url || '/', 'http://localhost');
  const originalPath = url.searchParams.get('__vpath');

  if (originalPath !== null) {
    url.searchParams.delete('__vpath');
    req.url = `/api/${originalPath}${url.search}`;
  }

  // An Express app is itself an (req, res) handler.
  return (app as unknown as (q: IncomingMessage, s: ServerResponse) => void)(req, res);
}
