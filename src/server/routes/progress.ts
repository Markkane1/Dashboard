const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { z } = require('zod');
const auth = require('../middleware/auth');
const { Progress, Lesson } = require('../models');
const { hasCourseAccess } = require('../services/enrollments');
import type { Request, Response } from 'express';

type AuthenticatedRequest = Request & { user: NonNullable<Request['user']> };

const progressSchema = z.object({
  lessonId: z.string().refine((value: string) => mongoose.Types.ObjectId.isValid(value), {
    message: 'A valid ObjectId lessonId is required.'
  }),
  watchedSeconds: z.number().finite().min(0),
  duration: z.number().finite().positive().optional()
});

/**
 * POST /api/progress
 * Update lesson video playback watchedSeconds.
 * Automatically marks course/lesson as completed at 90%+ duration thresholds.
 * Runs in O(1) database queries when progress already exists.
 */
router.post('/', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = progressSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || "Invalid progress payload." });
    }

    const { lessonId } = parsed.data;
    const userId = req.user.id;

    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: "Associated lesson not found." });
    }

    if (!(await hasCourseAccess(req.user, lesson.courseId))) {
      return res.status(403).json({ error: "Access denied. You must be enrolled in this course to update progress." });
    }

    const dbDuration = Number(lesson.duration || 0);
    if (!dbDuration || dbDuration <= 0) {
      return res.status(400).json({ error: "Lesson duration is not configured." });
    }

    const watchedSeconds = Math.min(Math.floor(parsed.data.watchedSeconds), dbDuration);
    const duration = dbDuration;

    const completed = watchedSeconds >= (duration * 0.9);

    // 2. High-Performance Upsert Check:
    // Query Progress table first. If progress exists, execute direct save to avoid extra queries.
    let progress = await Progress.findOne({ userId, lessonId });

    if (progress) {
      progress.watchedSeconds = watchedSeconds;
      progress.duration = duration;
      progress.completed = completed;
      progress.lastWatchedAt = Date.now();
      await progress.save();
    } else {
      progress = new Progress({
        userId,
        courseId: lesson.courseId,
        lessonId,
        watchedSeconds,
        duration,
        completed,
        lastWatchedAt: Date.now()
      });
      await progress.save();
    }

    res.json(progress);
  } catch (error) {
    console.error("Error saving lesson progress:", error);
    res.status(500).json({ error: "Internal server error occurred while updating playback progress." });
  }
});

/**
 * GET /api/progress/course/:courseId
 * Fetch all progress logs and overall course statistics for the authenticated user.
 */
router.get('/course/:courseId', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    if (!(await hasCourseAccess(req.user, courseId))) {
      return res.status(403).json({ error: "Access denied. You must be enrolled in this course to view progress." });
    }

    // 1. Fetch total published lessons in the course
    const totalLessons = await Lesson.countDocuments({ courseId, isPublished: true });

    // 2. Fetch all progress records for the user within the course
    const progressRecords = await Progress.find({ userId, courseId });

    // 3. Compute completion statistics summary
    const completedLessons = progressRecords.filter((p: any) => p.completed).length;
    const percentComplete = totalLessons > 0 ? Math.round((completedLessons / totalLessons) * 100) : 0;

    res.json({
      progress: progressRecords,
      summary: {
        totalLessons,
        completedLessons,
        percentComplete
      }
    });
  } catch (error) {
    console.error("Error fetching course progress analytics:", error);
    res.status(500).json({ error: "Internal server error occurred while retrieving progress analytics." });
  }
});

module.exports = router;

export {};
