const express = require('express');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
const multer = require('multer');
const router = express.Router();
const auth = require('../middleware/auth');
const { requireContentManager } = require('../middleware/roles');
const { Assignment, AssignmentSubmission, Cohort, Course, Enrollment } = require('../models');
const { hasCourseAccess } = require('../services/enrollments');
const { writeAuditLog } = require('../services/audit');
const { hasPermission, PERMISSIONS, USER_ROLES } = require('../../shared/permissions');
const { logger } = require('../logger');
import type { NextFunction, Request, Response } from 'express';
import type { FileFilterCallback } from 'multer';

type AuthenticatedRequest = Request & { user: NonNullable<Request['user']> };

const assignmentUploadDir = path.resolve(process.cwd(), 'uploads', 'assignments');
fs.mkdirSync(assignmentUploadDir, { recursive: true });

function stripExif(buffer: Buffer): Buffer {
  if (buffer.length < 4) return buffer;
  if (buffer[0] !== 0xFF || buffer[1] !== 0xD8) {
    return buffer;
  }

  const chunks: Buffer[] = [];
  chunks.push(buffer.subarray(0, 2)); // Add SOI

  let offset = 2;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xFF) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    const marker = buffer[offset + 1];
    if (marker === 0xD9) { // EOI
      chunks.push(buffer.subarray(offset, offset + 2));
      break;
    }

    if (marker === 0x00 || (marker >= 0xD0 && marker <= 0xD7) || marker === 0x01) {
      chunks.push(buffer.subarray(offset, offset + 2));
      offset += 2;
      continue;
    }

    if (offset + 4 > buffer.length) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    const length = buffer.readUInt16BE(offset + 2);
    const nextOffset = offset + 2 + length;

    if (nextOffset > buffer.length) {
      chunks.push(buffer.subarray(offset));
      break;
    }

    if (marker === 0xE1) {
      // Skip APP1 segment (EXIF)
    } else {
      chunks.push(buffer.subarray(offset, nextOffset));
    }

    offset = nextOffset;
  }

  return Buffer.concat(chunks);
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req: Request, _file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => cb(null, assignmentUploadDir),
    filename: (_req: Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
      const baseName = path.basename(file.originalname);
      const safeName = baseName.replace(/[^a-zA-Z0-9._-]/g, '-');
      cb(null, `${Date.now()}-${safeName}`);
    }
  }),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req: Request, file: Express.Multer.File, cb: FileFilterCallback) => {
    const allowed = [
      'application/pdf',
      'image/jpeg',
      'image/png',
      'text/plain',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    if (!allowed.includes(file.mimetype)) {
      return cb(new Error('Unsupported assignment evidence file type.'));
    }

    const originalName = file.originalname;
    const ext = path.extname(originalName).toLowerCase();
    const allowedExtensions = ['.pdf', '.jpg', '.jpeg', '.png', '.txt', '.doc', '.docx'];

    if (!ext || !allowedExtensions.includes(ext)) {
      return cb(new Error('Unsupported assignment evidence file type.'));
    }

    // Check for double extension bypass
    const parts = originalName.toLowerCase().split('.');
    if (parts.length > 2) {
      const executableExtensions = ['js', 'sh', 'php', 'py', 'exe', 'bat', 'cmd'];
      for (let i = 1; i < parts.length - 1; i++) {
        if (executableExtensions.includes(parts[i])) {
          return cb(new Error('Potential double extension bypass detected.'));
        }
      }
      const actualExt = parts[parts.length - 1];
      if (!allowedExtensions.includes(`.${actualExt}`)) {
        return cb(new Error('Unsupported assignment evidence file type.'));
      }
    }

    cb(null, true);
  }
});

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

function serialize(assignment: any, submission?: any) {
  const plain = typeof assignment.toObject === 'function' ? assignment.toObject() : assignment;
  return {
    id: String(plain._id),
    courseId: String(plain.courseId),
    moduleId: plain.moduleId ? String(plain.moduleId) : undefined,
    lessonId: plain.lessonId ? String(plain.lessonId) : undefined,
    title: plain.title,
    instructions: plain.instructions || '',
    resourceIds: (plain.resourceIds || []).map(String),
    dueAt: plain.dueAt,
    status: plain.status || 'draft',
    mySubmission: submission ? serializeSubmission(submission) : undefined
  };
}

function serializeSubmission(submission: any) {
  const plain = typeof submission.toObject === 'function' ? submission.toObject() : submission;
  return {
    id: String(plain._id),
    assignmentId: String(plain.assignmentId),
    courseId: String(plain.courseId),
    learnerId: String(plain.learnerId?._id || plain.learnerId),
    learnerName: plain.learnerId?.name,
    learnerEmail: plain.learnerId?.email,
    text: plain.text || '',
    linkUrl: plain.linkUrl || '',
    fileUrl: plain.fileUrl || '',
    fileName: plain.fileName || '',
    fileMimeType: plain.fileMimeType || '',
    status: plain.status || 'submitted',
    reviewedBy: plain.reviewedBy ? String(plain.reviewedBy) : undefined,
    reviewedAt: plain.reviewedAt,
    reviewComments: plain.reviewComments || '',
    history: (plain.history || []).map((item: any) => ({
      status: item.status,
      actorId: item.actorId ? String(item.actorId) : undefined,
      comments: item.comments || '',
      createdAt: item.createdAt
    })),
    submittedAt: plain.createdAt,
    updatedAt: plain.updatedAt
  };
}

async function canReviewAssignments(req: AuthenticatedRequest, courseId: unknown) {
  if (req.user.role === USER_ROLES.ADMIN) return true;
  if (hasPermission(req.user, PERMISSIONS.MANAGE_CONTENT) && req.user.role !== USER_ROLES.INSTRUCTOR) return true;
  if (req.user.role !== USER_ROLES.INSTRUCTOR) return false;
  if (!isValidObjectId(String(courseId))) return false;
  const course = await Course.findById(courseId).select('trainerIds instructorId');
  if (!course) return false;
  const userId = String(req.user.id);
  if (String(course.instructorId || '') === userId) return true;
  if ((course.trainerIds || []).map(String).includes(userId)) return true;
  return Boolean(await Cohort.exists({ courseIds: course._id, trainerIds: userId, status: { $in: ['active', 'completed'] } }));
}

async function requireAssignmentReviewer(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const submission = await AssignmentSubmission.findById(req.params.submissionId || req.params.id);
    if (!submission) return res.status(404).json({ error: 'Assignment submission not found.' });
    if (!(await canReviewAssignments(req, submission.courseId))) {
      return res.status(403).json({ error: 'Assignment reviewer access is required.' });
    }
    req.assignmentSubmission = submission;
    next();
  } catch (error) {
    logger.error({ err: error }, 'Error checking assignment reviewer access');
    res.status(500).json({ error: 'Failed to verify assignment reviewer access.' });
  }
}

router.get('/course/:courseId', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.courseId)) return res.status(400).json({ error: 'Invalid course id.' });
    const reviewer = await canReviewAssignments(req, req.params.courseId);
    const learnerAccess = await hasCourseAccess(req.user, req.params.courseId);
    if (!reviewer && !learnerAccess) return res.status(403).json({ error: 'Access denied.' });

    const query = reviewer ? { courseId: req.params.courseId } : { courseId: req.params.courseId, status: 'published' };
    const assignments = await Assignment.find(query).sort({ dueAt: 1, createdAt: -1 });
    if (reviewer) return res.json(assignments.map((assignment: any) => serialize(assignment)));

    const submissions = await AssignmentSubmission.find({
      courseId: req.params.courseId,
      learnerId: req.user.id,
      assignmentId: { $in: assignments.map((assignment: any) => assignment._id) }
    });
    const submissionMap = new Map(submissions.map((submission: any) => [String(submission.assignmentId), submission]));
    res.json(assignments.map((assignment: any) => serialize(assignment, submissionMap.get(String(assignment._id)))));
  } catch (error) {
    logger.error({ err: error }, 'Error listing assignments');
    res.status(500).json({ error: 'Failed to list assignments.' });
  }
});

router.post('/', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    const { courseId, moduleId, lessonId, title, instructions, resourceIds, dueAt, status } = req.body || {};
    if (!isValidObjectId(courseId) || !String(title || '').trim()) {
      return res.status(400).json({ error: 'courseId and title are required.' });
    }
    if (!(await Course.exists({ _id: courseId }))) return res.status(404).json({ error: 'Course not found.' });
    const assignment = await Assignment.create({
      courseId,
      moduleId: isValidObjectId(moduleId) ? moduleId : undefined,
      lessonId: isValidObjectId(lessonId) ? lessonId : undefined,
      title,
      instructions,
      resourceIds: Array.isArray(resourceIds) ? resourceIds.filter(isValidObjectId) : [],
      dueAt: dueAt ? new Date(dueAt) : undefined,
      status: ['draft', 'published', 'archived'].includes(status) ? status : 'draft'
    });
    await writeAuditLog(req, { action: 'assignment.create', entityType: 'Assignment', entityId: assignment._id, details: { courseId } });
    res.status(201).json(serialize(assignment));
  } catch (error) {
    logger.error({ err: error }, 'Error creating assignment');
    res.status(500).json({ error: 'Failed to create assignment.' });
  }
});

router.post(
  '/:id/submissions',
  auth,
  (req: Request, res: Response, next: NextFunction) => {
    upload.single('file')(req, res, (err: any) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(413).json({ error: 'File size exceeds limit.' });
          }
          return res.status(400).json({ error: `Upload error: ${err.message}` });
        }
        return res.status(400).json({ error: err.message || 'Failed to upload file.' });
      }
      next();
    });
  },
  async (req: AuthenticatedRequest & { file?: Express.Multer.File }, res: Response) => {
    try {
      if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid assignment id.' });
      const assignment = await Assignment.findOne({ _id: req.params.id, status: 'published' });
      if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
      if (!(await hasCourseAccess(req.user, assignment.courseId.toString()))) {
        return res.status(403).json({ error: 'You must be enrolled in this course to submit assignments.' });
      }
      if (!(await Enrollment.exists({ userId: req.user.id, courseId: assignment.courseId }))) {
        return res.status(403).json({ error: 'Course enrollment is required.' });
      }

      const text = String(req.body?.text || '').trim();
      const linkUrl = String(req.body?.linkUrl || '').trim();
      if (!text && !linkUrl && !req.file) return res.status(400).json({ error: 'Submit text, a link, or a file.' });

      // Strip EXIF metadata if it's a JPEG image
      if (req.file && (req.file.mimetype === 'image/jpeg' || req.file.mimetype === 'image/jpg')) {
        try {
          const filePath = req.file.path;
          const buffer = await fs.promises.readFile(filePath);
          const cleanBuffer = stripExif(buffer);
          await fs.promises.writeFile(filePath, cleanBuffer);
        } catch (err) {
          logger.error({ err }, 'Failed to strip EXIF metadata from uploaded assignment');
        }
      }

      let submission = await AssignmentSubmission.findOne({ assignmentId: assignment._id, learnerId: req.user.id });
      const submissionUpdate = {
        courseId: assignment.courseId,
        text,
        linkUrl,
        fileUrl: req.file ? `/uploads/assignments/${req.file.filename}` : undefined,
        fileName: req.file?.originalname || undefined,
        fileMimeType: req.file?.mimetype || undefined,
        status: 'submitted',
        reviewedBy: undefined,
        reviewedAt: undefined,
        reviewComments: ''
      };
      if (submission) {
        Object.assign(submission, submissionUpdate);
        submission.history.push({
          status: 'submitted',
          actorId: req.user.id,
          comments: 'Submitted by learner.'
        });
        await submission.save();
      } else {
        submission = await AssignmentSubmission.create({
          assignmentId: assignment._id,
          learnerId: req.user.id,
          ...submissionUpdate,
          history: [{
            status: 'submitted',
            actorId: req.user.id,
            comments: 'Submitted by learner.'
          }]
        });
      }
      await writeAuditLog(req, { action: 'assignment.submit', entityType: 'AssignmentSubmission', entityId: submission._id, details: { assignmentId: assignment._id, courseId: assignment.courseId } });
      res.status(201).json(serializeSubmission(submission));
    } catch (error) {
      logger.error({ err: error }, 'Error submitting assignment');
      res.status(500).json({ error: 'Failed to submit assignment.' });
    }
  }
);

router.get('/:id/submissions', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid assignment id.' });
    const assignment = await Assignment.findById(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
    if (!(await canReviewAssignments(req, assignment.courseId))) {
      return res.status(403).json({ error: 'Assignment reviewer access is required.' });
    }
    const submissions = await AssignmentSubmission.find({ assignmentId: assignment._id })
      .populate('learnerId', 'name email')
      .sort({ updatedAt: -1 });
    res.json(submissions.map(serializeSubmission));
  } catch (error) {
    logger.error({ err: error }, 'Error listing assignment submissions');
    res.status(500).json({ error: 'Failed to list assignment submissions.' });
  }
});

router.get('/submissions/:submissionId/file', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!isValidObjectId(req.params.submissionId)) return res.status(400).json({ error: 'Invalid submission id.' });
    const submission = await AssignmentSubmission.findById(req.params.submissionId);
    if (!submission) return res.status(404).json({ error: 'Assignment submission not found.' });
    const isOwner = String(submission.learnerId) === String(req.user.id);
    const isReviewer = await canReviewAssignments(req, submission.courseId);
    if (!isOwner && !isReviewer) return res.status(403).json({ error: 'Access denied.' });
    if (!submission.fileUrl || !submission.fileName) return res.status(404).json({ error: 'No evidence file attached.' });

    const filename = path.basename(String(submission.fileUrl));
    const filePath = path.resolve(assignmentUploadDir, filename);
    if (!filePath.startsWith(assignmentUploadDir) || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Evidence file not found.' });
    }
    res.setHeader('Content-Type', submission.fileMimeType || 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${String(submission.fileName).replace(/[\r\n"]/g, '')}"`);
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    logger.error({ err: error }, 'Error downloading assignment evidence');
    res.status(500).json({ error: 'Failed to download assignment evidence.' });
  }
});

router.patch('/submissions/:submissionId/review', auth, requireAssignmentReviewer, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const submission = req.assignmentSubmission;
    const status = String(req.body?.status || '').trim();
    const comments = String(req.body?.comments || '').trim();
    if (!['approved', 'needs_revision', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'status must be approved, needs_revision, or rejected.' });
    }
    submission.status = status;
    submission.reviewedBy = req.user.id;
    submission.reviewedAt = new Date();
    submission.reviewComments = comments;
    submission.history.push({ status, actorId: req.user.id, comments });
    await submission.save();
    await writeAuditLog(req, { action: `assignment.${status}`, entityType: 'AssignmentSubmission', entityId: submission._id, details: { assignmentId: submission.assignmentId, courseId: submission.courseId } });
    res.json(serializeSubmission(submission));
  } catch (error) {
    logger.error({ err: error }, 'Error reviewing assignment submission');
    res.status(500).json({ error: 'Failed to review assignment submission.' });
  }
});

router.patch('/:id', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid assignment id.' });
    const updates: Record<string, unknown> = {};
    for (const key of ['moduleId', 'lessonId', 'title', 'instructions', 'resourceIds', 'dueAt', 'status']) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) updates[key] = req.body[key] || undefined;
    }
    if (Array.isArray(updates.resourceIds)) updates.resourceIds = updates.resourceIds.filter(isValidObjectId);
    if (updates.dueAt) updates.dueAt = new Date(String(updates.dueAt));
    const assignment = await Assignment.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
    await writeAuditLog(req, { action: 'assignment.update', entityType: 'Assignment', entityId: assignment._id, details: updates });
    res.json(serialize(assignment));
  } catch (error) {
    logger.error({ err: error }, 'Error updating assignment');
    res.status(500).json({ error: 'Failed to update assignment.' });
  }
});

router.delete('/:id', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid assignment id.' });
    const assignment = await Assignment.findByIdAndDelete(req.params.id);
    if (!assignment) return res.status(404).json({ error: 'Assignment not found.' });
    await AssignmentSubmission.deleteMany({ assignmentId: assignment._id });
    await writeAuditLog(req, { action: 'assignment.delete', entityType: 'Assignment', entityId: assignment._id });
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Error deleting assignment');
    res.status(500).json({ error: 'Failed to delete assignment.' });
  }
});

module.exports = router;

export {};
