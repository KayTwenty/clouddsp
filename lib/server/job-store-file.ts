import "server-only";

import { randomUUID } from "node:crypto";
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DAY_MS, type Job, type JobStore, type NewJob, type WorkerInfo } from "./jobs";

// Zero-setup dev store: one JSON file per job under .data/jobs. Used when no
// DATABASE_URL is set. Fine for one local worker; production uses Postgres.
// Worker heartbeats only live in memory, which is all a dev server needs.

const JOBS_DIR = path.join(process.cwd(), ".data", "jobs");

const globalForWorkers = globalThis as unknown as { cloudDspWorkers?: Map<string, WorkerInfo> };
const workers = (globalForWorkers.cloudDspWorkers ??= new Map());

function jobFile(id: string) {
  if (!/^[0-9a-f-]{36}$/.test(id)) throw new Error("Invalid job id");
  return path.join(JOBS_DIR, `${id}.json`);
}

async function getJob(id: string): Promise<Job | null> {
  try {
    return JSON.parse(await readFile(jobFile(id), "utf8")) as Job;
  } catch {
    return null;
  }
}

async function saveJob(job: Job) {
  await mkdir(JOBS_DIR, { recursive: true });
  job.updatedAt = Date.now();
  const target = jobFile(job.id);
  const tmp = `${target}.${process.pid}.tmp`;
  await writeFile(tmp, JSON.stringify(job));
  // Windows refuses to replace a file another request is reading at that
  // instant, which happens with live progress polling. Retry briefly.
  for (let attempt = 0; ; attempt++) {
    try {
      await rename(tmp, target);
      break;
    } catch (e) {
      if (attempt >= 10 || (e as NodeJS.ErrnoException).code !== "EPERM") throw e;
      await new Promise((r) => setTimeout(r, 20));
    }
  }
  return job;
}

async function listJobs(): Promise<Job[]> {
  let files: string[];
  try {
    files = await readdir(JOBS_DIR);
  } catch {
    return [];
  }
  const jobs = await Promise.all(
    files.filter((f) => f.endsWith(".json")).map((f) => getJob(f.slice(0, -5))),
  );
  return jobs.filter((j): j is Job => j !== null).sort((a, b) => a.createdAt - b.createdAt);
}

export const fileStore: JobStore = {
  getJob,
  saveJob,

  async createJob(input: NewJob, inputKey: (id: string) => string) {
    const id = randomUUID();
    const now = Date.now();
    return saveJob({
      ...input,
      id,
      status: "awaiting_upload",
      notes: [],
      inputKey: inputKey(id),
      outputs: [],
      createdAt: now,
      updatedAt: now,
    });
  },

  async claimNextJob(leaseMs, workerId) {
    const now = Date.now();
    const job = (await listJobs()).find(
      (j) => j.status === "queued" || (j.status === "processing" && (j.leaseUntil ?? 0) < now),
    );
    if (!job) return null;
    job.status = "processing";
    job.stage = "claimed";
    job.percent = 0;
    job.live = undefined;
    job.leaseUntil = now + leaseMs;
    job.workerId = workerId ?? undefined;
    job.startedAt = now;
    return saveJob(job);
  },

  async heartbeat(worker) {
    workers.set(worker.id, { ...worker, lastSeen: Date.now() });
  },

  async listWorkers(since) {
    return [...workers.values()].filter((w) => w.lastSeen >= since);
  },

  async stats() {
    const jobs = await listJobs();
    const since = Date.now() - DAY_MS;
    const recent = jobs.filter((j) => (j.finishedAt ?? 0) >= since);
    const done = recent.filter((j) => j.status === "done" && j.startedAt);
    return {
      queued: jobs.filter((j) => j.status === "queued").length,
      processing: jobs.filter((j) => j.status === "processing").length,
      done24h: done.length,
      failed24h: recent.filter((j) => j.status === "failed").length,
      avgSeconds24h: done.length
        ? done.reduce((sum, j) => sum + (j.finishedAt! - j.startedAt!), 0) / done.length / 1000
        : null,
    };
  },
};
