import type ExcelJS from 'exceljs';

/**
 * Normalisasi nilai cell ExcelJS jadi primitive yang bisa di-stringify konsisten.
 * Excel cell bisa berupa:
 *   - primitive: number, string, boolean, Date
 *   - rich text: { richText: [...] }  → punya .text
 *   - formula:   { formula, result }  → kita ambil .result
 *   - hyperlink: { hyperlink, text }  → ambil .text
 *   - error:     { error: '#N/A' }    → biarkan jadi null
 */
export function normalizeCell(value: ExcelJS.CellValue): unknown {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return value;
  if (typeof value !== 'object') return value;

  if ('error' in value) return null;
  if ('text' in value && typeof value.text === 'string') return value.text;
  if ('richText' in value && Array.isArray(value.richText)) {
    return value.richText.map((r) => r.text ?? '').join('');
  }
  if ('result' in value) {
    return normalizeCell(value.result as ExcelJS.CellValue);
  }
  return value;
}

/**
 * Stringify konsisten untuk lookup key & filter value.
 * Number, boolean, Date semua diubah ke string lalu di-trim.
 * Penting: harus DIPAKAI DI KEDUA SISI lookup (master & daily) supaya key match.
 */
export function stringifyKey(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}
