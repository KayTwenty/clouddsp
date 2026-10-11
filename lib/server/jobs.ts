import "server-only";

import {
  LIVE_BUCKETS,
  STEMS,
  type AudioFormat,
  type ModFormat,
  type Output,
  type PresetId,
  type StemId,
} from "@/lib/devices";

// Job model and the queue operations. Where jobs live depends on the
// environment: Prisma Postgres when DATABASE_URL is set (Vercel), otherwise
// JSON files under .data/jobs for zero-setup local development.

const LEASE_MS = 2 * 60 * 1000;

export type JobStatus = "awaiting_upload" | "queued" | "processing" | "done" | "failed";

// `zipPath` is where the file goes in "download as zip" (a track folder, or the
// USB tree for native stems). `listed` files also get their own download button.
export type JobOutput = {
  name: string;
  key: string;
  size: number;
  zipPath?: string;
  listed?: boolean;
};

// Small streamable copies of each stem plus waveform peaks, for the in-browser
// stem player. Separate from the downloads, which are full quality.
export type JobPreview = {
  peaksKey: string;
  stems: { stem: StemId; key: string }[];
};

export type GpuSample = {
  name: string;
  util: number;
  memUsed: number;
  memTotal: number;
  temp?: number;
  power?: number;
};

// What the worker is doing right now, for the live visualizer: waveform peaks
// of each stem as it comes off the GPU, and GPU telemetry.
export type JobLive = {
  filled: number;
  peaks: Record<StemId, number[]>;
  gpu?: GpuSample;
  utilHistory: number[];
};

const UTIL_HISTORY = 60;

export type Job = {
  id: string;
  filename: string;
  size: number;
  deviceId: string;
  output: Output;
  modFormat?: ModFormat;
  preset: PresetId;
  format: AudioFormat;
  status: JobStatus;
  stage?: string;
  percent?: number;
  error?: string;
  notes: string[];
  inputKey: string;
  outputs: JobOutput[];
  preview?: JobPreview;
  live?: JobLive;
  createdAt: number;
  updatedAt: number;
  leaseUntil?: number;
};

export type NewJob = {
  filename: string;
  size: number;
  deviceId: string;
  output: Output;
  modFormat?: ModFormat;
  preset: PresetId;
  format: AudioFormat;
};

export type JobStore = {
  getJob(id: string): Promise<Job | null>;
  saveJob(job: Job): Promise<Job>;
  createJob(input: NewJob, inputKey: (id: string) => string): Promise<Job>;
  claimNextJob(leaseMs: number): Promise<Job | null>;
};

let storePromise: Promise<JobStore> | undefined;

// Loaded lazily so local dev never pulls in the database driver.
function store() {
  storePromise ??= process.env.DATABASE_URL
    ? import("./job-store-prisma").then((m) => m.prismaStore)
    : import("./job-store-file").then((m) => m.fileStore);
  return storePromise;
}

function safeName(filename: string) {
  return filename.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 200) || "track";
}

export async function getJob(id: string) {
  return (await store()).getJob(id);
}

export async function saveJob(job: Job) {
  return (await store()).saveJob(job);
}

export async function createJob(input: NewJob) {
  return (await store()).createJob(input, (id) => `inputs/${id}/${safeName(input.filename)}`);
}

// Hands the oldest queued job to a worker. Jobs whose worker stopped reporting
// progress (lease expired) go back to the front of the line.
export async function claimNextJob() {
  return (await store()).claimNextJob(LEASE_MS);
}

// Merge a worker's live update. Peaks arrive as {stem: [startBucket, ...values]}
// for the stretch that just finished; buckets that straddle two updates keep
// the larger value.
export function mergeLive(
  job: Job,
  update: { filled?: unknown; peaks?: unknown; gpu?: unknown },
) {
  const live: JobLive = job.live ?? {
    filled: 0,
    peaks: Object.fromEntries(STEMS.map((s) => [s, Array(LIVE_BUCKETS).fill(0)])) as JobLive["peaks"],
    utilHistory: [],
  };

  if (typeof update.filled === "number") {
    live.filled = Math.max(live.filled, Math.min(1, Math.max(0, update.filled)));
  }

  if (update.peaks && typeof update.peaks === "object") {
    for (const stem of STEMS) {
      const run = (update.peaks as Record<string, unknown>)[stem];
      if (!Array.isArray(run) || run.length < 2) continue;
      const start = Number(run[0]);
      run.slice(1).forEach((v, i) => {
        const at = start + i;
        if (at >= 0 && at < LIVE_BUCKETS) {
          live.peaks[stem][at] = Math.max(live.peaks[stem][at], Math.min(1, Number(v) || 0));
        }
      });
    }
  }

  const gpu = update.gpu as Partial<GpuSample> | undefined;
  if (gpu && typeof gpu.name === "string") {
    live.gpu = {
      name: gpu.name.slice(0, 80),
      util: Number(gpu.util) || 0,
      memUsed: Number(gpu.memUsed) || 0,
      memTotal: Number(gpu.memTotal) || 0,
      temp: gpu.temp === undefined ? undefined : Number(gpu.temp),
      power: gpu.power === undefined ? undefined : Number(gpu.power),
    };
    live.utilHistory = [...live.utilHistory, live.gpu.util].slice(-UTIL_HISTORY);
  }

  job.live = live;
}

export function extendLease(job: Job) {
  job.leaseUntil = Date.now() + LEASE_MS;
}
