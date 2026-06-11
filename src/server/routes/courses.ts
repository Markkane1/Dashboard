const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Course = require('../models/Course');
const auth = require('../middleware/auth');
const { requireContentManager } = require('../middleware/roles');
const { requirePermission } = require('../middleware/roles');
const { PERMISSIONS } = require('../../shared/permissions');
const { CourseApproval } = require('../models');
const { writeAuditLog } = require('../services/audit');
const { logger } = require('../logger');
import type { NextFunction, Request, Response } from 'express';
import type { AuthoredQuizQuestion, Course as SharedCourse } from '../../shared/types';

const DEFAULT_COURSE_LIMIT = 24;
const MAX_COURSE_LIMIT = 60;
const COURSE_CARD_FIELDS = [
  'title',
  'description',
  'category',
  'sdgGoals',
  'topics',
  'sections',
  'mea',
  'syllabusUrl',
  'courseUrl',
  'isDiploma',
  'isExternal',
  'externalUrl',
  'diplomaRequiredCourseIds',
  'instructorId',
  'instructorName',
  'instructorAvatar',
  'price',
  'thumbnail',
  'duration',
  'lessonsCount',
  'rating',
  'enrolledCount',
  'quizPassingScore',
  'quizMaxAttempts',
  'quizRandomizeQuestions',
  'quizRandomizeOptions',
  'publishStatus',
  'approvalStatus',
  'status',
  'createdBy',
  'submittedBy',
  'submittedAt',
  'approvedBy',
  'approvedAt',
  'publishedBy',
  'publishedAt',
  'archivedBy',
  'archivedAt',
  'prerequisiteCourseIds',
  'trainerIds',
  'requiresFeedback',
  'certificateEligible',
  'requiresVerifiedProgress',
  'requiresCertificateApproval',
  'createdAt'
].join(' ');
const COURSE_WRITE_FIELDS = [
  'title',
  'description',
  'category',
  'sdgGoals',
  'topics',
  'sections',
  'mea',
  'syllabusUrl',
  'courseUrl',
  'isDiploma',
  'isExternal',
  'externalUrl',
  'diplomaRequiredCourseIds',
  'instructorId',
  'instructorName',
  'instructorAvatar',
  'price',
  'thumbnail',
  'duration',
  'rating',
  'quizQuestions',
  'quizPassingScore',
  'quizMaxAttempts',
  'quizRandomizeQuestions',
  'quizRandomizeOptions',
  'publishStatus',
  'approvalStatus',
  'prerequisiteCourseIds',
  'trainerIds',
  'requiresFeedback',
  'certificateEligible',
  'requiresVerifiedProgress',
  'requiresCertificateApproval'
];

function serializeCourse(course: any): SharedCourse {
  const plain = typeof course.toObject === 'function' ? course.toObject() : course;
  const id = String(plain._id || plain.id);

  return {
    id,
    title: plain.title,
    description: plain.description,
    category: plain.category,
    sdgGoals: plain.sdgGoals || [],
    topics: plain.topics || [],
    sections: plain.sections || plain.mea || [],
    mea: plain.mea || [],
    syllabusUrl: plain.syllabusUrl,
    courseUrl: plain.courseUrl || `/courses/${id}`,
    isDiploma: Boolean(plain.isDiploma),
    isExternal: Boolean(plain.isExternal),
    externalUrl: plain.externalUrl,
    diplomaRequiredCourseIds: plain.diplomaRequiredCourseIds || [],
    instructorId: plain.instructorId || '',
    instructorName: plain.instructorName || '',
    instructorAvatar: plain.instructorAvatar || '',
    price: plain.price || 0,
    thumbnail: plain.thumbnail || '',
    duration: plain.duration || '',
    lessonsCount: plain.lessonsCount || 0,
    rating: plain.rating || 0,
    enrolledCount: plain.enrolledCount || 0,
    quizPassingScore: plain.quizPassingScore || 70,
    quizMaxAttempts: plain.quizMaxAttempts || 3,
    quizRandomizeQuestions: plain.quizRandomizeQuestions !== false,
    quizRandomizeOptions: plain.quizRandomizeOptions !== false,
    publishStatus: plain.publishStatus || 'published',
    approvalStatus: plain.approvalStatus || 'approved',
    status: plain.status || (plain.publishStatus === 'published' && plain.approvalStatus === 'approved' ? 'published' : 'draft'),
    createdBy: plain.createdBy ? String(plain.createdBy) : undefined,
    submittedBy: plain.submittedBy ? String(plain.submittedBy) : undefined,
    submittedAt: plain.submittedAt,
    approvedBy: plain.approvedBy ? String(plain.approvedBy) : undefined,
    approvedAt: plain.approvedAt,
    publishedBy: plain.publishedBy ? String(plain.publishedBy) : undefined,
    publishedAt: plain.publishedAt,
    archivedBy: plain.archivedBy ? String(plain.archivedBy) : undefined,
    archivedAt: plain.archivedAt,
    prerequisiteCourseIds: (plain.prerequisiteCourseIds || []).map(String),
    trainerIds: (plain.trainerIds || []).map(String),
    requiresFeedback: plain.requiresFeedback === true,
    certificateEligible: plain.certificateEligible === true,
    requiresVerifiedProgress: plain.requiresVerifiedProgress === true,
    requiresCertificateApproval: plain.requiresCertificateApproval !== false
  };
}

function serializeManageCourse(course: any): SharedCourse {
  const plain = typeof course.toObject === 'function' ? course.toObject() : course;
  return {
    ...serializeCourse(plain),
    quizQuestions: Array.isArray(plain.quizQuestions)
      ? plain.quizQuestions.map((question: AuthoredQuizQuestion, index: number) => ({
          id: question.id || `question-${index + 1}`,
          prompt: question.prompt,
          options: question.options || [],
          correctAnswerIndex: question.correctAnswerIndex,
          explanation: question.explanation || ''
        }))
      : []
  };
}

function auditQuizQuestions(questions: unknown) {
  return Array.isArray(questions)
    ? questions.map((question: any, index: number) => ({
        id: question.id || `question-${index + 1}`,
        prompt: question.prompt || '',
        correctAnswerIndex: question.correctAnswerIndex,
        optionCount: Array.isArray(question.options) ? question.options.length : 0
      }))
    : [];
}

function auditCourseSnapshot(course: any) {
  const plain = typeof course?.toObject === 'function' ? course.toObject() : course;
  if (!plain) return null;
  return {
    id: String(plain._id || plain.id),
    title: plain.title,
    category: plain.category,
    publishStatus: plain.publishStatus,
    approvalStatus: plain.approvalStatus,
    status: plain.status || 'draft',
    createdBy: plain.createdBy ? String(plain.createdBy) : undefined,
    submittedBy: plain.submittedBy ? String(plain.submittedBy) : undefined,
    submittedAt: plain.submittedAt,
    approvedBy: plain.approvedBy ? String(plain.approvedBy) : undefined,
    approvedAt: plain.approvedAt,
    publishedBy: plain.publishedBy ? String(plain.publishedBy) : undefined,
    publishedAt: plain.publishedAt,
    archivedBy: plain.archivedBy ? String(plain.archivedBy) : undefined,
    archivedAt: plain.archivedAt,
    trainerIds: (plain.trainerIds || []).map(String),
    prerequisiteCourseIds: (plain.prerequisiteCourseIds || []).map(String),
    quizPassingScore: plain.quizPassingScore,
    quizMaxAttempts: plain.quizMaxAttempts,
    quizQuestions: auditQuizQuestions(plain.quizQuestions)
  };
}

function getValidCourseIds(ids: unknown): string[] {
  if (!Array.isArray(ids)) {
    return [];
  }

  return [
    ...new Set(
      ids
        .map((id) => String(id))
        .filter((id) => mongoose.Types.ObjectId.isValid(id))
    )
  ];
}

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

function getCourseLimit(value: unknown): number {
  const limit = Number(value || DEFAULT_COURSE_LIMIT);
  if (!Number.isFinite(limit)) {
    return DEFAULT_COURSE_LIMIT;
  }

  return Math.min(Math.max(Math.floor(limit), 1), MAX_COURSE_LIMIT);
}

function getCoursePage(value: unknown): number {
  const page = Number(value || 1);
  if (!Number.isFinite(page)) {
    return 1;
  }

  return Math.max(Math.floor(page), 1);
}

function encodeCursor(course: any): string {
  return Buffer.from(JSON.stringify({
    createdAt: new Date(course.createdAt).toISOString(),
    id: String(course._id)
  })).toString('base64url');
}

function decodeCursor(value: unknown) {
  if (!value || typeof value !== 'string') {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8'));
    if (!parsed.createdAt || !mongoose.Types.ObjectId.isValid(parsed.id)) {
      return null;
    }

    return {
      createdAt: new Date(parsed.createdAt),
      id: new mongoose.Types.ObjectId(parsed.id)
    };
  } catch {
    return null;
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function buildCourseFilter(query: Request['query']) {
  const filters: Array<Record<string, unknown>> = [];
  const category = typeof query.category === 'string' ? query.category : '';
  const topic = typeof query.topic === 'string' ? query.topic : '';
  const section = typeof query.section === 'string' ? query.section.trim() : '';
  const mea = typeof query.mea === 'string' ? query.mea.trim() : '';
  const q = typeof query.q === 'string' ? query.q.trim() : '';
  const sdg = typeof query.sdg === 'string' ? Number(query.sdg) : undefined;
  const isDiploma = typeof query.isDiploma === 'string' ? query.isDiploma.toLowerCase() === 'true' : undefined;
  const isExternal = typeof query.isExternal === 'string' ? query.isExternal.toLowerCase() === 'true' : undefined;

  if (category) {
    filters.push({ category });
  }
  if (Number.isInteger(sdg)) {
    filters.push({ sdgGoals: sdg });
  }
  if (topic) {
    filters.push({ topics: topic });
  }
  if (isDiploma !== undefined) {
    filters.push({ isDiploma });
  }
  if (isExternal !== undefined) {
    filters.push({ isExternal });
  }
  filters.push({
    $or: [
      { status: 'published' },
      { status: { $exists: false }, publishStatus: 'published', approvalStatus: 'approved' }
    ]
  });
  const filterSection = section || mea;
  if (filterSection) {
    const normalizedSection = filterSection.toUpperCase();
    if (normalizedSection === 'CBD') {
      filters.push({
        $or: [
          { sections: /CBD/i },
          { sections: /Nagoya/i },
          { sections: /Cartagena/i },
          { mea: /CBD/i },
          { mea: /Nagoya/i },
          { mea: /Cartagena/i }
        ]
      });
    } else if (normalizedSection === 'UNFCCC') {
      filters.push({
        $or: [
          { sections: /UNFCCC/i },
          { sections: /Paris/i },
          { mea: /UNFCCC/i },
          { mea: /Paris/i }
        ]
      });
    } else if (normalizedSection === 'BRS') {
      filters.push({
        $or: [
          { sections: /Basel/i },
          { sections: /Rotterdam/i },
          { sections: /Stockholm/i },
          { mea: /Basel/i },
          { mea: /Rotterdam/i },
          { mea: /Stockholm/i }
        ]
      });
    } else {
      filters.push({
        $or: [
          { sections: filterSection },
          { mea: filterSection }
        ]
      });
    }
  }
  if (q) {
    filters.push({ $text: { $search: q } });
  }

  return filters.length > 0 ? { $and: filters } : {};
}

function pickCourseFields(body: Record<string, unknown>) {
  const updates: Record<string, unknown> = {};
  for (const field of COURSE_WRITE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(body, field)) {
      updates[field] = body[field];
    }
  }

  return updates;
}

function validateCoursePayload(payload: Record<string, unknown>, partial = false) {
  const required = ['title', 'description', 'category'];
  if (!partial) {
    for (const field of required) {
      if (!String(payload[field] || '').trim()) {
        return `${field} is required`;
      }
    }
  }

  if (payload.quizPassingScore !== undefined) {
    const score = Number(payload.quizPassingScore);
    if (!Number.isFinite(score) || score < 0 || score > 100) {
      return 'quizPassingScore must be between 0 and 100';
    }
    payload.quizPassingScore = score;
  }
  if (payload.quizMaxAttempts !== undefined) {
    const maxAttempts = Number(payload.quizMaxAttempts);
    if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 25) {
      return 'quizMaxAttempts must be between 1 and 25';
    }
    payload.quizMaxAttempts = maxAttempts;
  }
  for (const key of ['prerequisiteCourseIds', 'trainerIds', 'diplomaRequiredCourseIds']) {
    if (payload[key] !== undefined) {
      if (!Array.isArray(payload[key])) return `${key} must be an array`;
      payload[key] = [...new Set((payload[key] as unknown[]).map(String).filter((id) => mongoose.Types.ObjectId.isValid(id)))];
    }
  }

  if (payload.sections !== undefined) {
    if (!Array.isArray(payload.sections)) {
      return 'sections must be an array';
    }
    payload.sections = payload.sections.map((section) => String(section || '').trim()).filter(Boolean);
  }

  if (payload.quizQuestions !== undefined) {
    if (!Array.isArray(payload.quizQuestions)) {
      return 'quizQuestions must be an array';
    }

    const questions = payload.quizQuestions as Array<Record<string, unknown>>;
    for (const [index, question] of questions.entries()) {
      const prompt = String(question.prompt || '').trim();
      const options = Array.isArray(question.options)
        ? question.options.map((option) => String(option || '').trim()).filter(Boolean)
        : [];
      const correctAnswerIndex = Number(question.correctAnswerIndex);

      if (!prompt) {
        return `quizQuestions.${index}.prompt is required`;
      }
      if (options.length < 2) {
        return `quizQuestions.${index}.options must include at least two answers`;
      }
      if (!Number.isInteger(correctAnswerIndex) || correctAnswerIndex < 0 || correctAnswerIndex >= options.length) {
        return `quizQuestions.${index}.correctAnswerIndex must match an answer option`;
      }

      question.id = String(question.id || `question-${index + 1}`).trim();
      question.prompt = prompt;
      question.options = options;
      question.correctAnswerIndex = correctAnswerIndex;
      question.explanation = String(question.explanation || '').trim();
    }
  }

  return null;
}

// GET /api/courses
// Returns a paginated course catalog. Supports limit/page/cursor and catalog filters.
router.get('/', async (req: Request, res: Response) => {
  try {
    const limit = getCourseLimit(req.query.limit);
    const page = getCoursePage(req.query.page);
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const cursor = q ? null : decodeCursor(req.query.cursor);
    const filter = buildCourseFilter(req.query);
    const pageFilter = cursor
      ? {
          ...filter,
          $or: [
            { createdAt: { $lt: cursor.createdAt } },
            { createdAt: cursor.createdAt, _id: { $lt: cursor.id } }
          ]
        }
      : filter;
    const skip = cursor ? 0 : (page - 1) * limit;

    let query = Course.find(pageFilter);
    let sortFields: any = { createdAt: -1, _id: -1 };

    if (q) {
      const projectionObj = COURSE_CARD_FIELDS.split(' ').reduce((acc: any, field) => {
        acc[field] = 1;
        return acc;
      }, {});
      projectionObj.score = { $meta: 'textScore' };

      query = query.select(projectionObj);
      sortFields = { score: { $meta: 'textScore' }, createdAt: -1 };
    } else {
      query = query.select(COURSE_CARD_FIELDS);
    }

    const [totalCount, courses] = await Promise.all([
      Course.countDocuments(filter),
      query
        .sort(sortFields)
        .skip(skip)
        .limit(limit + 1)
    ]);
    const pageCourses = courses.slice(0, limit);
    const nextCursor = courses.length > limit ? encodeCursor(pageCourses[pageCourses.length - 1]) : '';

    res.setHeader('X-Total-Count', String(totalCount));
    res.setHeader('X-Page-Limit', String(limit));
    if (nextCursor) {
      res.setHeader('X-Next-Cursor', nextCursor);
    }
    res.json(pageCourses.map(serializeCourse));
  } catch (error) {
    logger.error({ err: error }, 'Error fetching courses');
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

// POST /api/courses/batch
// Returns only the requested course documents for dashboard-style views.
router.post('/batch', async (req: Request, res: Response) => {
  try {
    const ids = getValidCourseIds(req.body?.ids);
    if (ids.length === 0) {
      return res.json([]);
    }

    const courses = await Course.find({ _id: { $in: ids } })
      .select(COURSE_CARD_FIELDS)
      .sort({ createdAt: -1 });

    res.json(courses.map(serializeCourse));
  } catch (error) {
    logger.error({ err: error }, 'Error fetching course batch');
    res.status(500).json({ error: "Failed to fetch requested courses" });
  }
});

// GET /api/courses/manage/:id
// Returns protected course authoring details, including quiz answer keys.
router.get('/manage', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    const limit = getCourseLimit(req.query.limit);
    const courses = await Course.find({})
      .select(`${COURSE_CARD_FIELDS} quizQuestions`)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit);
    res.json(courses.map(serializeManageCourse));
  } catch (error) {
    logger.error({ err: error }, 'Error fetching manageable course list');
    res.status(500).json({ error: 'Failed to fetch manageable courses' });
  }
});

router.get('/manage/:id', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid course id.' });
    }

    const course = await Course.findById(req.params.id).select(`${COURSE_CARD_FIELDS} quizQuestions`);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(serializeManageCourse(course));
  } catch (error) {
    logger.error({ err: error }, 'Error fetching manageable course details');
    res.status(500).json({ error: 'Failed to fetch course details' });
  }
});

// POST /api/courses
// Create a course from the admin/content management interface.
router.post('/', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    const payload = pickCourseFields(req.body || {});
    const validationError = validateCoursePayload(payload);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    payload.publishStatus = 'draft';
    payload.approvalStatus = 'draft';
    payload.status = 'draft';
    payload.createdBy = req.user?.id;
    const course = await Course.create(payload);
    await writeAuditLog(req, { action: 'course.create', entityType: 'Course', entityId: course._id });
    res.status(201).json(serializeCourse(course));
  } catch (error) {
    logger.error({ err: error }, 'Error creating course');
    res.status(500).json({ error: 'Failed to create course' });
  }
});

router.get('/approvals', auth, requirePermission(PERMISSIONS.APPROVE_COURSES), async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' && req.query.status
      ? req.query.status
      : 'pending';
    const filter: Record<string, any> = {};
    if (['draft', 'submitted_for_review', 'approved', 'published', 'archived'].includes(status)) {
      filter.status = status;
    } else if (status === 'pending') {
      filter.$or = [
        { status: 'submitted_for_review' },
        { status: { $exists: false }, approvalStatus: 'pending' }
      ];
    } else {
      filter.approvalStatus = status === 'published' ? 'approved' : status;
    }
    const courses = await Course.find(filter)
      .select(`${COURSE_CARD_FIELDS} approvalComments submittedForApprovalAt approvedAt rejectedAt`)
      .sort({ submittedForApprovalAt: -1, updatedAt: -1 })
      .limit(200);
    res.json(courses.map((course: any) => {
      const plain = typeof course.toObject === 'function' ? course.toObject() : course;
      return {
        ...serializeManageCourse(plain),
        approvalComments: plain.approvalComments || '',
        submittedForApprovalAt: plain.submittedForApprovalAt,
        approvedAt: plain.approvedAt,
        rejectedAt: plain.rejectedAt
      };
    }));
  } catch (error) {
    logger.error({ err: error }, 'Error listing course approval queue');
    res.status(500).json({ error: 'Failed to list course approval queue.' });
  }
});

// GET /api/courses/:id
// Returns a single course by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(404).json({ error: "Course not found" });
    }

    const course = await Course.findOne({
      _id: req.params.id,
      $or: [
        { status: 'published' },
        { status: { $exists: false }, publishStatus: 'published', approvalStatus: 'approved' }
      ]
    }).select(COURSE_CARD_FIELDS);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    res.json(serializeCourse(course));
  } catch (error) {
    logger.error({ err: error }, 'Error fetching course details');
    res.status(500).json({ error: "Failed to fetch course details" });
  }
});

// PATCH /api/courses/:id
// Update course metadata, publishing assets, and quiz authoring fields.
router.patch('/:id', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid course id.' });
    }

    const updates = pickCourseFields(req.body || {});
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No allowed course fields provided' });
    }

    const validationError = validateCoursePayload(updates, true);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const before = await Course.findById(req.params.id).select(`${COURSE_CARD_FIELDS} quizQuestions`);
    if (!before) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const { hasPermission } = require('../../shared/permissions');
    const hasApprovePermission = hasPermission(req.user, PERMISSIONS.APPROVE_COURSES);
    const currentStatus = before.status || 'draft';
    if (!hasApprovePermission && currentStatus !== 'draft') {
      return res.status(403).json({ error: 'Only courses in draft status can be edited by instructors.' });
    }

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select(`${COURSE_CARD_FIELDS} quizQuestions`);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const updatedFields = Object.keys(updates);
    await writeAuditLog(req, {
      action: updatedFields.includes('quizQuestions') ? 'course.quiz-answer-key-update' : 'course.update',
      entityType: 'Course',
      entityId: course._id,
      details: {
        result: 'success',
        updatedFields,
        oldValue: auditCourseSnapshot(before),
        newValue: auditCourseSnapshot(course)
      }
    });
    res.json(serializeManageCourse(course));
  } catch (error) {
    logger.error({ err: error }, 'Error updating course');
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// POST /api/courses/:id/approval
// Submit, approve, or reject official course publishing.
router.post('/:id/approval', auth, async (req: Request, res: Response, next: NextFunction) => {
  const action = String(req.body?.action || '').toLowerCase();
  if (action === 'submit') {
    return requirePermission(PERMISSIONS.MANAGE_CONTENT)(req as any, res, next);
  }

  return requirePermission(PERMISSIONS.APPROVE_COURSES)(req as any, res, next);
}, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid course id.' });
    }
    const action = String(req.body?.action || '').toLowerCase();
    const comments = String(req.body?.comments || '').trim();
    if (!['submit', 'approve', 'reject', 'publish', 'archive'].includes(action)) {
      return res.status(400).json({ error: 'action must be submit, approve, reject, publish, or archive.' });
    }

    const course = await Course.findById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    const oldValue = auditCourseSnapshot(course);
    const currentStatus = course.status || 'draft';

    if (action === 'submit') {
      if (currentStatus !== 'draft') {
        return res.status(400).json({ error: 'Only courses in draft status can be submitted for review.' });
      }
      course.status = 'submitted_for_review';
      course.submittedBy = req.user?.id;
      course.submittedAt = new Date();
      course.publishStatus = 'pending';
      course.approvalStatus = 'pending';
      course.submittedForApprovalAt = new Date();
      await CourseApproval.create({ courseId: course._id, status: 'pending', submittedBy: req.user?.id, comments });
    } else if (action === 'approve') {
      if (currentStatus !== 'submitted_for_review') {
        return res.status(400).json({ error: 'Only courses submitted for review can be approved.' });
      }
      course.status = 'approved';
      course.approvedAt = new Date();
      course.approvedBy = req.user?.id;
      course.rejectedAt = undefined;
      course.rejectedBy = undefined;
      course.approvalStatus = 'approved';
      course.publishStatus = 'draft';
      await CourseApproval.create({ courseId: course._id, status: 'approved', reviewedBy: req.user?.id, reviewedAt: new Date(), comments });
    } else if (action === 'reject') {
      if (currentStatus !== 'submitted_for_review') {
        return res.status(400).json({ error: 'Only courses submitted for review can be rejected.' });
      }
      course.status = 'draft';
      course.rejectedAt = new Date();
      course.rejectedBy = req.user?.id;
      course.publishStatus = 'rejected';
      course.approvalStatus = 'rejected';
      await CourseApproval.create({ courseId: course._id, status: 'rejected', reviewedBy: req.user?.id, reviewedAt: new Date(), comments });
    } else if (action === 'publish') {
      if (currentStatus !== 'approved') {
        return res.status(400).json({ error: 'Only approved courses can be published.' });
      }
      course.status = 'published';
      course.publishedAt = new Date();
      course.publishedBy = req.user?.id;
      course.publishStatus = 'published';
      course.approvalStatus = 'approved';
      await CourseApproval.create({ courseId: course._id, status: 'approved', reviewedBy: req.user?.id, reviewedAt: new Date(), comments: comments || 'Course published' });
    } else if (action === 'archive') {
      course.status = 'archived';
      course.archivedAt = new Date();
      course.archivedBy = req.user?.id;
      course.publishStatus = 'draft';
      await CourseApproval.create({ courseId: course._id, status: 'rejected', reviewedBy: req.user?.id, reviewedAt: new Date(), comments: comments || 'Course archived' });
    }

    course.approvalComments = comments;
    await course.save();
    await writeAuditLog(req, {
      action: `course.${action}`,
      entityType: 'Course',
      entityId: course._id,
      details: {
        result: 'success',
        comments,
        oldValue,
        newValue: auditCourseSnapshot(course)
      }
    });
    res.json(serializeManageCourse(course));
  } catch (error) {
    logger.error({ err: error }, 'Error updating course approval');
    res.status(500).json({ error: 'Failed to update course approval.' });
  }
});

// DELETE /api/courses/:id
// Content-manager deletion with model-level cleanup of related records.
router.delete('/:id', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid course id.' });
    }

    const deleted = await Course.findOneAndDelete({ _id: req.params.id });
    if (!deleted) {
      return res.status(404).json({ error: 'Course not found' });
    }

    await writeAuditLog(req, {
      action: 'course.delete',
      entityType: 'Course',
      entityId: req.params.id,
      details: {
        result: 'success',
        oldValue: auditCourseSnapshot(deleted),
        newValue: null
      }
    });
    res.status(204).send();
  } catch (error) {
    logger.error({ err: error }, 'Error deleting course');
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

module.exports = router;

export {};
