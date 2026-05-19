import ExcelJS from 'exceljs';
import { OUTPUT_LAYOUT, type PivotTableConfig } from '@/config/report-schema';
import type { ProcessResult, PivotResult } from '@/services/data-processor';

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1F4E78' },
};
const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
};
const TOTAL_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFE7E6E6' },
};
const SUBHEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FFF2F2F2' },
};

function parseAnchor(anchor: string): { col: number; row: number } {
  const match = anchor.match(/^([A-Z]+)(\d+)$/);
  if (!match) throw new Error(`Invalid anchor: ${anchor}`);
  const [, colLetters, rowStr] = match;
  let col = 0;
  for (const c of colLetters) col = col * 26 + (c.charCodeAt(0) - 64);
  return { col, row: Number(rowStr) };
}

function thinBorder(): Partial<ExcelJS.Borders> {
  const side: ExcelJS.Border = { style: 'thin', color: { argb: 'FFBFBFBF' } };
  return { top: side, left: side, right: side, bottom: side };
}

function applyBorder(sheet: ExcelJS.Worksheet, row: number, col: number) {
  sheet.getCell(row, col).border = thinBorder();
  sheet.getCell(row, col + 1).border = thinBorder();
}

/**
 * Tulis 1 pivot table sesuai layout user:
 *   - Tanpa extra filter (12 baris): Bucket | empty | header | 8 area | total
 *   - Dengan extra filter (13 baris): Bucket | Filter | empty | header | 8 area | total
 *
 * Kalau jumlah AREA di master ≠ 8, kita pad/truncate supaya tinggi tabel tetap fix
 * (anchor cell tabel di bawahnya tidak boleh shifted).
 */
function writeTable(
  sheet: ExcelJS.Worksheet,
  config: PivotTableConfig,
  pivot: PivotResult,
) {
  const { col, row } = parseAnchor(config.anchor);
  const hasFilter = config.extraFilter !== null;
  const areaSlots = OUTPUT_LAYOUT.areaRows;

  let r = row;

  // Row: Bucket header
  sheet.getCell(r, col).value = 'Bucket';
  sheet.getCell(r, col + 1).value = config.bucketLabel;
  for (const c of [col, col + 1]) {
    const cell = sheet.getCell(r, c);
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { horizontal: 'left', vertical: 'middle' };
    cell.border = thinBorder();
  }
  r++;

  // Row: Filter tambahan (kalau ada)
  if (hasFilter) {
    const filter = config.extraFilter!;
    sheet.getCell(r, col).value = filter.displayLabel;
    sheet.getCell(r, col + 1).value =
      filter.values.length > 1 ? '(Multiple Items)' : filter.values[0];
    for (const c of [col, col + 1]) {
      const cell = sheet.getCell(r, c);
      cell.fill = SUBHEADER_FILL;
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'left', vertical: 'middle' };
      cell.border = thinBorder();
    }
    r++;
  }

  // Row: blank separator (sesuai requirement user — baris kosong setelah filter)
  applyBorder(sheet, r, col);
  r++;

  // Row: Row Labels header
  sheet.getCell(r, col).value = 'Row Labels';
  sheet.getCell(r, col + 1).value = 'Count of NO KONTRAK';
  for (const c of [col, col + 1]) {
    const cell = sheet.getCell(r, c);
    cell.fill = SUBHEADER_FILL;
    cell.font = { bold: true };
    cell.border = thinBorder();
  }
  r++;

  // Rows: 8 baris area (zero-fill / truncate supaya tinggi fix)
  const slots = pivot.rows.slice(0, areaSlots);
  for (let i = 0; i < areaSlots; i++) {
    const entry = slots[i];
    sheet.getCell(r, col).value = entry?.area ?? '';
    sheet.getCell(r, col + 1).value = entry ? entry.count : null;
    sheet.getCell(r, col + 1).numFmt = '#,##0';
    applyBorder(sheet, r, col);
    r++;
  }

  // Row: Grand Total
  sheet.getCell(r, col).value = 'Grand Total';
  sheet.getCell(r, col + 1).value = pivot.grandTotal;
  sheet.getCell(r, col + 1).numFmt = '#,##0';
  for (const c of [col, col + 1]) {
    const cell = sheet.getCell(r, c);
    cell.fill = TOTAL_FILL;
    cell.font = { bold: true };
    cell.border = thinBorder();
  }
}

export async function generateReport(
  outputPath: string,
  result: ProcessResult,
): Promise<void> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'daily-mcs-backend';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet(OUTPUT_LAYOUT.sheetName);

  for (const pivot of result.pivots) {
    writeTable(sheet, pivot.table, pivot);
  }

  // Set lebar kolom yang dipakai (A,B,D,E,G,H) supaya area name nggak kepotong.
  // Index 1-based di ExcelJS.
  const widths: Record<number, number> = {
    1: 22, // A
    2: 22, // B
    4: 22, // D
    5: 22, // E
    7: 22, // G
    8: 22, // H
  };
  for (const [colIdx, width] of Object.entries(widths)) {
    sheet.getColumn(Number(colIdx)).width = width;
  }

  await workbook.xlsx.writeFile(outputPath);
}
