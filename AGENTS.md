# Open Mic Backing Tracks & Audio Workflows

## Project Overview
This repository provides tooling and workflows to download songs, split them into stems (vocals, drums, bass, guitar, piano, other) using Demucs, and produce custom backing tracks for open mic / karaoke performances or custom guitar play-along mixes.

## Environment & Virtualenv
- Python Virtual Environment: Located at `.venv/` (activate with `source .venv/bin/activate`).
- Python version / dependencies: `.venv/bin/python3` (includes `demucs`, `yt-dlp`, `torch`, `torchaudio`, `soundfile`, `numpy`, `scipy`, `librosa`).
- System tools: `ffmpeg`, `ffprobe`, `rubberband`, `jq`.

## Command contract

Install the package before invoking commands:

```bash
source .venv/bin/activate
pip install -r requirements.txt
pip install -e .
```

Use the CLI only; implementations live under `src/open_mic/` and are not
standalone scripts. Discover the full interface with:

```bash
open-mic --help
open-mic <command> --help
```

The default workspace contract is:

- `workspace/downloads/`: downloaded source audio.
- `workspace/stems/htdemucs_6s/<song>/`: six Demucs MP3 stems.
- `workspace/recordings/`: user-provided recordings.
- `workspace/mixes/`: rendered WAV backing tracks.
- `workspace/midi/`: generated MIDI and alignment reports.
- `workspace/models/`: local model and impulse-response assets.

Everything under `workspace/` is ignored by Git. Never place credentials,
Drive IDs, private recordings, or generated media in tracked source files.

Run the tests with the standard library test runner:

```bash
.venv/bin/python -m unittest discover -s tests -v
```

Available commands:

| Command | Purpose |
| --- | --- |
| `separate` | Download audio and create six Demucs stems. |
| `mix` | Replace one stem with a custom recording and render WAV. |
| `midi transcribe` | Convert stems or a recording to MIDI. |
| `midi prepare` | Align, stretch, and optionally quantize MIDI. |
| `arrange piano` | Create a solo-piano arrangement from MIDI stems. |

## Key Workflows & Scripts

### 1. Song Separation (`open-mic separate`)
Splits a YouTube audio track into 6 stems (`bass.mp3`, `drums.mp3`, `guitar.mp3`, `other.mp3`, `piano.mp3`, `vocals.mp3`):
```bash
source .venv/bin/activate
.venv/bin/pip install -e .
open-mic separate --video <youtube-video-url>
# Stems are written to workspace/stems/htdemucs_6s/<sanitized_title>/
```
The script produces stereo MP3 stems at 192 kbps by default. Pass
`--mp3-bitrate <kbps>` when a different size/quality tradeoff is needed.

### 2. Upload Stems to Google Drive (connected uploader)
The normal iPad workflow uploads every Demucs stem and mutes tracks in Logic Pro:
Use the connected Google Drive uploader to send every file from:
`workspace/stems/htdemucs_6s/<song_title>/` to the private upload folder. Keep the
folder URL and ID out of version control; provide the destination to the
connected uploader at upload time.

### 3. Optional: Replacing a Stem with a Custom Recording
When swapping a stem (like `guitar.mp3`) with an external recording (e.g. recorded over the track):
- **Alignment / Offset**: If the recording contains lead-in silence/pre-roll, trim the offset using `--offset <seconds>` (or `-ss <offset_seconds>` in ffmpeg) or align via cross-correlation onset analysis.
- **Volume Adjustment**: Custom recordings are often lower in level (e.g. -20 dB peak) compared to mastered stems. Increase volume via `--gain-db <dB>` (e.g., +8 dB) to match or sit above the mix.
- **Mixing command (`open-mic mix`)**:
```bash
open-mic mix \
  --stem-dir "workspace/stems/htdemucs_6s/<song_title>" \
  --recording "/path/to/recording.m4a" \
  --exclude-stem guitar \
  --offset 2.845 \
  --gain-db 8.0 \
  --output "/path/to/output.wav"
```

### 4. Pitch Modification
To change pitch by N semitones (e.g. down 1 semitone):
```bash
rubberband -p -1 "input.mp3" "output_m1.mp3"
```

### 5. Audio-to-MIDI Transcription (`open-mic midi transcribe`)
Converts audio stems and custom recordings to high-quality MIDI files using Spotify's Basic Pitch and PrettyMIDI:
- **Per-stem acoustic filters**: Low/high frequency limits tailored to each instrument's physical range (e.g. Bass 35–350Hz, Vocals 100–1100Hz).
- **Tempo sync**: Automatic BPM detection from drums (`107.67 BPM` for *Meet Me in Amsterdam*) so the MIDI snaps to DAW musical measure grids.
- **Monophonic cleanup**: Truncates unnatural overlapping chord notes on bass and lead vocals.
- **Ghost note filter**: Eliminates micro-transients (<60ms) and low-velocity room/strum bleed.
```bash
open-mic midi transcribe \
  --stem-dir "workspace/stems/htdemucs_6s/<song_title>" \
  --recording "/path/to/recording.m4a" \
  --offset 2.845 \
  --output-dir "/path/to/output_dir"
```
Outputs:
- Individual stem files: `Main Guitar.mid`, `Bass.mid`, `Piano.mid`, `Vocals.mid`, `Other.mid`.

### 6. MIDI Preparation (`open-mic midi prepare`)
Align, tempo-stretch, and optionally quantize an existing MIDI file. At least
one of `--audio` or `--bpm` is required; `--grid` requires `--bpm`.
Alignment runs before tempo/grid preparation when both are requested.
```bash
open-mic midi prepare input.mid output.mid \
  --audio "workspace/stems/htdemucs_6s/<song>/combined.mp3" \
  --bpm 130 \
  --grid 8 \
  --report "workspace/midi/<song>-alignment.csv"
```

### 7. Solo Piano Arrangement (`open-mic arrange piano`)
Synthesizes a cohesive solo piano piece from the stem MIDI tracks:
- **Left Hand**: Bassline root notes and rhythmic pulses (Octaves 1–2, solid dynamics).
- **Right Hand Chords**: Harmonic pad and chord voicings from piano & guitar (Octaves 3–4, gentle accompaniment dynamics).
- **Top Singing Melody**: Vocal lead line and melodic hooks voiced on the highest notes (Octaves 4–5, prominent singing dynamics).
- **Sustain Pedaling**: Automatic `CC 64` pedaling synchronized with measure transitions for realistic acoustic grand piano resonance.
```bash
open-mic arrange piano \
  --midi-dir "/path/to/HQ_MIDI" \
  --bpm 107.67 \
  --output "/path/to/Solo_Piano.mid"
```

## Known Issues & Troubleshooting
- **yt-dlp HTTP 403 Forbidden**: Update `yt-dlp` in `requirements.txt` to the latest release and run `pip install -U yt-dlp`.
- **Virtualenv Activation**: Always activate `source .venv/bin/activate` before running Python scripts or Demucs commands.

## Script organization
- Audio and MIDI implementations live under `src/open_mic/`; use the `open-mic` command for all workflows.

## Adding a Song to the Voice Song Lab

Use this workflow when asked to add or prepare another karaoke song. The Song
Lab player is generic: `#karaoke/<song-id>` loads its identity, playback,
sections, pitch range, contour, and coach notebook from
`sites/voice/dist/assets/<song-id>/`.

1. Keep downloaded audio, Demucs stems, MDX23C stems, models, comparison data,
   and instrumental mixes under `workspace/`. Never copy audio into `dist/`.
2. Create both vocal estimates:
   - Demucs: `open-mic separate --video <official-url>`.
   - MDX23C: run `MDX23C-8KFFT-InstVoc_HQ.ckpt` through the local
     `audio-separator` environment under `workspace/models/`.
3. Analyze both stems with the same settings and build the MDX-primary fusion:

```bash
open-mic karaoke compare-separators \
  --stem demucs=<demucs-vocals> \
  --stem mdx23c=<mdx23c-vocals> \
  --mix <downloaded-source> \
  --output-dir workspace/karaoke/<song-id>/separator-comparison/viewer \
  --rmvpe-repo workspace/models/yxlllc-RMVPE \
  --rmvpe-model workspace/models/yxlllc-RMVPE/pretrain/model.pt

open-mic karaoke merge \
  --comparison workspace/karaoke/<song-id>/separator-comparison/viewer/comparison.json \
  --output sites/voice/dist/assets/<song-id>/pitch.json

open-mic karaoke transcribe-vocal <demucs-vocals> \
  --output workspace/karaoke/<song-id>/transcript.json

open-mic karaoke coach-analyze \
  --pitch sites/voice/dist/assets/<song-id>/pitch.json \
  --transcript workspace/karaoke/<song-id>/transcript.json \
  --output workspace/karaoke/<song-id>/coach-analysis.json
```

4. Add `manifest.json` and `cues.json` beside `pitch.json`:
   - Required manifest fields: `id`, `title`, `artist`, `duration`,
     `sourceUrl`, `frameRate`, `pitch`, and `cues`.
   - `id` must equal the asset directory and URL slug.
   - Add `youtubeVideoId`, `alignmentOffset`, `pitchRange`, and labeled
     `sections` when known.
   - `localReferencePath` is optional and used only on localhost.
   - Cues contain `start`, `end`, `fragment`, `title`, and `text`. Use only
     short identifying lyric fragments; never publish complete lyrics.
   - Base coach cues on the generated coach-analysis rankings for range,
     high notes, vibrato, agility, sustain, and dynamics. Treat transcript
     text as a draft; use neutral passage labels when sung words are uncertain.
   - Add the song identity to `sites/voice/dist/assets/songs.json` so it appears
     in the Song Lab picker.
5. Open `#karaoke/<song-id>` locally. Review the full contour plus difficult
   runs, sustained notes, silence, loudness, vibrato, cue timing, section
   seeking, playback speed, looping, and browser-local instrumental restore.
6. Run:

```bash
.venv/bin/python -m unittest discover -s tests -v
open-mic karaoke validate-site --site-dir sites/voice/dist
```

Do not deploy unless the user explicitly asks. The validator must report no
published audio and valid Song Lab manifests before publication.

## Nested site repositories

`sites/voice/` and `sites/guitar/` are independent Git
repositories. Run Git status, commits, and history commands from inside the
relevant site directory. Do not stage `sites/` from the parent `open-mic`
repository: without configured remotes that would create unportable embedded
Git links rather than versioning the site contents. The compatibility symlink
at `workspace/sites/voice` is ignored and exists only for older localhost URLs.

OpenAI Sites created and uses each nested `.git/` repository as that Site's
source history. Never delete, flatten, relocate, or replace those `.git/`
directories when reorganizing the parent repository. Sites publication commits
and pushes from inside the selected nested repository using temporary source
credentials supplied by the Sites workflow.

Keep each site's `.openai/hosting.json` tracked in its own nested repository.
It contains stable, non-secret deployment configuration: the OpenAI Sites
`project_id` and the static output directory (currently `dist`). Preserve its
existing `project_id` when editing or publishing an existing Site. Never copy
hosting manifests between sites, and never put temporary write credentials,
tokens, or runtime secrets in them.


