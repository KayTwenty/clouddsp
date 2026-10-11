"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import {
  Drum,
  Guitar,
  Headphones,
  LoaderCircle,
  Mic,
  Pause,
  Piano,
  Play,
  RotateCcw,
  type LucideIcon,
} from "lucide-react";

type StemId = "drums" | "bass" | "other" | "vocals";

const STEM_META: Record<StemId, { label: string; icon: LucideIcon; color: string }> = {
  drums: { label: "Drums", icon: Drum, color: "var(--stem-drums)" },
  bass: { label: "Bass", icon: Guitar, color: "var(--stem-bass)" },
  other: { label: "Other", icon: Piano, color: "var(--stem-other)" },
  vocals: { label: "Vocals", icon: Mic, color: "var(--stem-vocals)" },
};

const ALL_ON: Record<StemId, boolean> = { drums: true, bass: true, other: true, vocals: true };

// Stems drifting further apart than this get snapped back to the first stem.
const MAX_DRIFT_S = 0.04;
const SYNC_EVERY_MS = 250;
const TICK_MS = 50;

type Peaks = { duration: number; stems: Partial<Record<StemId, number[]>> };
type Snapshot = { playing: boolean; loading: boolean };

const IDLE: Snapshot = { playing: false, loading: false };

/**
 * Plays one <audio> element per stem in lockstep. Muting a stem just mutes its
 * element, so toggling is instant and the stems never fall out of time. Kept
 * outside React so the component only subscribes to play/pause state.
 */
class StemEngine {
  // Only one player plays at a time across the page.
  private static active: StemEngine | null = null;

  private els = new Map<StemId, HTMLAudioElement>();
  private listeners = new Set<() => void>();
  private snapshot = IDLE;

  load(stems: { stem: StemId; url: string }[]) {
    this.dispose();
    for (const { stem, url } of stems) {
      const el = new Audio();
      // Long lists of finished tracks shouldn't download every preview up front.
      el.preload = "none";
      el.src = url;
      this.els.set(stem, el);
    }
  }

  dispose() {
    this.pause();
    for (const el of this.els.values()) {
      el.removeAttribute("src");
      el.load();
    }
    this.els.clear();
    if (StemEngine.active === this) StemEngine.active = null;
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = () => this.snapshot;

  private set(patch: Partial<Snapshot>) {
    this.snapshot = { ...this.snapshot, ...patch };
    for (const l of this.listeners) l();
  }

  private get master() {
    return this.els.values().next().value as HTMLAudioElement | undefined;
  }

  get time() {
    return this.master?.currentTime ?? 0;
  }

  get ended() {
    return this.master?.ended ?? false;
  }

  setAudible(audible: (stem: StemId) => boolean) {
    for (const [stem, el] of this.els) el.muted = !audible(stem);
  }

  async play() {
    const els = [...this.els.values()];
    if (els.length === 0) return;
    if (StemEngine.active && StemEngine.active !== this) StemEngine.active.pause();
    StemEngine.active = this;

    const t = this.time;
    for (const el of els) if (Math.abs(el.currentTime - t) > 0.01) el.currentTime = t;

    this.set({ loading: true });
    try {
      await Promise.all(els.map((el) => el.play()));
      this.set({ playing: true, loading: false });
    } catch {
      this.pause();
    }
  }

  pause() {
    for (const el of this.els.values()) el.pause();
    if (this.snapshot.playing || this.snapshot.loading) this.set(IDLE);
  }

  seek(seconds: number) {
    for (const el of this.els.values()) el.currentTime = seconds;
  }

  // Nudge any stem that drifted away from the first one back into time.
  sync() {
    const t = this.time;
    for (const el of this.els.values()) {
      if (Math.abs(el.currentTime - t) > MAX_DRIFT_S) el.currentTime = t;
    }
  }
}

function formatTime(seconds: number) {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export default function StemPlayer({
  title,
  peaksUrl,
  stems,
}: {
  title: string;
  peaksUrl: string;
  stems: { stem: string; url: string }[];
}) {
  const [engine] = useState(() => new StemEngine());
  const { playing, loading } = useSyncExternalStore(engine.subscribe, engine.getSnapshot, () => IDLE);
  const [peaks, setPeaks] = useState<Peaks | null>(null);
  const [time, setTime] = useState(0);
  const [enabled, setEnabled] = useState(ALL_ON);
  const [solo, setSolo] = useState<StemId | null>(null);

  const known = stems.filter((s): s is { stem: StemId; url: string } => s.stem in STEM_META);
  const duration = peaks?.duration ?? 0;
  const audible = (stem: StemId) => (solo ? stem === solo : enabled[stem]);

  useEffect(() => {
    engine.load(stems.filter((s): s is { stem: StemId; url: string } => s.stem in STEM_META));
    return () => engine.dispose();
  }, [engine, stems]);

  useEffect(() => {
    let cancelled = false;
    fetch(peaksUrl)
      .then((r) => (r.ok ? (r.json() as Promise<Peaks>) : null))
      .then((p) => {
        if (!cancelled && p) setPeaks(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [peaksUrl]);

  useEffect(() => {
    engine.setAudible((stem) => (solo ? stem === solo : enabled[stem]));
  }, [engine, enabled, solo, stems]);

  // While playing: follow the clock, keep stems in sync, rewind at the end.
  // A timer rather than requestAnimationFrame, which stops in background tabs
  // while the audio keeps going.
  useEffect(() => {
    if (!playing) return;
    let ticks = 0;
    const timer = setInterval(() => {
      if (engine.ended) {
        engine.pause();
        engine.seek(0);
        setTime(0);
        return;
      }
      setTime(engine.time);
      if (++ticks % (SYNC_EVERY_MS / TICK_MS) === 0) engine.sync();
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [engine, playing]);

  function seek(fraction: number) {
    const t = Math.min(Math.max(fraction, 0), 1) * duration;
    engine.seek(t);
    setTime(t);
  }

  const progress = duration > 0 ? time / duration : 0;
  const changed = solo !== null || Object.values(enabled).some((on) => !on);

  return (
    <div className="rounded-xl border border-border bg-surface p-3 sm:p-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => (playing ? engine.pause() : void engine.play())}
          aria-label={playing ? `Pause ${title}` : `Play ${title}`}
          className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-black hover:opacity-90"
        >
          {loading ? (
            <LoaderCircle className="size-5 animate-spin" aria-hidden />
          ) : playing ? (
            <Pause className="size-5" aria-hidden />
          ) : (
            <Play className="ml-0.5 size-5" aria-hidden />
          )}
        </button>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          onChange={(e) => seek(Number(e.target.value) / 1000)}
          aria-label="Seek"
          className="min-w-0 flex-1 accent-[var(--accent)]"
        />
        <span className="shrink-0 font-mono text-xs text-muted tabular-nums">
          {formatTime(time)} / {formatTime(duration)}
        </span>
        <button
          type="button"
          onClick={() => {
            setEnabled(ALL_ON);
            setSolo(null);
          }}
          disabled={!changed}
          aria-label="Turn all stems back on"
          title="Turn all stems back on"
          className="shrink-0 rounded-md p-1.5 text-muted hover:bg-border hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <RotateCcw className="size-4" aria-hidden />
        </button>
      </div>

      <div className="mt-3 flex flex-col gap-2">
        {known.map(({ stem }) => (
          <StemRow
            key={stem}
            stem={stem}
            on={audible(stem)}
            enabled={enabled[stem]}
            soloed={solo === stem}
            peaks={peaks?.stems[stem]}
            progress={progress}
            onToggle={() => {
              setSolo(null);
              setEnabled((prev) => ({ ...prev, [stem]: !prev[stem] }));
            }}
            onSolo={() => setSolo((prev) => (prev === stem ? null : stem))}
            onSeek={seek}
          />
        ))}
      </div>
    </div>
  );
}

function StemRow({
  stem,
  on,
  enabled,
  soloed,
  peaks,
  progress,
  onToggle,
  onSolo,
  onSeek,
}: {
  stem: StemId;
  on: boolean;
  enabled: boolean;
  soloed: boolean;
  peaks?: number[];
  progress: number;
  onToggle: () => void;
  onSolo: () => void;
  onSeek: (fraction: number) => void;
}) {
  const { label, icon: Icon, color } = STEM_META[stem];
  const clipId = useId();
  const width = peaks?.length ?? 1;
  // Filled bars rather than strokes: the SVG is stretched to fit, which would
  // thin strokes to nothing on narrow screens.
  const path = peaks
    ?.map((p, i) => {
      const h = Math.max(p * 48, 0.5);
      return `M${i + 0.1} ${50 - h}h0.8v${2 * h}h-0.8z`;
    })
    .join("");

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={onToggle}
        aria-pressed={enabled}
        aria-label={`${label} ${enabled ? "on" : "off"}`}
        className={`flex w-24 shrink-0 items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors sm:w-28 ${
          enabled ? "border-transparent text-black" : "border-border bg-surface-2 text-muted"
        }`}
        style={enabled ? { backgroundColor: color } : undefined}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden />
        {label}
      </button>
      <button
        type="button"
        onClick={onSolo}
        aria-pressed={soloed}
        aria-label={`Solo ${label}`}
        title={`Solo ${label}`}
        className={`shrink-0 rounded-lg border p-1.5 transition-colors ${
          soloed ? "border-transparent text-black" : "border-border text-muted hover:text-foreground"
        }`}
        style={soloed ? { backgroundColor: color } : undefined}
      >
        <Headphones className="size-3.5" aria-hidden />
      </button>
      <svg
        viewBox={`0 0 ${width} 100`}
        preserveAspectRatio="none"
        role="presentation"
        onClick={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          onSeek((e.clientX - rect.left) / rect.width);
        }}
        className={`h-9 min-w-0 flex-1 cursor-pointer rounded-md bg-surface-2 transition-opacity ${
          on ? "" : "opacity-30"
        }`}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x="0" y="0" width={progress * width} height="100" />
          </clipPath>
        </defs>
        {path && (
          <>
            <path d={path} fill={color} opacity={0.35} />
            <path d={path} fill={color} clipPath={`url(#${clipId})`} />
          </>
        )}
        <line
          x1={progress * width}
          x2={progress * width}
          y1="0"
          y2="100"
          stroke="var(--foreground)"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
    </div>
  );
}
