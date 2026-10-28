#!/usr/bin/env python3
"""Summarize progressive ascending/descending piano exercises from MIDI.

The input MIDI is expected to come from a piano stem. The output is a compact,
reviewable description of candidate scale runs, including pitch shape, onset
spacing, note durations, repetition timing, and the direction of the exercise.
It is intentionally conservative: mixed audio and source separation can still
produce octave or missing-note errors.
"""

from __future__ import annotations

import argparse
import json
import statistics
from pathlib import Path

import pretty_midi


WINDOWS = {
    "pitch_accuracy_flexibility": (261.0, 412.0),
    "range_extension": (412.0, 745.0),
    "resonance": (745.0, 1012.0),
    "agility": (1081.0, 1354.0),
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("midi", type=Path)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--min-notes", type=int, default=4)
    parser.add_argument("--onset-tolerance", type=float, default=0.12)
    return parser.parse_args()


def group_notes(midi: pretty_midi.PrettyMIDI, onset_tolerance: float) -> list[pretty_midi.Note]:
    notes = [
        note
        for instrument in midi.instruments
        for note in instrument.notes
        if 36 <= note.pitch <= 96
        and note.velocity >= 45
        and note.end - note.start >= 0.08
    ]
    notes.sort(key=lambda note: (note.start, note.pitch))

    groups: list[tuple[float, list[pretty_midi.Note]]] = []
    for note in notes:
        if not groups or note.start - groups[-1][0] > onset_tolerance:
            groups.append((note.start, []))
        groups[-1][1].append(note)

    # Highest note is the most useful representative for a scalar piano line.
    return [max(group, key=lambda note: note.pitch) for _, group in groups]


def detect_runs(
    representatives: list[pretty_midi.Note], min_notes: int
) -> list[dict[str, object]]:
    runs: list[dict[str, object]] = []
    index = 0
    while index + min_notes - 1 < len(representatives):
        end = index
        while end + 1 < len(representatives):
            current = representatives[end]
            following = representatives[end + 1]
            interval = following.pitch - current.pitch
            gap = following.start - current.start
            if not (1 <= interval <= 4 and 0.08 <= gap <= 1.0):
                break
            end += 1
        chosen = representatives[index : end + 1]
        if len(chosen) >= min_notes:
            runs.append(
                {
                    "start_s": chosen[0].start,
                    "end_s": chosen[-1].end,
                    "start_pitch": chosen[0].pitch,
                    "pitches": [note.pitch for note in chosen],
                    "onsets_s": [note.start - chosen[0].start for note in chosen],
                    "durations_s": [note.end - note.start for note in chosen],
                }
            )
            index = end + 1
        else:
            index += 1
    return runs


def median(values: list[float]) -> float | None:
    return round(statistics.median(values), 3) if values else None


def summarize_window(runs: list[dict[str, object]], start: float, end: float) -> dict[str, object]:
    selected = [run for run in runs if start <= float(run["start_s"]) < end]
    selected.sort(key=lambda run: float(run["start_s"]))
    five_note = [run for run in selected if len(run["pitches"]) >= 5]
    if not selected:
        return {"candidate_count": 0, "candidates": []}

    selected_starts = [float(run["start_s"]) for run in selected]
    onset_gaps = [
        float(onset_b) - float(onset_a)
        for run in five_note
        for onset_a, onset_b in zip(run["onsets_s"], run["onsets_s"][1:])
    ]
    note_durations = [
        float(duration)
        for run in selected
        for duration in run["durations_s"]
    ]
    repeat_intervals = [b - a for a, b in zip(selected_starts, selected_starts[1:]) if 1.4 <= b - a <= 2.6]
    five_starts = [int(run["start_pitch"]) for run in five_note]
    direction = "ascending"
    if len(five_starts) >= 2 and five_starts[-1] < five_starts[0]:
        direction = "descending"
    if len(five_starts) >= 3 and max(five_starts) > five_starts[0] and five_starts[-1] <= five_starts[0]:
        direction = "up_then_down"

    canonical_shape = None
    if five_note:
        canonical_shape = [
            pitch - five_note[0]["start_pitch"] for pitch in five_note[0]["pitches"][:5]
        ]

    return {
        "candidate_count": len(selected),
        "direction": direction,
        "start_pitch_range": [min(five_starts) if five_starts else None, max(five_starts) if five_starts else None],
        "canonical_shape_semitones": canonical_shape,
        "median_note_onset_gap_s": median(onset_gaps),
        "median_note_duration_s": median(note_durations),
        "median_repeat_interval_s": median(repeat_intervals),
        "first_candidates": selected[:12],
    }


def main() -> None:
    args = parse_args()
    midi = pretty_midi.PrettyMIDI(str(args.midi))
    representatives = group_notes(midi, args.onset_tolerance)
    runs = detect_runs(representatives, args.min_notes)
    report = {
        "midi": str(args.midi),
        "method": "Basic Pitch MIDI from Demucs piano stem; highest representative per onset group",
        "windows": {
            name: summarize_window(runs, start, end)
            for name, (start, end) in WINDOWS.items()
        },
    }
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(report, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {args.output}")


if __name__ == "__main__":
    main()
