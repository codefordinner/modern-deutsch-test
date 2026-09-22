import express from 'express';
import cors from 'cors';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import apiRouter from './backend/src/api';

if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

async function startServer() {
  try {
    const app = express();
    const PORT = 3000;

    app.use(cors());
    app.use(express.json());

    // Mount API router
    const resolvedApi = (apiRouter && (apiRouter as any).default) || apiRouter;
    app.use('/api', resolvedApi);

    // API Health Check
    app.get('/api/health', (req, res) => {
      res.json({ status: 'ok', message: 'Backend is running!' });
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
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();
