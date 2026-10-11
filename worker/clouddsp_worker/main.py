"""Job loop: claim a job from the cloudDSP site, process it, upload results.

The worker only ever talks to the site's HTTP API and the signed URLs it hands
out, so it runs the same on this PC, a rented GPU or the home cluster.
"""

from __future__ import annotations

import os
import sys
import tempfile
import time
import traceback
from pathlib import Path

import requests

from . import audio, exporters, separate
from .live import LiveReporter

SITE = os.environ.get("CLOUDDSP_URL", "http://localhost:3000").rstrip("/")
TOKEN = os.environ.get("WORKER_TOKEN", "dev-worker-token")
POLL_SECONDS = 2.0

session = requests.Session()
session.headers["Authorization"] = f"Bearer {TOKEN}"


def api(job_id: str, action: str, *, via: requests.Session = session, **body) -> dict:
    r = via.post(f"{SITE}/api/worker/jobs/{job_id}", json={"action": action, **body}, timeout=30)
    r.raise_for_status()
    return r.json()


def live_poster(job_id: str):
    # The reporter posts from its own thread, so it gets its own session.
    own = requests.Session()
    own.headers["Authorization"] = session.headers["Authorization"]
    return lambda body: api(job_id, "progress", via=own, **body)


def download(url: str, target: Path) -> None:
    with requests.get(url, stream=True, timeout=60) as r:
        r.raise_for_status()
        with target.open("wb") as f:
            for chunk in r.iter_content(1 << 20):
                f.write(chunk)


def upload(job_id: str, path: Path) -> str:
    url = api(job_id, "upload-url", name=path.name)["url"]
    with path.open("rb") as f:
        r = requests.put(url, data=f, headers={"Content-Length": str(path.stat().st_size)}, timeout=600)
    r.raise_for_status()
    return path.name


def process(claim: dict) -> None:
    job, job_id = claim["job"], claim["job"]["id"]
    title = Path(job["filename"]).stem
    print(f"Job {job_id}: {job['filename']} ({job['preset']}, {job['output']})")

    with tempfile.TemporaryDirectory(prefix="clouddsp-") as tmp, LiveReporter(live_poster(job_id)) as live:
        work = Path(tmp)
        source = work / ("input" + Path(job["filename"]).suffix.lower())

        live.stage("downloading")
        download(claim["inputUrl"], source)

        live.stage("decoding")
        info = audio.probe(source)
        mix = audio.decode(source)
        live.track(mix.shape[1], audio.peak(mix))

        live.stage("separating")
        started = time.perf_counter()
        stems = separate.separate(mix, job["preset"], on_chunk=live.chunk)
        took = time.perf_counter() - started
        print(f"  separated {mix.shape[1] / audio.WIRE_RATE:.0f}s of audio in {took:.1f}s on {separate.DEVICE}")

        live.stage("writing")
        notes: list[str] = []
        outputs: list[exporters.Output] = []
        if job["output"] == "mod" and job["modFormat"] == "cdj3k":
            reason = exporters.cdj3k_supported(info)
            if reason is None:
                outputs = exporters.export_cdj3k(
                    stems, source, mix.shape[1], separate.separation_id(job["preset"]), work,
                )
                notes.append("Unzip onto the root of the USB stick that holds this exact file.")
            else:
                notes.append(reason)
        if not outputs:
            outputs = exporters.export_tracks(stems, mix, title, job.get("format", "flac"), work)

        peaks_path, preview_files = exporters.export_preview(stems, work)

        to_upload = [*(o.path for o in outputs), peaks_path, *preview_files.values()]
        for i, path in enumerate(to_upload):
            live.stage("uploading", 100 * i / len(to_upload))
            upload(job_id, path)

    # The reporter has stopped by now, so no late progress update can land
    # after the job is marked complete.
    preview = {
        "peaks": peaks_path.name,
        "stems": {stem: p.name for stem, p in preview_files.items()},
    }
    api(job_id, "complete", outputs=[o.to_api() for o in outputs], notes=notes, preview=preview)
    print(f"  done: {', '.join(o.path.name for o in outputs)}")


def main() -> None:
    sys.stdout.reconfigure(line_buffering=True)  # show logs live when piped
    print(f"cloudDSP worker on {separate.DEVICE}, polling {SITE}")
    while True:
        try:
            r = session.post(f"{SITE}/api/worker/claim", timeout=30)
            if r.status_code == 204:
                time.sleep(POLL_SECONDS)
                continue
            r.raise_for_status()
            claim = r.json()
        except requests.RequestException as e:
            # Site down, redeploying or erroring: wait it out instead of exiting.
            print(f"claim failed, retrying: {e}")
            time.sleep(POLL_SECONDS * 5)
            continue
        try:
            process(claim)
        except Exception as e:  # report and keep serving other jobs
            traceback.print_exc()
            try:
                api(claim["job"]["id"], "fail", error=f"{type(e).__name__}: {e}")
            except requests.RequestException:
                pass


if __name__ == "__main__":
    main()
