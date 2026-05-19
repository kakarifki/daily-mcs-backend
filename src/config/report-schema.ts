/**
 * Domain config — sesuaikan dengan struktur Excel kerjaan asli.
 * Pisahkan dari logic supaya mudah diubah tanpa nyentuh service.
 */

export const MASTER_SCHEMA = {
  /** Sheet master Excel yang dibaca. null = sheet pertama. */
  sheetName: null as string | null,
  /** Header master di baris ke-4 (ada title/metadata di atasnya). */
  headerRow: 4,
  /** Kolom yang dipakai sebagai key VLOOKUP. */
  keyColumn: 'NO KONTRAK',
  /** Kolom dari master yang akan ditarik ke daily report. */
  enrichColumns: ['AREA', 'BUCKET'] as const,
} as const;

export const INPUT_SCHEMA = {
  /** Nama sheet daily report yang dibaca. null = sheet pertama. */
  sheetName: null as string | null,
  /** Baris header daily report (1-indexed). */
  headerRow: 4,
  /** Kolom yang dipakai sebagai key VLOOKUP — harus sama dengan MASTER_SCHEMA.keyColumn. */
  lookupColumn: 'NO KONTRAK',
  /** Kolom-kolom yang dipakai untuk filter tambahan (selain BUCKET). */
  hasilPenangananColumn: 'HASIL PENANGANAN',
  autoFillColumn: 'AUTO_FILL',
} as const;

/**
 * Definisi tiap pivot table. Output 1 sheet, 9 tabel grid 3×3:
 *   sumbu vertikal = bucket group
 *   sumbu horizontal = filter tambahan
 *
 * `bucketValues`: list value di kolom BUCKET (master) yang termasuk grup ini.
 *                 Multi-value = OR (tabel 7-9 menggabungkan D & E).
 * `extraFilter`:  filter tambahan di atas filter bucket. null = tanpa filter.
 *                 Multi-value = OR.
 * `anchor`:       cell kiri-atas tabel.
 */
export type ExtraFilter = {
  column: string;
  values: readonly string[];
  /** Label yang ditulis di header tabel (kolom A pada baris filter). */
  displayLabel: string;
};

export type PivotTableConfig = {
  id: string;
  anchor: string;
  bucketLabel: string;
  bucketValues: readonly string[];
  extraFilter: ExtraFilter | null;
};

export const PIVOT_TABLES: readonly PivotTableConfig[] = [
  // Baris grid 1 — B. 1-30
  {
    id: 't1',
    anchor: 'A1',
    bucketLabel: 'B. 1-30',
    bucketValues: ['B. 1-30'],
    extraFilter: null,
  },
  {
    id: 't2',
    anchor: 'D1',
    bucketLabel: 'B. 1-30',
    bucketValues: ['B. 1-30'],
    extraFilter: {
      column: 'HASIL PENANGANAN',
      values: ['Titip Pesan', 'Belum terkunjungi'],
      displayLabel: 'HASIL PENANGANAN',
    },
  },
  {
    id: 't3',
    anchor: 'G1',
    bucketLabel: 'B. 1-30',
    bucketValues: ['B. 1-30'],
    extraFilter: {
      column: 'AUTO_FILL',
      values: ['YES'],
      displayLabel: 'AUTO_FILL',
    },
  },

  // Baris grid 2 — C. 31-60
  {
    id: 't4',
    anchor: 'A15',
    bucketLabel: 'C. 31-60',
    bucketValues: ['C. 31-60'],
    extraFilter: null,
  },
  {
    id: 't5',
    anchor: 'D15',
    bucketLabel: 'C. 31-60',
    bucketValues: ['C. 31-60'],
    extraFilter: {
      column: 'HASIL PENANGANAN',
      values: ['Titip Pesan', 'Belum terkunjungi'],
      displayLabel: 'HASIL PENANGANAN',
    },
  },
  {
    id: 't6',
    anchor: 'G15',
    bucketLabel: 'C. 31-60',
    bucketValues: ['C. 31-60'],
    extraFilter: {
      column: 'AUTO_FILL',
      values: ['YES'],
      displayLabel: 'AUTO_FILL',
    },
  },

  // Baris grid 3 — D. 61-90 & E. 91-120 (digabung)
  {
    id: 't7',
    anchor: 'A30',
    bucketLabel: 'D. 61-90 & E. 91-120',
    bucketValues: ['D. 61-90', 'E. 91-120'],
    extraFilter: null,
  },
  {
    id: 't8',
    anchor: 'D30',
    bucketLabel: 'D. 61-90 & E. 91-120',
    bucketValues: ['D. 61-90', 'E. 91-120'],
    extraFilter: {
      column: 'HASIL PENANGANAN',
      values: ['Titip Pesan', 'Belum terkunjungi'],
      displayLabel: 'HASIL PENANGANAN',
    },
  },
  {
    id: 't9',
    anchor: 'G30',
    bucketLabel: 'D. 61-90 & E. 91-120',
    bucketValues: ['D. 61-90', 'E. 91-120'],
    extraFilter: {
      column: 'AUTO_FILL',
      values: ['YES'],
      displayLabel: 'AUTO_FILL',
    },
  },
] as const;

export const OUTPUT_LAYOUT = {
  sheetName: 'Report',
  /**
   * Jumlah baris area per tabel (sebelum baris Grand Total).
   * Sesuai requirement: 8 baris area.
   */
  areaRows: 8,
} as const;
