const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');

// GET /api/users/email/:email
// Find a user by email
router.get('/email/:email', async (req, res, next) => {
  try {
    const email = req.params.email;
    const user = await User.findOne({ email: new RegExp('^' + email + '$', 'i') });
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user by email:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// GET /api/users/me
// Return the authenticated user's enrollment list
router.get('/me', auth, async (req, res, next) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ enrolledCourses: user.enrolledCourses || [] });
  } catch (error) {
    console.error("Error fetching authenticated user:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// POST /api/users/enroll
// Enroll the authenticated user in a course
router.post('/enroll', auth, async (req, res, next) => {
  try {
    const { courseId } = req.body;
    if (!courseId) {
      return res.status(400).json({ error: "courseId is required" });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    user.enrolledCourses = user.enrolledCourses || [];
    if (!user.enrolledCourses.includes(courseId)) {
      user.enrolledCourses.push(courseId);
      await user.save();
    }

    res.json({ success: true, enrolledCourses: user.enrolledCourses });
  } catch (error) {
    console.error("Error enrolling authenticated user:", error);
    res.status(500).json({ error: "Failed to enroll user" });
  }
});

// GET /api/users/:id
// Find a user by ID
router.get('/:id', async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(user);
  } catch (error) {
    console.error("Error fetching user by ID:", error);
    res.status(500).json({ error: "Failed to fetch user" });
  }
});

// PUT /api/users/:id
// Update a user record
router.put('/:id', async (req, res, next) => {
  try {
    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!updatedUser) {
      return res.status(404).json({ error: "User not found" });
    }
    res.json(updatedUser);
  } catch (error) {
    console.error("Error updating user:", error);
    res.status(500).json({ error: "Failed to update user" });
  }
});

// POST /api/users
// Create a new user
router.post('/', async (req, res, next) => {
  try {
    const { name, email, password, role, avatar, enrolledCourses, completedCourses } = req.body;
    
    const userData = {
      name,
      email,
      password,
      role: role || 'student',
      avatar: avatar || '',
      enrolledCourses: enrolledCourses || [],
      completedCourses: completedCourses || []
    };
    
    const user = new User(userData);
    await user.save();
    res.status(201).json(user);
  } catch (error) {
    console.error("Error creating user:", error);
    if (error.code === 11000) {
      return res.status(400).json({ error: "Email already exists" });
    }
    res.status(500).json({ error: "Failed to create user" });
  }
});

module.exports = router;
