const express = require('express');
const router = express.Router();
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const auth = require('../middleware/auth');
const { Lesson, Progress, User } = require('../models');
const {
  VIDEO_STORAGE,
  getLocalVideoDir,
  getPublicVideoUrl
} = require('../services/videoStorage');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, getLocalVideoDir()),
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== 'video/mp4') {
      return cb(new Error('Only MP4 video uploads are supported.'));
    }

    cb(null, true);
  }
});

function readVideoDuration(filePath) {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (error, metadata) => {
      if (error) {
        console.warn("Unable to read uploaded video duration with ffprobe:", error.message);
        resolve(undefined);
        return;
      }

      resolve(Math.round(metadata.format.duration || 0));
    });
  });
}

function removeUploadedFile(file) {
  if (!file?.path) return;

  require('fs').unlink(file.path, (error) => {
    if (error) {
      console.warn("Unable to clean up uploaded lesson video:", error.message);
    }
  });
}

async function requireContentManager(req, res, next) {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !['admin', 'instructor'].includes(user.role)) {
      return res.status(403).json({ error: "Instructor access is required." });
    }

    req.contentManager = user;
    next();
  } catch (error) {
    console.error("Error checking instructor permissions:", error);
    res.status(500).json({ error: "Failed to verify instructor permissions." });
  }
}

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
 * GET /api/lessons/manage/course/:courseId
 * Instructor/admin lesson listing for content management.
 */
router.get('/manage/course/:courseId', auth, requireContentManager, async (req, res) => {
  try {
    const { courseId } = req.params;
    const lessons = await Lesson.find({ courseId }).sort({ order: 1 });
    res.json(lessons);
  } catch (error) {
    console.error("Error fetching manageable course lessons:", error);
    res.status(500).json({ error: "Internal server error occurred while retrieving lessons." });
  }
});

/**
 * POST /api/lessons/:lessonId/upload
 * Upload an MP4 video for a lesson and update its videoUrl/duration metadata.
 */
router.post(
  '/:lessonId/upload',
  auth,
  requireContentManager,
  (req, res, next) => {
    if (VIDEO_STORAGE !== 'local') {
      return res.status(501).json({ error: "Configured video storage provider is not implemented for direct uploads yet." });
    }

    next();
  },
  upload.single('video'),
  async (req, res) => {
    try {
      const { lessonId } = req.params;
      const lesson = await Lesson.findById(lessonId);
      if (!lesson) {
        removeUploadedFile(req.file);
        return res.status(404).json({ error: "Lesson not found." });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Video file is required in the 'video' form field." });
      }

      const duration = await readVideoDuration(req.file.path);
      lesson.videoUrl = getPublicVideoUrl(req.file.filename);
      if (duration) {
        lesson.duration = duration;
      }

      await lesson.save();
      res.json(lesson);
    } catch (error) {
      removeUploadedFile(req.file);
      console.error("Error uploading lesson video:", error);
      res.status(500).json({ error: "Failed to upload lesson video." });
    }
  }
);

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
