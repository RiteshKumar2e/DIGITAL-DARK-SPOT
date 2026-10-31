import { rateLimit } from 'express-rate-limit';

const limiter = (windowMinutes, limit, message) =>
  rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    limit,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    handler: (req, res) =>
      res.status(429).json({ error: { code: 'rate_limited', message } }),
  });

export const apiLimiter = limiter(15, 600, 'Too many requests. Please wait a few minutes and try again.');
export const createSessionLimiter = limiter(60, 30, 'You have started many research sessions recently. Please wait before starting another.');
export const sourceLimiter = limiter(15, 60, 'Too many sources added in a short time. Please wait a few minutes.');
export const analyzeLimiter = limiter(15, 30, 'Too many analyses in a short time. Please wait a few minutes.');
