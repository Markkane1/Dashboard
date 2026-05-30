const express = require('express');
const router = express.Router();
const Course = require('../models/Course');
import type { Request, Response } from 'express';
import type { Course as SharedCourse } from '../../shared/types';

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

// GET /api/courses
// Returns all courses
router.get('/', async (_req: Request, res: Response) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.json(courses.map(serializeCourse));
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

// GET /api/courses/:id
// Returns a single course by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    res.json(serializeCourse(course));
  } catch (error) {
    console.error("Error fetching course details:", error);
    res.status(500).json({ error: "Failed to fetch course details" });
  }
});

module.exports = router;

export {};
