const mongoose = require('mongoose');

const certificateIssuanceSchema = new mongoose.Schema(
  {
    certificateId: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    serialNumber: {
      type: String,
      unique: true,
      sparse: true,
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
    recipientName: {
      type: String,
      required: true,
      trim: true
    },
    courseTitle: {
      type: String,
      required: true,
      trim: true
    },
    issuedAt: {
      type: Date,
      required: true,
      default: Date.now
    },
    approvalStatus: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'approved',
      index: true
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvedAt: {
      type: Date
    },
    approvalComments: {
      type: String,
      default: ''
    },
    revokedAt: {
      type: Date
    },
    revokedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    revocationReason: {
      type: String,
      default: ''
    },
    status: {
      type: String,
      enum: ['valid', 'revoked'],
      default: 'valid',
      index: true
    },
    verificationCode: {
      type: String,
      unique: true,
      sparse: true,
      index: true
    },
    cohortId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cohort',
      index: true
    },
    issuedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  {
    timestamps: true
  }
);

certificateIssuanceSchema.index({ userId: 1, courseId: 1 }, { unique: true });
certificateIssuanceSchema.index({ courseId: 1, issuedAt: -1 });
certificateIssuanceSchema.index({ approvalStatus: 1, issuedAt: -1 });

const CertificateIssuance =
  mongoose.models.CertificateIssuance || mongoose.model('CertificateIssuance', certificateIssuanceSchema);

module.exports = CertificateIssuance;

export {};
