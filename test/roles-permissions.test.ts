const assert = require('node:assert/strict');
const { after, before, describe, it } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const { execSync } = require('child_process');

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
  const systemBinary = getSystemMongoBinary();
  if (systemBinary) {
    mongoServer = await MongoMemoryServer.create({
      binary: {
        systemBinary
      }
    });
    await mongoose.connect(mongoServer.getUri());
  } else {
    const fallbackUri = process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/test_roles_permissions';
    console.warn(`[TEST] No MongoDB system binary found for memory server. Falling back to local MongoDB at: ${fallbackUri}`);
    await mongoose.connect(fallbackUri);
  }
  await Role.ensureDefaultRoles();

  server = app.listen(0);
  await new Promise<void>((resolve) => server.once('listening', resolve));
  const address = server.address();
  assert.ok(address && typeof address === 'object');
  baseUrl = `http://127.0.0.1:${address.port}`;
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
    assert.equal(roleAudit?.userAgent, 'audit-test-agent');

    assert.equal(quizAudit?.details.result, 'success');
    assert.equal(quizAudit?.details.oldValue.quizQuestions[0].correctAnswerIndex, 0);
    assert.equal(quizAudit?.details.newValue.quizQuestions[0].correctAnswerIndex, 1);

    assert.equal(resetAudit?.details.result, 'success');
    assert.equal(resetAudit?.details.targetEmail, learner.email);
    assert.equal(resetAudit?.details.newValue.passwordResetIssued, true);
    assert.ok(resetAudit?.details.newValue.passwordResetExpires);

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
        recipientName: 'Valid Student',
        courseTitle: 'Safe Fields Course',
        issuedAt: issuedAt.toISOString(),
        revokedAt: null,
        status: 'valid'
      });

      // Assert internal fields are not exposed
      assert.equal(body.userId, undefined);
      assert.equal(body.courseId, undefined);
      assert.equal(body.serialNumber, undefined);
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
        recipientName: 'Revoked Student',
        courseTitle: 'Revocation Test Course',
        issuedAt: issuedAt.toISOString(),
        revokedAt: revokedAt.toISOString(),
        status: 'revoked'
      });

      // Assert internal fields are not exposed
      assert.equal(body.userId, undefined);
      assert.equal(body.courseId, undefined);
      assert.equal(body.serialNumber, undefined);
      assert.equal(body._id, undefined);
      assert.equal(body.revocationReason, undefined);
    });

    it('verifies a non-existent certificate returning safe empty/not_found payload', async () => {
      const response = await fetch(`${baseUrl}/api/certificates/verify/does-not-exist`);
      assert.equal(response.status, 404);

      const body = await response.json();
      assert.deepEqual(body, {
        valid: false,
        certificateId: '',
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
        headers: { 'Content-Type': 'application/json' },
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
        headers: { 'Content-Type': 'application/json' },
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
});

function authHeaderFor(
  user: { _id: { toString(): string }; email: string; role: string; roles: string[] },
  permissions = [PERMISSIONS.MANAGE_USERS]
) {
  return { Authorization: `Bearer ${signApiToken(user, permissions)}` };
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

export {};
