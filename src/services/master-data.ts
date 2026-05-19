import ExcelJS from 'exceljs';
import { prisma } from '@/lib/prisma';
import { unprocessable } from '@/lib/errors';
import { MASTER_SCHEMA } from '@/config/report-schema';
import { normalizeCell, stringifyKey } from '@/lib/excel-cell';

export type ImportSummary = {
  batchId: string;
  rowCount: number;
  activated: boolean;
};

/**
 * Parse master Excel → simpan sebagai batch baru. Kalau activate=true,
 * matikan batch lama supaya cuma satu yang aktif.
 */
export async function importMasterFromExcel(
  filePath: string,
  options: { label: string; sourceFile?: string; activate: boolean },
): Promise<ImportSummary> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(filePath);

  const sheet = MASTER_SCHEMA.sheetName
    ? workbook.getWorksheet(MASTER_SCHEMA.sheetName)
    : workbook.worksheets[0];

  if (!sheet) {
    throw unprocessable('Sheet master data tidak ditemukan');
  }

  const headerRow = sheet.getRow(MASTER_SCHEMA.headerRow);
  const headers: string[] = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    const v = normalizeCell(cell.value);
    headers[col] = v == null ? '' : String(v).trim();
  });

  if (!headers.includes(MASTER_SCHEMA.keyColumn)) {
    throw unprocessable(
      `Kolom key "${MASTER_SCHEMA.keyColumn}" tidak ditemukan di master`,
      { found: headers.filter(Boolean) },
    );
  }

  const entries: { lookupKey: string; payload: Record<string, unknown> }[] = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= MASTER_SCHEMA.headerRow) return;
    const payload: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: true }, (cell, col) => {
      const h = headers[col];
      if (!h) return;
      payload[h] = normalizeCell(cell.value);
    });
    const key = stringifyKey(payload[MASTER_SCHEMA.keyColumn]);
    if (!key) return;
    entries.push({ lookupKey: key, payload });
  });

  if (entries.length === 0) {
    throw unprocessable('File master kosong / semua key invalid');
  }

  const result = await prisma.$transaction(async (tx) => {
    const batch = await tx.masterDataBatch.create({
      data: {
        label: options.label,
        sourceFile: options.sourceFile ?? null,
        rowCount: entries.length,
        isActive: false,
      },
    });

    // Bulk insert dalam chunk supaya gak overload Postgres dengan param.
    const CHUNK = 500;
    for (let i = 0; i < entries.length; i += CHUNK) {
      const slice = entries.slice(i, i + CHUNK);
      await tx.masterDataEntry.createMany({
        data: slice.map((e) => ({
          batchId: batch.id,
          lookupKey: e.lookupKey,
          payload: e.payload as object,
        })),
      });
    }

    if (options.activate) {
      await tx.masterDataBatch.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      await tx.masterDataBatch.update({
        where: { id: batch.id },
        data: { isActive: true, activatedAt: new Date() },
      });
    }

    return batch;
  });

  return {
    batchId: result.id,
    rowCount: entries.length,
    activated: options.activate,
  };
}

export async function activateBatch(batchId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const batch = await tx.masterDataBatch.findUnique({ where: { id: batchId } });
    if (!batch) throw unprocessable('Batch tidak ditemukan');
    await tx.masterDataBatch.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    await tx.masterDataBatch.update({
      where: { id: batchId },
      data: { isActive: true, activatedAt: new Date() },
    });
  });
}

/**
 * Aktifkan batch berdasarkan label. Kalau ada lebih dari 1 batch dengan
 * label sama (jarang, tapi mungkin), pakai yang paling baru di-create.
 */
export async function activateBatchByLabel(label: string): Promise<{ id: string; label: string }> {
  return prisma.$transaction(async (tx) => {
    const batch = await tx.masterDataBatch.findFirst({
      where: { label },
      orderBy: { createdAt: 'desc' },
    });
    if (!batch) {
      throw unprocessable(`Tidak ada batch dengan label "${label}"`);
    }
    await tx.masterDataBatch.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    await tx.masterDataBatch.update({
      where: { id: batch.id },
      data: { isActive: true, activatedAt: new Date() },
    });
    return { id: batch.id, label: batch.label };
  });
}

export async function listBatches() {
  return prisma.masterDataBatch.findMany({
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      label: true,
      sourceFile: true,
      rowCount: true,
      isActive: true,
      createdAt: true,
      activatedAt: true,
    },
  });
}

/**
 * Diagnostic: ambil sample isi master aktif untuk membandingkan format key
 * dengan daily report. Berguna saat drop rate tinggi.
 */
export async function previewActiveMaster(limit = 10) {
  const active = await prisma.masterDataBatch.findFirst({
    where: { isActive: true },
    orderBy: { activatedAt: 'desc' },
  });
  if (!active) return null;

  const entries = await prisma.masterDataEntry.findMany({
    where: { batchId: active.id, isActive: true },
    take: limit,
    select: { lookupKey: true, payload: true },
  });

  const areaSet = new Set<string>();
  const bucketSet = new Set<string>();
  const allEntries = await prisma.masterDataEntry.findMany({
    where: { batchId: active.id, isActive: true },
    select: { payload: true },
  });
  for (const e of allEntries) {
    const p = e.payload as Record<string, unknown>;
    if (p['AREA'] != null) areaSet.add(String(p['AREA']).trim());
    if (p['BUCKET'] != null) bucketSet.add(String(p['BUCKET']).trim());
  }

  return {
    batch: {
      id: active.id,
      label: active.label,
      rowCount: active.rowCount,
      activatedAt: active.activatedAt,
    },
    samples: entries.map((e) => ({
      lookupKey: e.lookupKey,
      payload: e.payload,
    })),
    uniqueAreas: [...areaSet].sort(),
    uniqueBuckets: [...bucketSet].sort(),
  };
}
