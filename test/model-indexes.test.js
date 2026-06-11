const assert = require('node:assert/strict');
const { before, after, describe, it } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { execSync } = require('node:child_process');
const mongoose = require('mongoose');

Object.assign(process.env, {
  NODE_ENV: 'test',
  MONGOMS_DOWNLOAD_DIR: path.join(__dirname, '.mongodb-binaries'),
  LOG_LEVEL: 'silent'
});

const { MongoMemoryServer } = require('mongodb-memory-server');

const {
  Assignment,
  AssignmentSubmission,
  AuditLog,
  CertificateIssuance,
  Cohort,
  CohortMembership,
  Course,
  CourseModule,
  CourseResource,
  Enrollment,
  Lesson,
  Notification,
  Progress,
  QuizSubmission
} = require('../src/server/models');

let mongoServer;

const ids = {
  user: new mongoose.Types.ObjectId(),
  otherUser: new mongoose.Types.ObjectId(),
  course: new mongoose.Types.ObjectId(),
  lesson: new mongoose.Types.ObjectId()
};

before(async () => {
  const testMongoUri = process.env.TEST_MONGODB_URI
    ? withDatabaseName(process.env.TEST_MONGODB_URI, 'model_indexes')
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

  await mongoose.connection.db.dropDatabase();

  await Promise.all([
    Course.syncIndexes(),
    Assignment.syncIndexes(),
    AssignmentSubmission.syncIndexes(),
    AuditLog.syncIndexes(),
    Cohort.syncIndexes(),
    CohortMembership.syncIndexes(),
    CourseModule.syncIndexes(),
    CourseResource.syncIndexes(),
    CertificateIssuance.syncIndexes(),
    Enrollment.syncIndexes(),
    Lesson.syncIndexes(),
    Notification.syncIndexes(),
    Progress.syncIndexes(),
    QuizSubmission.syncIndexes()
  ]);

  await seedPlannerData();
});

after(async () => {
  await mongoose.disconnect();
  if (mongoServer) {
    await mongoServer.stop();
  }
});

describe('model query indexes', () => {
  it('uses the unique user/lesson progress index for progress updates', async () => {
    const explain = await Progress.findOne({
      userId: ids.user,
      lessonId: ids.lesson
    }).explain('executionStats');

    assertUsesIndex(explain, 'userId_1_lessonId_1');
  });

  it('uses the user/course progress index for course progress lookups', async () => {
    const explain = await Progress.find({
      userId: ids.user,
      courseId: ids.course
    }).explain('executionStats');

    assertUsesIndex(explain, 'userId_1_courseId_1');
  });

  it('uses the published lesson ordering index for learner lesson lists', async () => {
    const explain = await Lesson.find({
      courseId: ids.course,
      isPublished: true
    })
      .sort({ order: 1 })
      .explain('executionStats');

    assertUsesIndex(explain, 'courseId_1_isPublished_1_order_1');
    assertNoBlockingSort(explain);
  });

  it('uses the course lesson ordering index for lesson management lists', async () => {
    const explain = await Lesson.find({ courseId: ids.course })
      .sort({ order: 1 })
      .explain('executionStats');

    assertUsesIndex(explain, 'courseId_1_order_1');
    assertNoBlockingSort(explain);
  });

  it('uses the quiz submission index for latest-attempt lookups', async () => {
    const explain = await QuizSubmission.findOne({
      userId: ids.user,
      courseId: ids.course
    })
      .sort({ createdAt: -1 })
      .explain('executionStats');

    assertUsesIndex(explain, 'userId_1_courseId_1_createdAt_-1');
    assertNoBlockingSort(explain);
  });

  it('uses enrollment indexes for dashboard and enrollment mutation lookups', async () => {
    const userEnrollmentExplain = await Enrollment.find({ userId: ids.user }).explain('executionStats');
    const userCourseEnrollmentExplain = await Enrollment.findOne({
      userId: ids.user,
      courseId: ids.course
    }).explain('executionStats');

    assertUsesIndex(userEnrollmentExplain, 'userId_1');
    assertUsesIndex(userCourseEnrollmentExplain, 'userId_1_courseId_1');
  });

  it('uses the course createdAt index for course listing sort order', async () => {
    const explain = await Course.find()
      .sort({ createdAt: -1 })
      .explain('executionStats');

    assertUsesIndex(explain, 'createdAt_-1');
    assertNoBlockingSort(explain);
  });

  it('uses certificate issuance indexes for verification and first-download idempotency', async () => {
    await CertificateIssuance.create({
      certificateId: 'cert-index-check',
      userId: ids.user,
      courseId: ids.course,
      recipientName: 'Index Check',
      courseTitle: 'Course 0',
      issuedAt: new Date()
    });

    const verificationExplain = await CertificateIssuance.findOne({
      certificateId: 'cert-index-check'
    }).explain('executionStats');
    const idempotencyExplain = await CertificateIssuance.findOne({
      userId: ids.user,
      courseId: ids.course
    }).explain('executionStats');

    assertUsesIndex(verificationExplain, 'certificateId_1');
    assertUsesIndex(idempotencyExplain, 'userId_1_courseId_1');
  });

  it('uses notification indexes for notification inbox reads', async () => {
    await Notification.create({
      userId: ids.user,
      type: 'course',
      title: 'Index Check',
      message: 'Notification index check'
    });

    const inboxExplain = await Notification.find({ userId: ids.user })
      .sort({ createdAt: -1 })
      .explain('executionStats');
    const unreadExplain = await Notification.find({
      userId: ids.user,
      readAt: { $exists: false }
    }).explain('executionStats');

    assertUsesIndex(inboxExplain, 'userId_1_createdAt_-1');
    assertNoBlockingSort(inboxExplain);
    assertUsesIndex(unreadExplain, 'userId_1_readAt_1');
  });

  it('uses LMS governance indexes for modules, cohorts, resources, and audit logs', async () => {
    const moduleExplain = await CourseModule.find({ courseId: ids.course }).sort({ order: 1 }).explain('executionStats');
    const resourceExplain = await CourseResource.find({ courseId: ids.course, moduleId: ids.lesson }).explain('executionStats');
    const cohortExplain = await Cohort.find({ status: 'active' }).sort({ startsAt: -1 }).explain('executionStats');
    const membershipExplain = await CohortMembership.find({ cohortId: ids.course, userId: ids.user }).explain('executionStats');
    const auditExplain = await AuditLog.find({ entityType: 'Course', entityId: ids.course.toString() })
      .sort({ createdAt: -1 })
      .explain('executionStats');
    const assignmentExplain = await Assignment.find({ courseId: ids.course, status: 'published' })
      .sort({ dueAt: 1 })
      .explain('executionStats');
    const assignmentSubmissionExplain = await AssignmentSubmission.find({ courseId: ids.course, status: 'submitted' })
      .sort({ updatedAt: -1 })
      .explain('executionStats');

    assertUsesIndex(moduleExplain, 'courseId_1_order_1');
    assertUsesIndex(resourceExplain, 'courseId_1_moduleId_1');
    assertUsesIndex(cohortExplain, 'status_1_startsAt_-1');
    assertUsesIndex(membershipExplain, 'cohortId_1_userId_1');
    assertUsesIndex(auditExplain, 'entityType_1_entityId_1_createdAt_-1');
    assertUsesIndex(assignmentExplain, 'courseId_1_status_1_dueAt_1');
    assertUsesIndex(assignmentSubmissionExplain, 'courseId_1_status_1_updatedAt_-1');
  });
});

async function seedPlannerData() {
  const courseDocs = [];
  const lessonDocs = [];
  const progressDocs = [];
  const enrollmentDocs = [];
  const quizSubmissionDocs = [];

  for (let index = 0; index < 200; index += 1) {
    const courseId = index < 100 ? ids.course : new mongoose.Types.ObjectId();
    const userId = index % 10 === 0 ? ids.user : new mongoose.Types.ObjectId();
    const lessonId = index === 0 ? ids.lesson : new mongoose.Types.ObjectId();

    courseDocs.push({
      _id: courseId,
      title: `Course ${index}`,
      description: `Course description ${index}`,
      price: 0,
      category: index % 2 === 0 ? 'climate' : 'policy',
      lessonsCount: 1,
      createdAt: new Date(Date.UTC(2026, 0, index + 1)),
      updatedAt: new Date(Date.UTC(2026, 0, index + 1))
    });

    lessonDocs.push({
      _id: lessonId,
      courseId,
      title: `Lesson ${index}`,
      description: `Lesson description ${index}`,
      order: index,
      videoUrl: `/videos/${index}.mp4`,
      duration: 120,
      isPublished: index % 4 !== 0
    });

    progressDocs.push({
      userId,
      courseId,
      lessonId,
      watchedSeconds: index,
      duration: 120,
      completed: index % 2 === 0,
      lastWatchedAt: new Date(Date.UTC(2026, 1, index + 1))
    });

    enrollmentDocs.push({
      userId,
      courseId,
      completed: index % 5 === 0
    });

    quizSubmissionDocs.push({
      userId,
      courseId,
      answers: [{ questionId: `q-${index}`, selectedOptionIndex: 0 }],
      score: index,
      totalQuestions: 100,
      passed: index % 2 === 0,
      createdAt: new Date(Date.UTC(2026, 2, index + 1)),
      updatedAt: new Date(Date.UTC(2026, 2, index + 1))
    });
  }

  await Course.insertMany(uniqueById(courseDocs));
  await Lesson.insertMany(lessonDocs);
  await Progress.insertMany(progressDocs);
  await Enrollment.insertMany(uniqueByUserCourse(enrollmentDocs));
  await QuizSubmission.insertMany(quizSubmissionDocs);
  await CourseModule.create({ courseId: ids.course, title: 'Module 1', order: 0, isPublished: true });
  await CourseResource.create({ courseId: ids.course, moduleId: ids.lesson, title: 'Resource 1', url: '/resource.pdf', isPublished: true });
  const assignment = await Assignment.create({ courseId: ids.course, title: 'Assignment 1', status: 'published', dueAt: new Date() });
  await AssignmentSubmission.create({ assignmentId: assignment._id, courseId: ids.course, learnerId: ids.user, text: 'Evidence', status: 'submitted' });
  await Cohort.create({ _id: ids.course, title: 'Cohort 1', status: 'active', startsAt: new Date() });
  await CohortMembership.create({ cohortId: ids.course, userId: ids.user, status: 'active' });
  await AuditLog.create({ action: 'course.approve', entityType: 'Course', entityId: ids.course.toString() });
}

function getSystemMongoBinary() {
  const candidates = [
    process.env.MONGOMS_SYSTEM_BINARY
  ].filter((candidate) => typeof candidate === 'string' && candidate.length > 0);

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
    } catch (error) {}
  }

  try {
    const whichCommand = process.platform === 'win32' ? 'where mongod' : 'which mongod';
    const pathBinary = execSync(whichCommand, { stdio: [] }).toString().trim().split('\n')[0].trim();
    if (pathBinary && fs.existsSync(pathBinary)) {
      candidates.push(pathBinary);
    }
  } catch (error) {}

  return candidates.find((candidate) => fs.existsSync(candidate));
}

function withDatabaseName(uri, dbName) {
  const parsed = new URL(uri);
  parsed.pathname = `/${dbName}`;
  return parsed.toString();
}

function uniqueById(docs) {
  return [...new Map(docs.map((doc) => [doc._id.toString(), doc])).values()];
}

function uniqueByUserCourse(docs) {
  return [
    ...new Map(docs.map((doc) => [`${doc.userId.toString()}:${doc.courseId.toString()}`, doc])).values()
  ];
}

function assertUsesIndex(explain, indexName) {
  const indexNames = collectExplainValues(getWinningPlan(explain), 'indexName');

  assert.ok(
    indexNames.includes(indexName),
    `Expected ${indexName} in winning plan indexes, got: ${indexNames.join(', ') || 'none'}`
  );
}

function assertNoBlockingSort(explain) {
  const stages = collectExplainValues(getWinningPlan(explain), 'stage');

  assert.ok(!stages.includes('SORT'), `Expected no blocking SORT stage, got stages: ${stages.join(', ')}`);
}

function getWinningPlan(explain) {
  return explain.queryPlanner?.winningPlan;
}

function collectExplainValues(value, key) {
  const found = [];

  visit(value);
  return found;

  function visit(current) {
    if (!current || typeof current !== 'object') {
      return;
    }

    if (Object.prototype.hasOwnProperty.call(current, key)) {
      found.push(current[key]);
    }

    for (const child of Object.values(current)) {
      if (Array.isArray(child)) {
        child.forEach(visit);
      } else {
        visit(child);
      }
    }
  }
}
