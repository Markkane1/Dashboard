import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/server/server';
import Course from '../../src/server/models/Course';
import { connectDB, disconnectDB, clearDB, generateToken } from './setup';

jest.mock('../../src/server/services/audit', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(true)
}));

describe('Courses API Integration Tests', () => {
  let adminToken: string;
  let studentToken: string;
  let instructorToken: string;
  let testCourse: any;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDB();

    adminToken = generateToken({ email: 'admin@epa.gov', role: 'admin', permissions: ['content:manage', 'courses:approve'] });
    instructorToken = generateToken({ email: 'inst@epa.gov', role: 'instructor', permissions: ['content:manage'] });
    studentToken = generateToken({ email: 'student@epa.gov', role: 'student', permissions: [] });

    // Create a seed course
    testCourse = await Course.create({
      title: 'Environment Science',
      description: 'Introduction to Environment',
      category: 'Science',
      price: 0,
      publishStatus: 'published',
      approvalStatus: 'approved',
      status: 'published'
    });
  });

  describe('GET /api/courses (Public catalog)', () => {
    it('should return paginated list of published courses (happy path)', async () => {
      const response = await request(app)
        .get('/api/courses')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe('Environment Science');
    });
  });

  describe('POST /api/courses/batch (Public)', () => {
    it('should return matching courses for given IDs list (happy path)', async () => {
      const response = await request(app)
        .post('/api/courses/batch')
        .set('Origin', 'http://localhost:3000')
        .send({
          ids: [testCourse._id.toString()]
        })
        .expect(200);

      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe('Environment Science');
    });

    it('should return empty list when ids array is empty or not provided (happy path fallback)', async () => {
      const response = await request(app)
        .post('/api/courses/batch')
        .set('Origin', 'http://localhost:3000')
        .send({})
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });

  describe('POST /api/courses (Create Draft)', () => {
    it('should create a draft course successfully (happy path)', async () => {
      const response = await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${instructorToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          title: 'Climate Policy 101',
          description: 'Basic policies',
          category: 'Policy',
          price: 0
        })
        .expect(201);

      expect(response.body.title).toBe('Climate Policy 101');
      expect(response.body.status).toBe('draft');

      const courseDb = await Course.findOne({ title: 'Climate Policy 101' });
      expect(courseDb).toBeDefined();
      expect(courseDb?.status).toBe('draft');
    });

    it('should return 401 when no token is provided (auth case)', async () => {
      await request(app)
        .post('/api/courses')
        .set('Origin', 'http://localhost:3000')
        .send({
          title: 'Unauthenticated Course',
          description: 'No auth',
          category: 'Test',
          price: 0
        })
        .expect(401);
    });

    it('should return 403 when user does not have content:manage permission (auth role check)', async () => {
      await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          title: 'Unauthorized Course',
          description: 'Student',
          category: 'Test',
          price: 0
        })
        .expect(403);
    });

    it('should return 400 when title is missing (validation case)', async () => {
      await request(app)
        .post('/api/courses')
        .set('Authorization', `Bearer ${instructorToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          description: 'No title',
          category: 'Test',
          price: 0
        })
        .expect(400);
    });
  });

  describe('GET /api/courses/manage (Instructor Access)', () => {
    it('should return courses list for content managers (happy path)', async () => {
      const response = await request(app)
        .get('/api/courses/manage')
        .set('Authorization', `Bearer ${instructorToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 403 for student user (auth restriction)', async () => {
      await request(app)
        .get('/api/courses/manage')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  describe('PATCH /api/courses/:id (Update Course)', () => {
    it('should update draft course properties successfully (happy path)', async () => {
      const draftCourse = await Course.create({
        title: 'Draft Course title',
        description: 'draft description',
        category: 'Test',
        price: 0,
        status: 'draft',
        publishStatus: 'draft',
        approvalStatus: 'draft'
      });

      const response = await request(app)
        .patch(`/api/courses/${draftCourse._id}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          title: 'Updated Draft Course Title'
        })
        .expect(200);

      expect(response.body.title).toBe('Updated Draft Course Title');
    });

    it('should return 404 when course is not found (not found case)', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      await request(app)
        .patch(`/api/courses/${nonExistentId}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          title: 'Valid Title'
        })
        .expect(404);
    });
  });

  describe('POST /api/courses/:id/approval (Approval Flow)', () => {
    it('should transition draft to pending review when submitted (happy path submit)', async () => {
      const draftCourse = await Course.create({
        title: 'Submission Test',
        description: 'Submission test description',
        category: 'Test',
        price: 0,
        status: 'draft'
      });

      const response = await request(app)
        .post(`/api/courses/${draftCourse._id}/approval`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          action: 'submit'
        })
        .expect(200);

      expect(response.body.status).toBe('submitted_for_review');
    });

    it('should transition submitted_for_review to approved when approved by admin (happy path approve)', async () => {
      const submittedCourse = await Course.create({
        title: 'Approval Test',
        description: 'Approval test description',
        category: 'Test',
        price: 0,
        status: 'submitted_for_review'
      });

      const response = await request(app)
        .post(`/api/courses/${submittedCourse._id}/approval`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          action: 'approve'
        })
        .expect(200);

      expect(response.body.status).toBe('approved');
    });
  });

  describe('DELETE /api/courses/:id (Archive/Delete)', () => {
    it('should delete a course successfully (happy path)', async () => {
      const draftCourse = await Course.create({
        title: 'To Be Deleted',
        description: 'Test delete',
        category: 'Test',
        price: 0,
        status: 'draft'
      });

      await request(app)
        .delete(`/api/courses/${draftCourse._id}`)
        .set('Authorization', `Bearer ${instructorToken}`)
        .set('Origin', 'http://localhost:3000')
        .expect(204);

      const dbCourse = await Course.findById(draftCourse._id);
      expect(dbCourse).toBeNull();
    });
  });

  describe('Database Error Handling (500 simulation)', () => {
    it('should return 500 when database search fails', async () => {
      const findSpy = jest.spyOn(Course, 'find').mockImplementation(() => {
        throw new Error('Database read failure');
      });

      const response = await request(app)
        .get('/api/courses')
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to fetch courses'
      });

      findSpy.mockRestore();
    });
  });
});
