import { mkdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { env } from '@/config/env';

export async function ensureDir(path: string): Promise<void> {
  await mkdir(path, { recursive: true });
}

export async function saveUpload(filename: string, data: ArrayBuffer): Promise<string> {
  await ensureDir(env.UPLOAD_DIR);
  const id = randomUUID();
  const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fullPath = resolve(join(env.UPLOAD_DIR, `${id}-${safeName}`));
  await Bun.write(fullPath, data);
  return fullPath;
}

export async function reserveOutputPath(filename: string): Promise<string> {
  await ensureDir(env.OUTPUT_DIR);
  const id = randomUUID();
  return resolve(join(env.OUTPUT_DIR, `${id}-${filename}`));
}
