const assert = require('node:assert/strict');
const { before, after, describe, it } = require('node:test');
const path = require('node:path');
const mongoose = require('mongoose');

process.env.MONGOMS_DOWNLOAD_DIR = path.join(__dirname, '.mongodb-binaries');

const { MongoMemoryServer } = require('mongodb-memory-server');

const { Course, Enrollment, Lesson, Progress, QuizSubmission } = require('../src/server/models');

let mongoServer;

const ids = {
  user: new mongoose.Types.ObjectId(),
  otherUser: new mongoose.Types.ObjectId(),
  course: new mongoose.Types.ObjectId(),
  lesson: new mongoose.Types.ObjectId()
};

before(async () => {
  mongoServer = await MongoMemoryServer.create();
  await mongoose.connect(mongoServer.getUri());

  await Promise.all([
    Course.syncIndexes(),
    Enrollment.syncIndexes(),
    Lesson.syncIndexes(),
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
  const indexNames = collectExplainValues(explain, 'indexName');

  assert.ok(
    indexNames.includes(indexName),
    `Expected ${indexName} in winning plan indexes, got: ${indexNames.join(', ') || 'none'}`
  );
}

function assertNoBlockingSort(explain) {
  const stages = collectExplainValues(explain, 'stage');

  assert.ok(!stages.includes('SORT'), `Expected no blocking SORT stage, got stages: ${stages.join(', ')}`);
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
