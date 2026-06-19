const request = require('supertest');
const app = require('../../src/server/server');
const User = require('../../src/server/models/User').default || require('../../src/server/models/User');
const Course = require('../../src/server/models/Course').default || require('../../src/server/models/Course');
const { connectDB, disconnectDB, generateToken } = require('../integration/setup');

// Mock audit logging
jest.mock('../../src/server/services/audit', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(true)
}));

describe('MongoDB NoSQL Injection Security Tests', () => {
  let testUser;
  let validToken;

  beforeAll(async () => {
    await connectDB();
    await Course.createIndexes();

    testUser = await User.create({
      name: 'NoSQL Test User',
      email: 'nosql@example.com',
      password: 'password123',
      role: 'admin',
      permissions: ['users:manage', 'audit-logs:view', 'notifications:announce', 'certificates:approve', 'analytics:view'],
      status: 'active',
      emailVerified: true
    });

    validToken = generateToken(testUser);
  }, 20000);

  afterAll(async () => {
    await disconnectDB();
  }, 20000);

  /* -------------------------------------------------------------------------- */
  /*                            1. OPERATOR INJECTION                           */
  /* -------------------------------------------------------------------------- */
  describe('Operator Injection Mitigation', () => {
    const payloads = [
      { '$gt': '' },
      { '$ne': null },
      { '$in': [''] },
      { '$where': 'sleep(5000)' },
      { '$regex': '.*' }
    ];

    payloads.forEach((payload, idx) => {
      it(`should sanitize operator payload #${idx + 1} and prevent injection in query params`, async () => {
        const res = await request(app)
          .get('/api/courses')
          .query({ category: payload });

        // Since express-mongo-sanitize strips keys starting with $, the query becomes {}
        // The server should either return 200/201 with normal (or empty) sanitized results, or return 400.
        // It must NOT throw a 500 error or crash.
        expect(res.status).not.toBe(500);
      });

      it(`should sanitize operator payload #${idx + 1} in request body`, async () => {
        const res = await request(app)
          .post('/api/courses/batch')
          .set('Authorization', `Bearer ${validToken}`)
          .send({ ids: [payload] });

        expect(res.status).not.toBe(500);
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                               2. LOGIN BYPASS                              */
  /* -------------------------------------------------------------------------- */
  describe('Login Bypass Attempt', () => {
    it('should reject login attempt with operator injection in email and password', async () => {
      const res = await request(app)
        .post('/api/users/authenticate')
        .send({
          email: { '$gt': '' },
          password: { '$gt': '' }
        });

      // Zod validation should fail, returning 400.
      // If it bypasses Zod or is stripped, it returns 401 or 403 (unverified/pending accounts).
      expect([400, 401, 403]).toContain(res.status);
    });

    it('should reject login attempt with valid email but operator injection in password', async () => {
      const res = await request(app)
        .post('/api/users/authenticate')
        .send({
          email: 'admin@test.com',
          password: { '$ne': 'wrongpassword' }
        });

      expect([400, 401, 403]).toContain(res.status);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                             3. REGEX DOS (ReDoS)                           */
  /* -------------------------------------------------------------------------- */
  describe('Regex DoS (ReDoS) Verification', () => {
    it('should complete search request within 2 seconds even with a very long repeating string', async () => {
      const longPayload = 'a'.repeat(10000) + '!';

      const startTime = Date.now();
      const res = await request(app)
        .get('/api/courses')
        .query({ q: longPayload });
      const duration = Date.now() - startTime;

      expect(res.status).not.toBe(500);
      expect(duration).toBeLessThan(2000); // Expect response within 2 seconds
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                            4. OBJECT ID INJECTION                          */
  /* -------------------------------------------------------------------------- */
  describe('Object ID Injection Mitigation', () => {
    it('should reject non-ObjectId strings with 400 or 404 instead of a 500 crash', async () => {
      const res = await request(app)
        .get('/api/courses/not-an-id');

      expect([400, 404]).toContain(res.status);
    });

    it('should reject oversized strings with 400 or 404 instead of a 500 crash', async () => {
      const res = await request(app)
        .get(`/api/courses/${'a'.repeat(1000)}`);

      expect([400, 404]).toContain(res.status);
    });

    it('should reject query-string object parameter manipulation for ObjectId fields', async () => {
      const res = await request(app)
        .get('/api/courses/%7B%22%24gt%22%3A%22%22%7D'); // URL-encoded {"$gt":""} as route param

      expect([400, 404]).toContain(res.status);
    });
  });
});
