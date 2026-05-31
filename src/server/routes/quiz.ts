const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { Course, Enrollment, Lesson, Progress, QuizSubmission } = require('../models');
const { hasCourseAccess } = require('../services/enrollments');
import type { Request, Response } from 'express';
import type { QuizQuestion } from '../../shared/types';

type AuthenticatedRequest = Request & { user: NonNullable<Request['user']> };

function buildFallbackQuestions(course: { title: string }): Array<QuizQuestion & { correctAnswerIndex: number; explanation: string }> {
  return [
    {
      id: 'core-1',
      prompt: `What is the main purpose of completing "${course.title}"?`,
      options: [
        'To understand and apply the course concepts',
        'To skip the lesson material',
        'To replace all environmental regulations',
        'To avoid checking learning progress'
      ],
      correctAnswerIndex: 0,
      explanation: 'The final quiz checks that learners understood the core course material.'
    },
    {
      id: 'core-2',
      prompt: 'When should a learner take this final quiz?',
      options: [
        'After completing all course lessons',
        'Before enrolling in the course',
        'Before watching any lessons',
        'Only after leaving the platform'
      ],
      correctAnswerIndex: 0,
      explanation: 'The quiz is unlocked only after every lesson is completed.'
    },
    {
      id: 'core-3',
      prompt: 'What does successful quiz completion represent?',
      options: [
        'A final review of the course learning outcomes',
        'A video upload confirmation',
        'An account password reset',
        'A course enrollment request'
      ],
      correctAnswerIndex: 0,
      explanation: 'Passing the quiz confirms the learner has reviewed the course outcomes.'
    }
  ];
}

function getQuizQuestions(course: any): Array<QuizQuestion & { correctAnswerIndex: number; explanation?: string }> {
  const questions = Array.isArray(course.quizQuestions) && course.quizQuestions.length > 0
    ? course.quizQuestions
    : buildFallbackQuestions(course);

  return questions.map((question: any, index: number) => ({
    id: question.id || `question-${index + 1}`,
    prompt: question.prompt,
    options: question.options,
    correctAnswerIndex: question.correctAnswerIndex,
    explanation: question.explanation
  }));
}

function serializeQuestion(question: QuizQuestion): QuizQuestion {
  return {
    id: question.id,
    prompt: question.prompt,
    options: question.options
  };
}

async function getCourseAccessState(courseId: string, user: NonNullable<Request['user']>) {
  const course = await Course.findById(courseId);
  if (!course) {
    return { status: 404, error: "Course not found." };
  }

  if (!(await hasCourseAccess(user, courseId))) {
    return { status: 403, error: "You must be enrolled in this course to take the quiz." };
  }

  const lessons = await Lesson.find({ courseId, isPublished: true }).select('_id');
  const totalLessons = lessons.length;
  const progressRecords = await Progress.find({ userId: user.id, courseId, completed: true }).select('lessonId');
  const completedLessonIds = new Set(progressRecords.map((progress: any) => progress.lessonId.toString()));
  const completedLessons = lessons.filter((lesson: any) => completedLessonIds.has(lesson._id.toString())).length;

  if (totalLessons > 0 && completedLessons < totalLessons) {
    return {
      status: 403,
      error: "Complete all lessons before taking the final quiz.",
      course,
      totalLessons,
      completedLessons
    };
  }

  return {
    status: 200,
    course,
    totalLessons,
    completedLessons
  };
}

/**
 * GET /api/quiz/:courseId
 * Return final quiz questions after all published lessons are completed.
 */
router.get('/:courseId', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const courseId = String(req.params.courseId);
    const access = await getCourseAccessState(courseId, req.user);
    if (access.status !== 200) {
      return res.status(access.status).json({
        error: access.error,
        totalLessons: access.totalLessons,
        completedLessons: access.completedLessons
      });
    }

    const questions = getQuizQuestions(access.course);
    const latestSubmission = await QuizSubmission.findOne({
      userId: req.user.id,
      courseId
    }).sort({ createdAt: -1 });

    res.json({
      courseId: access.course._id.toString(),
      courseTitle: access.course.title,
      passingScore: access.course.quizPassingScore || 70,
      questions: questions.map(serializeQuestion),
      latestSubmission
        : latestSubmission
          ? {
              score: latestSubmission.score,
              totalQuestions: latestSubmission.totalQuestions,
              passed: latestSubmission.passed,
              submittedAt: latestSubmission.createdAt
            }
          : null
    });
  } catch (error) {
    console.error("Error fetching course quiz:", error);
    res.status(500).json({ error: "Failed to fetch quiz." });
  }
});

/**
 * POST /api/quiz/:courseId/submit
 * Grade a final quiz submission and mark the course complete when passed.
 */
router.post('/:courseId/submit', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const courseId = String(req.params.courseId);
    const access = await getCourseAccessState(courseId, req.user);
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.error });
    }

    const submittedAnswers = Array.isArray(req.body.answers) ? req.body.answers : [];
    const questions = getQuizQuestions(access.course);
    const answerMap = new Map(
      submittedAnswers.map((answer: any) => [answer.questionId, answer.selectedOptionIndex])
    );

    const gradedQuestions = questions.map((question) => {
      const selectedOptionIndex = answerMap.get(question.id);
      const correct = selectedOptionIndex === question.correctAnswerIndex;

      return {
        questionId: question.id,
        selectedOptionIndex,
        correct
      };
    });

    const correctCount = gradedQuestions.filter((question: { correct: boolean }) => question.correct).length;
    const score = questions.length > 0 ? Math.round((correctCount / questions.length) * 100) : 0;
    const passingScore = access.course.quizPassingScore || 70;
    const passed = score >= passingScore;

    const submission = await QuizSubmission.create({
      userId: req.user.id,
      courseId,
      answers: submittedAnswers,
      score,
      totalQuestions: questions.length,
      passed
    });

    if (passed) {
      await Enrollment.updateOne(
        { userId: req.user.id, courseId },
        { $set: { completed: true, completedAt: new Date() } }
      );
    }

    res.json({
      submissionId: submission._id,
      score,
      passingScore,
      totalQuestions: questions.length,
      correctCount,
      passed
    });
  } catch (error) {
    console.error("Error submitting course quiz:", error);
    res.status(500).json({ error: "Failed to submit quiz." });
  }
});

module.exports = router;

export {};
