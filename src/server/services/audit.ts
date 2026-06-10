const { AuditLog } = require('../models');
const { logger } = require('../logger');
import type { Request } from 'express';

interface WriteAuditLogOptions {
  action: string;
  entityType: string;
  entityId?: unknown;
  details?: Record<string, unknown>;
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
      action: opts.action,
      entityType: opts.entityType,
      entityId,
      details: {
        result: 'success',
        ...(opts.details || {})
      },
      ip,
      userAgent,
    });
  } catch (error) {
    logger.error({ err: error }, 'Failed to write audit log entry');
  }
}

module.exports = { writeAuditLog };

export {};
