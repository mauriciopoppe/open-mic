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
open-mic transcribe-midi \
  --stem-dir "workspace/stems/htdemucs_6s/<song>" \
  --output-dir "workspace/midi/<song>"
```

Other useful commands include `align-midi`, `quantize-midi`, `solo-piano`,
`analyze-piano`, `analyze-lesson`, `extract-piano-patterns`, and
`transcribe-lesson`. Each command explains its inputs and defaults through its
`--help` screen.

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
