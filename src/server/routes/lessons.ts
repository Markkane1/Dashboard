const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const multer = require('multer');
const ffmpeg = require('fluent-ffmpeg');
const auth = require('../middleware/auth');
const { Lesson, Progress, Course, User } = require('../models');
const { hasCourseAccess } = require('../services/enrollments');
const {
  VIDEO_STORAGE,
  getLocalVideoDir,
  getPublicVideoUrl
} = require('../services/videoStorage');
const { logger } = require('../logger');
const { hasPermission, PERMISSIONS } = require('../../shared/permissions');
const { writeAuditLog } = require('../services/audit');
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

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

function readVideoDuration(filePath: string): Promise<number | undefined> {
  return new Promise((resolve) => {
    ffmpeg.ffprobe(filePath, (error: Error | null, metadata: { format?: { duration?: number } }) => {
      if (error) {
        logger.warn({ err: error }, 'Unable to read uploaded video duration with ffprobe');
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
      logger.warn({ err: error }, 'Unable to clean up uploaded lesson video');
    }
  });
}

async function requireContentManager(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = await User.findById(req.user.id);
    if (!user || !hasPermission(req.user, PERMISSIONS.MANAGE_CONTENT)) {
      return res.status(403).json({ error: "Instructor access is required." });
    }

    req.contentManager = user;
    next();
  } catch (error) {
    logger.error({ err: error }, 'Error checking instructor permissions');
    res.status(500).json({ error: "Failed to verify instructor permissions." });
  }
}

function pickLessonFields(body: Record<string, unknown>) {
  const allowed: Record<string, unknown> = {};
  for (const key of ['courseId', 'moduleId', 'title', 'description', 'order', 'videoUrl', 'duration', 'resources', 'resourceIds', 'assignmentIds', 'transcript', 'isPublished']) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      allowed[key] = body[key];
    }
  }

  return allowed;
}

function validateLessonPayload(payload: Record<string, unknown>, partial = false) {
  if (!partial) {
    for (const field of ['courseId', 'title', 'order', 'videoUrl']) {
      if (payload[field] === undefined || payload[field] === '') {
        return `${field} is required`;
      }
    }
  }

  if (payload.order !== undefined) {
    const order = Number(payload.order);
    if (!Number.isFinite(order) || order < 0) {
      return 'order must be a non-negative number';
    }
    payload.order = Math.floor(order);
  }

  if (payload.duration !== undefined && payload.duration !== '') {
    const duration = Number(payload.duration);
    if (!Number.isFinite(duration) || duration < 0) {
      return 'duration must be a non-negative number';
    }
    payload.duration = Math.floor(duration);
  }
  for (const key of ['moduleId', 'resourceIds', 'assignmentIds']) {
    if (payload[key] !== undefined) {
      if (key === 'moduleId') {
        if (payload[key] && !mongoose.Types.ObjectId.isValid(String(payload[key]))) return 'moduleId must be a valid ObjectId';
      } else {
        if (!Array.isArray(payload[key])) return `${key} must be an array`;
        payload[key] = (payload[key] as unknown[]).map(String).filter((id) => mongoose.Types.ObjectId.isValid(id));
      }
    }
  }

  return null;
}

/**
 * GET /api/lessons/course/:courseId
 * Retrieve all published lessons for a specific course, including the user's progress.
 * Transcript field is excluded to keep the payload size small.
 */
router.get('/course/:courseId', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { courseId } = req.params;
    if (!isValidObjectId(courseId)) {
      return res.status(400).json({ error: "Invalid course id." });
    }

    const userId = req.user.id;

    // 1. Authorization: Verify the requesting user is enrolled in this course
    if (!(await hasCourseAccess(req.user, courseId))) {
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
    logger.error({ err: error }, 'Error fetching course lessons');
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
    if (!isValidObjectId(courseId)) {
      return res.status(400).json({ error: "Invalid course id." });
    }

    const lessons = await Lesson.find({ courseId }).sort({ order: 1 });
    res.json(lessons);
  } catch (error) {
    logger.error({ err: error }, 'Error fetching manageable course lessons');
    res.status(500).json({ error: "Internal server error occurred while retrieving lessons." });
  }
});

/**
 * POST /api/lessons
 * Create a lesson for a course.
 */
router.post('/', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    const payload = pickLessonFields(req.body || {});
    const validationError = validateLessonPayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const course = await Course.findById(payload.courseId).select('_id');
    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    const lesson = await Lesson.create(payload);
    await Course.findByIdAndUpdate(payload.courseId, { $inc: { lessonsCount: 1 } });
    await writeAuditLog(req, { action: 'lesson.create', entityType: 'Lesson', entityId: lesson._id, details: { courseId: payload.courseId, title: payload.title } });
    res.status(201).json(lesson);
  } catch (error) {
    logger.error({ err: error }, 'Error creating lesson');
    res.status(500).json({ error: 'Failed to create lesson.' });
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
      if (!isValidObjectId(lessonId)) {
        removeUploadedFile(req.file);
        return res.status(400).json({ error: "Invalid lesson id." });
      }

      const lesson = await Lesson.findById(lessonId);
      if (!lesson) {
        removeUploadedFile(req.file);
        return res.status(404).json({ error: "Lesson not found." });
      }

      if (!req.file) {
        return res.status(400).json({ error: "Video file is required in the 'video' form field." });
      }

      const oldValue = {
        videoUrl: lesson.videoUrl,
        duration: lesson.duration
      };
      const duration = await readVideoDuration(req.file.path);
      lesson.videoUrl = getPublicVideoUrl(req.file.filename);
      if (duration) {
        lesson.duration = duration;
      }

      await lesson.save();
      await writeAuditLog(req, {
        action: 'lesson.video-upload',
        entityType: 'Lesson',
        entityId: lesson._id,
        details: {
          result: 'success',
          lessonId,
          filename: req.file.filename,
          oldValue,
          newValue: {
            videoUrl: lesson.videoUrl,
            duration: lesson.duration
          }
        }
      });
      res.json(lesson);
    } catch (error) {
        removeUploadedFile(req.file);
        logger.error({ err: error }, 'Error uploading lesson video');
      res.status(500).json({ error: "Failed to upload lesson video." });
    }
  }
);

/**
 * PATCH /api/lessons/:lessonId
 * Update lesson metadata, ordering, publishing state, resources, or transcript.
 */
router.patch('/:lessonId', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.lessonId)) {
      return res.status(400).json({ error: 'Invalid lesson id.' });
    }

    const updates = pickLessonFields(req.body || {});
    delete updates.courseId;
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No allowed lesson fields provided.' });
    }

    const validationError = validateLessonPayload(updates, true);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const lesson = await Lesson.findByIdAndUpdate(
      req.params.lessonId,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found.' });
    }

    await writeAuditLog(req, { action: 'lesson.update', entityType: 'Lesson', entityId: lesson._id, details: { updatedFields: Object.keys(updates) } });
    res.json(lesson);
  } catch (error) {
    logger.error({ err: error }, 'Error updating lesson');
    res.status(500).json({ error: 'Failed to update lesson.' });
  }
});

/**
 * DELETE /api/lessons/:lessonId
 * Delete a lesson and related progress records.
 */
router.delete('/:lessonId', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.lessonId)) {
      return res.status(400).json({ error: 'Invalid lesson id.' });
    }

    const lesson = await Lesson.findByIdAndDelete(req.params.lessonId);
    if (!lesson) {
      return res.status(404).json({ error: 'Lesson not found.' });
    }

    await Promise.all([
      Progress.deleteMany({ lessonId: lesson._id }),
      Course.updateOne({ _id: lesson.courseId, lessonsCount: { $gt: 0 } }, { $inc: { lessonsCount: -1 } })
    ]);
    await writeAuditLog(req, { action: 'lesson.delete', entityType: 'Lesson', entityId: lesson._id, details: { courseId: lesson.courseId?.toString(), title: lesson.title } });
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Error deleting lesson');
    res.status(500).json({ error: 'Failed to delete lesson.' });
  }
});

/**
 * GET /api/lessons/:lessonId
 * Fetch full details of a specific lesson (including the full transcript) and current user progress.
 */
router.get('/:lessonId', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { lessonId } = req.params;
    if (!isValidObjectId(lessonId)) {
      return res.status(404).json({ error: "Lesson not found." });
    }

    const userId = req.user.id;

    // 1. Fetch the target lesson details
    const lesson = await Lesson.findById(lessonId);
    if (!lesson) {
      return res.status(404).json({ error: "Lesson not found." });
    }

    // 2. Authorization: Verify user enrollment in the course associated with this lesson
    if (!(await hasCourseAccess(req.user, lesson.courseId))) {
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
    logger.error({ err: error }, 'Error fetching lesson details');
    res.status(500).json({ error: "Internal server error occurred while retrieving lesson details." });
  }
});

module.exports = router;

export {};
