const mongoose = require('mongoose');

const assignmentSubmissionSchema = new mongoose.Schema(
  {
    assignmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assignment',
      required: true,
      index: true
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true
    },
    learnerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    text: {
      type: String,
      default: '',
      trim: true
    },
    linkUrl: {
      type: String,
      default: '',
      trim: true
    },
    fileUrl: {
      type: String,
      default: '',
      trim: true
    },
    fileName: {
      type: String,
      default: '',
      trim: true
    },
    fileMimeType: {
      type: String,
      default: '',
      trim: true
    },
    status: {
      type: String,
      enum: ['submitted', 'approved', 'needs_revision', 'rejected'],
      default: 'submitted',
      index: true
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    reviewComments: {
      type: String,
      default: '',
      trim: true
    },
    history: [
      {
        status: {
          type: String,
          enum: ['submitted', 'approved', 'needs_revision', 'rejected'],
          required: true
        },
        actorId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: 'User'
        },
        comments: {
          type: String,
          default: '',
          trim: true
        },
        createdAt: {
          type: Date,
          default: Date.now
        }
      }
    ]
  },
  { timestamps: true }
);

assignmentSubmissionSchema.index({ assignmentId: 1, learnerId: 1 }, { unique: true });
assignmentSubmissionSchema.index({ courseId: 1, status: 1, updatedAt: -1 });
assignmentSubmissionSchema.index({ learnerId: 1, updatedAt: -1 });

const AssignmentSubmission =
  mongoose.models.AssignmentSubmission || mongoose.model('AssignmentSubmission', assignmentSubmissionSchema);

module.exports = AssignmentSubmission;

export {};
