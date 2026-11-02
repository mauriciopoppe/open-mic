"""Command-line entry point for the open-mic tools."""

from __future__ import annotations

import sys


COMMANDS = {
    "separate": ("open_mic.audio.separate", "Download audio and create six Demucs stems"),
    "mix": ("open_mic.audio.mix", "Replace one stem with a custom recording"),
}

GROUPS = {
    "midi": {
        "transcribe": ("open_mic.midi.transcribe", "Convert audio stems or a recording to MIDI"),
        "prepare": ("open_mic.midi.prepare", "Align, stretch, and optionally quantize MIDI"),
    },
    "karaoke": {
        "prepare": ("open_mic.karaoke.prepare", "Prepare stems, pitch metadata, and a local backing mix"),
        "compare": ("open_mic.karaoke.compare", "Compare singing pitch trackers in a local A/B viewer"),
        "compare-separators": ("open_mic.karaoke.compare_separators", "Compare vocal separators with identical pitch analysis"),
        "coach-analyze": ("open_mic.karaoke.coach_analyze", "Rank coach-worthy vocal passages from metadata"),
        "transcribe-vocal": ("open_mic.karaoke.transcribe_vocal", "Create timed lyric fragments from an isolated vocal"),
        "merge": ("open_mic.karaoke.consensus", "Merge tracker evidence into a teaching contour"),
        "validate-site": ("open_mic.karaoke.validate_site", "Reject published audio assets"),
    },
    "arrange": {
        "piano": ("open_mic.midi.solo_piano", "Build a solo-piano arrangement from MIDI stems"),
    },
}


def print_help() -> None:
    print("""Usage: open-mic <command> [options]

Create stems, mixes, and MIDI arrangements.

Typical workflow:
  open-mic separate --video <youtube-url>
  open-mic mix --stem-dir <stems> --recording <file> --output <wav>
  open-mic midi transcribe --stem-dir <stems> --output-dir <directory>
  open-mic karaoke prepare --video <youtube-url> --song-id <slug>

Default workspace: workspace/
  downloads/  source audio downloaded by separate
  stems/      Demucs output
  recordings/ user recordings
  mixes/      rendered backing tracks
  midi/       generated MIDI and reports
  models/     local model and IR assets

Commands:
""")
    for name, (_, description) in COMMANDS.items():
        print(f"  {name:<24} {description}")
    for group, commands in GROUPS.items():
        print(f"  {group}/")
        for name, (_, description) in commands.items():
            print(f"    {name:<22} {description}")
    print("\nRun 'open-mic <command> --help' for arguments and defaults.")


def print_group_help(group: str) -> None:
    print(f"Usage: open-mic {group} <command> [options]\n\nCommands:")
    for name, (_, description) in GROUPS[group].items():
        print(f"  {name:<24} {description}")
    print(f"\nRun 'open-mic {group} <command> --help' for arguments and defaults.")


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] in {"-h", "--help"}:
        print_help()
        return

    command = sys.argv[1]
    command_args = sys.argv[2:]
    command_info = COMMANDS.get(command)
    command_name = command
    consumed = 1
    if command_info is None and command in GROUPS:
        if not command_args or command_args[0] in {"-h", "--help"}:
            print_group_help(command)
            return
        subcommand = command_args[0]
        command_info = GROUPS[command].get(subcommand)
        command_name = f"{command} {subcommand}"
        consumed = 2
    if command_info is None:
        raise SystemExit(f"Unknown command {command_name!r}; use --help for options.")

    module_name = command_info[0]
    module = __import__(module_name, fromlist=["main"])
    sys.argv = [f"open-mic {command_name}", *sys.argv[consumed + 1 :]]
    module.main()


if __name__ == "__main__":
    main()
