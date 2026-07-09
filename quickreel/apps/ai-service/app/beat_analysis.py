"""Real beat/tempo/energy analysis via librosa.

This is the one genuinely Python-only surface in QuickReel AI -- the rest
of the AI Director Engine is TypeScript. Output shape matches
packages/shared/src/beat-grid.ts's BeatGridSchema exactly (camelCase keys)
so apps/worker can `BeatGridSchema.parse()` the response with zero
translation.
"""

from __future__ import annotations

import numpy as np
import librosa

ANALYSIS_VERSION = "beat-engine-v1"
BEATS_PER_BAR = 4
ENERGY_SAMPLE_STEP_MS = 100.0
DROP_DETECTION_MIN_SIGNIFICANCE = 1.6  # peak derivative must exceed this multiple of the median |derivative|


def analyze_audio_file(path: str, source_track_id: str) -> dict:
    y, sr = librosa.load(path, sr=None, mono=True)
    duration_ms = float(librosa.get_duration(y=y, sr=sr) * 1000)

    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, units="frames")
    bpm = float(np.atleast_1d(tempo)[0])
    beat_times_s = librosa.frames_to_time(beat_frames, sr=sr)
    beat_timestamps_ms = [float(t * 1000) for t in beat_times_s]

    if len(beat_timestamps_ms) == 0:
        # Extremely short or silent clips: fall back to a synthetic grid at the detected (or default) tempo
        # so downstream beat-snapping always has at least one beat to work with.
        bpm = bpm if bpm > 0 else 100.0
        beat_ms = 60000.0 / bpm
        beat_timestamps_ms = list(np.arange(0, duration_ms, beat_ms))

    bar_start_timestamps_ms = beat_timestamps_ms[::BEATS_PER_BAR]

    energy_curve = _compute_energy_curve(y, sr, duration_ms)
    sections = _detect_sections(energy_curve, duration_ms)

    return {
        "bpm": round(bpm, 2),
        "beatsPerBar": BEATS_PER_BAR,
        "beatTimestampsMs": beat_timestamps_ms,
        "barStartTimestampsMs": bar_start_timestamps_ms,
        "energyCurve": energy_curve,
        "sections": sections,
        "durationMs": duration_ms,
        "sourceTrackId": source_track_id,
        "analysisVersion": ANALYSIS_VERSION,
    }


def _compute_energy_curve(y: np.ndarray, sr: int, duration_ms: float) -> list[dict]:
    hop_length = 512
    rms = librosa.feature.rms(y=y, hop_length=hop_length)[0]
    rms_times_ms = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop_length) * 1000

    rms_min, rms_max = float(rms.min()), float(rms.max())
    rms_norm = (rms - rms_min) / (rms_max - rms_min + 1e-9)

    sample_count = max(1, int(duration_ms // ENERGY_SAMPLE_STEP_MS))
    sample_times_ms = np.arange(sample_count) * ENERGY_SAMPLE_STEP_MS
    sampled_energy = np.interp(sample_times_ms, rms_times_ms, rms_norm)

    return [{"tMs": float(t), "energy": float(e)} for t, e in zip(sample_times_ms, sampled_energy)]


def _detect_sections(energy_curve: list[dict], duration_ms: float) -> dict:
    intro_end_ms = min(duration_ms * 0.15, 6000)
    outro_start_ms = max(duration_ms * 0.85, duration_ms - 6000)

    drop_at_ms = _detect_drop(energy_curve, intro_end_ms, outro_start_ms)
    build_up = (
        {"startMs": max(0.0, drop_at_ms - 4000), "endMs": drop_at_ms} if drop_at_ms is not None else None
    )

    return {
        "intro": {"startMs": 0.0, "endMs": intro_end_ms},
        "buildUp": build_up,
        "drop": {"atMs": drop_at_ms} if drop_at_ms is not None else None,
        "body": {"startMs": intro_end_ms, "endMs": outro_start_ms},
        "outro": {"startMs": outro_start_ms, "endMs": duration_ms},
    }


def _detect_drop(energy_curve: list[dict], search_start_ms: float, search_end_ms: float) -> float | None:
    """Heuristic: the drop is the sharpest positive jump in the (smoothed) energy
    envelope inside the search window, provided that jump is meaningfully
    bigger than the track's typical frame-to-frame energy change. Not a
    trained transient/drop detector -- see apps/ai-service/README.md."""
    if len(energy_curve) < 5:
        return None

    energies = np.array([p["energy"] for p in energy_curve])
    times = np.array([p["tMs"] for p in energy_curve])

    window = max(3, len(energies) // 50)
    kernel = np.ones(window) / window
    smoothed = np.convolve(energies, kernel, mode="same")

    derivative = np.diff(smoothed, prepend=smoothed[0])
    median_abs_deriv = float(np.median(np.abs(derivative))) + 1e-9

    in_window = (times >= search_start_ms) & (times <= search_end_ms)
    if not np.any(in_window):
        return None

    candidate_idx = np.argmax(np.where(in_window, derivative, -np.inf))
    peak_derivative = derivative[candidate_idx]

    if peak_derivative < DROP_DETECTION_MIN_SIGNIFICANCE * median_abs_deriv:
        return None

    return float(times[candidate_idx])
