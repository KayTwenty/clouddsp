"use client";

import { Cpu, Drum, Gauge, Guitar, MemoryStick, Mic, Piano, Thermometer, Zap, type LucideIcon } from "lucide-react";
import { LIVE_BUCKETS, STEMS, type StemId } from "@/lib/devices";
import type { PublicJob } from "@/lib/server/http";

// Live view of a job on the GPU: each stem's waveform drawn as it comes off
// the model, a scan head where the GPU is working, and GPU telemetry.

const STEM_META: Record<StemId, { label: string; icon: LucideIcon; color: string }> = {
  drums: { label: "Drums", icon: Drum, color: "var(--stem-drums)" },
  bass: { label: "Bass", icon: Guitar, color: "var(--stem-bass)" },
  other: { label: "Other", icon: Piano, color: "var(--stem-other)" },
  vocals: { label: "Vocals", icon: Mic, color: "var(--stem-vocals)" },
};

const STEPS = [
  { id: "downloading", label: "Fetch" },
  { id: "decoding", label: "Decode" },
  { id: "separating", label: "Separate" },
  { id: "writing", label: "Write" },
  { id: "uploading", label: "Save" },
];

const STAGE_TEXT: Record<string, string> = {
  queued: "Waiting for a GPU",
  claimed: "GPU picked up the track",
  downloading: "Fetching track",
  decoding: "Decoding audio",
  separating: "Separating stems on the GPU",
  writing: "Writing files",
  uploading: "Saving results",
};

function lanePath(peaks: number[]) {
  let d = "";
  peaks.forEach((p, i) => {
    if (p <= 0) return;
    const h = Math.max(p * 46, 1);
    d += `M${i + 0.15} ${50 - h}h0.7v${2 * h}h-0.7z`;
  });
  return d;
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * 100},${30 - (v / 100) * 28}`).join(" ");
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="mt-1 h-6 w-full" aria-hidden>
      <polyline points={`0,30 ${pts} 100,30`} fill="var(--accent)" fillOpacity={0.15} stroke="none" />
      <polyline
        points={pts}
        fill="none"
        stroke="var(--accent)"
        strokeWidth={1.5}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  children,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  children?: React.ReactNode;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-border bg-surface-2 p-2.5">
      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <Icon className="size-3.5" aria-hidden />
        {label}
      </p>
      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">{value}</p>
      {children}
    </div>
  );
}

export default function LiveVisualizer({ job }: { job?: PublicJob }) {
  const stage = job?.stage ?? "queued";
  const live = job?.live;
  const filled = live?.filled ?? 0;
  const separating = stage === "separating";
  const gpu = live?.gpu;
  const stepIndex = STEPS.findIndex((s) => s.id === stage);
  const percent =
    stage === "separating" ? Math.round(filled * 100) : stage === "uploading" ? job?.percent ?? 0 : null;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface p-3 sm:p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold">
            <span className="relative flex size-2.5">
              <span className="absolute inline-flex size-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex size-2.5 rounded-full bg-accent" />
            </span>
            {STAGE_TEXT[stage] ?? "Processing"}
          </p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
            <Cpu className="size-3.5 shrink-0" aria-hidden />
            {gpu?.name ?? "Connecting to GPU"}
          </p>
        </div>
        {percent !== null && (
          <span className="font-mono text-2xl font-semibold tabular-nums text-accent">{percent}%</span>
        )}
      </div>

      <ol className="mt-3 flex items-center gap-1 text-[11px]" aria-label="Steps">
        {STEPS.map((s, i) => {
          const state = stepIndex > i ? "done" : stepIndex === i ? "active" : "todo";
          return (
            <li key={s.id} className="flex flex-1 flex-col gap-1">
              <span
                className={`h-1 rounded-full ${
                  state === "done" ? "bg-accent" : state === "active" ? "animate-pulse bg-accent" : "bg-border"
                }`}
              />
              <span className={state === "todo" ? "text-muted" : "text-foreground"}>{s.label}</span>
            </li>
          );
        })}
      </ol>

      <div className="mt-3 flex flex-col gap-1.5">
        {STEMS.map((stem) => {
          const { label, icon: Icon, color } = STEM_META[stem];
          const peaks = live?.peaks?.[stem] ?? [];
          return (
            <div key={stem} className="flex items-center gap-2">
              <span
                className="flex w-20 shrink-0 items-center gap-1.5 text-xs font-semibold"
                style={{ color }}
              >
                <Icon className="size-3.5" aria-hidden />
                {label}
              </span>
              <div className="relative h-8 min-w-0 flex-1 overflow-hidden rounded-md bg-surface-2">
                <svg
                  viewBox={`0 0 ${LIVE_BUCKETS} 100`}
                  preserveAspectRatio="none"
                  className="absolute inset-0 size-full"
                  aria-hidden
                >
                  <line x1="0" x2={LIVE_BUCKETS} y1="50" y2="50" stroke="var(--border)" strokeDasharray="2 3" />
                  <path d={lanePath(peaks)} fill={color} />
                </svg>
                {/* Scan head: where the GPU is working right now. */}
                <div
                  className="absolute inset-y-0 w-16 -translate-x-full transition-[left] duration-500 ease-linear"
                  style={{
                    left: `${filled * 100}%`,
                    background: `linear-gradient(to right, transparent, ${color})`,
                    opacity: separating ? 0.35 : 0,
                  }}
                />
                <div
                  className="absolute inset-y-0 w-px bg-foreground transition-[left] duration-500 ease-linear"
                  style={{ left: `${filled * 100}%`, opacity: separating ? 0.9 : 0 }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {gpu && (
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat icon={Gauge} label="GPU load" value={`${gpu.util}%`}>
            <Sparkline values={live?.utilHistory ?? []} />
          </Stat>
          <Stat
            icon={MemoryStick}
            label="VRAM"
            value={`${(gpu.memUsed / 1024).toFixed(1)} / ${(gpu.memTotal / 1024).toFixed(0)} GB`}
          >
            <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-border">
              <div
                className="h-full bg-accent-2 transition-[width] duration-500"
                style={{ width: `${gpu.memTotal ? (100 * gpu.memUsed) / gpu.memTotal : 0}%` }}
              />
            </div>
          </Stat>
          {gpu.temp !== undefined && (
            <Stat icon={Thermometer} label="Temperature" value={`${gpu.temp}°C`} />
          )}
          {gpu.power !== undefined && <Stat icon={Zap} label="Power" value={`${gpu.power} W`} />}
        </div>
      )}
    </div>
  );
}
