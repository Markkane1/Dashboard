const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const auth = require('../middleware/auth');
const { CertificateIssuance, Course, User } = require('../models');
const { getCompletedEnrollments, getEnrollment } = require('../services/enrollments');
const { formatIssuedOn, getOrCreateDocumentPdf } = require('../services/documentPdf');
const { logger } = require('../logger');
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
}) {
  return CertificateIssuance.findOneAndUpdate(
    { userId: input.userId, courseId: input.courseId },
    {
      $setOnInsert: {
        certificateId: crypto.randomUUID(),
        userId: input.userId,
        courseId: input.courseId,
        recipientName: input.recipientName,
        courseTitle: input.courseTitle,
        issuedAt: input.issuedAt
      }
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true
    }
  );
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
    const issuance = await getOrCreateCertificateIssuance({
      userId: req.user.id,
      courseId: course._id.toString(),
      recipientName,
      courseTitle: course.title,
      issuedAt
    });
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
        certificateId: issuance.certificateId,
        verificationUrl
      },
      {
        type: 'certificate',
        recipientName,
        courseTitle: course.title,
        issuedOn,
        certificateId: issuance.certificateId,
        verificationUrl
      }
    );
    sendPdf(res, pdfBytes, `certificate-${safeFilename(course.title)}.pdf`);
  } catch (error) {
    logger.error({ err: error }, 'Error generating certificate PDF');
    res.status(500).json({ error: 'Failed to generate certificate.' });
  }
}

router.get('/verify/:certificateId', async (req: Request, res: Response) => {
  try {
    const issuance = await CertificateIssuance.findOne({
      certificateId: String(req.params.certificateId)
    }).select('certificateId recipientName courseTitle issuedAt revokedAt courseId userId');

    if (!issuance) {
      return res.status(404).json({ valid: false, error: 'Certificate not found.' });
    }

    res.json({
      valid: !issuance.revokedAt,
      certificateId: issuance.certificateId,
      recipientName: issuance.recipientName,
      courseTitle: issuance.courseTitle,
      issuedAt: issuance.issuedAt,
      revokedAt: issuance.revokedAt || null,
      courseId: issuance.courseId.toString(),
      userId: issuance.userId.toString()
    });
  } catch (error) {
    logger.error({ err: error }, 'Error verifying certificate');
    res.status(500).json({ valid: false, error: 'Failed to verify certificate.' });
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
    sendPdf(res, pdfBytes, `diploma-${safeFilename(diploma.title)}.pdf`);
  } catch (error) {
    logger.error({ err: error }, 'Error generating diploma PDF');
    res.status(500).json({ error: 'Failed to generate diploma.' });
  }
});

module.exports = router;

export {};
