#!/usr/bin/env python3
"""Reject audio files from a static site deployment directory."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from open_mic.karaoke.prepare import AUDIO_EXTENSIONS


def published_audio_files(site_dir: Path) -> list[Path]:
    return sorted(path for path in site_dir.rglob("*") if path.is_file() and path.suffix.lower() in AUDIO_EXTENSIONS)


def song_asset_errors(site_dir: Path) -> list[str]:
    """Validate every manifest-backed Song Lab asset directory."""
    errors: list[str] = []
    assets = site_dir / "assets"
    if not assets.is_dir():
        return errors
    for manifest_path in sorted(assets.glob("*/manifest.json")):
        song_dir = manifest_path.parent
        try:
            manifest = json.loads(manifest_path.read_text())
        except (OSError, json.JSONDecodeError) as error:
            errors.append(f"{manifest_path}: invalid JSON ({error})")
            continue
        song_id = manifest.get("id")
        if song_id != song_dir.name:
            errors.append(f"{manifest_path}: id must match directory name {song_dir.name!r}")
        for field in ("title", "artist", "sourceUrl"):
            if not isinstance(manifest.get(field), str) or not manifest[field].strip():
                errors.append(f"{manifest_path}: missing non-empty {field}")
        for field in ("duration", "frameRate"):
            if not isinstance(manifest.get(field), (int, float)) or manifest[field] <= 0:
                errors.append(f"{manifest_path}: {field} must be positive")
        for field, default in (("pitch", "pitch.json"), ("cues", "cues.json")):
            relative = manifest.get(field, default)
            if not isinstance(relative, str) or not (song_dir / relative).is_file():
                errors.append(f"{manifest_path}: referenced {field} file is missing")
        duration = manifest.get("duration", 0)
        for section_id, section in manifest.get("sections", {}).items():
            start, end = section.get("start"), section.get("end")
            if not isinstance(start, (int, float)) or not isinstance(end, (int, float)) or not 0 <= start < end <= duration + 0.1:
                errors.append(f"{manifest_path}: invalid section {section_id!r}")
    return errors


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--site-dir", type=Path, required=True)
    args = parser.parse_args()
    found = published_audio_files(args.site_dir)
    if found:
        names = ", ".join(str(path) for path in found)
        raise SystemExit(f"Published audio is not allowed: {names}")
    errors = song_asset_errors(args.site_dir)
    if errors:
        raise SystemExit("Invalid Song Lab assets:\n" + "\n".join(errors))
    print(f"No audio files found; Song Lab manifests are valid in {args.site_dir}")


if __name__ == "__main__":
    main()
