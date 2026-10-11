# How cloudDSP works

```
Browser ──signed PUT / GET──▶ storage ◀──signed GET / PUT── GPU worker(s)
   │                                                          │
   └──── /api/jobs, live polling ──▶ website ◀── /api/worker/* ┘
                                       │
                                  job queue
```

## The pieces

**Website** (Next.js, `app/`): the upload page, live job view, stem player,
`/status` and `/about`. Its API hands out short-lived signed URLs and keeps
the job queue. It never decodes audio.

**Storage** (`lib/server/storage.ts`): files are only ever reached through
signed URLs that expire within an hour.

- *Built-in:* files in `.data/storage`, served by `/api/storage` with HMAC
  signatures and HTTP Range support. Expires files after `RETENTION_HOURS`.
- *S3-compatible:* presigned URLs to R2, MinIO, S3 and so on. Audio goes
  straight between the browser, the bucket and the workers, never through the
  website.

**Job queue** (`lib/server/jobs.ts`):

- *Built-in:* one JSON file per job in `.data/jobs`. Fine for one site process.
- *Postgres* (`DATABASE_URL`, Prisma): workers claim jobs with
  `FOR UPDATE SKIP LOCKED`, so any number can poll at once.

Either way a claimed job carries a two-minute lease that every progress report
renews; if a worker goes silent, the job goes back to the queue.

**GPU worker** (Python, `worker/`): polls `/api/worker/claim`, downloads the
track, separates it with Demucs, writes the exports, uploads them and reports
progress. It only makes outgoing HTTP requests, so it can run anywhere.
`worker/start.py` picks the right PyTorch CUDA build for the GPU.

## A job, start to finish

1. The browser `POST`s `/api/jobs` with the file name, size, device and preset,
   and gets back a job ID and a signed upload URL.
2. It uploads the file to that URL, then calls `/api/jobs/<id>/start`, which
   checks the upload and queues the job.
3. A worker claims it and gets a signed download URL for the input.
4. The worker decodes the audio with ffmpeg and separates it in 15-second
   overlapping windows. After each window it posts the new stretch of each
   stem's waveform plus GPU telemetry, which the browser polls to draw the live
   view.
5. It writes the outputs (see below) and small AAC previews with waveform
   peaks for the in-browser player, uploads each through a signed PUT URL and
   marks the job complete.
6. The browser shows the player and download links. "Download zip" builds the
   zip in the browser from the signed URLs.

## Outputs

| Target | What the worker writes | Code |
|---|---|---|
| CDJ-3000 + cdj3k-mods | The mod's on-USB stem cache: `mods/stemd-cache/<model id>/<ab>/<key>/{meta, harmonics.flac, vocals.flac}`, 96 kHz FLAC. The key is FNV-1a over the track file's size, frame count, first and last 64 KiB, matching `cache.c` in cdj3k-mods. Lossless 44.1 kHz inputs only. | `worker/clouddsp_worker/exporters.py` |
| Everything else | Vocals, drums, bass, other and instrumental as WAV, FLAC or MP3 | same |

Devices and which output each gets are listed in `lib/devices.ts`.

## Where things live

| | |
|---|---|
| `app/page.tsx`, `app/ui/uploader.tsx` | Upload flow and job list |
| `app/ui/live-visualizer.tsx`, `app/ui/stem-player.tsx` | Live view and player |
| `app/ui/device-picker.tsx`, `app/ui/device-art.tsx` | Device cards and their outline drawings |
| `app/ui/side-scenes.tsx`, `app/ui/scenes/` | three.js side panels (wide screens only) |
| `app/api/jobs`, `app/api/storage`, `app/api/worker`, `app/api/status` | API |
| `lib/server/` | Job stores, storage, request helpers |
| `prisma/` | Schema and migrations for Postgres mode |
| `worker/clouddsp_worker/` | `main.py` job loop, `separate.py`, `exporters.py`, `live.py`, `telemetry.py` |
