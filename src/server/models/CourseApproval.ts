const mongoose = require('mongoose');

const courseApprovalSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      required: true,
      index: true
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    reviewedAt: {
      type: Date
    },
    comments: {
      type: String,
      default: '',
      trim: true
    }
  },
  { timestamps: true }
);

courseApprovalSchema.index({ courseId: 1, createdAt: -1 });

const CourseApproval = mongoose.models.CourseApproval || mongoose.model('CourseApproval', courseApprovalSchema);

module.exports = CourseApproval;

export {};
