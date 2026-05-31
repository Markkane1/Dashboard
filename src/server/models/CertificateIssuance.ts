const mongoose = require('mongoose');

const certificateIssuanceSchema = new mongoose.Schema(
  {
    certificateId: {
      type: String,
      required: true,
      unique: true,
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
    revokedAt: {
      type: Date
    }
  },
  {
    timestamps: true
  }
);

certificateIssuanceSchema.index({ userId: 1, courseId: 1 }, { unique: true });
certificateIssuanceSchema.index({ courseId: 1, issuedAt: -1 });

const CertificateIssuance =
  mongoose.models.CertificateIssuance || mongoose.model('CertificateIssuance', certificateIssuanceSchema);

module.exports = CertificateIssuance;

export {};
