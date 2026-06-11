const { env } = require('../config/env');
import type { NextFunction, Request, Response } from 'express';

const MUTATING_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

function normalizeOrigin(value: string | undefined | null): string | null {
  if (!value) return null;

  try {
    return new URL(value).origin;
  } catch {
    return null;
  }
}

function splitOrigins(value: string | undefined): string[] {
  return String(value || '')
    .split(',')
    .map((origin) => normalizeOrigin(origin.trim()))
    .filter((origin): origin is string => Boolean(origin));
}

function getAllowedOrigins(): string[] {
  const fallbackOrigins = process.env.NODE_ENV === 'production' ? [] : ['http://localhost:3000'];
  return [
    ...splitOrigins(env.CORS_ALLOWED_ORIGINS),
    normalizeOrigin(process.env.APP_URL),
    normalizeOrigin(process.env.NEXTAUTH_URL),
    ...fallbackOrigins,
  ].filter((origin, index, origins): origin is string => Boolean(origin) && origins.indexOf(origin) === index);
}

function hasBearerToken(req: Request): boolean {
  return typeof req.headers.authorization === 'string' && req.headers.authorization.startsWith('Bearer ');
}

function getRequestOrigin(req: Request): string | null {
  return normalizeOrigin(req.headers.origin) || normalizeOrigin(req.headers.referer);
}

function isBrowserLikeMutation(req: Request): boolean {
  return Boolean(req.headers.origin || req.headers.referer || req.headers['sec-fetch-site']);
}

function requireAllowedMutationOrigin(req: Request, res: Response, next: NextFunction) {
  if (!MUTATING_METHODS.has(req.method)) {
    return next();
  }

  const requestOrigin = getRequestOrigin(req);
  if (requestOrigin) {
    if (getAllowedOrigins().includes(requestOrigin)) {
      return next();
    }

    return res.status(403).json({ error: 'Invalid request origin.' });
  }

  if (isBrowserLikeMutation(req)) {
    return res.status(403).json({ error: 'Invalid request origin.' });
  }

  if (hasBearerToken(req)) {
    return next();
  }

  return res.status(403).json({ error: 'Invalid request origin.' });
}

module.exports = {
  getAllowedOrigins,
  requireAllowedMutationOrigin,
};

export {};
