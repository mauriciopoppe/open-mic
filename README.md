# Open Mic Backing Tracks

Make a backing track for an open-mic or karaoke performance: download a song,
remove the parts you want to perform, and add your own recording when needed.

## Set up

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
pip install -e .
```

The command-line tool is `open-mic`. Run `open-mic --help` for the complete
command list, or `open-mic <command> --help` for detailed options.

## Using this repository with an agent

Agents should read [`AGENTS.md`](AGENTS.md) before changing the project. It is
the detailed operating contract for the workspace, commands, dependencies, and
safety rules.

The normal agent workflow is:

1. Inspect the working tree and existing changes before editing.
2. Use the `open-mic` CLI rather than invoking implementation modules directly.
3. Keep downloads, recordings, generated MIDI, reports, and models under the
   ignored `workspace/` directory.
4. Never put credentials, Drive IDs, private recordings, or generated media in
   tracked files.
5. Validate changes with CLI help, Python compilation, and focused smoke tests.
6. Review the final diff and commit only source, documentation, configuration,
   and tests.

Agents should prefer explicit paths and flags, avoid hidden song-specific
defaults, and ask before taking actions outside this repository or uploading
files to an external service.

## Make a backing track

Download a song and split it into bass, drums, guitar, other, piano, and vocals:

```bash
open-mic separate --video <youtube-video-url>
```

The six stems are written to `workspace/stems/htdemucs_6s/`. To replace one of
the separated parts with your own recording:

```bash
open-mic mix \
  --stem-dir "workspace/stems/htdemucs_6s/<song>" \
  --recording "workspace/recordings/guitar.m4a" \
  --exclude-stem guitar \
  --offset 2.845 \
  --gain-db 8 \
  --output "workspace/mixes/<song>-custom-guitar.wav"
```

The offset removes lead-in silence from the recording. Gain compensates for a
quieter home recording. The mixer automatically prevents clipping in the final
WAV.

## MIDI and practice tools

Convert stems or a recording to MIDI:

```bash
open-mic midi transcribe \
  --stem-dir "workspace/stems/htdemucs_6s/<song>" \
  --output-dir "workspace/midi/<song>"
```

Prepare an existing MIDI file for a new tempo and grid:

```bash
open-mic midi prepare input.mid output.mid --bpm 130 --grid 8
```

Create a solo-piano arrangement from prepared MIDI stems:

```bash
open-mic arrange piano \
  --midi-dir "workspace/midi/<song>" \
  --output "workspace/midi/<song>-solo-piano.mid"
```

Each command explains its inputs and defaults through its `--help` screen.

All downloads and generated files live under `workspace/`, which is ignored by
Git. This keeps the repository focused on the tools and documentation.

## Troubleshooting

If YouTube downloads fail with HTTP 403, update `yt-dlp` in `requirements.txt`
and reinstall the environment:

```bash
pip install -U -r requirements.txt
```

The audio workflows also require `ffmpeg`, `ffprobe`, and `rubberband` to be
available on your `PATH`.
