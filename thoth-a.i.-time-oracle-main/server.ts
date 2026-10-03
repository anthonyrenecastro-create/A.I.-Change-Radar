import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { createApp } from './server/app';
import { loadConfig } from './server/config';
import { openDb } from './server/db';
import { seedDemo } from './server/seed';

dotenv.config();

async function start() {
  const config = loadConfig();
  const db = openDb(config.databasePath);
  const app = createApp(db, config);

  if (config.seedDemoOnStart || config.allowPublicDemo) await seedDemo(db, config).catch(e => console.error('Demo seed failed:', e));

  if (config.enableLab) {
    const { mountLab } = await import('./server/lab');
    mountLab(app);
    console.warn('Legacy research lab endpoints are enabled (development only).');
  }

  if (!config.production) {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('/{*splat}', (_req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  app.listen(config.port, '0.0.0.0', () => console.log(`AZxAI Navigator listening on http://0.0.0.0:${config.port}`));
}

start().catch(err => { console.error(err); process.exit(1); });
