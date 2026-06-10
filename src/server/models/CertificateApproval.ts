const mongoose = require('mongoose');

const certificateApprovalSchema = new mongoose.Schema(
  {
    certificateIssuanceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'CertificateIssuance',
      required: true,
      index: true
    },
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
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending',
      index: true
    },
    requestedBy: {
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

certificateApprovalSchema.index({ courseId: 1, status: 1, createdAt: -1 });

const CertificateApproval =
  mongoose.models.CertificateApproval || mongoose.model('CertificateApproval', certificateApprovalSchema);

module.exports = CertificateApproval;

export {};
