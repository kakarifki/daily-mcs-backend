import { prisma } from '@/lib/prisma';
import {
  INPUT_SCHEMA,
  MASTER_SCHEMA,
  PIVOT_TABLES,
  type PivotTableConfig,
} from '@/config/report-schema';
import type { RawRow } from '@/services/excel-parser';
import { unprocessable } from '@/lib/errors';
import { stringifyKey } from '@/lib/excel-cell';

export type EnrichedRow = {
  rowNumber: number;
  noKontrak: string;
  area: string;
  bucket: string;
  /** Original row data — dipakai untuk filter tambahan (HASIL PENANGANAN, AUTO_FILL, dst). */
  raw: Record<string, unknown>;
};

export type AreaCount = { area: string; count: number };

export type PivotResult = {
  table: PivotTableConfig;
  rows: AreaCount[];
  grandTotal: number;
};

export type Mismatch = {
  fromInput: string[];
  fromMaster: string[];
};

export type ProcessResult = {
  inputRows: number;
  enrichedRows: number;
  droppedRows: number;
  /** Daftar AREA unik dari master (sorted) — dipakai sebagai row labels tetap di tiap tabel. */
  areas: string[];
  pivots: PivotResult[];
  /** Sample key untuk diagnostic kalau drop rate tinggi. */
  mismatch: Mismatch;
};

type MasterEntry = {
  area: string;
  bucket: string;
};

/**
 * Cari nilai field di payload dengan toleransi case (BUCKET / bucket / Bucket).
 * Master Excel sering punya inkonsistensi case di header.
 */
function pickField(
  payload: Record<string, unknown>,
  candidates: readonly string[],
): string {
  for (const c of candidates) {
    if (c in payload) return stringifyKey(payload[c]);
  }
  const lowerMap = new Map(
    Object.keys(payload).map((k) => [k.toLowerCase(), k]),
  );
  for (const c of candidates) {
    const matched = lowerMap.get(c.toLowerCase());
    if (matched) return stringifyKey(payload[matched]);
  }
  return '';
}

async function loadActiveMaster(): Promise<{
  map: Map<string, MasterEntry>;
  areas: string[];
}> {
  const activeBatch = await prisma.masterDataBatch.findFirst({
    where: { isActive: true },
    orderBy: { activatedAt: 'desc' },
  });

  if (!activeBatch) {
    throw unprocessable(
      'Belum ada master data aktif. Upload master bulan ini lewat /api/master/upload dulu.',
    );
  }

  const entries = await prisma.masterDataEntry.findMany({
    where: { batchId: activeBatch.id, isActive: true },
    select: { lookupKey: true, payload: true },
  });

  const map = new Map<string, MasterEntry>();
  const areaSet = new Set<string>();

  for (const entry of entries) {
    const payload = entry.payload as Record<string, unknown>;
    const area = pickField(payload, ['AREA']);
    const bucket = pickField(payload, ['BUCKET']);
    if (!area || !bucket) continue;
    map.set(entry.lookupKey, { area, bucket });
    areaSet.add(area);
  }

  return {
    map,
    areas: [...areaSet].sort((a, b) =>
      a.localeCompare(b, 'id', { numeric: true }),
    ),
  };
}

function matchesFilter(row: EnrichedRow, table: PivotTableConfig): boolean {
  if (!table.bucketValues.includes(row.bucket)) return false;
  const extra = table.extraFilter;
  if (!extra) return true;
  // Filter pakai case-insensitive lookup juga, untuk konsistensi.
  const cell = pickField(row.raw, [extra.column]);
  return extra.values.some(
    (v) => v.toLowerCase() === cell.toLowerCase(),
  );
}

function buildPivot(
  rowsForTable: EnrichedRow[],
  areas: string[],
  table: PivotTableConfig,
): PivotResult {
  const counts = new Map<string, number>();
  for (const area of areas) counts.set(area, 0);

  let grand = 0;
  for (const row of rowsForTable) {
    counts.set(row.area, (counts.get(row.area) ?? 0) + 1);
    grand++;
  }

  const rows: AreaCount[] = areas.map((area) => ({
    area,
    count: counts.get(area) ?? 0,
  }));

  return { table, rows, grandTotal: grand };
}

export async function processRows(rawRows: RawRow[]): Promise<ProcessResult> {
  const { map: masterMap, areas } = await loadActiveMaster();

  const enriched: EnrichedRow[] = [];
  let dropped = 0;
  const sampleMissed: string[] = [];

  for (const row of rawRows) {
    const noKontrak = stringifyKey(row.data[INPUT_SCHEMA.lookupColumn]);
    if (!noKontrak) {
      dropped++;
      continue;
    }
    const master = masterMap.get(noKontrak);
    if (!master) {
      dropped++;
      if (sampleMissed.length < 5) sampleMissed.push(noKontrak);
      continue;
    }
    enriched.push({
      rowNumber: row.rowNumber,
      noKontrak,
      area: master.area,
      bucket: master.bucket,
      raw: row.data,
    });
  }

  const pivots = PIVOT_TABLES.map((table) => {
    const filtered = enriched.filter((r) => matchesFilter(r, table));
    return buildPivot(filtered, areas, table);
  });

  const sampleMaster = [...masterMap.keys()].slice(0, 5);

  return {
    inputRows: rawRows.length,
    enrichedRows: enriched.length,
    droppedRows: dropped,
    areas,
    pivots,
    mismatch: {
      fromInput: sampleMissed,
      fromMaster: sampleMaster,
    },
  };
}

export { MASTER_SCHEMA };
