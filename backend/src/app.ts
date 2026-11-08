import express from 'express';
import cors from 'cors';
import apiRouter from './api';
import { apiErrorHandler } from './middleware/errorHandler';

/**
 * Single source of truth for building the Express app, shared by both entry
 * points (server.ts for dev / single-process and index.ts for the Docker image),
 * so middleware, body limits, mount paths and the error handler can't drift apart.
 */
export function createApp() {
  const app = express();

  // TRUST_PROXY is configured by the caller BEFORE createApp, because each entry
  // point has a different default (0 for server.ts, 1 behind nginx in index.ts).
  app.use(cors());
  // Bulk word import sends a whole list in one request body (the default limit is only 100 kb).
  app.use(express.json({ limit: '6mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', message: 'Backend is running!' });
  });

  app.use('/api', apiRouter);
  app.use('/api', apiErrorHandler);

  return app;
}
