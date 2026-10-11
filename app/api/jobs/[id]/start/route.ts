import type { NextRequest } from "next/server";
import { badRequest } from "@/lib/server/http";
import { getJob, saveJob } from "@/lib/server/jobs";
import { objectSize } from "@/lib/server/storage";

// Called by the browser once its upload finished. Queues the job for a worker.
export async function POST(_request: NextRequest, ctx: RouteContext<"/api/jobs/[id]/start">) {
  const { id } = await ctx.params;
  const job = await getJob(id).catch(() => null);
  if (!job) return badRequest("Job not found", 404);
  if (job.status !== "awaiting_upload") return Response.json({ status: job.status });

  const size = await objectSize(job.inputKey);
  if (size === null) return badRequest("Upload not found");
  if (size !== job.size) return badRequest("Upload is incomplete");

  job.status = "queued";
  job.stage = "queued";
  await saveJob(job);
  return Response.json({ status: job.status });
}
