import { Hono } from 'hono';
import { z } from 'zod';
import { zValidator } from '@hono/zod-validator';
import { saveUpload } from '@/lib/storage';
import { env } from '@/config/env';
import { badRequest } from '@/lib/errors';
import {
  importMasterFromExcel,
  activateBatch,
  activateBatchByLabel,
  listBatches,
  previewActiveMaster,
} from '@/services/master-data';

export const masterRoutes = new Hono();

const uploadQuery = z.object({
  label: z.string().min(1).max(100),
  activate: z
    .union([z.literal('true'), z.literal('false')])
    .default('true')
    .transform((v) => v === 'true'),
});

masterRoutes.post('/upload', zValidator('query', uploadQuery), async (c) => {
  const { label, activate } = c.req.valid('query');
  const form = await c.req.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    throw badRequest('Field "file" wajib di-upload sebagai multipart');
  }
  if (file.size > env.MAX_UPLOAD_MB * 1024 * 1024) {
    throw badRequest(`File melebihi batas ${env.MAX_UPLOAD_MB}MB`);
  }

  const buf = await file.arrayBuffer();
  const path = await saveUpload(file.name, buf);

  const summary = await importMasterFromExcel(path, {
    label,
    sourceFile: file.name,
    activate,
  });

  return c.json({ ok: true, ...summary });
});

masterRoutes.get('/batches', async (c) => {
  const batches = await listBatches();
  return c.json({ data: batches });
});

masterRoutes.get('/preview', async (c) => {
  const preview = await previewActiveMaster(10);
  if (!preview) {
    return c.json({ error: 'Belum ada master aktif' }, 404);
  }
  return c.json(preview);
});

masterRoutes.post(
  '/batches/:id/activate',
  zValidator('param', z.object({ id: z.string().min(1) })),
  async (c) => {
    const { id } = c.req.valid('param');
    await activateBatch(id);
    return c.json({ ok: true });
  },
);

masterRoutes.post(
  '/activate',
  zValidator('json', z.object({ label: z.string().min(1) })),
  async (c) => {
    const { label } = c.req.valid('json');
    const activated = await activateBatchByLabel(label);
    return c.json({ ok: true, activated });
  },
);
