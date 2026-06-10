const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireContentManager } = require('../middleware/roles');
const { Course, CourseModule, Lesson } = require('../models');
const { writeAuditLog } = require('../services/audit');
const { logger } = require('../logger');
import type { Request, Response } from 'express';

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

function serialize(module: any) {
  const plain = typeof module.toObject === 'function' ? module.toObject() : module;
  return {
    id: String(plain._id),
    courseId: String(plain.courseId),
    title: plain.title,
    description: plain.description || '',
    order: plain.order || 0,
    isPublished: Boolean(plain.isPublished)
  };
}

router.get('/course/:courseId', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.courseId)) {
      return res.status(400).json({ error: 'Invalid course id.' });
    }

    const modules = await CourseModule.find({ courseId: req.params.courseId }).sort({ order: 1 });
    res.json(modules.map(serialize));
  } catch (error) {
    logger.error({ err: error }, 'Error listing course modules');
    res.status(500).json({ error: 'Failed to list modules.' });
  }
});

router.post('/', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    const { courseId, title, description, order, isPublished } = req.body || {};
    if (!isValidObjectId(courseId) || !String(title || '').trim()) {
      return res.status(400).json({ error: 'courseId and title are required.' });
    }
    const course = await Course.findById(courseId).select('_id');
    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    const module = await CourseModule.create({
      courseId,
      title,
      description,
      order: Number(order || 0),
      isPublished: isPublished === true
    });
    await writeAuditLog(req, { action: 'module.create', entityType: 'CourseModule', entityId: module._id, details: { courseId } });
    res.status(201).json(serialize(module));
  } catch (error) {
    logger.error({ err: error }, 'Error creating course module');
    res.status(500).json({ error: 'Failed to create module.' });
  }
});

router.patch('/:id', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid module id.' });
    }
    const updates: Record<string, unknown> = {};
    for (const key of ['title', 'description', 'order', 'isPublished']) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) {
        updates[key] = key === 'order' ? Number(req.body[key] || 0) : req.body[key];
      }
    }

    const module = await CourseModule.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    if (!module) {
      return res.status(404).json({ error: 'Module not found.' });
    }
    await writeAuditLog(req, { action: 'module.update', entityType: 'CourseModule', entityId: module._id, details: updates });
    res.json(serialize(module));
  } catch (error) {
    logger.error({ err: error }, 'Error updating course module');
    res.status(500).json({ error: 'Failed to update module.' });
  }
});

router.delete('/:id', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid module id.' });
    }

    const module = await CourseModule.findByIdAndDelete(req.params.id);
    if (!module) {
      return res.status(404).json({ error: 'Module not found.' });
    }
    await Lesson.updateMany({ moduleId: module._id }, { $unset: { moduleId: '' } });
    await writeAuditLog(req, { action: 'module.delete', entityType: 'CourseModule', entityId: module._id });
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Error deleting course module');
    res.status(500).json({ error: 'Failed to delete module.' });
  }
});

module.exports = router;

export {};
