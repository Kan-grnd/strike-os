-- AlterTable
ALTER TABLE "approvals" ADD COLUMN     "missionId" TEXT,
ADD COLUMN     "operationId" TEXT,
ADD COLUMN     "requestedBy" TEXT,
ADD COLUMN     "resolutionNote" TEXT,
ADD COLUMN     "scope" TEXT NOT NULL DEFAULT 'OPERATION',
ADD COLUMN     "taskId" TEXT,
ADD COLUMN     "trigger" TEXT NOT NULL DEFAULT 'ESCALATION';

-- CreateIndex
CREATE INDEX "approvals_missionId_idx" ON "approvals"("missionId");

-- CreateIndex
CREATE INDEX "approvals_operationId_idx" ON "approvals"("operationId");
