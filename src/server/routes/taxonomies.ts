const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Taxonomy = require('../models/Taxonomy');
const auth = require('../middleware/auth');
const { requireAdmin } = require('../middleware/roles');
const { logger } = require('../logger');
import type { Request, Response } from 'express';

type TaxonomyType = 'category' | 'sdg' | 'section' | 'topic';

type TaxonomyBody = {
  type?: unknown;
  key?: unknown;
  label?: unknown;
  description?: unknown;
  order?: unknown;
  active?: unknown;
  metadata?: unknown;
};

function sanitizeType(value: unknown): TaxonomyType | null {
  const type = String(value || '').trim().toLowerCase();
  return ['category', 'sdg', 'section', 'topic'].includes(type) ? type as TaxonomyType : null;
}

function normalizeItem(item: any) {
  return {
    id: String(item._id || item.id),
    type: item.type,
    key: item.key,
    label: item.label,
    description: item.description || '',
    order: Number(item.order || 0),
    active: Boolean(item.active),
    metadata: item.metadata || {},
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}

router.get('/', async (req: Request, res: Response) => {
  try {
    const type = sanitizeType(req.query.type);
    const filter = type ? { type, active: true } : { active: true };
    const items = await Taxonomy.find(filter).sort({ order: 1, label: 1 });
    res.json(items.map(normalizeItem));
  } catch (error) {
    logger.error({ err: error }, 'Error fetching taxonomy items');
    res.status(500).json({ error: 'Failed to load taxonomy items' });
  }
});

router.post('/', auth, requireAdmin, async (req: Request<Record<string, string>, unknown, TaxonomyBody>, res: Response) => {
  try {
    const type = sanitizeType(req.body?.type);
    const key = String(req.body?.key || '').trim();
    const label = String(req.body?.label || '').trim();
    const description = String(req.body?.description || '').trim();
    const order = Number(req.body?.order || 0);
    const active = req.body?.active !== undefined ? Boolean(req.body?.active) : true;
    const metadata = req.body?.metadata || {};

    if (!type || !key || !label) {
      return res.status(400).json({ error: 'type, key, and label are required' });
    }

    const item = await Taxonomy.create({ type, key, label, description, order, active, metadata });
    res.status(201).json(normalizeItem(item));
  } catch (error: unknown) {
    logger.error({ err: error }, 'Error creating taxonomy item');
    if ((error as { code?: number }).code === 11000) {
      return res.status(409).json({ error: 'Taxonomy item already exists for this type and key' });
    }
    res.status(500).json({ error: 'Failed to create taxonomy item' });
  }
});

router.patch('/:id', auth, requireAdmin, async (req: Request<{ id: string }, unknown, TaxonomyBody>, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid taxonomy id' });
    }

    const updates: Record<string, unknown> = {};
    const type = sanitizeType(req.body?.type);
    if (type) updates.type = type;
    if (req.body?.key !== undefined) updates.key = String(req.body.key || '').trim();
    if (req.body?.label !== undefined) updates.label = String(req.body.label || '').trim();
    if (req.body?.description !== undefined) updates.description = String(req.body.description || '').trim();
    if (req.body?.order !== undefined) updates.order = Number(req.body.order || 0);
    if (req.body?.active !== undefined) updates.active = Boolean(req.body.active);
    if (req.body?.metadata !== undefined) updates.metadata = req.body.metadata;

    const item = await Taxonomy.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    if (!item) {
      return res.status(404).json({ error: 'Taxonomy item not found' });
    }

    res.json(normalizeItem(item));
  } catch (error) {
    logger.error({ err: error }, 'Error updating taxonomy item');
    res.status(500).json({ error: 'Failed to update taxonomy item' });
  }
});

router.delete('/:id', auth, requireAdmin, async (req: Request<{ id: string }>, res: Response) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: 'Invalid taxonomy id' });
    }

    const deleted = await Taxonomy.findByIdAndDelete(req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Taxonomy item not found' });
    }

    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Error deleting taxonomy item');
    res.status(500).json({ error: 'Failed to delete taxonomy item' });
  }
});

module.exports = router;

export {};
