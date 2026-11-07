#!/usr/bin/env python3
"""Merge pitch-tracker evidence into a continuous teaching and vibrato contour."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import numpy as np
from scipy.ndimage import median_filter
from scipy.signal import butter, hilbert, sosfiltfilt


def track_values(frames: list[dict], length: int) -> np.ndarray:
    values = np.full(length, np.nan)
    for index, frame in enumerate(frames[:length]):
        if frame.get("voiced") and frame.get("midi") is not None:
            values[index] = float(frame["midi"])
    return values


def merge_pitch_tracks(
    pyin: np.ndarray,
    rmvpe_vocal: np.ndarray,
    rmvpe_mix: np.ndarray,
    strength: np.ndarray,
    *,
    frame_rate: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Prefer pYIN, correct corroborated octaves, and fill only vocal-backed gaps."""
    length = len(pyin)
    merged = pyin.copy()
    source = np.full(length, "none", dtype=object)
    source[~np.isnan(pyin)] = "pyin"
    for index in range(length):
        p, vocal, mix = pyin[index], rmvpe_vocal[index], rmvpe_mix[index]
        if not np.isnan(p) and not np.isnan(vocal) and not np.isnan(mix):
            octave_error = (9.5 <= abs(p - vocal) <= 14.5) or (17.5 <= abs(p - vocal) <= 26.5)
            if octave_error and abs(vocal - mix) <= 0.55:
                merged[index], source[index] = vocal, "rmvpe-octave"
                continue
        if not np.isnan(p) or np.isnan(vocal) or strength[index] < 0.10:
            continue
        radius = max(1, round(frame_rate * 0.12))
        left = pyin[max(0, index - radius):index]
        right = pyin[index + 1:min(length, index + radius + 1)]
        near_pyin = np.any(~np.isnan(left)) or np.any(~np.isnan(right))
        mix_confirms = not np.isnan(mix) and abs(vocal - mix) <= 1.5
        if near_pyin or mix_confirms:
            merged[index], source[index] = vocal, "rmvpe-fill"
    return merged, source


def vibrato_depth(midi: np.ndarray, frame_rate: int) -> np.ndarray:
    """Return the 4–8 Hz pitch-modulation depth in cents for stable voiced runs."""
    depth = np.zeros(len(midi))
    sos = butter(3, [4.0, 8.0], btype="bandpass", fs=frame_rate, output="sos")
    index = 0
    while index < len(midi):
        if np.isnan(midi[index]):
            index += 1
            continue
        start = index
        while index < len(midi) and not np.isnan(midi[index]):
            index += 1
        segment = midi[start:index]
        if len(segment) < round(frame_rate * 0.45):
            continue
        center = median_filter(segment, size=max(3, (round(frame_rate * .31) // 2) * 2 + 1), mode="nearest")
        deviation = (segment - center) * 100.0
        try:
            analytic = hilbert(sosfiltfilt(sos, deviation))
            envelope = np.abs(analytic)
        except ValueError:
            continue
        local_range = median_filter(np.abs(deviation), size=max(3, (round(frame_rate * .25) // 2) * 2 + 1), mode="nearest")
        center_slope = np.abs(np.gradient(center) * frame_rate)
        valid = (envelope >= 10.0) & (envelope <= 80.0) & (local_range < 100.0) & (center_slope < 2.5)
        depth[start:index] = np.where(valid, envelope, 0.0)
    return depth


def smooth_strength(strength: np.ndarray, frame_rate: int, attack: float = 0.04, release: float = 0.18) -> np.ndarray:
    """Smooth line width with a quick onset and a natural vocal decay."""
    values = np.asarray(strength, dtype=float)
    result = np.zeros_like(values)
    current = 0.0
    attack_alpha = 1.0 - math.exp(-1.0 / max(1.0, attack * frame_rate))
    release_alpha = 1.0 - math.exp(-1.0 / max(1.0, release * frame_rate))
    for index, target in enumerate(values):
        alpha = attack_alpha if target > current else release_alpha
        current += (target - current) * alpha
        result[index] = current
    return result


def bridge_phrase_gaps(
    midi: np.ndarray,
    source: np.ndarray,
    strength: np.ndarray,
    frame_rate: int,
    *,
    max_gap_seconds: float = 0.55,
    minimum_strength: float = 0.18,
) -> tuple[np.ndarray, np.ndarray]:
    """Connect short, energetic detector gaps inside one sung breath."""
    values = np.asarray(midi, dtype=float).copy()
    sources = np.asarray(source, dtype=object).copy()
    max_frames = round(max_gap_seconds * frame_rate)
    index = 0
    while index < len(values):
        if not np.isnan(values[index]):
            index += 1
            continue
        start = index
        while index < len(values) and np.isnan(values[index]):
            index += 1
        if start == 0 or index == len(values) or index - start > max_frames:
            continue
        if float(np.median(strength[start:index])) < minimum_strength:
            continue
        values[start:index] = np.linspace(values[start - 1], values[index], index - start + 2)[1:-1]
        sources[start:index] = "phrase-bridge"
    return values, sources


def build_frames(comparison: dict) -> list[dict]:
    frame_rate = int(comparison["frameRate"])
    if "separators" in comparison:
        combined = comparison["separators"]["combined"]
        length = max(len(combined[name]) for name in ("pyin", "rmvpe"))
        pyin = track_values(combined["pyin"], length)
        vocal = track_values(combined["rmvpe"], length)
        # The separator consensus has already rejected Demucs-only artifacts.
        # Reuse that evidence here instead of consulting the noisier full mix.
        mix = vocal.copy()
    else:
        length = max(len(comparison["tracks"][name]) for name in ("pyin_vocal", "rmvpe_vocal", "rmvpe_mix"))
        pyin = track_values(comparison["tracks"]["pyin_vocal"], length)
        vocal = track_values(comparison["tracks"]["rmvpe_vocal"], length)
        mix = track_values(comparison["tracks"]["rmvpe_mix"], length)
    raw_strength = np.pad(np.asarray(comparison["strength"], dtype=float), (0, max(0, length - len(comparison["strength"]))))[:length]
    strength = smooth_strength(raw_strength, frame_rate)
    merged, source = merge_pitch_tracks(pyin, vocal, mix, strength, frame_rate=frame_rate)
    merged, source = bridge_phrase_gaps(merged, source, raw_strength, frame_rate)
    below_vocal_floor = raw_strength <= 0
    merged[below_vocal_floor] = np.nan
    source[below_vocal_floor] = "none"
    strength[np.isnan(merged)] = 0.0
    voiced_peak = float(np.max(strength)) if np.any(~np.isnan(merged)) else 0.0
    if voiced_peak > 0:
        strength /= voiced_peak
    expressive = np.where((~np.isnan(vocal)) & (~np.isnan(merged)) & (np.abs(vocal - merged) <= 1.5), vocal, np.nan)
    depth = vibrato_depth(expressive, frame_rate)
    frames = []
    for index, value in enumerate(merged):
        voiced = not np.isnan(value)
        nearest = round(float(value)) if voiced else None
        expressive_value = expressive[index] if depth[index] > 0 else math.nan
        frames.append({
            "time": round(index / frame_rate, 3),
            "midi": round(float(value), 3) if voiced else None,
            "cents": round((float(value) - nearest) * 100.0, 1) if voiced else None,
            "strength": round(float(strength[index]), 3),
            "voiced": voiced,
            "source": str(source[index]),
            "expressiveMidi": None if np.isnan(expressive_value) else round(float(expressive_value), 3),
            "vibratoDepth": round(float(depth[index]), 1),
        })
    return frames


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--comparison", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    comparison = json.loads(args.comparison.read_text())
    frames = build_frames(comparison)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"frames": frames}, separators=(",", ":")))
    vibrato = sum(frame["vibratoDepth"] > 0 for frame in frames)
    filled = sum(frame["source"].startswith("rmvpe") for frame in frames)
    print(f"Merged frames: {len(frames)} ({filled} RMVPE corrections/fills, {vibrato} vibrato frames)")
    print(f"Pitch metadata: {args.output}")


if __name__ == "__main__":
    main()
