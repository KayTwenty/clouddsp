import "server-only";

import { AwsClient } from "aws4fetch";
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { createReadStream, createWriteStream, existsSync } from "node:fs";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

// File storage behind short-lived signed URLs. The browser uploads and
// downloads, and the GPU workers read and write, directly through these URLs,
// so audio never passes through the web server.
//
// Production: Cloudflare R2 presigned URLs (set the R2_* variables).
// Local dev: files under .data/storage, served by /api/storage with our own
// HMAC signatures, so nothing else changes between the two.

type Method = "GET" | "PUT";

const CONTENT_TYPES: Record<string, string> = {
  flac: "audio/flac",
  wav: "audio/wav",
  mp3: "audio/mpeg",
  m4a: "audio/mp4",
  json: "application/json",
  zip: "application/zip",
};

function contentTypeOf(key: string) {
  return CONTENT_TYPES[key.split(".").pop()?.toLowerCase() ?? ""] ?? "application/octet-stream";
}

function encodeKey(key: string) {
  return key.split("/").map(encodeURIComponent).join("/");
}

// --- Cloudflare R2 --------------------------------------------------------------

const R2 =
  process.env.R2_ACCOUNT_ID &&
  process.env.R2_ACCESS_KEY_ID &&
  process.env.R2_SECRET_ACCESS_KEY &&
  process.env.R2_BUCKET
    ? {
        endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${process.env.R2_BUCKET}`,
        client: new AwsClient({
          accessKeyId: process.env.R2_ACCESS_KEY_ID,
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
          service: "s3",
          region: "auto",
        }),
      }
    : null;

export const usingR2 = R2 !== null;

// --- Local disk -----------------------------------------------------------------

const DATA_DIR = path.join(process.cwd(), ".data");
const STORAGE_DIR = path.join(DATA_DIR, "storage");
const SECRET_FILE = path.join(DATA_DIR, "signing-secret");

let secretPromise: Promise<string> | undefined;

function signingSecret() {
  if (process.env.STORAGE_SIGNING_SECRET) {
    return Promise.resolve(process.env.STORAGE_SIGNING_SECRET);
  }
  secretPromise ??= (async () => {
    if (existsSync(SECRET_FILE)) return (await readFile(SECRET_FILE, "utf8")).trim();
    const secret = randomBytes(32).toString("hex");
    await mkdir(DATA_DIR, { recursive: true });
    await writeFile(SECRET_FILE, secret);
    return secret;
  })();
  return secretPromise;
}

function sign(secret: string, method: Method, key: string, expires: number) {
  return createHmac("sha256", secret).update(`${method}\n${key}\n${expires}`).digest("hex");
}

function filePath(key: string) {
  const resolved = path.resolve(STORAGE_DIR, key);
  if (!resolved.startsWith(STORAGE_DIR + path.sep)) throw new Error("Invalid key");
  return resolved;
}

// --- Shared API -----------------------------------------------------------------

// `download` makes the browser save the file under that name instead of
// trying to play it inline.
export async function signedUrl(
  origin: string,
  method: Method,
  key: string,
  ttlSeconds = 3600,
  options: { download?: string } = {},
) {
  if (R2) {
    const url = new URL(`${R2.endpoint}/${encodeKey(key)}`);
    url.searchParams.set("X-Amz-Expires", String(ttlSeconds));
    if (method === "GET") {
      // Objects uploaded without a type would otherwise come back as binary,
      // which some browsers refuse to play.
      url.searchParams.set("response-content-type", contentTypeOf(key));
      if (options.download) {
        url.searchParams.set(
          "response-content-disposition",
          `attachment; filename*=UTF-8''${encodeURIComponent(options.download)}`,
        );
      }
    }
    const signed = await R2.client.sign(url.toString(), { method, aws: { signQuery: true } });
    return signed.url;
  }

  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const sig = sign(await signingSecret(), method, key, expires);
  return `${origin}/api/storage/${encodeKey(key)}?m=${method}&exp=${expires}&sig=${sig}`;
}

// Size of a stored object, or null if it doesn't exist.
export async function objectSize(key: string) {
  if (R2) {
    const res = await R2.client.fetch(`${R2.endpoint}/${encodeKey(key)}`, { method: "HEAD" });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`R2 HEAD failed with ${res.status}`);
    return Number(res.headers.get("content-length") ?? 0);
  }
  try {
    return (await stat(filePath(key))).size;
  } catch {
    return null;
  }
}

// --- Local-only helpers for /api/storage ---------------------------------------

export async function verifySignature(method: Method, key: string, params: URLSearchParams) {
  const expires = Number(params.get("exp"));
  const sig = params.get("sig") ?? "";
  if (params.get("m") !== method || !Number.isFinite(expires)) return false;
  if (expires < Date.now() / 1000) return false;
  const expected = Buffer.from(sign(await signingSecret(), method, key, expires));
  const given = Buffer.from(sig);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export async function writeStream(key: string, body: ReadableStream<Uint8Array>) {
  const target = filePath(key);
  await mkdir(path.dirname(target), { recursive: true });
  await pipeline(Readable.fromWeb(body as never), createWriteStream(target));
  return (await stat(target)).size;
}

export async function objectInfo(key: string) {
  return { size: (await stat(filePath(key))).size, contentType: contentTypeOf(key) };
}

// `end` is inclusive, matching HTTP Range semantics.
export function readStream(key: string, range?: { start: number; end: number }) {
  return Readable.toWeb(createReadStream(filePath(key), range));
}
