const { z } = require('zod');

const envSchema = z.object({
  AUTH_SECRET: z.string().min(32, 'AUTH_SECRET must be at least 32 characters')
});

const env = envSchema.parse({
  AUTH_SECRET: process.env.AUTH_SECRET
});

module.exports = { env };
