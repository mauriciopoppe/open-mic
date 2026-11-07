#!/usr/bin/env python3
"""Run all deterministic Song Lab ingestion steps for a song in one CLI call.

Pipeline stages executed by `open-mic karaoke ingest`:
  1. Download & Demucs 6-stem separation (`open-mic separate`)
  2. MDX23C high-resolution vocal extraction (`audio-separator`)
  3. Dual-separator pitch & vibrato analysis (`open-mic karaoke compare-separators`)
  4. MDX-primary teaching contour fusion (`open-mic karaoke merge`)
  5. Isolated vocal Whisper transcription (`open-mic karaoke transcribe-vocal`)
  6. Acoustic passage ranking (`open-mic karaoke coach-analyze`)
  7. Standard synced LRC lookup via LRCLIB (`lyrics.lrc`)
  8. Initial `manifest.json`, `cues.json` skeleton, and `songs.json` registration
"""

from __future__ import annotations

import argparse
import json
import math
import re
import subprocess
import sys
import urllib.parse
import urllib.request
from pathlib import Path

import numpy as np

from open_mic.audio.separate import run
from open_mic.karaoke import coach_analyze, compare_separators, consensus, prepare, validate_site


DEFAULT_RMVPE_REPO = Path("workspace/models/yxlllc-RMVPE")
DEFAULT_RMVPE_MODEL = Path("workspace/models/yxlllc-RMVPE/pretrain/model.pt")
DEFAULT_MDX_BIN = Path("workspace/models/audio-separator-venv/bin/audio-separator")
DEFAULT_MDX_MODEL_DIR = Path("workspace/models/audio-separator")
DEFAULT_MDX_MODEL = "MDX23C-8KFFT-InstVoc_HQ.ckpt"


def extract_youtube_id(url: str) -> str:
    match = re.search(r"(?:[?&]v=|youtu\.be/)([A-Za-z0-9_-]{11})", url or "")
    return match.group(1) if match else ""


def ensure_mdx23c_vocal(
    mix_path: Path,
    mdx_dir: Path,
    *,
    mdx_bin: Path = DEFAULT_MDX_BIN,
    mdx_model_dir: Path = DEFAULT_MDX_MODEL_DIR,
    mdx_model: str = DEFAULT_MDX_MODEL,
) -> Path:
    """Return existing MDX23C vocal stem or run audio-separator to create it."""
    mdx_dir.mkdir(parents=True, exist_ok=True)
    existing = sorted(mdx_dir.glob("*(Vocals)*.wav"))
    if existing:
        return existing[0]
    if not mdx_bin.is_file():
        raise FileNotFoundError(
            f"MDX23C binary not found at {mdx_bin}. "
            "Pass --mdx-vocal <path> or install audio-separator under workspace/models/audio-separator-venv."
        )
    run([
        str(mdx_bin),
        str(mix_path),
        "--model_filename",
        mdx_model,
        "--model_file_dir",
        str(mdx_model_dir),
        "--output_dir",
        str(mdx_dir),
        "--single_stem",
        "Vocals",
    ])
    created = sorted(mdx_dir.glob("*(Vocals)*.wav"))
    if not created:
        raise FileNotFoundError(f"MDX23C separation produced no *(Vocals)*.wav file in {mdx_dir}")
    return created[0]


def fetch_synced_lrc(title: str, artist: str, target_duration: float) -> str | None:
    """Query LRCLIB for the closest duration-matched standard synced LRC."""
    query = urllib.parse.urlencode({"track_name": title, "artist_name": artist})
    url = f"https://lrclib.net/api/search?{query}"
    request = urllib.request.Request(url, headers={"User-Agent": "open-mic/1.0"})
    try:
        with urllib.request.urlopen(request, timeout=12) as response:
            candidates = json.loads(response.read().decode("utf-8"))
    except Exception as error:
        print(f"Warning: LRCLIB lookup failed ({error}); skipping automatic lyrics.lrc download.", file=sys.stderr)
        return None
    synced = [item for item in candidates if isinstance(item.get("syncedLyrics"), str) and item["syncedLyrics"].strip()]
    if not synced:
        return None
    best = min(
        synced,
        key=lambda item: abs(float(item.get("duration") or target_duration) - target_duration),
    )
    lines = [line.rstrip() for line in best["syncedLyrics"].splitlines() if line.strip()]
    return "\n".join(lines) + "\n"


def compute_pitch_range(frames: list[dict]) -> dict[str, int]:
    """Compute a comfortable display MIDI range (rounded to 2-semitone padding) from voiced frames."""
    voiced = [float(frame["midi"]) for frame in frames if frame.get("voiced") and frame.get("midi") is not None]
    if not voiced:
        return {"minimumMidi": 42, "maximumMidi": 76}
    low, high = np.percentile(voiced, [1, 99])
    minimum_midi = max(36, int(math.floor(low)) - 4)
    maximum_midi = min(84, int(math.ceil(high)) + 3)
    if maximum_midi - minimum_midi < 24:
        maximum_midi = minimum_midi + 24
    return {"minimumMidi": minimum_midi, "maximumMidi": maximum_midi}


def update_song_catalog(site_dir: Path, *, song_id: str, title: str, artist: str) -> Path:
    """Add or update the song entry in sites/voice/dist/assets/songs.json."""
    catalog_path = site_dir / "assets" / "songs.json"
    if catalog_path.is_file():
        catalog = json.loads(catalog_path.read_text())
    else:
        catalog = {"songs": []}
    songs = list(catalog.get("songs", []))
    entry = {"id": song_id, "title": title, "artist": artist}
    for index, existing in enumerate(songs):
        if existing.get("id") == song_id:
            songs[index] = entry
            break
    else:
        songs.append(entry)
    catalog_path.parent.mkdir(parents=True, exist_ok=True)
    catalog_path.write_text(json.dumps({"songs": songs}, indent=2) + "\n")
    return catalog_path


def run_cli_module(module, argv: list[str]) -> None:
    original = sys.argv
    try:
        sys.argv = argv
        module.main()
    finally:
        sys.argv = original


def build_parser() -> argparse.ArgumentParser:
    epilog = """Deterministic pipeline steps executed automatically:
  1. Demucs separation       -> workspace/stems/htdemucs_6s/<sanitized_title>/vocals.mp3
     Debug standalone:       open-mic separate --video <url>
  2. MDX23C vocal extraction -> workspace/karaoke/<song-id>/separator-comparison/mdx/*(Vocals)*.wav
  3. Separator comparison    -> workspace/karaoke/<song-id>/separator-comparison/viewer/comparison.json
     Debug standalone:       open-mic karaoke compare-separators --help
  4. Contour fusion          -> sites/voice/dist/assets/<song-id>/pitch.json
     Debug standalone:       open-mic karaoke merge --help
  5. Whisper transcription   -> workspace/karaoke/<song-id>/transcript.json
     Debug standalone:       open-mic karaoke transcribe-vocal --help
  6. Coach passage analysis  -> workspace/karaoke/<song-id>/coach-analysis.json
     Debug standalone:       open-mic karaoke coach-analyze --help
  7. Synced lyrics lookup    -> sites/voice/dist/assets/<song-id>/lyrics.lrc (via LRCLIB)
  8. Manifest & validation   -> sites/voice/dist/assets/<song-id>/manifest.json, cues.json, songs.json
     Debug standalone:       open-mic karaoke validate-site --site-dir sites/voice/dist

Remaining LLM / human-in-the-loop curation steps after ingest finishes:
  A. Inspect workspace/karaoke/<song-id>/transcript.json and sites/voice/dist/assets/<song-id>/lyrics.lrc
     to verify LRC timestamps match the isolated vocal onset and populate labeled sections
     (intro, verse1, chorus1, verse2, bridge, outro) in sites/voice/dist/assets/<song-id>/manifest.json.
  B. Inspect workspace/karaoke/<song-id>/coach-analysis.json (ranked highlights for range, highNote,
     vibrato, agility, sustain, dynamics) and write 8-12 actionable vocal coaching cards in
     sites/voice/dist/assets/<song-id>/cues.json (plus optional coachNote in manifest.json).
  C. Re-run: open-mic karaoke validate-site --site-dir sites/voice/dist
"""
    parser = argparse.ArgumentParser(
        description="Run the complete deterministic Song Lab ingestion pipeline for a song.",
        epilog=epilog,
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    source = parser.add_mutually_exclusive_group(required=True)
    source.add_argument("--video", help="Official YouTube URL to download and separate")
    source.add_argument("--mix", type=Path, help="Existing downloaded source audio file under workspace/downloads/")
    parser.add_argument("--song-id", required=True, help="URL slug and asset directory name (e.g. officially-missing-you)")
    parser.add_argument("--title", required=True, help="Display title (e.g. 'Officially Missing You')")
    parser.add_argument("--artist", required=True, help="Display artist (e.g. 'Tamia')")
    parser.add_argument("--source-url", default="", help="Official YouTube URL when using --mix")
    parser.add_argument("--demucs-vocal", type=Path, help="Override path to Demucs vocals.mp3")
    parser.add_argument("--mdx-vocal", type=Path, help="Override path to MDX23C vocal stem WAV")
    parser.add_argument("--workspace", type=Path, default=Path("workspace"), help="Workspace directory (default: workspace)")
    parser.add_argument("--site-dir", type=Path, default=Path("sites/voice/dist"), help="Voice static site dist directory")
    parser.add_argument("--rmvpe-repo", type=Path, default=DEFAULT_RMVPE_REPO, help="Path to yxlllc-RMVPE repository")
    parser.add_argument("--rmvpe-model", type=Path, default=DEFAULT_RMVPE_MODEL, help="Path to RMVPE model.pt weights")
    parser.add_argument("--whisper-model", default="small.en", help="Faster-Whisper model name (default: small.en)")
    parser.add_argument("--mp3-bitrate", type=int, default=192, help="Demucs MP3 stem bitrate (default: 192)")
    parser.add_argument("--skip-lyrics", action="store_true", help="Skip automatic LRCLIB synced lyrics download")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    song_id = args.song_id.strip()
    workspace: Path = args.workspace
    site_dir: Path = args.site_dir
    asset_dir = site_dir / "assets" / song_id
    song_work_dir = workspace / "karaoke" / song_id
    viewer_dir = song_work_dir / "separator-comparison" / "viewer"
    mdx_dir = song_work_dir / "separator-comparison" / "mdx"

    # Step 1: Download & Demucs separation
    if args.video:
        source_url = args.video
        _, mix_path, stem_dir = prepare.prepare_download(args.video, workspace, args.mp3_bitrate)
    else:
        mix_path = args.mix
        if not mix_path.is_file():
            raise FileNotFoundError(f"Mix audio not found: {mix_path}")
        source_url = args.source_url
        stem_dir = workspace / "stems" / prepare.MODEL / mix_path.stem

    demucs_vocal = args.demucs_vocal or (stem_dir / "vocals.mp3")
    if not demucs_vocal.is_file():
        raise FileNotFoundError(f"Demucs vocal stem not found: {demucs_vocal}")

    # Step 2: MDX23C vocal stem
    mdx_vocal = args.mdx_vocal or ensure_mdx23c_vocal(mix_path, mdx_dir)
    if not mdx_vocal.is_file():
        raise FileNotFoundError(f"MDX23C vocal stem not found: {mdx_vocal}")

    # Step 3: Compare separators (pYIN + RMVPE on both stems)
    comparison_path = viewer_dir / "comparison.json"
    if not comparison_path.is_file():
        run_cli_module(
            compare_separators,
            [
                "open-mic karaoke compare-separators",
                "--stem", f"demucs={demucs_vocal}",
                "--stem", f"mdx23c={mdx_vocal}",
                "--mix", str(mix_path),
                "--output-dir", str(viewer_dir),
                "--rmvpe-repo", str(args.rmvpe_repo),
                "--rmvpe-model", str(args.rmvpe_model),
            ],
        )

    # Step 4: Merge into publishable pitch.json
    pitch_path = asset_dir / "pitch.json"
    run_cli_module(
        consensus,
        [
            "open-mic karaoke merge",
            "--comparison", str(comparison_path),
            "--output", str(pitch_path),
        ],
    )

    # Step 5: Transcribe isolated vocal with Whisper
    transcript_path = song_work_dir / "transcript.json"
    if not transcript_path.is_file():
        from open_mic.karaoke import transcribe_vocal
        run_cli_module(
            transcribe_vocal,
            [
                "open-mic karaoke transcribe-vocal",
                str(demucs_vocal),
                "--output", str(transcript_path),
                "--model", args.whisper_model,
            ],
        )

    # Step 6: Coach passage analysis
    coach_analysis_path = song_work_dir / "coach-analysis.json"
    run_cli_module(
        coach_analyze,
        [
            "open-mic karaoke coach-analyze",
            "--pitch", str(pitch_path),
            "--transcript", str(transcript_path),
            "--output", str(coach_analysis_path),
        ],
    )

    # Read duration & pitch frames for manifest + LRC lookup
    comparison_data = json.loads(comparison_path.read_text())
    duration = round(float(comparison_data["duration"]), 3)
    frame_rate = int(comparison_data.get("frameRate", 100))
    pitch_data = json.loads(pitch_path.read_text())
    pitch_range = compute_pitch_range(pitch_data.get("frames", []))

    # Step 7: Synced LRC download (if not already present)
    lyrics_path = asset_dir / "lyrics.lrc"
    if not args.skip_lyrics and not lyrics_path.is_file():
        lrc_text = fetch_synced_lrc(args.title, args.artist, duration)
        if lrc_text:
            lyrics_path.parent.mkdir(parents=True, exist_ok=True)
            lyrics_path.write_text(lrc_text)
            print(f"Synced lyrics: {lyrics_path}")

    # Step 8: Write/update manifest.json, cues.json skeleton, and songs.json
    cues_path = asset_dir / "cues.json"
    if not cues_path.is_file():
        cues_path.write_text(json.dumps({"cues": []}, indent=2) + "\n")

    manifest_path = asset_dir / "manifest.json"
    existing_manifest = json.loads(manifest_path.read_text()) if manifest_path.is_file() else {}
    youtube_id = existing_manifest.get("youtubeVideoId") or extract_youtube_id(source_url)
    rel_mix = "/" + str(mix_path.as_posix()).lstrip("/")
    manifest = {
        **existing_manifest,
        "id": song_id,
        "title": args.title,
        "artist": args.artist,
        "duration": duration,
        "sourceUrl": source_url or existing_manifest.get("sourceUrl", ""),
        "youtubeVideoId": youtube_id,
        "localReferencePath": existing_manifest.get("localReferencePath", rel_mix),
        "pitch": "pitch.json",
        "cues": "cues.json",
        "frameRate": frame_rate,
        "alignmentOffset": existing_manifest.get("alignmentOffset", 0.0),
        "pitchRange": existing_manifest.get("pitchRange", pitch_range),
        "sections": existing_manifest.get(
            "sections",
            {"full": {"label": "Full song", "start": 0.0, "end": duration}},
        ),
    }
    if lyrics_path.is_file():
        manifest["lyrics"] = "lyrics.lrc"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    catalog_path = update_song_catalog(site_dir, song_id=song_id, title=args.title, artist=args.artist)

    errors = validate_site.song_asset_errors(site_dir)
    if errors:
        raise RuntimeError("Validation errors after ingest:\n" + "\n".join(errors))

    print("\n=== Deterministic Ingest Complete ===")
    print(f"  Manifest:       {manifest_path}")
    print(f"  Pitch contour:  {pitch_path}")
    print(f"  Synced lyrics:  {lyrics_path if lyrics_path.is_file() else '(none found)'}")
    print(f"  Transcript:     {transcript_path}")
    print(f"  Coach analysis: {coach_analysis_path}")
    print(f"  Song catalog:   {catalog_path}")
    print("\n=== Next Steps (LLM Curation) ===")
    print(f"  1. Populate labeled sections in {manifest_path} using {lyrics_path} & {transcript_path}")
    print(f"  2. Write coaching cues in {cues_path} from highlights in {coach_analysis_path}")
    print(f"  3. Validate: open-mic karaoke validate-site --site-dir {site_dir}")


if __name__ == "__main__":
    try:
        main()
    except (FileNotFoundError, RuntimeError, ValueError, subprocess.CalledProcessError) as error:
        raise SystemExit(f"Error: {error}") from error
