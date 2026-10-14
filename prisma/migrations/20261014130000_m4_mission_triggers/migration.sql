-- AlterTable
ALTER TABLE "automations" ADD COLUMN     "missionId" TEXT;

-- AlterTable
ALTER TABLE "missions" ADD COLUMN     "cadence" TEXT;

-- CreateIndex
CREATE INDEX "automations_missionId_idx" ON "automations"("missionId");

-- AddForeignKey
ALTER TABLE "automations" ADD CONSTRAINT "automations_missionId_fkey" FOREIGN KEY ("missionId") REFERENCES "missions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
