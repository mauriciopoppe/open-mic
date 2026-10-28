#!/usr/bin/env python3
"""Run local, timestamped speech-to-text for a vocal lesson.

The model runs through faster-whisper/CTranslate2.  No audio or transcript is
sent to an API.  Keep the model cache outside the repository when possible.

Example:
    open-mic transcribe-lesson lesson.m4a \
        --output-dir analysis/2026-10-23 \
        --model-dir workspace/models/faster-whisper
"""

from __future__ import annotations

import argparse
import json
from pathlib import Path


def load_whisper_model(*args, **kwargs):
    """Load faster-whisper while tolerating newer PyAV's open() signature."""
    import av

    original_open = av.open

    def compatible_open(*open_args, **open_kwargs):
        # faster-whisper 1.2.1 passes this option, but PyAV 19 removed it.
        open_kwargs.pop("metadata_errors", None)
        return original_open(*open_args, **open_kwargs)

    av.open = compatible_open
    from faster_whisper import WhisperModel

    return WhisperModel(*args, **kwargs)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", type=Path)
    parser.add_argument("--output-dir", type=Path, default=Path("analysis"))
    parser.add_argument("--model", default="tiny", help="tiny, base, small, ...")
    parser.add_argument("--model-dir", type=Path, default=Path(".models"))
    parser.add_argument("--language", default=None, help="Use e.g. en; omit for detection")
    parser.add_argument("--cpu-threads", type=int, default=4)
    parser.add_argument("--beam-size", type=int, default=3)
    parser.add_argument("--no-vad", action="store_true")
    return parser.parse_args()


def timestamp(seconds: float) -> str:
    millis = max(0, int(round(seconds * 1000)))
    hours, millis = divmod(millis, 3_600_000)
    minutes, millis = divmod(millis, 60_000)
    secs, millis = divmod(millis, 1000)
    return f"{hours:02d}:{minutes:02d}:{secs:02d},{millis:03d}"


def segment_dict(segment) -> dict:
    words = []
    if segment.words:
        words = [
            {
                "start": word.start,
                "end": word.end,
                "word": word.word,
                "probability": word.probability,
            }
            for word in segment.words
        ]
    return {
        "start": segment.start,
        "end": segment.end,
        "text": segment.text.strip(),
        "avg_logprob": segment.avg_logprob,
        "no_speech_prob": segment.no_speech_prob,
        "compression_ratio": segment.compression_ratio,
        "words": words,
    }


def main() -> None:
    args = parse_args()
    if not args.audio.is_file():
        raise SystemExit(f"Audio file not found: {args.audio}")
    args.output_dir.mkdir(parents=True, exist_ok=True)
    args.model_dir.mkdir(parents=True, exist_ok=True)

    model = load_whisper_model(
        args.model,
        device="cpu",
        compute_type="int8",
        cpu_threads=args.cpu_threads,
        num_workers=1,
        download_root=str(args.model_dir),
    )
    segments, info = model.transcribe(
        str(args.audio),
        language=args.language,
        beam_size=args.beam_size,
        vad_filter=not args.no_vad,
        word_timestamps=True,
        condition_on_previous_text=False,
    )
    rows = [segment_dict(segment) for segment in segments]

    result = {
        "audio": str(args.audio),
        "model": args.model,
        "language": info.language,
        "language_probability": info.language_probability,
        "duration_s": info.duration,
        "segments": rows,
    }
    (args.output_dir / "transcript.json").write_text(
        json.dumps(result, indent=2, ensure_ascii=False), encoding="utf-8"
    )
    (args.output_dir / "transcript.txt").write_text(
        "\n".join(row["text"] for row in rows if row["text"]) + "\n",
        encoding="utf-8",
    )

    srt = []
    vtt = ["WEBVTT", ""]
    for index, row in enumerate(rows, start=1):
        start = timestamp(row["start"])
        end = timestamp(row["end"])
        text = row["text"]
        srt.extend([str(index), f"{start} --> {end}", text, ""])
        vtt.extend([f"{start.replace(',', '.')} --> {end.replace(',', '.')}", text, ""])
    (args.output_dir / "transcript.srt").write_text("\n".join(srt), encoding="utf-8")
    (args.output_dir / "transcript.vtt").write_text("\n".join(vtt), encoding="utf-8")

    print(f"Language: {info.language} ({info.language_probability:.2f})")
    print(f"Segments: {len(rows)}")
    print(f"Wrote {args.output_dir / 'transcript.json'}")
    print(f"Wrote {args.output_dir / 'transcript.txt'}")
    print(f"Wrote {args.output_dir / 'transcript.srt'}")
    print(f"Wrote {args.output_dir / 'transcript.vtt'}")


if __name__ == "__main__":
    main()
