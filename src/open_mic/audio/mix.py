#!/usr/bin/env python3
"""
Mixes Demucs stems with a custom guitar recording (or other instrument).
Aligns audio based on lead-in offset, boosts guitar volume, prevents clipping,
and exports the result to WAV.
"""

import argparse
import os
import sys
import numpy as np
import soundfile as sf
import librosa

def parse_args():
    parser = argparse.ArgumentParser(description="Mix separated stems with custom recorded audio.")
    parser.add_argument(
        "--stem-dir",
        required=True,
        help="Directory containing demucs separated stem mp3 files"
    )
    parser.add_argument(
        "--recording",
        required=True,
        help="Path to custom recording audio file (.m4a, .wav, .mp3)"
    )
    parser.add_argument(
        "--exclude-stem",
        default="guitar",
        help="Stem to replace (e.g. guitar, vocals)"
    )
    parser.add_argument(
        "--offset",
        type=float,
        default=0.0,
        help="Offset in seconds to trim from the start of the recording (default: 0)"
    )
    parser.add_argument(
        "--gain-db",
        type=float,
        default=0.0,
        help="Volume boost in dB for the custom recording (default: 0 dB)"
    )
    parser.add_argument(
        "--output",
        required=True,
        help="Output .wav path"
    )
    parser.add_argument(
        "--sample-rate",
        type=int,
        default=44100,
        help="Sample rate for output (default: 44100)"
    )
    return parser.parse_args()

def main():
    args = parse_args()
    sr = args.sample_rate

    print(f"Loading stems from: {args.stem_dir}")
    all_stems = ["bass", "drums", "guitar", "other", "piano", "vocals"]
    included_stems = [s for s in all_stems if s != args.exclude_stem]

    stem_audios = []
    max_len = 0
    for s in included_stems:
        stem_path = os.path.join(args.stem_dir, f"{s}.mp3")
        if not os.path.exists(stem_path):
            print(f"Warning: stem file not found: {stem_path}")
            continue
        audio, _ = librosa.load(stem_path, sr=sr, mono=False)
        if audio.ndim == 1:
            audio = np.stack([audio, audio])
        stem_audios.append(audio)
        max_len = max(max_len, audio.shape[1])

    if not stem_audios:
        print("Error: No stem audio loaded.")
        sys.exit(1)

    # Pad stems to same length and sum
    backing = np.zeros((2, max_len), dtype=np.float32)
    for audio in stem_audios:
        backing[:, :audio.shape[1]] += audio

    print(f"Backing mix created (duration: {max_len / sr:.2f}s).")

    # Load custom recording
    print(f"Loading custom recording: {args.recording}")
    user_audio, _ = librosa.load(args.recording, sr=sr, mono=False)
    if user_audio.ndim == 1:
        user_audio = np.stack([user_audio, user_audio])

    # Apply offset
    offset_samples = int(args.offset * sr)
    user_aligned = np.zeros_like(backing)

    if offset_samples < user_audio.shape[1]:
        available_samples = user_audio.shape[1] - offset_samples
        n_samples = min(backing.shape[1], available_samples)
        user_aligned[:, :n_samples] = user_audio[:, offset_samples : offset_samples + n_samples]

    # Apply volume boost
    gain_linear = 10.0 ** (args.gain_db / 20.0)
    print(f"Applying gain: +{args.gain_db:.1f} dB ({gain_linear:.2f}x multiplier)")
    user_boosted = user_aligned * gain_linear

    # Combine backing + custom recording
    combined = backing + user_boosted

    # Check peak and normalize if clipping
    peak = np.max(np.abs(combined))
    print(f"Combined peak level before limiter: {peak:.3f} ({20*np.log10(max(peak, 1e-6)):.2f} dB)")
    if peak > 0.99:
        print("Scaling to 0.98 peak to prevent clipping...")
        combined = combined * (0.98 / peak)

    # Export WAV
    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    sf.write(args.output, combined.T, sr, subtype="PCM_16")
    print(f"Successfully exported: {args.output}")

if __name__ == "__main__":
    main()
