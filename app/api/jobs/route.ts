import type { NextRequest } from "next/server";
import {
  findDevice,
  FORMATS,
  isAudio,
  MAX_FILE_BYTES,
  PRESET_IDS,
  type AudioFormat,
  type PresetId,
} from "@/lib/devices";
import { badRequest, publicJob } from "@/lib/server/http";
import { createJob, getJob } from "@/lib/server/jobs";
import { signedUrl } from "@/lib/server/storage";

// Create a job and get a URL to upload the track to.
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as {
    filename?: unknown;
    size?: unknown;
    deviceId?: unknown;
    preset?: unknown;
    format?: unknown;
  } | null;
  if (!body) return badRequest("Invalid JSON");

  const { filename, size, deviceId, preset, format } = body;
  if (typeof filename !== "string" || !isAudio(filename)) {
    return badRequest("Unsupported file type");
  }
  if (typeof size !== "number" || size <= 0 || size > MAX_FILE_BYTES) {
    return badRequest("File must be under 200 MB");
  }
  const device = typeof deviceId === "string" ? findDevice(deviceId) : undefined;
  if (!device) return badRequest("Unknown device");
  if (!PRESET_IDS.includes(preset as PresetId)) return badRequest("Unknown preset");
  const audioFormat = format ?? device.defaultFormat ?? "flac";
  if (!FORMATS.includes(audioFormat as AudioFormat)) return badRequest("Unknown format");

  const job = await createJob({
    filename,
    size,
    deviceId: device.id,
    output: device.output,
    modFormat: device.modFormat,
    preset: preset as PresetId,
    format: audioFormat as AudioFormat,
  });
  // Browser-facing links are relative (built-in storage), so they keep working
  // behind a reverse proxy where the server can't see its public https origin.
  const uploadUrl = await signedUrl("", "PUT", job.inputKey);
  return Response.json({ jobId: job.id, uploadUrl });
}

// Poll several jobs at once: /api/jobs?ids=a,b,c
export async function GET(request: NextRequest) {
  const ids = (request.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .filter(Boolean)
    .slice(0, 200);
  const jobs = await Promise.all(ids.map((id) => getJob(id).catch(() => null)));
  return Response.json({
    jobs: await Promise.all(jobs.filter((j) => j !== null).map((j) => publicJob(j, ""))),
  });
}
