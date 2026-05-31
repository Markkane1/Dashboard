const mongoose = require('mongoose');

const lessonSchema = new mongoose.Schema(
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
      trim: true
    },
    order: {
      type: Number,
      required: true
    },
    videoUrl: {
      type: String,
      default: ''
    },
    duration: {
      type: Number
    },
    resources: [
      {
        label: { type: String },
        url: { type: String }
      }
    ],
    transcript: {
      type: String
    },
    isPublished: {
      type: Boolean,
      default: false
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

// Add a compound index on { courseId: 1, order: 1 }
lessonSchema.index({ courseId: 1, order: 1 });

// Add a compound index on { courseId: 1, isPublished: 1, order: 1 } for published sorted queries
lessonSchema.index({ courseId: 1, isPublished: 1, order: 1 });

const Lesson = mongoose.models.Lesson || mongoose.model('Lesson', lessonSchema);

module.exports = Lesson;

export {};
