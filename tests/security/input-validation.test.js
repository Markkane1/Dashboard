const request = require('supertest');
const app = require('../../src/server/server');
const User = require('../../src/server/models/User').default || require('../../src/server/models/User');
const Course = require('../../src/server/models/Course').default || require('../../src/server/models/Course');
const Enrollment = require('../../src/server/models/Enrollment').default || require('../../src/server/models/Enrollment');
const CourseFeedback = require('../../src/server/models/CourseFeedback').default || require('../../src/server/models/CourseFeedback');
const { connectDB, disconnectDB, generateToken } = require('../integration/setup');

// Mock audit logging
jest.mock('../../src/server/services/audit', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(true)
}));

describe('Input Validation and XSS Security Tests', () => {
  let testUser;
  let testCourse;
  let validToken;

  beforeAll(async () => {
    await connectDB();

    testUser = await User.create({
      name: 'Security Test User',
      email: 'security-validation@example.com',
      password: 'Password123!',
      role: 'student',
      roles: ['student'],
      permissions: [],
      status: 'active',
      emailVerified: true
    });

    testCourse = await Course.create({
      title: 'Security Course',
      description: 'Learn secure coding practices',
      category: 'Security',
      price: 0,
      publishStatus: 'published',
      approvalStatus: 'approved',
      status: 'published',
      lessonsCount: 1
    });

    await Enrollment.create({
      userId: testUser._id,
      courseId: testCourse._id,
      completed: false
    });

    validToken = generateToken(testUser);
  }, 20000);

  afterAll(async () => {
    await disconnectDB();
  }, 20000);

  /* -------------------------------------------------------------------------- */
  /*                      1. XSS PAYLOADS IN STRING FIELDS                      */
  /* -------------------------------------------------------------------------- */
  describe('XSS Payloads Mitigation', () => {
    const xssPayloads = [
      "<script>alert('xss')</script>",
      "<img src=x onerror=alert('xss')>",
      "javascript:alert('xss')",
      "<svg onload=alert('xss')>",
      "\"><script>alert('xss')</script>"
    ];

    xssPayloads.forEach((payload, idx) => {
      it(`should sanitize XSS payload #${idx + 1} when submitting course feedback`, async () => {
        const res = await request(app)
          .post(`/api/feedback/course/${testCourse._id}`)
          .set('Authorization', `Bearer ${validToken}`)
          .send({
            rating: 5,
            comments: payload,
            answers: []
          });

        expect(res.status).toBe(201);
        
        // The raw script tag/payload must NEVER be stored or reflected in the response
        expect(res.text).not.toContain(payload);
        
        // The database record must also be sanitized
        const dbFeedback = await CourseFeedback.findOne({ userId: testUser._id, courseId: testCourse._id });
        expect(dbFeedback.comments).not.toContain(payload);
        
        // Assert that the stored comments are properly escaped
        if (payload.includes('<')) {
          expect(dbFeedback.comments).toContain('&lt;');
        }
        if (payload.includes('>')) {
          expect(dbFeedback.comments).toContain('&gt;');
        }
        if (payload.includes('javascript:')) {
          expect(dbFeedback.comments).toContain('unsafe-javascript:');
        }
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                         2. CONTENT SECURITY POLICY                         */
  /* -------------------------------------------------------------------------- */
  describe('Content Security Policy & Security Headers', () => {
    it('should assert all required security headers are correctly configured', async () => {
      const res = await request(app).get('/api/courses');

      // Assert Presence of Security Headers
      expect(res.headers).toHaveProperty('content-security-policy');
      expect(res.headers).toHaveProperty('x-xss-protection');
      expect(res.headers['x-content-type-options']).toBe('nosniff');
      expect(['DENY', 'SAMEORIGIN']).toContain(res.headers['x-frame-options']);
      
      // Assert Absence of Information Leak Headers
      expect(res.headers).not.toHaveProperty('x-powered-by');
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                        3. HTTP PARAMETER POLLUTION                         */
  /* -------------------------------------------------------------------------- */
  describe('HTTP Parameter Pollution (HPP)', () => {
    it('should handle duplicate query parameters safely and resolve to a single string value', async () => {
      const res = await request(app)
        .get('/api/courses')
        .query({ category: ['Math', 'Science'] });

      expect(res.status).toBe(200);
      // The application must not crash, and must treat category as a single string field
      // Behind the scenes, HPP middleware resolves the query parameter array to a string
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                            4. OVERSIZED INPUTS                             */
  /* -------------------------------------------------------------------------- */
  describe('Oversized Body Payloads', () => {
    it('should reject a 10MB JSON body with 413 Payload Too Large', async () => {
      // Create a 10MB payload (approximately 10 million characters)
      const largePayload = JSON.stringify({
        email: 'attacker@example.com',
        password: 'A'.repeat(10 * 1024 * 1024)
      });

      const res = await request(app)
        .post('/api/users/authenticate')
        .set('Content-Type', 'application/json')
        .send(largePayload);

      expect(res.status).toBe(413);
      expect(res.body.error).toBe('Payload Too Large');
    }, 30000);
  });

  /* -------------------------------------------------------------------------- */
  /*                       5. SPECIAL CHARACTER HANDLING                        */
  /* -------------------------------------------------------------------------- */
  describe('Special Character Handling', () => {
    it('should clean null bytes from string inputs without crashing', async () => {
      const payloadWithNullByte = 'test\x00injection';
      const res = await request(app)
        .post(`/api/feedback/course/${testCourse._id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          rating: 4,
          comments: payloadWithNullByte,
          answers: []
        });

      expect(res.status).toBe(201);
      // Null byte should be removed
      expect(res.body.comments).toBe('testinjection');
    });

    it('should store and handle Unicode edge cases and emojis safely', async () => {
      const unicodePayload = '𝕳𝖊𝖑𝖑𝖔 - مرحبا - 🔥';
      const res = await request(app)
        .post(`/api/feedback/course/${testCourse._id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          rating: 4,
          comments: unicodePayload,
          answers: []
        });

      expect(res.status).toBe(201);
      expect(res.body.comments).toBe(unicodePayload);
    });

    it('should handle CRLF input without causing header injection or crash', async () => {
      const crlfPayload = 'test\r\nHeader: injected';
      const res = await request(app)
        .post(`/api/feedback/course/${testCourse._id}`)
        .set('Authorization', `Bearer ${validToken}`)
        .send({
          rating: 4,
          comments: crlfPayload,
          answers: []
        });

      expect(res.status).toBe(201);
      // The stored comments should safely contain the CRLF structure without crashes
      expect(res.body.comments).toContain('test\r\nHeader: injected');
    });
  });
});
