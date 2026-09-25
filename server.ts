import express from 'express';
import cors from 'cors';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { createServer as createViteServer } from 'vite';
import apiRouter from './backend/src/api';
import { backfillPartOfSpeech } from './backend/src/services/backfillPartOfSpeech';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

function ensureDatabase() {
  try {
    const dbUrl = process.env.DATABASE_URL || '';
    if (dbUrl.startsWith('file:')) {
      const dbPath = dbUrl.replace(/^file:/, '');
      const resolved = path.resolve(process.cwd(), dbPath);
      if (!fs.existsSync(resolved) || fs.statSync(resolved).size === 0) {
        console.log('[db] Initializing SQLite database schema...');
        execSync('npx prisma db push --schema=backend/prisma/schema.prisma --accept-data-loss --skip-generate', {
          stdio: 'inherit',
          env: { ...process.env, DATABASE_URL: dbUrl },
        });
        try {
          execSync('npx tsx backend/prisma/seed.ts', {
            stdio: 'inherit',
            env: { ...process.env, DATABASE_URL: dbUrl },
          });
        } catch (seedErr) {
          console.warn('[db] Seed warning:', seedErr);
        }
      }
    }
  } catch (err) {
    console.warn('[db] Database auto-sync warning:', err);
  }
}

async function startServer() {
  try {
    ensureDatabase();

    const app = express();
    const PORT = 3000;

    app.use(cors());
    app.use(express.json());

    // Mount API router
    app.use('/api', apiRouter);

    // API Health Check
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', message: 'Backend is running!' });
    });

    // Graceful API error handler
    app.use('/api', (err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      console.error('[api error]:', err);
      if (res.headersSent) return next(err);
      res.status(500).json({ error: err.message || 'Internal server error' });
    });

    // Serve Vite Dev Server or Production Static Build
    if (process.env.NODE_ENV !== 'production') {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
        root: path.resolve(process.cwd(), 'frontend'),
      });
      app.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), 'frontend', 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Server running on http://0.0.0.0:${PORT}`);
      backfillPartOfSpeech().catch((error) => console.error('[partOfSpeech] backfill failed:', error));
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
