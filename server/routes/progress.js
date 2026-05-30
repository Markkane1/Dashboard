const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const { Progress, Lesson } = require('../models');

/**
 * POST /api/progress
 * Update lesson video playback watchedSeconds.
 * Automatically marks course/lesson as completed at 90%+ duration thresholds.
 * Runs in O(1) database queries when progress already exists.
 */
router.post('/', auth, async (req, res) => {
  try {
    const { lessonId, watchedSeconds, duration } = req.body;
    const userId = req.user.id;

    // 1. Validation Checks
    if (!lessonId || !mongoose.Types.ObjectId.isValid(lessonId)) {
      return res.status(400).json({ error: "A valid ObjectId lessonId is required." });
    }

    if (typeof watchedSeconds !== 'number' || watchedSeconds < 0) {
      return res.status(400).json({ error: "watchedSeconds must be a non-negative number." });
    }

    if (typeof duration !== 'number' || duration <= 0) {
      return res.status(400).json({ error: "duration must be a positive number." });
    }

    if (watchedSeconds > duration) {
      return res.status(400).json({ error: "watchedSeconds cannot exceed total video duration." });
    }

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
      // First-time progress track creation: Fetch parent course ID once
      const lesson = await Lesson.findById(lessonId);
      if (!lesson) {
        return res.status(404).json({ error: "Associated lesson not found." });
      }

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
router.get('/course/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // 1. Fetch total published lessons in the course
    const totalLessons = await Lesson.countDocuments({ courseId, isPublished: true });

    // 2. Fetch all progress records for the user within the course
    const progressRecords = await Progress.find({ userId, courseId });

    // 3. Compute completion statistics summary
    const completedLessons = progressRecords.filter(p => p.completed).length;
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
