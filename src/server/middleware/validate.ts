import type { Request, Response } from 'express';
import type { ZodError, ZodType } from 'zod';

function formatZodError(error: ZodError) {
  return error.issues.map((issue) => ({
    field: issue.path.join('.') || 'body',
    message: issue.message,
  }));
}

function validateBody<T>(schema: ZodType<T>, req: Request, res: Response): T | null {
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid request.',
      details: formatZodError(parsed.error),
    });
    return null;
  }

  return parsed.data;
}

module.exports = {
  validateBody,
};

export {};
