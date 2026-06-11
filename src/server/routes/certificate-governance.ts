const express = require('express');
const mongoose = require('mongoose');
const router = express.Router();
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/roles');
const { CertificateApproval, CertificateIssuance } = require('../models');
const { PERMISSIONS } = require('../../shared/permissions');
const { writeAuditLog } = require('../services/audit');
const { logger } = require('../logger');
import type { Request, Response } from 'express';

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

function serializeIssuance(issuance: any) {
  const plain = typeof issuance.toObject === 'function' ? issuance.toObject() : issuance;
  return {
    id: String(plain._id),
    certificateId: plain.certificateId,
    serialNumber: plain.serialNumber || '',
    userId: String(plain.userId?._id || plain.userId || ''),
    learnerName: plain.userId?.name || plain.recipientName || '',
    learnerEmail: plain.userId?.email || '',
    courseId: String(plain.courseId?._id || plain.courseId || ''),
    courseTitle: plain.courseId?.title || plain.courseTitle || '',
    approvalStatus: plain.approvalStatus || 'pending',
    approvalComments: plain.approvalComments || '',
    issuedAt: plain.issuedAt,
    approvedAt: plain.approvedAt,
    revokedAt: plain.revokedAt,
    revocationReason: plain.revocationReason || ''
  };
}

router.get('/approvals', auth, requirePermission(PERMISSIONS.APPROVE_CERTIFICATES), async (req: Request, res: Response) => {
  try {
    const status = typeof req.query.status === 'string' && req.query.status ? req.query.status : 'pending';
    const filter: Record<string, unknown> = {};
    if (['pending', 'approved', 'rejected'].includes(status)) filter.approvalStatus = status;
    const issuances = await CertificateIssuance.find(filter)
      .populate('userId', 'name email')
      .populate('courseId', 'title')
      .sort({ issuedAt: -1 })
      .limit(200);
    res.json(issuances.map(serializeIssuance));
  } catch (error) {
    logger.error({ err: error }, 'Error listing certificate approval queue');
    res.status(500).json({ error: 'Failed to list certificate approval queue.' });
  }
});

router.get('/revocations', auth, requirePermission(PERMISSIONS.REVOKE_CERTIFICATES), async (_req: Request, res: Response) => {
  try {
    const issuances = await CertificateIssuance.find({ revokedAt: { $exists: true } })
      .populate('userId', 'name email')
      .populate('courseId', 'title')
      .sort({ revokedAt: -1 })
      .limit(200);
    res.json(issuances.map(serializeIssuance));
  } catch (error) {
    logger.error({ err: error }, 'Error listing certificate revocations');
    res.status(500).json({ error: 'Failed to list certificate revocations.' });
  }
});

router.post('/:courseId/approval', auth, requirePermission(PERMISSIONS.APPROVE_CERTIFICATES), async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.courseId)) return res.status(400).json({ error: 'Invalid course id.' });
    const { userId, status, comments } = req.body || {};
    if (!isValidObjectId(userId) || !['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'userId and status approved/rejected are required.' });
    }
    const issuance = await CertificateIssuance.findOne({ userId, courseId: req.params.courseId });
    if (!issuance) return res.status(404).json({ error: 'Certificate issuance not found.' });

    const oldValue = {
      approvalStatus: issuance.approvalStatus,
      approvedBy: issuance.approvedBy,
      approvedAt: issuance.approvedAt,
      approvalComments: issuance.approvalComments || '',
      status: issuance.status || 'valid',
      issuedBy: issuance.issuedBy
    };
    issuance.approvalStatus = status;
    issuance.approvedBy = status === 'approved' ? req.user?.id : undefined;
    issuance.approvedAt = status === 'approved' ? new Date() : undefined;
    issuance.approvalComments = String(comments || '');
    if (status === 'approved') {
      issuance.issuedBy = req.user?.id;
      issuance.status = 'valid';
      if (!issuance.verificationCode) {
        const crypto = require('crypto');
        issuance.verificationCode = crypto.randomBytes(8).toString('hex').toUpperCase();
      }
    }
    await issuance.save();
    let approval = await CertificateApproval.findOne({ certificateIssuanceId: issuance._id });
    if (approval) {
      approval.userId = userId;
      approval.courseId = req.params.courseId;
      approval.status = status;
      approval.reviewedBy = req.user?.id;
      approval.reviewedAt = new Date();
      approval.comments = String(comments || '');
      await approval.save();
    } else {
      approval = await CertificateApproval.create({
        certificateIssuanceId: issuance._id,
        userId,
        courseId: req.params.courseId,
        status,
        reviewedBy: req.user?.id,
        reviewedAt: new Date(),
        comments: String(comments || '')
      });
    }
    await writeAuditLog(req, {
      action: `certificate.${status}`,
      entityType: 'CertificateIssuance',
      entityId: issuance._id,
      details: {
        result: 'success',
        userId,
        courseId: req.params.courseId,
        oldValue,
        newValue: {
          approvalStatus: issuance.approvalStatus,
          approvedBy: issuance.approvedBy,
          approvedAt: issuance.approvedAt,
          approvalComments: issuance.approvalComments || '',
          status: issuance.status,
          issuedBy: issuance.issuedBy
        }
      }
    });
    res.json({ issuance, approval });
  } catch (error) {
    logger.error({ err: error }, 'Error reviewing certificate approval');
    res.status(500).json({ error: 'Failed to review certificate approval.' });
  }
});

router.post('/:certificateId/revoke', auth, requirePermission(PERMISSIONS.REVOKE_CERTIFICATES), async (req: Request, res: Response) => {
  try {
    const reason = String(req.body?.reason || '').trim();
    if (!reason) return res.status(400).json({ error: 'Revocation reason is required.' });
    const issuance = await CertificateIssuance.findOne({ certificateId: req.params.certificateId });
    if (!issuance) return res.status(404).json({ error: 'Certificate not found.' });
    const oldValue = {
      revokedAt: issuance.revokedAt,
      revokedBy: issuance.revokedBy,
      revocationReason: issuance.revocationReason || '',
      status: issuance.status || 'valid'
    };
    issuance.revokedAt = new Date();
    issuance.revokedBy = req.user?.id;
    issuance.revocationReason = reason;
    issuance.status = 'revoked';
    await issuance.save();
    await writeAuditLog(req, {
      action: 'certificate.revoke',
      entityType: 'CertificateIssuance',
      entityId: issuance._id,
      details: {
        result: 'success',
        certificateId: req.params.certificateId,
        oldValue,
        newValue: {
          revokedAt: issuance.revokedAt,
          revokedBy: issuance.revokedBy,
          revocationReason: issuance.revocationReason,
          status: issuance.status
        }
      }
    });
    res.json(issuance);
  } catch (error) {
    logger.error({ err: error }, 'Error revoking certificate');
    res.status(500).json({ error: 'Failed to revoke certificate.' });
  }
});

module.exports = router;

export {};
