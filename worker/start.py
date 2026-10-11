"""Start the cloudDSP worker with the right PyTorch build for this machine's GPU.

Run from the repository root:

    uv run --no-project worker/start.py

It asks nvidia-smi which GPU and driver are installed, picks the matching
PyTorch CUDA build (an "extra" in worker/pyproject.toml), installs it if
needed and starts the worker. Standard library only, so it runs before any
dependencies exist.

    GTX 10-series (Pascal), compute < 7.5   -> cu126  (newer builds dropped it)
    RTX 50-series (Blackwell), compute 10+  -> cu128  (needs driver 570+)
    RTX 20/30/40-series                     -> cu128 on driver 570+, else cu126

Override with CLOUDDSP_TORCH=cu126 or cu128. Pass --dry-run to only print the
choice. Any other arguments go to the worker.
"""

from __future__ import annotations

import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

WORKER_DIR = Path(__file__).resolve().parent
CU128_MIN_DRIVER = 570
CU126_MIN_DRIVER = 560

# Fallback when the driver is too old to report compute capability.
NAME_HINTS = [
    (r"RTX\s*50\d\d|RTX PRO \d+ Blackwell|B\d00", 12.0),
    (r"RTX\s*40\d\d|L4\b|L40|RTX \d+ Ada", 8.9),
    (r"RTX\s*30\d\d|A\d{2,4}\b", 8.6),
    (r"RTX\s*20\d\d|GTX\s*16\d\d|T4\b|TITAN RTX|Quadro RTX", 7.5),
    (r"TITAN V|V100", 7.0),
    (r"GTX\s*10\d\d|TITAN Xp?|P\d{2,4}\b|Quadro P", 6.1),
]


def log(message: str) -> None:
    print(f"[start] {message}", flush=True)


def query_gpus() -> list[dict]:
    """Every NVIDIA GPU nvidia-smi can see, with compute capability and driver."""
    if not shutil.which("nvidia-smi"):
        return []

    def run(fields: str) -> list[list[str]] | None:
        try:
            out = subprocess.run(
                ["nvidia-smi", f"--query-gpu={fields}", "--format=csv,noheader"],
                capture_output=True, text=True, check=True, timeout=20,
            ).stdout
        except (subprocess.SubprocessError, OSError):
            return None
        return [[c.strip() for c in line.split(",")] for line in out.strip().splitlines() if line.strip()]

    rows = run("index,name,driver_version,compute_cap")
    with_cap = rows is not None
    if rows is None:
        rows = run("index,name,driver_version")  # drivers before ~510 lack compute_cap
    if not rows:
        return []

    gpus = []
    for row in rows:
        index, name, driver = row[0], row[1], row[2]
        cap = None
        if with_cap and len(row) > 3:
            try:
                cap = float(row[3])
            except ValueError:
                pass
        if cap is None:
            cap = next((c for pattern, c in NAME_HINTS if re.search(pattern, name, re.I)), None)
        driver_major = int(re.match(r"\d+", driver).group()) if re.match(r"\d+", driver) else 0
        gpus.append({"index": index, "name": name, "driver": driver_major, "cap": cap})
    return gpus


def visible(gpus: list[dict]) -> list[dict]:
    """Respect CUDA_VISIBLE_DEVICES when it lists GPU indexes."""
    selected = os.environ.get("CUDA_VISIBLE_DEVICES", "").strip()
    if not selected or not all(p.strip().isdigit() for p in selected.split(",")):
        return gpus
    wanted = {p.strip() for p in selected.split(",")}
    return [g for g in gpus if g["index"] in wanted]


def choose_build(gpus: list[dict]) -> tuple[str | None, str]:
    """Return (extra, reason). extra is None when no NVIDIA build fits."""
    if not gpus:
        return None, "no NVIDIA GPU found, so PyTorch runs on the CPU (or an Intel GPU)"

    unknown = [g["name"] for g in gpus if g["cap"] is None]
    if unknown:
        return "cu128", f"couldn't identify {', '.join(unknown)}; trying the newest build"

    driver = min(g["driver"] for g in gpus)
    needs_old = [g for g in gpus if g["cap"] < 7.5]
    needs_new = [g for g in gpus if g["cap"] >= 10]

    if needs_old and needs_new:
        sys.exit(
            "[start] This machine mixes a GTX 10-series card with an RTX 50-series card, and no "
            "single PyTorch build supports both. Run one worker per GPU instead, e.g.\n"
            "  set CUDA_VISIBLE_DEVICES=0 and start one worker, then CUDA_VISIBLE_DEVICES=1 for another."
        )
    if needs_old:
        if driver < CU126_MIN_DRIVER:
            log(f"warning: driver {driver} is older than {CU126_MIN_DRIVER}; update it if CUDA fails")
        return "cu126", f"{needs_old[0]['name']} (compute {needs_old[0]['cap']}) needs the CUDA 12.6 build"
    if needs_new:
        if driver < CU128_MIN_DRIVER:
            sys.exit(
                f"[start] {needs_new[0]['name']} needs NVIDIA driver {CU128_MIN_DRIVER} or newer "
                f"(found {driver}). Update the driver and run this again."
            )
        return "cu128", f"{needs_new[0]['name']} (compute {needs_new[0]['cap']}) needs the CUDA 12.8 build"
    if driver >= CU128_MIN_DRIVER:
        return "cu128", f"{gpus[0]['name']} on driver {driver}: using the CUDA 12.8 build"
    return "cu126", f"{gpus[0]['name']} on driver {driver} (below {CU128_MIN_DRIVER}): using the CUDA 12.6 build"


def main() -> None:
    args = [a for a in sys.argv[1:] if a != "--dry-run"]
    dry_run = "--dry-run" in sys.argv[1:]

    if not shutil.which("uv"):
        sys.exit("[start] uv isn't installed. Get it from https://docs.astral.sh/uv/")

    forced = os.environ.get("CLOUDDSP_TORCH", "").strip().lower()
    gpus = visible(query_gpus())
    for g in gpus:
        cap = f"compute {g['cap']}" if g["cap"] is not None else "compute unknown"
        log(f"GPU {g['index']}: {g['name']} ({cap}, driver {g['driver']})")

    if forced:
        if forced not in ("cu126", "cu128"):
            sys.exit("[start] CLOUDDSP_TORCH must be cu126 or cu128")
        extra, reason = forced, "set by CLOUDDSP_TORCH"
    else:
        extra, reason = choose_build(gpus)
    log(f"PyTorch build: {extra or 'default (CPU)'}, {reason}")

    if dry_run:
        return

    cmd = ["uv", "run", "--project", str(WORKER_DIR)]
    if extra:
        cmd += ["--extra", extra]
    cmd += ["clouddsp-worker", *args]
    log("installing if needed and starting the worker...")
    try:
        sys.exit(subprocess.call(cmd))
    except KeyboardInterrupt:
        sys.exit(130)


if __name__ == "__main__":
    main()
