const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Course = require('../models/Course');
const auth = require('../middleware/auth');
const { requireContentManager } = require('../middleware/roles');
import type { Request, Response } from 'express';
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
  'quizPassingScore'
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
    quizPassingScore: plain.quizPassingScore || 70
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

  if (category) {
    filters.push({ category });
  }
  if (Number.isInteger(sdg)) {
    filters.push({ sdgGoals: sdg });
  }
  if (topic) {
    filters.push({ topics: topic });
  }
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
    const cursor = decodeCursor(req.query.cursor);
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

    const [totalCount, courses] = await Promise.all([
      Course.countDocuments(filter),
      Course.find(pageFilter)
        .select(COURSE_CARD_FIELDS)
        .sort({ createdAt: -1, _id: -1 })
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
    console.error("Error fetching courses:", error);
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
    console.error("Error fetching course batch:", error);
    res.status(500).json({ error: "Failed to fetch requested courses" });
  }
});

// GET /api/courses/manage/:id
// Returns protected course authoring details, including quiz answer keys.
router.get('/manage/:id', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    const course = await Course.findById(req.params.id).select(`${COURSE_CARD_FIELDS} quizQuestions`);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(serializeManageCourse(course));
  } catch (error) {
    console.error('Error fetching manageable course details:', error);
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

    const course = await Course.create(payload);
    res.status(201).json(serializeCourse(course));
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
});

// GET /api/courses/:id
// Returns a single course by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const course = await Course.findById(req.params.id).select(COURSE_CARD_FIELDS);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    res.json(serializeCourse(course));
  } catch (error) {
    console.error("Error fetching course details:", error);
    res.status(500).json({ error: "Failed to fetch course details" });
  }
});

// PATCH /api/courses/:id
// Update course metadata, publishing assets, and quiz authoring fields.
router.patch('/:id', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    const updates = pickCourseFields(req.body || {});
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: 'No allowed course fields provided' });
    }

    const validationError = validateCoursePayload(updates, true);
    if (validationError) {
      return res.status(400).json({ error: validationError });
    }

    const course = await Course.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    ).select(`${COURSE_CARD_FIELDS} quizQuestions`);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.json(serializeManageCourse(course));
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
});

// DELETE /api/courses/:id
// Content-manager deletion with model-level cleanup of related records.
router.delete('/:id', auth, requireContentManager, async (req: Request, res: Response) => {
  try {
    const deleted = await Course.findOneAndDelete({ _id: req.params.id });
    if (!deleted) {
      return res.status(404).json({ error: 'Course not found' });
    }

    res.status(204).send();
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
});

module.exports = router;

export {};
