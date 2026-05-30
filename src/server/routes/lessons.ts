const express = require('express');
const router = express.Router();
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const auth = require('../middleware/auth');
const { Lesson, Progress, User } = require('../models');
const { isEnrolled } = require('../services/enrollments');
const {
  VIDEO_STORAGE,
  getLocalVideoDir,
  getPublicVideoUrl
} = require('../services/videoStorage');
import type { NextFunction, Request, Response } from 'express';
import type { FileFilterCallback } from 'multer';

type AuthenticatedRequest = Request & { user: NonNullable<Request['user']> };

const storage = multer.diskStorage({
  destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => cb(null, getLocalVideoDir()),
  filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '-');
    cb(null, `${Date.now()}-${safeName}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    if (file.mimetype !== 'video/mp4') {
      return cb(new Error('Only MP4 video uploads are supported.'));
    }

    cb(null, true);
  }
});

function readVideoDuration(filePath: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (error: Error | null, metadata: { format?: { duration?: number } }) => {
      if (error) {
        console.warn("Unable to read uploaded video duration with ffprobe:", error.message);
        resolve(undefined);
        return;
      }

      resolve(Math.round(metadata.format?.duration || 0));
    });
  });
}

function removeUploadedFile(file?: Express.Multer.File) {
  if (!file?.path) return;

  require('fs').unlink(file.path, (error: NodeJS.ErrnoException | null) => {
    if (error) {
      console.warn("Unable to clean up uploaded lesson video:", error.message);
    }
  });
}

async function requireContentManager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
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
router.get('/course/:courseId', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // 1. Authorization: Verify the requesting user is enrolled in this course
    if (!(await isEnrolled(userId, courseId))) {
      return res.status(403).json({ error: "Access denied. You must be enrolled in this course to view lessons." });
    }

    // 2. Fetch all published lessons for the course sorted by 'order' ascending
    const lessons = await Lesson.find({ courseId, isPublished: true })
      .sort({ order: 1 })
      .select('-transcript'); // Exclude heavy transcript text in list responses

    // 3. Fetch all progress records for the user within this specific course
    const progressList = await Progress.find({ userId, courseId });
    const progressMap = new Map<string, any>(progressList.map((p: any) => [p.lessonId.toString(), p]));

    // 4. Attach progress states to each lesson object
    const lessonsWithProgress = lessons.map((lesson: any) => {
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
router.get('/manage/course/:courseId', auth, requireContentManager, async (req: Request, res: Response) => {
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
  (_req: Request, res: Response, next: NextFunction) => {
    if (VIDEO_STORAGE !== 'local') {
      return res.status(501).json({ error: "Configured video storage provider is not implemented for direct uploads yet." });
    }

    next();
  },
  upload.single('video'),
  async (req: AuthenticatedRequest & { file?: Express.Multer.File }, res: Response) => {
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
router.get('/:lessonId', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lessonId } = req.params;
    const userId = req.user.id;

    // 1. Fetch the target lesson details
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found." });
    }

    // 2. Authorization: Verify user enrollment in the course associated with this lesson
    if (!(await isEnrolled(userId, lesson.courseId))) {
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

export {};
