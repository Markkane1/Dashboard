import request from 'supertest';
import mongoose from 'mongoose';
import app from '../../src/server/server';
import Cohort from '../../src/server/models/Cohort';
import CohortMembership from '../../src/server/models/CohortMembership';
import User from '../../src/server/models/User';
import { connectDB, disconnectDB, clearDB, generateToken } from './setup';

jest.mock('../../src/server/services/audit', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(true)
}));

describe('Cohorts API Integration Tests', () => {
  let adminToken: string;
  let studentToken: string;
  let testCohort: any;
  let studentUser: any;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDB();

    adminToken = generateToken({ email: 'admin@epa.gov', role: 'admin', permissions: ['cohorts:manage'] });
    studentToken = generateToken({ email: 'stud@epa.gov', role: 'student', permissions: [] });

    studentUser = await User.create({
      name: 'Roster Student',
      email: 'roster@epa.gov',
      password: 'hashedpassword123',
      role: 'student',
      status: 'active'
    });

    testCohort = await Cohort.create({
      title: 'Batch A - 2026',
      description: 'Training Cohort A',
      courseIds: [],
      trainerIds: [],
      seatLimit: 30,
      status: 'active'
    });
  });

  describe('GET /api/cohorts', () => {
    it('should list all cohorts for managers (happy path)', async () => {
      const response = await request(app)
        .get('/api/cohorts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].title).toBe('Batch A - 2026');
    });

    it('should return 403 for student user (auth restriction)', async () => {
      await request(app)
        .get('/api/cohorts')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  describe('POST /api/cohorts', () => {
    it('should create a cohort successfully (happy path)', async () => {
      const response = await request(app)
        .post('/api/cohorts')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          title: 'Batch B - 2026',
          description: 'Training Cohort B',
          courseIds: [],
          trainerIds: [],
          seatLimit: 15,
          status: 'draft'
        })
        .expect(201);

      expect(response.body.title).toBe('Batch B - 2026');
      expect(response.body.seatLimit).toBe(15);

      const cohortDb = await Cohort.findOne({ title: 'Batch B - 2026' });
      expect(cohortDb).toBeDefined();
    });

    it('should return 400 when title is missing (validation case)', async () => {
      await request(app)
        .post('/api/cohorts')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          description: 'No title'
        })
        .expect(400);
    });

    it('should return 400 instead of 500 for object-valued fields', async () => {
      await request(app)
        .post('/api/cohorts')
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          title: {},
          description: {},
          courseIds: {},
          trainerIds: {},
          startsAt: {},
          endsAt: {},
          seatLimit: {},
          status: {}
        })
        .expect(400);
    });
  });

  describe('PATCH /api/cohorts/:id', () => {
    it('should update cohort details successfully (happy path)', async () => {
      const response = await request(app)
        .patch(`/api/cohorts/${testCohort._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          title: 'Batch A - 2026 Updated'
        })
        .expect(200);

      expect(response.body.title).toBe('Batch A - 2026 Updated');
    });

    it('should return 404 if cohort id is not found (not found case)', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      await request(app)
        .patch(`/api/cohorts/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          title: 'Updated Title'
        })
        .expect(404);
    });
  });

  describe('GET /api/cohorts/:id/members', () => {
    it('should return cohort member listings (happy path)', async () => {
      await CohortMembership.create({
        cohortId: testCohort._id,
        userId: studentUser._id,
        status: 'active'
      });

      const response = await request(app)
        .get(`/api/cohorts/${testCohort._id}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(1);
      expect(response.body[0].userId.toString()).toBe(studentUser._id.toString());
    });
  });

  describe('POST /api/cohorts/:id/members (Manual registration)', () => {
    it('should manually add a student to the cohort (happy path)', async () => {
      const response = await request(app)
        .post(`/api/cohorts/${testCohort._id}/members`)
        .set('Authorization', `Bearer ${adminToken}`)
        .set('Origin', 'http://localhost:3000')
        .send({
          userId: studentUser._id.toString()
        })
        .expect(201);

      expect(response.body.length).toBe(1);
      expect(response.body[0].status).toBe('active');

      const memberDb = await CohortMembership.findOne({ cohortId: testCohort._id, userId: studentUser._id });
      expect(memberDb?.status).toBe('active');
    });
  });

  describe('Database Error Handling (500 simulation)', () => {
    it('should return 500 when database count query fails', async () => {
      const findSpy = jest.spyOn(Cohort, 'find').mockImplementation(() => {
        throw new Error('Database read failure');
      });

      await request(app)
        .get('/api/cohorts')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500, { error: 'Failed to list cohorts.' });

      findSpy.mockRestore();
    });
  });
});
