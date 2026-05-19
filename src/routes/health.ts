import { Hono } from 'hono';
import { prisma } from '@/lib/prisma';

export const healthRoutes = new Hono();

healthRoutes.get('/', (c) => c.json({ ok: true, ts: new Date().toISOString() }));

healthRoutes.get('/ready', async (c) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return c.json({ ok: true, db: 'up' });
  } catch (err) {
    return c.json(
      {
        ok: false,
        db: 'down',
        error: err instanceof Error ? err.message : String(err),
      },
      503,
    );
  }
});
