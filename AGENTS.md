# Open Mic Backing Tracks & Audio Workflows

## Project Overview
This repository provides tooling and workflows to download songs, split them into stems (vocals, drums, bass, guitar, piano, other) using Demucs, and produce custom backing tracks for open mic / karaoke performances or custom guitar play-along mixes.

## Environment & Virtualenv
- Python Virtual Environment: Located at `.venv/` (activate with `source .venv/bin/activate`).
- Python version / dependencies: `.venv/bin/python3` (includes `demucs`, `yt-dlp`, `torch`, `torchaudio`, `soundfile`, `numpy`, `scipy`, `librosa`).
- System tools: `ffmpeg`, `ffprobe`, `rubberband`, `jq`.

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

### 5. Audio-to-MIDI Transcription (`open-mic transcribe-midi`)
Converts audio stems and custom recordings to high-quality MIDI files using Spotify's Basic Pitch and PrettyMIDI:
- **Per-stem acoustic filters**: Low/high frequency limits tailored to each instrument's physical range (e.g. Bass 35–350Hz, Vocals 100–1100Hz).
- **Tempo sync**: Automatic BPM detection from drums (`107.67 BPM` for *Meet Me in Amsterdam*) so the MIDI snaps to DAW musical measure grids.
- **Monophonic cleanup**: Truncates unnatural overlapping chord notes on bass and lead vocals.
- **Ghost note filter**: Eliminates micro-transients (<60ms) and low-velocity room/strum bleed.
```bash
open-mic transcribe-midi \
  --stem-dir "workspace/stems/htdemucs_6s/<song_title>" \
  --recording "/path/to/recording.m4a" \
  --offset 2.845 \
  --output-dir "/path/to/output_dir"
```
Outputs:
- Individual stem files: `Main Guitar.mid`, `Bass.mid`, `Piano.mid`, `Vocals.mid`, `Other.mid`.
### 6. Solo Piano Arrangement (`open-mic solo-piano`)
Synthesizes a cohesive solo piano piece from the stem MIDI tracks:
- **Left Hand**: Bassline root notes and rhythmic pulses (Octaves 1–2, solid dynamics).
- **Right Hand Chords**: Harmonic pad and chord voicings from piano & guitar (Octaves 3–4, gentle accompaniment dynamics).
- **Top Singing Melody**: Vocal lead line and melodic hooks voiced on the highest notes (Octaves 4–5, prominent singing dynamics).
- **Sustain Pedaling**: Automatic `CC 64` pedaling synchronized with measure transitions for realistic acoustic grand piano resonance.
```bash
open-mic solo-piano \
  --midi-dir "/path/to/HQ_MIDI" \
  --bpm 107.67 \
  --output "/path/to/Solo_Piano.mid"
```

## Known Issues & Troubleshooting
- **yt-dlp HTTP 403 Forbidden**: Update `yt-dlp` in `requirements.txt` to the latest release and run `pip install -U yt-dlp`.
- **Virtualenv Activation**: Always activate `source .venv/bin/activate` before running Python scripts or Demucs commands.

## Script organization
- Audio and MIDI implementations live under `src/open_mic/`; use the `open-mic` command for all workflows.


