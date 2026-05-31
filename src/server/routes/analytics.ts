const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/roles');
const { Course, Enrollment, Progress, QuizSubmission, User } = require('../models');
const { logger } = require('../logger');
const { PERMISSIONS } = require('../../shared/permissions');
import type { Request, Response } from 'express';

function percent(numerator: number, denominator: number) {
  if (!denominator) return 0;
  return Math.round((numerator / denominator) * 100);
}

router.get('/overview', auth, requirePermission(PERMISSIONS.VIEW_ANALYTICS), async (_req: Request, res: Response) => {
  try {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      userCount,
      courseCount,
      enrollmentCount,
      completedEnrollmentCount,
      progressCount,
      quizSubmissionCount,
      quizAverages,
      courseStats,
      dailyActiveUsers,
      weeklyActiveUsers,
      progressSummary
    ] = await Promise.all([
      User.countDocuments({}),
      Course.countDocuments({}),
      Enrollment.countDocuments({}),
      Enrollment.countDocuments({ completed: true }),
      Progress.countDocuments({}),
      QuizSubmission.countDocuments({}),
      QuizSubmission.aggregate([
        {
          $group: {
            _id: null,
            averageScore: { $avg: '$score' },
            passCount: { $sum: { $cond: ['$passed', 1, 0] } }
          }
        }
      ]),
      Enrollment.aggregate([
        {
          $group: {
            _id: '$courseId',
            enrollments: { $sum: 1 },
            completions: { $sum: { $cond: ['$completed', 1, 0] } }
          }
        },
        { $sort: { enrollments: -1 } },
        { $limit: 10 },
        {
          $lookup: {
            from: 'courses',
            localField: '_id',
            foreignField: '_id',
            as: 'course'
          }
        },
        { $unwind: { path: '$course', preserveNullAndEmptyArrays: true } },
        {
          $project: {
            courseId: { $toString: '$_id' },
            title: '$course.title',
            enrollments: 1,
            completions: 1
          }
        }
      ]),
      Progress.distinct('userId', { lastWatchedAt: { $gte: oneDayAgo } }),
      Progress.distinct('userId', { lastWatchedAt: { $gte: oneWeekAgo } }),
      Progress.aggregate([
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            completedRecords: { $sum: { $cond: ['$completed', 1, 0] } },
            averageWatchRate: {
              $avg: {
                $cond: [
                  { $gt: ['$duration', 0] },
                  { $divide: ['$watchedSeconds', '$duration'] },
                  0
                ]
              }
            }
          }
        }
      ])
    ]);
    const quizSummary = quizAverages[0] || {};
    const progressStats = progressSummary[0] || { totalRecords: 0, completedRecords: 0, averageWatchRate: 0 };

    res.json({
      users: userCount,
      courses: courseCount,
      enrollments: enrollmentCount,
      completedEnrollments: completedEnrollmentCount,
      completionRate: percent(completedEnrollmentCount, enrollmentCount),
      progressRecords: progressCount,
      quizSubmissions: quizSubmissionCount,
      averageQuizScore: Math.round(quizSummary.averageScore || 0),
      quizPassRate: percent(quizSummary.passCount || 0, quizSubmissionCount),
      dailyActiveUsers: dailyActiveUsers.length,
      weeklyActiveUsers: weeklyActiveUsers.length,
      averageLessonCompletionRate: percent(progressStats.completedRecords, progressStats.totalRecords),
      averageLessonWatchRate: Math.round((progressStats.averageWatchRate || 0) * 100),
      topCourses: courseStats.map((stat: any) => ({
        courseId: stat.courseId,
        title: stat.title || 'Deleted course',
        enrollments: stat.enrollments,
        completions: stat.completions,
        completionRate: percent(stat.completions, stat.enrollments)
      }))
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching analytics overview');
    res.status(500).json({ error: 'Failed to fetch analytics overview' });
  }
});

router.get('/courses/:courseId', auth, requirePermission(PERMISSIONS.VIEW_ANALYTICS), async (req: Request, res: Response) => {
  try {
    const { courseId } = req.params;
    const courseObjectId = require('mongoose').Types.ObjectId.isValid(courseId)
      ? new (require('mongoose').Types.ObjectId)(courseId)
      : courseId;
    const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [course, enrollments, completions, quizAttempts, quizAverages, activeLearners, weeklyActiveLearners, progressStats] = await Promise.all([
      Course.findById(courseId).select('title'),
      Enrollment.countDocuments({ courseId: courseObjectId }),
      Enrollment.countDocuments({ courseId: courseObjectId, completed: true }),
      QuizSubmission.countDocuments({ courseId: courseObjectId }),
      QuizSubmission.aggregate([
        { $match: { courseId: courseObjectId } },
        {
          $group: {
            _id: null,
            averageScore: { $avg: '$score' },
            passCount: { $sum: { $cond: ['$passed', 1, 0] } }
          }
        }
      ]),
      Progress.distinct('userId', { courseId: courseObjectId }),
      Progress.distinct('userId', { courseId: courseObjectId, lastWatchedAt: { $gte: oneWeekAgo } }),
      Progress.aggregate([
        { $match: { courseId: courseObjectId } },
        {
          $group: {
            _id: null,
            totalRecords: { $sum: 1 },
            completedRecords: { $sum: { $cond: ['$completed', 1, 0] } },
            averageWatchRate: {
              $avg: {
                $cond: [
                  { $gt: ['$duration', 0] },
                  { $divide: ['$watchedSeconds', '$duration'] },
                  0
                ]
              }
            }
          }
        }
      ])
    ]);
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    const quizSummary = quizAverages[0] || {};
    const progressSummary = progressStats[0] || { totalRecords: 0, completedRecords: 0, averageWatchRate: 0 };

    res.json({
      courseId,
      title: course.title,
      enrollments,
      completions,
      completionRate: percent(completions, enrollments),
      dropOffRate: percent(enrollments - completions, enrollments),
      activeLearners: activeLearners.length,
      weeklyActiveLearners: weeklyActiveLearners.length,
      quizAttempts,
      averageQuizScore: Math.round(quizSummary.averageScore || 0),
      quizPassRate: percent(quizSummary.passCount || 0, quizAttempts),
      averageLessonCompletionRate: percent(progressSummary.completedRecords, progressSummary.totalRecords),
      averageLessonWatchRate: Math.round((progressSummary.averageWatchRate || 0) * 100)
    });
  } catch (error) {
    logger.error({ err: error }, 'Error fetching course analytics');
    res.status(500).json({ error: 'Failed to fetch course analytics' });
  }
});

module.exports = router;

export {};
