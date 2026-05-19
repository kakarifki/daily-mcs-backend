-- AlterTable
ALTER TABLE "ProcessingJob" ADD COLUMN     "inputFileName" TEXT,
ADD COLUMN     "label" TEXT;

-- CreateIndex
CREATE INDEX "ProcessingJob_label_idx" ON "ProcessingJob"("label");
