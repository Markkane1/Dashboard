const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const ExcelJS = require('exceljs');
const router = express.Router();
const auth = require('../middleware/auth');
const { requirePermission } = require('../middleware/roles');
const { Cohort, CohortMembership, Course, Enrollment, User } = require('../models');
const { PERMISSIONS } = require('../../shared/permissions');
const { writeAuditLog } = require('../services/audit');
const { logger } = require('../logger');
import type { Request, Response } from 'express';

const requireCohortManager = requirePermission(PERMISSIONS.MANAGE_COHORTS);
const rosterUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

function isValidObjectId(id: unknown): id is string {
  return typeof id === 'string' && mongoose.Types.ObjectId.isValid(id);
}

function objectIds(ids: unknown) {
  return Array.isArray(ids) ? [...new Set(ids.map(String).filter(isValidObjectId))] : [];
}

function normalizeEmail(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function parseCsv(text: string) {
  const lines = text.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = line.split(',').map((value) => value.trim().replace(/^"|"$/g, ''));
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    return {
      email: normalizeEmail(row.email || row['learner email'] || row['user email']),
      name: String(row.name || row['learner name'] || '').trim()
    };
  }).filter((row) => row.email || row.name);
}

async function parseRosterBuffer(file?: Express.Multer.File) {
  if (!file) return [];
  if (file.originalname.toLowerCase().endsWith('.csv') || file.mimetype === 'text/csv') {
    return parseCsv(file.buffer.toString('utf8'));
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(file.buffer);
  const worksheet = workbook.worksheets[0];
  if (!worksheet) return [];
  const headers: string[] = [];
  const rows: Array<{ email: string; name: string }> = [];
  worksheet.eachRow((row: any, rowNumber: number) => {
    const values = Array.isArray(row.values) ? row.values.slice(1) : [];
    if (rowNumber === 1) {
      values.forEach((value: unknown, index: number) => {
        headers[index] = String(value || '').trim().toLowerCase();
      });
      return;
    }
    const normalized: Record<string, unknown> = {};
    values.forEach((value: unknown, index: number) => {
      normalized[headers[index] || `column${index}`] = value;
    });
    rows.push({
      email: normalizeEmail(normalized.email || normalized['learner email'] || normalized['user email']),
      name: String(normalized.name || normalized['learner name'] || '').trim()
    });
  });
  return rows.filter((row) => row.email || row.name);
}

async function buildRosterPreview(cohort: any, rows: Array<{ email: string; name?: string }>) {
  const seen = new Set<string>();
  const emails = rows.map((row) => normalizeEmail(row.email)).filter(Boolean);
  const users = await User.find({ email: { $in: emails } }).select('_id name email role');
  const userMap = new Map(users.map((user: any) => [user.email, user]));
  const existing = await CohortMembership.find({ cohortId: cohort._id, userId: { $in: users.map((user: any) => user._id) } });
  const existingUserIds = new Set(existing.map((member: any) => String(member.userId)));
  const activeCount = await CohortMembership.countDocuments({ cohortId: cohort._id, status: 'active' });
  let importableCount = 0;

  const previewRows = rows.map((row, index) => {
    const email = normalizeEmail(row.email);
    const errors: string[] = [];
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.push('Invalid email');
    if (seen.has(email)) errors.push('Duplicate email in file');
    seen.add(email);
    const user: any = userMap.get(email);
    if (!user) errors.push('User not found');
    if (user && existingUserIds.has(String(user._id))) errors.push('Already in cohort');
    if (user && user.role !== 'student') errors.push('Only learner accounts can be imported');
    if (errors.length === 0) importableCount += 1;
    return {
      rowNumber: index + 2,
      email,
      name: row.name || user?.name || '',
      userId: user ? String(user._id) : '',
      status: errors.length === 0 ? 'ready' : 'blocked',
      errors
    };
  });

  const seatLimit = Number(cohort.seatLimit || 0);
  if (seatLimit > 0 && activeCount + importableCount > seatLimit) {
    let remaining = Math.max(seatLimit - activeCount, 0);
    for (const row of previewRows) {
      if (row.status !== 'ready') continue;
      if (remaining > 0) {
        remaining -= 1;
      } else {
        row.status = 'blocked';
        row.errors.push('Cohort seat limit exceeded');
      }
    }
  }

  return {
    cohortId: String(cohort._id),
    totalRows: previewRows.length,
    readyRows: previewRows.filter((row) => row.status === 'ready').length,
    blockedRows: previewRows.filter((row) => row.status !== 'ready').length,
    seatLimit,
    activeCount,
    rows: previewRows
  };
}

async function addMembersToCohort(req: Request, cohort: any, userIds: string[]) {
  const memberships = [];
  for (const userId of userIds) {
    let membership = await CohortMembership.findOne({ cohortId: cohort._id, userId });
    if (membership) {
      membership.status = 'active';
      await membership.save();
    } else {
      membership = await CohortMembership.create({
        cohortId: cohort._id,
        userId,
        status: 'active',
        addedBy: req.user?.id
      });
    }
    memberships.push(membership);
    for (const courseId of cohort.courseIds || []) {
      const existingEnrollment = await Enrollment.findOne({ userId, courseId });
      if (!existingEnrollment) {
        await Enrollment.create({ userId, courseId, completed: false });
      }
    }
  }

  return memberships;
}

function serialize(cohort: any) {
  const plain = typeof cohort.toObject === 'function' ? cohort.toObject() : cohort;
  return {
    id: String(plain._id),
    title: plain.title,
    description: plain.description || '',
    courseIds: (plain.courseIds || []).map(String),
    trainerIds: (plain.trainerIds || []).map(String),
    startsAt: plain.startsAt,
    endsAt: plain.endsAt,
    seatLimit: plain.seatLimit || 0,
    status: plain.status || 'draft'
  };
}

router.get('/', auth, requireCohortManager, async (_req: Request, res: Response) => {
  try {
    const cohorts = await Cohort.find({}).sort({ startsAt: -1, createdAt: -1 });
    res.json(cohorts.map(serialize));
  } catch (error) {
    logger.error({ err: error }, 'Error listing cohorts');
    res.status(500).json({ error: 'Failed to list cohorts.' });
  }
});

router.post('/', auth, requireCohortManager, async (req: Request, res: Response) => {
  try {
    const { title, description, courseIds, trainerIds, startsAt, endsAt, seatLimit, status } = req.body || {};
    if (!String(title || '').trim()) {
      return res.status(400).json({ error: 'title is required.' });
    }
    const normalizedCourseIds = objectIds(courseIds);
    const normalizedTrainerIds = objectIds(trainerIds);
    const [courseCount, trainerCount] = await Promise.all([
      Course.countDocuments({ _id: { $in: normalizedCourseIds } }),
      User.countDocuments({ _id: { $in: normalizedTrainerIds } })
    ]);
    if (courseCount !== normalizedCourseIds.length || trainerCount !== normalizedTrainerIds.length) {
      return res.status(400).json({ error: 'One or more courseIds/trainerIds are invalid.' });
    }

    const cohort = await Cohort.create({
      title,
      description,
      courseIds: normalizedCourseIds,
      trainerIds: normalizedTrainerIds,
      startsAt: startsAt ? new Date(startsAt) : undefined,
      endsAt: endsAt ? new Date(endsAt) : undefined,
      seatLimit: Number(seatLimit || 0),
      status: ['draft', 'active', 'completed', 'archived'].includes(status) ? status : 'draft'
    });
    await writeAuditLog(req, { action: 'cohort.create', entityType: 'Cohort', entityId: cohort._id, details: { courseIds: normalizedCourseIds } });
    res.status(201).json(serialize(cohort));
  } catch (error) {
    logger.error({ err: error }, 'Error creating cohort');
    res.status(500).json({ error: 'Failed to create cohort.' });
  }
});

router.patch('/:id', auth, requireCohortManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid cohort id.' });
    const updates: Record<string, unknown> = {};
    for (const key of ['title', 'description', 'status', 'seatLimit']) {
      if (Object.prototype.hasOwnProperty.call(req.body || {}, key)) updates[key] = req.body[key];
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'courseIds')) updates.courseIds = objectIds(req.body.courseIds);
    if (Object.prototype.hasOwnProperty.call(req.body || {}, 'trainerIds')) updates.trainerIds = objectIds(req.body.trainerIds);
    if (req.body?.startsAt) updates.startsAt = new Date(req.body.startsAt);
    if (req.body?.endsAt) updates.endsAt = new Date(req.body.endsAt);
    const cohort = await Cohort.findByIdAndUpdate(req.params.id, { $set: updates }, { new: true, runValidators: true });
    if (!cohort) return res.status(404).json({ error: 'Cohort not found.' });
    await writeAuditLog(req, { action: 'cohort.update', entityType: 'Cohort', entityId: cohort._id, details: updates });
    res.json(serialize(cohort));
  } catch (error) {
    logger.error({ err: error }, 'Error updating cohort');
    res.status(500).json({ error: 'Failed to update cohort.' });
  }
});

router.get('/:id/members', auth, requireCohortManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid cohort id.' });
    const members = await CohortMembership.find({ cohortId: req.params.id }).populate('userId', 'name email role');
    res.json(members.map((member: any) => ({
      id: String(member._id),
      cohortId: String(member.cohortId),
      userId: String(member.userId?._id || member.userId),
      name: member.userId?.name,
      email: member.userId?.email,
      status: member.status
    })));
  } catch (error) {
    logger.error({ err: error }, 'Error listing cohort members');
    res.status(500).json({ error: 'Failed to list cohort members.' });
  }
});

router.post('/:id/members', auth, requireCohortManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid cohort id.' });
    const userIds = objectIds(req.body?.userIds || [req.body?.userId]);
    if (userIds.length === 0) return res.status(400).json({ error: 'At least one userId is required.' });
    const cohort = await Cohort.findById(req.params.id);
    if (!cohort) return res.status(404).json({ error: 'Cohort not found.' });
    if (cohort.seatLimit > 0) {
      const activeCount = await CohortMembership.countDocuments({ cohortId: cohort._id, status: 'active' });
      if (activeCount + userIds.length > cohort.seatLimit) return res.status(400).json({ error: 'Cohort seat limit exceeded.' });
    }

    const memberships = await addMembersToCohort(req, cohort, userIds);
    await writeAuditLog(req, { action: 'cohort.members.add', entityType: 'Cohort', entityId: cohort._id, details: { userIds, courseIds: cohort.courseIds?.map(String) || [] } });
    res.status(201).json(memberships.map((member: any) => ({ id: String(member._id), userId: String(member.userId), status: member.status })));
  } catch (error) {
    logger.error({ err: error }, 'Error adding cohort members');
    res.status(500).json({ error: 'Failed to add cohort members.' });
  }
});

router.post('/:id/members/import/preview', auth, requireCohortManager, rosterUpload.single('file'), async (req: Request & { file?: Express.Multer.File }, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid cohort id.' });
    const cohort = await Cohort.findById(req.params.id);
    if (!cohort) return res.status(404).json({ error: 'Cohort not found.' });
    const rows = await parseRosterBuffer(req.file);
    if (rows.length === 0) return res.status(400).json({ error: 'Roster file must include an email column.' });
    const preview = await buildRosterPreview(cohort, rows);
    await writeAuditLog(req, { action: 'cohort.roster.preview', entityType: 'Cohort', entityId: cohort._id, details: { totalRows: preview.totalRows, readyRows: preview.readyRows } });
    res.json(preview);
  } catch (error) {
    logger.error({ err: error }, 'Error previewing cohort roster import');
    res.status(500).json({ error: 'Failed to preview cohort roster import.' });
  }
});

router.post('/:id/members/import/confirm', auth, requireCohortManager, async (req: Request, res: Response) => {
  try {
    if (!isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid cohort id.' });
    const cohort = await Cohort.findById(req.params.id);
    if (!cohort) return res.status(404).json({ error: 'Cohort not found.' });
    const rows = Array.isArray(req.body?.rows) ? req.body.rows : [];
    const explicitUserIds = [
      ...objectIds(req.body?.userIds),
      ...rows.map((row: any) => String(row.userId || '')).filter(isValidObjectId)
    ];
    const emails = rows.map((row: any) => normalizeEmail(row.email)).filter(Boolean);
    const users = await User.find({
      $or: [
        emails.length > 0 ? { email: { $in: emails } } : { _id: { $exists: false } },
        explicitUserIds.length > 0 ? { _id: { $in: explicitUserIds } } : { _id: { $exists: false } }
      ]
    }).select('_id email role');
    const userIds = [
      ...new Set([
        ...explicitUserIds,
        ...users.filter((user: any) => user.role === 'student').map((user: any) => String(user._id))
      ])
    ];
    if (userIds.length === 0) return res.status(400).json({ error: 'No importable learners supplied.' });

    const preview = await buildRosterPreview(
      cohort,
      users.map((user: any) => ({ email: user.email }))
    );
    const readyIds = new Set(preview.rows.filter((row) => row.status === 'ready').map((row) => row.userId));
    const confirmedUserIds = userIds.filter((userId) => readyIds.has(userId));
    if (confirmedUserIds.length === 0) return res.status(400).json({ error: 'No learners are ready to import.' });

    const memberships = await addMembersToCohort(req, cohort, confirmedUserIds);
    await writeAuditLog(req, { action: 'cohort.roster.import', entityType: 'Cohort', entityId: cohort._id, details: { userIds: confirmedUserIds, courseIds: cohort.courseIds?.map(String) || [] } });
    res.status(201).json({
      importedCount: memberships.length,
      memberships: memberships.map((member: any) => ({ id: String(member._id), userId: String(member.userId), status: member.status }))
    });
  } catch (error) {
    logger.error({ err: error }, 'Error confirming cohort roster import');
    res.status(500).json({ error: 'Failed to confirm cohort roster import.' });
  }
});

module.exports = router;

export {};
