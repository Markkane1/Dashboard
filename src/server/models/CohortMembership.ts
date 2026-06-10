const mongoose = require('mongoose');

const cohortMembershipSchema = new mongoose.Schema(
  {
    cohortId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cohort',
      required: true,
      index: true
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    status: {
      type: String,
      enum: ['active', 'removed', 'completed'],
      default: 'active',
      index: true
    },
    addedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    }
  },
  { timestamps: true }
);

cohortMembershipSchema.index({ cohortId: 1, userId: 1 }, { unique: true });

const CohortMembership =
  mongoose.models.CohortMembership || mongoose.model('CohortMembership', cohortMembershipSchema);

module.exports = CohortMembership;

export {};
