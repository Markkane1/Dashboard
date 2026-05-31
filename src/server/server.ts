require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env.local') });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { connectMongo } = require('./db/mongoose');
import type { NextFunction, Request, Response } from 'express';

const app = express();
const PORT = process.env.PORT || 5000;
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);
const cspConnectSources = ["'self'", ...allowedOrigins, 'https://challenges.cloudflare.com'];
const apiLimiter = rateLimit({
  windowMs: Number(process.env.API_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.API_RATE_LIMIT_MAX || 300),
  standardHeaders: true,
  legacyHeaders: false
});
const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS || 15 * 60 * 1000),
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX || 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many authentication attempts. Please try again later.' }
});

// 1. Core middlewares
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      formAction: ["'self'"],
      scriptSrc: ["'self'", 'https://challenges.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
      fontSrc: ["'self'", 'data:'],
      connectSrc: cspConnectSources,
      mediaSrc: ["'self'", ...allowedOrigins, 'blob:'],
      frameSrc: ['https://challenges.cloudflare.com'],
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

    callback(new Error('Not allowed by CORS'));
  }
}));
app.use(express.json());
app.use(cookieParser());
app.use('/api', apiLimiter);
app.use('/api/users/authenticate', authLimiter);
app.use('/api/users', (req: Request, res: Response, next: NextFunction) => {
  if (req.method === 'POST' && req.path === '/') {
    return authLimiter(req, res, next);
  }

  next();
});

// 2. API Routers Mount
app.use('/api/courses', require('./routes/courses'));
app.use('/api/taxonomies', require('./routes/taxonomies'));
app.use('/api/users', require('./routes/users'));
app.use('/api/lessons', require('./routes/lessons'));
app.use('/api/video', require('./routes/video'));
app.use('/api/progress', require('./routes/progress'));
app.use('/api/quiz', require('./routes/quiz'));
app.use('/api/docs', require('./routes/docs'));
app.use('/api/certificates', require('./routes/docs'));
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/analytics', require('./routes/analytics'));

// 3. Default error handling middleware
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled global server exception:", err);
  res.status(500).json({ error: "An unexpected error occurred on the server." });
});

// 4. Connect to Database (Optional standalone launch support)
if (process.env.NODE_ENV !== 'test') {
  connectMongo()
    .then(() => {
      console.log('MongoDB successfully connected.');
      app.listen(PORT, () => {
        console.log(`Express server running on port ${PORT}`);
      });
    })
    .catch((err: unknown) => {
      console.error('MongoDB database connection error:', err);
    });
}

module.exports = app;

export {};
