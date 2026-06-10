const mongoose = require('mongoose');

const courseResourceSchema = new mongoose.Schema(
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
    url: {
      type: String,
      required: true,
      trim: true
    },
    type: {
      type: String,
      enum: ['link', 'download', 'document', 'video', 'other'],
      default: 'download'
    },
    isPublished: {
      type: Boolean,
      default: false,
      index: true
    }
  },
  { timestamps: true }
);

courseResourceSchema.index({ courseId: 1, moduleId: 1 });
courseResourceSchema.index({ courseId: 1, lessonId: 1 });

const CourseResource = mongoose.models.CourseResource || mongoose.model('CourseResource', courseResourceSchema);

module.exports = CourseResource;

export {};
