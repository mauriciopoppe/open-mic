"""Command-line entry point for the open-mic tools."""

from __future__ import annotations

import sys


COMMANDS = {
    "separate": ("open_mic.audio.separate", "Download audio and create six Demucs stems"),
    "mix": ("open_mic.audio.mix", "Replace one stem with a custom recording"),
    "transcribe-midi": ("open_mic.midi.transcribe", "Convert audio stems or a recording to MIDI"),
    "align-midi": ("open_mic.midi.align", "Measure and correct MIDI timing against audio"),
    "quantize-midi": ("open_mic.midi.quantize", "Stretch and quantize a MIDI file"),
    "solo-piano": ("open_mic.midi.solo_piano", "Build a solo-piano arrangement from MIDI stems"),
    "analyze-piano": ("open_mic.analysis.analyze_progressive_piano", "Find piano runs in a MIDI file"),
    "analyze-lesson": ("open_mic.analysis.analyze_vocal_lesson", "Extract acoustic evidence from a lesson recording"),
    "extract-piano-patterns": ("open_mic.analysis.extract_piano_patterns", "Find ascending piano patterns in MIDI"),
    "transcribe-lesson": ("open_mic.analysis.transcribe_vocal_lesson", "Transcribe a lesson recording locally"),
}


def print_help() -> None:
    print("""Usage: open-mic <command> [options]

Create stems, mixes, MIDI, and offline practice analyses.

Typical workflow:
  open-mic separate --video <youtube-url>
  open-mic mix --stem-dir <stems> --recording <file> --output <wav>
  open-mic transcribe-midi --stem-dir <stems> --output-dir <directory>

Default workspace: workspace/
  downloads/  source audio downloaded by separate
  stems/      Demucs output
  recordings/ user recordings
  mixes/      rendered backing tracks
  midi/       generated MIDI and reports
  analysis/   generated analysis results
  models/     local model and IR assets

Commands:
""")
    for name, (_, description) in COMMANDS.items():
        print(f"  {name:<24} {description}")
    print("\nRun 'open-mic <command> --help' for arguments and defaults.")


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] in {"-h", "--help"}:
        print_help()
        return

    command = sys.argv[1]
    command_info = COMMANDS.get(command)
    if command_info is None:
        raise SystemExit(f"Unknown command {command!r}; use --help for options.")

    module_name = command_info[0]
    module = __import__(module_name, fromlist=["main"])
    sys.argv = [f"open-mic {command}", *sys.argv[2:]]
    module.main()


if __name__ == "__main__":
    main()
