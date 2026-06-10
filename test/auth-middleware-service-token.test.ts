const assert = require('node:assert/strict');
const { afterEach, before, describe, it } = require('node:test');
const jwt = require('jsonwebtoken');

Object.assign(process.env, {
  AUTH_SECRET: process.env.AUTH_SECRET || 'test-auth-secret-value-with-32-characters',
  LOG_LEVEL: 'silent'
});

const auth = require('../src/server/middleware/auth');

let originalFind: unknown;

type TestRequest = {
  headers: {
    authorization: string;
  };
  user?: {
    id: string;
    enrolledCourses?: string[];
    completedCourses?: string[];
  };
};

type TestResponse = {
  statusCode?: number;
  body?: unknown;
  status(code: number): TestResponse;
  json(body: unknown): TestResponse;
};

before(() => {
  const Enrollment = require('../src/server/models/Enrollment');
  originalFind = Enrollment.find;
});

afterEach(() => {
  const Enrollment = require('../src/server/models/Enrollment');
  Enrollment.find = originalFind;
});

describe('Express auth middleware service tokens', () => {
  it('does not query enrollments for non-ObjectId service token subjects', async () => {
    const Enrollment = require('../src/server/models/Enrollment');
    let queriedEnrollments = false;
    Enrollment.find = () => {
      queriedEnrollments = true;
      throw new Error('Enrollment lookup should not run for service tokens');
    };

    const req: TestRequest = {
      headers: {
        authorization: `Bearer ${signServiceToken()}`
      }
    };
    const res = createResponse();
    let nextCalled = false;

    await auth(req, res, () => {
      nextCalled = true;
    });

    assert.equal(res.statusCode, undefined);
    assert.equal(nextCalled, true);
    assert.equal(queriedEnrollments, false);
    assert.ok(req.user);
    const user = req.user!;
    assert.equal(user.id, 'internal-service');
    assert.deepEqual(user.enrolledCourses, []);
    assert.deepEqual(user.completedCourses, []);
  });
});

function signServiceToken() {
  return jwt.sign(
    {
      id: 'internal-service',
      email: 'service@internal.local',
      role: 'service',
      tokenUse: 'api'
    },
    process.env.AUTH_SECRET,
    {
      subject: 'internal-service',
      issuer: 'next-auth',
      audience: 'express-api',
      expiresIn: '5m'
    }
  );
}

function createResponse(): TestResponse {
  return {
    statusCode: undefined,
    body: undefined,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    }
  };
}

export {};
