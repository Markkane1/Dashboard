import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/server/server';
import Course from '../../src/server/models/Course';
import Lesson from '../../src/server/models/Lesson';
import Progress from '../../src/server/models/Progress';
import Enrollment from '../../src/server/models/Enrollment';
import QuizSubmission from '../../src/server/models/QuizSubmission';
import CertificateIssuance from '../../src/server/models/CertificateIssuance';
import User from '../../src/server/models/User';
import { connectDB, disconnectDB, clearDB, generateToken } from './setup';

jest.mock('../../src/server/services/audit', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(true)
}));

describe('Progress and Quiz API Integration Tests', () => {
  let studentUser: any;
  let studentToken: string;
  let testCourse: any;
  let testLesson1: any;
  let testLesson2: any;

  beforeAll(async () => {
    await connectDB();
  }, 20000);

  afterAll(async () => {
    await disconnectDB();
  }, 20000);

  beforeEach(async () => {
    await clearDB();

    studentUser = await User.create({
      name: 'Jane Learner',
      email: 'jane@example.com',
      password: 'password123',
      role: 'student',
      status: 'active'
    });

    testCourse = await Course.create({
      title: 'Global Climate Science',
      description: 'Understanding international ecology standards',
      category: 'Ecology',
      publishStatus: 'published',
      approvalStatus: 'approved',
      status: 'published',
      quizPassingScore: 70,
      quizMaxAttempts: 3,
      quizRandomizeQuestions: false,
      requiresCertificateApproval: false
    });

    testLesson1 = await Lesson.create({
      courseId: testCourse._id,
      title: 'Lesson 1: Greenhouse Gases',
      description: 'Introduction to emissions',
      order: 1,
      duration: 100,
      isPublished: true,
      completionMode: 'video_progress'
    });

    testLesson2 = await Lesson.create({
      courseId: testCourse._id,
      title: 'Lesson 2: Global Warming Solutions',
      description: 'Adaptation strategies',
      order: 2,
      duration: 200,
      isPublished: true,
      completionMode: 'video_progress'
    });

    studentToken = generateToken({ id: studentUser._id.toString(), email: studentUser.email, role: 'student', permissions: [] });
  });

  describe('POST /api/progress', () => {
    it('should return 403 if user is not enrolled in the course (auth case)', async () => {
      await request(app)
        .post('/api/progress')
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          lessonId: testLesson1._id.toString(),
          watchedSeconds: 50
        })
        .expect(403);
    });

    it('should update watchedSeconds and set completed = false if below 90% (happy path success)', async () => {
      await Enrollment.create({
        userId: studentUser._id,
        courseId: testCourse._id,
        completed: false
      });

      const response = await request(app)
        .post('/api/progress')
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          lessonId: testLesson1._id.toString(),
          watchedSeconds: 50
        })
        .expect(200);

      expect(response.body.watchedSeconds).toBe(50);
      expect(response.body.completed).toBe(false);

      // Verify DB mutation
      const progressDb = await Progress.findOne({ userId: studentUser._id, lessonId: testLesson1._id });
      expect(progressDb?.watchedSeconds).toBe(50);
      expect(progressDb?.completed).toBe(false);
    });

    it('should automatically set completed = true if watchedSeconds >= 90% (happy path success)', async () => {
      await Enrollment.create({
        userId: studentUser._id,
        courseId: testCourse._id,
        completed: false
      });

      const response = await request(app)
        .post('/api/progress')
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          lessonId: testLesson1._id.toString(),
          watchedSeconds: 95
        })
        .expect(200);

      expect(response.body.completed).toBe(true);

      const progressDb = await Progress.findOne({ userId: studentUser._id, lessonId: testLesson1._id });
      expect(progressDb?.completed).toBe(true);
    });

    it('should return 400 when lessonId is invalid (validation case)', async () => {
      await request(app)
        .post('/api/progress')
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          lessonId: 'invalid-object-id',
          watchedSeconds: 50
        })
        .expect(400);
    });

    it('should return 400 when watchedSeconds is negative (validation case)', async () => {
      await request(app)
        .post('/api/progress')
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          lessonId: testLesson1._id.toString(),
          watchedSeconds: -5
        })
        .expect(400);
    });

    it('should return 404 when lesson does not exist (not found case)', async () => {
      const nonExistentLessonId = new mongoose.Types.ObjectId().toString();
      await request(app)
        .post('/api/progress')
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          lessonId: nonExistentLessonId,
          watchedSeconds: 50
        })
        .expect(404);
    });
  });

  describe('GET /api/progress/course/:courseId', () => {
    it('should return overall progress summary for enrolled student (happy path)', async () => {
      await Enrollment.create({
        userId: studentUser._id,
        courseId: testCourse._id,
        completed: false
      });

      await Progress.create({
        userId: studentUser._id,
        courseId: testCourse._id,
        lessonId: testLesson1._id,
        watchedSeconds: 95,
        duration: 100,
        completed: true
      });

      const response = await request(app)
        .get(`/api/progress/course/${testCourse._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.progress.length).toBe(1);
      expect(response.body.summary.totalLessons).toBe(2);
      expect(response.body.summary.completedLessons).toBe(1);
      expect(response.body.summary.percentComplete).toBe(50);
    });

    it('should return 403 when user is not enrolled (auth restriction)', async () => {
      await request(app)
        .get(`/api/progress/course/${testCourse._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  describe('GET /api/quiz/:courseId', () => {
    beforeEach(async () => {
      await Enrollment.create({
        userId: studentUser._id,
        courseId: testCourse._id,
        completed: false
      });
    });

    it('should return 403 when not all lessons are completed', async () => {
      const response = await request(app)
        .get(`/api/quiz/${testCourse._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      expect(response.body.error).toBe('Complete all lessons before taking the final quiz.');
    });

    it('should return quiz questions if all lessons are completed (happy path success)', async () => {
      await Progress.create([
        { userId: studentUser._id, courseId: testCourse._id, lessonId: testLesson1._id, watchedSeconds: 100, duration: 100, completed: true },
        { userId: studentUser._id, courseId: testCourse._id, lessonId: testLesson2._id, watchedSeconds: 200, duration: 200, completed: true }
      ]);

      const response = await request(app)
        .get(`/api/quiz/${testCourse._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body.courseTitle).toBe(testCourse.title);
      expect(Array.isArray(response.body.questions)).toBe(true);
      expect(response.body.questions.length).toBe(3); // fallback questions count
      expect(response.body.questions[0].correctAnswerIndex).toBeUndefined(); // verify correct answers are hidden
    });

    it('should return 403 if user has exceeded attempts (attempts exhaustion case)', async () => {
      await Progress.create([
        { userId: studentUser._id, courseId: testCourse._id, lessonId: testLesson1._id, watchedSeconds: 100, duration: 100, completed: true },
        { userId: studentUser._id, courseId: testCourse._id, lessonId: testLesson2._id, watchedSeconds: 200, duration: 200, completed: true }
      ]);

      // Seed 3 failed attempts
      await QuizSubmission.create([
        { userId: studentUser._id, courseId: testCourse._id, score: 30, totalQuestions: 3, passed: false, attemptNumber: 1, answers: [] },
        { userId: studentUser._id, courseId: testCourse._id, score: 30, totalQuestions: 3, passed: false, attemptNumber: 2, answers: [] },
        { userId: studentUser._id, courseId: testCourse._id, score: 30, totalQuestions: 3, passed: false, attemptNumber: 3, answers: [] }
      ]);

      await request(app)
        .get(`/api/quiz/${testCourse._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403, { error: 'Maximum quiz attempts reached.', attemptsRemaining: 0 });
    });
  });

  describe('POST /api/quiz/:courseId/submit', () => {
    beforeEach(async () => {
      await Enrollment.create({
        userId: studentUser._id,
        courseId: testCourse._id,
        completed: false
      });

      await Progress.create([
        { userId: studentUser._id, courseId: testCourse._id, lessonId: testLesson1._id, watchedSeconds: 100, duration: 100, completed: true },
        { userId: studentUser._id, courseId: testCourse._id, lessonId: testLesson2._id, watchedSeconds: 200, duration: 200, completed: true }
      ]);
    });

    it('should grade answers and fail if score is below passing (happy path fail)', async () => {
      const response = await request(app)
        .post(`/api/quiz/${testCourse._id}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          answers: [
            { questionId: 'core-1', selectedOptionIndex: 1 }, // incorrect
            { questionId: 'core-2', selectedOptionIndex: 1 }, // incorrect
            { questionId: 'core-3', selectedOptionIndex: 1 }  // incorrect
          ]
        })
        .expect(200);

      expect(response.body.passed).toBe(false);
      expect(response.body.score).toBe(0);
      expect(response.body.attemptsRemaining).toBe(2);

      const enroll = await Enrollment.findOne({ userId: studentUser._id, courseId: testCourse._id });
      expect(enroll?.completed).toBe(false);
    });

    it('should grade answers, pass user, and auto-complete enrollment & generate certificate (happy path pass success)', async () => {
      const response = await request(app)
        .post(`/api/quiz/${testCourse._id}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          answers: [
            { questionId: 'core-1', selectedOptionIndex: 0 }, // correct
            { questionId: 'core-2', selectedOptionIndex: 0 }, // correct
            { questionId: 'core-3', selectedOptionIndex: 0 }  // correct
          ]
        })
        .expect(200);

      expect(response.body.passed).toBe(true);
      expect(response.body.score).toBe(100);

      // Verify Enrollment completion mutation in DB
      const enroll = await Enrollment.findOne({ userId: studentUser._id, courseId: testCourse._id });
      expect(enroll?.completed).toBe(true);
      expect(enroll?.completedAt).toBeDefined();

      // Verify CertificateIssuance generated since course has requiresCertificateApproval = false
      const cert = await CertificateIssuance.findOne({ userId: studentUser._id, courseId: testCourse._id });
      expect(cert).toBeDefined();
      expect(cert?.approvalStatus).toBe('approved');
    });

    it('should return 400 when answers structure is wrong (validation case)', async () => {
      await request(app)
        .post(`/api/quiz/${testCourse._id}/submit`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          answers: 'wrong-type-string'
        })
        .expect(400);
    });
  });

  describe('Database Error Simulation (500)', () => {
    it('should return 500 when saving progress fails', async () => {
      await Enrollment.create({
        userId: studentUser._id,
        courseId: testCourse._id,
        completed: false
      });

      const spy = jest.spyOn(Progress.prototype, 'save').mockImplementation(() => {
        throw new Error('Mongoose write error');
      });

      await request(app)
        .post('/api/progress')
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          lessonId: testLesson1._id.toString(),
          watchedSeconds: 50
        })
        .expect(500, { error: 'Internal server error occurred while updating playback progress.' });

      spy.mockRestore();
    });

    it('should return 500 when quiz database loading fails', async () => {
      const spy = jest.spyOn(Course, 'findById').mockImplementation(() => {
        throw new Error('Mongoose read error');
      });

      await request(app)
        .get(`/api/quiz/${testCourse._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(500, { error: 'Failed to fetch quiz.' });

      spy.mockRestore();
    });
  });
});
