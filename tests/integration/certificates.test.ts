import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/server/server';
import CertificateIssuance from '../../src/server/models/CertificateIssuance';
import CertificateApproval from '../../src/server/models/CertificateApproval';
import Course from '../../src/server/models/Course';
import Enrollment from '../../src/server/models/Enrollment';
import User from '../../src/server/models/User';
import { connectDB, disconnectDB, clearDB, generateToken } from './setup';

// Mock audit service to prevent database writes/errors
jest.mock('../../src/server/services/audit', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(true)
}));

// Mock PDF generation service to return a dummy buffer
jest.mock('../../src/server/services/documentPdf', () => ({
  formatIssuedOn: jest.fn().mockReturnValue('June 11, 2026'),
  getOrCreateDocumentPdf: jest.fn().mockResolvedValue(Buffer.from('PDF_BYTES'))
}));

describe('Certificate Governance and Retrieval API Integration Tests', () => {
  let adminToken: string;
  let certificateApproverToken: string;
  let certificateRevokerToken: string;
  let studentToken: string;
  let studentUser: any;
  let testCourse: any;
  let testIssuance: any;

  beforeAll(async () => {
    await connectDB();
  }, 20000);

  afterAll(async () => {
    await disconnectDB();
  }, 20000);

  beforeEach(async () => {
    await clearDB();

    studentUser = await User.create({
      name: 'John Doe',
      email: 'student@example.com',
      password: 'securepassword123',
      role: 'student',
      status: 'active'
    });

    testCourse = await Course.create({
      title: 'Intro to EPA Rules',
      description: 'Understanding environment policies',
      category: 'Environment',
      publishStatus: 'published',
      approvalStatus: 'approved',
      status: 'published',
      requiresCertificateApproval: true
    });

    testIssuance = await CertificateIssuance.create({
      certificateId: 'test-cert-uuid-12345',
      serialNumber: 'EPA-CKEPD-2026-ENV-000001',
      userId: studentUser._id,
      courseId: testCourse._id,
      recipientName: studentUser.name,
      courseTitle: testCourse.title,
      approvalStatus: 'pending',
      status: 'valid'
    });

    adminToken = generateToken({ email: 'admin@epa.gov', role: 'admin', permissions: ['certificates:approve', 'certificates:revoke'] });
    certificateApproverToken = generateToken({ email: 'approver@epa.gov', role: 'instructor', permissions: ['certificates:approve'] });
    certificateRevokerToken = generateToken({ email: 'revoker@epa.gov', role: 'instructor', permissions: ['certificates:revoke'] });
    studentToken = generateToken({ id: studentUser._id.toString(), email: studentUser.email, role: 'student', permissions: [] });

    // Setup mocks that get reset by resetMocks
    const documentPdf = require('../../src/server/services/documentPdf');
    documentPdf.getOrCreateDocumentPdf.mockResolvedValue(Buffer.from('PDF_BYTES'));
    documentPdf.formatIssuedOn.mockReturnValue('June 11, 2026');
  });

  describe('GET /api/certificates/approvals', () => {
    it('should return certificate approvals queue (happy path)', async () => {
      const response = await request(app)
        .get('/api/certificates/approvals')
        .set('Authorization', `Bearer ${certificateApproverToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].id).toBe(testIssuance._id.toString());
      expect(response.body[0].approvalStatus).toBe('pending');
    });

    it('should return 401 when no token is provided (auth restriction)', async () => {
      await request(app)
        .get('/api/certificates/approvals')
        .expect(401);
    });

    it('should return 403 when valid user lacks permission (auth restriction)', async () => {
      await request(app)
        .get('/api/certificates/approvals')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  describe('GET /api/certificates/revocations', () => {
    it('should return revoked certificates list (happy path)', async () => {
      testIssuance.revokedAt = new Date();
      testIssuance.status = 'revoked';
      testIssuance.revocationReason = 'Completed manually';
      await testIssuance.save();

      const response = await request(app)
        .get('/api/certificates/revocations')
        .set('Authorization', `Bearer ${certificateRevokerToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].approvalStatus).toBe('pending');
      expect(response.body[0].revocationReason).toBe('Completed manually');
    });

    it('should return 403 when lacks revoke permission (auth restriction)', async () => {
      await request(app)
        .get('/api/certificates/revocations')
        .set('Authorization', `Bearer ${certificateApproverToken}`)
        .expect(403);
    });
  });

  describe('POST /api/certificates/:courseId/approval', () => {
    it('should approve a certificate issuance successfully (happy path)', async () => {
      const response = await request(app)
        .post(`/api/certificates/${testCourse._id}/approval`)
        .set('Authorization', `Bearer ${certificateApproverToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          userId: studentUser._id.toString(),
          status: 'approved',
          comments: 'Well done!'
        })
        .expect(200);

      expect(response.body.issuance.approvalStatus).toBe('approved');
      expect(response.body.approval.status).toBe('approved');

      // Verify mutation in DB
      const updatedIssuance = await CertificateIssuance.findById(testIssuance._id);
      expect(updatedIssuance?.approvalStatus).toBe('approved');
      expect(updatedIssuance?.approvalComments).toBe('Well done!');

      const approval = await CertificateApproval.findOne({ certificateIssuanceId: testIssuance._id });
      expect(approval?.status).toBe('approved');
    });

    it('should return 400 when status is missing or wrong (validation)', async () => {
      await request(app)
        .post(`/api/certificates/${testCourse._id}/approval`)
        .set('Authorization', `Bearer ${certificateApproverToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          userId: studentUser._id.toString(),
          status: 'invalid_status'
        })
        .expect(400);
    });

    it('should return 400 when courseId is not a valid ObjectId (validation)', async () => {
      await request(app)
        .post('/api/certificates/invalid-id/approval')
        .set('Authorization', `Bearer ${certificateApproverToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          userId: studentUser._id.toString(),
          status: 'approved'
        })
        .expect(400);
    });

    it('should return 404 when certificate issuance does not exist (not found)', async () => {
      const unusedCourseId = new mongoose.Types.ObjectId().toString();
      await request(app)
        .post(`/api/certificates/${unusedCourseId}/approval`)
        .set('Authorization', `Bearer ${certificateApproverToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          userId: studentUser._id.toString(),
          status: 'approved'
        })
        .expect(404);
    });
  });

  describe('POST /api/certificates/:certificateId/revoke', () => {
    it('should revoke an active certificate successfully (happy path)', async () => {
      const response = await request(app)
        .post(`/api/certificates/${testIssuance.certificateId}/revoke`)
        .set('Authorization', `Bearer ${certificateRevokerToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          reason: 'Academic integrity violation'
        })
        .expect(200);

      expect(response.body.status).toBe('revoked');
      expect(response.body.revocationReason).toBe('Academic integrity violation');

      const updated = await CertificateIssuance.findById(testIssuance._id);
      expect(updated?.status).toBe('revoked');
    });

    it('should return 400 when reason is missing (validation)', async () => {
      await request(app)
        .post(`/api/certificates/${testIssuance.certificateId}/revoke`)
        .set('Authorization', `Bearer ${certificateRevokerToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({})
        .expect(400);
    });

    it('should return 404 when certificateId is invalid or non-existent (not found)', async () => {
      await request(app)
        .post('/api/certificates/non-existent-uuid/revoke')
        .set('Authorization', `Bearer ${certificateRevokerToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          reason: 'Not found test'
        })
        .expect(404);
    });
  });

  describe('GET /api/certificates/verify/:certificateId', () => {
    it('should verify certificate authenticity successfully (happy path)', async () => {
      const response = await request(app)
        .get(`/api/certificates/verify/${testIssuance.certificateId}`)
        .expect(200);

      expect(response.body.valid).toBe(true);
      expect(response.body.recipientName).toBe(studentUser.name);
      expect(response.body.courseTitle).toBe(testCourse.title);
      expect(response.body.status).toBe('valid');
    });

    it('should verify revoked certificate is invalid (happy path)', async () => {
      testIssuance.status = 'revoked';
      testIssuance.revokedAt = new Date();
      testIssuance.revocationReason = 'Fake credentials';
      await testIssuance.save();

      const response = await request(app)
        .get(`/api/certificates/verify/${testIssuance.certificateId}`)
        .expect(200);

      expect(response.body.valid).toBe(false);
      expect(response.body.status).toBe('revoked');
      expect(response.body.revocationReason).toBe('Fake credentials');
    });

    it('should return 404 with valid: false when not found (not found case)', async () => {
      const response = await request(app)
        .get('/api/certificates/verify/does-not-exist')
        .expect(404);

      expect(response.body.valid).toBe(false);
      expect(response.body.status).toBe('not_found');
    });
  });

  describe('GET /api/certificates/:courseId/download', () => {
    it('should download certificate PDF if student completes course and is approved (happy path)', async () => {
      // 1. Enroll user in course
      await Enrollment.create({
        userId: studentUser._id,
        courseId: testCourse._id,
        completed: true,
        completedAt: new Date()
      });

      // 2. Approve certificate issuance
      testIssuance.approvalStatus = 'approved';
      await testIssuance.save();

      const response = await request(app)
        .get(`/api/certificates/${testCourse._id}/download`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.headers['content-disposition']).toContain('attachment');
      expect(response.body).toBeDefined();
    });

    it('should return 403 when course is not completed (access control)', async () => {
      await Enrollment.create({
        userId: studentUser._id,
        courseId: testCourse._id,
        completed: false
      });

      const response = await request(app)
        .get(`/api/certificates/${testCourse._id}/download`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      expect(response.body.error).toBe('Certificate is only available for completed courses.');
    });

    it('should return 403 when certificate is pending approval', async () => {
      await Enrollment.create({
        userId: studentUser._id,
        courseId: testCourse._id,
        completed: true
      });

      testIssuance.approvalStatus = 'pending';
      await testIssuance.save();

      const response = await request(app)
        .get(`/api/certificates/${testCourse._id}/download`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      expect(response.body.error).toBe('Certificate is pending approval.');
    });

    it('should return 403 when certificate has been revoked', async () => {
      await Enrollment.create({
        userId: studentUser._id,
        courseId: testCourse._id,
        completed: true
      });

      testIssuance.approvalStatus = 'approved';
      testIssuance.revokedAt = new Date();
      testIssuance.status = 'revoked';
      await testIssuance.save();

      const response = await request(app)
        .get(`/api/certificates/${testCourse._id}/download`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      expect(response.body.error).toBe('Certificate has been revoked.');
    });
  });

  describe('GET /api/certificates/diploma', () => {
    let diplomaTrack: any;
    let reqCourse1: any;
    let reqCourse2: any;

    beforeEach(async () => {
      diplomaTrack = await Course.create({
        title: 'Master of Environmental Laws',
        description: 'Diploma track',
        category: 'Law',
        isDiploma: true,
        publishStatus: 'published',
        approvalStatus: 'approved',
        status: 'published'
      });

      reqCourse1 = await Course.create({
        title: 'Environmental Law I',
        description: 'Core 1',
        category: 'Law',
        isDiploma: false,
        publishStatus: 'published',
        approvalStatus: 'approved',
        status: 'published'
      });

      reqCourse2 = await Course.create({
        title: 'Environmental Law II',
        description: 'Core 2',
        category: 'Law',
        isDiploma: false,
        publishStatus: 'published',
        approvalStatus: 'approved',
        status: 'published'
      });

      // Update diploma track required courses
      diplomaTrack.diplomaRequiredCourseIds = [reqCourse1._id.toString(), reqCourse2._id.toString()];
      await diplomaTrack.save();
    });

    it('should download diploma PDF if student completes all required courses (happy path)', async () => {
      await Enrollment.create({
        userId: studentUser._id,
        courseId: reqCourse1._id,
        completed: true,
        completedAt: new Date()
      });

      await Enrollment.create({
        userId: studentUser._id,
        courseId: reqCourse2._id,
        completed: true,
        completedAt: new Date()
      });

      const response = await request(app)
        .get(`/api/certificates/diploma?diplomaId=${diplomaTrack._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.headers['content-type']).toBe('application/pdf');
      expect(response.body).toBeDefined();
    });

    it('should return 400 when diplomaId is missing (validation)', async () => {
      await request(app)
        .get('/api/certificates/diploma')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(400, { error: 'diplomaId is required.' });
    });

    it('should return 403 when not all courses are completed', async () => {
      await Enrollment.create({
        userId: studentUser._id,
        courseId: reqCourse1._id,
        completed: true,
        completedAt: new Date()
      });

      const response = await request(app)
        .get(`/api/certificates/diploma?diplomaId=${diplomaTrack._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);

      expect(response.body.error).toBe('Complete all required courses before downloading this diploma.');
      expect(response.body.missingCourseIds).toContain(reqCourse2._id.toString());
    });
  });

  describe('Database Error Simulation (500)', () => {
    it('should return 500 when querying approval list fails', async () => {
      const spy = jest.spyOn(CertificateIssuance, 'find').mockImplementation(() => {
        throw new Error('Database exception');
      });

      await request(app)
        .get('/api/certificates/approvals')
        .set('Authorization', `Bearer ${certificateApproverToken}`)
        .expect(500, { error: 'Failed to list certificate approval queue.' });

      spy.mockRestore();
    });

    it('should return 500 when verification fails due to query issue', async () => {
      const spy = jest.spyOn(CertificateIssuance, 'findOne').mockImplementation(() => {
        throw new Error('Database query failure');
      });

      const response = await request(app)
        .get(`/api/certificates/verify/${testIssuance.certificateId}`)
        .expect(500);

      expect(response.body.valid).toBe(false);
      expect(response.body.status).toBe('not_found');

      spy.mockRestore();
    });
  });
});
