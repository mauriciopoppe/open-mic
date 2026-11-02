#!/usr/bin/env python3
"""Transcribe an isolated vocal to timestamped local JSON."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

import librosa
from faster_whisper import WhisperModel


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("audio", type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--model", default="base.en")
    parser.add_argument("--language", default="en")
    args = parser.parse_args()
    if not args.audio.is_file():
        raise SystemExit(f"Audio not found: {args.audio}")
    model = WhisperModel(args.model, device="cpu", compute_type="int8")
    audio, _ = librosa.load(args.audio, sr=16000, mono=True)
    segments, info = model.transcribe(audio, language=args.language, word_timestamps=True, vad_filter=True)
    result = {"duration": info.duration, "language": info.language, "segments": []}
    for segment in segments:
        result["segments"].append({
            "start": round(segment.start, 3), "end": round(segment.end, 3), "text": segment.text.strip(),
            "words": [{"start": round(word.start, 3), "end": round(word.end, 3), "word": word.word.strip(), "probability": round(word.probability, 3)} for word in (segment.words or [])],
        })
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(f"Vocal transcript: {args.output} ({len(result['segments'])} segments)")


if __name__ == "__main__":
    main()
