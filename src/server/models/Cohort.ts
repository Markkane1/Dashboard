const mongoose = require('mongoose');

const cohortSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      default: '',
      trim: true
    },
    courseIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
      }
    ],
    trainerIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    startsAt: {
      type: Date
    },
    endsAt: {
      type: Date
    },
    seatLimit: {
      type: Number,
      default: 0
    },
    status: {
      type: String,
      enum: ['draft', 'active', 'completed', 'archived'],
      default: 'draft',
      index: true
    }
  },
  { timestamps: true }
);

cohortSchema.index({ status: 1, startsAt: -1 });
cohortSchema.index({ courseIds: 1 });
cohortSchema.index({ trainerIds: 1 });

const Cohort = mongoose.models.Cohort || mongoose.model('Cohort', cohortSchema);

module.exports = Cohort;

export {};
