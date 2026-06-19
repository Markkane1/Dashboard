require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const { connectMongo } = require('./db/mongoose');
const { env } = require('./config/env');
const { requireAllowedMutationOrigin } = require('./middleware/security');
import type { NextFunction, Request, Response } from 'express';

const app = express();
app.disable('x-powered-by');
const PORT = process.env.PORT || 5000;
const { logger, pinoHttp } = require('./logger');
const allowedOrigins = (env.CORS_ALLOWED_ORIGINS || process.env.APP_URL || process.env.NEXTAUTH_URL || 'http://localhost:3000')
  .split(',')
  .map((origin: string) => origin.trim())
  .filter(Boolean);
const isDev = process.env.NODE_ENV !== 'production';
const cspConnectSources = ["'self'", ...allowedOrigins, 'https://challenges.cloudflare.com'];
const cspScriptSources = [
  "'self'",
  ...(isDev ? ["'unsafe-eval'"] : []),
  'https://challenges.cloudflare.com'
];
const apiLimiter = rateLimit({
  windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.API_RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false
});

const createAuthLimiter = () => rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

const clientLogLimiter = rateLimit({
  windowMs: Number(process.env.CLIENT_LOG_RATE_LIMIT_WINDOW_MS || 60 * 1000),
  limit: Number(process.env.CLIENT_LOG_RATE_LIMIT_MAX || 30),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many log requests. Please try again later.' }
});

const authLimiter = createAuthLimiter();
const verifyEmailLimiter = createAuthLimiter();
const passwordResetLimiter = createAuthLimiter();
const emailChangeLimiter = createAuthLimiter();
const resendVerificationLimiter = createAuthLimiter();

// 1. Core middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      scriptSrc: cspScriptSources,
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      styleSrcElem: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      connectSrc: cspConnectSources,
      mediaSrc: ["'self'", ...allowedOrigins, 'blob:'],
      frameSrc: ['https://challenges.cloudflare.com', 'https://www.youtube.com', 'https://www.youtube-nocookie.com'],
      workerSrc: ["'self'", 'blob:']
    }
  },
  crossOriginResourcePolicy: { policy: 'same-site' },
  frameguard: { action: 'deny' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));
app.use(cors({
  credentials: true,
  origin(origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
      return;
    }

    callback(null, false);
  }
}));
app.use(express.json({ limit: '10kb' }));
// Prevents HTTP Parameter Pollution (HPP) by resolving duplicate query array values to the last item
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.query) {
    for (const key in req.query) {
      if (Array.isArray(req.query[key])) {
        const arr = req.query[key] as any[];
        req.query[key] = arr[arr.length - 1];
      }
    }
  }
  next();
});
// Recursively cleans input strings from Null bytes, XSS tags, and javascript: protocols
function cleanInput(val: any, keyName?: string): any {
  if (typeof val === 'string') {
    let cleaned = val.replace(/\x00/g, '');
    const isPasswordField = keyName && /password/i.test(keyName);
    if (!isPasswordField) {
      cleaned = cleaned
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#x27;');
      if (/javascript\s*:/i.test(cleaned)) {
        cleaned = cleaned.replace(/javascript\s*:/gi, 'unsafe-javascript:');
      }
    }
    return cleaned;
  } else if (Array.isArray(val)) {
    return val.map((item) => cleanInput(item, keyName));
  } else if (typeof val === 'object' && val !== null) {
    const cleanedObj: any = {};
    for (const key in val) {
      cleanedObj[key] = cleanInput(val[key], key);
    }
    return cleanedObj;
  }
  return val;
}
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.body) req.body = cleanInput(req.body);
  if (req.query) req.query = cleanInput(req.query);
  if (req.params) req.params = cleanInput(req.params);
  next();
});
app.use(mongoSanitize());
app.use(pinoHttp);
app.use(cookieParser());
app.use('/api', apiLimiter);
app.use('/api', requireAllowedMutationOrigin);
app.use('/api/users/authenticate', authLimiter);
app.use('/api/users/verify-email', verifyEmailLimiter);
app.use('/api/users/password-reset/confirm', passwordResetLimiter);
app.use('/api/users/email-change/confirm', emailChangeLimiter);
app.use('/api/users/resend-verification', resendVerificationLimiter);
app.use('/api/client-logs', clientLogLimiter);
app.use('/api/users', (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' && req.path === '/') {
    return authLimiter(req, res, next);
  }

  next();
});

app.post('/api/auth/login', authLimiter, (req: Request, res: Response, next: NextFunction) => {
  req.url = '/api/users/authenticate';
  app.handle(req, res, next);
});

// 2. API Routers Mount
app.use('/api/courses', require('./routes/courses'));
app.use('/api/taxonomies', require('./routes/taxonomies'));
app.use('/api/users', require('./routes/users'));
app.use('/api/roles', require('./routes/roles'));
app.use('/api/modules', require('./routes/modules'));
app.use('/api/resources', require('./routes/resources'));
app.use('/api/assignments', require('./routes/assignments'));
app.use('/api/cohorts', require('./routes/cohorts'));
app.use('/api/lessons', require('./routes/lessons'));
app.use('/api/video', require('./routes/video'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/certificates', require('./routes/certificate-governance'));
app.use('/api/docs', require('./routes/docs'));
app.use('/api/certificates', require('./routes/docs'));
app.use('/api/feedback', require('./routes/feedback'));
app.use('/api/reports', require('./routes/reports'));
app.use('/api/audit-logs', require('./routes/audit-logs'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/analytics', require('./routes/analytics'));
app.use('/api/client-logs', require('./routes/client-logs'));

const auth = require('./middleware/auth');
const { requireAdmin } = require('./middleware/roles');
app.use('/api/admin', auth, requireAdmin, (req: Request, res: Response) => {
  res.status(404).json({ error: 'Admin route not found' });
});

// 3. Default error handling middleware
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err }, 'Unhandled global server exception');
  const status = err.status || err.statusCode || 500;
  const message = status === 413 ? 'Payload Too Large' : 'An unexpected error occurred on the server.';
  res.status(status).json({ error: message });
});

// 4. Connect to Database (Optional standalone launch support)
if (process.env.NODE_ENV !== 'test') {
  connectMongo()
    .then(() => {
      logger.info('MongoDB successfully connected.');
      app.listen(PORT, () => {
        logger.info({ port: PORT }, 'Express server running');
      });
    })
    .catch((err: unknown) => {
      logger.error({ err }, 'MongoDB database connection error');
    });
}

module.exports = app;

export {};
