const { AuditLog } = require('../models');
const { logger } = require('../logger');
import type { Request } from 'express';

interface WriteAuditLogOptions {
  action: string;
  entityType: string;
  entityId?: unknown;
  details?: Record<string, unknown>;
}

const REDACTED = '[REDACTED]';

function isSensitiveAuditKey(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[^a-z0-9]/g, '');
  return normalized === 'password'
    || normalized.includes('passwordhash')
    || normalized.includes('passwordresettoken')
    || normalized.includes('tokenhash')
    || normalized.endsWith('token')
    || normalized.includes('secret')
    || normalized.includes('credential')
    || normalized.includes('authorization')
    || normalized.includes('cookie')
    || normalized.includes('apikey')
    || normalized.includes('verificationtoken');
}

function sanitizeAuditValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAuditValue(item));
  }

  if (!value || typeof value !== 'object') {
    return value;
  }

  if (value instanceof Date) {
    return value;
  }

  const output: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value as Record<string, unknown>)) {
    output[key] = isSensitiveAuditKey(key) ? REDACTED : sanitizeAuditValue(nestedValue);
  }
  return output;
}

function getPrimaryRole(user: any): string {
  if (!user) return '';
  if (typeof user.role === 'string' && user.role) return user.role;
  if (Array.isArray(user.roles) && user.roles.length > 0) return String(user.roles[0] || '');
  return '';
}

/**
 * Government-grade audit logger.
 * Captures: actor (id + email), target record (type + id),
 * old/new values embedded in details, IP, User-Agent, and timestamp.
 * Failures are swallowed so a logging error never crashes a core endpoint.
 */
async function writeAuditLog(req: Request, opts: WriteAuditLogOptions): Promise<void> {
  try {
    const actorId = req.user?.id;
    const actorEmail = req.user?.email || '';
    const actorRole = getPrimaryRole(req.user);
    const sanitizedDetails = sanitizeAuditValue(opts.details || {}) as Record<string, unknown>;
    const result = sanitizedDetails.result === 'failure' ? 'failure' : 'success';

    // Resolve client IP, respecting reverse-proxy headers
    const rawIp =
      req.headers['x-forwarded-for'] ||
      req.headers['x-real-ip'] ||
      req.socket?.remoteAddress ||
      req.ip ||
      '';
    const ip = Array.isArray(rawIp)
      ? rawIp[0].split(',')[0].trim()
      : typeof rawIp === 'string'
      ? rawIp.split(',')[0].trim()
      : '';

    const userAgent = req.headers['user-agent'] || '';
    const entityId = opts.entityId !== undefined ? String(opts.entityId) : '';

    await AuditLog.create({
      actorId: actorId && actorId !== 'internal-service' ? actorId : undefined,
      actorEmail,
      actorRole,
      action: opts.action,
      entityType: opts.entityType,
      entityId,
      details: {
        result,
        ...sanitizedDetails
      },
      oldValue: sanitizedDetails.oldValue,
      newValue: sanitizedDetails.newValue,
      result,
      ip,
      ipAddress: ip,
      userAgent,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to write audit log entry');
  }
}

module.exports = { writeAuditLog };

export {};
