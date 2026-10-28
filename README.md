# Create backing tracks for your open mic or karaoke night

I perform in open mics in my spare time. With the setup in this repo
I create a backing track that doesn’t have either the voice or the guitar,
that way, I can play it on the background while I sing and play the guitar.

Read https://mauriciopoppe.com/notes/backing-track-for-open-mic/ for more info
about this workflow.

## Split a song into tracks

Download the dependencies (yt-dlp and demucs) with the following:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Split a song into tracks:

```bash
open-mic separate --video <youtube-video-url>

# The output is at ./workspace/stems/htdemucs_6s/
```

After installing the package in editable mode, the same workflow is available
through the unified command:

```bash
.venv/bin/pip install -e .
open-mic separate --video <youtube-video-url>
```

Stems are encoded as stereo MP3 at 192 kbps by default. Use
`--mp3-bitrate 128` for smaller files or `--mp3-bitrate 320` for the original
high-bitrate output.

Replace a separated stem with your own recording:

```bash
open-mic mix \
  --stem-dir "workspace/stems/htdemucs_6s/<song_title>" \
  --recording "workspace/recordings/guitar.m4a" \
  --exclude-stem guitar \
  --offset 2.845 \
  --gain-db 8 \
  --output "workspace/mixes/<song_title>-custom-guitar.wav"
```

## Repository layout

- `src/open_mic/audio/separate.py`: downloads a song and separates it into
  Demucs stems.
- `src/open_mic/audio/mix.py`: replaces one separated stem with a custom
  recording and exports a mixed WAV file.
- `src/open_mic/midi/transcribe.py`: transcribes stems or a recording into cleaned MIDI,
  with instrument-specific filters, tempo detection, and ghost-note cleanup.
- `src/open_mic/midi/align.py`: analyzes onset timing between audio and MIDI,
  writes an alignment report, and can warp a MIDI file to follow the audio.
- `src/open_mic/midi/quantize.py`: stretches MIDI to a target BPM and optionally snaps
  note events to a rhythmic grid while preserving the source file.
- `src/open_mic/midi/solo_piano.py`: combines bass, chord, and vocal MIDI parts into
  a solo-piano arrangement with sustain-pedal automation.
- `workspace/`: downloads, stems, recordings, generated MIDI, analysis, and
  models (ignored by Git).
- `tests/`: package smoke tests and future audio/MIDI fixtures.

After separation, use the connected Google Drive uploader to upload all six
files from `workspace/stems/htdemucs_6s/<song_title>/` to the private upload folder.
The folder URL and ID stay out of version control; the connected uploader
receives the destination at upload time.

Run the MIDI utilities from the repository root, for example:

```bash
open-mic transcribe-midi --stem-dir "workspace/stems/htdemucs_6s/<song_title>" \
  --output-dir "workspace/midi/<song_title>"
open-mic quantize-midi input.mid output.mid --source-bpm 120 --bpm 130
```

## Known errors

### `ERROR: unable to download video data: HTTP Error 403: Forbidden`

Check the latest release in https://github.com/yt-dlp/yt-dlp/releases, update the
entry in `requirements.txt` and reinstall the dependencies.
