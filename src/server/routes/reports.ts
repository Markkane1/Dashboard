const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/roles');
const {
  AssignmentSubmission,
  AuditLog,
  CertificateIssuance,
  CohortMembership,
  Course,
  Enrollment,
  QuizSubmission,
  User
} = require('../models');
const { PERMISSIONS } = require('../../shared/permissions');
const { toCsv, toPdf, toXlsx } = require('../services/reportExport');
const { writeAuditLog } = require('../services/audit');
const { logger } = require('../logger');
import type { Request, Response } from 'express';

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

function queryString(req: Request, key: string) {
  return typeof req.query[key] === 'string' ? String(req.query[key]) : '';
}

function applyDateRange(filter: Record<string, unknown>, field: string, req: Request) {
  const from = queryString(req, 'from');
  const to = queryString(req, 'to');
  if (!from && !to) return;
  filter[field] = {};
  if (from) (filter[field] as Record<string, Date>).$gte = new Date(from);
  if (to) (filter[field] as Record<string, Date>).$lte = new Date(to);
}

async function cohortScope(req: Request) {
  const cohortId = queryString(req, 'cohortId');
  if (!isValidObjectId(cohortId)) return null;
  const memberships = await CohortMembership.find({ cohortId }).select('userId');
  return memberships.map((member: any) => member.userId);
}

async function buildRows(type: string, req: Request) {
  if (type === 'cohort-roster') {
    const filter: Record<string, unknown> = {};
    const cohortId = queryString(req, 'cohortId');
    const status = queryString(req, 'status');
    if (isValidObjectId(cohortId)) filter.cohortId = cohortId;
    if (status) filter.status = status;
    applyDateRange(filter, 'createdAt', req);
    const memberships = await CohortMembership.find(filter).populate('cohortId', 'title status courseIds trainerIds').populate('userId', 'name email role');
    return memberships.map((item: any) => ({
      cohort: item.cohortId?.title || '',
      cohortStatus: item.cohortId?.status || '',
      learnerName: item.userId?.name || '',
      learnerEmail: item.userId?.email || '',
      learnerRole: item.userId?.role || '',
      membershipStatus: item.status,
      courseCount: item.cohortId?.courseIds?.length || 0,
      trainerCount: item.cohortId?.trainerIds?.length || 0,
      addedAt: item.createdAt?.toISOString?.() || ''
    }));
  }

  if (type === 'completion') {
    const filter: Record<string, unknown> = {};
    const courseId = queryString(req, 'courseId');
    const userId = queryString(req, 'userId');
    const status = queryString(req, 'status');
    if (isValidObjectId(courseId)) filter.courseId = courseId;
    if (isValidObjectId(userId)) filter.userId = userId;
    if (status === 'completed') filter.completed = true;
    if (status === 'incomplete') filter.completed = false;
    const scopedUserIds = await cohortScope(req);
    if (scopedUserIds) filter.userId = { $in: scopedUserIds };
    applyDateRange(filter, status === 'completed' ? 'completedAt' : 'createdAt', req);
    const enrollments = await Enrollment.find(filter).populate('userId', 'name email').populate('courseId', 'title');
    return enrollments.map((item: any) => ({
      learnerName: item.userId?.name || '',
      learnerEmail: item.userId?.email || '',
      courseTitle: item.courseId?.title || '',
      completed: item.completed ? 'Yes' : 'No',
      completedAt: item.completedAt?.toISOString?.() || '',
      enrolledAt: item.createdAt?.toISOString?.() || ''
    }));
  }

  if (type === 'quiz-results') {
    const filter: Record<string, unknown> = {};
    const courseId = queryString(req, 'courseId');
    const userId = queryString(req, 'userId');
    const status = queryString(req, 'status');
    if (isValidObjectId(courseId)) filter.courseId = courseId;
    if (isValidObjectId(userId)) filter.userId = userId;
    if (status === 'passed') filter.passed = true;
    if (status === 'failed') filter.passed = false;
    const scopedUserIds = await cohortScope(req);
    if (scopedUserIds) filter.userId = { $in: scopedUserIds };
    applyDateRange(filter, 'createdAt', req);
    const submissions = await QuizSubmission.find(filter).populate('userId', 'name email').populate('courseId', 'title');
    return submissions.map((item: any) => ({
      learnerName: item.userId?.name || '',
      learnerEmail: item.userId?.email || '',
      courseTitle: item.courseId?.title || '',
      attemptNumber: item.attemptNumber || 1,
      score: item.score,
      totalQuestions: item.totalQuestions,
      passed: item.passed ? 'Yes' : 'No',
      submittedAt: item.createdAt?.toISOString?.() || ''
    }));
  }

  if (type === 'certificates') {
    const filter: Record<string, unknown> = {};
    const courseId = queryString(req, 'courseId');
    const userId = queryString(req, 'userId');
    const approvalStatus = queryString(req, 'approvalStatus') || queryString(req, 'status');
    const revoked = queryString(req, 'revoked');
    if (isValidObjectId(courseId)) filter.courseId = courseId;
    if (isValidObjectId(userId)) filter.userId = userId;
    if (['pending', 'approved', 'rejected'].includes(approvalStatus)) filter.approvalStatus = approvalStatus;
    if (revoked === 'true') filter.revokedAt = { $exists: true };
    if (revoked === 'false') filter.revokedAt = { $exists: false };
    const scopedUserIds = await cohortScope(req);
    if (scopedUserIds) filter.userId = { $in: scopedUserIds };
    applyDateRange(filter, 'issuedAt', req);
    const certificates = await CertificateIssuance.find(filter).populate('userId', 'name email').populate('courseId', 'title');
    return certificates.map((item: any) => ({
      serialNumber: item.serialNumber || item.certificateId,
      certificateId: item.certificateId,
      learnerName: item.userId?.name || item.recipientName,
      learnerEmail: item.userId?.email || '',
      courseTitle: item.courseId?.title || item.courseTitle,
      approvalStatus: item.approvalStatus,
      revoked: item.revokedAt ? 'Yes' : 'No',
      revocationReason: item.revocationReason || '',
      issuedAt: item.issuedAt?.toISOString?.() || '',
      approvedAt: item.approvedAt?.toISOString?.() || '',
      revokedAt: item.revokedAt?.toISOString?.() || ''
    }));
  }

  if (type === 'assignment-submissions') {
    const filter: Record<string, unknown> = {};
    const courseId = queryString(req, 'courseId');
    const userId = queryString(req, 'userId');
    const status = queryString(req, 'status');
    if (isValidObjectId(courseId)) filter.courseId = courseId;
    if (isValidObjectId(userId)) filter.learnerId = userId;
    if (['submitted', 'approved', 'needs_revision', 'rejected'].includes(status)) filter.status = status;
    const scopedUserIds = await cohortScope(req);
    if (scopedUserIds) filter.learnerId = { $in: scopedUserIds };
    applyDateRange(filter, 'updatedAt', req);
    const submissions = await AssignmentSubmission.find(filter).populate('learnerId', 'name email').populate('assignmentId', 'title');
    return submissions.map((item: any) => ({
      learnerName: item.learnerId?.name || '',
      learnerEmail: item.learnerId?.email || '',
      assignmentTitle: item.assignmentId?.title || '',
      status: item.status,
      reviewedAt: item.reviewedAt?.toISOString?.() || '',
      submittedAt: item.createdAt?.toISOString?.() || ''
    }));
  }

  if (type === 'audit-logs') {
    const filter: Record<string, unknown> = {};
    for (const key of ['actorId', 'action', 'entityType', 'entityId']) {
      const value = queryString(req, key);
      if (value) filter[key] = value;
    }
    applyDateRange(filter, 'createdAt', req);
    const logs = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(5000);
    return logs.map((item: any) => ({
      actorEmail: item.actorEmail,
      action: item.action,
      entityType: item.entityType,
      entityId: item.entityId,
      createdAt: item.createdAt?.toISOString?.() || ''
    }));
  }

  if (type === 'courses') {
    const filter: Record<string, unknown> = {};
    const status = queryString(req, 'status');
    const approvalStatus = queryString(req, 'approvalStatus');
    if (status) filter.publishStatus = status;
    if (approvalStatus) filter.approvalStatus = approvalStatus;
    applyDateRange(filter, 'createdAt', req);
    const courses = await Course.find(filter).sort({ createdAt: -1 });
    return courses.map((course: any) => ({
      title: course.title,
      status: course.publishStatus,
      approval: course.approvalStatus,
      category: course.category,
      enrolledCount: course.enrolledCount,
      lessonsCount: course.lessonsCount
    }));
  }

  if (type === 'users') {
    const filter: Record<string, unknown> = {};
    const status = queryString(req, 'status');
    if (status === 'verified') filter.emailVerified = true;
    if (status === 'unverified') filter.emailVerified = false;
    applyDateRange(filter, 'createdAt', req);
    const users = await User.find(filter).sort({ createdAt: -1 });
    return users.map((user: any) => ({
      name: user.name,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified ? 'Yes' : 'No',
      createdAt: user.createdAt?.toISOString?.() || ''
    }));
  }

  return null;
}

router.get('/:type/preview', auth, requirePermission(PERMISSIONS.EXPORT_REPORTS), async (req: Request, res: Response) => {
  try {
    const type = String(req.params.type);
    const rows = await buildRows(type, req);
    if (!rows) return res.status(404).json({ error: 'Unknown report type.' });
    res.json({ type, rowCount: rows.length, sample: rows.slice(0, 5) });
  } catch (error) {
    logger.error({ err: error }, 'Error previewing report');
    res.status(500).json({ error: 'Failed to preview report.' });
  }
});

router.get('/:type/export', auth, requirePermission(PERMISSIONS.EXPORT_REPORTS), async (req: Request, res: Response) => {
  try {
    const type = String(req.params.type);
    const rows = await buildRows(type, req);
    if (!rows) {
      return res.status(404).json({ error: 'Unknown report type.' });
    }
    const format = String(req.query.format || 'csv').toLowerCase();
    await writeAuditLog(req, { action: 'report.export', entityType: 'Report', entityId: type, details: { format, rowCount: rows.length, filters: req.query } });

    if (format === 'pdf') {
      const pdfBytes = await toPdf(`EPA Punjab ${type} report`, rows);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${type}.pdf"`);
      return res.send(Buffer.from(pdfBytes));
    }

    if (format === 'xlsx') {
      const workbook = await toXlsx(type, rows);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${type}.xlsx"`);
      return res.send(workbook);
    }

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${type}.csv"`);
    res.send(toCsv(rows));
  } catch (error) {
    logger.error({ err: error }, 'Error exporting report');
    res.status(500).json({ error: 'Failed to export report.' });
  }
});

module.exports = router;

export {};
