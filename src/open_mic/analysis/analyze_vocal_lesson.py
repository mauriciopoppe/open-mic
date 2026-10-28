#!/usr/bin/env python3
"""Offline, token-efficient analysis of a singing lesson recording.

This script deliberately does not call an LLM or a speech-to-text service.  It
produces compact acoustic evidence that can later be combined with a transcript
or lesson notes: activity intervals, rough pitch statistics, loudness, and
candidate exercise regions.

Example:
    open-mic analyze-lesson lesson.m4a \
        --output-dir analysis/2026-10-23
"""

from __future__ import annotations

import argparse
import csv
import json
import math
from pathlib import Path
from typing import Iterable

import librosa
import numpy as np
from scipy.ndimage import median_filter


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("analysis"))
    parser.add_argument("--sample-rate", type=int, default=22050)
    parser.add_argument("--hop-length", type=int, default=512)
    parser.add_argument("--top-db", type=float, default=38.0)
    parser.add_argument("--max-gap", type=float, default=0.55)
    parser.add_argument("--max-segment", type=float, default=20.0)
    return parser.parse_args()


def fmt_time(seconds: float) -> str:
    total = max(0, int(round(seconds)))
    minutes, secs = divmod(total, 60)
    hours, minutes = divmod(minutes, 60)
    return f"{hours:02d}:{minutes:02d}:{secs:02d}"


def finite_stats(values: np.ndarray) -> dict[str, float | None]:
    values = values[np.isfinite(values)]
    if values.size == 0:
        return {"min": None, "max": None, "median": None, "p05": None, "p95": None}
    return {
        "min": float(np.min(values)),
        "max": float(np.max(values)),
        "median": float(np.median(values)),
        "p05": float(np.percentile(values, 5)),
        "p95": float(np.percentile(values, 95)),
    }


def merge_intervals(
    intervals: Iterable[tuple[float, float]], max_gap: float, max_segment: float
) -> list[tuple[float, float]]:
    merged: list[list[float]] = []
    for start, end in intervals:
        if not merged or start - merged[-1][1] > max_gap:
            merged.append([start, end])
        else:
            merged[-1][1] = end

    result: list[tuple[float, float]] = []
    for start, end in merged:
        while end - start > max_segment:
            result.append((start, start + max_segment))
            start += max_segment
        result.append((start, end))
    return result


def pitch_features(
    y: np.ndarray, sr: int, start: float, end: float
) -> dict[str, float | int | None]:
    """Estimate rough F0 for one interval using YIN.

    YIN is intentionally run per interval rather than over the whole recording,
    keeping memory bounded for long lesson recordings.
    """

    segment = y[int(start * sr) : int(end * sr)]
    if len(segment) < sr // 4:
        return {
            "pitch_frames": 0,
            "f0_min_hz": None,
            "f0_max_hz": None,
            "f0_median_hz": None,
            "pitch_range_semitones": None,
            "pitch_p05_hz": None,
            "pitch_p95_hz": None,
            "pitch_jump_count": 0,
        }

    # A lower analysis rate is sufficient for vocal F0 and substantially reduces
    # CPU cost.  Ignore occasional implausibly low/high estimates as outliers.
    analysis_sr = 16000
    if sr != analysis_sr:
        segment = librosa.resample(segment, orig_sr=sr, target_sr=analysis_sr)
    frame_length = 1024
    hop_length = 256
    if len(segment) < frame_length:
        return {
            "pitch_frames": 0,
            "f0_min_hz": None,
            "f0_max_hz": None,
            "f0_median_hz": None,
            "pitch_range_semitones": None,
            "pitch_p05_hz": None,
            "pitch_p95_hz": None,
            "pitch_jump_count": 0,
        }

    f0 = librosa.yin(
        segment,
        fmin=65.0,
        fmax=1200.0,
        sr=analysis_sr,
        frame_length=frame_length,
        hop_length=hop_length,
    )
    f0 = f0[np.isfinite(f0)]
    f0 = f0[(f0 >= 65.0) & (f0 <= 1200.0)]
    # YIN can make octave errors on consonants and room noise.  A short median
    # filter in semitone space removes isolated jumps while preserving real
    # melodic movement, and keeps this pass much faster than pYIN on long files.
    if f0.size >= 9:
        semitone_track = 12.0 * np.log2(f0)
        smooth = median_filter(semitone_track, size=9, mode="nearest")
        f0 = f0[np.abs(semitone_track - smooth) <= 5.0]
    stats = finite_stats(f0)
    if f0.size == 0:
        return {
            "pitch_frames": 0,
            "f0_min_hz": None,
            "f0_max_hz": None,
            "f0_median_hz": None,
            "pitch_range_semitones": None,
            "pitch_p05_hz": None,
            "pitch_p95_hz": None,
            "pitch_jump_count": 0,
        }

    # Count quick pitch changes, useful as weak evidence for agility exercises.
    semitones = 12.0 * np.log2(f0[1:] / f0[:-1])
    jump_count = int(np.count_nonzero(np.abs(semitones) >= 2.0))
    p05 = stats["p05"]
    p95 = stats["p95"]
    pitch_range = None
    if p05 and p95 and p05 > 0 and p95 > 0:
        pitch_range = float(12.0 * math.log2(p95 / p05))
    return {
        "pitch_frames": int(f0.size),
        "f0_min_hz": stats["min"],
        "f0_max_hz": stats["max"],
        "f0_median_hz": stats["median"],
        "pitch_range_semitones": pitch_range,
        "pitch_p05_hz": p05,
        "pitch_p95_hz": p95,
        "pitch_jump_count": jump_count,
    }


def candidate_label(row: dict[str, object]) -> str:
    duration = float(row["duration_s"])
    pitch_range = row["pitch_range_semitones"]
    jumps = int(row["pitch_jump_count"] or 0)
    pitch_frames = int(row["pitch_frames"] or 0)

    if pitch_frames == 0:
        return "speech_or_nonpitched_activity_candidate"
    if duration >= 1.5 and pitch_range is not None and float(pitch_range) <= 3.0:
        return "sustained_tone_candidate"
    if duration <= 8.0 and jumps >= 4:
        return "agility_or_repetition_candidate"
    if duration >= 8.0:
        return "song_or_long_vocal_phrase_candidate"
    return "pitched_vocal_activity_candidate"


def write_csv(path: Path, rows: list[dict[str, object]]) -> None:
    if not rows:
        path.write_text("\n", encoding="utf-8")
        return
    fields = list(rows[0])
    with path.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields)
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    args = parse_args()
    if not args.audio.is_file():
        raise SystemExit(f"Audio file not found: {args.audio}")
    args.output_dir.mkdir(parents=True, exist_ok=True)

    y, sr = librosa.load(args.audio, sr=args.sample_rate, mono=True)
    duration = float(len(y) / sr)
    rms = librosa.feature.rms(y=y, frame_length=2048, hop_length=args.hop_length)[0]
    rms_db = librosa.amplitude_to_db(np.maximum(rms, 1e-10), ref=np.max)
    times = librosa.times_like(rms_db, sr=sr, hop_length=args.hop_length)

    raw_intervals = librosa.effects.split(
        y, top_db=args.top_db, frame_length=2048, hop_length=args.hop_length
    )
    intervals = merge_intervals(
        ((float(start / sr), float(end / sr)) for start, end in raw_intervals),
        max_gap=args.max_gap,
        max_segment=args.max_segment,
    )

    rows: list[dict[str, object]] = []
    for index, (start, end) in enumerate(intervals, start=1):
        mask = (times >= start) & (times < end)
        segment_rms = rms_db[mask]
        pitch = pitch_features(y, sr, start, end)
        row: dict[str, object] = {
            "segment": index,
            "start_s": round(start, 3),
            "end_s": round(end, 3),
            "start": fmt_time(start),
            "end": fmt_time(end),
            "duration_s": round(end - start, 3),
            "rms_db_median": round(float(np.median(segment_rms)), 2)
            if segment_rms.size
            else None,
            "rms_db_peak": round(float(np.max(segment_rms)), 2)
            if segment_rms.size
            else None,
            **pitch,
        }
        row["candidate"] = candidate_label(row)
        rows.append(row)

    activity_seconds = sum(float(row["duration_s"]) for row in rows)
    summary = {
        "audio": str(args.audio),
        "sample_rate_hz": sr,
        "duration_s": duration,
        "duration": fmt_time(duration),
        "activity_seconds": activity_seconds,
        "activity_fraction": activity_seconds / duration if duration else 0.0,
        "silence_fraction": 1.0 - activity_seconds / duration if duration else 1.0,
        "segment_count": len(rows),
        "parameters": {
            "top_db": args.top_db,
            "max_gap_s": args.max_gap,
            "max_segment_s": args.max_segment,
            "hop_length": args.hop_length,
        },
        "segments": rows,
    }
    (args.output_dir / "analysis.json").write_text(
        json.dumps(summary, indent=2), encoding="utf-8"
    )
    write_csv(args.output_dir / "segments.csv", rows)

    label_counts: dict[str, int] = {}
    for row in rows:
        label = str(row["candidate"])
        label_counts[label] = label_counts.get(label, 0) + 1
    report = [
        f"# Offline vocal lesson analysis",
        "",
        f"- Audio: `{args.audio}`",
        f"- Duration: **{fmt_time(duration)}**",
        f"- Energy activity: **{activity_seconds / 60:.1f} min** ({activity_seconds / duration:.1%})",
        f"- Candidate intervals: **{len(rows)}**",
        "",
        "This is acoustic evidence, not a transcript. Labels are hypotheses and should not be treated as teacher instructions.",
        "",
        "## Candidate interval counts",
        "",
    ]
    for label, count in sorted(label_counts.items()):
        report.append(f"- `{label}`: {count}")
    report.extend(["", "## Intervals", "", "| # | Time | Duration | Pitch range | Jumps | Candidate |", "|---:|---|---:|---:|---:|---|"])
    for row in rows:
        pitch_range = row["pitch_range_semitones"]
        pitch_text = "—" if pitch_range is None else f"{float(pitch_range):.1f} st"
        report.append(
            f"| {row['segment']} | {row['start']}–{row['end']} | {float(row['duration_s']):.1f}s | "
            f"{pitch_text} | {row['pitch_jump_count']} | `{row['candidate']}` |"
        )
    (args.output_dir / "REPORT.md").write_text("\n".join(report) + "\n", encoding="utf-8")
    print(f"Wrote {args.output_dir / 'REPORT.md'}")
    print(f"Wrote {args.output_dir / 'analysis.json'}")
    print(f"Wrote {args.output_dir / 'segments.csv'}")


if __name__ == "__main__":
    main()
