const request = require('supertest');
const app = require('../../src/server/server');
const User = require('../../src/server/models/User').default || require('../../src/server/models/User');
const Course = require('../../src/server/models/Course').default || require('../../src/server/models/Course');
const Cohort = require('../../src/server/models/Cohort').default || require('../../src/server/models/Cohort');
const { connectDB, disconnectDB, generateToken } = require('../integration/setup');

// Mock audit logging
jest.mock('../../src/server/services/audit', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(true)
}));

describe('Express Configuration and API Design Security Tests', () => {
  let testUser;
  let validToken;
  let adminUser;
  let adminToken;

  beforeAll(async () => {
    await connectDB();

    testUser = await User.create({
      name: 'API Security User',
      email: 'api-security@example.com',
      password: 'Password123!',
      role: 'student',
      roles: ['student'],
      permissions: [],
      status: 'active',
      emailVerified: true
    });

    validToken = generateToken(testUser);

    adminUser = await User.create({
      name: 'API Admin User',
      email: 'api-admin@example.com',
      password: 'Password123!',
      role: 'admin',
      roles: ['admin'],
      permissions: [],
      status: 'active',
      emailVerified: true
    });

    adminToken = generateToken(adminUser);
  }, 20000);

  afterAll(async () => {
    await disconnectDB();
  }, 20000);

  /* -------------------------------------------------------------------------- */
  /*                            1. SECURITY HEADERS                             */
  /* -------------------------------------------------------------------------- */
  describe('Security Headers (helmet)', () => {
    it('should verify that all critical security headers exist and X-Powered-By is absent', async () => {
      const res = await request(app).get('/api/courses');

      expect(res.headers).toHaveProperty('strict-transport-security');
      expect(res.headers).toHaveProperty('content-security-policy');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(['DENY', 'SAMEORIGIN']).toContain(res.headers['x-frame-options']);
      expect(res.headers).not.toHaveProperty('x-powered-by');
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                              2. CORS POLICY                                */
  /* -------------------------------------------------------------------------- */
  describe('CORS Policy origin controls', () => {
    it('should reject requests with unauthorized Origin and not echo evil.com', async () => {
      const res = await request(app)
        .get('/api/courses')
        .set('Origin', 'https://evil.com');

      expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.com');
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    });

    it('should allow OPTIONS preflight requests for allowed origins', async () => {
      const res = await request(app)
        .options('/api/courses')
        .set('Origin', 'http://localhost:3000')
        .set('Access-Control-Request-Method', 'GET');

      expect([200, 204]).toContain(res.status);
      expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
    });

    it('should reject OPTIONS preflight requests for unauthorized origins', async () => {
      const res = await request(app)
        .options('/api/courses')
        .set('Origin', 'https://evil.com')
        .set('Access-Control-Request-Method', 'GET');

      expect(res.headers['access-control-allow-origin']).not.toBe('https://evil.com');
      expect(res.headers['access-control-allow-origin']).not.toBe('*');
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                       3. RATE LIMITING ON AUTH ROUTES                      */
  /* -------------------------------------------------------------------------- */
  describe('Rate Limiting on Authentication Routes', () => {
    it('should trigger rate limiting and return 429 after excessive rapid requests', async () => {
      let rateLimited = false;
      let lastRes;

      for (let i = 0; i < 15; i++) {
        const res = await request(app)
          .post('/api/auth/login')
          .set('Origin', 'http://localhost:3000')
          .send({ email: 'api-security@example.com', password: 'wrong' });

        if (res.status === 429) {
          rateLimited = true;
          lastRes = res;
          break;
        }
      }

      expect(rateLimited).toBe(true);
      expect(lastRes.status).toBe(429);
      expect(lastRes.headers).toHaveProperty('retry-after');
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                         4. EXCESSIVE DATA EXPOSURE                         */
  /* -------------------------------------------------------------------------- */
  describe('Excessive Data Exposure', () => {
    const assertUserFieldsClean = (userObj) => {
      expect(userObj).not.toHaveProperty('password');
      expect(userObj).not.toHaveProperty('passwordHash');
      expect(userObj).not.toHaveProperty('__v');
      expect(userObj).not.toHaveProperty('passwordResetTokenHash');
      expect(userObj).not.toHaveProperty('passwordResetExpires');
      expect(userObj).not.toHaveProperty('emailVerificationTokenHash');
      expect(userObj).not.toHaveProperty('emailVerificationExpires');
      expect(userObj).not.toHaveProperty('failedLoginAttempts');
      expect(userObj).not.toHaveProperty('lockUntil');
    };

    it('should verify user objects returned by /api/users/me do not expose sensitive data', async () => {
      const res = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      assertUserFieldsClean(res.body);
    });

    it('should verify user objects returned by /api/users/:id do not expose sensitive data', async () => {
      const res = await request(app)
        .get(`/api/users/${testUser._id}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      assertUserFieldsClean(res.body);
    });

    it('should verify user objects returned by /api/users/email/:email do not expose sensitive data', async () => {
      const res = await request(app)
        .get(`/api/users/email/${testUser.email}`)
        .set('Authorization', `Bearer ${validToken}`);

      expect(res.status).toBe(200);
      assertUserFieldsClean(res.body);
    });

    it('should verify user objects returned by /api/users list do not expose sensitive data', async () => {
      const res = await request(app)
        .get('/api/users')
        .set('Authorization', `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body.length).toBeGreaterThan(0);

      res.body.forEach((u) => {
        assertUserFieldsClean(u);
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                           5. REQUEST SIZE LIMITS                           */
  /* -------------------------------------------------------------------------- */
  describe('Request Payload Limits', () => {
    it('should reject a JSON body larger than 10kb with 413 Payload Too Large on POST routes', async () => {
      const largeBody = JSON.stringify({
        email: 'api-security@example.com',
        password: 'A'.repeat(10 * 1024 + 1)
      });

      const routesToTest = [
        '/api/auth/login',
        '/api/users/authenticate',
        '/api/users/enroll',
        '/api/users/complete',
        '/api/courses'
      ];

      for (const route of routesToTest) {
        const res = await request(app)
          .post(route)
          .set('Content-Type', 'application/json')
          .set('Authorization', `Bearer ${validToken}`)
          .send(largeBody);

        expect(res.status).toBe(413);
        expect(res.body.error).toBe('Payload Too Large');
      }
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                              6. OPEN REDIRECT                              */
  /* -------------------------------------------------------------------------- */
  describe('Open Redirect Safeguards', () => {
    it('should verify login routes do not redirect to external sites via parameters', async () => {
      const routes = ['/api/auth/login', '/api/users/authenticate'];

      for (const route of routes) {
        const res = await request(app)
          .post(route)
          .query({ redirect: 'https://evil.com', returnTo: '//evil.com' })
          .send({ email: 'api-security@example.com', password: 'Password123!' });

        expect(res.status).not.toBe(302);
        expect(res.headers.location).toBeUndefined();
      }
    });

    it('should allow relative path parameters like /dashboard without redirecting externally', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .query({ redirect: '/dashboard' })
        .send({ email: 'api-security@example.com', password: 'Password123!' });

      expect(res.status).not.toBe(302);
      expect(res.headers.location).toBeUndefined();
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                           7. DIRECTORY TRAVERSAL                           */
  /* -------------------------------------------------------------------------- */
  describe('Directory Traversal Protection', () => {
    it('should reject traversal attempts for file routes with 400 or 404', async () => {
      const pathsToTest = [
        '../../etc/passwd',
        '..%2F..%2Fetc%2Fpasswd',
        '/static/../../../etc/passwd'
      ];

      for (const traversalPath of pathsToTest) {
        const res = await request(app)
          .get(`/api/assignments/submissions/${traversalPath}/file`)
          .set('Authorization', `Bearer ${validToken}`);

        expect([400, 404]).toContain(res.status);
        expect(res.text).not.toContain('root:x:0:0');
      }
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                          8. ERROR MESSAGE LEAKAGE                          */
  /* -------------------------------------------------------------------------- */
  describe('Error Message Leakage Mitigation', () => {
    const assertNoLeakage = (res) => {
      expect(res.status).toBe(500);
      expect(res.body.error).toBeDefined();

      const responseStr = JSON.stringify(res.body);
      expect(responseStr).not.toContain('catastrophically');
      expect(responseStr).not.toContain('SecretPath');
      expect(responseStr).not.toContain('Mongoose query');
      expect(responseStr).not.toContain('/var/www');
      expect(responseStr).not.toContain('stack');
    };

    it('should verify course database errors do not leak stack traces or internal names', async () => {
      const spy = jest.spyOn(Course, 'find').mockImplementationOnce(() => {
        throw new Error('Mongoose query failed catastrophically! SecretPath: /var/www/config/db.json');
      });

      const res = await request(app).get('/api/courses');
      assertNoLeakage(res);

      spy.mockRestore();
    });

    it('should verify user database errors do not leak stack traces or internal names', async () => {
      const spy = jest.spyOn(User, 'findById').mockImplementationOnce(() => {
        throw new Error('Mongoose query failed catastrophically! SecretPath: /var/www/config/db.json');
      });

      const res = await request(app)
        .get(`/api/users/${testUser._id}`)
        .set('Authorization', `Bearer ${validToken}`);
      assertNoLeakage(res);

      spy.mockRestore();
    });

    it('should verify cohort database errors do not leak stack traces or internal names', async () => {
      const spy = jest.spyOn(Cohort, 'find').mockImplementationOnce(() => {
        throw new Error('Mongoose query failed catastrophically! SecretPath: /var/www/config/db.json');
      });

      const res = await request(app)
        .get('/api/cohorts')
        .set('Authorization', `Bearer ${adminToken}`);
      assertNoLeakage(res);

      spy.mockRestore();
    });
  });
});

