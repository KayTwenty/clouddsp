import type { NextRequest } from "next/server";
import { MAX_FILE_BYTES } from "@/lib/devices";
import { badRequest } from "@/lib/server/http";
import {
  objectInfo,
  readStream,
  usingObjectStorage,
  verifySignature,
  writeStream,
} from "@/lib/server/storage";

// Built-in file storage, used when no object storage is configured (local dev
// and single-machine self-hosting). Works like presigned URLs: only requests
// carrying a valid, unexpired signature for this exact key and method get
// through. With object storage configured, files never touch this server.

type Ctx = RouteContext<"/api/storage/[...key]">;

async function keyFrom(ctx: Ctx) {
  const { key } = await ctx.params;
  return key.join("/");
}

export async function PUT(request: NextRequest, ctx: Ctx) {
  if (usingObjectStorage) return badRequest("Not found", 404);
  const key = await keyFrom(ctx);
  if (!(await verifySignature("PUT", key, request.nextUrl.searchParams))) {
    return badRequest("Invalid or expired signature", 403);
  }
  const length = Number(request.headers.get("content-length") ?? 0);
  // Worker outputs (zips of stems) can be larger than a single upload.
  const limit = key.startsWith("inputs/") ? MAX_FILE_BYTES : MAX_FILE_BYTES * 8;
  if (length > limit) return badRequest("File too large", 413);
  if (!request.body) return badRequest("Missing body");

  const size = await writeStream(key, request.body);
  return Response.json({ size });
}

// Supports Range requests so audio players can stream and seek, like R2 does.
export async function GET(request: NextRequest, ctx: Ctx) {
  if (usingObjectStorage) return badRequest("Not found", 404);
  const key = await keyFrom(ctx);
  if (!(await verifySignature("GET", key, request.nextUrl.searchParams))) {
    return badRequest("Invalid or expired signature", 403);
  }

  let size: number;
  let contentType: string;
  try {
    ({ size, contentType } = await objectInfo(key));
  } catch {
    return badRequest("Not found", 404);
  }

  const filename = key.split("/").pop() ?? "download";
  const headers: Record<string, string> = {
    "Accept-Ranges": "bytes",
    "Content-Type": contentType,
    "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
  };

  const match = /^bytes=(\d*)-(\d*)$/.exec(request.headers.get("range") ?? "");
  if (match && (match[1] || match[2])) {
    // "bytes=a-b", "bytes=a-" or the suffix form "bytes=-n".
    const start = match[1] ? Number(match[1]) : Math.max(0, size - Number(match[2]));
    const end = match[1] && match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (start > end || start >= size) {
      return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    }
    return new Response(readStream(key, { start, end }) as ReadableStream, {
      status: 206,
      headers: {
        ...headers,
        "Content-Length": String(end - start + 1),
        "Content-Range": `bytes ${start}-${end}/${size}`,
      },
    });
  }

  return new Response(readStream(key) as ReadableStream, {
    headers: { ...headers, "Content-Length": String(size) },
  });
}
