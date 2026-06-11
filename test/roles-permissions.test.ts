const assert = require('node:assert/strict');
const { after, before, describe, it } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { execSync } = require('child_process');
const ffmpeg = require('fluent-ffmpeg');
try {
  const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg');
  const ffprobeInstaller = require('@ffprobe-installer/ffprobe');
  ffmpeg.setFfmpegPath(ffmpegInstaller.path);
  ffmpeg.setFfprobePath(ffprobeInstaller.path);
} catch (e) {}

Object.assign(process.env, {
  NODE_ENV: 'test',
  AUTH_SECRET: process.env.AUTH_SECRET || 'test-auth-secret-value-with-32-characters',
  MONGOMS_DOWNLOAD_DIR: path.join(__dirname, '.mongodb-binaries'),
  LOG_LEVEL: 'silent'
});

const { MongoMemoryServer } = require('mongodb-memory-server');
const app = require('../src/server/server');
const User = require('../src/server/models/User');
const Role = require('../src/server/models/Role');
const Course = require('../src/server/models/Course');
const Assignment = require('../src/server/models/Assignment');
const AssignmentSubmission = require('../src/server/models/AssignmentSubmission');
const AuditLog = require('../src/server/models/AuditLog');
const CertificateIssuance = require('../src/server/models/CertificateIssuance');
const Enrollment = require('../src/server/models/Enrollment');
const Cohort = require('../src/server/models/Cohort');
const CohortMembership = require('../src/server/models/CohortMembership');
const Lesson = require('../src/server/models/Lesson');
const Progress = require('../src/server/models/Progress');
const QuizSubmission = require('../src/server/models/QuizSubmission');
const { PERMISSIONS, USER_ROLES } = require('../src/shared/permissions');

let mongoServer: typeof MongoMemoryServer.prototype;
let server: ReturnType<typeof app.listen>;
let baseUrl: string;

before(async () => {
  const testMongoUri = process.env.TEST_MONGODB_URI
    ? withDatabaseName(process.env.TEST_MONGODB_URI, 'roles_permissions')
    : '';
  if (testMongoUri) {
    await mongoose.connect(testMongoUri);
  } else {
    const systemBinary = getSystemMongoBinary();
    if (!systemBinary) {
      throw new Error('TEST_MONGODB_URI is required when no local MongoDB system binary is available.');
    }
    mongoServer = await MongoMemoryServer.create({
      binary: {
        systemBinary
      }
    });
    await mongoose.connect(mongoServer.getUri());
  }
  await Role.ensureDefaultRoles();

  server = app.listen(0, '127.0.0.1');
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
  process.env.API_URL = baseUrl;
  process.env.API_BASE_URL = baseUrl;
});

after(async () => {
  await new Promise<void>((resolve, reject) => {
    server.close((error?: Error) => error ? reject(error) : resolve());
  });
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('role and permission administration', () => {
  it('prevents learners from viewing audit logs and exporting compliance reports', async () => {
    const learner = await User.create({
      name: 'Compliance Learner',
      email: 'compliance-learner@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const headers = authHeaderFor(learner, []);

    const auditResponse = await fetch(`${baseUrl}/api/audit-logs`, { headers });
    const reportResponse = await fetch(`${baseUrl}/api/reports/completion/export`, { headers });

    assert.equal(auditResponse.status, 403);
    assert.equal(reportResponse.status, 403);
  });

  it('adds cohort members and creates course enrollments for cohort courses', async () => {
    const admin = await User.create({
      name: 'Cohort Admin',
      email: 'cohort-admin@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.ADMIN,
      roles: [USER_ROLES.ADMIN],
      permissions: []
    });
    const learner = await User.create({
      name: 'Cohort Learner',
      email: 'cohort-learner@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const course = await Course.create({
      title: 'Cohort Course',
      description: 'Course used to verify cohort enrollment.',
      price: 0,
      category: 'policy',
      lessonsCount: 1,
      publishStatus: 'published',
      approvalStatus: 'approved'
    });
    const cohort = await Cohort.create({
      title: 'EPA Cohort',
      courseIds: [course._id],
      status: 'active'
    });

    const response = await fetch(`${baseUrl}/api/cohorts/${cohort._id.toString()}/members`, {
      method: 'POST',
      headers: {
        ...authHeaderFor(admin),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ userIds: [learner._id.toString()] })
    });

    assert.equal(response.status, 201);
    assert.ok(await CohortMembership.findOne({ cohortId: cohort._id, userId: learner._id, status: 'active' }));
    assert.ok(await Enrollment.findOne({ userId: learner._id, courseId: course._id }));
  });

  it('previews and confirms cohort roster imports from CSV', async () => {
    const admin = await User.create({
      name: 'Roster Admin',
      email: 'roster-admin@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.ADMIN,
      roles: [USER_ROLES.ADMIN],
      permissions: []
    });
    const learner = await User.create({
      name: 'Roster Learner',
      email: 'roster-learner@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const course = await Course.create({
      title: 'Roster Import Course',
      description: 'Course used for roster import.',
      price: 0,
      category: 'policy',
      lessonsCount: 1,
      publishStatus: 'published',
      approvalStatus: 'approved'
    });
    const cohort = await Cohort.create({
      title: 'Roster Import Cohort',
      courseIds: [course._id],
      status: 'active',
      seatLimit: 2
    });
    const form = new FormData();
    form.set('file', new Blob([`email,name\n${learner.email},${learner.name}\nmissing@example.test,Missing User`], { type: 'text/csv' }), 'roster.csv');

    const previewResponse = await fetch(`${baseUrl}/api/cohorts/${cohort._id.toString()}/members/import/preview`, {
      method: 'POST',
      headers: authHeaderFor(admin),
      body: form
    });
    assert.equal(previewResponse.status, 200);
    const preview = await previewResponse.json();
    assert.equal(preview.readyRows, 1);
    assert.equal(preview.blockedRows, 1);

    const confirmResponse = await fetch(`${baseUrl}/api/cohorts/${cohort._id.toString()}/members/import/confirm`, {
      method: 'POST',
      headers: {
        ...authHeaderFor(admin),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ rows: preview.rows.filter((row: any) => row.status === 'ready') })
    });
    assert.equal(confirmResponse.status, 201);
    assert.ok(await CohortMembership.findOne({ cohortId: cohort._id, userId: learner._id, status: 'active' }));
    assert.ok(await Enrollment.findOne({ courseId: course._id, userId: learner._id }));
  });

  it('allows enrolled learners to submit assignments and trainers to review them', async () => {
    const trainer = await User.create({
      name: 'Assignment Trainer',
      email: 'assignment-trainer@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.INSTRUCTOR,
      roles: [USER_ROLES.INSTRUCTOR],
      permissions: []
    });
    const unrelatedTrainer = await User.create({
      name: 'Unrelated Assignment Trainer',
      email: 'unrelated-assignment-trainer@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.INSTRUCTOR,
      roles: [USER_ROLES.INSTRUCTOR],
      permissions: []
    });
    const learner = await User.create({
      name: 'Assignment Learner',
      email: 'assignment-learner@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const course = await Course.create({
      title: 'Assignment Review Course',
      description: 'Course used for assignment review.',
      price: 0,
      category: 'policy',
      lessonsCount: 1,
      trainerIds: [trainer._id],
      publishStatus: 'published',
      approvalStatus: 'approved'
    });
    await Enrollment.create({ userId: learner._id, courseId: course._id, completed: false });
    const assignment = await Assignment.create({
      courseId: course._id,
      title: 'Evidence upload',
      instructions: 'Submit evidence.',
      status: 'published'
    });
    const form = new FormData();
    form.set('text', 'My compliance evidence');
    form.set('linkUrl', 'https://example.test/evidence');
    form.set('file', new Blob(['evidence file'], { type: 'text/plain' }), 'evidence.txt');

    const submitResponse = await fetch(`${baseUrl}/api/assignments/${assignment._id.toString()}/submissions`, {
      method: 'POST',
      headers: authHeaderFor(learner, []),
      body: form
    });
    assert.equal(submitResponse.status, 201);
    const submitted = await submitResponse.json();
    assert.equal(submitted.status, 'submitted');
    assert.equal(submitted.fileName, 'evidence.txt');

    const blockedReviewResponse = await fetch(`${baseUrl}/api/assignments/submissions/${submitted.id}/review`, {
      method: 'PATCH',
      headers: {
        ...authHeaderFor(unrelatedTrainer, []),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'approved', comments: 'Should not work.' })
    });
    assert.equal(blockedReviewResponse.status, 403);

    const fileResponse = await fetch(`${baseUrl}/api/assignments/submissions/${submitted.id}/file`, {
      headers: authHeaderFor(learner, [])
    });
    assert.equal(fileResponse.status, 200);
    assert.equal(await fileResponse.text(), 'evidence file');

    const reviewResponse = await fetch(`${baseUrl}/api/assignments/submissions/${submitted.id}/review`, {
      method: 'PATCH',
      headers: {
        ...authHeaderFor(trainer, []),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ status: 'approved', comments: 'Meets requirements.' })
    });
    assert.equal(reviewResponse.status, 200);
    const reviewed = await reviewResponse.json();
    assert.equal(reviewed.status, 'approved');
    assert.equal(reviewed.reviewComments, 'Meets requirements.');
    assert.ok(await AssignmentSubmission.findOne({ _id: submitted.id, status: 'approved' }));
  });

  it('lists approval queues for approvers and exports XLSX reports with filters', async () => {
    const admin = await User.create({
      name: 'Queue Admin',
      email: 'queue-admin@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.ADMIN,
      roles: [USER_ROLES.ADMIN],
      permissions: []
    });
    const learner = await User.create({
      name: 'Queue Learner',
      email: 'queue-learner@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const course = await Course.create({
      title: 'Pending Queue Course',
      description: 'Course used for queue tests.',
      price: 0,
      category: 'policy',
      lessonsCount: 1,
      publishStatus: 'pending',
      approvalStatus: 'pending'
    });
    await CertificateIssuance.create({
      certificateId: 'queue-certificate-id',
      serialNumber: 'EPA-PB-2026-0001-0001',
      userId: learner._id,
      courseId: course._id,
      recipientName: learner.name,
      courseTitle: course.title,
      issuedAt: new Date(),
      approvalStatus: 'pending'
    });
    await AuditLog.create({ action: 'queue.test', entityType: 'Course', entityId: course._id.toString(), actorEmail: admin.email });

    const courseQueue = await fetch(`${baseUrl}/api/courses/approvals?status=pending`, { headers: authHeaderFor(admin) });
    const certificateQueue = await fetch(`${baseUrl}/api/certificates/approvals?status=pending`, { headers: authHeaderFor(admin) });
    const xlsxReport = await fetch(`${baseUrl}/api/reports/certificates/export?format=xlsx&approvalStatus=pending`, { headers: authHeaderFor(admin) });
    const learnerQueue = await fetch(`${baseUrl}/api/courses/approvals?status=pending`, { headers: authHeaderFor(learner, []) });

    assert.equal(courseQueue.status, 200);
    assert.equal(certificateQueue.status, 200);
    assert.equal(xlsxReport.status, 200);
    assert.equal(xlsxReport.headers.get('content-type'), 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    assert.equal(learnerQueue.status, 403);
    assert.ok((await courseQueue.json()).some((item: any) => item.id === course._id.toString()));
    assert.ok((await certificateQueue.json()).some((item: any) => item.certificateId === 'queue-certificate-id'));
  });

  it('blocks enrollment into draft courses and courses with missing prerequisites', async () => {
    const learner = await User.create({
      name: 'Prerequisite Learner',
      email: 'prerequisite-learner@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const prerequisite = await Course.create({
      title: 'Prerequisite Course',
      description: 'Must be completed first.',
      price: 0,
      category: 'policy',
      lessonsCount: 1,
      publishStatus: 'published',
      approvalStatus: 'approved'
    });
    const gated = await Course.create({
      title: 'Gated Course',
      description: 'Requires prerequisite.',
      price: 0,
      category: 'policy',
      lessonsCount: 1,
      prerequisiteCourseIds: [prerequisite._id],
      publishStatus: 'published',
      approvalStatus: 'approved'
    });
    const draft = await Course.create({
      title: 'Draft Course',
      description: 'Not available.',
      price: 0,
      category: 'policy',
      lessonsCount: 1,
      publishStatus: 'draft',
      approvalStatus: 'draft'
    });
    const headers = { ...authHeaderFor(learner, []), 'Content-Type': 'application/json' };

    const draftResponse = await fetch(`${baseUrl}/api/users/enroll`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ courseId: draft._id.toString() })
    });
    const prerequisiteResponse = await fetch(`${baseUrl}/api/users/enroll`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ courseId: gated._id.toString() })
    });

    assert.equal(draftResponse.status, 403);
    assert.equal(prerequisiteResponse.status, 403);
  });

  it('rejects learner attempts to manually complete a course', async () => {
    const learner = await User.create({
      name: 'Completion Learner',
      email: 'completion-learner@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const course = await Course.create({
      title: 'Manual Completion Guard',
      description: 'Course used to verify learners cannot force completion.',
      price: 0,
      category: 'policy',
      lessonsCount: 1
    });
    await Enrollment.create({
      userId: learner._id,
      courseId: course._id,
      completed: false
    });

    const response = await fetch(`${baseUrl}/api/users/complete`, {
      method: 'POST',
      headers: {
        ...authHeaderFor(learner, []),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ courseId: course._id.toString() })
    });

    assert.equal(response.status, 403);
    const enrollment = await Enrollment.findOne({ userId: learner._id, courseId: course._id });
    assert.equal(enrollment?.completed, false);
    assert.equal(enrollment?.completedAt, undefined);
  });

  it('admin fails to manually complete a course if target learner has no existing enrollment', async () => {
    const admin = await User.create({
      name: 'Completion Admin 1',
      email: 'completion-admin-1@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.ADMIN,
      roles: [USER_ROLES.ADMIN],
      permissions: [PERMISSIONS.MANAGE_USERS]
    });
    const learner = await User.create({
      name: 'No Enroll Learner',
      email: 'no-enroll-learner@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const course = await Course.create({
      title: 'No Enroll Course',
      description: 'Test course.',
      price: 0,
      category: 'policy',
      lessonsCount: 1,
      publishStatus: 'published',
      approvalStatus: 'approved'
    });

    const response = await fetch(`${baseUrl}/api/users/complete`, {
      method: 'POST',
      headers: {
        ...authHeaderFor(admin),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        courseId: course._id.toString(),
        userId: learner._id.toString()
      })
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /Enrollment is required/i);
  });

  it('admin fails to manually complete a course if completion rules (lessons completed) are not met', async () => {
    const admin = await User.create({
      name: 'Completion Admin 2',
      email: 'completion-admin-2@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.ADMIN,
      roles: [USER_ROLES.ADMIN],
      permissions: [PERMISSIONS.MANAGE_USERS]
    });
    const learner = await User.create({
      name: 'Incomplete Lessons Learner',
      email: 'incomplete-lessons-learner@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const course = await Course.create({
      title: 'Incomplete Lessons Course',
      description: 'Test course.',
      price: 0,
      category: 'policy',
      lessonsCount: 1,
      publishStatus: 'published',
      approvalStatus: 'approved'
    });
    await Lesson.create({
      courseId: course._id,
      title: 'Lesson 1',
      order: 1,
      isPublished: true
    });
    await Enrollment.create({
      userId: learner._id,
      courseId: course._id,
      completed: false
    });

    const response = await fetch(`${baseUrl}/api/users/complete`, {
      method: 'POST',
      headers: {
        ...authHeaderFor(admin),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        courseId: course._id.toString(),
        userId: learner._id.toString()
      })
    });

    assert.equal(response.status, 400);
    const body = await response.json();
    assert.match(body.error, /lessons/i);
  });

  it('admin fails to manually complete unpublished courses and courses with unpassed required quizzes', async () => {
    const admin = await User.create({
      name: 'Completion Admin 4',
      email: 'completion-admin-4@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.ADMIN,
      roles: [USER_ROLES.ADMIN],
      permissions: [PERMISSIONS.MANAGE_USERS]
    });
    const learner = await User.create({
      name: 'Quiz Required Learner',
      email: 'quiz-required-learner@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const draftCourse = await Course.create({
      title: 'Draft Completion Block',
      description: 'Should not complete.',
      price: 0,
      category: 'policy',
      lessonsCount: 0,
      publishStatus: 'draft',
      approvalStatus: 'draft'
    });
    const quizCourse = await Course.create({
      title: 'Quiz Completion Block',
      description: 'Should require quiz.',
      price: 0,
      category: 'policy',
      lessonsCount: 0,
      publishStatus: 'published',
      approvalStatus: 'approved',
      quizQuestions: [{
        id: 'q1',
        prompt: 'Required?',
        options: ['Yes', 'No'],
        correctAnswerIndex: 0
      }]
    });
    await Enrollment.create({ userId: learner._id, courseId: draftCourse._id, completed: false });
    await Enrollment.create({ userId: learner._id, courseId: quizCourse._id, completed: false });

    const headers = {
      ...authHeaderFor(admin),
      'Content-Type': 'application/json'
    };
    const draftResponse = await fetch(`${baseUrl}/api/users/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ courseId: draftCourse._id.toString(), userId: learner._id.toString() })
    });
    const quizResponse = await fetch(`${baseUrl}/api/users/complete`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ courseId: quizCourse._id.toString(), userId: learner._id.toString() })
    });

    assert.equal(draftResponse.status, 400);
    assert.match((await draftResponse.json()).error, /published|active/i);
    assert.equal(quizResponse.status, 400);
    assert.match((await quizResponse.json()).error, /quiz/i);
    assert.equal((await Enrollment.findOne({ userId: learner._id, courseId: draftCourse._id }))?.completed, false);
    assert.equal((await Enrollment.findOne({ userId: learner._id, courseId: quizCourse._id }))?.completed, false);
  });

  it('admin successfully completes a course manually if all completion rules are met', async () => {
    const admin = await User.create({
      name: 'Completion Admin 3',
      email: 'completion-admin-3@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.ADMIN,
      roles: [USER_ROLES.ADMIN],
      permissions: [PERMISSIONS.MANAGE_USERS]
    });
    const learner = await User.create({
      name: 'Completed Rules Learner',
      email: 'completed-rules-learner@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const course = await Course.create({
      title: 'Completed Rules Course',
      description: 'Test course.',
      price: 0,
      category: 'policy',
      lessonsCount: 1,
      publishStatus: 'published',
      approvalStatus: 'approved',
      quizQuestions: [{
        id: 'q1',
        prompt: 'Is this a test?',
        options: ['Yes', 'No'],
        correctAnswerIndex: 0
      }]
    });
    const lesson = await Lesson.create({
      courseId: course._id,
      title: 'Lesson 1',
      order: 1,
      isPublished: true
    });
    await Progress.create({
      userId: learner._id,
      courseId: course._id,
      lessonId: lesson._id,
      completed: true,
      watchedSeconds: 10,
      duration: 10,
      lastWatchedAt: new Date()
    });
    await QuizSubmission.create({
      userId: learner._id,
      courseId: course._id,
      passed: true,
      score: 100,
      totalQuestions: 1,
      attemptNumber: 1,
      status: 'passed',
      answers: [{ questionId: 'q1', selectedOptionIndex: 0 }]
    });
    const enrollment = await Enrollment.create({
      userId: learner._id,
      courseId: course._id,
      completed: false
    });

    const response = await fetch(`${baseUrl}/api/users/complete`, {
      method: 'POST',
      headers: {
        ...authHeaderFor(admin),
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        courseId: course._id.toString(),
        userId: learner._id.toString()
      })
    });

    assert.equal(response.status, 200);
    const updatedEnrollment = await Enrollment.findOne({ userId: learner._id, courseId: course._id });
    assert.equal(updatedEnrollment?.completed, true);
    assert.ok(updatedEnrollment?.completedAt);

    // Verify audit log has the correct metadata indicating it was manually/admin completed
    const audit = await AuditLog.findOne({
      action: 'enrollment.manual-complete',
      entityId: enrollment._id.toString()
    });
    assert.ok(audit);
    assert.equal(audit.details.forcedBy, admin._id.toString());
  });

  it('creates dynamic roles and assigns multiple roles plus direct permissions to a user', async () => {
    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.ADMIN,
      roles: [USER_ROLES.ADMIN],
      permissions: []
    });
    const learner = await User.create({
      name: 'Learner User',
      email: 'learner@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const authHeader = authHeaderFor(admin);

    const catalogResponse = await fetch(`${baseUrl}/api/roles/permissions`, { headers: authHeader });
    assert.equal(catalogResponse.status, 200);
    const catalog = await catalogResponse.json();
    assert.ok(catalog.some((item: { id: string }) => item.id === PERMISSIONS.MANAGE_CONTENT));

    const createRoleResponse = await fetch(`${baseUrl}/api/roles`, {
      method: 'POST',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        key: 'content-reviewer',
        name: 'Content Reviewer',
        description: 'Reviews course content.',
        permissions: [PERMISSIONS.ACCESS_INSTRUCTOR, PERMISSIONS.MANAGE_CONTENT],
        active: true
      })
    });
    assert.equal(createRoleResponse.status, 201);
    const createdRole = await createRoleResponse.json();
    assert.equal(createdRole.key, 'content-reviewer');

    const updateRoleResponse = await fetch(`${baseUrl}/api/roles/${createdRole.id}`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        permissions: [
          PERMISSIONS.ACCESS_INSTRUCTOR,
          PERMISSIONS.MANAGE_CONTENT,
          PERMISSIONS.VIEW_ANALYTICS
        ]
      })
    });
    assert.equal(updateRoleResponse.status, 200);

    const assignResponse = await fetch(`${baseUrl}/api/users/${learner._id.toString()}/role`, {
      method: 'PATCH',
      headers: { ...authHeader, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roles: [USER_ROLES.STUDENT, 'content-reviewer'],
        permissions: [PERMISSIONS.ANNOUNCE_NOTIFICATIONS]
      })
    });
    assert.equal(assignResponse.status, 200);
    const assignedUser = await assignResponse.json();

    assert.deepEqual(assignedUser.roles.sort(), [USER_ROLES.STUDENT, 'content-reviewer'].sort());
    assert.equal(assignedUser.role, USER_ROLES.STUDENT);
    assert.ok(assignedUser.permissions.includes(PERMISSIONS.ENROLL_COURSE));
    assert.ok(assignedUser.permissions.includes(PERMISSIONS.MANAGE_CONTENT));
    assert.ok(assignedUser.permissions.includes(PERMISSIONS.VIEW_ANALYTICS));
    assert.ok(assignedUser.permissions.includes(PERMISSIONS.ANNOUNCE_NOTIFICATIONS));
    assert.deepEqual(assignedUser.directPermissions, [PERMISSIONS.ANNOUNCE_NOTIFICATIONS]);
  });

  it('batch-fetches enrollments when listing users', async () => {
    const admin = await User.create({
      name: 'Batch Admin',
      email: 'batch-admin@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.ADMIN,
      roles: [USER_ROLES.ADMIN],
      permissions: []
    });
    const learnerOne = await User.create({
      name: 'Batch Learner One',
      email: 'batch-learner-one@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const learnerTwo = await User.create({
      name: 'Batch Learner Two',
      email: 'batch-learner-two@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const course = await Course.create({
      title: 'Batch Enrollment Course',
      description: 'Course used to verify user-list enrollment batching.',
      price: 0,
      category: 'policy',
      lessonsCount: 0,
      publishStatus: 'published',
      approvalStatus: 'approved'
    });
    await Enrollment.create([
      { userId: learnerOne._id, courseId: course._id, completed: false },
      { userId: learnerTwo._id, courseId: course._id, completed: true }
    ]);

    const originalFind = Enrollment.find;
    let enrollmentListQueries = 0;
    Enrollment.find = function patchedEnrollmentFind(query: any, ...args: any[]) {
      if (query?.userId?.$in) {
        enrollmentListQueries++;
      }
      return originalFind.call(this, query, ...args);
    };

    try {
      const response = await fetch(`${baseUrl}/api/users?limit=10&q=batch-`, {
        headers: authHeaderFor(admin)
      });
      assert.equal(response.status, 200);
      const users = await response.json() as any[];
      const byEmail = new Map(users.map((user) => [user.email, user]));

      assert.equal(enrollmentListQueries, 1);
      assert.ok(byEmail.get('batch-learner-one@example.test')?.enrolledCourses.includes(course._id.toString()));
      assert.ok(byEmail.get('batch-learner-two@example.test')?.completedCourses.includes(course._id.toString()));
    } finally {
      Enrollment.find = originalFind;
    }
  });

  it('writes complete audit details for sensitive administrative actions', async () => {
    const admin = await User.create({
      name: 'Audit Admin',
      email: 'audit-admin@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.ADMIN,
      roles: [USER_ROLES.ADMIN],
      permissions: []
    });
    const learner = await User.create({
      name: 'Audit Learner',
      email: 'audit-learner@example.test',
      password: await bcrypt.hash('password123', 12),
      role: USER_ROLES.STUDENT,
      roles: [USER_ROLES.STUDENT],
      permissions: []
    });
    const headers = {
      ...authHeaderFor(admin),
      'Content-Type': 'application/json',
      'User-Agent': 'audit-test-agent'
    };

    const roleCreate = await fetch(`${baseUrl}/api/roles`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        key: 'audit-reviewer',
        name: 'Audit Reviewer',
        description: 'Initial description',
        permissions: [PERMISSIONS.VIEW_AUDIT_LOGS]
      })
    });
    assert.equal(roleCreate.status, 201);
    const role = await roleCreate.json();

    const rolePatch = await fetch(`${baseUrl}/api/roles/${role.id}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        name: 'Audit Reviewer Updated',
        permissions: [PERMISSIONS.VIEW_AUDIT_LOGS, PERMISSIONS.EXPORT_REPORTS],
        active: false
      })
    });
    assert.equal(rolePatch.status, 200);

    const course = await Course.create({
      title: 'Audit Quiz Course',
      description: 'Course used for audit tests.',
      price: 0,
      category: 'policy',
      lessonsCount: 1,
      quizQuestions: [{
        id: 'q1',
        prompt: 'Old prompt?',
        options: ['A', 'B'],
        correctAnswerIndex: 0
      }]
    });

    const quizPatch = await fetch(`${baseUrl}/api/courses/${course._id.toString()}`, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({
        quizQuestions: [{
          id: 'q1',
          prompt: 'New prompt?',
          options: ['A', 'B'],
          correctAnswerIndex: 1
        }]
      })
    });
    assert.equal(quizPatch.status, 200);

    const resetResponse = await fetch(`${baseUrl}/api/users/admin-password-reset`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ userId: learner._id.toString() })
    });
    assert.equal(resetResponse.status, 200);

    const announcement = await fetch(`${baseUrl}/api/notifications/announce`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ title: 'Audit notice', message: 'Audit message', linkUrl: '/dashboard' })
    });
    assert.equal(announcement.status, 201);

    const [roleAudit, quizAudit, resetAudit, announcementAudit] = await Promise.all([
      AuditLog.findOne({ action: 'role.update', entityId: role.id }).sort({ createdAt: -1 }),
      AuditLog.findOne({ action: 'course.quiz-answer-key-update', entityId: course._id.toString() }).sort({ createdAt: -1 }),
      AuditLog.findOne({ action: 'user.admin-password-reset-issued', entityId: learner._id.toString() }).sort({ createdAt: -1 }),
      AuditLog.findOne({ action: 'notification.announce', entityId: 'broadcast' }).sort({ createdAt: -1 })
    ]);

    assert.equal(roleAudit?.details.result, 'success');
    assert.deepEqual(roleAudit?.details.oldValue.permissions, [PERMISSIONS.VIEW_AUDIT_LOGS]);
    assert.deepEqual(roleAudit?.details.newValue.permissions, [PERMISSIONS.VIEW_AUDIT_LOGS, PERMISSIONS.EXPORT_REPORTS]);
    assert.equal(roleAudit?.actorRole, USER_ROLES.ADMIN);
    assert.equal(roleAudit?.result, 'success');
    assert.deepEqual(roleAudit?.oldValue.permissions, [PERMISSIONS.VIEW_AUDIT_LOGS]);
    assert.deepEqual(roleAudit?.newValue.permissions, [PERMISSIONS.VIEW_AUDIT_LOGS, PERMISSIONS.EXPORT_REPORTS]);
    assert.ok(roleAudit?.ipAddress || roleAudit?.ip);
    assert.equal(roleAudit?.userAgent, 'audit-test-agent');

    assert.equal(quizAudit?.details.result, 'success');
    assert.equal(quizAudit?.details.oldValue.quizQuestions[0].correctAnswerIndex, 0);
    assert.equal(quizAudit?.details.newValue.quizQuestions[0].correctAnswerIndex, 1);

    assert.equal(resetAudit?.details.result, 'success');
    assert.equal(resetAudit?.details.targetEmail, learner.email);
    assert.equal(resetAudit?.details.newValue.passwordResetIssued, true);
    assert.ok(resetAudit?.details.newValue.passwordResetExpires);
    assert.equal(resetAudit?.details.newValue.passwordResetTokenHash, undefined);
    assert.equal(resetAudit?.newValue.passwordResetTokenHash, undefined);

    assert.equal(announcementAudit?.details.result, 'success');
    assert.equal(announcementAudit?.details.oldValue, null);
    assert.equal(announcementAudit?.details.newValue.title, 'Audit notice');
    assert.ok(announcementAudit?.details.newValue.recipientCount >= 2);
  });

  describe('public certificate verification', () => {
    it('verifies a valid certificate public metadata without leaking internal database IDs', async () => {
      const learnerId = new mongoose.Types.ObjectId();
      const courseId = new mongoose.Types.ObjectId();
      const certificateId = crypto.randomUUID();
      const issuedAt = new Date();

      await CertificateIssuance.create({
        certificateId,
        serialNumber: 'EPA-PB-2026-TEST-VALID',
        userId: learnerId,
        courseId,
        recipientName: 'Valid Student',
        courseTitle: 'Safe Fields Course',
        issuedAt,
        approvalStatus: 'approved'
      });

      const response = await fetch(`${baseUrl}/api/certificates/verify/${certificateId}`);
      assert.equal(response.status, 200);

      const body = await response.json();
      assert.deepEqual(body, {
        valid: true,
        certificateId,
        serialNumber: 'EPA-PB-2026-TEST-VALID',
        verificationCode: certificateId.slice(0, 8).toUpperCase(),
        recipientName: 'Valid Student',
        courseTitle: 'Safe Fields Course',
        issuedAt: issuedAt.toISOString(),
        revokedAt: null,
        status: 'valid'
      });

      // Assert internal fields are not exposed
      assert.equal(body.userId, undefined);
      assert.equal(body.courseId, undefined);
      assert.equal(body.cohortId, undefined);
      assert.equal(body.issuedBy, undefined);
      assert.equal(body._id, undefined);
      assert.equal(body.id, undefined);
      assert.equal(body.approvalStatus, undefined);
    });

    it('verifies a revoked certificate showing correct status and revokedAt date', async () => {
      const learnerId = new mongoose.Types.ObjectId();
      const courseId = new mongoose.Types.ObjectId();
      const certificateId = crypto.randomUUID();
      const issuedAt = new Date();
      const revokedAt = new Date();

      await CertificateIssuance.create({
        certificateId,
        serialNumber: 'EPA-PB-2026-TEST-REVOKED',
        userId: learnerId,
        courseId,
        recipientName: 'Revoked Student',
        courseTitle: 'Revocation Test Course',
        issuedAt,
        approvalStatus: 'approved',
        revokedAt,
        revocationReason: 'Ineligible participation'
      });

      const response = await fetch(`${baseUrl}/api/certificates/verify/${certificateId}`);
      assert.equal(response.status, 200);

      const body = await response.json();
      assert.deepEqual(body, {
        valid: false,
        certificateId,
        serialNumber: 'EPA-PB-2026-TEST-REVOKED',
        verificationCode: certificateId.slice(0, 8).toUpperCase(),
        recipientName: 'Revoked Student',
        courseTitle: 'Revocation Test Course',
        issuedAt: issuedAt.toISOString(),
        revokedAt: revokedAt.toISOString(),
        status: 'revoked',
        revocationReason: 'Ineligible participation'
      });

      // Assert internal fields are not exposed
      assert.equal(body.userId, undefined);
      assert.equal(body.courseId, undefined);
      assert.equal(body.cohortId, undefined);
      assert.equal(body.issuedBy, undefined);
      assert.equal(body._id, undefined);
    });

    it('verifies a non-existent certificate returning safe empty/not_found payload', async () => {
      const response = await fetch(`${baseUrl}/api/certificates/verify/does-not-exist`);
      assert.equal(response.status, 404);

      const body = await response.json();
      assert.deepEqual(body, {
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
    });
  });

  describe('OAuth and Credentials Access Control', () => {
    it('blocks credentials login for disabled users', async () => {
      const disabledUser = await User.create({
        name: 'Disabled User',
        email: 'disabled@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: [],
        emailVerified: true,
        status: 'disabled'
      });

      const response = await fetch(`${baseUrl}/api/users/authenticate`, {
        method: 'POST',
        headers: jsonOriginHeaders(),
        body: JSON.stringify({ email: disabledUser.email, password: 'password123' })
      });

      assert.equal(response.status, 403);
      const body = await response.json();
      assert.match(body.error, /disabled/i);
    });

    it('blocks credentials login for pending users', async () => {
      const pendingUser = await User.create({
        name: 'Pending User',
        email: 'pending@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: [],
        emailVerified: true,
        status: 'pending'
      });

      const response = await fetch(`${baseUrl}/api/users/authenticate`, {
        method: 'POST',
        headers: jsonOriginHeaders(),
        body: JSON.stringify({ email: pendingUser.email, password: 'password123' })
      });

      assert.equal(response.status, 403);
      const body = await response.json();
      assert.match(body.error, /pending/i);
    });

    it('creates user with custom status and respects internal-service requests', async () => {
      // Simulate internal-service token
      const token = jwt.sign(
        {
          id: 'internal-service',
          email: 'service@internal.local',
          role: 'service',
          tokenUse: 'api'
        },
        process.env.AUTH_SECRET,
        {
          subject: 'internal-service',
          issuer: 'next-auth',
          audience: 'express-api',
          expiresIn: '5m'
        }
      );

      const response = await fetch(`${baseUrl}/api/users`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: 'OAuth Pending User',
          email: 'oauth-pending-user@example.test',
          password: 'password123',
          emailVerified: true,
          status: 'pending'
        })
      });

      assert.equal(response.status, 201);
      const created = await response.json();
      assert.equal(created.status, 'pending');
      assert.equal(created.emailVerified, true);
    });
  });

  describe('lesson progress tracking API', () => {
    it('saves lesson progress and handles course/lesson completion using database duration', async () => {
      const learner = await User.create({
        name: 'Progress Learner',
        email: 'progress-learner@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: []
      });

      const course = await Course.create({
        title: 'Progress Course',
        description: 'Testing progress tracking API.',
        price: 0,
        category: 'policy',
        lessonsCount: 1,
        publishStatus: 'published',
        approvalStatus: 'approved'
      });

      const lesson = await Lesson.create({
        courseId: course._id,
        title: 'Progress Lesson 1',
        order: 1,
        duration: 100,
        isPublished: true
      });

      await Enrollment.create({
        userId: learner._id,
        courseId: course._id
      });

      const headers = {
        ...authHeaderFor(learner, []),
        'Content-Type': 'application/json'
      };

      const res1 = await fetch(`${baseUrl}/api/progress`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          lessonId: lesson._id.toString(),
          watchedSeconds: 50
        })
      });

      assert.equal(res1.status, 200);
      const data1 = await res1.json() as any;
      assert.equal(data1.watchedSeconds, 50);
      assert.equal(data1.duration, 100);
      assert.equal(data1.completed, false);

      const res2 = await fetch(`${baseUrl}/api/progress`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          lessonId: lesson._id.toString(),
          watchedSeconds: 95
        })
      });

      assert.equal(res2.status, 200);
      const data2 = await res2.json() as any;
      assert.equal(data2.watchedSeconds, 95);
      assert.equal(data2.duration, 100);
      assert.equal(data2.completed, true);
    });

    it('rejects client-sent duration because database lesson duration is authoritative', async () => {
      const learner = await User.create({
        name: 'Progress Learner 2',
        email: 'progress-learner-2@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: []
      });

      const course = await Course.create({
        title: 'Progress Course 2',
        description: 'Testing progress tracking duration.',
        price: 0,
        category: 'policy',
        lessonsCount: 1,
        publishStatus: 'published',
        approvalStatus: 'approved'
      });

      const lesson = await Lesson.create({
        courseId: course._id,
        title: 'Progress Lesson 2',
        order: 1,
        duration: 100,
        isPublished: true
      });

      await Enrollment.create({
        userId: learner._id,
        courseId: course._id
      });

      const headers = {
        ...authHeaderFor(learner, []),
        'Content-Type': 'application/json'
      };

      const res = await fetch(`${baseUrl}/api/progress`, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          lessonId: lesson._id.toString(),
          watchedSeconds: 50,
          duration: 1000
        })
      });

      assert.equal(res.status, 400);
      const data = await res.json() as any;
      assert.match(data.error, /duration|unrecognized/i);
    });

    it('rejects manual lesson completion progress writes', async () => {
      const learner = await User.create({
        name: 'Manual Progress Learner',
        email: 'manual-progress-learner@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: []
      });

      const course = await Course.create({
        title: 'Manual Progress Course',
        description: 'Testing rejection of manual lesson completion.',
        price: 0,
        category: 'policy',
        lessonsCount: 1,
        publishStatus: 'published',
        approvalStatus: 'approved'
      });

      const lesson = await Lesson.create({
        courseId: course._id,
        title: 'Manual Progress Lesson',
        order: 1,
        duration: 100,
        completionMode: 'video_progress',
        isPublished: true
      });

      await Enrollment.create({
        userId: learner._id,
        courseId: course._id
      });

      const res = await fetch(`${baseUrl}/api/progress`, {
        method: 'POST',
        headers: {
          ...authHeaderFor(learner, []),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          lessonId: lesson._id.toString(),
          watchedSeconds: 100,
          completionSource: 'manual'
        })
      });

      assert.equal(res.status, 400);
      const data = await res.json() as any;
      assert.match(data.error, /completionSource|invalid/i);
    });
  });

  describe('course search API relevance sorting', () => {
    it('sorts search results by relevance score first, then createdAt descending', async () => {
      const course1 = await Course.create({
        title: 'CBD CBD CBD',
        description: 'CBD CBD CBD CBD CBD.',
        category: 'policy',
        publishStatus: 'published',
        approvalStatus: 'approved',
        createdAt: new Date('2026-06-28T00:00:00Z')
      });

      const course2 = await Course.create({
        title: 'CBD Policy Basics',
        description: 'Introduction to CBD.',
        category: 'policy',
        publishStatus: 'published',
        approvalStatus: 'approved',
        createdAt: new Date('2026-06-29T00:00:00Z')
      });

      const course3 = await Course.create({
        title: 'Unrelated Climate Science Class',
        description: 'General climate frameworks.',
        category: 'science',
        publishStatus: 'published',
        approvalStatus: 'approved',
        createdAt: new Date('2026-06-30T00:00:00Z')
      });

      const res = await fetch(`${baseUrl}/api/courses?q=CBD`);
      assert.equal(res.status, 200);
      const courses = await res.json() as any[];

      assert.equal(courses.length, 2);
      assert.equal(courses[0].id, course1._id.toString());
      assert.equal(courses[1].id, course2._id.toString());
    });

    it('retains default createdAt sorting when q is not provided', async () => {
      const res = await fetch(`${baseUrl}/api/courses`);
      assert.equal(res.status, 200);
      const courses = await res.json() as any[];

      assert.ok(courses.length >= 3);
      const titles = courses.slice(0, 3).map(c => c.title);
      assert.deepEqual(titles, [
        'Unrelated Climate Science Class',
        'CBD Policy Basics',
        'CBD CBD CBD'
      ]);
    });

    it('keeps catalog filters working with text search relevance', async () => {
      const res = await fetch(`${baseUrl}/api/courses?q=CBD&category=policy&limit=1&page=2`);
      assert.equal(res.status, 200);
      const courses = await res.json() as any[];

      assert.equal(courses.length, 1);
      assert.equal(courses[0].title, 'CBD Policy Basics');
    });
  });

  describe('video streaming API range and error handling', () => {
    let testVideoPath: string;

    before(() => {
      testVideoPath = path.resolve(process.cwd(), 'uploads', 'videos', 'test-video.mp4');
      fs.writeFileSync(testVideoPath, Buffer.alloc(1000, 'A'));
    });

    after(() => {
      try {
        if (fs.existsSync(testVideoPath)) {
          fs.unlinkSync(testVideoPath);
        }
      } catch (err) {}
    });

    it('allows enrolled learners to request full video stream and range stream', async () => {
      const learner = await User.create({
        name: 'Video Learner',
        email: 'video-learner@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: []
      });

      const course = await Course.create({
        title: 'Video Streaming Course',
        description: 'Course to test video streaming.',
        price: 0,
        category: 'policy',
        lessonsCount: 1,
        publishStatus: 'published',
        approvalStatus: 'approved'
      });

      const lesson = await Lesson.create({
        courseId: course._id,
        title: 'Streaming Lesson',
        order: 1,
        videoUrl: '/uploads/videos/test-video.mp4',
        isPublished: true
      });

      await Enrollment.create({
        userId: learner._id,
        courseId: course._id
      });

      const headers = authHeaderFor(learner, []);

      // 1. Full stream request (no Range header)
      const resFull = await fetch(`${baseUrl}/api/video/${lesson._id.toString()}`, { headers });
      assert.equal(resFull.status, 200);
      assert.equal(resFull.headers.get('content-length'), '1000');
      assert.equal(resFull.headers.get('content-type'), 'video/mp4');
      assert.equal(resFull.headers.get('accept-ranges'), 'bytes');

      // 2. Partial range request (Range: bytes=0-99)
      const resPartial = await fetch(`${baseUrl}/api/video/${lesson._id.toString()}`, {
        headers: {
          ...headers,
          Range: 'bytes=0-99'
        }
      });
      assert.equal(resPartial.status, 206);
      assert.equal(resPartial.headers.get('content-range'), 'bytes 0-99/1000');
      assert.equal(resPartial.headers.get('content-length'), '100');
      assert.equal(resPartial.headers.get('content-type'), 'video/mp4');

      // 3. Open range request (Range: bytes=500-)
      const resOpenRange = await fetch(`${baseUrl}/api/video/${lesson._id.toString()}`, {
        headers: {
          ...headers,
          Range: 'bytes=500-'
        }
      });
      assert.equal(resOpenRange.status, 206);
      assert.equal(resOpenRange.headers.get('content-range'), 'bytes 500-999/1000');
      assert.equal(resOpenRange.headers.get('content-length'), '500');
    });

    it('returns 416 Range Not Satisfiable for invalid ranges', async () => {
      const learner = await User.create({
        name: 'Video Learner 2',
        email: 'video-learner-2@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: []
      });

      const course = await Course.create({
        title: 'Video Streaming Course 2',
        description: 'Course to test video streaming invalid ranges.',
        price: 0,
        category: 'policy',
        lessonsCount: 1,
        publishStatus: 'published',
        approvalStatus: 'approved'
      });

      const lesson = await Lesson.create({
        courseId: course._id,
        title: 'Streaming Lesson 2',
        order: 1,
        videoUrl: '/uploads/videos/test-video.mp4',
        isPublished: true
      });

      await Enrollment.create({
        userId: learner._id,
        courseId: course._id
      });

      const headers = authHeaderFor(learner, []);

      const res = await fetch(`${baseUrl}/api/video/${lesson._id.toString()}`, {
        headers: {
          ...headers,
          Range: 'bytes=1500-1600'
        }
      });
      assert.equal(res.status, 416);
      assert.equal(res.headers.get('content-range'), 'bytes */1000');
    });

    it('returns 404 Not Found for missing video files', async () => {
      const learner = await User.create({
        name: 'Video Learner 3',
        email: 'video-learner-3@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: []
      });

      const course = await Course.create({
        title: 'Video Streaming Course 3',
        description: 'Course to test missing video.',
        price: 0,
        category: 'policy',
        lessonsCount: 1,
        publishStatus: 'published',
        approvalStatus: 'approved'
      });

      const lesson = await Lesson.create({
        courseId: course._id,
        title: 'Missing Video Lesson',
        order: 1,
        videoUrl: '/uploads/videos/nonexistent-video.mp4',
        isPublished: true
      });

      await Enrollment.create({
        userId: learner._id,
        courseId: course._id
      });

      const headers = authHeaderFor(learner, []);

      const res = await fetch(`${baseUrl}/api/video/${lesson._id.toString()}`, { headers });
      assert.equal(res.status, 404);
      const body = await res.json() as any;
      assert.match(body.error, /does not exist|file/i);
    });

    it('returns 403 Access Denied for learners not enrolled in the course', async () => {
      const learner = await User.create({
        name: 'Video Learner 4',
        email: 'video-learner-4@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: []
      });

      const course = await Course.create({
        title: 'Video Streaming Course 4',
        description: 'Course to test access denied.',
        price: 0,
        category: 'policy',
        lessonsCount: 1,
        publishStatus: 'published',
        approvalStatus: 'approved'
      });

      const lesson = await Lesson.create({
        courseId: course._id,
        title: 'Protected Video Lesson',
        order: 1,
        videoUrl: '/uploads/videos/test-video.mp4',
        isPublished: true
      });

      // No enrollment!
      const headers = authHeaderFor(learner, []);

      const res = await fetch(`${baseUrl}/api/video/${lesson._id.toString()}`, { headers });
      assert.equal(res.status, 403);
      const body = await res.json() as any;
      assert.match(body.error, /denied|enrolled/i);
    });
  });

  describe('video upload hardening and validation', () => {
    let mockVideoPath: string;
    let createdFiles: string[] = [];

    const createTestVideo = (targetPath: string): Promise<void> => {
      return new Promise((resolve, reject) => {
        ffmpeg()
          .input('color=c=black:s=320x240:d=1')
          .inputFormat('lavfi')
          .outputOptions([
            '-c:v libx264',
            '-pix_fmt yuv420p'
          ])
          .save(targetPath)
          .on('end', () => resolve())
          .on('error', (err: any) => reject(err));
      });
    };

    before(async () => {
      mockVideoPath = path.resolve(process.cwd(), 'uploads', 'videos', 'mock-valid-video.mp4');
      await createTestVideo(mockVideoPath);
    });

    after(() => {
      // Clean up mock video
      try {
        if (fs.existsSync(mockVideoPath)) {
          fs.unlinkSync(mockVideoPath);
        }
      } catch (err) {}

      // Clean up uploaded files
      for (const filePath of createdFiles) {
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
        } catch (err) {}
      }
    });

    it('successfully uploads valid video, renames with UUID, and stores original filename as metadata', async () => {
      const contentManager = await User.create({
        name: 'Video Instructor',
        email: 'video-instructor@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.INSTRUCTOR,
        roles: [USER_ROLES.INSTRUCTOR],
        permissions: [PERMISSIONS.MANAGE_CONTENT]
      });

      const course = await Course.create({
        title: 'Video Upload Course',
        description: 'Course to test video upload.',
        price: 0,
        category: 'policy',
        lessonsCount: 1,
        publishStatus: 'published',
        approvalStatus: 'approved'
      });

      const lesson = await Lesson.create({
        courseId: course._id,
        title: 'Upload Lesson',
        order: 1,
        isPublished: true
      });

      const fileBuffer = fs.readFileSync(mockVideoPath);
      const form = new FormData();
      form.append('video', new Blob([fileBuffer], { type: 'video/mp4' }), 'my-original-lesson-video.mp4');

      const headers = authHeaderFor(contentManager, [PERMISSIONS.MANAGE_CONTENT]);

      const res = await fetch(`${baseUrl}/api/lessons/${lesson._id.toString()}/upload`, {
        method: 'POST',
        headers,
        body: form
      });

      assert.equal(res.status, 200);
      const updatedLesson = await res.json() as any;
      assert.ok(updatedLesson.videoUrl);
      assert.equal(updatedLesson.videoOriginalName, 'my-original-lesson-video.mp4');

      // Verify filename on disk is not based on original name but is a UUID
      const videoFilename = path.basename(updatedLesson.videoUrl);
      assert.match(videoFilename, /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.mp4$/);

      // Verify the file actually exists on disk
      const resolvedPath = path.resolve(process.cwd(), 'uploads', 'videos', videoFilename);
      assert.ok(fs.existsSync(resolvedPath));
      createdFiles.push(resolvedPath);
    });

    it('rejects spoofed non-video files and deletes the temporary file', async () => {
      const contentManager = await User.create({
        name: 'Video Instructor 2',
        email: 'video-instructor-2@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.INSTRUCTOR,
        roles: [USER_ROLES.INSTRUCTOR],
        permissions: [PERMISSIONS.MANAGE_CONTENT]
      });

      const course = await Course.create({
        title: 'Video Upload Course 2',
        description: 'Course to test spoofed upload.',
        price: 0,
        category: 'policy',
        lessonsCount: 1,
        publishStatus: 'published',
        approvalStatus: 'approved'
      });

      const lesson = await Lesson.create({
        courseId: course._id,
        title: 'Upload Lesson 2',
        order: 1,
        isPublished: true
      });

      // Create spoofed video (text contents renamed to .mp4)
      const form = new FormData();
      form.append('video', new Blob([Buffer.from('Not a real MP4 video. Just some dummy text.')], { type: 'video/mp4' }), 'spoofed.mp4');

      const headers = authHeaderFor(contentManager, [PERMISSIONS.MANAGE_CONTENT]);

      const res = await fetch(`${baseUrl}/api/lessons/${lesson._id.toString()}/upload`, {
        method: 'POST',
        headers,
        body: form
      });

      assert.equal(res.status, 400);
      const data = await res.json() as any;
      assert.match(data.error, /valid video/i);

      // Verify that no new files are created in the uploads/videos directory
      const videoDir = path.resolve(process.cwd(), 'uploads', 'videos');
      const files = fs.readdirSync(videoDir);
      // Ensure no UUID-like files other than our created valid test video exist
      for (const file of files) {
        if (file !== '.gitkeep' && file !== 'mock-valid-video.mp4' && file !== 'test-video.mp4') {
          const resolvedPath = path.resolve(videoDir, file);
          if (!createdFiles.includes(resolvedPath)) {
            assert.fail(`Found orphan file from failed upload: ${file}`);
          }
        }
      }
    });

    it('correctly parses environment variable for size limit', () => {
      process.env.VIDEO_MAX_UPLOAD_SIZE_BYTES = '1000';
      // Delete from require cache to force re-evaluation
      delete require.cache[require.resolve('../src/server/config/storage')];
      const { storageConfig: config } = require('../src/server/config/storage');
      assert.equal(config.maxVideoSize, 1000);
      delete process.env.VIDEO_MAX_UPLOAD_SIZE_BYTES;
      delete require.cache[require.resolve('../src/server/config/storage')];
    });
  });

  describe('sensitive action audit logging', () => {
    it('logs user.status-change when an admin updates a user status', async () => {
      const crypto = require('crypto');
      const admin = await User.create({
        name: 'Audit Admin Status',
        email: 'audit-admin-status@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.ADMIN,
        roles: [USER_ROLES.ADMIN],
        permissions: []
      });
      const targetUser = await User.create({
        name: 'Target Status User',
        email: 'target-status@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: [],
        status: 'active'
      });

      const response = await fetch(`${baseUrl}/api/users/${targetUser._id.toString()}`, {
        method: 'PUT',
        headers: {
          ...authHeaderFor(admin),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ status: 'disabled' })
      });
      assert.equal(response.status, 200);

      const audit = await AuditLog.findOne({
        action: 'user.status-change',
        entityId: targetUser._id.toString()
      }).sort({ createdAt: -1 });

      assert.ok(audit);
      assert.equal(audit.details.result, 'success');
      assert.equal(audit.details.oldValue.status, 'active');
      assert.equal(audit.details.newValue.status, 'disabled');
    });

    it('logs user.password-reset-completed when a user confirms a password reset', async () => {
      const crypto = require('crypto');
      const resetUser = await User.create({
        name: 'Reset Confirm User',
        email: 'reset-confirm@example.test',
        password: await bcrypt.hash('old-password', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: [],
        passwordResetTokenHash: crypto.createHash('sha256').update('reset-token-123456').digest('hex'),
        passwordResetExpires: new Date(Date.now() + 60 * 60 * 1000)
      });

      const response = await fetch(`${baseUrl}/api/users/password-reset/confirm`, {
        method: 'POST',
        headers: jsonOriginHeaders(),
        body: JSON.stringify({ token: 'reset-token-123456', password: 'new-password-123' })
      });
      assert.equal(response.status, 200);

      const audit = await AuditLog.findOne({
        action: 'user.password-reset-completed',
        entityId: resetUser._id.toString()
      }).sort({ createdAt: -1 });

      assert.ok(audit);
      assert.equal(audit.details.result, 'success');
      assert.equal(audit.actorId.toString(), resetUser._id.toString());
      assert.equal(audit.actorEmail, resetUser.email);
    });

    it('logs user.login-success and user.login-failure with reasons', async () => {
      const loginUser = await User.create({
        name: 'Login Test User',
        email: 'login-test@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: [],
        emailVerified: true,
        status: 'active'
      });

      // 1. Success login
      const resSuccess = await fetch(`${baseUrl}/api/users/authenticate`, {
        method: 'POST',
        headers: jsonOriginHeaders(),
        body: JSON.stringify({ email: loginUser.email, password: 'password123' })
      });
      assert.equal(resSuccess.status, 200);

      const successAudit = await AuditLog.findOne({
        action: 'user.login-success',
        entityId: loginUser._id.toString()
      }).sort({ createdAt: -1 });
      assert.ok(successAudit);
      assert.equal(successAudit.details.result, 'success');
      assert.equal(successAudit.actorId.toString(), loginUser._id.toString());
      assert.equal(successAudit.actorEmail, loginUser.email);

      // 2. Failure: invalid credentials (wrong password)
      const resWrongPassword = await fetch(`${baseUrl}/api/users/authenticate`, {
        method: 'POST',
        headers: jsonOriginHeaders(),
        body: JSON.stringify({ email: loginUser.email, password: 'wrongpassword' })
      });
      assert.equal(resWrongPassword.status, 401);

      const wrongPasswordAudit = await AuditLog.findOne({
        action: 'user.login-failure',
        entityId: loginUser._id.toString(),
        'details.reason': 'invalid_credentials'
      }).sort({ createdAt: -1 });
      assert.ok(wrongPasswordAudit);
      assert.equal(wrongPasswordAudit.details.result, 'failure');
      assert.equal(wrongPasswordAudit.details.email, loginUser.email);

      // 3. Failure: non-existent email
      const resNoUser = await fetch(`${baseUrl}/api/users/authenticate`, {
        method: 'POST',
        headers: jsonOriginHeaders(),
        body: JSON.stringify({ email: 'non-existent@example.test', password: 'password123' })
      });
      assert.equal(resNoUser.status, 401);

      const noUserAudit = await AuditLog.findOne({
        action: 'user.login-failure',
        'details.email': 'non-existent@example.test'
      }).sort({ createdAt: -1 });
      assert.ok(noUserAudit);
      assert.equal(noUserAudit.details.result, 'failure');
      assert.equal(noUserAudit.details.reason, 'invalid_credentials');

      // 4. Failure: email unverified
      const unverifiedUser = await User.create({
        name: 'Unverified User',
        email: 'unverified@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: [],
        emailVerified: false,
        status: 'active'
      });
      const resUnverified = await fetch(`${baseUrl}/api/users/authenticate`, {
        method: 'POST',
        headers: jsonOriginHeaders(),
        body: JSON.stringify({ email: unverifiedUser.email, password: 'password123' })
      });
      assert.equal(resUnverified.status, 403);

      const unverifiedAudit = await AuditLog.findOne({
        action: 'user.login-failure',
        entityId: unverifiedUser._id.toString()
      }).sort({ createdAt: -1 });
      assert.ok(unverifiedAudit);
      assert.equal(unverifiedAudit.details.reason, 'email_unverified');
    });
  });

  describe('video storage provider abstraction', () => {
    it('instantiates correct provider based on VIDEO_STORAGE env variable', () => {
      const originalStorage = process.env.VIDEO_STORAGE;
      try {
        delete require.cache[require.resolve('../src/server/services/videoStorage')];

        process.env.VIDEO_STORAGE = 's3';
        const s3Module = require('../src/server/services/videoStorage');
        assert.ok(s3Module.videoStorageProvider.constructor.name.includes('S3'));

        delete require.cache[require.resolve('../src/server/services/videoStorage')];
        process.env.VIDEO_STORAGE = 'minio';
        const minioModule = require('../src/server/services/videoStorage');
        assert.ok(minioModule.videoStorageProvider.constructor.name.includes('MinIO'));

        delete require.cache[require.resolve('../src/server/services/videoStorage')];
        process.env.VIDEO_STORAGE = 'azure';
        const azureModule = require('../src/server/services/videoStorage');
        assert.ok(azureModule.videoStorageProvider.constructor.name.includes('Azure'));

        delete require.cache[require.resolve('../src/server/services/videoStorage')];
        process.env.VIDEO_STORAGE = 'local';
        const localModule = require('../src/server/services/videoStorage');
        assert.ok(localModule.videoStorageProvider.constructor.name.includes('Local'));
      } finally {
        process.env.VIDEO_STORAGE = originalStorage;
        delete require.cache[require.resolve('../src/server/services/videoStorage')];
      }
    });

    it('throwing descriptive errors for unimplemented remote providers', async () => {
      const originalStorage = process.env.VIDEO_STORAGE;
      try {
        delete require.cache[require.resolve('../src/server/services/videoStorage')];
        process.env.VIDEO_STORAGE = 's3';
        const s3Module = require('../src/server/services/videoStorage');
        assert.equal(s3Module.getVideoStorageKey('/uploads/videos/example.mp4'), 'example.mp4');

        await assert.rejects(
          s3Module.videoStorageProvider.upload({ path: 'dummy', filename: 'dummy.mp4' } as any),
          (error: any) => {
            assert.equal(error.name, 'VideoStorageNotImplementedError');
            assert.equal(error.statusCode, 501);
            assert.match(error.message, /S3-compatible video storage upload/);
            assert.match(error.message, /S3_BUCKET/);
            return true;
          }
        );
        await assert.rejects(
          s3Module.videoStorageProvider.getStream('dummy.mp4'),
          /S3-compatible video storage streaming/
        );
      } finally {
        process.env.VIDEO_STORAGE = originalStorage;
        delete require.cache[require.resolve('../src/server/services/videoStorage')];
      }
    });

    it('local provider verifies, uploads, streams, and deletes video through the abstraction', async () => {
      const fs = require('fs');
      const path = require('path');
      const { videoStorageProvider, getLocalVideoDir } = require('../src/server/services/videoStorage');

      const tempFile = path.resolve(getLocalVideoDir(), 'temp-test-upload.mp4');
      fs.writeFileSync(tempFile, 'dummy content');

      const mockFile = {
        path: tempFile,
        filename: 'test-abstract-video.mp4',
        originalname: 'original-name.mp4',
        mimetype: 'video/mp4'
      } as any;

      // 1. Upload/move
      const stored = await videoStorageProvider.upload(mockFile);
      assert.equal(stored.key, 'test-abstract-video.mp4');
      assert.ok(stored.url.includes('test-abstract-video.mp4'));

      // 2. Check exist
      const exists = await videoStorageProvider.exists('test-abstract-video.mp4');
      assert.ok(exists);

      // 3. Get stream
      const streamRes = await videoStorageProvider.getStream('test-abstract-video.mp4');
      assert.equal(streamRes.status, 200);
      assert.equal(streamRes.contentLength, 13); // 'dummy content' size

      // Consume stream to avoid open file handles
      await new Promise<void>((resolve, reject) => {
        streamRes.stream.on('data', () => {});
        streamRes.stream.on('end', resolve);
        streamRes.stream.on('error', reject);
      });

      // 4. Delete
      await videoStorageProvider.delete('test-abstract-video.mp4');
      const existsAfter = await videoStorageProvider.exists('test-abstract-video.mp4');
      assert.ok(!existsAfter);
    });
  });

  describe('certificate integrity and revocation workflow', () => {
    it('creates certificate with serial, verificationCode, status, cohortId and allows verification & revocation', async () => {
      const admin = await User.create({
        name: 'Cert Admin',
        email: 'cert-admin@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.ADMIN,
        roles: [USER_ROLES.ADMIN],
        permissions: []
      });

      const learner = await User.create({
        name: 'Cert Learner',
        email: 'cert-learner@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: []
      });

      const course = await Course.create({
        title: 'Cert Integrity Course',
        description: 'Testing certificate integrity features.',
        price: 0,
        category: 'policy',
        lessonsCount: 0,
        publishStatus: 'published',
        approvalStatus: 'approved',
        requiresCertificateApproval: false
      });

      const cohort = await Cohort.create({
        title: 'Cert Cohort 2026',
        courseIds: [course._id],
        status: 'active'
      });

      await CohortMembership.create({
        cohortId: cohort._id,
        userId: learner._id,
        status: 'active'
      });

      await Enrollment.create({
        userId: learner._id,
        courseId: course._id,
        completed: true,
        completedAt: new Date()
      });

      // 1. Download certificate (triggers generation)
      const resDownload = await fetch(`${baseUrl}/api/certificates/${course._id.toString()}/download`, {
        headers: authHeaderFor(learner)
      });
      assert.equal(resDownload.status, 200);

      // 2. Fetch record from DB to inspect fields
      const record = await CertificateIssuance.findOne({ userId: learner._id, courseId: course._id });
      assert.ok(record);
      assert.match(record.serialNumber, /^EPA-CKEPD-\d{4}-/);
      assert.ok(record.verificationCode);
      assert.equal(record.status, 'valid');
      assert.equal(record.cohortId.toString(), cohort._id.toString());

      // 3. Verify via verificationCode
      const resVerifyCode = await fetch(`${baseUrl}/api/certificates/verify/${record.verificationCode}`);
      assert.equal(resVerifyCode.status, 200);
      const bodyVerifyCode = await resVerifyCode.json();
      assert.equal(bodyVerifyCode.valid, true);
      assert.equal(bodyVerifyCode.status, 'valid');
      assert.equal(bodyVerifyCode.serialNumber, record.serialNumber);
      assert.equal(bodyVerifyCode.verificationCode, record.verificationCode);
      assert.equal(bodyVerifyCode.cohortId, undefined);
      assert.equal(bodyVerifyCode.issuedBy, undefined);
      assert.equal(bodyVerifyCode.userId, undefined);
      assert.equal(bodyVerifyCode.courseId, undefined);

      // 4. Repeated download must reuse the same issuance record, not mint duplicates.
      const resDownloadAgain = await fetch(`${baseUrl}/api/certificates/${course._id.toString()}/download`, {
        headers: authHeaderFor(learner)
      });
      assert.equal(resDownloadAgain.status, 200);
      const records = await CertificateIssuance.find({ userId: learner._id, courseId: course._id });
      assert.equal(records.length, 1);
      assert.equal(records[0].serialNumber, record.serialNumber);

      // 5. Learners cannot revoke certificates.
      const learnerRevoke = await fetch(`${baseUrl}/api/certificates/${record.certificateId}/revoke`, {
        method: 'POST',
        headers: {
          ...authHeaderFor(learner),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'Invalid learner revocation attempt' })
      });
      assert.equal(learnerRevoke.status, 403);

      // 6. Revoke as admin
      const resRevoke = await fetch(`${baseUrl}/api/certificates/${record.certificateId}/revoke`, {
        method: 'POST',
        headers: {
          ...authHeaderFor(admin),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ reason: 'Cheating' })
      });
      assert.equal(resRevoke.status, 200);

      // 7. Verify after revocation
      const resVerifyAfter = await fetch(`${baseUrl}/api/certificates/verify/${record.certificateId}`);
      assert.equal(resVerifyAfter.status, 200);
      const bodyVerifyAfter = await resVerifyAfter.json();
      assert.equal(bodyVerifyAfter.valid, false);
      assert.equal(bodyVerifyAfter.status, 'revoked');
      assert.equal(bodyVerifyAfter.revocationReason, 'Cheating');
      assert.equal(bodyVerifyAfter.cohortId, undefined);
      assert.equal(bodyVerifyAfter.issuedBy, undefined);
    });

    it('gracefully handles legacy certificates using fallbacks', async () => {
      const crypto = require('crypto');
      const legacyId = crypto.randomUUID();
      const legacyCert = await CertificateIssuance.create({
        certificateId: legacyId,
        userId: new mongoose.Types.ObjectId(),
        courseId: new mongoose.Types.ObjectId(),
        recipientName: 'Legacy Student',
        courseTitle: 'Legacy Course',
        issuedAt: new Date(),
        approvalStatus: 'approved'
      });

      const response = await fetch(`${baseUrl}/api/certificates/verify/${legacyId}`);
      assert.equal(response.status, 200);
      const body = await response.json();
      assert.equal(body.valid, true);
      assert.equal(body.status, 'valid');
      assert.equal(body.serialNumber, `EPA-CKEPD-MIGRATED-${legacyId.slice(0, 8).toUpperCase()}`);
      assert.equal(body.verificationCode, legacyId.slice(0, 8).toUpperCase());
    });
  });

  describe('course approval and publishing workflow', () => {
    it('handles the full course governance status transitions, permissions and enrollment blocks', async () => {
      // Create an instructor user
      const instructor = await User.create({
        name: 'Gov Instructor',
        email: 'gov-instructor@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.INSTRUCTOR,
        roles: [USER_ROLES.INSTRUCTOR],
        permissions: []
      });

      // Create an admin user
      const admin = await User.create({
        name: 'Gov Admin',
        email: 'gov-admin@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.ADMIN,
        roles: [USER_ROLES.ADMIN],
        permissions: []
      });

      // Create a student user
      const student = await User.create({
        name: 'Gov Student',
        email: 'gov-student@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: []
      });

      // 1. Create a course (POST /api/courses) - should be created in draft
      const resCreate = await fetch(`${baseUrl}/api/courses`, {
        method: 'POST',
        headers: {
          ...authHeaderFor(instructor, [PERMISSIONS.MANAGE_CONTENT]),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: 'Gov Workflow Course',
          description: 'A course for testing status transitions.',
          category: 'policy'
        })
      });
      assert.equal(resCreate.status, 201);
      const courseData = await resCreate.json();
      assert.equal(courseData.status, 'draft');
      assert.equal(courseData.createdBy, instructor._id.toString());

      const courseId = courseData.id;

      // 2. Public catalog check: should be hidden from public catalog
      const resCatalog1 = await fetch(`${baseUrl}/api/courses`);
      const catalog1 = await resCatalog1.json();
      assert.ok(!catalog1.some((c: any) => c.id === courseId));

      // 3. New enrollment check: should deny enrollment for draft courses
      const resEnroll1 = await fetch(`${baseUrl}/api/users/enroll`, {
        method: 'POST',
        headers: {
          ...authHeaderFor(student, [PERMISSIONS.ENROLL_COURSE]),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ courseId })
      });
      assert.equal(resEnroll1.status, 403);

      // 4. Edit course in draft: allowed for instructor
      const resEdit1 = await fetch(`${baseUrl}/api/courses/${courseId}`, {
        method: 'PATCH',
        headers: {
          ...authHeaderFor(instructor, [PERMISSIONS.MANAGE_CONTENT]),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: 'Gov Workflow Course Edited' })
      });
      assert.equal(resEdit1.status, 200);

      // 5. Submit for review (POST /api/courses/:id/approval, action = 'submit')
      const resSubmit = await fetch(`${baseUrl}/api/courses/${courseId}/approval`, {
        method: 'POST',
        headers: {
          ...authHeaderFor(instructor, [PERMISSIONS.MANAGE_CONTENT]),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'submit', comments: 'Ready for review' })
      });
      assert.equal(resSubmit.status, 200);
      const submittedCourse = await resSubmit.json();
      assert.equal(submittedCourse.status, 'submitted_for_review');
      assert.equal(submittedCourse.submittedBy, instructor._id.toString());
      assert.ok(submittedCourse.submittedAt);

      // 6. Instructor editing block: should deny editing since status is no longer 'draft'
      const resEdit2 = await fetch(`${baseUrl}/api/courses/${courseId}`, {
        method: 'PATCH',
        headers: {
          ...authHeaderFor(instructor, [PERMISSIONS.MANAGE_CONTENT]),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ title: 'Invalid Edit Attempt' })
      });
      assert.equal(resEdit2.status, 403); // Denied

      // 7. Approve (POST /api/courses/:id/approval, action = 'approve') - requires APPROVE_COURSES
      const resApprove = await fetch(`${baseUrl}/api/courses/${courseId}/approval`, {
        method: 'POST',
        headers: {
          ...authHeaderFor(admin, [PERMISSIONS.APPROVE_COURSES]),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'approve', comments: 'Looks good' })
      });
      assert.equal(resApprove.status, 200);
      const approvedCourse = await resApprove.json();
      assert.equal(approvedCourse.status, 'approved');
      assert.equal(approvedCourse.approvedBy, admin._id.toString());
      assert.ok(approvedCourse.approvedAt);

      // 8. Publish (POST /api/courses/:id/approval, action = 'publish') - Only approved courses can be published
      const resPublish = await fetch(`${baseUrl}/api/courses/${courseId}/approval`, {
        method: 'POST',
        headers: {
          ...authHeaderFor(admin, [PERMISSIONS.APPROVE_COURSES]),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'publish', comments: 'Officially publishing' })
      });
      assert.equal(resPublish.status, 200);
      const publishedCourse = await resPublish.json();
      assert.equal(publishedCourse.status, 'published');
      assert.equal(publishedCourse.publishedBy, admin._id.toString());
      assert.ok(publishedCourse.publishedAt);

      // 9. Public catalog check: should be visible now!
      const resCatalog2 = await fetch(`${baseUrl}/api/courses`);
      const catalog2 = await resCatalog2.json();
      assert.ok(catalog2.some((c: any) => c.id === courseId));

      // 10. Enrollment check: student can enroll now
      const resEnroll2 = await fetch(`${baseUrl}/api/users/enroll`, {
        method: 'POST',
        headers: {
          ...authHeaderFor(student, [PERMISSIONS.ENROLL_COURSE]),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ courseId })
      });
      assert.equal(resEnroll2.status, 200);

      // 11. Archive (POST /api/courses/:id/approval, action = 'archive')
      const resArchive = await fetch(`${baseUrl}/api/courses/${courseId}/approval`, {
        method: 'POST',
        headers: {
          ...authHeaderFor(admin, [PERMISSIONS.APPROVE_COURSES]),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ action: 'archive', comments: 'Archiving course' })
      });
      assert.equal(resArchive.status, 200);
      const archivedCourse = await resArchive.json();
      assert.equal(archivedCourse.status, 'archived');
      assert.equal(archivedCourse.archivedBy, admin._id.toString());
      assert.ok(archivedCourse.archivedAt);

      // 12. New enrollment check: student should be denied enrollment on archived course
      const otherStudent = await User.create({
        name: 'Gov Student 2',
        email: 'gov-student2@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        permissions: []
      });
      const resEnroll3 = await fetch(`${baseUrl}/api/users/enroll`, {
        method: 'POST',
        headers: {
          ...authHeaderFor(otherStudent, [PERMISSIONS.ENROLL_COURSE]),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ courseId })
      });
      assert.equal(resEnroll3.status, 403); // Denied

      // 13. Existing enrolled learner access check: student who enrolled before archive still has access
      const { hasCourseAccess } = require('../src/server/services/enrollments');
      const hasAccess = await hasCourseAccess({ id: student._id.toString(), role: student.role, roles: student.roles, permissions: [] }, courseId);
      assert.equal(hasAccess, true);
    });
  });

  describe('improved email management and security flows', () => {
    it('admin can perform email provider health check, others are blocked', async () => {
      // Create admin user
      const adminUser = await User.create({
        name: 'Email Admin',
        email: 'email-admin@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.ADMIN,
        roles: [USER_ROLES.ADMIN],
        emailVerified: true
      });

      // Create student user
      const studentUser = await User.create({
        name: 'Email Student',
        email: 'email-student@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT],
        emailVerified: true
      });

      // Admin requests health check
      const adminHeader = authHeaderFor(adminUser);
      const resAdmin = await fetch(`${baseUrl}/api/users/email/health`, {
        method: 'GET',
        headers: adminHeader
      });
      assert.equal(resAdmin.status, 200);
      const dataAdmin = await resAdmin.json();
      assert.equal(dataAdmin.status, 'healthy');
      assert.equal(dataAdmin.provider, 'console');

      // Student requests health check - should be blocked
      const studentHeader = authHeaderFor(studentUser, []);
      const resStudent = await fetch(`${baseUrl}/api/users/email/health`, {
        method: 'GET',
        headers: studentHeader
      });
      assert.equal(resStudent.status, 403);
    });

    it('rate-limits verification resends and does not expose email existence', async () => {
      const email = 'resend-rate-limit-test@example.test';

      // 1. Resend 1
      const res1 = await fetch(`${baseUrl}/api/users/resend-verification`, {
        method: 'POST',
        headers: jsonOriginHeaders(),
        body: JSON.stringify({ email })
      });
      assert.equal(res1.status, 200);
      const data1 = await res1.json();
      assert.equal(data1.success, true);

      // 2. Resend 2
      const res2 = await fetch(`${baseUrl}/api/users/resend-verification`, {
        method: 'POST',
        headers: jsonOriginHeaders(),
        body: JSON.stringify({ email })
      });
      assert.equal(res2.status, 200);

      // 3. Resend 3
      const res3 = await fetch(`${baseUrl}/api/users/resend-verification`, {
        method: 'POST',
        headers: jsonOriginHeaders(),
        body: JSON.stringify({ email })
      });
      assert.equal(res3.status, 200);

      // 4. Resend 4 (exceeds rate limit)
      const res4 = await fetch(`${baseUrl}/api/users/resend-verification`, {
        method: 'POST',
        headers: jsonOriginHeaders(),
        body: JSON.stringify({ email })
      });
      assert.equal(res4.status, 429);
      const data4 = await res4.json();
      assert.equal(data4.error, 'Too many resend requests. Please wait before trying again.');
    });

    it('rate-limits public password resets and does not expose email existence', async () => {
      const { requestPasswordReset } = require('../src/features/auth/actions');
      const email = 'reset-rate-limit-test@example.test';

      // 1. Reset 1
      const res1 = await requestPasswordReset({ email });
      assert.equal(res1.success, true);

      // 2. Reset 2
      const res2 = await requestPasswordReset({ email });
      assert.equal(res2.success, true);

      // 3. Reset 3
      const res3 = await requestPasswordReset({ email });
      assert.equal(res3.success, true);

      // 4. Reset 4 (exceeds rate limit)
      const res4 = await requestPasswordReset({ email });
      assert.equal(res4.success, false);
      assert.equal(res4.error, 'Too many password reset requests. Please wait before trying again.');
    });

    it('email sending error sanitization redacts secrets', async () => {
      const { sanitizeError } = require('../src/shared/email/sendEmail');
      const apiKeyValue = 're_1234567890abcdef1234567890';
      const originalApiKey = process.env.RESEND_API_KEY;
      process.env.RESEND_API_KEY = apiKeyValue;

      try {
        const testError = new Error(`Failed to authenticate using key ${apiKeyValue} or bearer token Bearer abc.def.ghi`);
        (testError as any).apiKey = apiKeyValue;
        (testError as any).someUrl = `https://api.resend.com/emails?token=abcdef123456`;

        const sanitized = sanitizeError(testError);
        assert.ok(sanitized instanceof Error);
        assert.ok(!sanitized.message.includes(apiKeyValue));
        assert.ok(sanitized.message.includes('[REDACTED]'));
        assert.ok(!sanitized.stack.includes(apiKeyValue));
        assert.equal(sanitized.apiKey, '[REDACTED]');
      assert.ok(!sanitized.someUrl.includes('abcdef123456'));
        assert.ok(sanitized.someUrl.includes('[REDACTED]'));
      } finally {
        process.env.RESEND_API_KEY = originalApiKey;
      }
    });
  });

  describe('production readiness security pass', () => {
    it('requires MONGODB_URI and AUTH_SECRET in production mode', () => {
      const originalNodeEnv = process.env.NODE_ENV;
      const originalMongoUri = process.env.MONGODB_URI;
      const originalAuthSecret = process.env.AUTH_SECRET;
      const originalNextAuthSecret = process.env.NEXTAUTH_SECRET;
      const originalNextAuthUrl = process.env.NEXTAUTH_URL;
      const originalAppUrl = process.env.APP_URL;
      const originalCorsAllowedOrigins = process.env.CORS_ALLOWED_ORIGINS;
      const originalVideoStorage = process.env.VIDEO_STORAGE;
      const mutableEnv = process.env as Record<string, string | undefined>;

      try {
        delete process.env.MONGODB_URI;
        delete process.env.AUTH_SECRET;
        delete process.env.NEXTAUTH_SECRET;
        delete process.env.NEXTAUTH_URL;
        delete process.env.APP_URL;
        delete process.env.CORS_ALLOWED_ORIGINS;
        mutableEnv.NODE_ENV = 'production';
        // Ensure VIDEO_STORAGE is a valid enum value so Zod reaches the
        // superRefine production check for MONGODB_URI / AUTH_SECRET.
        process.env.VIDEO_STORAGE = 'local';

        const envFile = path.resolve(__dirname, '../src/server/config/env.ts');
        delete require.cache[envFile];

        assert.throws(() => {
          require('../src/server/config/env');
        }, /MONGODB_URI must be set in production mode|AUTH_SECRET or NEXTAUTH_SECRET must be set in production mode|NEXTAUTH_URL must be set in production mode|APP_URL must be set in production mode|CORS_ALLOWED_ORIGINS must be set in production mode/);
      } finally {
        mutableEnv.NODE_ENV = originalNodeEnv;
        if (originalMongoUri !== undefined) process.env.MONGODB_URI = originalMongoUri;
        else delete process.env.MONGODB_URI;
        if (originalAuthSecret !== undefined) process.env.AUTH_SECRET = originalAuthSecret;
        else delete process.env.AUTH_SECRET;
        if (originalNextAuthSecret !== undefined) process.env.NEXTAUTH_SECRET = originalNextAuthSecret;
        else delete process.env.NEXTAUTH_SECRET;
        if (originalNextAuthUrl !== undefined) process.env.NEXTAUTH_URL = originalNextAuthUrl;
        else delete process.env.NEXTAUTH_URL;
        if (originalAppUrl !== undefined) process.env.APP_URL = originalAppUrl;
        else delete process.env.APP_URL;
        if (originalCorsAllowedOrigins !== undefined) process.env.CORS_ALLOWED_ORIGINS = originalCorsAllowedOrigins;
        else delete process.env.CORS_ALLOWED_ORIGINS;
        if (originalVideoStorage !== undefined) process.env.VIDEO_STORAGE = originalVideoStorage;
        else delete process.env.VIDEO_STORAGE;

        const envFile = path.resolve(__dirname, '../src/server/config/env.ts');
        delete require.cache[envFile];
      }
    });

    it('blocks cross-site mutating requests while allowing no-origin bearer API calls', async () => {
      const student = await User.create({
        name: 'Origin Guard Student',
        email: 'origin-guard-student@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT]
      });
      const course = await Course.create({
        title: 'Origin Guard Course',
        description: 'Course used to verify mutating request origin enforcement.',
        price: 0,
        category: 'policy',
        lessonsCount: 0,
        publishStatus: 'published',
        approvalStatus: 'approved'
      });

      const blocked = await fetch(`${baseUrl}/api/users/enroll`, {
        method: 'POST',
        headers: {
          ...authHeaderFor(student, [PERMISSIONS.ENROLL_COURSE]),
          'Content-Type': 'application/json',
          Origin: 'https://evil.example'
        },
        body: JSON.stringify({ courseId: course._id.toString() })
      });
      assert.equal(blocked.status, 403);
      assert.deepEqual(await blocked.json(), { error: 'Invalid request origin.' });

      const allowed = await fetch(`${baseUrl}/api/users/enroll`, {
        method: 'POST',
        headers: {
          ...authHeaderFor(student, [PERMISSIONS.ENROLL_COURSE]),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ courseId: course._id.toString() })
      });
      assert.equal(allowed.status, 200);
    });

    it('rate-limits and validates public client log ingestion', async () => {
      const invalid = await fetch(`${baseUrl}/api/client-logs`, {
        method: 'POST',
        headers: jsonOriginHeaders(),
        body: JSON.stringify({ level: 'invalid', message: '' })
      });
      assert.equal(invalid.status, 400);
      const invalidBody = await invalid.json();
      assert.equal(invalidBody.error, 'Invalid request.');

      for (let i = 0; i < 29; i++) {
        const res = await fetch(`${baseUrl}/api/client-logs`, {
          method: 'POST',
          headers: jsonOriginHeaders(),
          body: JSON.stringify({
            level: 'warn',
            message: `client log ${i}`,
            meta: { token: 'secret-token', nested: { authorization: 'Bearer abc.def.ghi' } },
            url: 'https://app.example/path?token=secret-token'
          })
        });
        assert.equal(res.status, 204);
      }

      const limited = await fetch(`${baseUrl}/api/client-logs`, {
        method: 'POST',
        headers: jsonOriginHeaders(),
        body: JSON.stringify({ level: 'warn', message: 'rate limited' })
      });
      assert.equal(limited.status, 429);
    });

    it('rate-limits public auth endpoint /api/users/verify-email at the Express layer', async () => {
      // Make 10 requests which should return 400
      for (let i = 0; i < 10; i++) {
        const res = await fetch(`${baseUrl}/api/users/verify-email`, {
          method: 'POST',
          headers: jsonOriginHeaders(),
          body: JSON.stringify({ token: '' })
        });
        assert.equal(res.status, 400);
      }

      // 11th request should return 429
      const res429 = await fetch(`${baseUrl}/api/users/verify-email`, {
        method: 'POST',
        headers: jsonOriginHeaders(),
        body: JSON.stringify({ token: '' })
      });
      assert.equal(res429.status, 429);
      const body = await res429.json();
      assert.equal(body.error, 'Too many authentication attempts. Please try again later.');
    });

    it('validates quiz submission inputs using Zod on the Express layer', async () => {
      const student = await User.create({
        name: 'Quiz Student',
        email: 'quiz-student@example.test',
        password: await bcrypt.hash('password123', 12),
        role: USER_ROLES.STUDENT,
        roles: [USER_ROLES.STUDENT]
      });

      const res = await fetch(`${baseUrl}/api/quiz/660000000000000000000000/submit`, {
        method: 'POST',
        headers: {
          ...authHeaderFor(student),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ answers: 'invalid-payload' })
      });

      assert.equal(res.status, 400);
      const body = await res.json();
      assert.ok(body.error);
    });
  });
});

function authHeaderFor(
  user: { _id: { toString(): string }; email: string; role: string; roles: string[] },
  permissions = [PERMISSIONS.MANAGE_USERS]
) {
  return { Authorization: `Bearer ${signApiToken(user, permissions)}` };
}

function jsonOriginHeaders(extra: Record<string, string> = {}) {
  return { 'Content-Type': 'application/json', Origin: 'http://localhost:3000', ...extra };
}

function signApiToken(
  user: { _id: { toString(): string }; email: string; role: string; roles: string[] },
  permissions = [PERMISSIONS.MANAGE_USERS]
) {
  return jwt.sign(
    {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      roles: user.roles,
      permissions,
      tokenUse: 'api'
    },
    process.env.AUTH_SECRET,
    {
      subject: user._id.toString(),
      issuer: 'next-auth',
      audience: 'express-api',
      expiresIn: '5m'
    }
  );
}

function getSystemMongoBinary() {
  const candidates = [
    process.env.MONGOMS_SYSTEM_BINARY,
  ].filter((candidate): candidate is string => typeof candidate === 'string' && candidate.length > 0);

  // Scan Windows Program Files directories
  const serverPath = 'C:\\Program Files\\MongoDB\\Server';
  if (fs.existsSync(serverPath)) {
    try {
      const versions = fs.readdirSync(serverPath);
      for (const version of versions) {
        const binaryPath = path.join(serverPath, version, 'bin', 'mongod.exe');
        if (fs.existsSync(binaryPath)) {
          candidates.push(binaryPath);
        }
      }
    } catch (e) {}
  }

  // Check PATH command
  try {
    const whichCmd = process.platform === 'win32' ? 'where mongod' : 'which mongod';
    const pathBinary = execSync(whichCmd, { stdio: [] }).toString().trim().split('\n')[0].trim();
    if (pathBinary && fs.existsSync(pathBinary)) {
      candidates.push(pathBinary);
    }
  } catch (e) {}

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function withDatabaseName(uri: string, dbName: string) {
  const parsed = new URL(uri);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

export {};
