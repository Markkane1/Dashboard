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
    questionSnapshot: [
      {
        id: { type: String, required: true },
        prompt: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctAnswerIndex: { type: Number, required: true },
        explanation: { type: String }
      }
    ],
    attemptNumber: {
      type: Number,
      required: true,
      default: 1
    },
    status: {
      type: String,
      enum: ['submitted', 'passed', 'failed'],
      default: 'submitted',
      index: true
    },
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
quizSubmissionSchema.index({ userId: 1, courseId: 1, attemptNumber: -1 });

const QuizSubmission =
  mongoose.models.QuizSubmission || mongoose.model('QuizSubmission', quizSubmissionSchema);

module.exports = QuizSubmission;

export {};
