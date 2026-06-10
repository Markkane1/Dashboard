import { z } from "zod";

const envSchema = z
  .object({
    AUTH_SECRET: z.string().min(32, "AUTH_SECRET must be at least 32 characters").optional(),
    NEXTAUTH_SECRET: z.string().min(32, "NEXTAUTH_SECRET must be at least 32 characters").optional(),
    OAUTH_ALLOWED_DOMAINS: z.string().optional().default(""),
  })
  .superRefine((value, context) => {
    if (!value.AUTH_SECRET && !value.NEXTAUTH_SECRET) {
      context.addIssue({
        code: "custom",
        message: "AUTH_SECRET or NEXTAUTH_SECRET must be set",
        path: ["AUTH_SECRET"],
      });
    }

    if (value.AUTH_SECRET && value.NEXTAUTH_SECRET && value.AUTH_SECRET !== value.NEXTAUTH_SECRET) {
      context.addIssue({
        code: "custom",
        message: "AUTH_SECRET and NEXTAUTH_SECRET must match when both are set",
        path: ["AUTH_SECRET"],
      });
    }
  })
  .transform((value) => ({
    AUTH_SECRET: value.AUTH_SECRET || value.NEXTAUTH_SECRET!,
    OAUTH_ALLOWED_DOMAINS: value.OAUTH_ALLOWED_DOMAINS,
  }));

export const env = envSchema.parse({
  AUTH_SECRET: process.env.AUTH_SECRET,
  NEXTAUTH_SECRET: process.env.NEXTAUTH_SECRET,
  OAUTH_ALLOWED_DOMAINS: process.env.OAUTH_ALLOWED_DOMAINS,
});
