#!/usr/bin/env python3
"""Find short ascending piano runs in a Basic Pitch MIDI export.

The detector is intentionally conservative. It reports candidates for review;
it does not claim that every detected run is a teacher-directed scale.
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import pretty_midi


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("midi", type=Path)
    parser.add_argument("--offset", type=float, default=0.0)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--min-notes", type=int, default=4)
    parser.add_argument("--onset-tolerance", type=float, default=0.12)
    return parser.parse_args()


def note_name(pitch: int) -> str:
    return pretty_midi.note_number_to_name(pitch)


def main() -> None:
    args = parse_args()
    midi = pretty_midi.PrettyMIDI(str(args.midi))
    source_notes = [
        note
        for instrument in midi.instruments
        for note in instrument.notes
        if note.velocity >= 45 and note.end - note.start >= 0.08 and 36 <= note.pitch <= 96
    ]
    source_notes.sort(key=lambda note: (note.start, note.pitch))

    groups: list[tuple[float, list[pretty_midi.Note]]] = []
    for note in source_notes:
        if not groups or note.start - groups[-1][0] > args.onset_tolerance:
            groups.append((note.start, []))
        groups[-1][1].append(note)

    representatives: list[pretty_midi.Note] = []
    for _, notes in groups:
        # Highest note is a useful melody proxy for a piano accompaniment. The
        # later manual-review step removes obvious octave artifacts.
        representatives.append(max(notes, key=lambda note: note.pitch))

    runs: list[dict[str, object]] = []
    index = 0
    while index + args.min_notes - 1 < len(representatives):
        end = index
        while end + 1 < len(representatives):
            current = representatives[end]
            following = representatives[end + 1]
            interval = following.pitch - current.pitch
            gap = following.start - current.start
            if not (1 <= interval <= 4 and 0.08 <= gap <= 1.0):
                break
            end += 1
        if end - index + 1 >= args.min_notes:
            chosen = representatives[index : end + 1]
            start = chosen[0].start + args.offset
            runs.append(
                {
                    "start_s": round(start, 3),
                    "end_s": round(chosen[-1].end + args.offset, 3),
                    "duration_s": round(chosen[-1].end - chosen[0].start, 3),
                    "pitches": [note.pitch for note in chosen],
                    "notes": [note_name(note.pitch) for note in chosen],
                    "events": [
                        {
                            "pitch": note.pitch,
                            "note": note_name(note.pitch),
                            "start_s": round(note.start - chosen[0].start, 3),
                            "duration_s": round(note.end - note.start, 3),
                            "velocity": note.velocity,
                        }
                        for note in chosen
                    ],
                }
            )
            index = end + 1
        else:
            index += 1

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(
        json.dumps(
            {
                "midi": str(args.midi),
                "offset_s": args.offset,
                "candidate_count": len(runs),
                "candidates": runs,
            },
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    print(f"Wrote {args.output} ({len(runs)} candidates)")


if __name__ == "__main__":
    main()
