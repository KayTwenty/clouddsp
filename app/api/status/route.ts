import { connection } from "next/server";
import { getJob, listWorkers, queueStats, WORKER_ONLINE_MS } from "@/lib/server/jobs";

// Public, anonymous snapshot for the status page. Never includes track names
// or anything about who uploaded what.
export async function GET() {
  await connection(); // always live, never prerendered
  const now = Date.now();
  const [workers, stats] = await Promise.all([listWorkers(), queueStats()]);

  const publicWorkers = await Promise.all(
    workers.map(async (w) => {
      const online = now - w.lastSeen < WORKER_ONLINE_MS;
      const job = online && w.status === "busy" && w.jobId ? await getJob(w.jobId) : null;
      return {
        name: w.name,
        online,
        status: online ? w.status : "offline",
        lastSeen: w.lastSeen,
        gpu: w.gpu ?? null,
        job:
          job && job.status === "processing"
            ? { stage: job.stage ?? "claimed", percent: job.percent ?? 0 }
            : null,
      };
    }),
  );

  return Response.json(
    { generatedAt: now, workers: publicWorkers, ...stats },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export type StatusSnapshot = {
  generatedAt: number;
  workers: {
    name: string;
    online: boolean;
    status: "idle" | "busy" | "offline";
    lastSeen: number;
    gpu: { name: string; util: number; memUsed: number; memTotal: number; temp?: number; power?: number } | null;
    job: { stage: string; percent: number } | null;
  }[];
  queued: number;
  processing: number;
  done24h: number;
  failed24h: number;
  avgSeconds24h: number | null;
};
