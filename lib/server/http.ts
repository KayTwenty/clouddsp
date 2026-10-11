import "server-only";

import { timingSafeEqual } from "node:crypto";
import type { NextRequest } from "next/server";
import { signedUrl } from "./storage";
import type { Job } from "./jobs";

export function badRequest(message: string, status = 400) {
  return Response.json({ error: message }, { status });
}

export function isWorker(request: NextRequest) {
  // The dev default is public, so production refuses all workers until a real
  // token is configured rather than falling back to it.
  const token =
    process.env.WORKER_TOKEN || (process.env.NODE_ENV === "production" ? null : "dev-worker-token");
  if (!token) return false;
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${token}`);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

// What the browser is allowed to see about a job, with download links.
export async function publicJob(job: Job, origin: string) {
  return {
    id: job.id,
    filename: job.filename,
    status: job.status,
    stage: job.stage,
    percent: job.percent,
    error: job.error,
    notes: job.notes,
    live: job.status === "processing" ? (job.live ?? null) : null,
    // Individual download buttons.
    outputs: await Promise.all(
      job.outputs
        .filter((o) => o.listed !== false)
        .map(async (o) => ({
          name: o.name,
          size: o.size,
          url: await signedUrl(origin, "GET", o.key, 3600, { download: o.name }),
        })),
    ),
    // Everything that goes in "Download zip", which the browser builds itself
    // straight from storage.
    zipFiles: await Promise.all(
      job.outputs
        .filter((o) => o.zipPath)
        .map(async (o) => ({
          path: o.zipPath!,
          size: o.size,
          url: await signedUrl(origin, "GET", o.key),
        })),
    ),
    preview: job.preview
      ? {
          peaksUrl: await signedUrl(origin, "GET", job.preview.peaksKey),
          stems: await Promise.all(
            job.preview.stems.map(async (s) => ({
              stem: s.stem,
              url: await signedUrl(origin, "GET", s.key),
            })),
          ),
        }
      : null,
  };
}

export type PublicJob = Awaited<ReturnType<typeof publicJob>>;
