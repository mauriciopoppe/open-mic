"""Command-line entry point for the open-mic tools."""

from __future__ import annotations

import sys


COMMANDS = {
    "separate": "open_mic.audio.separate",
    "mix": "open_mic.audio.mix",
    "transcribe-midi": "open_mic.midi.transcribe",
    "align-midi": "open_mic.midi.align",
    "quantize-midi": "open_mic.midi.quantize",
    "solo-piano": "open_mic.midi.solo_piano",
    "analyze-piano": "open_mic.analysis.analyze_progressive_piano",
    "analyze-lesson": "open_mic.analysis.analyze_vocal_lesson",
    "extract-piano-patterns": "open_mic.analysis.extract_piano_patterns",
    "transcribe-lesson": "open_mic.analysis.transcribe_vocal_lesson",
}


def main() -> None:
    if len(sys.argv) < 2 or sys.argv[1] in {"-h", "--help"}:
        commands = ", ".join(COMMANDS)
        print(f"Usage: open-mic <command> [options]\n\nCommands: {commands}")
        return

    command = sys.argv[1]
    module_name = COMMANDS.get(command)
    if module_name is None:
        raise SystemExit(f"Unknown command {command!r}; use --help for options.")

    module = __import__(module_name, fromlist=["main"])
    sys.argv = [f"open-mic {command}", *sys.argv[2:]]
    module.main()


if __name__ == "__main__":
    main()
