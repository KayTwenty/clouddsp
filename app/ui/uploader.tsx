"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  CircleAlert,
  Download,
  FileArchive,
  FileMusic,
  FilePlus,
  FolderOpen,
  Gem,
  LoaderCircle,
  Scale,
  Sparkles,
  Trash2,
  Upload,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import {
  ACCEPTED_EXTENSIONS,
  ALL_DEVICES,
  findDevice,
  FORMATS,
  isAudio,
  MAX_FILE_BYTES,
  type AudioFormat,
  type PresetId,
} from "@/lib/devices";
import type { PublicJob } from "@/lib/server/http";
import DevicePicker from "./device-picker";
import LiveVisualizer from "./live-visualizer";
import { mergeZipFiles, saveZip, type ZipFile } from "./save-zip";
import StemPlayer from "./stem-player";

function ZipButton({
  files,
  filename,
  className,
  iconClassName = "size-4",
  children,
}: {
  files: () => ZipFile[];
  filename: string;
  className: string;
  iconClassName?: string;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<"idle" | "zipping" | "error">("idle");
  return (
    <button
      type="button"
      disabled={state === "zipping"}
      onClick={async () => {
        setState("zipping");
        try {
          await saveZip(files(), filename);
          setState("idle");
        } catch {
          setState("error");
        }
      }}
      className={`${className} disabled:cursor-wait disabled:opacity-60`}
    >
      {state === "zipping" ? (
        <LoaderCircle className={`${iconClassName} animate-spin`} aria-hidden />
      ) : state === "error" ? (
        <CircleAlert className={iconClassName} aria-hidden />
      ) : (
        <FileArchive className={iconClassName} aria-hidden />
      )}
      {state === "zipping" ? "Zipping…" : state === "error" ? "Zip failed, try again" : children}
    </button>
  );
}

const FORMAT_INFO: Record<AudioFormat, { label: string; body: string }> = {
  wav: { label: "WAV", body: "24-bit, uncompressed. Best for DAWs." },
  flac: { label: "FLAC", body: "Lossless and about half the size." },
  mp3: { label: "MP3", body: "320 kbps. Smallest, plays anywhere." },
};

type Preset = {
  id: PresetId;
  name: string;
  body: string;
  icon: LucideIcon;
};

const PRESETS: Preset[] = [
  {
    id: "fast",
    name: "Fast",
    body: "Quickest turnaround. Great for most tracks.",
    icon: Zap,
  },
  {
    id: "balanced",
    name: "Balanced",
    body: "Fine-tuned model with cleaner separation.",
    icon: Scale,
  },
  {
    id: "quality",
    name: "Quality",
    body: "Best separation. The one a laptop can't run quickly.",
    icon: Gem,
  },
];

const UPLOAD_CONCURRENCY = 2;
// Fast enough for the live visualizer to feel live.
const POLL_MS = 700;

type Phase = "idle" | "uploading" | "processing" | "done" | "failed";

type QueuedTrack = {
  id: string;
  file: File;
  path: string;
  error?: string;
  phase: Phase;
  uploadPercent: number;
  jobId?: string;
  job?: PublicJob;
  // Set when the browser side (create, upload, start) failed before a worker ran.
  localError?: string;
};

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function validate(file: File): string | undefined {
  if (!isAudio(file.name)) return "Unsupported format";
  if (file.size > MAX_FILE_BYTES) return "File is over 200 MB";
  return undefined;
}

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function putWithProgress(url: string, file: File, onProgress: (percent: number) => void) {
  return new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", url);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress((100 * e.loaded) / e.total);
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Upload failed"));
    xhr.send(file);
  });
}

async function readError(res: Response) {
  const body = (await res.json().catch(() => null)) as { error?: string } | null;
  return body?.error ?? `Request failed (${res.status})`;
}

type PickedFile = { file: File; path: string; fromFolder: boolean };

function readAllEntries(dir: FileSystemDirectoryEntry) {
  const reader = dir.createReader();
  return new Promise<FileSystemEntry[]>((resolve, reject) => {
    const all: FileSystemEntry[] = [];
    const next = () =>
      reader.readEntries((batch) => {
        if (batch.length === 0) return resolve(all);
        all.push(...batch);
        next();
      }, reject);
    next();
  });
}

async function walkEntry(
  entry: FileSystemEntry,
  fromFolder: boolean,
): Promise<PickedFile[]> {
  if (entry.isFile) {
    const file = await new Promise<File>((resolve, reject) =>
      (entry as FileSystemFileEntry).file(resolve, reject),
    );
    return [{ file, path: entry.fullPath.replace(/^\//, ""), fromFolder }];
  }
  const children = await readAllEntries(entry as FileSystemDirectoryEntry);
  const nested = await Promise.all(children.map((c) => walkEntry(c, true)));
  return nested.flat();
}

export default function Uploader() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const [tracks, setTracks] = useState<QueuedTrack[]>([]);
  const [dragging, setDragging] = useState(false);
  const [deviceId, setDeviceId] = useState(ALL_DEVICES[0].id);
  const [presetId, setPresetId] = useState<PresetId>("quality");
  const [format, setFormat] = useState<AudioFormat>(ALL_DEVICES[0].defaultFormat ?? "flac");
  const [notice, setNotice] = useState<string | null>(null);

  function update(id: string, patch: Partial<QueuedTrack>) {
    setTracks((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  // Poll the server for every job that's still in flight.
  const activeJobIds = tracks
    .filter((t) => t.phase === "processing" && t.jobId)
    .map((t) => t.jobId!)
    .join(",");

  useEffect(() => {
    if (!activeJobIds) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    // Each poll waits for the previous one, so slow responses never pile up.
    const tick = async () => {
      const res = await fetch(`/api/jobs?ids=${activeJobIds}`).catch(() => null);
      if (cancelled) return;
      if (res?.ok) {
        const { jobs } = (await res.json()) as { jobs: PublicJob[] };
        const byId = new Map(jobs.map((j) => [j.id, j]));
        setTracks((prev) =>
          prev.map((t) => {
            const job = t.jobId ? byId.get(t.jobId) : undefined;
            if (!job) return t;
            const phase: Phase =
              job.status === "done" ? "done" : job.status === "failed" ? "failed" : t.phase;
            return { ...t, job, phase };
          }),
        );
      }
      timer = setTimeout(tick, POLL_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [activeJobIds]);

  async function submitTrack(
    track: QueuedTrack,
    device: string,
    preset: PresetId,
    audioFormat: AudioFormat,
  ) {
    update(track.id, {
      phase: "uploading",
      uploadPercent: 0,
      job: undefined,
      jobId: undefined,
      localError: undefined,
    });
    try {
      const created = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: track.file.name,
          size: track.file.size,
          deviceId: device,
          preset,
          format: audioFormat,
        }),
      });
      if (!created.ok) throw new Error(await readError(created));
      const { jobId, uploadUrl } = (await created.json()) as {
        jobId: string;
        uploadUrl: string;
      };
      update(track.id, { jobId });

      await putWithProgress(uploadUrl, track.file, (uploadPercent) =>
        update(track.id, { uploadPercent }),
      );

      const started = await fetch(`/api/jobs/${jobId}/start`, { method: "POST" });
      if (!started.ok) throw new Error(await readError(started));
      update(track.id, { phase: "processing", uploadPercent: 100 });
    } catch (e) {
      update(track.id, {
        phase: "failed",
        localError: e instanceof Error ? e.message : "Upload failed",
      });
    }
  }

  async function prepareAll() {
    const pending = tracks.filter((t) => !t.error && (t.phase === "idle" || t.phase === "failed"));
    const queue = [...pending];
    const runners = Array.from({ length: UPLOAD_CONCURRENCY }, async () => {
      for (let t = queue.shift(); t; t = queue.shift()) {
        await submitTrack(t, deviceId, presetId, format);
      }
    });
    await Promise.all(runners);
  }

  function addPicked(picked: PickedFile[]) {
    // Folders often contain artwork, playlists and hidden files, so skip
    // non-audio quietly there. Files picked one by one show an error instead.
    const skipped = picked.filter((p) => p.fromFolder && !isAudio(p.file.name));
    const kept = picked.filter((p) => !p.fromFolder || isAudio(p.file.name));

    setTracks((prev) => {
      const seen = new Set(prev.map((t) => fileKey(t.file)));
      const added: QueuedTrack[] = [];
      for (const p of kept) {
        const key = fileKey(p.file);
        if (seen.has(key)) continue;
        seen.add(key);
        added.push({
          id: crypto.randomUUID(),
          file: p.file,
          path: p.path,
          error: validate(p.file),
          phase: "idle",
          uploadPercent: 0,
        });
      }
      return [...prev, ...added];
    });

    setNotice(
      skipped.length > 0
        ? `Skipped ${skipped.length} non-audio file${skipped.length === 1 ? "" : "s"} from the folder.`
        : null,
    );
  }

  function addFromInput(files: FileList | null, fromFolder: boolean) {
    if (!files) return;
    addPicked(
      Array.from(files).map((file) => ({
        file,
        path: file.webkitRelativePath || file.name,
        fromFolder,
      })),
    );
  }

  async function addFromDrop(items: DataTransferItemList) {
    // Entries must be grabbed synchronously, before the drop event ends.
    const entries = Array.from(items)
      .map((item) => item.webkitGetAsEntry())
      .filter((e): e is FileSystemEntry => e !== null);
    const picked = await Promise.all(entries.map((e) => walkEntry(e, false)));
    addPicked(picked.flat());
  }

  function removeTrack(id: string) {
    setTracks((prev) => prev.filter((t) => t.id !== id));
  }

  const valid = tracks.filter((t) => !t.error);
  const ready = valid.filter((t) => t.phase === "idle" || t.phase === "failed");
  const busy = tracks.some((t) => t.phase === "uploading" || t.phase === "processing");
  const totalBytes = valid.reduce((sum, t) => sum + t.file.size, 0);
  const device = findDevice(deviceId) ?? ALL_DEVICES[0];
  const doneJobs = tracks
    .filter((t) => t.phase === "done" && (t.job?.zipFiles.length ?? 0) > 0)
    .map((t) => t.job!);

  return (
    <div className="flex flex-col gap-8 rounded-2xl border border-border bg-surface p-4 sm:p-6">
      <section>
        <h3 className="text-sm font-semibold">1. Where will you use the stems?</h3>
        <div className="mt-3">
          <DevicePicker
            value={deviceId}
            onChange={(d) => {
              setDeviceId(d.id);
              setFormat(d.defaultFormat ?? "flac");
            }}
          />
        </div>

        {device.output === "tracks" && (
          <fieldset className="mt-4">
            <legend className="text-xs font-semibold text-muted">File format</legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {FORMATS.map((f) => {
                const selected = f === format;
                return (
                  <label
                    key={f}
                    className={`flex cursor-pointer flex-col rounded-lg border px-3 py-2 transition-colors ${
                      selected
                        ? "border-accent bg-accent/10"
                        : "border-border bg-surface-2 hover:border-muted"
                    }`}
                  >
                    <input
                      type="radio"
                      name="format"
                      value={f}
                      checked={selected}
                      onChange={() => setFormat(f)}
                      className="sr-only"
                    />
                    <span className="text-sm font-semibold">{FORMAT_INFO[f].label}</span>
                    <span className="text-xs text-muted">{FORMAT_INFO[f].body}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        )}
      </section>

      <fieldset>
        <legend className="text-sm font-semibold">2. Pick a quality</legend>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          {PRESETS.map(({ id, name, body, icon: Icon }) => {
            const selected = id === presetId;
            return (
              <label
                key={id}
                className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-4 transition-colors ${
                  selected
                    ? "border-accent bg-accent/10"
                    : "border-border bg-surface-2 hover:border-muted"
                }`}
              >
                <input
                  type="radio"
                  name="preset"
                  value={id}
                  checked={selected}
                  onChange={() => setPresetId(id)}
                  className="sr-only"
                />
                <span className="flex items-center gap-2 font-semibold">
                  <Icon
                    className={`size-4 ${selected ? "text-accent" : "text-muted"}`}
                    aria-hidden
                  />
                  {name}
                </span>
                <span className="text-xs text-muted">{body}</span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <section>
        <h3 className="text-sm font-semibold">3. Add your tracks</h3>
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            void addFromDrop(e.dataTransfer.items);
          }}
          className={`mt-3 flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragging ? "border-accent bg-accent/10" : "border-border"
          }`}
        >
          <Upload className="mb-3 size-8 text-accent" aria-hidden />
          <p className="text-lg font-medium">Drop tracks or folders here</p>
          <p className="mt-1 text-sm text-muted">
            MP3, WAV, FLAC, AIFF, M4A · up to 200 MB each
          </p>
          <div className="mt-5 flex flex-wrap justify-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-medium hover:border-muted"
            >
              <FilePlus className="size-4" aria-hidden />
              Add files
            </button>
            <button
              type="button"
              onClick={() => folderInputRef.current?.click()}
              className="flex items-center gap-2 rounded-lg border border-border bg-surface-2 px-4 py-2 text-sm font-medium hover:border-muted"
            >
              <FolderOpen className="size-4" aria-hidden />
              Add folder
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={ACCEPTED_EXTENSIONS.join(",")}
            className="hidden"
            onChange={(e) => {
              addFromInput(e.target.files, false);
              e.target.value = "";
            }}
          />
          <input
            ref={(el) => {
              folderInputRef.current = el;
              el?.setAttribute("webkitdirectory", "");
            }}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => {
              addFromInput(e.target.files, true);
              e.target.value = "";
            }}
          />
        </div>

        {notice && <p className="mt-3 text-xs text-muted">{notice}</p>}

        {tracks.length > 0 && (
          <div className="mt-4 rounded-xl border border-border bg-surface-2">
            <div className="flex items-center justify-between border-b border-border px-4 py-2 text-xs text-muted">
              <span>
                {valid.length} track{valid.length === 1 ? "" : "s"} · {formatBytes(totalBytes)}
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setTracks([]);
                  setNotice(null);
                }}
                className="flex items-center gap-1 rounded-md px-2 py-1 hover:bg-border hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent"
              >
                <Trash2 className="size-3.5" aria-hidden />
                Clear all
              </button>
            </div>
            <ul className="max-h-[48rem] divide-y divide-border overflow-y-auto">
              {tracks.map((t) => (
                <TrackRow key={t.id} track={t} onRemove={() => removeTrack(t.id)} />
              ))}
            </ul>
          </div>
        )}

        {doneJobs.length > 0 && (
          <ZipButton
            files={() => mergeZipFiles(doneJobs.map((j) => j.zipFiles))}
            filename="cloudDSP stems.zip"
            className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-accent px-5 py-3 font-semibold text-accent transition-colors hover:bg-accent/10"
          >
            Download all as zip ({doneJobs.length} track{doneJobs.length === 1 ? "" : "s"})
          </ZipButton>
        )}
      </section>

      <button
        type="button"
        disabled={ready.length === 0}
        onClick={() => void prepareAll()}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-accent px-5 py-3 font-semibold text-black transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
      >
        {busy ? (
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="size-4" aria-hidden />
        )}
        {ready.length > 0
          ? `Prepare ${ready.length} track${ready.length === 1 ? "" : "s"} for ${device.name}`
          : busy
            ? "Preparing tracks"
            : "Prepare tracks"}
      </button>
    </div>
  );
}

function TrackRow({ track: t, onRemove }: { track: QueuedTrack; onRemove: () => void }) {
  const failed = Boolean(t.error) || t.phase === "failed";
  const working = t.phase === "uploading" || t.phase === "processing";

  let status: string;
  let percent: number | undefined;
  if (t.error) status = t.error;
  else if (t.phase === "uploading") {
    status = `Uploading ${Math.round(t.uploadPercent)}%`;
    percent = t.uploadPercent;
  } else if (t.phase === "processing") status = "Processing on the GPU";
  else if (t.phase === "done") status = "Ready";
  else if (t.phase === "failed") status = t.localError ?? t.job?.error ?? "Failed";
  else status = formatBytes(t.file.size) + (t.path !== t.file.name ? ` · ${t.path}` : "");

  const Icon = failed ? CircleAlert : t.phase === "done" ? Check : working ? LoaderCircle : FileMusic;

  return (
    <li className="px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Icon
            className={`size-5 shrink-0 ${
              failed ? "text-red-400" : t.phase === "done" ? "text-accent" : "text-accent-2"
            } ${working ? "animate-spin" : ""}`}
            aria-hidden
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{t.file.name}</p>
            <p className={`truncate text-xs ${failed ? "text-red-400" : "text-muted"}`}>{status}</p>
          </div>
        </div>
        {!working && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Remove ${t.file.name}`}
            className="shrink-0 rounded-md p-1.5 text-muted hover:bg-border hover:text-foreground"
          >
            <X className="size-4" aria-hidden />
          </button>
        )}
      </div>

      {percent !== undefined && (
        <div className="mt-2 h-1 overflow-hidden rounded-full bg-border">
          <div className="h-full bg-accent-2 transition-[width]" style={{ width: `${percent}%` }} />
        </div>
      )}

      {t.phase === "processing" && (
        <div className="mt-3 sm:pl-8">
          <LiveVisualizer job={t.job} />
        </div>
      )}

      {t.phase === "done" && t.job && (
        <div className="mt-3 flex flex-col gap-3 sm:pl-8">
          {t.job.preview && (
            <StemPlayer
              title={t.file.name}
              peaksUrl={t.job.preview.peaksUrl}
              stems={t.job.preview.stems}
            />
          )}
          <div className="flex flex-wrap gap-2">
            {t.job.zipFiles.length > 0 && (
              <ZipButton
                files={() => t.job!.zipFiles}
                filename={`${t.file.name.replace(/\.[^.]+$/, "")}.zip`}
                className="flex items-center gap-1.5 rounded-lg bg-accent px-3 py-1.5 text-xs font-semibold text-black hover:opacity-90"
                iconClassName="size-3.5"
              >
                {t.job.outputs.length > 0 ? "Download zip" : "Download USB files (zip)"}
              </ZipButton>
            )}
            {t.job.outputs.map((o) => (
              <a
                key={o.name}
                href={o.url}
                className="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-3 py-1.5 text-xs font-medium hover:border-accent"
              >
                <Download className="size-3.5 text-accent" aria-hidden />
                {o.name}
                <span className="text-muted">{formatBytes(o.size)}</span>
              </a>
            ))}
          </div>
          {t.job.notes.map((n) => (
            <p key={n} className="text-xs text-muted">
              {n}
            </p>
          ))}
        </div>
      )}
    </li>
  );
}
