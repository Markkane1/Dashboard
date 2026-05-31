const mongoose = require('mongoose');

const quizSubmissionSchema = new mongoose.Schema(
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
    answers: [
      {
        questionId: { type: String, required: true },
        selectedOptionIndex: { type: Number, required: true }
      }
    ],
    score: {
      type: Number,
      required: true
    },
    totalQuestions: {
      type: Number,
      required: true
    },
    passed: {
      type: Boolean,
      required: true
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

quizSubmissionSchema.index({ userId: 1, courseId: 1, createdAt: -1 });

const QuizSubmission =
  mongoose.models.QuizSubmission || mongoose.model('QuizSubmission', quizSubmissionSchema);

module.exports = QuizSubmission;

export {};
