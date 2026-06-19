import request from 'supertest';
import mongoose from 'mongoose';
import path from 'path';
import fs from 'fs';
import app from '../../src/server/server';
import Course from '../../src/server/models/Course';
import Assignment from '../../src/server/models/Assignment';
import AssignmentSubmission from '../../src/server/models/AssignmentSubmission';
import Enrollment from '../../src/server/models/Enrollment';
import { connectDB, disconnectDB, clearDB, generateToken } from './setup';

jest.mock('../../src/server/services/audit', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(true)
}));

describe('Assignments API Integration Tests', () => {
  let adminToken: string;
  let studentToken: string;
  let instructorToken: string;
  let testCourse: any;
  let testAssignment: any;
  let testStudentId: string;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
    // Clean up any uploaded test files
    const uploadDir = path.resolve(process.cwd(), 'uploads', 'assignments');
    if (fs.existsSync(uploadDir)) {
      const files = fs.readdirSync(uploadDir);
      for (const file of files) {
        try {
          fs.unlinkSync(path.join(uploadDir, file));
        } catch (err) {
          console.warn(`Temporary warning: unable to clean up test file ${file}: ${err.message}`);
        }
      }
    }
  });

  beforeEach(async () => {
    await clearDB();

    testStudentId = new mongoose.Types.ObjectId().toString();
    adminToken = generateToken({ email: 'admin@epa.gov', role: 'admin', permissions: ['content:manage'] });
    instructorToken = generateToken({ email: 'inst@epa.gov', role: 'instructor', permissions: ['content:manage'] });
    studentToken = generateToken({ id: testStudentId, email: 'student@epa.gov', role: 'student', permissions: [] });

    testCourse = await Course.create({
      title: 'Science and Environment',
      description: 'Course description',
      category: 'Science',
      price: 0,
      publishStatus: 'published',
      approvalStatus: 'approved',
      status: 'published'
    });

    testAssignment = await Assignment.create({
      courseId: testCourse._id,
      title: 'Homework 1',
      instructions: 'Submit environment analysis text',
      status: 'published'
    });

    // Enroll the student
    await Enrollment.create({
      userId: testStudentId,
      courseId: testCourse._id,
      completed: false
    });
  });

  describe('GET /api/assignments/course/:courseId', () => {
    it('should list assignments for enrolled student (happy path)', async () => {
      const response = await request(app)
        .get(`/api/assignments/course/${testCourse._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe('Homework 1');
    });

    it('should return 403 for student not enrolled in the course (auth restriction)', async () => {
      const notEnrolledToken = generateToken({ email: 'stranger@epa.gov', role: 'student', permissions: [] });
      
      await request(app)
        .get(`/api/assignments/course/${testCourse._id}`)
        .set('Authorization', `Bearer ${notEnrolledToken}`)
        .expect(403);
    });
  });

  describe('POST /api/assignments (Create Assignment)', () => {
    it('should create an assignment successfully (happy path)', async () => {
      const response = await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          courseId: testCourse._id.toString(),
          title: 'Homework 2',
          instructions: 'Read chapter 2',
          status: 'published'
        })
        .expect(201);

      expect(response.body.title).toBe('Homework 2');

      const assignmentDb = await Assignment.findOne({ title: 'Homework 2' });
      expect(assignmentDb).toBeDefined();
    });

    it('should return 400 when required title is missing (validation case)', async () => {
      await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          courseId: testCourse._id.toString()
        })
        .expect(400);
    });

    it('should return 404 when courseId does not exist (not found case)', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      await request(app)
        .post('/api/assignments')
        .set('Authorization', `Bearer ${instructorToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          courseId: nonExistentId,
          title: 'Title'
        })
        .expect(404);
    });
  });

  describe('POST /api/assignments/:id/submissions', () => {
    it('should accept student text submission successfully (happy path)', async () => {
      const response = await request(app)
        .post(`/api/assignments/${testAssignment._id}/submissions`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          text: 'My environment homework response text.'
        })
        .expect(201);

      expect(response.body.status).toBe('submitted');
      expect(response.body.text).toBe('My environment homework response text.');

      const submissionDb = await AssignmentSubmission.findOne({ assignmentId: testAssignment._id });
      expect(submissionDb).toBeDefined();
      expect(submissionDb?.text).toBe('My environment homework response text.');
    });

    it('should accept file attachments (multipart upload)', async () => {
      const response = await request(app)
        .post(`/api/assignments/${testAssignment._id}/submissions`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .attach('file', Buffer.from('PDF content mock'), 'homework.pdf')
        .expect(201);

      expect(response.body.fileName).toBe('homework.pdf');
      expect(response.body.fileUrl).toContain('/uploads/assignments/');
    });

    it('should return 400 when all evidence types (text/link/file) are missing (validation case)', async () => {
      await request(app)
        .post(`/api/assignments/${testAssignment._id}/submissions`)
        .set('Authorization', `Bearer ${studentToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({})
        .expect(400);
    });
  });

  describe('PATCH /api/assignments/submissions/:submissionId/review (Instructor Review)', () => {
    let testSubmission: any;

    beforeEach(async () => {
      testSubmission = await AssignmentSubmission.create({
        assignmentId: testAssignment._id,
        courseId: testCourse._id,
        learnerId: testStudentId,
        text: 'Initial Submission Text',
        status: 'submitted'
      });
    });

    it('should review and approve submission successfully (happy path)', async () => {
      const response = await request(app)
        .patch(`/api/assignments/submissions/${testSubmission._id}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          status: 'approved',
          comments: 'Well done!'
        })
        .expect(200);

      expect(response.body.status).toBe('approved');
      expect(response.body.reviewComments).toBe('Well done!');

      const submissionDb = await AssignmentSubmission.findById(testSubmission._id);
      expect(submissionDb?.status).toBe('approved');
    });

    it('should return 400 when status is invalid (validation constraint case)', async () => {
      await request(app)
        .patch(`/api/assignments/submissions/${testSubmission._id}/review`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          status: 'invalid-status',
          comments: 'Bad review'
        })
        .expect(400);
    });
  });

  describe('Database Error Handling (500 simulation)', () => {
    it('should return 500 when database find query fails', async () => {
      const findSpy = jest.spyOn(Assignment, 'find').mockImplementation(() => {
        throw new Error('Database read failure');
      });

      await request(app)
        .get(`/api/assignments/course/${testCourse._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500, { error: 'Failed to list assignments.' });

      findSpy.mockRestore();
    });
  });
});
