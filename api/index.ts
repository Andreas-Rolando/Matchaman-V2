import type { IncomingMessage, ServerResponse } from 'node:http';

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
type NodeHandler = (req: IncomingMessage, res: ServerResponse) => void;

// Loaded once per instance and reused. Imported lazily rather than at module
// scope so that a failure to load is reportable: an exception thrown while the
// module graph is being evaluated surfaces only as an opaque
// FUNCTION_INVOCATION_FAILED, with the actual cause visible nowhere the client
// can reach. Vercel's own Express guidance calls this out — a swallowed error
// leaves the function in an undefined state.
let cachedApp: NodeHandler | null = null;

async function loadApp(): Promise<NodeHandler> {
  if (!cachedApp) {
    const mod = await import('../server/app');
    cachedApp = (mod.default ?? mod) as unknown as NodeHandler;
  }
  return cachedApp;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  let app: NodeHandler;
  try {
    app = await loadApp();
  } catch (err) {
    const detail = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    console.error('[BOOT FAILED]', err);
    res.statusCode = 500;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ success: false, error: 'Server gagal dimuat.', detail }));
    return;
  }

  const url = new URL(req.url || '/', 'http://localhost');
  const originalPath = url.searchParams.get('__vpath');

  if (originalPath !== null) {
    url.searchParams.delete('__vpath');
    req.url = `/api/${originalPath}${url.search}`;
  }

  // An Express app is itself an (req, res) handler.
  return app(req, res);
}
