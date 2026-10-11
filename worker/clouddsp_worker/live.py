"""Streams progress to the site while a job runs: stage, percent, the waveform
of each stem as it comes off the GPU, and GPU telemetry.

One background thread does all the posting, so separation never waits on the
network and updates arrive in order.
"""

from __future__ import annotations

import threading
from collections.abc import Callable

import numpy as np

from . import telemetry

LIVE_BUCKETS = 400  # must match LIVE_BUCKETS in lib/devices.ts
LIVE_STEMS = ("drums", "bass", "other", "vocals")
INTERVAL_S = 0.5


class LiveReporter:
    def __init__(self, post: Callable[[dict], None]):
        self._post = post
        self._frames = 1
        self._scale = 1.0
        self._lock = threading.Lock()
        self._stage = "downloading"
        self._percent = 0.0
        self._filled = 0.0
        self._peaks: dict[str, dict[int, float]] = {s: {} for s in LIVE_STEMS}
        self._stop = threading.Event()
        self._thread = threading.Thread(target=self._run, daemon=True)

    def __enter__(self) -> LiveReporter:
        self._thread.start()
        return self

    def __exit__(self, *exc) -> None:
        self._stop.set()
        self._thread.join()

    def track(self, frames: int, mix_peak: float) -> None:
        """Set once the track is decoded. Peaks are scaled to the full mix's peak."""
        with self._lock:
            self._frames = max(frames, 1)
            self._scale = 1.0 / max(mix_peak, 1e-6)

    def stage(self, stage: str, percent: float = 0) -> None:
        with self._lock:
            self._stage, self._percent = stage, percent
        print(f"  {stage} {percent:.0f}%")

    def chunk(self, start: int, end: int, stems: dict[str, np.ndarray]) -> None:
        """Record peaks for frames [start, end) of every stem."""
        first = start * LIVE_BUCKETS // self._frames
        last = min((end - 1) * LIVE_BUCKETS // self._frames, LIVE_BUCKETS - 1)
        edges = [max(start, b * self._frames // LIVE_BUCKETS) for b in range(first, last + 1)] + [end]
        with self._lock:
            for stem in LIVE_STEMS:
                mono = np.abs(stems[stem]).max(axis=0)
                for i, b in enumerate(range(first, last + 1)):
                    lo, hi = edges[i] - start, edges[i + 1] - start
                    if hi > lo:
                        v = min(1.0, float(mono[lo:hi].max()) * self._scale)
                        self._peaks[stem][b] = max(self._peaks[stem].get(b, 0.0), v)
            self._filled = end / self._frames
            self._percent = 100 * self._filled

    def _take(self) -> dict:
        with self._lock:
            live: dict = {"filled": self._filled}
            peaks = {}
            for stem, buckets in self._peaks.items():
                if buckets:
                    lo, hi = min(buckets), max(buckets)
                    peaks[stem] = [lo, *(round(buckets.get(b, 0.0), 3) for b in range(lo, hi + 1))]
                    buckets.clear()
            if peaks:
                live["peaks"] = peaks
            body = {"stage": self._stage, "percent": round(self._percent), "live": live}
        gpu = telemetry.sample()
        if gpu:
            live["gpu"] = gpu
        return body

    def _run(self) -> None:
        while True:
            stopping = self._stop.wait(INTERVAL_S)
            try:
                self._post(self._take())
            except Exception as e:  # a dropped update is fine; the next one catches up
                print(f"  live update failed: {e}")
            if stopping:
                return
