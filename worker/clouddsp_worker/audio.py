"""Audio decode/encode through ffmpeg, so every input format behaves the same."""

from __future__ import annotations

import json
import subprocess
from dataclasses import dataclass
from pathlib import Path

import numpy as np

WIRE_RATE = 44100
LOSSLESS_CODECS = {"flac", "alac"}


@dataclass
class Probe:
    codec: str
    sample_rate: int
    channels: int

    @property
    def lossless(self) -> bool:
        return self.codec in LOSSLESS_CODECS or self.codec.startswith("pcm_")


def probe(path: Path) -> Probe:
    out = subprocess.run(
        [
            "ffprobe", "-v", "error", "-select_streams", "a:0",
            "-show_entries", "stream=codec_name,sample_rate,channels",
            "-of", "json", str(path),
        ],
        check=True, capture_output=True, text=True,
    ).stdout
    streams = json.loads(out).get("streams") or []
    if not streams:
        raise ValueError("No audio stream found")
    s = streams[0]
    return Probe(s["codec_name"], int(s["sample_rate"]), int(s["channels"]))


def decode(path: Path, rate: int = WIRE_RATE) -> np.ndarray:
    """Decode to float32 stereo, shape (2, frames)."""
    raw = subprocess.run(
        [
            "ffmpeg", "-v", "error", "-i", str(path), "-map", "0:a:0",
            "-f", "f32le", "-ac", "2", "-ar", str(rate), "-",
        ],
        check=True, capture_output=True,
    ).stdout
    return np.frombuffer(raw, dtype="<f4").reshape(-1, 2).T.copy()


def write_flac(path: Path, audio: np.ndarray, in_rate: int = WIRE_RATE, out_rate: int | None = None) -> None:
    """Write (2, frames) float audio as 24-bit FLAC, optionally resampled."""
    interleaved = np.ascontiguousarray(np.clip(audio, -1.0, 1.0).T, dtype="<f4")
    cmd = [
        "ffmpeg", "-v", "error", "-y",
        "-f", "f32le", "-ar", str(in_rate), "-ac", "2", "-i", "-",
    ]
    if out_rate and out_rate != in_rate:
        cmd += ["-af", f"aresample={out_rate}"]
    cmd += ["-c:a", "flac", "-sample_fmt", "s32", "-bits_per_raw_sample", "24", str(path)]
    subprocess.run(cmd, input=interleaved.tobytes(), check=True, capture_output=True)


ENCODERS = {
    # 24-bit keeps the full dynamic range of the separated stems.
    "wav": ["-c:a", "pcm_s24le"],
    "flac": ["-c:a", "flac", "-sample_fmt", "s32", "-bits_per_raw_sample", "24"],
    "mp3": ["-c:a", "libmp3lame", "-b:a", "320k"],
}


def write_audio(path: Path, audio: np.ndarray, fmt: str, rate: int = WIRE_RATE) -> None:
    """Write (2, frames) float audio as WAV, FLAC or MP3."""
    interleaved = np.ascontiguousarray(np.clip(audio, -1.0, 1.0).T, dtype="<f4")
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-y",
            "-f", "f32le", "-ar", str(rate), "-ac", "2", "-i", "-",
            *ENCODERS[fmt], str(path),
        ],
        input=interleaved.tobytes(), check=True, capture_output=True,
    )


def write_aac(path: Path, audio: np.ndarray, rate: int = WIRE_RATE, bitrate: str = "160k") -> None:
    """Small streamable AAC for in-browser previews. faststart lets playback begin before the download ends."""
    interleaved = np.ascontiguousarray(np.clip(audio, -1.0, 1.0).T, dtype="<f4")
    subprocess.run(
        [
            "ffmpeg", "-v", "error", "-y",
            "-f", "f32le", "-ar", str(rate), "-ac", "2", "-i", "-",
            "-c:a", "aac", "-b:a", bitrate, "-movflags", "+faststart", str(path),
        ],
        input=interleaved.tobytes(), check=True, capture_output=True,
    )


def peak(audio: np.ndarray) -> float:
    return float(np.max(np.abs(audio))) if audio.size else 0.0
