/**
 * OpenAPI 3.0 spec — manual-tulis supaya nggak butuh codegen / decorator.
 * Kalau ada endpoint baru, append di bawah. Swagger UI di /docs akan auto-pickup.
 */
export const baseSpec = {
  openapi: '3.0.3',
  info: {
    title: 'daily-mcs-backend',
    version: '0.1.0',
    description:
      'Automation laporan harian Excel. Upload master + daily report → dapat .xlsx 9 pivot table.',
  },
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
        description:
          'Set value-nya sama dengan API_KEY di .env. Klik tombol Authorize di pojok kanan atas, paste, lalu Authorize.',
      },
    },
    schemas: {
      Error: {
        type: 'object',
        properties: {
          error: { type: 'string' },
          code: { type: 'string' },
          details: {},
        },
      },
      MasterBatch: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string' },
          sourceFile: { type: 'string', nullable: true },
          rowCount: { type: 'integer' },
          isActive: { type: 'boolean' },
          createdAt: { type: 'string', format: 'date-time' },
          activatedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
      ProcessingJob: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          label: { type: 'string', nullable: true },
          inputFileName: { type: 'string', nullable: true },
          status: {
            type: 'string',
            enum: ['PENDING', 'PROCESSING', 'SUCCESS', 'FAILED'],
          },
          inputRows: { type: 'integer', nullable: true },
          droppedRows: { type: 'integer', nullable: true },
          outputRows: { type: 'integer', nullable: true },
          errorMessage: { type: 'string', nullable: true },
          startedAt: { type: 'string', format: 'date-time' },
          finishedAt: { type: 'string', format: 'date-time', nullable: true },
        },
      },
    },
  },
  security: [{ ApiKeyAuth: [] }],
  paths: {
    '/health': {
      get: {
        tags: ['Health'],
        summary: 'Liveness probe',
        security: [],
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    ts: { type: 'string', format: 'date-time' },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/health/ready': {
      get: {
        tags: ['Health'],
        summary: 'Readiness probe (cek DB)',
        security: [],
        responses: {
          '200': { description: 'DB up' },
          '503': { description: 'DB down' },
        },
      },
    },
    '/api/master/upload': {
      post: {
        tags: ['Master Data'],
        summary: 'Upload master Excel (header di baris ke-4, kolom: NO, NO KONTRAK, AREA, BUCKET)',
        parameters: [
          {
            name: 'label',
            in: 'query',
            required: true,
            schema: { type: 'string' },
            example: 'Mei-2026',
          },
          {
            name: 'activate',
            in: 'query',
            required: false,
            schema: { type: 'string', enum: ['true', 'false'], default: 'true' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Berhasil',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    batchId: { type: 'string' },
                    rowCount: { type: 'integer' },
                    activated: { type: 'boolean' },
                  },
                },
              },
            },
          },
          '422': {
            description: 'File invalid (kolom hilang, dst.)',
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/Error' } },
            },
          },
        },
      },
    },
    '/api/master/batches': {
      get: {
        tags: ['Master Data'],
        summary: 'List semua batch master',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/MasterBatch' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/api/master/preview': {
      get: {
        tags: ['Master Data'],
        summary: 'Sample isi master aktif (untuk diagnose mismatch)',
        description:
          'Return 10 sample entry + list unique AREA & BUCKET. Pakai ini kalau drop rate VLOOKUP tinggi — bandingkan format key dengan daily report.',
        responses: {
          '200': { description: 'OK' },
          '404': { description: 'Belum ada master aktif' },
        },
      },
    },
    '/api/master/batches/{id}/activate': {
      post: {
        tags: ['Master Data'],
        summary: 'Aktifkan batch berdasarkan ID (presisi)',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': { description: 'OK' },
          '422': { description: 'Batch tidak ditemukan' },
        },
      },
    },
    '/api/master/activate': {
      post: {
        tags: ['Master Data'],
        summary: 'Aktifkan batch berdasarkan label (lebih ramah dipakai dari UI)',
        description:
          'Pakai ini kalau lebih nyaman ngacu ke label (misal "Mei-2026") daripada ID. Kalau ada beberapa batch dengan label sama, yang paling baru yang diaktifkan.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['label'],
                properties: { label: { type: 'string', example: 'Mei-2026' } },
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Aktivasi sukses',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    activated: {
                      type: 'object',
                      properties: {
                        id: { type: 'string' },
                        label: { type: 'string' },
                      },
                    },
                  },
                },
              },
            },
          },
          '422': { description: 'Label tidak ditemukan' },
        },
      },
    },
    '/api/reports/process': {
      post: {
        tags: ['Reports'],
        summary: 'Upload daily report → generate file 9 pivot table',
        description:
          'Wajib ada master aktif. File daily harus punya kolom NO KONTRAK. Kolom HASIL PENANGANAN & AUTO_FILL opsional (kalau hilang, tabel terkait keluar 0).',
        requestBody: {
          required: true,
          content: {
            'multipart/form-data': {
              schema: {
                type: 'object',
                properties: {
                  file: { type: 'string', format: 'binary' },
                },
                required: ['file'],
              },
            },
          },
        },
        responses: {
          '200': {
            description: 'Sukses, return ringkasan + downloadUrl',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    ok: { type: 'boolean' },
                    jobId: { type: 'string' },
                    summary: {
                      type: 'object',
                      properties: {
                        inputRows: { type: 'integer' },
                        droppedRows: { type: 'integer' },
                        enrichedRows: { type: 'integer' },
                        areas: { type: 'array', items: { type: 'string' } },
                        pivots: {
                          type: 'array',
                          items: {
                            type: 'object',
                            properties: {
                              id: { type: 'string' },
                              bucketLabel: { type: 'string' },
                              extraFilter: { type: 'string', nullable: true },
                              grandTotal: { type: 'integer' },
                            },
                          },
                        },
                      },
                    },
                    downloadUrl: { type: 'string' },
                  },
                },
              },
            },
          },
          '422': { description: 'Master belum di-upload, atau file tidak valid' },
        },
      },
    },
    '/api/reports/{id}/download': {
      get: {
        tags: ['Reports'],
        summary: 'Download hasil .xlsx',
        parameters: [
          { name: 'id', in: 'path', required: true, schema: { type: 'string' } },
        ],
        responses: {
          '200': {
            description: 'File Excel',
            content: {
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
                schema: { type: 'string', format: 'binary' },
              },
            },
          },
          '404': { description: 'Job atau file tidak ditemukan' },
        },
      },
    },
    '/api/reports': {
      get: {
        tags: ['Reports'],
        summary: 'List 50 job terakhir',
        responses: {
          '200': {
            description: 'OK',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    data: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/ProcessingJob' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
} as const;

/**
 * Bangun OpenAPI spec dengan `servers` dinamis berdasarkan URL request masuk.
 * Penting di balik reverse proxy (Cloudflare/Traefik) — Swagger UI akan
 * pakai server URL yang sama dengan dari mana user akses /docs, bukan
 * hardcoded localhost:3000.
 */
export function buildOpenApiSpec(requestUrl: string) {
  let serverUrl = 'http://localhost:3000';
  try {
    const u = new URL(requestUrl);
    serverUrl = `${u.protocol}//${u.host}`;
  } catch {
    // fallback to default
  }
  return {
    ...baseSpec,
    servers: [{ url: serverUrl, description: 'Current host' }],
  };
}
