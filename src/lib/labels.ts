import { basename, extname } from 'node:path';

/**
 * Auto-derive label laporan dari nama file upload-an user.
 * Contoh:
 *   "Laporan Harian 19 Mei 2026.xlsx" → "Laporan Harian 19 Mei 2026"
 *   "daily_2026-05-19_v2.xlsx"        → "daily 2026-05-19 v2"
 *
 * Tujuannya supaya list /api/reports gampang di-scan tanpa harus inget jobId.
 */
export function deriveReportLabel(filename: string): string {
  const stem = basename(filename, extname(filename));
  return stem
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 120);
}
