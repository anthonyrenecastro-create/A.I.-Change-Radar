import express, { type ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import type { AppConfig } from './config';
import type { Db } from './db';
import { authRouter, mutationGuard, requireSession, sessionMiddleware, teamRouter } from './auth';
import { billingRouter } from './billing';
import { HttpError, type Deps } from './http';
import { LocalPipelineAdapter, type ChangeFeedAdapter } from './radar';
import { decisionRouter } from './routes/decisions';
import { exposureRouter } from './routes/exposure';
import { historyRouter } from './routes/history';
import { planRouter } from './routes/plans';
import { workflowRouter } from './routes/workflows';

export function createApp(db: Db, config: AppConfig, feed: ChangeFeedAdapter = new LocalPipelineAdapter(db)) {
  const deps: Deps = { db, config, feed };
  const app = express();
  app.disable('x-powered-by');
  if (config.trustProxy) app.set('trust proxy', 1);

  app.use((_req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });

  // The webhook needs the raw body for signature verification, so it is mounted before the JSON parser.
  app.use('/api/billing', billingRouter(deps));
  app.use(express.json({ limit: '1mb' }));
  app.use(sessionMiddleware(deps));
  app.use('/api', mutationGuard);

  app.get('/api/health', (_req, res) => res.json({ status: 'ok', product: 'AZxAI Navigator', changeSource: feed.source }));
  app.use('/api/auth', authRouter(deps));
  app.use('/api/team', requireSession, teamRouter(deps));
  const secured = express.Router();
  secured.use(requireSession);
  secured.use(workflowRouter(deps));
  secured.use(exposureRouter(deps));
  secured.use(decisionRouter(deps));
  secured.use(planRouter(deps));
  secured.use(historyRouter(deps));
  app.use('/api', secured);
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'Not found', 'not_found')));

  const onError: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) return void res.status(err.status).json({ error: err.message, code: err.code });
    if (err instanceof ZodError) return void res.status(400).json({ error: 'Invalid input', code: 'validation', issues: err.issues.map(i => ({ path: i.path.join('.'), message: i.message })) });
    if ((err as { type?: string }).type === 'entity.parse.failed') return void res.status(400).json({ error: 'Malformed JSON', code: 'validation' });
    if ((err as { type?: string }).type === 'entity.too.large') return void res.status(413).json({ error: 'Request too large', code: 'too_large' });
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal error', code: 'internal' });
  };
  app.use(onError);
  return app;
}
