const express = require('express');
const router = express.Router();
const Course = require('../models/Course');

// GET /api/courses
// Returns all courses
router.get('/', async (req, res, next) => {
  try {
    const courses = await Course.find().sort({ createdAt: -1 });
    res.json(courses);
  } catch (error) {
    console.error("Error fetching courses:", error);
    res.status(500).json({ error: "Failed to fetch courses" });
  }
});

// GET /api/courses/:id
// Returns a single course by ID
router.get('/:id', async (req, res, next) => {
  try {
    const course = await Course.findById(req.params.id);
    if (!course) {
      return res.status(404).json({ error: "Course not found" });
    }
    res.json(course);
  } catch (error) {
    console.error("Error fetching course details:", error);
    res.status(500).json({ error: "Failed to fetch course details" });
  }
});

module.exports = router;
