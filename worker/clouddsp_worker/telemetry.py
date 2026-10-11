"""GPU stats for the live visualizer. NVIDIA through NVML, otherwise best effort."""

from __future__ import annotations

import torch

from .separate import DEVICE

try:
    import pynvml

    pynvml.nvmlInit()
    _handle = pynvml.nvmlDeviceGetHandleByIndex(torch.cuda.current_device()) if DEVICE.type == "cuda" else None
except Exception:  # no NVIDIA driver, or not an NVIDIA GPU
    _handle = None


def sample() -> dict | None:
    if _handle is not None:
        util = pynvml.nvmlDeviceGetUtilizationRates(_handle)
        mem = pynvml.nvmlDeviceGetMemoryInfo(_handle)
        out = {
            "name": pynvml.nvmlDeviceGetName(_handle),
            "util": util.gpu,
            "memUsed": mem.used // 2**20,
            "memTotal": mem.total // 2**20,
        }
        try:
            out["temp"] = pynvml.nvmlDeviceGetTemperature(_handle, pynvml.NVML_TEMPERATURE_GPU)
            out["power"] = round(pynvml.nvmlDeviceGetPowerUsage(_handle) / 1000)
        except pynvml.NVMLError:
            pass
        return out
    if DEVICE.type == "xpu":
        props = torch.xpu.get_device_properties()
        return {
            "name": props.name,
            "util": 0,
            "memUsed": torch.xpu.memory_allocated() // 2**20,
            "memTotal": props.total_memory // 2**20,
        }
    return None
