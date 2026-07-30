/**
 * Long-lived server entry point.
 *
 * Used for local development (`npm run dev`, Express hosting Vite as
 * middleware so the app is single-origin) and for self-hosting
 * (`npm run build:node && npm start`).
 *
 * The serverless deployment does NOT go through this file — Vercel imports
 * ./server/app directly via api/[[...path]].ts. Keep anything that assumes a
 * process which stays alive (listeners, timers, signal handlers) here, not
 * there.
 */
import path from 'path';
import express from 'express';
import app, { sweepExpired } from './server/app';

const PORT = parseInt(process.env.PORT || '3000', 10);
const IS_PROD = process.env.NODE_ENV === 'production';
const SWEEP_INTERVAL_MS = 60000;

async function startServer() {
  if (IS_PROD) {
    // Self-hosted mode serves the built SPA itself; on Vercel the CDN does this.
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  } else {
    // Imported dynamically so Vite never enters a production bundle — a static
    // import would drag the whole Vite/Rollup tree into the serverless
    // function and evaluate it on every cold start.
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  // unref() so it never holds the process open during shutdown.
  const sweepTimer = setInterval(sweepExpired, SWEEP_INTERVAL_MS);
  sweepTimer.unref();

  const server = app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server Matchaman ESB ESO-QS running on http://localhost:${PORT}`);
    console.log(`Mode: ${IS_PROD ? 'production' : 'development'}`);
  });

  // Let in-flight requests finish before the process dies on a container restart.
  let shuttingDown = false;
  const shutdown = (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`[${signal}] shutting down, draining connections...`);
    clearInterval(sweepTimer);
    server.close(() => {
      console.log('Closed cleanly.');
      process.exit(0);
    });
    // Don't hang forever on a stuck connection.
    setTimeout(() => {
      console.error('Drain timed out, forcing exit.');
      process.exit(1);
    }, 10000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer();
