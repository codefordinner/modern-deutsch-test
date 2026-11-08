import express from 'express';
import path from 'path';
import fs from 'fs';
import { execSync } from 'child_process';
import { createServer as createViteServer } from 'vite';
import { createApp } from './backend/src/app';
import { tuneSqlite } from './backend/src/db';
import { backfillPartOfSpeech } from './backend/src/services/backfillPartOfSpeech';
import { backfillNormalizedKeys } from './backend/src/services/backfillNormalizedKeys';
import { resumeAudioRegeneration } from './backend/src/services/audio';

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

    const app = createApp();
    const PORT = 3000;

    // Set TRUST_PROXY=1 when running behind a reverse proxy, so per-IP limits (login) see the real client IP.
    const trustProxy = Number(process.env.TRUST_PROXY ?? 0);
    if (trustProxy > 0) app.set('trust proxy', trustProxy);

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
      tuneSqlite()
        .catch((error) => console.error('[db] sqlite tuning failed:', error))
        .then(() => {
          backfillPartOfSpeech().catch((error) => console.error('[partOfSpeech] backfill failed:', error));
          backfillNormalizedKeys().catch((error) => console.error('[normalizedKeys] backfill failed:', error));
          resumeAudioRegeneration().catch((error) => console.error('[audio] regeneration resume failed:', error));
        });
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
