const mongoose = require('mongoose');

const assignmentSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true
    },
    moduleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CourseModule',
      index: true
    },
    lessonId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Lesson',
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    instructions: {
      type: String,
      default: '',
      trim: true
    },
    resourceIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'CourseResource'
      }
    ],
    dueAt: {
      type: Date
    },
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true
    }
  },
  { timestamps: true }
);

assignmentSchema.index({ courseId: 1, status: 1, dueAt: 1 });

const Assignment = mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema);

module.exports = Assignment;

export {};
