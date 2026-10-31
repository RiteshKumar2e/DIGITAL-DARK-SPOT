import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config/index.js';
import routes from './routes/index.js';
import { apiLimiter } from './middleware/rateLimits.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  app.set('trust proxy', config.trustProxy);

  // The API serves JSON only, so a strict CSP that forbids everything is safe.
  app.use(
    helmet({
      contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
      crossOriginResourcePolicy: { policy: 'same-site' },
      hsts: config.isProduction,
    }),
  );

  app.use(
    cors({
      origin(origin, callback) {
        // Requests without an Origin header (curl, server-to-server) are allowed;
        // browsers always send one for cross-origin calls.
        if (!origin || config.allowedOrigins.includes(origin)) return callback(null, true);
        return callback(new Error('CORS: origin not allowed'));
      },
      methods: ['GET', 'POST', 'PATCH', 'DELETE'],
      allowedHeaders: ['Content-Type'],
      maxAge: 600,
    }),
  );

  app.use(express.json({ limit: '200kb' }));
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    next();
  });

  app.use('/api', apiLimiter, routes);
  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
