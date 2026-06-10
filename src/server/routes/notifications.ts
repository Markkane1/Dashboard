const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/roles');
const { Notification, User } = require('../models');
const { logger } = require('../logger');
const { writeAuditLog } = require('../services/audit');
const { PERMISSIONS } = require('../../shared/permissions');
import type { Request, Response } from 'express';

type AuthenticatedRequest = Request & { user: NonNullable<Request['user']> };

const MAX_NOTIFICATION_LIMIT = 50;

function serializeNotification(notification: any) {
  const plain = typeof notification.toObject === 'function' ? notification.toObject() : notification;
  return {
    id: String(plain._id || plain.id),
    userId: String(plain.userId),
    type: plain.type || 'info',
    title: plain.title,
    message: plain.message,
    linkUrl: plain.linkUrl || '',
    readAt: plain.readAt ? plain.readAt.toISOString() : null,
    createdAt: plain.createdAt ? plain.createdAt.toISOString() : null
  };
}

function getLimit(value: unknown) {
  const limit = Number(value || 20);
  if (!Number.isFinite(limit)) {
    return 20;
  }

  return Math.min(Math.max(Math.floor(limit), 1), MAX_NOTIFICATION_LIMIT);
}

router.get('/', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const limit = getLimit(req.query.limit);
    const unreadOnly = req.query.unread === 'true';
    const filter: Record<string, unknown> = { userId: req.user.id };
    if (unreadOnly) {
      filter.readAt = { $exists: false };
    }

    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit);
    const unreadCount = await Notification.countDocuments({ userId: req.user.id, readAt: { $exists: false } });

    res.setHeader('X-Unread-Count', String(unreadCount));
    res.json(notifications.map(serializeNotification));
  } catch (error) {
    logger.error({ err: error }, 'Error fetching notifications');
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.post('/announce', auth, requirePermission(PERMISSIONS.ANNOUNCE_NOTIFICATIONS), async (req: AuthenticatedRequest, res: Response) => {
  try {
    const title = String(req.body.title || '').trim();
    const message = String(req.body.message || '').trim();
    const linkUrl = String(req.body.linkUrl || '').trim();
    if (!title || !message) {
      return res.status(400).json({ error: 'title and message are required' });
    }

    const users = await User.find({}).select('_id');
    if (users.length === 0) {
      return res.status(201).json({ createdCount: 0 });
    }

    const result = await Notification.insertMany(
      users.map((user: any) => ({
        userId: user._id,
        type: 'announcement',
        title,
        message,
        linkUrl
      })),
      { ordered: false }
    );

    await writeAuditLog(req, {
      action: 'notification.announce',
      entityType: 'Notification',
      entityId: 'broadcast',
      details: {
        result: 'success',
        oldValue: null,
        newValue: {
          title,
          message,
          linkUrl,
          recipientCount: result.length
        }
      }
    });
    res.status(201).json({ createdCount: result.length });
  } catch (error) {
    logger.error({ err: error }, 'Error creating announcement');
    res.status(500).json({ error: 'Failed to create announcement' });
  }
});

router.patch('/:id/read', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.id },
      { $set: { readAt: new Date() } },
      { new: true }
    );
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    res.json(serializeNotification(notification));
  } catch (error) {
    logger.error({ err: error }, 'Error marking notification read');
    res.status(500).json({ error: 'Failed to update notification' });
  }
});

module.exports = router;

export {};
