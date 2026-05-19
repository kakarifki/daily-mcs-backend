import ExcelJS from 'exceljs';
import { INPUT_SCHEMA } from '@/config/report-schema';
import { unprocessable } from '@/lib/errors';
import { normalizeCell } from '@/lib/excel-cell';

export type RawRow = {
  /** Index 1-based di Excel (untuk pesan error yang ramah user). */
  rowNumber: number;
  /** Map header → cell value. */
  data: Record<string, unknown>;
};

export type ParseResult = {
  headers: string[];
  rows: RawRow[];
  totalRows: number;
};

export async function parseExcel(filePath: string): Promise<ParseResult> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = INPUT_SCHEMA.sheetName
    ? workbook.getWorksheet(INPUT_SCHEMA.sheetName)
    : workbook.worksheets[0];

  if (!sheet) {
    throw unprocessable(
      `Sheet "${INPUT_SCHEMA.sheetName ?? '(pertama)'}" tidak ditemukan di file`,
    );
  }

  const headerRow = sheet.getRow(INPUT_SCHEMA.headerRow);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, colNumber) => {
    const v = normalizeCell(cell.value);
    headers[colNumber] = v == null ? '' : String(v).trim();
  });

  const requiredCols = [INPUT_SCHEMA.lookupColumn];
  const missing = requiredCols.filter((c) => !headers.includes(c));
  if (missing.length > 0) {
    throw unprocessable(`Kolom wajib tidak ditemukan di file: ${missing.join(', ')}`, {
      expected: requiredCols,
      found: headers.filter(Boolean),
    });
  }

  // Kolom filter tambahan opsional — kalau hilang, filter yang merujuk ke
  // kolom itu akan menghasilkan tabel kosong, dan kita warn supaya user sadar.
  const optionalCols = [
    INPUT_SCHEMA.hasilPenangananColumn,
    INPUT_SCHEMA.autoFillColumn,
  ];
  const missingOptional = optionalCols.filter((c) => !headers.includes(c));
  if (missingOptional.length > 0) {
    console.warn(
      `[parser] Kolom filter berikut tidak ditemukan, tabel terkait akan kosong: ${missingOptional.join(', ')}`,
    );
  }

  const rows: RawRow[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= INPUT_SCHEMA.headerRow) return;

    const data: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const header = headers[colNumber];
      if (!header) return;
      data[header] = normalizeCell(cell.value);
    });

    rows.push({ rowNumber, data });
  });

  return {
    headers: headers.filter(Boolean),
    rows,
    totalRows: rows.length,
  };
}
