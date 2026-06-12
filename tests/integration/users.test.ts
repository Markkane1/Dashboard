import request from 'supertest';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import app from '../../src/server/server';
import User from '../../src/server/models/User';
import { connectDB, disconnectDB, clearDB, generateToken } from './setup';

// Mock audit logging to prevent writing additional audit log documents in tests
jest.mock('../../src/server/services/audit', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(true)
}));

// Mock email sending
jest.mock('../../src/shared/email/sendEmail', () => ({
  sendEmail: jest.fn().mockResolvedValue(true)
}));

describe('Users API Integration Tests', () => {
  let adminUser: any;
  let studentUser: any;
  let adminToken: string;
  let studentToken: string;

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  beforeEach(async () => {
    await clearDB();

    const hashedPassword = await bcrypt.hash('password123', 10);

    // Create seed data
    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@epa.gov',
      password: hashedPassword,
      role: 'admin',
      roles: ['admin'],
      permissions: ['users:manage', 'users:read'],
      emailVerified: true,
      status: 'active'
    });

    studentUser = await User.create({
      name: 'Student User',
      email: 'student@epa.gov',
      password: hashedPassword,
      role: 'student',
      roles: ['student'],
      permissions: ['courses:enroll'],
      emailVerified: true,
      status: 'active'
    });

    adminToken = generateToken(adminUser);
    studentToken = generateToken(studentUser);
  });

  describe('POST /api/users/authenticate (Login)', () => {
    it('should authenticate successfully with valid credentials (happy path)', async () => {
      const response = await request(app)
        .post('/api/users/authenticate')
        .set('Origin', 'http://localhost:3000')
        .send({
          email: 'student@epa.gov',
          password: 'password123'
        })
        .expect(200);

      expect(response.body).toHaveProperty('id');
      expect(response.body.email).toBe('student@epa.gov');
      expect(response.body.role).toBe('student');
    });

    it('should fail authentication with invalid credentials (sad path)', async () => {
      await request(app)
        .post('/api/users/authenticate')
        .set('Origin', 'http://localhost:3000')
        .send({
          email: 'student@epa.gov',
          password: 'wrongpassword'
        })
        .expect(401);
    });

    it('should return 400 when email is not provided (validation case)', async () => {
      const response = await request(app)
        .post('/api/users/authenticate')
        .set('Origin', 'http://localhost:3000')
        .send({
          password: 'password123'
        })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });

    it('should return 400 when email format is invalid (validation constraint case)', async () => {
      await request(app)
        .post('/api/users/authenticate')
        .set('Origin', 'http://localhost:3000')
        .send({
          email: 'not-an-email',
          password: 'password123'
        })
        .expect(400);
    });
  });

  describe('GET /api/users/me (Authenticated)', () => {
    it('should return 401 when no token is provided (auth case)', async () => {
      await request(app)
        .get('/api/users/me')
        .expect(401);
    });

    it('should return 401 when invalid token is provided (auth case)', async () => {
      await request(app)
        .get('/api/users/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });

    it('should return enrolledCourses of the logged in user (happy path)', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('enrolledCourses');
      expect(Array.isArray(response.body.enrolledCourses)).toBe(true);
    });
  });

  describe('GET /api/users/ (Admin Access Only)', () => {
    it('should return list of users for admin (happy path)', async () => {
      const response = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2);
    });

    it('should return 403 for student user trying to list users (auth role restriction)', async () => {
      await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${studentToken}`)
        .expect(403);
    });
  });

  describe('PUT /api/users/:id (Profile Update)', () => {
    it('should update name successfully (happy path)', async () => {
      const response = await request(app)
        .put(`/api/users/${studentUser._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          name: 'Updated Student Name'
        })
        .expect(200);

      expect(response.body.name).toBe('Updated Student Name');

      const userDb = await User.findById(studentUser._id);
      expect(userDb?.name).toBe('Updated Student Name');
    });

    it('should return 403 when updating another user profile without manage permission (auth authorization)', async () => {
      await request(app)
        .put(`/api/users/${adminUser._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({
          name: 'Hacked Admin Name'
        })
        .expect(403);
    });

    it('should return 404 when user ID does not exist (not found case)', async () => {
      const nonExistentId = new mongoose.Types.ObjectId().toString();
      await request(app)
        .put(`/api/users/${nonExistentId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          name: 'Valid Name'
        })
        .expect(404);
    });
  });

  describe('PATCH /api/users/:id/role (Admin Access Only)', () => {
    it('should update roles and permissions (happy path)', async () => {
      const response = await request(app)
        .patch(`/api/users/${studentUser._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roles: ['instructor'],
          permissions: ['content:manage']
        })
        .expect(200);

      expect(response.body.roles).toContain('instructor');
      expect(response.body.permissions).toContain('content:manage');
    });

    it('should return 400 when role is invalid (validation case)', async () => {
      await request(app)
        .patch(`/api/users/${studentUser._id}/role`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          roles: ['invalid-role']
        })
        .expect(400);
    });
  });

  describe('Database Error Handling (500 Simulation)', () => {
    it('should return 500 when database throws error during authentication and leak no stack details', async () => {
      const findOneSpy = jest.spyOn(User, 'findOne').mockImplementation(() => {
        throw new Error('Database connection timeout!');
      });

      const response = await request(app)
        .post('/api/users/authenticate')
        .set('Origin', 'http://localhost:3000')
        .send({
          email: 'student@epa.gov',
          password: 'password123'
        })
        .expect(500);

      expect(response.body).toEqual({
        error: 'Failed to authenticate user'
      });

      findOneSpy.mockRestore();
    });
  });
});
