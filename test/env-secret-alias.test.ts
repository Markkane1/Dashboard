const assert = require('node:assert/strict');
const { afterEach, describe, it } = require('node:test');

const envModulePath = require.resolve('../src/server/config/env');
const originalAuthSecret = process.env.AUTH_SECRET;
const originalNextAuthSecret = process.env.NEXTAUTH_SECRET;

afterEach(() => {
  restoreEnv();
  delete require.cache[envModulePath];
});

describe('shared auth secret environment config', () => {
  it('uses NEXTAUTH_SECRET as a legacy alias for AUTH_SECRET', () => {
    const secret = 'nextauth-secret-value-with-32-characters';

    const env = loadServerEnv({ nextAuthSecret: secret });

    assert.equal(env.AUTH_SECRET, secret);
  });

  it('rejects mismatched AUTH_SECRET and NEXTAUTH_SECRET values', () => {
    assert.throws(
      () => loadServerEnv({
        authSecret: 'auth-secret-value-with-32-characters',
        nextAuthSecret: 'nextauth-secret-value-with-32-chars'
      }),
      /AUTH_SECRET and NEXTAUTH_SECRET must match/
    );
  });
});

function loadServerEnv(input: { authSecret?: string; nextAuthSecret?: string }) {
  restoreEnv();
  delete require.cache[envModulePath];

  if (input.authSecret) {
    process.env.AUTH_SECRET = input.authSecret;
  } else {
    delete process.env.AUTH_SECRET;
  }

  if (input.nextAuthSecret) {
    process.env.NEXTAUTH_SECRET = input.nextAuthSecret;
  } else {
    delete process.env.NEXTAUTH_SECRET;
  }

  return require('../src/server/config/env').env;
}

function restoreEnv() {
  if (originalAuthSecret === undefined) {
    delete process.env.AUTH_SECRET;
  } else {
    process.env.AUTH_SECRET = originalAuthSecret;
  }

  if (originalNextAuthSecret === undefined) {
    delete process.env.NEXTAUTH_SECRET;
  } else {
    process.env.NEXTAUTH_SECRET = originalNextAuthSecret;
  }
}

export {};
