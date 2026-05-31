const mongoose = require('mongoose');
import type { CallbackWithoutResultAndOptionalError } from 'mongoose';

const progressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true
    },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      required: true
    },
    watchedSeconds: {
      type: Number,
      default: 0
    },
    duration: {
      type: Number,
      required: true
    },
    completed: {
      type: Boolean,
      default: false
    },
    lastWatchedAt: {
      type: Date,
      default: Date.now
    },
    demoKey: {
      type: String,
      index: true
    }
  },
  {
    timestamps: true
  }
);

// Unique compound index to prevent duplicate progress records per user-lesson
progressSchema.index({ userId: 1, lessonId: 1 }, { unique: true });

// Compound index for fast course progress checks on user dashboards
progressSchema.index({ userId: 1, courseId: 1 });

// Pre-save hook to automatically set completed status when user watches >= 90% of lesson duration
progressSchema.pre('save', function (
  this: { duration?: number; watchedSeconds: number; completed: boolean },
  next: CallbackWithoutResultAndOptionalError
) {
  if (this.duration && this.duration > 0) {
    this.completed = this.watchedSeconds >= (this.duration * 0.9);
  }
  next();
});

const Progress = mongoose.models.Progress || mongoose.model('Progress', progressSchema);

module.exports = Progress;

export {};
