"""Pre-compute what each track "looks like" over time, for the player's visualiser.

For every audio file in public/audio/ this writes public/audio/<name>.viz.json:
16 log-spaced frequency bands (50 Hz - 9 kHz) plus overall loudness, sampled
15 times a second and stored as base64 bytes (0-255). The browser reads these
alongside playback, so the motion follows the actual music without routing
audio through Web Audio (which would silence tracks from other servers and can
stop background playback on iPhones).

Decoding uses macOS's built-in `afconvert` (or ffmpeg if present).

Run:  training/.venv/bin/python scripts/analyze_audio.py   (needs numpy)
"""

from __future__ import annotations

import base64
import json
import shutil
import subprocess
import tempfile
import wave
from pathlib import Path

import numpy as np

AUDIO = Path(__file__).resolve().parent.parent / "public" / "audio"
SR = 22050
FPS = 15
BANDS = 16
WIN = 2048
EXTS = {".mp3", ".m4a", ".aac", ".wav", ".ogg", ".flac"}


def decode(path: Path) -> np.ndarray:
    with tempfile.TemporaryDirectory() as tmp:
        out = Path(tmp) / "x.wav"
        if shutil.which("afconvert"):
            cmd = ["afconvert", "-f", "WAVE", "-d", f"LEI16@{SR}", "-c", "1", str(path), str(out)]
        elif shutil.which("ffmpeg"):
            cmd = ["ffmpeg", "-loglevel", "error", "-i", str(path), "-ac", "1", "-ar", str(SR), str(out)]
        else:
            raise SystemExit("needs afconvert (macOS) or ffmpeg to decode audio")
        subprocess.run(cmd, check=True)
        with wave.open(str(out)) as w:
            pcm = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)
    return pcm.astype(np.float32) / 32768.0


def analyse(signal: np.ndarray) -> np.ndarray:
    hop = SR // FPS
    pad = np.pad(signal, (WIN // 2, WIN // 2))
    frames = 1 + (len(pad) - WIN) // hop
    window = np.hanning(WIN).astype(np.float32)
    freqs = np.fft.rfftfreq(WIN, 1 / SR)
    edges = np.geomspace(50, 9000, BANDS + 1)
    idx = [np.where((freqs >= lo) & (freqs < hi))[0] for lo, hi in zip(edges[:-1], edges[1:])]

    out = np.zeros((frames, BANDS + 1), np.float32)
    for f in range(frames):
        chunk = pad[f * hop: f * hop + WIN] * window
        power = np.abs(np.fft.rfft(chunk)) ** 2
        for b, ix in enumerate(idx):
            out[f, b] = 10 * np.log10(power[ix].mean() + 1e-12)
        out[f, BANDS] = 10 * np.log10(np.mean(chunk ** 2) + 1e-12)

    # Per-band scaling: quiet floor -> 0, loud peaks -> 1, so every band moves.
    lo = np.percentile(out, 15, axis=0)
    hi = np.percentile(out, 99.5, axis=0)
    norm = np.clip((out - lo) / np.maximum(hi - lo, 1e-6), 0, 1) ** 1.3
    return (norm * 255).round().astype(np.uint8)


def main() -> None:
    files = sorted(p for p in AUDIO.iterdir() if p.suffix.lower() in EXTS)
    total = 0
    for path in files:
        data = analyse(decode(path))
        payload = {
            "fps": FPS,
            "bands": BANDS,
            "stride": BANDS + 1,  # 16 bands, then loudness
            "frames": int(data.shape[0]),
            "data": base64.b64encode(data.tobytes()).decode(),
        }
        out = path.with_suffix(".viz.json")
        out.write_text(json.dumps(payload, separators=(",", ":")))
        total += out.stat().st_size
        print(f"  {path.name:<28} {data.shape[0]:>5} frames  {out.stat().st_size / 1024:5.1f} KB")
    print(f"{len(files)} tracks, {total / 1024:.0f} KB total")


if __name__ == "__main__":
    main()
