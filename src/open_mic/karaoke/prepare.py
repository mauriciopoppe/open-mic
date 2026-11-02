#!/usr/bin/env python3
"""Prepare a local karaoke backing mix and publishable vocal pitch metadata."""

from __future__ import annotations

import argparse
import json
import math
import os
import subprocess
from pathlib import Path

import librosa
import numpy as np
from scipy.ndimage import gaussian_filter1d, median_filter

from open_mic.audio.separate import MODEL, executable, run, sanitize_filename, video_title


AUDIO_EXTENSIONS = {".aac", ".flac", ".m4a", ".mp3", ".ogg", ".opus", ".wav", ".webm"}


def bridge_short_gaps(values: np.ndarray, max_frames: int) -> np.ndarray:
    """Interpolate short NaN gaps bounded by voiced pitch on both sides."""
    result = np.asarray(values, dtype=float).copy()
    index = 0
    while index < len(result):
        if not np.isnan(result[index]):
            index += 1
            continue
        start = index
        while index < len(result) and np.isnan(result[index]):
            index += 1
        if start == 0 or index == len(result) or index - start > max_frames:
            continue
        result[start:index] = np.linspace(result[start - 1], result[index], index - start + 2)[1:-1]
    return result


def extend_note_fades(midi: np.ndarray, strength: np.ndarray, max_frames: int) -> tuple[np.ndarray, np.ndarray]:
    """Carry the end of a voiced note briefly while tapering its energy."""
    pitches = np.asarray(midi, dtype=float).copy()
    energy = np.asarray(strength, dtype=float).copy()
    original_voiced = ~np.isnan(pitches)
    for index in range(len(pitches) - 1):
        if not original_voiced[index] or original_voiced[index + 1]:
            continue
        end = index + 1
        while end < len(pitches) and not original_voiced[end]:
            end += 1
        fill_count = min(max_frames, max(0, end - index - 1))
        for offset in range(1, fill_count + 1):
            pitches[index + offset] = pitches[index]
            energy[index + offset] = energy[index] * max(0.0, 1.0 - offset / (fill_count + 1))
    return pitches, energy


def correct_octave_jumps(midi: np.ndarray) -> np.ndarray:
    """Prefer the closest octave inside a phrase, resetting across silence."""
    result = np.asarray(midi, dtype=float).copy()
    previous = math.nan
    for index, value in enumerate(result):
        if np.isnan(value):
            previous = math.nan
            continue
        if not np.isnan(previous):
            candidates = (value - 12.0, value, value + 12.0)
            corrected = min(candidates, key=lambda candidate: abs(candidate - previous))
            if abs(corrected - previous) <= 7.0:
                result[index] = corrected
        previous = result[index]
    return result


def extract_pitch_frames(
    audio_path: Path,
    *,
    sample_rate: int = 16000,
    frames_per_second: int = 40,
    confidence_threshold: float = 0.40,
    minimum_note: str = "E2",
    maximum_note: str = "C5",
) -> tuple[list[dict[str, float | bool | None]], float]:
    """Extract a compact continuous monophonic pitch trace from a vocal stem."""
    audio, _ = librosa.load(audio_path, sr=sample_rate, mono=True)
    hop_length = max(1, round(sample_rate / frames_per_second))
    f0, voiced, probability = librosa.pyin(
        audio,
        fmin=float(librosa.note_to_hz(minimum_note)),
        fmax=float(librosa.note_to_hz(maximum_note)),
        sr=sample_rate,
        frame_length=2048,
        hop_length=hop_length,
    )
    probability = np.nan_to_num(probability, nan=0.0)
    rms = librosa.feature.rms(y=audio, frame_length=2048, hop_length=hop_length, center=True)[0]
    rms = rms[:len(f0)] if len(rms) >= len(f0) else np.pad(rms, (0, len(f0) - len(rms)))
    db = librosa.amplitude_to_db(np.maximum(rms, 1e-8), ref=1.0, top_db=80.0)
    audible = db > max(-60.0, float(np.percentile(db, 20)) - 6.0)
    midi = librosa.hz_to_midi(f0)
    midi[(~voiced) | (probability < confidence_threshold) | (~audible)] = np.nan
    midi = correct_octave_jumps(midi)
    minimum_midi = float(librosa.note_to_midi(minimum_note))
    maximum_midi = float(librosa.note_to_midi(maximum_note))
    midi[(midi < minimum_midi) | (midi > maximum_midi)] = np.nan
    midi = bridge_short_gaps(midi, max_frames=max(1, round(frames_per_second * 0.30)))

    valid = ~np.isnan(midi)
    if np.any(valid):
        index = 0
        while index < len(midi):
            if np.isnan(midi[index]):
                index += 1
                continue
            start = index
            while index < len(midi) and not np.isnan(midi[index]):
                index += 1
            segment = midi[start:index]
            if len(segment) >= 3:
                median_size = min(7, len(segment) if len(segment) % 2 else len(segment) - 1)
                segment = median_filter(segment, size=max(3, median_size), mode="nearest")
                segment = gaussian_filter1d(segment, sigma=1.5, mode="nearest")
                midi[start:index] = segment

    voiced_db = db[valid]
    if len(voiced_db):
        quiet, loud = np.percentile(voiced_db, [10, 90])
        if loud - quiet < 3.0:
            loud = quiet + 3.0
        strength = np.clip((db - quiet) / (loud - quiet), 0.0, 1.0) ** 0.75
    else:
        strength = np.zeros_like(db)
    midi, strength = extend_note_fades(midi, strength, max_frames=max(1, round(frames_per_second * 0.25)))

    frames: list[dict[str, float | bool | None]] = []
    for index, value in enumerate(midi):
        is_voiced = not np.isnan(value)
        nearest = round(float(value)) if is_voiced else None
        frames.append(
            {
                "time": round(index * hop_length / sample_rate, 3),
                "midi": round(float(value), 3) if is_voiced else None,
                "cents": round((float(value) - nearest) * 100.0, 1) if is_voiced else None,
                "confidence": round(float(probability[index]), 3),
                "strength": round(float(strength[index]), 3) if is_voiced else 0.0,
                "voiced": is_voiced,
            }
        )
    return frames, len(audio) / sample_rate


def render_instrumental(stem_dir: Path, output_path: Path) -> None:
    """Mix every six-stem Demucs track except vocals with ffmpeg."""
    stems = [stem_dir / f"{name}.mp3" for name in ("bass", "drums", "guitar", "other", "piano")]
    inputs = [path for path in stems if path.is_file()]
    if not inputs:
        raise FileNotFoundError(f"No instrumental stems found in {stem_dir}")
    command = [executable("ffmpeg"), "-y", "-v", "error"]
    for path in inputs:
        command.extend(["-i", str(path)])
    command.extend([
        "-filter_complex",
        f"amix=inputs={len(inputs)}:duration=longest:normalize=0,alimiter=limit=0.97",
        "-codec:a",
        "libmp3lame",
        "-b:a",
        "192k",
        str(output_path),
    ])
    run(command)


def prepare_download(video_url: str, workspace: Path, bitrate: int) -> tuple[str, Path, Path]:
    yt_dlp = executable("yt-dlp")
    title = sanitize_filename(video_title(yt_dlp, video_url))
    downloads = workspace / "downloads"
    downloads.mkdir(parents=True, exist_ok=True)
    audio_path = downloads / f"{title}.mp3"
    if not audio_path.is_file():
        run([yt_dlp, "-x", "--audio-format", "mp3", video_url, "-o", str(audio_path)])
    stem_dir = workspace / "stems" / MODEL / title
    vocals_path = stem_dir / "vocals.mp3"
    if not vocals_path.is_file():
        run([
            executable("demucs"), "-n", MODEL, "--mp3", "--mp3-bitrate", str(bitrate),
            "--out", str(workspace / "stems"), f"-j{os.cpu_count() or 1}", str(audio_path),
        ])
    return title, audio_path, stem_dir


def write_metadata(
    output_dir: Path,
    *,
    song_id: str,
    title: str,
    artist: str,
    source_url: str,
    duration: float,
    frame_rate: int,
    frames: list[dict[str, float | bool | None]],
) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    (output_dir / "pitch.json").write_text(json.dumps({"frames": frames}, separators=(",", ":")))
    manifest_path = output_dir / "manifest.json"
    existing = json.loads(manifest_path.read_text()) if manifest_path.is_file() else {}
    manifest = {
        **existing,
        "id": song_id,
        "title": title,
        "artist": artist,
        "duration": round(duration, 3),
        "sourceUrl": source_url,
        "pitch": "pitch.json",
        "frameRate": frame_rate,
        "alignmentOffset": 0.0,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--video", help="YouTube URL to download and separate locally")
    source.add_argument("--input", type=Path, help="Existing local full-mix audio")
    parser.add_argument("--stem-dir", type=Path, help="Existing Demucs stem directory for --input")
    parser.add_argument("--song-id", required=True, help="Stable lowercase song identifier")
    parser.add_argument("--title", required=True, help="Display title")
    parser.add_argument("--artist", required=True, help="Display artist")
    parser.add_argument("--source-url", default="", help="Reference player URL for local input")
    parser.add_argument("--workspace", type=Path, default=Path("workspace"))
    parser.add_argument("--output-dir", type=Path, help="Publishable metadata directory")
    parser.add_argument("--frames-per-second", type=int, default=40)
    parser.add_argument("--minimum-note", default="E2", help="Lowest expected lead-vocal note (default: E2)")
    parser.add_argument("--maximum-note", default="C5", help="Highest expected lead-vocal note (default: C5)")
    parser.add_argument("--mp3-bitrate", type=int, default=192)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    output_dir = args.output_dir or args.workspace / "karaoke" / args.song_id / "metadata"
    source_url = args.video or args.source_url
    if args.video:
        _, _, stem_dir = prepare_download(args.video, args.workspace, args.mp3_bitrate)
    else:
        if not args.input.is_file():
            raise FileNotFoundError(args.input)
        if not args.stem_dir:
            raise ValueError("--stem-dir is required with --input")
        stem_dir = args.stem_dir

    vocals_path = stem_dir / "vocals.mp3"
    if not vocals_path.is_file():
        raise FileNotFoundError(vocals_path)
    local_dir = args.workspace / "karaoke" / args.song_id
    local_dir.mkdir(parents=True, exist_ok=True)
    instrumental = local_dir / f"{args.song_id}-instrumental.mp3"
    render_instrumental(stem_dir, instrumental)
    frames, duration = extract_pitch_frames(
        vocals_path,
        frames_per_second=args.frames_per_second,
        minimum_note=args.minimum_note,
        maximum_note=args.maximum_note,
    )
    write_metadata(
        output_dir,
        song_id=args.song_id,
        title=args.title,
        artist=args.artist,
        source_url=source_url,
        duration=duration,
        frame_rate=args.frames_per_second,
        frames=frames,
    )
    print(f"Publishable metadata: {output_dir}")
    print(f"Local instrumental: {instrumental}")


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Error: {error}") from error
