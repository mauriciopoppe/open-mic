#!/usr/bin/env python3
"""Rank coach-worthy singing passages using pitch metadata and timed transcript."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import numpy as np


def passage_metrics(frames: list[dict], start: float, end: float) -> dict:
    selected = [frame for frame in frames if start <= frame["time"] < end]
    voiced = [frame for frame in selected if frame.get("voiced") and frame.get("midi") is not None]
    pitches = np.asarray([frame["midi"] for frame in voiced], dtype=float)
    strength = np.asarray([frame.get("strength", 0) for frame in voiced], dtype=float)
    vibrato = np.asarray([frame.get("vibratoDepth", 0) for frame in voiced], dtype=float)
    if len(pitches) < 2:
        return {"voicedRatio": 0, "rangeSemitones": 0, "meanStrength": 0, "vibratoRatio": 0, "agility": 0, "sustain": 0}
    deltas = np.abs(np.diff(pitches))
    stable = deltas < 0.18
    return {
        "voicedRatio": round(len(voiced) / max(1, len(selected)), 3),
        "rangeSemitones": round(float(np.percentile(pitches, 95) - np.percentile(pitches, 5)), 2),
        "meanStrength": round(float(np.mean(strength)), 3),
        "vibratoRatio": round(float(np.mean(vibrato > 0)), 3),
        "agility": round(float(np.mean(deltas > 0.45)), 3),
        "sustain": round(float(np.mean(stable)), 3),
        "highMidi": round(float(np.percentile(pitches, 95)), 2),
    }


def analyze(pitch: dict, transcript: dict) -> dict:
    frames = pitch["frames"]
    passages = []
    for segment in transcript.get("segments", []):
        start, end = float(segment["start"]), float(segment["end"])
        text = " ".join(str(segment.get("text", "")).strip().split())
        if end - start < 0.7 or not text:
            continue
        passages.append({"start": round(start, 2), "end": round(end, 2), "fragment": " ".join(text.split()[:7]), **passage_metrics(frames, start, end)})
    categories = {
        "range": lambda item: item["rangeSemitones"],
        "highNote": lambda item: item.get("highMidi", 0),
        "vibrato": lambda item: item["vibratoRatio"],
        "agility": lambda item: item["agility"],
        "sustain": lambda item: item["sustain"] * item["voicedRatio"],
        "dynamics": lambda item: item["meanStrength"],
    }
    highlights = {name: sorted(passages, key=score, reverse=True)[:4] for name, score in categories.items()}
    return {"passages": passages, "highlights": highlights}


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pitch", required=True, type=Path)
    parser.add_argument("--transcript", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    report = analyze(json.loads(args.pitch.read_text()), json.loads(args.transcript.read_text()))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n")
    print(f"Coach analysis: {args.output} ({len(report['passages'])} passages)")


if __name__ == "__main__":
    main()
