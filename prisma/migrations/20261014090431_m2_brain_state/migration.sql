-- CreateTable
CREATE TABLE "brain_state" (
    "id" TEXT NOT NULL DEFAULT 'brain',
    "state" TEXT NOT NULL DEFAULT 'idle',
    "detail" TEXT,
    "missionId" TEXT,
    "taskId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brain_state_pkey" PRIMARY KEY ("id")
);
