import type { MiddlewareHandler } from 'hono';
import { env } from '@/config/env';
import { unauthorized } from '@/lib/errors';

export const apiKeyAuth: MiddlewareHandler = async (c, next) => {
  const provided = c.req.header('x-api-key');

  if (!provided || provided !== env.API_KEY) {
    throw unauthorized('API key tidak valid atau hilang');
  }

  await next();
};
