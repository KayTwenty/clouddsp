"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Clock,
  Cpu,
  Gauge,
  Hourglass,
  ListOrdered,
  MemoryStick,
  Server,
  Thermometer,
  TriangleAlert,
  XCircle,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { StatusSnapshot } from "@/app/api/status/route";

const REFRESH_MS = 3000;

const STAGE_TEXT: Record<string, string> = {
  claimed: "Starting a track",
  downloading: "Fetching a track",
  decoding: "Decoding audio",
  separating: "Separating stems",
  writing: "Writing files",
  uploading: "Saving results",
};

function formatDuration(seconds: number | null) {
  if (seconds === null) return "No data yet";
  if (seconds < 60) return `${Math.round(seconds)} s`;
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return s ? `${m} min ${s} s` : `${m} min`;
}

function formatAgo(ms: number) {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s} s ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  return `${Math.round(m / 60)} h ago`;
}

export default function StatusBoard() {
  const [data, setData] = useState<StatusSnapshot | null>(null);
  const [failed, setFailed] = useState(false);
  // Set when data arrives; reading the clock during render would block prerendering.
  const [now, setNow] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const res = await fetch("/api/status", { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const snapshot = (await res.json()) as StatusSnapshot;
        if (!cancelled) {
          setData(snapshot);
          setFailed(false);
          setNow(Date.now());
        }
      } catch {
        if (!cancelled) setFailed(true);
      }
      if (!cancelled) timer = setTimeout(tick, REFRESH_MS);
    };
    void tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, []);

  const online = data?.workers.filter((w) => w.online) ?? [];
  const busy = online.filter((w) => w.status === "busy").length;

  let headline: { tone: "ok" | "warn" | "down" | "loading"; title: string; body: string };
  if (!data && !failed) {
    headline = { tone: "loading", title: "Checking status", body: "Connecting to the service." };
  } else if (failed) {
    headline = {
      tone: "down",
      title: "Status unavailable",
      body: "We couldn't reach the service. It may be restarting; this page keeps trying.",
    };
  } else if (online.length === 0) {
    headline = {
      tone: "warn",
      title: "No GPUs online right now",
      body: "You can still upload. Tracks wait in the queue and start as soon as a GPU comes back.",
    };
  } else {
    headline = {
      tone: "ok",
      title: "All systems operational",
      body:
        data!.queued > 0
          ? `${online.length} GPU${online.length === 1 ? "" : "s"} online. ${data!.queued} track${data!.queued === 1 ? " is" : "s are"} waiting, so expect a short wait.`
          : `${online.length} GPU${online.length === 1 ? "" : "s"} online. New tracks start right away.`,
    };
  }

  const toneColor = {
    ok: "var(--color-green, #3ddc84)",
    warn: "var(--stem-vocals)",
    down: "var(--stem-drums)",
    loading: "var(--muted)",
  }[headline.tone];

  return (
    <div className="flex flex-col gap-6">
      <section
        aria-live="polite"
        className="flex items-start gap-4 rounded-2xl border border-border bg-surface p-5 sm:p-6"
      >
        <span className="relative mt-1.5 flex size-3 shrink-0">
          {headline.tone !== "loading" && (
            <span
              className="absolute inline-flex size-full animate-ping rounded-full opacity-60"
              style={{ background: toneColor }}
            />
          )}
          <span className="relative inline-flex size-3 rounded-full" style={{ background: toneColor }} />
        </span>
        <div>
          <h2 className="text-xl font-semibold">{headline.title}</h2>
          <p className="mt-1 text-sm text-muted">{headline.body}</p>
        </div>
      </section>

      <section aria-label="Queue" className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Stat icon={Server} label="GPUs online" value={data ? `${online.length}` : "..."} sub={data ? `${busy} working` : undefined} />
        <Stat icon={ListOrdered} label="Waiting in queue" value={data ? `${data.queued}` : "..."} />
        <Stat icon={Zap} label="Processing now" value={data ? `${data.processing}` : "..."} />
        <Stat icon={CheckCircle2} label="Finished, last 24 h" value={data ? `${data.done24h}` : "..."} />
        <Stat icon={Hourglass} label="Average GPU time per track" value={data ? formatDuration(data.avgSeconds24h) : "..."} sub="last 24 h" />
        <Stat icon={XCircle} label="Failed, last 24 h" value={data ? `${data.failed24h}` : "..."} />
      </section>

      <section aria-labelledby="gpus-heading">
        <h2 id="gpus-heading" className="text-lg font-semibold">
          GPU workers
        </h2>
        {data && data.workers.length === 0 && (
          <p className="mt-3 rounded-xl border border-border bg-surface p-5 text-sm text-muted">
            No workers have checked in during the last hour.
          </p>
        )}
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {data?.workers.map((w, i) => (
            <WorkerCard key={`${w.name}-${i}`} worker={w} now={now} />
          ))}
        </div>
      </section>

      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Clock className="size-3.5" aria-hidden />
        Updates every {REFRESH_MS / 1000} seconds.
        {data && ` Last update ${new Date(data.generatedAt).toLocaleTimeString()}.`}
        {failed && data && " Showing the last known state."}
      </p>
    </div>
  );
}

function Stat({ icon: Icon, label, value, sub }: { icon: LucideIcon; label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-1 font-mono text-2xl font-semibold tabular-nums">{value}</p>
      {sub && <p className="text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Bar({ value, color }: { value: number; color: string }) {
  return (
    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-border">
      <div
        className="h-full transition-[width] duration-700"
        style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }}
      />
    </div>
  );
}

function WorkerCard({ worker: w, now }: { worker: StatusSnapshot["workers"][number]; now: number }) {
  const state = !w.online
    ? `Offline, last seen ${formatAgo(now - w.lastSeen)}`
    : w.job
      ? `${STAGE_TEXT[w.job.stage] ?? "Working"}${w.job.stage === "separating" ? ` ${w.job.percent}%` : ""}`
      : "Idle, ready for work";
  const gpu = w.gpu;

  return (
    <article className={`rounded-xl border border-border bg-surface p-4 ${w.online ? "" : "opacity-55"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="flex items-center gap-2 truncate font-semibold">
            <Cpu className="size-4 shrink-0 text-accent" aria-hidden />
            {w.name}
          </h3>
          {gpu && gpu.name !== w.name && <p className="truncate text-xs text-muted">{gpu.name}</p>}
        </div>
        {!w.online && <TriangleAlert className="size-4 shrink-0 text-muted" aria-hidden />}
      </div>
      <p className={`mt-2 text-sm ${w.status === "busy" ? "text-accent" : "text-muted"}`}>{state}</p>
      {w.online && w.job?.stage === "separating" && <Bar value={w.job.percent} color="var(--accent)" />}

      {w.online && gpu && (
        <dl className="mt-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <dt className="flex items-center gap-1 text-muted">
              <Gauge className="size-3" aria-hidden />
              GPU load
            </dt>
            <dd className="font-mono tabular-nums">{gpu.util}%</dd>
            <Bar value={gpu.util} color="var(--accent)" />
          </div>
          <div>
            <dt className="flex items-center gap-1 text-muted">
              <MemoryStick className="size-3" aria-hidden />
              VRAM
            </dt>
            <dd className="font-mono tabular-nums">
              {(gpu.memUsed / 1024).toFixed(1)} / {(gpu.memTotal / 1024).toFixed(0)} GB
            </dd>
            <Bar value={gpu.memTotal ? (100 * gpu.memUsed) / gpu.memTotal : 0} color="var(--accent-2)" />
          </div>
          {gpu.temp !== undefined && (
            <div>
              <dt className="flex items-center gap-1 text-muted">
                <Thermometer className="size-3" aria-hidden />
                Temperature
              </dt>
              <dd className="font-mono tabular-nums">{gpu.temp}°C</dd>
            </div>
          )}
          {gpu.power !== undefined && (
            <div>
              <dt className="flex items-center gap-1 text-muted">
                <Zap className="size-3" aria-hidden />
                Power
              </dt>
              <dd className="font-mono tabular-nums">{gpu.power} W</dd>
            </div>
          )}
        </dl>
      )}
    </article>
  );
}
