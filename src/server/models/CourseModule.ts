const mongoose = require('mongoose');

const courseModuleSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    order: {
      type: Number,
      required: true,
      default: 0
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: true }
);

courseModuleSchema.index({ courseId: 1, order: 1 });

const CourseModule = mongoose.models.CourseModule || mongoose.model('CourseModule', courseModuleSchema);

module.exports = CourseModule;

export {};
