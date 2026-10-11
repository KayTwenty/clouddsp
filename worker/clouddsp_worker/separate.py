"""Stem separation with Demucs on whatever accelerator is available."""

from __future__ import annotations

import hashlib
from collections.abc import Callable
from dataclasses import dataclass

import numpy as np
import torch
from demucs.apply import apply_model
from demucs.pretrained import get_model

from .audio import WIRE_RATE


@dataclass(frozen=True)
class Preset:
    model: str
    shifts: int
    overlap: float


# Fast and Balanced match stemd's presets so results line up with what
# cdj3k-mods users already know. Quality spends extra GPU time on random
# shifts, which averages out artifacts.
PRESETS = {
    "fast": Preset("htdemucs", shifts=1, overlap=0.25),
    "balanced": Preset("htdemucs_ft", shifts=1, overlap=0.25),
    "quality": Preset("htdemucs_ft", shifts=2, overlap=0.5),
}

_models: dict[str, torch.nn.Module] = {}


def pick_device() -> torch.device:
    if torch.cuda.is_available():
        return torch.device("cuda")
    if hasattr(torch, "xpu") and torch.xpu.is_available():
        return torch.device("xpu")
    return torch.device("cpu")


DEVICE = pick_device()


def _load(name: str) -> torch.nn.Module:
    if name not in _models:
        model = get_model(name)
        model.eval()
        _models[name] = model
    return _models[name]


def separation_id(preset_name: str) -> str:
    """Stable 64-hex id for this model setup. cdj3k-mods uses it as a cache folder."""
    p = PRESETS[preset_name]
    return hashlib.sha256(f"clouddsp/demucs/{p.model}/s{p.shifts}/o{p.overlap}/v1".encode()).hexdigest()


def _separate_window(model: torch.nn.Module, preset: Preset, mix: np.ndarray) -> np.ndarray:
    """Run the model on one stretch of audio. Returns (sources, 2, frames)."""
    wav = torch.from_numpy(np.ascontiguousarray(mix))
    ref = wav.mean(0)
    mean, std = ref.mean(), ref.std() + 1e-8
    wav = (wav - mean) / std

    with torch.inference_mode():
        sources = apply_model(
            model, wav[None], shifts=preset.shifts, overlap=preset.overlap,
            split=True, device=DEVICE, progress=False,
        )[0]
    sources = sources * std + mean / len(model.sources)
    return sources.cpu().numpy()


# The track is fed to the model in windows so finished audio can be reported
# while the rest is still on the GPU. Windows overlap and crossfade, so the
# seams are inaudible; inside each window Demucs does its own fine splitting.
WINDOW_S = 15
OVERLAP_S = 1

OnChunk = Callable[[int, int, dict[str, np.ndarray]], None]


def separate(mix: np.ndarray, preset_name: str, on_chunk: OnChunk | None = None) -> dict[str, np.ndarray]:
    """Split a (2, frames) 44.1 kHz mix into {vocals, drums, bass, other}.

    on_chunk(start, end, stems) is called each time frames [start, end) are final.
    """
    preset = PRESETS[preset_name]
    model = _load(preset.model)
    names = list(model.sources)
    frames = mix.shape[1]
    window, overlap = WINDOW_S * WIRE_RATE, OVERLAP_S * WIRE_RATE

    out = np.zeros((len(names), 2, frames), dtype=np.float32)
    weight = np.zeros(frames, dtype=np.float32)
    done = 0
    start = 0
    while True:
        end = min(start + window, frames)
        w = np.ones(end - start, dtype=np.float32)
        if start > 0:
            w[:overlap] = np.linspace(0, 1, overlap, dtype=np.float32)
        if end < frames:
            w[-overlap:] = np.linspace(1, 0, overlap, dtype=np.float32)

        out[..., start:end] += _separate_window(model, preset, mix[:, start:end]) * w
        weight[start:end] += w

        # Everything before the next window's start has all its contributions.
        final = frames if end == frames else end - overlap
        if on_chunk:
            stretch = out[..., done:final] / weight[done:final]
            on_chunk(done, final, {n: stretch[i] for i, n in enumerate(names)})
        done = final
        if end == frames:
            break
        start = end - overlap

    out /= np.maximum(weight, 1e-8)
    return {n: out[i] for i, n in enumerate(names)}
