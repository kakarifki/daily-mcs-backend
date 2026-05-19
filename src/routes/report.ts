import { Hono } from 'hono';
import { stat } from 'node:fs/promises';
import { basename } from 'node:path';
import { prisma } from '@/lib/prisma';
import { env } from '@/config/env';
import { reserveOutputPath, saveUpload } from '@/lib/storage';
import { badRequest, notFound } from '@/lib/errors';
import { deriveReportLabel } from '@/lib/labels';
import { parseExcel } from '@/services/excel-parser';
import { processRows } from '@/services/data-processor';
import { generateReport } from '@/services/excel-generator';

export const reportRoutes = new Hono();

reportRoutes.post('/process', async (c) => {
  const form = await c.req.formData();
  const file = form.get('file');

  if (!(file instanceof File)) {
    throw badRequest('Field "file" wajib di-upload sebagai multipart');
  }
  if (file.size > env.MAX_UPLOAD_MB * 1024 * 1024) {
    throw badRequest(`File melebihi batas ${env.MAX_UPLOAD_MB}MB`);
  }

  const inputPath = await saveUpload(file.name, await file.arrayBuffer());
  const label = deriveReportLabel(file.name);
  const job = await prisma.processingJob.create({
    data: {
      status: 'PROCESSING',
      label,
      inputFile: inputPath,
      inputFileName: file.name,
    },
  });

  try {
    const parsed = await parseExcel(inputPath);
    const result = await processRows(parsed.rows);

    const outputPath = await reserveOutputPath(`report-${Date.now()}.xlsx`);
    await generateReport(outputPath, result);

    const updated = await prisma.processingJob.update({
      where: { id: job.id },
      data: {
        status: 'SUCCESS',
        outputFile: outputPath,
        inputRows: parsed.totalRows,
        droppedRows: result.droppedRows,
        outputRows: result.enrichedRows,
        finishedAt: new Date(),
      },
    });

    return c.json({
      ok: true,
      jobId: updated.id,
      label: updated.label,
      summary: {
        inputFileName: updated.inputFileName,
        inputRows: parsed.totalRows,
        droppedRows: result.droppedRows,
        enrichedRows: result.enrichedRows,
        areas: result.areas,
        pivots: result.pivots.map((p) => ({
          id: p.table.id,
          bucketLabel: p.table.bucketLabel,
          extraFilter: p.table.extraFilter?.column ?? null,
          grandTotal: p.grandTotal,
        })),
        // Diagnostic: kalau drop rate > 50%, tampilkan sample key supaya
        // user bisa bandingkan format daily vs master.
        diagnostic:
          result.inputRows > 0 && result.droppedRows / result.inputRows > 0.5
            ? {
                hint:
                  'Drop rate tinggi — kemungkinan format NO KONTRAK di daily ≠ master. Bandingkan key di bawah lalu cek /api/master/preview.',
                sampleFromInput: result.mismatch.fromInput,
                sampleFromMaster: result.mismatch.fromMaster,
              }
            : null,
      },
      downloadUrl: `/api/reports/${updated.id}/download`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.processingJob.update({
      where: { id: job.id },
      data: {
        status: 'FAILED',
        errorMessage: message,
        finishedAt: new Date(),
      },
    });
    throw err;
  }
});

reportRoutes.get('/:id/download', async (c) => {
  const id = c.req.param('id');
  const job = await prisma.processingJob.findUnique({ where: { id } });
  if (!job || !job.outputFile) throw notFound('Report tidak ditemukan');

  await stat(job.outputFile).catch(() => {
    throw notFound('File output sudah terhapus dari disk');
  });

  const file = Bun.file(job.outputFile);
  return new Response(file, {
    headers: {
      'Content-Type':
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${basename(job.outputFile)}"`,
    },
  });
});

reportRoutes.get('/', async (c) => {
  const jobs = await prisma.processingJob.findMany({
    orderBy: { startedAt: 'desc' },
    take: 50,
    select: {
      id: true,
      label: true,
      inputFileName: true,
      status: true,
      inputRows: true,
      droppedRows: true,
      outputRows: true,
      errorMessage: true,
      startedAt: true,
      finishedAt: true,
    },
  });
  return c.json({ data: jobs });
});
