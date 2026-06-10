const { z } = require('zod');

const envSchema = z
  .object({
    AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters').optional(),
    NEXTAUTH_SECRET: z.string().min(32, 'NEXTAUTH_SECRET must be at least 32 characters').optional()
  })
  .superRefine((value: { AUTH_SECRET?: string; NEXTAUTH_SECRET?: string }, context: any) => {
    if (!value.AUTH_SECRET && !value.NEXTAUTH_SECRET) {
      context.addIssue({
        code: 'custom',
        message: 'AUTH_SECRET or NEXTAUTH_SECRET must be set',
        path: ['AUTH_SECRET']
      });
    }

    if (value.AUTH_SECRET && value.NEXTAUTH_SECRET && value.AUTH_SECRET !== value.NEXTAUTH_SECRET) {
      context.addIssue({
        code: 'custom',
        message: 'AUTH_SECRET and NEXTAUTH_SECRET must match when both are set',
        path: ['AUTH_SECRET']
      });
    }
  })
  .transform((value: { AUTH_SECRET?: string; NEXTAUTH_SECRET?: string }) => ({
    AUTH_SECRET: value.AUTH_SECRET || value.NEXTAUTH_SECRET
  }));

const env = envSchema.parse({
  AUTH_SECRET: process.env.AUTH_SECRET,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET
});

module.exports = { env };

export {};
