const jwt = require('jsonwebtoken');
const { env } = require('../config/env');
import type { NextFunction, Request, Response } from 'express';
import type { JwtPayload } from 'jsonwebtoken';

const API_TOKEN_ISSUER = 'next-auth';
const API_TOKEN_AUDIENCE = 'express-api';
const API_TOKEN_USE = 'api';

/**
 * Express Authentication Middleware.
 * Decodes the JWT from the Authorization Header (Bearer token), and sets req.user.
 */
module.exports = function (req: Request, res: Response, next: NextFunction) {
  let token: string | null = null;
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No authentication token provided.' });
  }

  try {
    const decoded = jwt.verify(token, env.AUTH_SECRET, {
      issuer: API_TOKEN_ISSUER,
      audience: API_TOKEN_AUDIENCE
    });

    const payload = decoded as JwtPayload & {
      tokenUse?: string;
      id?: string;
      email?: string;
      role?: string;
      name?: string;
    };

    if (payload.tokenUse !== API_TOKEN_USE) {
      return res.status(401).json({ error: 'Authentication failed. Token is not an API access token.' });
    }
    
    req.user = {
      ...payload,
      id: String(payload.id || payload.sub || ''),
      email: payload.email,
      role: payload.role || 'student'
    };
    
    next();
  } catch (err) {
    const error = err instanceof Error ? err : new Error(String(err));
    console.error("JWT authentication verification failed:", error.message);
    res.status(401).json({ error: 'Authentication failed. Token is invalid or expired.' });
  }
};

export {};
