const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireContentManager } = require('../middleware/roles');
const { Course, CourseResource } = require('../models');
const { writeAuditLog } = require('../services/audit');
const { logger } = require('../logger');
import type { Request, Response } from 'express';

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

function serialize(resource: any) {
  const plain = typeof resource.toObject === 'function' ? resource.toObject() : resource;
  return {
    id: String(plain._id),
    courseId: String(plain.courseId),
    moduleId: plain.moduleId ? String(plain.moduleId) : undefined,
    lessonId: plain.lessonId ? String(plain.lessonId) : undefined,
    title: plain.title,
    url: plain.url,
    type: plain.type || 'download',
    isPublished: Boolean(plain.isPublished)
  };
}

router.get('/course/:courseId', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.courseId)) return res.status(400).json({ error: 'Invalid course id.' });
    const resources = await CourseResource.find({ courseId: req.params.courseId }).sort({ createdAt: -1 });
    res.json(resources.map(serialize));
  } catch (error) {
    logger.error({ err: error }, 'Error listing resources');
    res.status(500).json({ error: 'Failed to list resources.' });
  }
});

router.post('/', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    const { courseId, moduleId, lessonId, title, url, type, isPublished } = req.body || {};
    if (!isValidObjectId(courseId) || !String(title || '').trim() || !String(url || '').trim()) {
      return res.status(400).json({ error: 'courseId, title, and url are required.' });
    }
    if (!(await Course.exists({ _id: courseId }))) return res.status(404).json({ error: 'Course not found.' });

    const resource = await CourseResource.create({
      courseId,
      moduleId: isValidObjectId(moduleId) ? moduleId : undefined,
      lessonId: isValidObjectId(lessonId) ? lessonId : undefined,
      title,
      url,
      type: ['link', 'download', 'document', 'video', 'other'].includes(type) ? type : 'download',
      isPublished: isPublished === true
    });
    await writeAuditLog(req, { action: 'resource.create', entityType: 'CourseResource', entityId: resource._id, details: { courseId } });
    res.status(201).json(serialize(resource));
  } catch (error) {
    logger.error({ err: error }, 'Error creating resource');
    res.status(500).json({ error: 'Failed to create resource.' });
  }
});

router.patch('/:id', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid resource id.' });
    const updates: Record<string, unknown> = {};
    for (const key of ['moduleId', 'lessonId', 'title', 'url', 'type', 'isPublished']) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) updates[key] = req.body[key] || undefined;
    }
    const resource = await CourseResource.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    if (!resource) return res.status(404).json({ error: 'Resource not found.' });
    await writeAuditLog(req, { action: 'resource.update', entityType: 'CourseResource', entityId: resource._id, details: updates });
    res.json(serialize(resource));
  } catch (error) {
    logger.error({ err: error }, 'Error updating resource');
    res.status(500).json({ error: 'Failed to update resource.' });
  }
});

router.delete('/:id', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid resource id.' });
    const resource = await CourseResource.findByIdAndDelete(req.params.id);
    if (!resource) return res.status(404).json({ error: 'Resource not found.' });
    await writeAuditLog(req, { action: 'resource.delete', entityType: 'CourseResource', entityId: resource._id });
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Error deleting resource');
    res.status(500).json({ error: 'Failed to delete resource.' });
  }
});

module.exports = router;

export {};
