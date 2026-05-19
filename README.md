# daily-mcs-backend

Backend service untuk automation laporan harian: upload file Excel mentah → VLOOKUP ke master → output 1 file Excel berisi 9 pivot table di koordinat fixed.

Stack: **Bun + Hono + Prisma + PostgreSQL + ExcelJS**.

---

## Quickstart pakai Docker (Recommended)

Cara paling cepat. Tidak perlu install Bun atau Postgres di laptop.

### 1. Siapkan file `.env`

```bash
cp .env.example .env
```

Edit isinya, terutama dua field ini:

```env
API_KEY=ganti-pakai-string-acak-min-16-karakter
POSTGRES_PASSWORD=ganti-juga-jangan-pakai-default
```

Generate API key cepat (Linux/Mac/Git Bash):

```bash
openssl rand -hex 32
```

Atau di PowerShell:

```powershell
[Convert]::ToHexString([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))
```

### 2. Jalankan stack-nya

**Pakai Docker Desktop UI:**

1. Buka Docker Desktop → tab **Containers**.
2. Cari group bernama `daily-mcs-backend`.
3. Klik tombol ▶ Start di sebelahnya. App + Postgres jalan barengan.

**Atau via terminal:**

```bash
docker compose up -d --build       # pertama kali (build image)
docker compose start               # selanjutnya cukup ini
```

Pertama kali build butuh ~3-5 menit. Selanjutnya cepat.

App akan listen di **http://localhost:3000** (kecuali kamu set `APP_PORT` lain di `.env`).

Cek log realtime:

```bash
docker compose logs -f app
```

Kalau muncul `> Swagger UI: http://localhost:3000/docs`, berarti sudah ready.

### 3. Test pakai Swagger UI (paling gampang)

Buka **http://localhost:3000/docs** di browser. Tampilannya seperti dokumentasi API biasa, tapi tiap endpoint bisa di-"Try it out" langsung.

Cara pakai:

1. Klik tombol **Authorize** (pojok kanan atas).
2. Paste API key dari `.env` kamu, klik **Authorize**, **Close**.
3. Buka endpoint yang mau ditest, klik **Try it out**.
4. Untuk upload file: klik **Choose File**, pilih Excel, isi parameter, klik **Execute**.
5. Response keluar di bawah lengkap dengan status code & body.

Workflow test full:

1. `POST /api/master/upload` → upload master (label = `Mei-2026`, activate = `true`, file = master.xlsx)
2. `POST /api/reports/process` → upload daily report
3. Copy `jobId` dari response → buka `GET /api/reports/{id}/download` → klik **Download file**

### 4. Test pakai Thunder Client (VS Code)

Kalau lebih suka di VS Code:

1. Install extension **Thunder Client**.
2. Buat New Request:
   - Method: `POST`
   - URL: `http://localhost:3000/api/master/upload?label=Mei-2026&activate=true`
   - Tab **Headers**: tambah `X-API-Key` = `<API_KEY dari .env>`
   - Tab **Body** → pilih **Form**, tambah field `file` dengan tipe `File`, attach master.xlsx
   - **Send**

3. Untuk daily report: ulangi dengan URL `/api/reports/process`, body sama.
4. Untuk download: New Request `GET http://localhost:3000/api/reports/<jobId>/download` dengan header `X-API-Key`. Thunder Client otomatis tawarkan save file.

Tip: bikin Environment di Thunder Client untuk simpan `apiKey` dan `baseUrl`, jadi tinggal pakai variable `{{apiKey}}` di header.

### 5. Test pakai curl (kalau mau cepat di terminal)

```bash
KEY=PASTE_API_KEY_KAMU

# Upload master
curl -X POST "http://localhost:3000/api/master/upload?label=Mei-2026&activate=true" \
  -H "X-API-Key: $KEY" \
  -F "file=@/path/ke/master.xlsx"

# Process daily
curl -X POST http://localhost:3000/api/reports/process \
  -H "X-API-Key: $KEY" \
  -F "file=@/path/ke/daily.xlsx"

# Download (jobId dari response sebelumnya)
curl -OJ -H "X-API-Key: $KEY" \
  http://localhost:3000/api/reports/<jobId>/download
```

### Stop / restart / clean up

Lewat Docker Desktop: tombol **Stop** / **Restart** di tab Containers.

Lewat terminal:

```bash
docker compose stop                # stop sementara, data tetap ada
docker compose start               # nyalakan lagi
docker compose down                # stop & remove container, data persist di volume
docker compose down -v             # ⚠️ stop + hapus DB & file storage (TIDAK BISA UNDO)
docker compose logs -f app         # lihat log
```

---

## Cara dev lokal tanpa Docker

Kalau mau ngoprek code dengan hot reload.

### Prasyarat

- Bun ≥ 1.1 (`curl -fsSL https://bun.sh/install | bash`)
- PostgreSQL running di lokal **atau** pakai DB dari `docker compose up -d db`

### Steps

```bash
bun install
cp .env.example .env             # edit DATABASE_URL & API_KEY
bunx prisma migrate dev --name init
bun run dev                      # auto-reload on save
```

Server jalan di `http://localhost:3000`.

### Script lain

```bash
bun run typecheck                # TS check, tanpa build
bun run db:studio                # buka Prisma Studio untuk inspect DB
bun run db:migrate               # bikin migration baru
```

---

## API Reference (untuk Frontend)

Semua endpoint di bawah `/api/*` butuh header:

```
X-API-Key: <API_KEY dari .env>
```

Endpoint `/health` & `/health/ready` **tidak** butuh auth.

### `POST /api/master/upload`

Upload master data Excel (header di baris ke-4, kolom: `NO`, `NO KONTRAK`, `AREA`, `BUCKET`).

**Query params:**

| param | tipe | default | keterangan |
|---|---|---|---|
| `label` | string | required | Nama batch, misal `"Mei-2026"` |
| `activate` | `"true"` / `"false"` | `"true"` | Auto-aktifkan batch ini & nonaktifkan yang lama |

**Body:** `multipart/form-data` dengan field `file` berisi `.xlsx`.

**Response:**

```json
{
  "ok": true,
  "batchId": "clx...",
  "rowCount": 1234,
  "activated": true
}
```

### `GET /api/master/batches`

List semua batch master (riwayat).

**Response:**

```json
{
  "data": [
    {
      "id": "clx...",
      "label": "Mei-2026",
      "sourceFile": "master-mei.xlsx",
      "rowCount": 1234,
      "isActive": true,
      "createdAt": "2026-05-01T00:00:00.000Z",
      "activatedAt": "2026-05-01T00:00:00.000Z"
    }
  ]
}
```

### `POST /api/master/batches/:id/activate`

Switch master aktif ke batch tertentu (rollback bulan lalu, dsb).

**Response:** `{ "ok": true }`

### `POST /api/reports/process`

Proses daily report. **Wajib ada master aktif.**

**Body:** `multipart/form-data` dengan field `file` (max 20 MB by default).

**Response sukses:**

```json
{
  "ok": true,
  "jobId": "clx...",
  "summary": {
    "inputRows": 5000,
    "droppedRows": 120,
    "enrichedRows": 4880,
    "areas": ["CIKARANG 1", "CIKARANG 2", "..."],
    "pivots": [
      { "id": "t1", "bucketLabel": "B. 1-30", "extraFilter": null, "grandTotal": 850 },
      { "id": "t2", "bucketLabel": "B. 1-30", "extraFilter": "HASIL PENANGANAN", "grandTotal": 320 }
    ]
  },
  "downloadUrl": "/api/reports/clx.../download"
}
```

**Response gagal (contoh master belum di-upload):**

```json
{
  "error": "Belum ada master data aktif. Upload master bulan ini lewat /api/master/upload dulu.",
  "code": "UNPROCESSABLE"
}
```

### `GET /api/reports/:id/download`

Download file hasil. Return binary `.xlsx` dengan `Content-Disposition: attachment`.

### `GET /api/reports`

List 50 job terakhir.

```json
{
  "data": [
    {
      "id": "clx...",
      "status": "SUCCESS",
      "inputRows": 5000,
      "droppedRows": 120,
      "outputRows": 4880,
      "errorMessage": null,
      "startedAt": "2026-05-19T...",
      "finishedAt": "2026-05-19T..."
    }
  ]
}
```

Status enum: `PENDING | PROCESSING | SUCCESS | FAILED`.

### `GET /health` & `/health/ready`

Liveness & readiness probe. Pakai `/health/ready` untuk Coolify health check.

---

## Snippet untuk Frontend (copas-ready)

### Setup di React/Vite

```ts
// src/lib/api.ts
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const API_KEY = import.meta.env.VITE_API_KEY ?? '';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...init,
    headers: {
      'X-API-Key': API_KEY,
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  uploadMaster: (file: File, label: string, activate = true) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<{ batchId: string; rowCount: number }>(
      `/api/master/upload?label=${encodeURIComponent(label)}&activate=${activate}`,
      { method: 'POST', body: fd },
    );
  },

  listBatches: () => request<{ data: MasterBatch[] }>('/api/master/batches'),

  activateBatch: (id: string) =>
    request<{ ok: true }>(`/api/master/batches/${id}/activate`, { method: 'POST' }),

  processReport: (file: File) => {
    const fd = new FormData();
    fd.append('file', file);
    return request<ProcessResponse>('/api/reports/process', {
      method: 'POST',
      body: fd,
    });
  },

  downloadUrl: (jobId: string) => `${BASE_URL}/api/reports/${jobId}/download`,
};

export type MasterBatch = {
  id: string;
  label: string;
  sourceFile: string | null;
  rowCount: number;
  isActive: boolean;
  createdAt: string;
  activatedAt: string | null;
};

export type ProcessResponse = {
  ok: true;
  jobId: string;
  summary: {
    inputRows: number;
    droppedRows: number;
    enrichedRows: number;
    areas: string[];
    pivots: Array<{
      id: string;
      bucketLabel: string;
      extraFilter: string | null;
      grandTotal: number;
    }>;
  };
  downloadUrl: string;
};
```

### Trigger download dari browser

Karena endpoint download butuh header `X-API-Key`, tidak bisa langsung pakai `<a href>`. Pakai fetch + blob:

```ts
async function downloadReport(jobId: string, filename = 'report.xlsx') {
  const res = await fetch(api.downloadUrl(jobId), {
    headers: { 'X-API-Key': API_KEY },
  });
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
```

### CORS

Backend sudah mengaktifkan `cors()` permissive untuk dev. Saat deploy production, kunci ke origin frontend kamu di [src/index.ts](src/index.ts):

```ts
app.use('*', cors({ origin: 'https://app.kamu.com' }));
```

---

## Deploy ke Coolify VPS

1. Push repo ini ke GitHub.
2. Di Coolify dashboard → **New Resource** → **Docker Compose**.
3. Tunjuk ke repo + branch, file `docker-compose.yml`.
4. Set Environment Variables di UI Coolify (jangan commit `.env`!):
   - `API_KEY`
   - `POSTGRES_PASSWORD`
   - `POSTGRES_USER` (optional, default `postgres`)
   - `POSTGRES_DB` (optional, default `daily_mcs`)
   - `MAX_UPLOAD_MB` (optional, default `20`)
5. Deploy. Migrasi Prisma jalan otomatis tiap container start.
6. Healthcheck path: `/health/ready`.

Volume `app_storage` (file upload/output) dan `db_data` (Postgres) sudah persistent — aman dari restart.

---

## Project structure

```text
src/
├── index.ts                # Hono entry, mount routes
├── config/
│   ├── env.ts              # Env loader (zod-validated)
│   └── report-schema.ts    # ⭐ Domain config — ubah di sini kalau struktur Excel/bucket berubah
├── lib/                    # Prisma, errors, storage helpers
├── middleware/             # API key auth, error handler
├── routes/                 # health, master, reports
└── services/
    ├── excel-parser.ts     # Baca daily Excel
    ├── master-data.ts      # Import & manage master batch
    ├── data-processor.ts   # VLOOKUP + filter + group-by-AREA
    └── excel-generator.ts  # Tulis 9 tabel di koordinat fixed
```

---

## Troubleshooting

**`API_KEY harus minimal 16 karakter`** saat startup → buka `.env`, set API_KEY ke string acak panjang.

**`Belum ada master data aktif`** saat process daily → upload master dulu dengan `?activate=true`.

**`Kolom wajib tidak ditemukan: NO KONTRAK`** → header daily report tidak punya kolom `NO KONTRAK` (perhatikan spasi & huruf besar). Kalau nama kolomnya beda, ubah di [src/config/report-schema.ts](src/config/report-schema.ts).

**Container restart loop** → cek `docker compose logs app`, biasanya soal env tidak valid atau DB belum ready (tunggu 10-15 detik).

**Port 3000 udah dipakai** → set `APP_PORT=3001` di `.env`, lalu `docker compose up -d`.
