import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Declare a hoisted spy for next/headers
const { mockHeadersGet } = vi.hoisted(() => {
  return {
    mockHeadersGet: vi.fn()
  };
});

vi.mock('next/headers', () => {
  return {
    headers: vi.fn().mockResolvedValue({
      get: mockHeadersGet
    })
  };
});

// Import the module under test
import { validateServerActionOrigin } from '../../src/shared/security/serverActionCsrf';

describe('Server Action CSRF Validation', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
    // Override NODE_ENV to force the validation logic to run
    process.env.NODE_ENV = 'production';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should pass if origin matches allowed origin (happy path)', async () => {
    process.env.NEXTAUTH_URL = 'https://dashboard.epa.gov';
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === 'origin') return 'https://dashboard.epa.gov';
      return null;
    });

    await expect(validateServerActionOrigin()).resolves.toBeUndefined();
  });

  it('should pass if origin is missing but referer matches allowed origin (happy path fallback)', async () => {
    process.env.NEXTAUTH_URL = 'https://dashboard.epa.gov';
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === 'origin') return null;
      if (key === 'referer') return 'https://dashboard.epa.gov/some/path';
      return null;
    });

    await expect(validateServerActionOrigin()).resolves.toBeUndefined();
  });

  it('should default allowed origin to localhost:3000 in development (happy path dev)', async () => {
    process.env.NODE_ENV = 'development';
    delete process.env.NEXTAUTH_URL;
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === 'origin') return 'http://localhost:3000';
      return null;
    });

    await expect(validateServerActionOrigin()).resolves.toBeUndefined();
  });

  it('should throw an error in production if NEXTAUTH_URL is missing (error path config)', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.NEXTAUTH_URL;

    await expect(validateServerActionOrigin()).rejects.toThrow(
      'NEXTAUTH_URL is required for server action origin validation.'
    );
  });

  it('should throw error if origin does not match allowed origin (sad/error path)', async () => {
    process.env.NEXTAUTH_URL = 'https://dashboard.epa.gov';
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === 'origin') return 'https://malicious-site.com';
      return null;
    });

    await expect(validateServerActionOrigin()).rejects.toThrow('Invalid server action origin.');
  });

  it('should throw error if origin is missing and referer does not match (sad/error path referer)', async () => {
    process.env.NEXTAUTH_URL = 'https://dashboard.epa.gov';
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === 'origin') return null;
      if (key === 'referer') return 'https://malicious-site.com/path';
      return null;
    });

    await expect(validateServerActionOrigin()).rejects.toThrow('Invalid server action origin.');
  });

  it('should handle malformed, unexpected, or invalid headers URLs gracefully (edge case)', async () => {
    process.env.NEXTAUTH_URL = 'https://dashboard.epa.gov';
    mockHeadersGet.mockImplementation((key: string) => {
      if (key === 'origin') return 'invalid-url-string';
      if (key === 'referer') return 'another-malformed-url';
      return null;
    });

    await expect(validateServerActionOrigin()).rejects.toThrow('Invalid server action origin.');
  });

  it('should return immediately without checks if NODE_ENV is test (skip behavior)', async () => {
    process.env.NODE_ENV = 'test';
    // Even with malformed header and mismatching allowed origins, it should succeed
    process.env.NEXTAUTH_URL = 'https://dashboard.epa.gov';
    mockHeadersGet.mockReturnValue('https://evil.com');

    await expect(validateServerActionOrigin()).resolves.toBeUndefined();
  });
});
