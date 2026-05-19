import type { ErrorHandler } from 'hono';
import { ZodError } from 'zod';
import { AppError } from '@/lib/errors';
import { isProd } from '@/config/env';

export const errorHandler: ErrorHandler = (err, c) => {
  if (err instanceof AppError) {
    return c.json(
      {
        error: err.message,
        code: err.code,
        details: err.details,
      },
      err.status as never,
    );
  }

  if (err instanceof ZodError) {
    return c.json(
      {
        error: 'Validasi gagal',
        code: 'VALIDATION_ERROR',
        details: err.flatten(),
      },
      422,
    );
  }

  console.error('[unhandled]', err);

  return c.json(
    {
      error: isProd ? 'Internal server error' : err.message,
      code: 'INTERNAL_ERROR',
    },
    500,
  );
};
