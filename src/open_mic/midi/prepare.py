#!/usr/bin/env python3
"""Prepare MIDI for a DAW by aligning, stretching, and optionally quantizing."""

from __future__ import annotations

import argparse
import shutil
import tempfile
from pathlib import Path

from .align import align_midi
from .quantize import quantize_midi


def prepare_midi(
    input_path: Path,
    output_path: Path,
    *,
    audio_path: Path | None = None,
    report_path: Path = Path("workspace/midi/alignment_report.csv"),
    source_bpm: float = 120.0,
    target_bpm: float | None = None,
    grid: int | None = None,
) -> None:
    """Apply the requested preparation steps in a deterministic order."""
    if audio_path is None and target_bpm is None:
        raise ValueError("provide --audio or --bpm so there is work to perform")
    if grid is not None and target_bpm is None:
        raise ValueError("--grid requires --bpm")

    with tempfile.TemporaryDirectory(prefix="open-mic-prepare-") as temp_dir:
        working_path = input_path
        if audio_path is not None:
            aligned_path = (
                output_path
                if target_bpm is None
                else Path(temp_dir) / "aligned.mid"
            )
            align_midi(
                audio_path,
                input_path,
                output_midi=aligned_path,
                report=report_path,
            )
            working_path = aligned_path

        if target_bpm is not None:
            quantize_midi(
                working_path,
                output_path,
                source_bpm,
                target_bpm,
                grid,
            )
        elif working_path != output_path:
            output_path.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(working_path, output_path)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Source MIDI file")
    parser.add_argument("output", type=Path, help="Prepared MIDI file")
    parser.add_argument("--audio", type=Path, help="Audio used to correct MIDI timing")
    parser.add_argument(
        "--report",
        type=Path,
        default=Path("workspace/midi/alignment_report.csv"),
        help="Alignment report path when --audio is used",
    )
    parser.add_argument(
        "--source-bpm",
        type=float,
        default=120.0,
        help="Tempo represented by the source MIDI (default: 120)",
    )
    parser.add_argument(
        "--bpm",
        type=float,
        help="Target tempo; enables tempo stretching",
    )
    parser.add_argument(
        "--grid",
        type=int,
        choices=(4, 8, 16),
        help="Snap notes to subdivisions per beat (4, 8, or 16)",
    )
    args = parser.parse_args()

    try:
        prepare_midi(
            args.input,
            args.output,
            audio_path=args.audio,
            report_path=args.report,
            source_bpm=args.source_bpm,
            target_bpm=args.bpm,
            grid=args.grid,
        )
    except ValueError as error:
        parser.error(str(error))
    print(f"Saved prepared MIDI to {args.output}")


if __name__ == "__main__":
    main()
