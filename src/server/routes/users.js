const express = require('express');
const router = express.Router();
const User = require('../models/User');

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
    const { id, name, email, password, role, enrolledCourses, completedCourses } = req.body;
    
    const userData = {
      name,
      email,
      password,
      enrolledCourses: enrolledCourses || [],
      completedCourses: completedCourses || []
    };
    
    if (id) {
      userData._id = id;
    }
    
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
