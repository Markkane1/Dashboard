const express = require('express');
const router = express.Router();
const { z } = require('zod');
const { logger } = require('../logger');
const { validateBody } = require('../middleware/validate');
import type { Request, Response } from 'express';

const clientLogSchema = z.object({
  level: z.enum(['debug', 'info', 'warn', 'error']).optional().default('info'),
  message: z.string().min(1).max(500),
  meta: z.unknown().optional(),
  url: z.string().max(2048).optional(),
  ts: z.string().max(80).optional(),
});

function redactClientValue(value: unknown, seen = new WeakSet<object>()): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string') {
    return value
      .replace(/([?&](?:token|code|resetToken|verificationToken|passwordResetTokenHash|pendingEmailTokenHash)=)[^\s&]+/gi, '$1[REDACTED]')
      .replace(/Bearer\s+[a-zA-Z0-9\-._~+/]+=*/gi, 'Bearer [REDACTED]');
  }
  if (typeof value !== 'object') return value;
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => redactClientValue(item, seen));
  }

  const redacted: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 50)) {
    const lowerKey = key.toLowerCase();
    if (
      lowerKey.includes('password') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('token') ||
      lowerKey.includes('authorization') ||
      lowerKey.includes('cookie') ||
      lowerKey.includes('key')
    ) {
      redacted[key] = '[REDACTED]';
    } else {
      redacted[key] = redactClientValue(child, seen);
    }
  }
  return redacted;
}

router.post('/', express.json({ limit: '16kb' }), (req: Request, res: Response) => {
  try {
    const body = validateBody(clientLogSchema, req, res);
    if (!body) return;
    const { level, message, url, ts } = body;
    const meta = redactClientValue(body.meta);
    const safeUrl = typeof url === 'string' ? redactClientValue(url) : undefined;

    if (level === 'error') {
      logger.error({ meta, url: safeUrl, ts }, message);
    } else if (level === 'warn') {
      logger.warn({ meta, url: safeUrl, ts }, message);
    } else if (level === 'debug') {
      logger.debug({ meta, url: safeUrl, ts }, message);
    } else {
      logger.info({ meta, url: safeUrl, ts }, message);
    }
    res.status(204).end();
  } catch (err) {
    logger.error({ err }, 'Failed to process client log');
    res.status(500).json({ error: 'Failed to process client log' });
  }
});

module.exports = router;
