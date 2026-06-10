const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/roles');
const { AuditLog } = require('../models');
const { PERMISSIONS } = require('../../shared/permissions');
const { logger } = require('../logger');
import type { Request, Response } from 'express';

router.get('/', auth, requirePermission(PERMISSIONS.VIEW_AUDIT_LOGS), async (req: Request, res: Response) => {
  try {
    const filter: Record<string, unknown> = {};
    for (const key of ['actorId', 'action', 'entityType', 'entityId']) {
      if (typeof req.query[key] === 'string' && req.query[key]) filter[key] = req.query[key];
    }
    if (typeof req.query.from === 'string' || typeof req.query.to === 'string') {
      filter.createdAt = {};
      if (typeof req.query.from === 'string') (filter.createdAt as Record<string, Date>).$gte = new Date(req.query.from);
      if (typeof req.query.to === 'string') (filter.createdAt as Record<string, Date>).$lte = new Date(req.query.to);
    }
    const limit = Math.min(Math.max(Number(req.query.limit || 100), 1), 500);
    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(limit);
    res.json(logs.map((log: any) => ({
      id: String(log._id),
      actorId: log.actorId ? String(log.actorId) : '',
      actorEmail: log.actorEmail || '',
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId || '',
      details: log.details || {},
      createdAt: log.createdAt
    })));
  } catch (error) {
    logger.error({ err: error }, 'Error listing audit logs');
    res.status(500).json({ error: 'Failed to list audit logs.' });
  }
});

module.exports = router;

export {};
