const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const crypto = require('crypto');
const { z } = require('zod');
const auth = require('../middleware/auth');
const { CertificateApproval, CertificateIssuance, Course, Lesson, Progress, QuizSubmission, User } = require('../models');
const { hasCourseAccess } = require('../services/enrollments');
const { markExistingEnrollmentCompleted } = require('../services/courseCompletion');
const { writeAuditLog } = require('../services/audit');
const { generateCertificateSerial } = require('../services/certificateSerial');
const { logger } = require('../logger');
const { findCohortIdForUserCourse } = require('../services/cohortLookup');
import type { Request, Response } from 'express';
import type { QuizQuestion } from '../../shared/types';

type AuthenticatedRequest = Request & { user: NonNullable<Request['user']> };

const quizSubmitSchema = z.object({
  answers: z.array(
    z.object({
      questionId: z.string().min(1, 'questionId is required'),
      selectedOptionIndex: z.number().int().min(0, 'selectedOptionIndex must be a non-negative integer')
    })
  )
}).strict();

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

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

function shuffled<T>(items: T[]): T[] {
  return [...items]
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

function buildAttemptQuestions(course: any) {
  const questions = getQuizQuestions(course);
  return course.quizRandomizeQuestions === false ? questions : shuffled(questions);
}

async function getAttemptState(userId: unknown, courseId: string, course: any) {
  const [attemptCount, latestPassed] = await Promise.all([
    QuizSubmission.countDocuments({ userId, courseId }),
    QuizSubmission.findOne({ userId, courseId, passed: true }).sort({ createdAt: -1 })
  ]);
  const maxAttempts = Number(course.quizMaxAttempts || 3);

  return {
    attemptCount,
    maxAttempts,
    attemptsRemaining: Math.max(maxAttempts - attemptCount, 0),
    latestPassed
  };
}

async function getCourseAccessState(courseId: string, user: NonNullable<Request['user']>) {
  if (!isValidObjectId(courseId)) {
    return { status: 404, error: "Course not found." };
  }

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

    const attemptState = await getAttemptState(req.user.id, courseId, access.course);
    if (!attemptState.latestPassed && attemptState.attemptsRemaining <= 0) {
      return res.status(403).json({ error: "Maximum quiz attempts reached.", attemptsRemaining: 0 });
    }
    const questions = buildAttemptQuestions(access.course);
    const latestSubmission = await QuizSubmission.findOne({
      userId: req.user.id,
      courseId
    }).sort({ createdAt: -1 });

    res.json({
      courseId: access.course._id.toString(),
      courseTitle: access.course.title,
      passingScore: access.course.quizPassingScore || 70,
      maxAttempts: attemptState.maxAttempts,
      attemptsRemaining: attemptState.latestPassed ? 0 : attemptState.attemptsRemaining,
      questions: questions.map(serializeQuestion),
      latestSubmission
        : latestSubmission
          ? {
              score: latestSubmission.score,
              totalQuestions: latestSubmission.totalQuestions,
              passed: latestSubmission.passed,
              attemptNumber: latestSubmission.attemptNumber || 1,
              attemptsRemaining: attemptState.latestPassed ? 0 : attemptState.attemptsRemaining,
              submittedAt: latestSubmission.createdAt
            }
          : null
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching course quiz');
    res.status(500).json({ error: "Failed to fetch quiz." });
  }
});

/**
 * POST /api/quiz/:courseId/submit
 * Grade a final quiz submission and mark the course complete when passed.
 */
router.post('/:courseId/submit', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const parsed = quizSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid quiz submission payload.' });
    }

    const courseId = String(req.params.courseId);
    const access = await getCourseAccessState(courseId, req.user);
    if (access.status !== 200) {
      return res.status(access.status).json({ error: access.error });
    }

    const submittedAnswers = parsed.data.answers;
    const attemptState = await getAttemptState(req.user.id, courseId, access.course);
    if (!attemptState.latestPassed && attemptState.attemptsRemaining <= 0) {
      return res.status(403).json({ error: "Maximum quiz attempts reached.", attemptsRemaining: 0 });
    }
    const questions = buildAttemptQuestions(access.course);
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
      questionSnapshot: questions,
      attemptNumber: attemptState.attemptCount + 1,
      score,
      totalQuestions: questions.length,
      passed,
      status: passed ? 'passed' : 'failed'
    });

    if (passed) {
      const completion = await markExistingEnrollmentCompleted({ userId: req.user.id, courseId });
      if (!completion.allowed) {
        return res.status(400).json({ error: completion.error || 'Course completion rules were not met.' });
      }
      const learner = await User.findById(req.user.id).select('name');
      const issuedAt = new Date();
      const existingIssuance = await CertificateIssuance.findOne({ userId: req.user.id, courseId });
      
      const cohortId = await findCohortIdForUserCourse(req.user.id, courseId);
      const verificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();

      const isValidInstructor = access.course.instructorId && mongoose.Types.ObjectId.isValid(access.course.instructorId);
      const instructorIdVal = isValidInstructor ? access.course.instructorId : undefined;

      const issuance = existingIssuance || await CertificateIssuance.create({
        certificateId: crypto.randomUUID(),
        serialNumber: await generateCertificateSerial(access.course, issuedAt),
        userId: req.user.id,
        courseId,
        recipientName: learner?.name || req.user.name || req.user.email || 'Learner',
        courseTitle: access.course.title,
        issuedAt,
        approvalStatus: access.course.requiresCertificateApproval === false ? 'approved' : 'pending',
        approvedAt: access.course.requiresCertificateApproval === false ? issuedAt : undefined,
        approvedBy: access.course.requiresCertificateApproval === false ? instructorIdVal : undefined,
        issuedBy: access.course.requiresCertificateApproval === false ? instructorIdVal : undefined,
        cohortId: cohortId || undefined,
        status: 'valid',
        verificationCode
      });
      if (issuance.approvalStatus === 'pending') {
        const approval = await CertificateApproval.findOne({ certificateIssuanceId: issuance._id });
        if (!approval) {
          await CertificateApproval.create({
              userId: req.user.id,
              courseId,
              status: 'pending',
              requestedBy: req.user.id
          });
        }
      }
      if (!existingIssuance) {
        await writeAuditLog(req, {
          action: 'certificate.generate',
          entityType: 'CertificateIssuance',
          entityId: issuance._id,
          details: {
            result: 'success',
            oldValue: null,
            newValue: {
              certificateId: issuance.certificateId,
              serialNumber: issuance.serialNumber,
              userId: req.user.id,
              courseId,
              approvalStatus: issuance.approvalStatus,
              issuedAt: issuance.issuedAt
            }
          }
        });
      }
      await writeAuditLog(req, { action: 'quiz.pass', entityType: 'QuizSubmission', entityId: submission._id, details: { courseId, attemptNumber: submission.attemptNumber } });
    } else {
      await writeAuditLog(req, { action: 'quiz.fail', entityType: 'QuizSubmission', entityId: submission._id, details: { courseId, attemptNumber: submission.attemptNumber } });
    }

    res.json({
      submissionId: submission._id,
      score,
      passingScore,
      totalQuestions: questions.length,
      correctCount,
      passed,
      attemptNumber: submission.attemptNumber,
      attemptsRemaining: passed ? 0 : Math.max(attemptState.maxAttempts - submission.attemptNumber, 0)
    });
  } catch (error) {
    logger.error({ err: error }, 'Error submitting course quiz');
    res.status(500).json({ error: "Failed to submit quiz." });
  }
});

module.exports = router;

export {};
