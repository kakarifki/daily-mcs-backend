import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  API_KEY: z.string().min(16, 'API_KEY harus minimal 16 karakter'),
  DATABASE_URL: z.string().url(),
  UPLOAD_DIR: z.string().default('./storage/uploads'),
  OUTPUT_DIR: z.string().default('./storage/outputs'),
  MAX_UPLOAD_MB: z.coerce.number().default(20),
  /**
   * Public URL backend ini saat di-akses dari browser, misal
   * https://api.domainmu.com. Kalau di-set, OpenAPI `servers` akan
   * pakai ini langsung — anti-confused dengan Cloudflare Flexible
   * yang kirim x-forwarded-proto=http meski user akses via https.
   * Optional: kalau gak di-set, kita derive dari header request.
   */
  PUBLIC_URL: z.string().url().optional(),
});

const parsed = envSchema.safeParse(Bun.env);

if (!parsed.success) {
  console.error('Env tidak valid:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;
export const isProd = env.NODE_ENV === 'production';
