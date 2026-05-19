-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('PENDING', 'PROCESSING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "MasterDataEntry" (
    "id" TEXT NOT NULL,
    "lookupKey" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "batchId" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterDataEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MasterDataBatch" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sourceFile" TEXT,
    "rowCount" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "activatedAt" TIMESTAMP(3),

    CONSTRAINT "MasterDataBatch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessingJob" (
    "id" TEXT NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'PENDING',
    "inputFile" TEXT NOT NULL,
    "outputFile" TEXT,
    "inputRows" INTEGER,
    "droppedRows" INTEGER,
    "outputRows" INTEGER,
    "errorMessage" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "ProcessingJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MasterDataEntry_lookupKey_isActive_idx" ON "MasterDataEntry"("lookupKey", "isActive");

-- CreateIndex
CREATE INDEX "MasterDataEntry_batchId_idx" ON "MasterDataEntry"("batchId");

-- CreateIndex
CREATE INDEX "MasterDataBatch_isActive_idx" ON "MasterDataBatch"("isActive");

-- CreateIndex
CREATE INDEX "ProcessingJob_status_idx" ON "ProcessingJob"("status");

-- CreateIndex
CREATE INDEX "ProcessingJob_startedAt_idx" ON "ProcessingJob"("startedAt");

-- AddForeignKey
ALTER TABLE "MasterDataEntry" ADD CONSTRAINT "MasterDataEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "MasterDataBatch"("id") ON DELETE CASCADE ON UPDATE CASCADE;
