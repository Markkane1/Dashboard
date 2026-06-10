const { Course, Enrollment, Lesson, Progress, QuizSubmission } = require('../models');
const { isCoursePublishable } = require('./courseAccessRules');

type CompletionRulesResult = {
  allowed: boolean;
  error?: string;
  enrollment?: any;
  course?: any;
};

async function verifyCourseCompletionRules(userId: unknown, courseId: unknown): Promise<CompletionRulesResult> {
  const normalizedUserId = String(userId);
  const normalizedCourseId = String(courseId);

  const enrollment = await Enrollment.findOne({ userId: normalizedUserId, courseId: normalizedCourseId });
  if (!enrollment) {
    return { allowed: false, error: 'User is not enrolled in this course.' };
  }

  const course = await Course.findById(normalizedCourseId);
  if (!course) {
    return { allowed: false, error: 'Course not found.' };
  }
  if (!isCoursePublishable(course)) {
    return { allowed: false, error: 'Course is not published or active.' };
  }

  const lessons = await Lesson.find({ courseId: normalizedCourseId, isPublished: true }).select('_id completionMode');
  const hasQuiz = Array.isArray(course.quizQuestions) && course.quizQuestions.length > 0;
  const hasManualCompletionLessons = lessons.some((lesson: any) => lesson.completionMode === 'manual');
  if (hasManualCompletionLessons) {
    return {
      allowed: false,
      error: 'Manual lesson completion is not allowed. All course videos must use verified video progress.',
      enrollment,
      course
    };
  }
  const hasQuizGateLessons = lessons.some((lesson: any) => lesson.completionMode === 'quiz_gate');
  if (hasQuizGateLessons && !hasQuiz) {
    return { allowed: false, error: 'Quiz-gated lessons require a course assessment.', enrollment, course };
  }

  const passedQuiz = hasQuiz
    ? await QuizSubmission.findOne({
        userId: normalizedUserId,
        courseId: normalizedCourseId,
        passed: true
      })
    : null;

  const progressRequiredLessons = lessons.filter((lesson: any) => lesson.completionMode !== 'quiz_gate');
  const progressRecords = await Progress.find({
    userId: normalizedUserId,
    courseId: normalizedCourseId,
    completed: true
  }).select('lessonId');
  const completedLessonIds = new Set(progressRecords.map((progress: any) => progress.lessonId.toString()));
  const allProgressRequiredLessonsCompleted = progressRequiredLessons.every((lesson: any) => completedLessonIds.has(lesson._id.toString()));
  if (!allProgressRequiredLessonsCompleted) {
    return { allowed: false, error: 'Not all published lessons are completed.', enrollment, course };
  }

  if (hasQuiz) {
    if (!passedQuiz) {
      return { allowed: false, error: 'Final quiz has not been passed.', enrollment, course };
    }
  }

  return { allowed: true, enrollment, course };
}

async function markExistingEnrollmentCompleted(input: {
  userId: unknown;
  courseId: unknown;
  completedAt?: Date;
}) {
  const result = await verifyCourseCompletionRules(input.userId, input.courseId);
  if (!result.allowed || !result.enrollment) return result;

  result.enrollment.completed = true;
  result.enrollment.completedAt = input.completedAt || new Date();
  await result.enrollment.save();
  return result;
}

module.exports = {
  verifyCourseCompletionRules,
  markExistingEnrollmentCompleted
};

export {};
