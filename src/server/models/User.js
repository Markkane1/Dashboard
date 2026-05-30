const mongoose = require('mongoose');

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true
    },
    password: {
      type: String,
      required: true
    },
    enrolledCourses: [
      {
        type: String // List of course IDs the user is enrolled in
      }
    ],
    completedCourses: [
      {
        type: String // List of course IDs the user has completed
      }
    ]
  },
  {
    timestamps: true
  }
);

const User = mongoose.models.User || mongoose.model('User', userSchema);

module.exports = User;
