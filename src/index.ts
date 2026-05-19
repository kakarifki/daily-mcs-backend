import { Hono } from 'hono';
import { logger } from 'hono/logger';
import { cors } from 'hono/cors';
import { swaggerUI } from '@hono/swagger-ui';
import { env } from '@/config/env';
import { openApiSpec } from '@/config/openapi';
import { errorHandler } from '@/middleware/error-handler';
import { apiKeyAuth } from '@/middleware/auth';
import { healthRoutes } from '@/routes/health';
import { masterRoutes } from '@/routes/master';
import { reportRoutes } from '@/routes/report';

const app = new Hono();

app.use('*', logger());
app.use('*', cors());

// Docs (public, no auth)
app.get('/openapi.json', (c) => c.json(openApiSpec));
app.get('/docs', swaggerUI({ url: '/openapi.json' }));

app.route('/health', healthRoutes);

const api = new Hono();
api.use('*', apiKeyAuth);
api.route('/master', masterRoutes);
api.route('/reports', reportRoutes);

app.route('/api', api);

app.onError(errorHandler);
app.notFound((c) => c.json({ error: 'Not found' }, 404));

export default {
  port: env.PORT,
  fetch: app.fetch,
  // ExcelJS bisa lambat untuk file besar — kasih ruang nafas.
  idleTimeout: 120,
};

console.log(`> daily-mcs-backend listening on :${env.PORT} (${env.NODE_ENV})`);
console.log(`> Swagger UI: http://localhost:${env.PORT}/docs`);
