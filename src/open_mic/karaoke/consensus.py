#!/usr/bin/env python3
"""Merge pitch-tracker evidence into a continuous teaching and vibrato contour."""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

import librosa
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


def extract_vocal_timbre(
    audio: np.ndarray | None,
    sample_rate: int,
    midi: np.ndarray,
    frame_rate: int,
) -> tuple[np.ndarray, np.ndarray]:
    """Compute per-frame head-voice register [0..1] and vowel brightness [0..1]."""
    length = len(midi)
    voiced_mask = ~np.isnan(midi)
    if not np.any(voiced_mask):
        return np.zeros(length), np.zeros(length)

    low_midi, p25_midi, p85_midi, high_midi = np.nanpercentile(midi, [10, 25, 85, 90])
    midi_span = max(6.0, float(high_midi - low_midi))
    pitch_norm = np.clip((np.nan_to_num(midi, nan=low_midi) - low_midi) / midi_span, 0.0, 1.0)

    if audio is None or len(audio) == 0:
        head_only = np.where(voiced_mask, pitch_norm, 0.0)
        return smooth_strength(head_only, frame_rate, attack=0.08, release=0.14), np.zeros(length)

    hop = max(1, round(sample_rate / frame_rate))
    n_fft = 2048
    stft = np.abs(librosa.stft(audio, n_fft=n_fft, hop_length=hop, center=True))
    freqs = librosa.fft_frequencies(sr=sample_rate, n_fft=n_fft)
    df = float(freqs[1] - freqs[0]) if len(freqs) > 1 else 1.0
    n_frames = min(length, stft.shape[1])

    low_band = (freqs >= 200.0) & (freqs < 1400.0)
    high_band = (freqs >= 1600.0) & (freqs <= 4800.0)
    low_energy = np.sqrt(np.mean(stft[low_band, :n_frames] ** 2, axis=0)) + 1e-8
    high_energy = np.sqrt(np.mean(stft[high_band, :n_frames] ** 2, axis=0)) + 1e-8
    raw_tilt = np.log10(high_energy / low_energy)

    m2_score = np.full(length, -0.5)
    bright_raw = np.full(length, np.nan)
    nyquist_guard = sample_rate / 2.0 - df

    for idx in range(n_frames):
        if not voiced_mask[idx]:
            continue
        f0 = float(librosa.midi_to_hz(float(midi[idx])))
        spec = stft[:, idx]
        harmonics = []
        for k in range(1, 9):
            fk = f0 * k
            if fk >= nyquist_guard:
                harmonics.append(0.0)
                continue
            b0 = max(0, int(round((fk - 35.0) / df)))
            b1 = min(len(spec), int(round((fk + 35.0) / df)) + 1)
            harmonics.append(float(np.max(spec[b0:b1])) if b1 > b0 else 0.0)
        tot = sum(harmonics) + 1e-8
        h1 = harmonics[0] / tot
        h2 = harmonics[1] / tot
        upper = sum(harmonics[2:]) / tot
        # M2 falsetto/head purity: fundamental H1 dominance minus upper-harmonic (H3..H8) and H2 chest-belt weight
        m2_score[idx] = h1 - 1.25 * upper - 0.35 * h2
        bright_raw[idx] = float(raw_tilt[idx])

    win_m2 = max(5, (round(frame_rate * 0.21) // 2) * 2 + 1)
    m2_smooth = median_filter(np.where(voiced_mask, m2_score, -0.5), size=win_m2, mode="nearest")

    midi_clean = np.nan_to_num(midi, nan=float(p25_midi))
    phrase_win = max(15, (round(frame_rate * 1.8) // 2) * 2 + 1)
    local_base = median_filter(midi_clean, size=phrase_win, mode="nearest")
    pitch_jump = np.clip(midi_clean - local_base, 0.0, 12.0)

    mid_gate = np.clip((midi_clean + 0.45 * np.clip(pitch_jump - 2.0, 0.0, 6.0) - 62.2) / 2.2, 0.0, 1.0)
    eff_m2 = m2_smooth + 0.08 * np.clip(pitch_jump - 2.0, 0.0, 4.0)
    falsetto_timbre = np.clip((eff_m2 - 0.14) / 0.24, 0.0, 1.0)
    mid_head = mid_gate * falsetto_timbre

    high_pitch = np.clip((midi_clean - 67.6) / 2.6, 0.0, 1.0)
    not_belt = np.clip((m2_smooth + 0.15) / 0.35, 0.0, 1.0)
    high_head = high_pitch * not_belt

    raw_head = np.where(voiced_mask, np.maximum(mid_head, high_head), 0.0)
    win = max(3, (round(frame_rate * 0.13) // 2) * 2 + 1)
    head_filtered = median_filter(raw_head, size=win, mode="nearest")
    head_voice = smooth_strength(np.where(voiced_mask, head_filtered, 0.0), frame_rate, attack=0.05, release=0.12)
    head_voice[~voiced_mask] = 0.0

    valid_bright = bright_raw[~np.isnan(bright_raw)]
    if len(valid_bright) >= 4:
        b_low, b_high = np.percentile(valid_bright, [8, 92])
        b_span = max(0.35, float(b_high - b_low))
        bright_norm = np.clip((np.nan_to_num(bright_raw, nan=b_low) - b_low) / b_span, 0.0, 1.0)
    else:
        bright_norm = np.zeros(length)

    bright_filtered = median_filter(np.where(voiced_mask, bright_norm, 0.0), size=win, mode="nearest")
    brightness = smooth_strength(np.where(voiced_mask, bright_filtered, 0.0), frame_rate, attack=0.06, release=0.14)
    brightness[~voiced_mask] = 0.0
    return np.clip(head_voice, 0.0, 1.0), np.clip(brightness, 0.0, 1.0)


def detect_phrase_breaths(
    frames: list[dict],
    audio: np.ndarray | None = None,
    sample_rate: int = 16000,
    frame_rate: int = 100,
) -> list[dict]:
    """Identify phrase-entrance breath cues and target onset pitches."""
    n = len(frames)
    if n == 0:
        return []
    voiced = np.array([bool(f.get("voiced") and f.get("midi") is not None) for f in frames])
    midi = np.array([float(f["midi"]) if f.get("voiced") and f.get("midi") is not None else np.nan for f in frames])

    breath_energy = None
    if audio is not None and len(audio) > 0:
        hop = max(1, round(sample_rate / frame_rate))
        stft = np.abs(librosa.stft(audio, n_fft=1024, hop_length=hop, center=True))
        freqs = librosa.fft_frequencies(sr=sample_rate, n_fft=1024)
        band = (freqs >= 800.0) & (freqs <= 5500.0)
        if np.any(band):
            breath_energy = np.sqrt(np.mean(stft[band, :] ** 2, axis=0))

    breaths: list[dict] = []
    min_gap = round(0.45 * frame_rate)
    min_phrase = round(0.70 * frame_rate)
    min_spacing = 3.0
    idx = 0
    while idx < n:
        if not voiced[idx]:
            idx += 1
            continue
        start = idx
        while idx < n and voiced[idx]:
            idx += 1
        prev_end = start - 1
        while prev_end >= 0 and not voiced[prev_end]:
            prev_end -= 1
        gap = start - 1 - prev_end
        lookahead = min(n, start + round(1.5 * frame_rate))
        voiced_in_window = int(np.sum(voiced[start:lookahead]))
        if gap >= min_gap and voiced_in_window >= min_phrase:
            onset_time = start / frame_rate
            if breaths and onset_time - breaths[-1]["onsetTime"] < min_spacing:
                continue
            w0 = max(prev_end + 1, start - round(0.45 * frame_rate))
            w1 = max(w0 + 1, start - round(0.06 * frame_rate))
            if breath_energy is not None and w1 <= len(breath_energy) and w1 > w0:
                peak_idx = w0 + int(np.argmax(breath_energy[w0:w1]))
                breath_time = round(peak_idx / frame_rate, 2)
            else:
                breath_time = round(max(0.0, onset_time - 0.22), 2)
            onset_slice = midi[start:min(n, start + max(3, round(0.15 * frame_rate)))]
            onset_midi = float(np.nanmedian(onset_slice)) if np.any(~np.isnan(onset_slice)) else float(midi[start])
            breaths.append({
                "time": breath_time,
                "onsetTime": round(onset_time, 2),
                "midi": round(onset_midi, 2),
            })
    return breaths


def build_frames(
    comparison: dict,
    *,
    vocal_audio: np.ndarray | None = None,
    sample_rate: int = 16000,
) -> list[dict]:
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
    head_voice, brightness = extract_vocal_timbre(vocal_audio, sample_rate, merged, frame_rate)
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
            "headVoice": round(float(head_voice[index]), 3) if voiced else 0.0,
            "brightness": round(float(brightness[index]), 3) if voiced else 0.0,
        })
    return frames


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--comparison", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--vocal", type=Path, help="Optional isolated vocal audio stem for register, brightness, and breath analysis")
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    comparison = json.loads(args.comparison.read_text())
    vocal_audio = None
    sample_rate = 16000
    if args.vocal and args.vocal.is_file():
        vocal_audio, sample_rate = librosa.load(args.vocal, sr=sample_rate, mono=True)
    frames = build_frames(comparison, vocal_audio=vocal_audio, sample_rate=sample_rate)
    breaths = detect_phrase_breaths(frames, vocal_audio, sample_rate=sample_rate, frame_rate=int(comparison["frameRate"]))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps({"frames": frames, "breaths": breaths}, separators=(",", ":")))
    vibrato = sum(frame["vibratoDepth"] > 0 for frame in frames)
    filled = sum(frame["source"].startswith("rmvpe") for frame in frames)
    print(f"Merged frames: {len(frames)} ({filled} RMVPE corrections/fills, {vibrato} vibrato frames, {len(breaths)} breath cues)")
    print(f"Pitch metadata: {args.output}")


if __name__ == "__main__":
    main()
