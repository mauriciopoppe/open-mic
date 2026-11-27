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
| `karaoke ingest` | Run all deterministic Song Lab ingestion steps in a single command. |

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
sections, pitch range, contour, synced lyrics, and coach notebook from
`sites/voice/dist/assets/<song-id>/`.

1. Keep downloaded audio, Demucs stems, MDX23C stems, models, comparison data,
   and instrumental mixes under `workspace/`. Never copy audio into `dist/`.
2. **Deterministic Pipeline (Single CLI Call)**:
   Run `open-mic karaoke ingest` to execute all deterministic stages (Demucs
   6-stem separation, MDX23C vocal extraction, dual-separator `pYIN` + `RMVPE`
   analysis, MDX-primary contour fusion into `pitch.json`, Whisper word-level
   vocal transcription, acoustic passage ranking in `coach-analysis.json`,
   LRCLIB standard `lyrics.lrc` lookup, and initial `manifest.json` /
   `songs.json` registration):

```bash
open-mic karaoke ingest \
  --video <official-url> \
  --song-id <song-id> \
  --title "<Title>" \
  --artist "<Artist>"
```

   If you need to debug or re-run any individual stage, run `open-mic karaoke --help`
   or `open-mic karaoke ingest --help` to see the underlying subcommands
   (`separate`, `karaoke compare-separators`, `karaoke merge`,
   `karaoke transcribe-vocal`, `karaoke coach-analyze`, `karaoke validate-site`).
3. **LLM Curation Steps (`manifest.json`, `cues.json`, and `lyrics.lrc`)**:
   - Inspect `sites/voice/dist/assets/<song-id>/lyrics.lrc` and
     `workspace/karaoke/<song-id>/transcript.json` to verify LRC timestamps
     align with the isolated vocal onset and populate labeled `sections`
     (`intro`, `verse1`, `chorus1`, `verse2`, `bridge`, `outro`) in
     `sites/voice/dist/assets/<song-id>/manifest.json`.
   - Required manifest fields: `id`, `title`, `artist`, `duration`,
     `sourceUrl`, `frameRate`, `pitch`, and `cues` (plus optional `lyrics`:
     `"lyrics.lrc"` and `coachNote`).
   - Base the 8–12 coach cues in `sites/voice/dist/assets/<song-id>/cues.json`
     (`start`, `end`, `fragment`, `title`, and `text`) on the generated
     `workspace/karaoke/<song-id>/coach-analysis.json` rankings for `range`,
     `highNote`, `vibrato`, `agility`, `sustain`, and `dynamics`.
4. Open `#karaoke/<song-id>` locally. Review the full contour plus difficult
   runs, sustained notes, silence, loudness, vibrato, cue timing, synced
   lyrics, section cycle-looping, and local reference playback.
5. Run:

```bash
.venv/bin/python -m unittest discover -s tests -v
open-mic karaoke validate-site --site-dir sites/voice/dist
```

Do not deploy unless the user explicitly asks. The validator must report no
published audio and valid Song Lab manifests before publication.

## Practice & Song Lab Sites (`sites/guitar/` and `sites/voice/`)

`sites/guitar/` and `sites/voice/` are tracked directly in the main `open-mic`
Git repository. The compatibility symlink at `workspace/sites/voice` remains
ignored and exists only for older localhost URLs.

### Frontend Architecture (`sites/guitar/dist/` and `sites/voice/dist/`)

Both sites use a zero-bundler ES module setup rendered declaratively with
`htm/preact` (`https://cdn.jsdelivr.net/npm/htm@3.1.1/preact/standalone.mjs`):

- **No build step or vendoring**: Source files live directly under `dist/`. Each
  `dist/index.html` is a minimal semantic shell (`<main class="shell" id="app"></main>`)
  that loads `./css/styles.css`, declares a `<script type="importmap">` (with an
  `integrity` map and matching `<link rel="modulepreload" ... crossorigin="anonymous" referrerpolicy="no-referrer">`),
  and boots `<script type="module" src="./js/app.js"></script>`.
- **Syntax & site checks**: Validate JS syntax with `node --check` on modified
  modules, and run `open-mic karaoke validate-site --site-dir sites/voice/dist`
  whenever editing `sites/voice/dist/`.

#### Guitar Practice Room (`sites/guitar/dist/`)

- `index.html` & `css/styles.css`: App shell and standalone stylesheet.
- `js/curriculum-data.js`: Pure 5-phase / 17-lesson curriculum (`1.1`–`5.1`),
  tuning, and quiz question-bank data.
- `js/audio.js`: Web Audio acoustic guitar sample loader, Karplus-Strong synth
  fallback, and metronome click.
- `js/app.js`: Declarative `htm/preact` UI (`Topbar`, `Hero`, `Fretboard`,
  `LessonPractice`, `Curriculum`, `LessonDoc`, `App`), `#lesson-<id>` hash
  routing, explicit Lesson practice disclosure + start/stop controls (never
  auto-enable practice on load or lesson switch), Curriculum expand/collapse, and
  `localStorage` persistence (`guitar-room-complete` normalized
  `{ [lessonId]: boolean }` map and `guitar-room-hide-circles`).

#### Voice Practice Room & Song Lab (`sites/voice/dist/`)

- `index.html` & `css/styles.css`: App shell and standalone stylesheet.
- `js/practice-data.js`: Pure data and scale-plan helpers for the pre-vocal
  routine, all 7 workout lanes (`coach`, `daily`, `highNotes`, `vibrato`,
  `agility`, `riffsRuns`, `falsetto`), exercises, sessions, and teacher cues.
- `js/piano-audio.js`: Web Audio Salamander Grand Piano sampler, stereo room
  impulse convolver, additive synth fallback, and metronome click.
- `js/practice-room.js`: Declarative `htm/preact` `<PracticeRoom />` UI with
  `localStorage` persistence (`voice_preroutine_collapsed`,
  `voice_piano_scale_shifts`, `voice_piano_bpms`, `voice_piano_metronome`) and a
  `useRef`-driven 60fps `#timeSlider` / `#timeCurrent` loop while playing.
- `js/song-lab.js`: Declarative `htm/preact` `<SongLab />` UI (`assets/songs.json`
  and `assets/<song-id>/`) paired with imperative `useRef` boundaries for the
  10-second offscreen-tiled `<canvas id="pitchCanvas">` contour renderer,
  demand-driven 60fps playhead/readout updates (running only during active
  playback, coalesced on-demand when paused/scrubbing, and suspended on
  `#practice`), YouTube IFrame API host, and localhost `<audio>` + single
  `MediaElementAudioSourceNode` clock.
- `js/app.js`: Top-level `<App />` and `#practice` / `#karaoke/<song-id>` hash
  router keeping both route sections mounted in the DOM and toggled via `hidden`
  so YouTube and Web Audio media elements are not destroyed across route changes.

#### Local Preview

Serve from the repository root when previewing locally so `/sites/guitar/dist/`
and `/sites/voice/dist/` both work and Song Lab's `localReferencePath` URLs
under `/workspace/...` resolve on localhost:

```bash
.venv/bin/python3 -m http.server --bind 127.0.0.1
# Guitar: http://127.0.0.1:8000/sites/guitar/dist/#lesson-1.1
# Voice:  http://127.0.0.1:8000/sites/voice/dist/#practice
#         http://127.0.0.1:8000/sites/voice/dist/#karaoke/japanese-denim
```

#### Cloudflare Workers Static Assets Deployment

Each site includes a `wrangler.jsonc` (`guitar` ->
`guitar.apps.mauriciopoppe.com` in `sites/guitar/wrangler.jsonc`, and `voice` ->
`voice.apps.mauriciopoppe.com` in `sites/voice/wrangler.jsonc`) configured to
serve `./dist` via Cloudflare Workers Static Assets (no Worker JS entrypoint, so
static asset traffic is unmetered).

Authenticate once with `npx --yes wrangler@latest login` (or load `CLOUDFLARE_API_TOKEN` from your private secrets—see below), validate before
publishing, and deploy from the repository root only when explicitly requested:

```bash
open-mic karaoke validate-site --site-dir sites/voice/dist
npx --yes wrangler@latest deploy --cwd sites/guitar
npx --yes wrangler@latest deploy --cwd sites/voice
```

## Private Context & Secrets

Because this repository is open source, **never** commit Drive IDs, tokens, account IDs, or private folder URLs to tracked files. Keep private deployment instructions and credentials in one of two places:

1. **Local gitignored override (optional)**: `workspace/AGENTS.local.md` or `.env.local` (both `workspace/` and `.env.*` are ignored by Git).
2. **Private Google Drive `self` folder (for fresh cloud environments)**: If no local secrets exist and the `gdrive` CLI is connected, search Drive for `open-mic-private.md` (in `self/source/agent-context/`) and `personal-sites.env` (in `self/secrets/`). Download secrets only to gitignored `workspace/secrets/` or `/tmp/` at execution time, source them in-shell, and never print or commit their values.
