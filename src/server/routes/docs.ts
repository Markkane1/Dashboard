const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const { CertificateIssuance, Course, User } = require('../models');
const { getCompletedEnrollments, getEnrollment } = require('../services/enrollments');
const { generateCertificateSerial } = require('../services/certificateSerial');
const { writeAuditLog } = require('../services/audit');
const { formatIssuedOn, getOrCreateDocumentPdf } = require('../services/documentPdf');
const { logger } = require('../logger');
const { findCohortIdForUserCourse } = require('../services/cohortLookup');
import type { Request, Response } from 'express';

type AuthenticatedRequest = Request & { user: NonNullable<Request['user']> };

function safeFilename(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 80);
}

function sendPdf(res: Response, bytes: Buffer | Uint8Array, filename: string): void {
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(Buffer.from(bytes));
}

function getRequiredCourseIds(diploma: any, courses: any[]): string[] {
  if (Array.isArray(diploma.diplomaRequiredCourseIds) && diploma.diplomaRequiredCourseIds.length > 0) {
    return diploma.diplomaRequiredCourseIds;
  }

  return courses
    .filter((course) => (
      course.category === diploma.category &&
      !course.isDiploma &&
      !course.isExternal
    ))
    .map((course) => course._id.toString());
}

function getAppUrl(req: Request): string {
  return process.env.APP_URL || `${req.protocol}://${req.get('host')}`;
}

function buildVerificationUrl(req: Request, certificateId: string): string {
  return `${getAppUrl(req).replace(/\/$/, '')}/api/certificates/verify/${certificateId}`;
}

async function getOrCreateCertificateIssuance(input: {
  userId: string;
  courseId: string;
  recipientName: string;
  courseTitle: string;
  issuedAt: Date;
  approvalStatus?: 'pending' | 'approved';
  issuedBy?: string;
}) {
  const existing = await CertificateIssuance.findOne({ userId: input.userId, courseId: input.courseId });
  if (existing) return existing;
  const course = await Course.findById(input.courseId);
  const serialNumber = await generateCertificateSerial(course, input.issuedAt);
  const cohortId = await findCohortIdForUserCourse(input.userId, input.courseId);
  const verificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();

  const mongoose = require('mongoose');
  const isValidIssuer = input.issuedBy && mongoose.Types.ObjectId.isValid(input.issuedBy);
  const issuedByVal = isValidIssuer ? input.issuedBy : undefined;
  const approvedByVal = (input.approvalStatus !== 'pending' && isValidIssuer) ? input.issuedBy : undefined;

  return CertificateIssuance.create({
    certificateId: crypto.randomUUID(),
    serialNumber,
    userId: input.userId,
    courseId: input.courseId,
    recipientName: input.recipientName,
    courseTitle: input.courseTitle,
    issuedAt: input.issuedAt,
    approvalStatus: input.approvalStatus || 'approved',
    approvedAt: input.approvalStatus === 'pending' ? undefined : new Date(),
    approvedBy: approvedByVal,
    issuedBy: issuedByVal,
    cohortId: cohortId || undefined,
    status: 'valid',
    verificationCode
  });
}

async function generateCertificate(req: AuthenticatedRequest, res: Response) {
  try {
    const user = await User.findById(req.user.id);
    const enrollment = await getEnrollment(req.user.id, req.params.courseId);
    if (!user || !enrollment?.completed) {
      return res.status(403).json({ error: 'Certificate is only available for completed courses.' });
    }

    const course = await Course.findById(req.params.courseId);
    if (!course) {
      return res.status(404).json({ error: 'Course not found.' });
    }

    const recipientName = req.user.name || user.name;
    const issuedAt = enrollment.completedAt || enrollment.updatedAt || enrollment.createdAt;
    const existingIssuance = await CertificateIssuance.findOne({ userId: req.user.id, courseId: course._id });
    const issuance = await getOrCreateCertificateIssuance({
      userId: req.user.id,
      courseId: course._id.toString(),
      recipientName,
      courseTitle: course.title,
      issuedAt,
      approvalStatus: course.requiresCertificateApproval === false ? 'approved' : 'pending',
      issuedBy: course.requiresCertificateApproval === false ? course.instructorId : undefined
    });
    if (issuance.revokedAt) {
      return res.status(403).json({ error: 'Certificate has been revoked.' });
    }
    if (issuance.approvalStatus !== 'approved') {
      return res.status(403).json({ error: 'Certificate is pending approval.' });
    }
    const issuedOn = formatIssuedOn(issuedAt);
    const verificationUrl = buildVerificationUrl(req, issuance.certificateId);
    const pdfBytes = await getOrCreateDocumentPdf(
      {
        type: 'certificate',
        userId: req.user.id,
        courseId: course._id.toString(),
        courseUpdatedAt: course.updatedAt,
        enrollmentCompletedAt: enrollment.completedAt,
        recipientName,
        certificateId: issuance.serialNumber || issuance.certificateId,
        verificationUrl
      },
      {
        type: 'certificate',
        recipientName,
      courseTitle: course.title,
      issuedOn,
      certificateId: issuance.serialNumber || issuance.certificateId,
      verificationUrl
      }
    );
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
            courseId: course._id.toString(),
            approvalStatus: issuance.approvalStatus,
            issuedAt: issuance.issuedAt
          }
        }
      });
    }
    await writeAuditLog(req, {
      action: 'certificate.download',
      entityType: 'CertificateIssuance',
      entityId: issuance._id,
      details: {
        result: 'success',
        courseId: course._id.toString(),
        certificateId: issuance.certificateId,
        serialNumber: issuance.serialNumber
      }
    });
    sendPdf(res, pdfBytes, `certificate-${safeFilename(course.title)}.pdf`);
  } catch (error) {
    logger.error({ err: error }, 'Error generating certificate PDF');
    res.status(500).json({ error: 'Failed to generate certificate.' });
  }
}

router.get('/verify/:certificateId', async (req: Request, res: Response) => {
  try {
    const identifier = String(req.params.certificateId);
    const issuance = await CertificateIssuance.findOne({
      $or: [
        { certificateId: identifier },
        { serialNumber: identifier },
        { verificationCode: identifier }
      ]
    }).select('certificateId serialNumber verificationCode recipientName courseTitle issuedAt revokedAt status revocationReason cohortId issuedBy');

    if (!issuance) {
      return res.status(404).json({
        valid: false,
        certificateId: '',
        serialNumber: '',
        verificationCode: '',
        recipientName: '',
        courseTitle: '',
        issuedAt: '',
        revokedAt: null,
        status: 'not_found'
      });
    }

    const isRevoked = issuance.status === 'revoked' || !!issuance.revokedAt;
    const serialNumber = issuance.serialNumber || `EPA-CKEPD-MIGRATED-${issuance.certificateId.slice(0, 8).toUpperCase()}`;
    const verificationCode = issuance.verificationCode || issuance.certificateId.slice(0, 8).toUpperCase();
    const status = isRevoked ? 'revoked' : 'valid';

    const responseData: Record<string, any> = {
      valid: !isRevoked,
      certificateId: issuance.certificateId,
      serialNumber,
      verificationCode,
      recipientName: issuance.recipientName,
      courseTitle: issuance.courseTitle,
      issuedAt: issuance.issuedAt.toISOString(),
      revokedAt: issuance.revokedAt ? issuance.revokedAt.toISOString() : null,
      status
    };

    if (isRevoked) {
      responseData.revocationReason = issuance.revocationReason || '';
    }

    res.json(responseData);
  } catch (error) {
    logger.error({ err: error }, 'Error verifying certificate');
    res.status(500).json({
      valid: false,
      certificateId: '',
      serialNumber: '',
      verificationCode: '',
      recipientName: '',
      courseTitle: '',
      issuedAt: '',
      revokedAt: null,
      status: 'not_found'
    });
  }
});

router.get('/certificates/:courseId/download', auth, generateCertificate);
router.get('/:courseId/download', auth, generateCertificate);

router.get('/diploma', auth, async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { diplomaId } = req.query;
    if (!diplomaId) {
      return res.status(400).json({ error: 'diplomaId is required.' });
    }

    const user = await User.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const diploma = await Course.findById(diplomaId);
    if (!diploma || !diploma.isDiploma) {
      return res.status(400).json({ error: 'Requested course is not a diploma track.' });
    }

    const courses = await Course.find();
    const requiredCourseIds = getRequiredCourseIds(diploma, courses);
    const completedEnrollments = await getCompletedEnrollments(req.user.id);
    const completedCourseIds = completedEnrollments.map((enrollment: any) => enrollment.courseId.toString());
    const missingCourseIds = requiredCourseIds.filter((courseId) => !completedCourseIds.includes(courseId));

    if (requiredCourseIds.length === 0 || missingCourseIds.length > 0) {
      return res.status(403).json({
        error: 'Complete all required courses before downloading this diploma.',
        requiredCourseIds,
        missingCourseIds
      });
    }

    const recipientName = req.user.name || user.name;
    const relevantCompletions = completedEnrollments
      .filter((enrollment: any) => requiredCourseIds.includes(enrollment.courseId.toString()))
      .map((enrollment: any) => enrollment.completedAt || enrollment.updatedAt || enrollment.createdAt)
      .filter(Boolean);
    const issuedAt = relevantCompletions.length > 0
      ? new Date(Math.max(...relevantCompletions.map((date: Date | string) => new Date(date).getTime())))
      : new Date();
    const issuedOn = formatIssuedOn(issuedAt);
    const pdfBytes = await getOrCreateDocumentPdf(
      {
        type: 'diploma',
        userId: req.user.id,
        diplomaId: diploma._id.toString(),
        diplomaUpdatedAt: diploma.updatedAt,
        requiredCourseIds,
        relevantCompletions,
        recipientName
      },
      {
        type: 'diploma',
        recipientName,
        diplomaTitle: diploma.title,
        requiredCourseCount: requiredCourseIds.length,
        issuedOn
      }
    );
    await writeAuditLog(req, { action: 'diploma.download', entityType: 'Course', entityId: diploma._id, details: { diplomaId: diploma._id.toString(), diplomaTitle: diploma.title, requiredCourseCount: requiredCourseIds.length } });
    sendPdf(res, pdfBytes, `diploma-${safeFilename(diploma.title)}.pdf`);
  } catch (error) {
    logger.error({ err: error }, 'Error generating diploma PDF');
    res.status(500).json({ error: 'Failed to generate diploma.' });
  }
});

module.exports = router;

export {};
