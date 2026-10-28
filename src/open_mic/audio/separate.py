#!/usr/bin/env python3
"""Download a YouTube audio track and separate it into Demucs stems."""

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path


MODEL = "htdemucs_6s"


def executable(name: str) -> str:
    """Prefer tools installed beside the Python interpreter."""
    sibling = Path(sys.executable).with_name(name)
    if sibling.is_file() and os.access(sibling, os.X_OK):
        return str(sibling)
    resolved = shutil.which(name)
    if resolved:
        return resolved
    raise RuntimeError(
        f"Could not find {name!r}. Activate the virtual environment or install it."
    )


def run(command: list[str], *, capture_output: bool = False) -> subprocess.CompletedProcess[str]:
    print("$", " ".join(command))
    return subprocess.run(command, check=True, text=True, capture_output=capture_output)


def video_title(yt_dlp: str, url: str) -> str:
    result = run([yt_dlp, "-j", url], capture_output=True)
    for line in result.stdout.splitlines():
        try:
            metadata = json.loads(line)
        except json.JSONDecodeError:
            continue
        title = metadata.get("title")
        if title:
            return title
    raise RuntimeError("yt-dlp did not return a video title")


def sanitize_filename(title: str) -> str:
    safe = "".join(
        character
        if character.isascii() and (character.isalnum() or character in "._-")
        else "_"
        for character in title
    )
    return safe.strip("._") or "audio"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("-v", "--video", required=True, help="YouTube video URL")
    parser.add_argument(
        "--mp3-bitrate",
        type=int,
        default=192,
        help="Demucs MP3 bitrate in kbps (default: 192)",
    )
    parser.add_argument(
        "--workspace",
        type=Path,
        default=Path("workspace"),
        help="Directory for downloads and separated stems (default: workspace)",
    )
    args = parser.parse_args()

    yt_dlp = executable("yt-dlp")
    demucs = executable("demucs")
    title = sanitize_filename(video_title(yt_dlp, args.video))
    downloads_dir = args.workspace / "downloads"
    downloads_dir.mkdir(parents=True, exist_ok=True)
    audio_path = downloads_dir / f"{title}.mp3"

    run([yt_dlp, "-x", "--audio-format", "mp3", args.video, "-o", str(audio_path)])

    workers = str(os.cpu_count() or 1)
    run([
        demucs,
        "-n",
        MODEL,
        "--mp3",
        "--mp3-bitrate",
        str(args.mp3_bitrate),
        "--out",
        str(args.workspace / "stems"),
        f"-j{workers}",
        str(audio_path),
    ])
    print(f"Complete. Stems are in {args.workspace / 'stems' / MODEL / title}/")


if __name__ == "__main__":
    try:
        main()
    except subprocess.CalledProcessError as error:
        raise SystemExit(error.returncode) from error
    except RuntimeError as error:
        raise SystemExit(f"Error: {error}") from error
