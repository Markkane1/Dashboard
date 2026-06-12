const request = require('supertest');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const app = require('../../src/server/server');
const User = require('../../src/server/models/User').default || require('../../src/server/models/User');
const { connectDB, disconnectDB, generateToken } = require('../integration/setup');
const { signApiAccessToken } = require('../../src/shared/auth/apiToken');

// Mock audit logging
jest.mock('../../src/server/services/audit', () => ({
  writeAuditLog: jest.fn().mockResolvedValue(true)
}));

describe('JWT Security Integration Tests', () => {
  let testUser;
  let validToken;
  let payload;
  const SECRET = process.env.AUTH_SECRET || 'test_secret';

  // Generate a temporary RSA key pair for testing algorithm switching (RS256)
  const { privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: {
      type: 'pkcs8',
      format: 'pem'
    },
    publicKeyEncoding: {
      type: 'spki',
      format: 'pem'
    }
  });

  // Representative set of protected routes across different Express routers
  const protectedRoutes = [
    { method: 'get', path: '/api/users/me' },
    { method: 'get', path: '/api/notifications' },
    { method: 'get', path: '/api/certificates/approvals' },
    { method: 'get', path: '/api/analytics/overview' },
    { method: 'get', path: '/api/audit-logs' }
  ];

  beforeAll(async () => {
    await connectDB();

    testUser = await User.create({
      name: 'Security Test User',
      email: 'security@example.com',
      password: 'password123',
      role: 'admin',
      permissions: ['users:manage', 'audit-logs:view', 'notifications:announce', 'certificates:approve', 'analytics:view'],
      status: 'active'
    });

    payload = {
      id: testUser._id.toString(),
      email: testUser.email,
      role: testUser.role,
      roles: [testUser.role],
      permissions: testUser.permissions,
      tokenUse: 'api'
    };

    validToken = generateToken(testUser);
  }, 20000);

  afterAll(async () => {
    await disconnectDB();
  }, 20000);

  /**
   * Helper to execute a request on a route with an Authorization header
   */
  async function makeRequest(route, tokenHeader) {
    const req = request(app);
    const methodCall = route.method === 'get' ? req.get(route.path) : req.post(route.path);
    if (tokenHeader !== null) {
      methodCall.set('Authorization', tokenHeader);
    }
    return methodCall;
  }

  /* -------------------------------------------------------------------------- */
  /*                      1. ALGORITHM CONFUSION (alg: none)                    */
  /* -------------------------------------------------------------------------- */
  describe('Algorithm Confusion - alg:none', () => {
    function craftAlgNoneToken(pl) {
      const header = { alg: 'none', typ: 'JWT' };
      const headerB64 = Buffer.from(JSON.stringify(header)).toString('base64url');
      const payloadB64 = Buffer.from(JSON.stringify(pl)).toString('base64url');
      return `${headerB64}.${payloadB64}.`;
    }

    protectedRoutes.forEach((route) => {
      it(`should return 401 for alg:none on ${route.method.toUpperCase()} ${route.path}`, async () => {
        const token = craftAlgNoneToken(payload);
        const res = await makeRequest(route, `Bearer ${token}`);
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Authentication failed. Token is invalid or expired.');
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                          2. ALGORITHM SWITCHING                            */
  /* -------------------------------------------------------------------------- */
  describe('Algorithm Switching', () => {
    protectedRoutes.forEach((route) => {
      it(`should return 401 for token claiming RS256 algorithm on ${route.method.toUpperCase()} ${route.path}`, async () => {
        // Sign token with RS256 using the RSA private key
        const token = jwt.sign(payload, privateKey, {
          algorithm: 'RS256'
        });

        const res = await makeRequest(route, `Bearer ${token}`);
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Authentication failed. Token is invalid or expired.');
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                             3. INVALID SIGNATURE                           */
  /* -------------------------------------------------------------------------- */
  describe('Invalid Signature', () => {
    protectedRoutes.forEach((route) => {
      it(`should return 401 for token with modified signature on ${route.method.toUpperCase()} ${route.path}`, async () => {
        const parts = validToken.split('.');
        const signature = parts[2];
        const modifiedSignature = signature.slice(0, -3) + (signature.slice(-3) === 'abc' ? 'xyz' : 'abc');
        const token = `${parts[0]}.${parts[1]}.${modifiedSignature}`;

        const res = await makeRequest(route, `Bearer ${token}`);
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Authentication failed. Token is invalid or expired.');
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                               4. EXPIRED TOKEN                             */
  /* -------------------------------------------------------------------------- */
  describe('Expired Token', () => {
    protectedRoutes.forEach((route) => {
      it(`should return 401 for expired token on ${route.method.toUpperCase()} ${route.path}`, async () => {
        const expiredToken = jwt.sign(
          Object.assign({}, payload, { exp: Math.floor(Date.now() / 1000) - 10 }),
          SECRET
        );

        const res = await makeRequest(route, `Bearer ${expiredToken}`);
        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Authentication failed. Token is invalid or expired.');
      });
    });
  });

  /* -------------------------------------------------------------------------- */
  /*                             5. MISSING exp CLAIM                           */
  /* -------------------------------------------------------------------------- */
  describe('Missing exp Claim Check', () => {
    it('should verify that generated production API access tokens always contain an exp claim', () => {
      const token = signApiAccessToken({
        id: testUser._id.toString(),
        email: testUser.email,
        role: testUser.role,
        roles: [testUser.role],
        permissions: testUser.permissions
      });

      const decoded = jwt.decode(token);
      expect(decoded).toHaveProperty('exp');
      expect(typeof decoded.exp).toBe('number');
      expect(decoded.exp).toBeGreaterThan(Math.floor(Date.now() / 1000));
    });
  });
});
