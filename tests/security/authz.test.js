const request = require('supertest');
const crypto = require('crypto');
const app = require('../../src/server/server');
const User = require('../../src/server/models/User').default || require('../../src/server/models/User');
const { connectDB, disconnectDB, generateToken } = require('../integration/setup');

// Mock audit logging
jest.mock('../../src/server/services/audit', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(true)
}));

describe('Auth and Authorization (Authz) Security Tests', () => {
  let userA;
  let userB;
  let adminUser;
  let tokenA;
  let tokenB;
  let tokenAdmin;

  const protectedRoutes = [
    { method: 'get', path: '/api/users/me' },
    { method: 'get', path: '/api/notifications' },
    { method: 'get', path: '/api/certificates/approvals' },
    { method: 'get', path: '/api/analytics/overview' },
    { method: 'get', path: '/api/audit-logs' }
  ];

  beforeAll(async () => {
    await connectDB();

    // Create three users
    userA = await User.create({
      name: 'Regular User A',
      email: 'usera@example.com',
      password: 'Password123!',
      role: 'student',
      roles: ['student'],
      permissions: [],
      status: 'active',
      emailVerified: true
    });

    userB = await User.create({
      name: 'Regular User B',
      email: 'userb@example.com',
      password: 'Password123!',
      role: 'student',
      roles: ['student'],
      permissions: [],
      status: 'active',
      emailVerified: true
    });

    adminUser = await User.create({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'Password123!',
      role: 'admin',
      roles: ['admin'],
      permissions: ['users:manage', 'audit-logs:view', 'notifications:announce', 'certificates:approve', 'analytics:view', 'password-resets:manage'],
      status: 'active',
      emailVerified: true
    });

    tokenA = generateToken(userA);
    tokenB = generateToken(userB);
    tokenAdmin = generateToken(adminUser);
  }, 20000);

  afterAll(async () => {
    await disconnectDB();
  }, 20000);

  /* -------------------------------------------------------------------------- */
  /*                            1. UNAUTHENTICATED ACCESS                       */
  /* -------------------------------------------------------------------------- */
  describe('Unauthenticated Access Controls', () => {
    protectedRoutes.forEach((route) => {
      it(`should return 401 for no token on ${route.method.toUpperCase()} ${route.path}`, async () => {
        const res = await request(app)[route.method](route.path);
        expect(res.status).toBe(401);
      });

      it(`should return 401 for empty token on ${route.method.toUpperCase()} ${route.path}`, async () => {
        const res = await request(app)[route.method](route.path).set('Authorization', 'Bearer ');
        expect(res.status).toBe(401);
      });

      it(`should return 401 for token "null" on ${route.method.toUpperCase()} ${route.path}`, async () => {
        const res = await request(app)[route.method](route.path).set('Authorization', 'Bearer null');
        expect(res.status).toBe(401);
      });

      it(`should return 401 for token "undefined" on ${route.method.toUpperCase()} ${route.path}`, async () => {
        const res = await request(app)[route.method](route.path).set('Authorization', 'Bearer undefined');
        expect(res.status).toBe(401);
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                 2. IDOR — HORIZONTAL PRIVILEGE ESCALATION                  */
  /* -------------------------------------------------------------------------- */
  describe('IDOR Horizontal Privilege Escalation Prevention', () => {
    it('should return 403 when User B attempts to GET User A profile', async () => {
      const res = await request(app)
        .get(`/api/users/${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`);
      
      expect(res.status).toBe(403);
    });

    it('should return 403 when User B attempts to PUT User A profile updates', async () => {
      const res = await request(app)
        .put(`/api/users/${userA._id}`)
        .set('Authorization', `Bearer ${tokenB}`)
        .send({ name: 'Hacked Name' });

      expect(res.status).toBe(403);
      // Double check name remained unchanged
      const freshUserA = await User.findById(userA._id);
      expect(freshUserA.name).toBe('Regular User A');
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                        3. VERTICAL PRIVILEGE ESCALATION                    */
  /* -------------------------------------------------------------------------- */
  describe('Vertical Privilege Escalation Prevention', () => {
    it('should return 403 when regular User A tries to GET /api/admin/overview', async () => {
      const res = await request(app)
        .get('/api/admin/overview')
        .set('Authorization', `Bearer ${tokenA}`);
      
      expect(res.status).toBe(403);
    });

    it('should return 403 when regular User A tries to POST /api/admin/test', async () => {
      const res = await request(app)
        .post('/api/admin/test')
        .set('Authorization', `Bearer ${tokenA}`)
        .send({});
      
      expect(res.status).toBe(403);
    });

    it('should return 403 when regular User A tries to DELETE /api/admin/test', async () => {
      const res = await request(app)
        .delete('/api/admin/test')
        .set('Authorization', `Bearer ${tokenA}`);
      
      expect(res.status).toBe(403);
    });

    it('should return 404 (bypassing 403) when admin tries to GET /api/admin/non-existent-endpoint', async () => {
      const res = await request(app)
        .get('/api/admin/non-existent-endpoint')
        .set('Authorization', `Bearer ${tokenAdmin}`);
      
      expect(res.status).toBe(404);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                     4. ROLE TAMPERING VIA REQUEST BODY                     */
  /* -------------------------------------------------------------------------- */
  describe('Role and Privilege Tampering Protection', () => {
    it('should ignore role/privilege tampering parameters during profile updates', async () => {
      const res = await request(app)
        .put(`/api/users/${userA._id}`)
        .set('Authorization', `Bearer ${tokenA}`)
        .send({
          name: 'Updated Name A',
          role: 'admin',
          roles: ['admin'],
          permissions: ['users:manage'],
          isAdmin: true,
          __proto__: { isAdmin: true }
        });

      expect(res.status).toBe(200);

      const freshUserA = await User.findById(userA._id);
      expect(freshUserA.name).toBe('Updated Name A');
      // Role and permissions must remain unchanged
      expect(freshUserA.role).toBe('student');
      expect(freshUserA.roles).toContain('student');
      expect(freshUserA.roles).not.toContain('admin');
      expect(freshUserA.permissions).toEqual([]);
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                       5. BROKEN FUNCTION-LEVEL AUTH                        */
  /* -------------------------------------------------------------------------- */
  describe('Broken Function-Level Auth', () => {
    const sensitiveRoutes = [
      { method: 'get', path: '/api/users' },
      { method: 'get', path: '/api/roles' },
      { method: 'get', path: '/api/audit-logs' }
    ];

    sensitiveRoutes.forEach((route) => {
      it(`should reject unauthenticated request to ${route.method.toUpperCase()} ${route.path}`, async () => {
        const res = await request(app)[route.method](route.path);
        expect(res.status).toBe(401);
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                           6. PASSWORD RESET FLAWS                          */
  /* -------------------------------------------------------------------------- */
  describe('Password Reset Token Vulnerability Protections', () => {
    it('should allow resetting password with valid token, but reject reuse and expired attempts', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour in future

      // 1. Issue a reset token (requires admin/service authorization)
      const issueRes = await request(app)
        .post('/api/users/password-reset/request')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          email: userA.email,
          tokenHash,
          expiresAt
        });
      expect(issueRes.status).toBe(200);

      // 2. Confirm password reset with the token
      const confirmRes = await request(app)
        .post('/api/users/password-reset/confirm')
        .set('Origin', 'http://localhost:3000')
        .send({
          token: rawToken,
          password: 'NewSecurePassword1!'
        });
      expect(confirmRes.status).toBe(200);

      // 3. Confirm that using the same token a second time fails (token reuse)
      const reuseRes = await request(app)
        .post('/api/users/password-reset/confirm')
        .set('Origin', 'http://localhost:3000')
        .send({
          token: rawToken,
          password: 'AnotherPassword2!'
        });
      expect(reuseRes.status).toBe(400);
      expect(reuseRes.body.error).toBe('Reset link is invalid or expired');
    });

    it('should reject password reset attempts with an expired token', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() - 1000); // 1 second in the past

      // Issue token
      await request(app)
        .post('/api/users/password-reset/request')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          email: userA.email,
          tokenHash,
          expiresAt
        });

      // Attempt confirm with expired token
      const confirmRes = await request(app)
        .post('/api/users/password-reset/confirm')
        .set('Origin', 'http://localhost:3000')
        .send({
          token: rawToken,
          password: 'NewSecurePassword1!'
        });
      expect(confirmRes.status).toBe(400);
      expect(confirmRes.body.error).toBe('Reset link is invalid or expired');
    });

    it('should be immune to user ID manipulation since reset matches purely on token hash', async () => {
      const rawToken = crypto.randomBytes(32).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      // Issue token for User A
      await request(app)
        .post('/api/users/password-reset/request')
        .set('Authorization', `Bearer ${tokenAdmin}`)
        .send({
          email: userA.email,
          tokenHash,
          expiresAt
        });

      // Try resetting passing an extraneous userId/email for User B
      // Confirm request matches strictly on hash and does not let us cross-target User B
      const confirmRes = await request(app)
        .post('/api/users/password-reset/confirm')
        .set('Origin', 'http://localhost:3000')
        .send({
          token: rawToken,
          password: 'NewSecurePassword1!',
          userId: userB._id.toString(),
          email: userB.email
        });
      expect(confirmRes.status).toBe(200);

      // Verify User A password changed but User B remains untouched
      const freshUserB = await User.findById(userB._id);
      // Comparing password hash of User B to ensure it did not change to User A's new password
      const isUserBPassMatched = await require('bcryptjs').compare('NewSecurePassword1!', freshUserB.password);
      expect(isUserBPassMatched).toBe(false);
    });
  });
});
