const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const { CourseFeedback, Enrollment } = require('../models');
const { writeAuditLog } = require('../services/audit');
const { logger } = require('../logger');
import type { Request, Response } from 'express';

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

router.get('/course/:courseId', auth, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.courseId)) return res.status(400).json({ error: 'Invalid course id.' });
    const feedback = await CourseFeedback.findOne({ userId: req.user?.id, courseId: req.params.courseId });
    res.json(feedback || null);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching feedback');
    res.status(500).json({ error: 'Failed to fetch feedback.' });
  }
});

router.post('/course/:courseId', auth, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.courseId)) return res.status(400).json({ error: 'Invalid course id.' });
    const rating = Number(req.body?.rating);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating must be between 1 and 5.' });
    }
    const enrollment = await Enrollment.findOne({ userId: req.user?.id, courseId: req.params.courseId });
    if (!enrollment) return res.status(403).json({ error: 'Enrollment is required to submit feedback.' });
    let feedback = await CourseFeedback.findOne({ userId: req.user?.id, courseId: req.params.courseId });
    const feedbackPayload = {
      userId: req.user?.id,
      courseId: req.params.courseId,
      rating,
      comments: String(req.body?.comments || '').trim(),
      answers: Array.isArray(req.body?.answers) ? req.body.answers : []
    };
    if (feedback) {
      Object.assign(feedback, feedbackPayload);
      await feedback.save();
    } else {
      feedback = await CourseFeedback.create(feedbackPayload);
    }
    await writeAuditLog(req, { action: 'feedback.submit', entityType: 'CourseFeedback', entityId: feedback._id, details: { courseId: req.params.courseId } });
    res.status(201).json(feedback);
  } catch (error) {
    logger.error({ err: error }, 'Error submitting feedback');
    res.status(500).json({ error: 'Failed to submit feedback.' });
  }
});

module.exports = router;

export {};
