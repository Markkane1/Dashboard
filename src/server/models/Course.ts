const mongoose = require('mongoose');

const courseSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true
    },
    description: {
      type: String,
      required: true,
      trim: true
    },
    instructorId: {
      type: String,
      default: ''
    },
    instructorName: {
      type: String,
      default: ''
    },
    instructorAvatar: {
      type: String,
      default: ""
    },
    trainerIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
      }
    ],
    price: {
      type: Number,
      required: true,
      default: 0
    },
    thumbnail: {
      type: String,
      default: ''
    },
    category: {
      type: String,
      required: true
    },
    sdgGoals: [
      {
        type: Number
      }
    ],
    topics: [
      {
        type: String
      }
    ],
    sections: [
      {
        type: String
      }
    ],
    mea: [
      {
        type: String
      }
    ],
    syllabusUrl: {
      type: String
    },
    courseUrl: {
      type: String
    },
    isDiploma: {
      type: Boolean,
      default: false
    },
    isExternal: {
      type: Boolean,
      default: false
    },
    externalUrl: {
      type: String
    },
    diplomaRequiredCourseIds: [
      {
        type: String
      }
    ],
    prerequisiteCourseIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Course'
      }
    ],
    publishStatus: {
      type: String,
      enum: ['draft', 'pending', 'published', 'rejected'],
      default: 'published',
      index: true
    },
    approvalStatus: {
      type: String,
      enum: ['draft', 'pending', 'approved', 'rejected'],
      default: 'approved',
      index: true
    },
    status: {
      type: String,
      enum: ['draft', 'submitted_for_review', 'approved', 'published', 'archived'],
      index: true
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    submittedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    submittedAt: {
      type: Date
    },
    submittedForApprovalAt: {
      type: Date
    },
    approvedAt: {
      type: Date
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    publishedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    publishedAt: {
      type: Date
    },
    archivedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    archivedAt: {
      type: Date
    },
    rejectedAt: {
      type: Date
    },
    rejectedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    approvalComments: {
      type: String,
      default: ''
    },
    requiresFeedback: {
      type: Boolean,
      default: false
    },
    certificateEligible: {
      type: Boolean,
      default: false,
      index: true
    },
    requiresVerifiedProgress: {
      type: Boolean,
      default: false
    },
    requiresCertificateApproval: {
      type: Boolean,
      default: true
    },
    duration: {
      type: String,
      default: ''
    },
    lessonsCount: {
      type: Number,
      required: true,
      default: 0
    },
    rating: {
      type: Number,
      default: 4.5
    },
    enrolledCount: {
      type: Number,
      default: 0
    },
    quizQuestions: [
      {
        id: { type: String },
        prompt: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctAnswerIndex: { type: Number, required: true },
        explanation: { type: String }
      }
    ],
    quizPassingScore: {
      type: Number,
      default: 70
    },
    quizMaxAttempts: {
      type: Number,
      default: 3
    },
    quizRandomizeQuestions: {
      type: Boolean,
      default: true
    },
    quizRandomizeOptions: {
      type: Boolean,
      default: true
    },
    demoKey: {
      type: String,
      index: true
    }
  },
  {
    timestamps: true,
    // Enable virtuals to be included in toJSON and toObject conversions
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Indexes for course sorting and filtering to prevent full collection scans
courseSchema.index({ createdAt: -1 });
courseSchema.index({ category: 1, createdAt: -1 });
courseSchema.index({ publishStatus: 1, approvalStatus: 1, createdAt: -1 });
courseSchema.index({ status: 1, createdAt: -1 });
courseSchema.index({ trainerIds: 1 });
courseSchema.index({ sdgGoals: 1 });
courseSchema.index({ sections: 1 });
courseSchema.index({ mea: 1 });
courseSchema.index({ title: 'text', description: 'text' });

// Virtual field to populate related lessons from the 'Lesson' collection without embedding
courseSchema.virtual('lessons', {
  ref: 'Lesson',
  localField: '_id',
  foreignField: 'courseId'
});

// Virtual field to compute the total duration of the course (sum of all lesson durations in seconds)
courseSchema.virtual('totalDuration').get(function (this: { lessons?: Array<{ duration?: number }> }) {
  if (!this.lessons) return 0;
  return this.lessons.reduce((total: number, lesson) => total + (lesson.duration || 0), 0);
});

/**
 * Instance method to calculate a user's course progress.
 * @param {mongoose.Types.ObjectId|String} userId - The ID of the authenticated user
 * @returns {Promise<Object>} An object detailing total lessons, completed lessons, completion percentage, and last watched lesson ID.
 */
courseSchema.methods.getCourseProgress = async function (this: { _id: unknown }, userId: unknown) {
  const Lesson = mongoose.model('Lesson');
  const Progress = mongoose.model('Progress');

  // Query all lessons belonging to this course ordered by position
  const lessons = await Lesson.find({ courseId: this._id }).sort({ order: 1 });
  const totalLessons = lessons.length;

  if (totalLessons === 0) {
    return {
      totalLessons: 0,
      completedLessons: 0,
      percentComplete: 0,
      lastWatchedLessonId: null
    };
  }

  // Fetch all playback progress documents for this user and this course
  const progressRecords: Array<{ completed?: boolean; lastWatchedAt: Date; lessonId: unknown }> = await Progress.find({
    userId,
    courseId: this._id
  });

  const completedLessons = progressRecords.filter((record) => record.completed).length;
  const percentComplete = Math.round((completedLessons / totalLessons) * 100);

  // Identify the last watched lesson by lastWatchedAt timestamp
  let lastWatchedLessonId = null;
  if (progressRecords.length > 0) {
    const sortedRecords = [...progressRecords].sort(
      (a, b) => new Date(b.lastWatchedAt).getTime() - new Date(a.lastWatchedAt).getTime()
    );
    lastWatchedLessonId = sortedRecords[0].lessonId;
  }

  return {
    totalLessons,
    completedLessons,
    percentComplete,
    lastWatchedLessonId
  };
};

async function deleteCourseRelations(courseIds: unknown | unknown[]) {
  const ids = Array.isArray(courseIds) ? courseIds.filter(Boolean) : [courseIds].filter(Boolean);
  if (ids.length === 0) return;

  const Enrollment = require('./Enrollment');
  const Lesson = require('./Lesson');
  const Progress = require('./Progress');
  const QuizSubmission = require('./QuizSubmission');
  const CertificateIssuance = require('./CertificateIssuance');
  const courseFilter = { $in: ids };

  await Promise.all([
    Enrollment.deleteMany({ courseId: courseFilter }),
    Lesson.deleteMany({ courseId: courseFilter }),
    Progress.deleteMany({ courseId: courseFilter }),
    QuizSubmission.deleteMany({ courseId: courseFilter }),
    CertificateIssuance.deleteMany({ courseId: courseFilter })
  ]);
}

courseSchema.pre('findOneAndDelete', async function (this: any) {
  const course = await this.model.findOne(this.getFilter()).select('_id');
  await deleteCourseRelations(course?._id);
});

courseSchema.pre('deleteOne', { document: true, query: false }, async function (this: { _id: unknown }) {
  await deleteCourseRelations(this._id);
});

courseSchema.pre('deleteOne', { document: false, query: true }, async function (this: any) {
  const course = await this.model.findOne(this.getFilter()).select('_id');
  await deleteCourseRelations(course?._id);
});

courseSchema.pre('deleteMany', async function (this: any) {
  const courses = await this.model.find(this.getFilter()).select('_id');
  await deleteCourseRelations(courses.map((course: { _id: unknown }) => course._id));
});

const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);

module.exports = Course;

export {};
