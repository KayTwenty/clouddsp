"""Turn separated stems into files a deck, DAW or DJ app can use.

tracks  every stem as its own WAV, FLAC or MP3, playable anywhere.
cdj3k   the on-USB stem cache read by cdj3k-mods on the CDJ-3000, see
        package/deck/mods/stem/cache.c in github.com/nsaintot/cdj3k-mods.
"""

from __future__ import annotations

import json
import math
import struct
from dataclasses import dataclass
from pathlib import Path

import numpy as np

from .audio import WIRE_RATE, Probe, peak, write_aac, write_audio, write_flac


@dataclass
class Output:
    path: Path
    # Where the file lands in "download as zip".
    zip_path: str
    # Whether it also gets its own download button.
    listed: bool = True

    def to_api(self) -> dict:
        return {"name": self.path.name, "zipPath": self.zip_path, "listed": self.listed}


TRACK_LABELS = {
    "vocals": "Vocals",
    "drums": "Drums",
    "bass": "Bass",
    "other": "Other",
    "instrumental": "Instrumental",
}


def export_tracks(
    stems: dict[str, np.ndarray], mix: np.ndarray, title: str, fmt: str, out_dir: Path
) -> list[Output]:
    parts = dict(stems)
    parts["instrumental"] = mix - stems["vocals"]

    # One shared scale keeps the stems' balance intact if anything clips.
    loudest = max(peak(a) for a in parts.values())
    scale = 0.999 / loudest if loudest > 0.999 else 1.0

    outputs = []
    for name, label in TRACK_LABELS.items():
        path = out_dir / f"{title} ({label}).{fmt}"
        write_audio(path, parts[name] * scale, fmt)
        outputs.append(Output(path, f"{title}/{path.name}"))
    return outputs


# In-browser stem player ------------------------------------------------------

PREVIEW_STEMS = ("drums", "bass", "other", "vocals")
PEAK_BUCKETS = 1200


def export_preview(stems: dict[str, np.ndarray], out_dir: Path) -> tuple[Path, dict[str, Path]]:
    """AAC copy of each stem plus one JSON of waveform peaks for drawing."""
    loudest = max(peak(stems[s]) for s in PREVIEW_STEMS)
    scale = 0.999 / loudest if loudest > 0.999 else 1.0

    files: dict[str, Path] = {}
    peaks: dict[str, list[float]] = {}
    for stem in PREVIEW_STEMS:
        audio = stems[stem] * scale
        files[stem] = out_dir / f"preview-{stem}.m4a"
        write_aac(files[stem], audio)

        mono = np.abs(audio).max(axis=0)
        buckets = np.array_split(mono, PEAK_BUCKETS)
        peaks[stem] = [float(b.max()) if b.size else 0.0 for b in buckets]

    # Normalize against the loudest stem so quiet stems look quiet.
    top = max(max(p) for p in peaks.values()) or 1.0
    frames = next(iter(stems.values())).shape[1]
    peaks_path = out_dir / "preview-peaks.json"
    peaks_path.write_text(
        json.dumps(
            {
                "duration": frames / WIRE_RATE,
                "stems": {s: [round(v / top, 3) for v in p] for s, p in peaks.items()},
            },
            separators=(",", ":"),
        )
    )
    return peaks_path, files


# cdj3k-mods cache ----------------------------------------------------------

CACHE_ROOT = "mods/stemd-cache"
META_VERSION = 1
KEY_WINDOW = 64 * 1024
FRAME_QUANTUM = 588  # 1/75 s at 44.1 kHz; the deck rounds decode length up to this
DECK_RATE = 96000  # the deck mixes at 96 kHz; stems at this rate load in seconds

FNV_OFFSET = 0xCBF29CE484222325
FNV_PRIME = 0x100000001B3
MASK64 = (1 << 64) - 1


def _fnv1a(data: bytes, h: int) -> int:
    for b in data:
        h = ((h ^ b) * FNV_PRIME) & MASK64
    return h


def cache_key(track: Path, frames: int) -> str:
    """Matches key_of() in cache.c: FNV-1a 64 over size, frames, head and tail."""
    size = track.stat().st_size
    h = _fnv1a(struct.pack("<Q", size), FNV_OFFSET)
    h = _fnv1a(struct.pack("<Q", frames), h)
    with track.open("rb") as f:
        h = _fnv1a(f.read(KEY_WINDOW), h)
        if size > KEY_WINDOW:
            f.seek(max(0, size - KEY_WINDOW))
            h = _fnv1a(f.read(KEY_WINDOW), h)
    return f"{h:016x}"


def cdj3k_supported(info: Probe) -> str | None:
    """Return a reason the native cache can't be written, or None if it can.

    The cache key includes the deck's own decode length. For lossless files at
    44.1 kHz that is exactly the sample count. Lossy files depend on decoder
    padding rules we haven't verified on hardware yet, so they fall back.
    """
    if not info.lossless:
        return "MP3 and AAC files aren't supported for native CDJ-3000 stems yet, so stems came as separate tracks."
    if info.sample_rate != WIRE_RATE:
        return f"Native CDJ-3000 stems need 44.1 kHz files (this one is {info.sample_rate / 1000:g} kHz), so stems came as separate tracks."
    return None


def export_cdj3k(
    stems: dict[str, np.ndarray],
    source: Path,
    mix_frames: int,
    sep_id: str,
    work_dir: Path,
) -> list[Output]:
    """The three files of one cache entry, each placed at its USB path in the zip."""
    frames = math.ceil(mix_frames / FRAME_QUANTUM) * FRAME_QUANTUM
    key = cache_key(source, frames)
    entry = f"{CACHE_ROOT}/{sep_id}/{key[:2]}/{key}"

    # The deck derives drums as mix - harmonics - vocals.
    parts = {
        "harmonics": stems["bass"] + stems["other"],
        "vocals": stems["vocals"],
    }

    # Stored audio is multiplied by `gain`; the deck multiplies by 1/gain to
    # restore it. Leave a little headroom for resampler overshoot.
    gains: dict[str, float] = {}
    outputs: list[Output] = []
    for name, audio in parts.items():
        p = peak(audio)
        gain = 0.98 / p if p > 0.98 else 1.0
        gains[name] = gain
        path = work_dir / f"{name}.flac"
        write_flac(path, audio * gain, out_rate=DECK_RATE)
        outputs.append(Output(path, f"{entry}/{name}.flac", listed=False))

    meta = work_dir / "meta"
    # Bytes, not text: on Windows write_text would turn \n into \r\n, which the
    # deck's parser doesn't expect.
    meta.write_bytes(
        (
            f"v={META_VERSION}\nframes={frames}\n"
            f"harmonics={gains['harmonics']:.9g}\nvocals={gains['vocals']:.9g}\n"
        ).encode()
    )
    outputs.append(Output(meta, f"{entry}/meta", listed=False))
    return outputs
