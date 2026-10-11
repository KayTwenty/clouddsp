-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Job" (
    "id" UUID NOT NULL,
    "filename" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "deviceId" TEXT NOT NULL,
    "output" TEXT NOT NULL,
    "modFormat" TEXT,
    "preset" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'awaiting_upload',
    "stage" TEXT,
    "percent" INTEGER,
    "error" TEXT,
    "notes" TEXT[],
    "inputKey" TEXT NOT NULL,
    "outputs" JSONB NOT NULL DEFAULT '[]',
    "preview" JSONB,
    "live" JSONB,
    "leaseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Job_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");
