import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/server/server';
import Course from '../../src/server/models/Course';
import Lesson from '../../src/server/models/Lesson';
import User from '../../src/server/models/User';
import Enrollment from '../../src/server/models/Enrollment';
import Progress from '../../src/server/models/Progress';
import AuditLog from '../../src/server/models/AuditLog';
import CourseFeedback from '../../src/server/models/CourseFeedback';
import Notification from '../../src/server/models/Notification';
import Role from '../../src/server/models/Role';
import Taxonomy from '../../src/server/models/Taxonomy';
import { connectDB, disconnectDB, clearDB, generateToken } from './setup';

// Mock audit logging
jest.mock('../../src/server/services/audit', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(true)
}));

// Mock video storage provider
jest.mock('../../src/server/services/videoStorage', () => {
  return {
    getVideoStorageKey: jest.fn().mockImplementation((url) => url),
    isRemoteVideoUrl: jest.fn().mockImplementation((url) => url.startsWith('http')),
    VideoStorageNotImplementedError: Error,
    videoStorageProvider: {
      exists: jest.fn().mockResolvedValue(true),
      getStream: jest.fn().mockImplementation(() => {
        const { Readable } = require('stream');
        return Promise.resolve({
          status: 206,
          contentType: 'video/mp4',
          contentLength: 16,
          acceptRanges: 'bytes',
          contentRange: 'bytes 0-15/16',
          stream: Readable.from(['mock video chunk'])
        });
      })
    }
  };
});

describe('System APIs Integration Tests', () => {
  let adminToken: string;
  let managerToken: string;
  let studentToken: string;
  let studentUser: any;
  let testCourse: any;
  let testLesson: any;

  beforeAll(async () => {
    await connectDB();
  }, 20000);

  afterAll(async () => {
    await disconnectDB();
  }, 20000);

  beforeEach(async () => {
    await clearDB();

    studentUser = await User.create({
      name: 'Bob System',
      email: 'bob@example.com',
      password: 'password123',
      role: 'student',
      status: 'active'
    });

    testCourse = await Course.create({
      title: 'System Science',
      description: 'Understanding systems',
      category: 'Science',
      publishStatus: 'published',
      approvalStatus: 'approved',
      status: 'published'
    });

    testLesson = await Lesson.create({
      courseId: testCourse._id,
      title: 'System Lesson 1',
      order: 1,
      duration: 100,
      isPublished: true,
      videoUrl: 'local-video-file.mp4'
    });

    adminToken = generateToken({ email: 'admin@epa.gov', role: 'admin', permissions: ['users:manage', 'audit-logs:view', 'notifications:announce', 'taxonomies:manage', 'analytics:view'] });
    managerToken = generateToken({ email: 'manager@epa.gov', role: 'instructor', permissions: ['analytics:view'] });
    studentToken = generateToken({ id: studentUser._id.toString(), email: studentUser.email, role: 'student', permissions: [] });

    // Configure mocks that get reset by resetMocks
    const videoStorage = require('../../src/server/services/videoStorage');
    videoStorage.videoStorageProvider.exists.mockResolvedValue(true);
    videoStorage.videoStorageProvider.getStream.mockImplementation(() => {
      const { Readable } = require('stream');
      return Promise.resolve({
        status: 206,
        contentType: 'video/mp4',
        contentLength: 16,
        acceptRanges: 'bytes',
        contentRange: 'bytes 0-15/16',
        stream: Readable.from(['mock video chunk'])
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                              ANALYTICS TESTS                               */
  /* -------------------------------------------------------------------------- */
  describe('Analytics APIs (/api/analytics)', () => {
    it('should retrieve overall platform-wide analytics overview (happy path)', async () => {
      const response = await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('users');
      expect(response.body).toHaveProperty('courses');
      expect(response.body).toHaveProperty('enrollments');
    });

    it('should retrieve course-specific analytics successfully (happy path)', async () => {
      const response = await request(app)
        .get(`/api/analytics/courses/${testCourse._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.courseId).toBe(testCourse._id.toString());
      expect(response.body.title).toBe(testCourse.title);
    });

    it('should return 403 when lacks analytics:view permission', async () => {
      await request(app)
        .get('/api/analytics/overview')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                              AUDIT LOGS TESTS                              */
  /* -------------------------------------------------------------------------- */
  describe('Audit Logs APIs (/api/audit-logs)', () => {
    it('should retrieve system audit logs (happy path)', async () => {
      await AuditLog.create({
        actorId: studentUser._id,
        actorEmail: studentUser.email,
        actorRole: studentUser.role,
        action: 'test.action',
        entityType: 'Test',
        entityId: '123'
      });

      const response = await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].action).toBe('test.action');
    });

    it('should return 403 for student user lacking permission', async () => {
      await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                                FEEDBACK TESTS                              */
  /* -------------------------------------------------------------------------- */
  describe('Feedback APIs (/api/feedback)', () => {
    beforeEach(async () => {
      await Enrollment.create({
        userId: studentUser._id,
        courseId: testCourse._id,
        completed: false
      });
    });

    it('should submit/update course feedback successfully (happy path)', async () => {
      const response = await request(app)
        .post(`/api/feedback/course/${testCourse._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          rating: 4,
          comments: 'Great class!'
        })
        .expect(201);

      expect(response.body.rating).toBe(4);
      expect(response.body.comments).toBe('Great class!');

      // Check DB mutation
      const feedbackDb = await CourseFeedback.findOne({ userId: studentUser._id, courseId: testCourse._id });
      expect(feedbackDb?.rating).toBe(4);
    });

    it('should return 400 when rating is out of bounds (validation)', async () => {
      await request(app)
        .post(`/api/feedback/course/${testCourse._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          rating: 6
        })
        .expect(400);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                             NOTIFICATIONS TESTS                            */
  /* -------------------------------------------------------------------------- */
  describe('Notifications APIs (/api/notifications)', () => {
    let testNotification: any;

    beforeEach(async () => {
      testNotification = await Notification.create({
        userId: studentUser._id,
        type: 'info',
        title: 'New Update',
        message: 'System details changed'
      });
    });

    it('should retrieve user notifications (happy path)', async () => {
      const response = await request(app)
        .get('/api/notifications')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe('New Update');
    });

    it('should broadcast an announcement to all users (happy path)', async () => {
      const response = await request(app)
        .post('/api/notifications/announce')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          title: 'Broadcast Announcement',
          message: 'Maintenance scheduled'
        })
        .expect(201);

      expect(response.body.createdCount).toBe(1); // studentUser
    });

    it('should mark notification read successfully (happy path)', async () => {
      const response = await request(app)
        .patch(`/api/notifications/${testNotification._id}/read`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .expect(200);

      expect(response.body.readAt).not.toBeNull();
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                                 ROLES TESTS                                */
  /* -------------------------------------------------------------------------- */
  describe('Roles APIs (/api/roles)', () => {
    it('should retrieve all permission options (happy path)', async () => {
      const response = await request(app)
        .get('/api/roles/permissions')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.some((p: any) => p.id === 'courses:approve')).toBe(true);
    });

    it('should CRUD system roles successfully (happy path)', async () => {
      // 1. Create a custom role
      const createRes = await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          name: 'Junior Admin',
          permissions: ['analytics:view']
        })
        .expect(201);

      expect(createRes.body.name).toBe('Junior Admin');
      expect(createRes.body.key).toBe('junior-admin');

      // 2. Patch details
      const patchRes = await request(app)
        .patch(`/api/roles/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          description: 'Lighter permissions'
        })
        .expect(200);

      expect(patchRes.body.description).toBe('Lighter permissions');

      // 3. Delete role
      await request(app)
        .delete(`/api/roles/${createRes.body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      // Verify DB delete
      const deletedRole = await Role.findById(createRes.body.id);
      expect(deletedRole).toBeNull();
    });

    it('should return 400 when custom role name is missing (validation)', async () => {
      await request(app)
        .post('/api/roles')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          permissions: ['analytics:view']
        })
        .expect(400);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                              TAXONOMIES TESTS                              */
  /* -------------------------------------------------------------------------- */
  describe('Taxonomies APIs (/api/taxonomies)', () => {
    it('should list active taxonomies without auth (happy path)', async () => {
      await Taxonomy.create({
        type: 'category',
        key: 'env',
        label: 'Environment',
        active: true
      });

      const response = await request(app)
        .get('/api/taxonomies')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].key).toBe('env');
    });

    it('should create custom taxonomy successfully (happy path)', async () => {
      const response = await request(app)
        .post('/api/taxonomies')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          type: 'topic',
          key: 'climate',
          label: 'Climate Change'
        })
        .expect(201);

      expect(response.body.key).toBe('climate');

      const taxonomyDb = await Taxonomy.findOne({ key: 'climate' });
      expect(taxonomyDb).toBeDefined();
    });

    it('should return 400 when taxonomy type is missing (validation)', async () => {
      await request(app)
        .post('/api/taxonomies')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          key: 'climate',
          label: 'Climate Change'
        })
        .expect(400);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                             VIDEO STREAM TESTS                             */
  /* -------------------------------------------------------------------------- */
  describe('Video Playback API (/api/video)', () => {
    beforeEach(async () => {
      await Enrollment.create({
        userId: studentUser._id,
        courseId: testCourse._id,
        completed: false
      });
    });

    it('should stream video content for enrolled student (happy path)', async () => {
      const response = await request(app)
        .get(`/api/video/${testLesson._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Range', 'bytes=0-99')
        .expect(206);

      expect(response.headers['content-type']).toBe('video/mp4');
      expect(response.headers['content-range']).toBe('bytes 0-15/16');
    });

    it('should return 403 when not enrolled (auth restriction)', async () => {
      const strangerToken = generateToken({ email: 'stranger@example.com', role: 'student', permissions: [] });
      await request(app)
        .get(`/api/video/${testLesson._id}`)
        .set('Authorization', `Bearer ${strangerToken}`)
        .expect(403);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                             CLIENT LOGGING TESTS                           */
  /* -------------------------------------------------------------------------- */
  describe('Client Logging API (/api/client-logs)', () => {
    it('should accept client logging statements without auth (happy path)', async () => {
      await request(app)
        .post('/api/client-logs')
        .set('Origin', 'http://localhost:3000')
        .send({
          level: 'warn',
          message: 'Client warning message details'
        })
        .expect(204);
    });

    it('should return 400 when log message is missing (validation)', async () => {
      await request(app)
        .post('/api/client-logs')
        .set('Origin', 'http://localhost:3000')
        .send({
          level: 'warn'
        })
        .expect(400);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                           DATABASE ERROR TESTS                             */
  /* -------------------------------------------------------------------------- */
  describe('Database Error Handling (500)', () => {
    it('should return 500 when database audit log listing fails', async () => {
      const spy = jest.spyOn(AuditLog, 'find').mockImplementation(() => {
        throw new Error('Database exception');
      });

      await request(app)
        .get('/api/audit-logs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500, { error: 'Failed to list audit logs.' });

      spy.mockRestore();
    });

    it('should return 500 when feedback database fetch fails', async () => {
      const spy = jest.spyOn(CourseFeedback, 'findOne').mockImplementation(() => {
        throw new Error('Database exception');
      });

      await request(app)
        .get(`/api/feedback/course/${testCourse._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(500, { error: 'Failed to fetch feedback.' });

      spy.mockRestore();
    });
  });
});
