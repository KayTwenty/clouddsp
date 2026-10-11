# cloudDSP GPU worker. Needs the NVIDIA Container Toolkit on the host.
# Build arg TORCH picks the PyTorch build: cu128 (RTX 20-series and newer,
# default) or cu126 (GTX 10-series). See docs/self-hosting.md.

FROM python:3.12-slim-bookworm

RUN apt-get update \
    && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*
COPY --from=ghcr.io/astral-sh/uv:0.11.28 /uv /uvx /bin/

WORKDIR /worker
ARG TORCH=cu128
ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    # Demucs model weights are downloaded once into this volume.
    TORCH_HOME=/cache/torch

# Dependencies first so code changes don't reinstall PyTorch.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-install-project --extra ${TORCH}
COPY clouddsp_worker ./clouddsp_worker
RUN uv sync --frozen --extra ${TORCH}

VOLUME /cache
CMD ["uv", "run", "--no-sync", "clouddsp-worker"]
