import type { NextRequest } from "next/server";
import { badRequest, isWorker } from "@/lib/server/http";
import { claimNextJob } from "@/lib/server/jobs";
import { signedUrl } from "@/lib/server/storage";

// Workers poll this. Returns 204 when there is nothing to do.
export async function POST(request: NextRequest) {
  if (!isWorker(request)) return badRequest("Unauthorized", 401);

  const job = await claimNextJob();
  if (!job) return new Response(null, { status: 204 });

  return Response.json({
    job: {
      id: job.id,
      filename: job.filename,
      output: job.output,
      modFormat: job.modFormat ?? null,
      preset: job.preset,
      // Jobs created before formats existed were FLAC.
      format: job.format ?? "flac",
    },
    inputUrl: await signedUrl(request.nextUrl.origin, "GET", job.inputKey),
  });
}
