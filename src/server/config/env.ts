const { z } = require('zod');

const preprocessEmpty = (schema: any) => z.preprocess((val: any) => val === '' ? undefined : val, schema);

const envSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
    MONGODB_URI: preprocessEmpty(z.string().optional()),
    AUTH_SECRET: preprocessEmpty(z.string().min(32, 'AUTH_SECRET must be at least 32 characters').optional()),
    NEXTAUTH_SECRET: preprocessEmpty(z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters').optional()),
    NEXTAUTH_URL: preprocessEmpty(z.string().url('NEXTAUTH_URL must be a valid URL').optional()),
    APP_URL: preprocessEmpty(z.string().url('APP_URL must be a valid URL').optional()),
    CORS_ALLOWED_ORIGINS: preprocessEmpty(z.string().optional()),
    API_RATE_LIMIT_WINDOW_MS: preprocessEmpty(z.string().optional()),
    API_RATE_LIMIT_MAX: preprocessEmpty(z.string().optional()),
    AUTH_RATE_LIMIT_WINDOW_MS: preprocessEmpty(z.string().optional()),
    AUTH_RATE_LIMIT_MAX: preprocessEmpty(z.string().optional()),
    CLIENT_LOG_RATE_LIMIT_WINDOW_MS: preprocessEmpty(z.string().optional()),
    CLIENT_LOG_RATE_LIMIT_MAX: preprocessEmpty(z.string().optional()),
    EMAIL_PROVIDER: preprocessEmpty(z.enum(['resend', 'sendgrid', 'smtp', 'console']).optional().default('console')),
    VIDEO_STORAGE: z.preprocess(
      (val: any) => val === '' || val === undefined ? undefined : String(val).toLowerCase(),
      z.enum(['local', 's3', 'minio', 'azure']).optional().default('local')
    ),
    LOCAL_VIDEO_DIR: preprocessEmpty(z.string().optional().default('uploads/videos')),
    VIDEO_MAX_UPLOAD_SIZE_BYTES: preprocessEmpty(z.string().optional().transform((val: string | undefined) => val ? parseInt(val, 10) : 524288000)),
  })
  .superRefine((value: {
    NODE_ENV: string;
    MONGODB_URI?: string;
    AUTH_SECRET?: string;
    NEXTAUTH_SECRET?: string;
    NEXTAUTH_URL?: string;
    APP_URL?: string;
    CORS_ALLOWED_ORIGINS?: string;
  }, context: any) => {
    const hasSecret = value.AUTH_SECRET || value.NEXTAUTH_SECRET;

    if (value.NODE_ENV === 'production') {
      if (!hasSecret) {
        context.addIssue({
          code: 'custom',
          message: 'AUTH_SECRET or NEXTAUTH_SECRET must be set in production mode',
          path: ['AUTH_SECRET']
        });
      }
      if (!value.MONGODB_URI) {
        context.addIssue({
          code: 'custom',
          message: 'MONGODB_URI must be set in production mode',
          path: ['MONGODB_URI']
        });
      }
      if (!value.NEXTAUTH_URL) {
        context.addIssue({
          code: 'custom',
          message: 'NEXTAUTH_URL must be set in production mode',
          path: ['NEXTAUTH_URL']
        });
      }
      if (!value.APP_URL) {
        context.addIssue({
          code: 'custom',
          message: 'APP_URL must be set in production mode',
          path: ['APP_URL']
        });
      }
      if (!value.CORS_ALLOWED_ORIGINS) {
        context.addIssue({
          code: 'custom',
          message: 'CORS_ALLOWED_ORIGINS must be set in production mode',
          path: ['CORS_ALLOWED_ORIGINS']
        });
      }
    }

    if (value.AUTH_SECRET && value.NEXTAUTH_SECRET && value.AUTH_SECRET !== value.NEXTAUTH_SECRET) {
      context.addIssue({
        code: 'custom',
        message: 'AUTH_SECRET and NEXTAUTH_SECRET must match when both are set',
        path: ['AUTH_SECRET']
      });
    }
  })
  .transform((value: any) => ({
    NODE_ENV: value.NODE_ENV,
    MONGODB_URI: value.MONGODB_URI,
    AUTH_SECRET: value.AUTH_SECRET || value.NEXTAUTH_SECRET,
    NEXTAUTH_URL: value.NEXTAUTH_URL,
    APP_URL: value.APP_URL,
    CORS_ALLOWED_ORIGINS: value.CORS_ALLOWED_ORIGINS,
    EMAIL_PROVIDER: value.EMAIL_PROVIDER,
    VIDEO_STORAGE: value.VIDEO_STORAGE,
    LOCAL_VIDEO_DIR: value.LOCAL_VIDEO_DIR,
    VIDEO_MAX_UPLOAD_SIZE_BYTES: value.VIDEO_MAX_UPLOAD_SIZE_BYTES
  }));

const env = envSchema.parse({
  NODE_ENV: process.env.NODE_ENV,
  MONGODB_URI: process.env.MONGODB_URI,
  AUTH_SECRET: process.env.AUTH_SECRET,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  NEXTAUTH_URL: process.env.NEXTAUTH_URL,
  APP_URL: process.env.APP_URL,
  CORS_ALLOWED_ORIGINS: process.env.CORS_ALLOWED_ORIGINS,
  EMAIL_PROVIDER: process.env.EMAIL_PROVIDER,
  VIDEO_STORAGE: process.env.VIDEO_STORAGE,
  LOCAL_VIDEO_DIR: process.env.LOCAL_VIDEO_DIR,
  VIDEO_MAX_UPLOAD_SIZE_BYTES: process.env.VIDEO_MAX_UPLOAD_SIZE_BYTES
});

module.exports = { env };

export {};
