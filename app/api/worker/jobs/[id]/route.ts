import type { NextRequest } from "next/server";
import { STEMS } from "@/lib/devices";
import { badRequest, isWorker } from "@/lib/server/http";
import {
  extendLease,
  getJob,
  heartbeat,
  mergeLive,
  parseWorkerBeat,
  saveJob,
  type JobOutput,
} from "@/lib/server/jobs";
import { objectSize, signedUrl } from "@/lib/server/storage";

// Worker updates for a claimed job. One endpoint, switched on `action`:
//   progress    { stage, percent, live? }   also renews the lease
//   upload-url  { name }                    signed PUT URL for one output file
//   complete    { outputs: [{ name, zipPath?, listed? }], notes, preview? }
//   fail        { error }

// A path inside the user's zip: relative, forward slashes, no "..".
function cleanZipPath(value: unknown) {
  if (typeof value !== "string" || !value || value.length > 300) return undefined;
  const parts = value.split("/");
  if (parts.some((p) => !p || p === "." || p === ".." || /[\\:*?"<>|\x00-\x1f]/.test(p))) {
    return undefined;
  }
  return value;
}

export async function POST(request: NextRequest, ctx: RouteContext<"/api/worker/jobs/[id]">) {
  if (!isWorker(request)) return badRequest("Unauthorized", 401);

  const { id } = await ctx.params;
  const job = await getJob(id).catch(() => null);
  if (!job) return badRequest("Job not found", 404);
  if (job.status !== "processing") return badRequest("Job is not being processed", 409);

  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const outputKey = (name: string) => {
    const clean = name.replace(/[\\/:*?"<>|\x00-\x1f]/g, "_").slice(0, 200);
    return `outputs/${job.id}/${clean}`;
  };

  switch (body.action) {
    case "progress": {
      job.stage = String(body.stage ?? job.stage);
      job.percent = Math.max(0, Math.min(100, Number(body.percent ?? 0)));
      if (body.live && typeof body.live === "object") {
        mergeLive(job, body.live as Record<string, unknown>);
      }
      extendLease(job);
      // The worker's GPU stats come along with live progress.
      const worker = parseWorkerBeat(
        body.worker && typeof body.worker === "object"
          ? { ...(body.worker as object), gpu: job.live?.gpu }
          : null,
        "busy",
        job.id,
      );
      await Promise.all([saveJob(job), worker && heartbeat(worker)]);
      return Response.json({ ok: true });
    }
    case "upload-url": {
      if (typeof body.name !== "string" || !body.name) return badRequest("Missing name");
      const key = outputKey(body.name);
      return Response.json({ url: await signedUrl(request.nextUrl.origin, "PUT", key) });
    }
    case "complete": {
      const entries = Array.isArray(body.outputs) ? body.outputs : [];
      const outputs: JobOutput[] = [];
      for (const entry of entries) {
        const o = (typeof entry === "string" ? { name: entry } : entry) as Record<string, unknown>;
        if (typeof o.name !== "string") return badRequest("Output is missing a name");
        const key = outputKey(o.name);
        const size = await objectSize(key);
        if (size === null) return badRequest(`Output not uploaded: ${o.name}`);
        outputs.push({
          name: o.name,
          key,
          size,
          zipPath: cleanZipPath(o.zipPath),
          listed: o.listed !== false,
        });
      }
      job.outputs = outputs;

      const preview = body.preview as
        | { peaks?: unknown; stems?: Record<string, unknown> }
        | undefined;
      if (preview && typeof preview.peaks === "string" && preview.stems) {
        const peaksKey = outputKey(preview.peaks);
        const stems = [];
        for (const stem of STEMS) {
          const name = preview.stems[stem];
          if (typeof name !== "string") continue;
          const key = outputKey(name);
          if ((await objectSize(key)) !== null) stems.push({ stem, key });
        }
        if ((await objectSize(peaksKey)) !== null && stems.length > 0) {
          job.preview = { peaksKey, stems };
        }
      }

      job.notes = Array.isArray(body.notes) ? body.notes.map(String) : [];
      job.status = "done";
      job.stage = "done";
      job.percent = 100;
      job.live = undefined;
      job.finishedAt = Date.now();
      await saveJob(job);
      return Response.json({ ok: true });
    }
    case "fail": {
      job.status = "failed";
      job.stage = "failed";
      job.error = String(body.error ?? "Processing failed").slice(0, 500);
      job.live = undefined;
      job.finishedAt = Date.now();
      await saveJob(job);
      return Response.json({ ok: true });
    }
    default:
      return badRequest("Unknown action");
  }
}
