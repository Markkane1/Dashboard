const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Lesson, Progress, User } = require('../models');

/**
 * GET /api/lessons/course/:courseId
 * Retrieve all published lessons for a specific course, including the user's progress.
 * Transcript field is excluded to keep the payload size small.
 */
router.get('/course/:courseId', auth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // 1. Authorization: Verify the requesting user is enrolled in this course
    const user = await User.findById(userId);
    if (!user || !user.enrolledCourses.includes(courseId)) {
      return res.status(403).json({ error: "Access denied. You must be enrolled in this course to view lessons." });
    }

    // 2. Fetch all published lessons for the course sorted by 'order' ascending
    const lessons = await Lesson.find({ courseId, isPublished: true })
      .sort({ order: 1 })
      .select('-transcript'); // Exclude heavy transcript text in list responses

    // 3. Fetch all progress records for the user within this specific course
    const progressList = await Progress.find({ userId, courseId });
    const progressMap = new Map(progressList.map(p => [p.lessonId.toString(), p]));

    // 4. Attach progress states to each lesson object
    const lessonsWithProgress = lessons.map(lesson => {
      const lessonObj = lesson.toObject();
      const progress = progressMap.get(lessonObj._id.toString());
      
      lessonObj.progress = {
        watchedSeconds: progress ? progress.watchedSeconds : 0,
        completed: progress ? progress.completed : false
      };
      
      return lessonObj;
    });

    res.json(lessonsWithProgress);
  } catch (error) {
    console.error("Error fetching course lessons:", error);
    res.status(500).json({ error: "Internal server error occurred while retrieving lessons." });
  }
});

/**
 * GET /api/lessons/:lessonId
 * Fetch full details of a specific lesson (including the full transcript) and current user progress.
 */
router.get('/:lessonId', auth, async (req, res) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;

    // 1. Fetch the target lesson details
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found." });
    }

    // 2. Authorization: Verify user enrollment in the course associated with this lesson
    const user = await User.findById(userId);
    if (!user || !user.enrolledCourses.includes(lesson.courseId.toString())) {
      return res.status(403).json({ error: "Access denied. You must be enrolled in this course to view this lesson." });
    }

    // 3. Fetch user progress document for this lesson
    const progress = await Progress.findOne({ userId, lessonId });

    // 4. Construct final response with progress metrics
    const lessonObj = lesson.toObject();
    lessonObj.progress = {
      watchedSeconds: progress ? progress.watchedSeconds : 0,
      completed: progress ? progress.completed : false
    };

    res.json(lessonObj);
  } catch (error) {
    console.error("Error fetching lesson details:", error);
    res.status(500).json({ error: "Internal server error occurred while retrieving lesson details." });
  }
});

module.exports = router;
