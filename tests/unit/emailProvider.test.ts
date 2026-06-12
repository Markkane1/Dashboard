import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the provider classes
vi.mock('../../src/shared/email/providers/resend', () => {
  return {
    ResendProvider: class {
      type = 'resend';
      key: string;
      constructor(key: string) {
        this.key = key;
      }
    }
  };
});
vi.mock('../../src/shared/email/providers/sendgrid', () => {
  return {
    SendGridProvider: class {
      type = 'sendgrid';
      key: string;
      constructor(key: string) {
        this.key = key;
      }
    }
  };
});
vi.mock('../../src/shared/email/providers/smtp', () => {
  return {
    SmtpProvider: class {
      type = 'smtp';
    }
  };
});
vi.mock('../../src/shared/email/providers/console', () => {
  return {
    ConsoleProvider: class {
      type = 'console';
    }
  };
});

// Import the factory under test
import { getProvider, resetProviderCache } from '../../src/shared/email/getProvider';

describe('Email Provider Config Factory', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    resetProviderCache();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should create ResendProvider if EMAIL_PROVIDER is resend and RESEND_API_KEY is set (happy path)', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    process.env.RESEND_API_KEY = 're_12345';

    const provider = getProvider();
    expect(provider).toEqual({ type: 'resend', key: 're_12345' });
  });

  it('should throw an error if EMAIL_PROVIDER is resend but RESEND_API_KEY is missing (error path)', () => {
    process.env.EMAIL_PROVIDER = 'resend';
    delete process.env.RESEND_API_KEY;

    expect(() => getProvider()).toThrow('EMAIL_PROVIDER=resend but RESEND_API_KEY is not set');
  });

  it('should create SendGridProvider if EMAIL_PROVIDER is sendgrid and SENDGRID_API_KEY is set (happy path)', () => {
    process.env.EMAIL_PROVIDER = 'sendgrid';
    process.env.SENDGRID_API_KEY = 'SG.12345';

    const provider = getProvider();
    expect(provider).toEqual({ type: 'sendgrid', key: 'SG.12345' });
  });

  it('should throw an error if EMAIL_PROVIDER is sendgrid but SENDGRID_API_KEY is missing (error path)', () => {
    process.env.EMAIL_PROVIDER = 'sendgrid';
    delete process.env.SENDGRID_API_KEY;

    expect(() => getProvider()).toThrow('EMAIL_PROVIDER=sendgrid but SENDGRID_API_KEY is not set');
  });

  it('should create SmtpProvider if EMAIL_PROVIDER is smtp (happy path)', () => {
    process.env.EMAIL_PROVIDER = 'smtp';

    const provider = getProvider();
    expect(provider).toEqual({ type: 'smtp' });
  });

  it('should create ConsoleProvider if EMAIL_PROVIDER is console (happy path)', () => {
    process.env.EMAIL_PROVIDER = 'console';

    const provider = getProvider();
    expect(provider).toEqual({ type: 'console' });
  });

  it('should return the same cached provider instance on subsequent calls (happy path caching)', () => {
    process.env.EMAIL_PROVIDER = 'console';

    const provider1 = getProvider();
    const provider2 = getProvider();

    expect(provider1).toBe(provider2);
  });

  it('should reset cache and allow creating a new provider instance (cache reset path)', () => {
    process.env.EMAIL_PROVIDER = 'console';
    const providerConsole = getProvider();
    expect(providerConsole).toEqual({ type: 'console' });

    resetProviderCache();

    process.env.EMAIL_PROVIDER = 'smtp';
    const providerSmtp = getProvider();
    expect(providerSmtp).toEqual({ type: 'smtp' });
  });

  describe('Auto-detection logic', () => {
    beforeEach(() => {
      // Clear EMAIL_PROVIDER to trigger auto-detection
      delete process.env.EMAIL_PROVIDER;
      delete process.env.RESEND_API_KEY;
      delete process.env.SENDGRID_API_KEY;
      delete process.env.SMTP_HOST;
    });

    it('should auto-detect Resend first if RESEND_API_KEY is available', () => {
      process.env.RESEND_API_KEY = 're_auto';
      process.env.SENDGRID_API_KEY = 'sg_ignored';

      const provider = getProvider();
      expect(provider).toEqual({ type: 'resend', key: 're_auto' });
    });

    it('should auto-detect SendGrid second if RESEND_API_KEY is missing but SENDGRID_API_KEY is available', () => {
      process.env.SENDGRID_API_KEY = 'sg_auto';
      process.env.SMTP_HOST = 'smtp.ignored.com';

      const provider = getProvider();
      expect(provider).toEqual({ type: 'sendgrid', key: 'sg_auto' });
    });

    it('should auto-detect SMTP third if only SMTP_HOST is available', () => {
      process.env.SMTP_HOST = 'smtp.auto.com';

      const provider = getProvider();
      expect(provider).toEqual({ type: 'smtp' });
    });

    it('should default to ConsoleProvider in non-production when no configuration exists', () => {
      process.env.NODE_ENV = 'development';

      const provider = getProvider();
      expect(provider).toEqual({ type: 'console' });
    });

    it('should throw an error in production if no credentials exist', () => {
      process.env.NODE_ENV = 'production';

      expect(() => getProvider()).toThrow(
        'No email provider configured for production. ' +
        'Set EMAIL_PROVIDER (resend|sendgrid|smtp|console) and matching credentials.'
      );
    });
  });
});
