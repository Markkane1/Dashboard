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
      required: true
    },
    instructorName: {
      type: String,
      required: true
    },
    instructorAvatar: {
      type: String,
      default: ""
    },
    price: {
      type: Number,
      required: true,
      default: 0
    },
    thumbnail: {
      type: String,
      required: true
    },
    category: {
      type: String,
      required: true
    },
    duration: {
      type: String,
      required: true
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
    }
  },
  {
    timestamps: true,
    // Enable virtuals to be included in toJSON and toObject conversions
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Virtual field to populate related lessons from the 'Lesson' collection without embedding
courseSchema.virtual('lessons', {
  ref: 'Lesson',
  localField: '_id',
  foreignField: 'courseId'
});

// Virtual field to compute the total duration of the course (sum of all lesson durations in seconds)
courseSchema.virtual('totalDuration').get(function () {
  if (!this.lessons) return 0;
  return this.lessons.reduce((total, lesson) => total + (lesson.duration || 0), 0);
});

/**
 * Instance method to calculate a user's course progress.
 * @param {mongoose.Types.ObjectId|String} userId - The ID of the authenticated user
 * @returns {Promise<Object>} An object detailing total lessons, completed lessons, completion percentage, and last watched lesson ID.
 */
courseSchema.methods.getCourseProgress = async function (userId) {
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
  const progressRecords = await Progress.find({
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

const Course = mongoose.models.Course || mongoose.model('Course', courseSchema);

module.exports = Course;
