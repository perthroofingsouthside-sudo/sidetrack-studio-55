"""Local DSP beat synthesizer — turns a step-sequence pattern into a real WAV
file using numpy. No external API needed. Output is a 16-bit PCM mono WAV at
44.1 kHz, encoded to base64 for inline delivery via the existing
/api/studio/beat/* endpoints.

Sound model (intentionally simple, sounds like a classic drum machine):
  - Kick:  60 Hz sine + exp envelope (decay ~0.18s)
  - Snare: filtered white noise + 200 Hz sine (decay ~0.12s)
  - Hihat: high-passed white noise (decay ~0.05s)
  - Bass:  square @ key note × octave (sustain matches 1/16 step)
"""
from __future__ import annotations
import io
import math
import wave
import base64
from typing import Dict, List

import numpy as np

SR = 44100  # sample rate
KEY_FREQ = {
    "C": 65.41, "D": 73.42, "E": 82.41, "F": 87.31,
    "G": 98.00, "A": 110.00, "B": 123.47,
}


def _envelope(n_samples: int, attack: float = 0.005, decay: float = 0.18) -> np.ndarray:
    """Exponential attack-decay envelope."""
    t = np.arange(n_samples) / SR
    a = np.clip(t / max(attack, 1e-6), 0, 1)
    d = np.exp(-t / max(decay, 1e-6))
    return a * d


def _kick(dur: float = 0.18) -> np.ndarray:
    n = int(SR * dur)
    t = np.arange(n) / SR
    # Pitch-sweep sine 120Hz → 50Hz (gives that "thump")
    freq = 50 + (120 - 50) * np.exp(-t / 0.04)
    phase = 2 * np.pi * np.cumsum(freq) / SR
    return np.sin(phase) * _envelope(n, attack=0.001, decay=0.15)


def _snare(dur: float = 0.12) -> np.ndarray:
    n = int(SR * dur)
    noise = np.random.default_rng(42).standard_normal(n)
    # Crude high-pass: subtract a 1-sample moving average
    noise = noise - np.convolve(noise, np.ones(8) / 8, mode="same")
    tone = np.sin(2 * np.pi * 200 * np.arange(n) / SR) * 0.4
    return (noise * 0.6 + tone) * _envelope(n, attack=0.001, decay=0.09)


def _hihat(dur: float = 0.05) -> np.ndarray:
    n = int(SR * dur)
    noise = np.random.default_rng(7).standard_normal(n)
    # Stronger high-pass for a "tssss"
    noise = noise - np.convolve(noise, np.ones(4) / 4, mode="same")
    return noise * _envelope(n, attack=0.001, decay=0.03)


def _bass(freq: float, dur: float) -> np.ndarray:
    n = int(SR * dur)
    t = np.arange(n) / SR
    # Detuned saw via sum of sines (avoids harsh aliasing)
    sig = sum(np.sin(2 * np.pi * freq * k * t) / k for k in (1, 2, 3, 4)) * 0.35
    return sig * _envelope(n, attack=0.005, decay=dur * 0.7)


def synthesize_beat_wav(pattern: Dict[str, List[int]], bpm: int, key: str) -> bytes:
    """Render `pattern` to a 16-bit PCM WAV bytes object.

    pattern values are step lists of length `bars*4` (each step = 1/16 note).
    """
    steps = len(next(iter(pattern.values())))
    step_dur = 60.0 / bpm / 4.0  # 1/16 note duration in seconds
    total_samples = int(SR * step_dur * steps) + SR  # +1s tail

    track = np.zeros(total_samples, dtype=np.float32)

    # Pre-render one-shot samples
    one_shots = {
        "kick": _kick(),
        "snare": _snare(),
        "hihat": _hihat(),
    }
    bass_freq = KEY_FREQ.get(key.upper(), KEY_FREQ["C"])

    for stem, hits in pattern.items():
        for idx, on in enumerate(hits):
            if not on:
                continue
            start = int(idx * step_dur * SR)
            if stem == "bass":
                sample = _bass(bass_freq, step_dur * 1.5)
                gain = 0.55
            elif stem in one_shots:
                sample = one_shots[stem]
                gain = {"kick": 0.85, "snare": 0.65, "hihat": 0.35}[stem]
            else:
                continue
            end = min(start + len(sample), total_samples)
            track[start:end] += sample[: end - start] * gain

    # Soft limiter
    peak = float(np.max(np.abs(track))) or 1.0
    track = track / peak * 0.92
    pcm = (track * 32767).astype(np.int16)

    buf = io.BytesIO()
    with wave.open(buf, "wb") as wf:
        wf.setnchannels(1)
        wf.setsampwidth(2)
        wf.setframerate(SR)
        wf.writeframes(pcm.tobytes())
    return buf.getvalue()


def synthesize_beat_data_url(pattern: Dict[str, List[int]], bpm: int, key: str) -> str:
    """Return a data:audio/wav;base64,... URI usable directly as <audio src>."""
    wav_bytes = synthesize_beat_wav(pattern, bpm, key)
    return "data:audio/wav;base64," + base64.b64encode(wav_bytes).decode("ascii")
