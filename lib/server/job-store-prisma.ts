import "server-only";

import { Prisma, type Job as JobRow } from "@/generated/prisma/client";
import type { AudioFormat, ModFormat, Output, PresetId } from "@/lib/devices";
import { prisma } from "./db";
import {
  DAY_MS,
  type GpuSample,
  type Job,
  type JobLive,
  type JobOutput,
  type JobPreview,
  type JobStatus,
  type JobStore,
  type NewJob,
} from "./jobs";

// Production store on Prisma Postgres.

function toJob(row: JobRow): Job {
  return {
    id: row.id,
    filename: row.filename,
    size: row.size,
    deviceId: row.deviceId,
    output: row.output as Output,
    modFormat: (row.modFormat ?? undefined) as ModFormat | undefined,
    preset: row.preset as PresetId,
    format: row.format as AudioFormat,
    status: row.status as JobStatus,
    stage: row.stage ?? undefined,
    percent: row.percent ?? undefined,
    error: row.error ?? undefined,
    notes: row.notes,
    inputKey: row.inputKey,
    outputs: row.outputs as unknown as JobOutput[],
    preview: (row.preview ?? undefined) as unknown as JobPreview | undefined,
    live: (row.live ?? undefined) as unknown as JobLive | undefined,
    createdAt: row.createdAt.getTime(),
    updatedAt: row.updatedAt.getTime(),
    leaseUntil: row.leaseUntil?.getTime(),
    workerId: row.workerId ?? undefined,
    startedAt: row.startedAt?.getTime(),
    finishedAt: row.finishedAt?.getTime(),
  };
}

// Json columns need DbNull rather than undefined to be cleared.
const json = (value: unknown) =>
  value === undefined ? Prisma.DbNull : (value as Prisma.InputJsonValue);

export const prismaStore: JobStore = {
  async getJob(id) {
    if (!/^[0-9a-f-]{36}$/.test(id)) return null;
    const row = await prisma.job.findUnique({ where: { id } });
    return row ? toJob(row) : null;
  },

  async saveJob(job) {
    const row = await prisma.job.update({
      where: { id: job.id },
      data: {
        status: job.status,
        stage: job.stage ?? null,
        percent: job.percent ?? null,
        error: job.error ?? null,
        notes: job.notes,
        outputs: job.outputs as unknown as Prisma.InputJsonValue,
        preview: json(job.preview),
        live: json(job.live),
        leaseUntil: job.leaseUntil ? new Date(job.leaseUntil) : null,
        finishedAt: job.finishedAt ? new Date(job.finishedAt) : null,
      },
    });
    return toJob(row);
  },

  async createJob(input: NewJob, inputKey) {
    const id = crypto.randomUUID();
    const row = await prisma.job.create({
      data: { ...input, id, inputKey: inputKey(id), notes: [] },
    });
    return toJob(row);
  },

  // SKIP LOCKED lets any number of GPU workers poll at once without two of
  // them ever claiming the same job.
  async claimNextJob(leaseMs, workerId) {
    const leaseUntil = new Date(Date.now() + leaseMs);
    const claimed = await prisma.$queryRaw<{ id: string }[]>`
      UPDATE "Job"
      SET status = 'processing', stage = 'claimed', percent = 0, live = NULL,
          "leaseUntil" = ${leaseUntil}, "workerId" = ${workerId},
          "startedAt" = NOW(), "updatedAt" = NOW()
      WHERE id = (
        SELECT id FROM "Job"
        WHERE status = 'queued' OR (status = 'processing' AND "leaseUntil" < NOW())
        ORDER BY "createdAt"
        LIMIT 1
        FOR UPDATE SKIP LOCKED
      )
      RETURNING id`;
    if (claimed.length === 0) return null;
    const row = await prisma.job.findUnique({ where: { id: claimed[0].id } });
    return row ? toJob(row) : null;
  },

  async heartbeat(worker) {
    const data = {
      name: worker.name,
      gpu: json(worker.gpu),
      status: worker.status,
      jobId: worker.jobId ?? null,
      lastSeen: new Date(),
    };
    await prisma.worker.upsert({
      where: { id: worker.id },
      create: { id: worker.id, ...data },
      update: data,
    });
  },

  async listWorkers(since) {
    const rows = await prisma.worker.findMany({
      where: { lastSeen: { gte: new Date(since) } },
      orderBy: { createdAt: "asc" },
    });
    return rows.map((w) => ({
      id: w.id,
      name: w.name,
      gpu: (w.gpu ?? undefined) as unknown as GpuSample | undefined,
      status: w.status as "idle" | "busy",
      jobId: w.jobId ?? undefined,
      lastSeen: w.lastSeen.getTime(),
    }));
  },

  async stats() {
    const since = new Date(Date.now() - DAY_MS);
    const [queued, processing, done24h, failed24h, timing] = await Promise.all([
      prisma.job.count({ where: { status: "queued" } }),
      prisma.job.count({ where: { status: "processing" } }),
      prisma.job.count({ where: { status: "done", finishedAt: { gte: since } } }),
      prisma.job.count({ where: { status: "failed", finishedAt: { gte: since } } }),
      prisma.$queryRaw<{ avg: number | null }[]>`
        SELECT AVG(EXTRACT(EPOCH FROM ("finishedAt" - "startedAt")))::float AS avg
        FROM "Job"
        WHERE status = 'done' AND "finishedAt" >= ${since} AND "startedAt" IS NOT NULL`,
    ]);
    return { queued, processing, done24h, failed24h, avgSeconds24h: timing[0]?.avg ?? null };
  },
};
