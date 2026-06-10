const mongoose = require('mongoose');

const courseFeedbackSchema = new mongoose.Schema(
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
    rating: {
      type: Number,
      required: true,
      min: 1,
      max: 5
    },
    comments: {
      type: String,
      default: '',
      trim: true
    },
    answers: [
      {
        question: { type: String, required: true },
        answer: { type: String, required: true }
      }
    ]
  },
  { timestamps: true }
);

courseFeedbackSchema.index({ userId: 1, courseId: 1 }, { unique: true });

const CourseFeedback = mongoose.models.CourseFeedback || mongoose.model('CourseFeedback', courseFeedbackSchema);

module.exports = CourseFeedback;

export {};
