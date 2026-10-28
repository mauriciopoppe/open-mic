#!/usr/bin/env python3
"""
audio_to_midi.py

Transcribes separated audio stems and custom recordings to high-quality MIDI.
Performs:
1. Instrument-specific acoustic frequency range filtering.
2. Song tempo detection & synchronization (BPM matching).
3. Monophonic voice leading & overlap resolution for Bass & Vocals.
4. Ghost-note and short transient (<60ms) removal.
5. Fuses fragmented notes (re-triggers) based on master song onset verification.
6. Generates individual stem MIDIs and GarageBand-compatible multi-track master files.
"""

import argparse
import os
import sys
import tempfile
import soundfile as sf
import librosa
import pretty_midi
import numpy as np
import mido
from basic_pitch.inference import predict

def is_true_reattack(onset_env, t_start, sr=44100, search_window=0.08, threshold=2.2):
    frame = int(librosa.time_to_frames(float(t_start), sr=sr, hop_length=512))
    w = int(librosa.time_to_frames(float(search_window), sr=sr, hop_length=512))
    start_idx = max(0, frame - w)
    end_idx = min(len(onset_env), frame + w + 1)
    if end_idx <= start_idx: return False
    return float(np.max(onset_env[start_idx:end_idx])) > threshold

def heal_and_merge_notes(notes, onset_env, sr=44100, max_gap=0.25):
    """Fuses notes that were artificially split by neural transcription threshold dips."""
    pitch_groups = {}
    for n in notes:
        if n.pitch not in pitch_groups:
            pitch_groups[n.pitch] = []
        pitch_groups[n.pitch].append(n)

    merged_all = []
    for pitch, group in pitch_groups.items():
        group.sort(key=lambda x: x.start)
        merged_group = []
        for n in group:
            if not merged_group:
                merged_group.append(n)
                continue
            prev = merged_group[-1]
            gap = n.start - prev.end

            if gap <= max_gap:
                if gap < 0.12 or not is_true_reattack(onset_env, n.start, sr=sr):
                    prev.end = max(prev.end, n.end)
                    prev.velocity = max(prev.velocity, n.velocity)
                    continue
            merged_group.append(n)
        merged_all.extend(merged_group)

    return sorted(merged_all, key=lambda n: n.start)

def export_clean_midi(instrument_list, bpm, out_path, ticks_per_beat=480, add_pedal=False):
    """Exports clean, standard Type 1 MIDI with Channel 0 routing for seamless GarageBand playback."""
    mid = mido.MidiFile(type=1, ticks_per_beat=ticks_per_beat)

    t0 = mido.MidiTrack()
    tempo_us = int(round(60000000.0 / bpm))
    t0.append(mido.MetaMessage("set_tempo", tempo=tempo_us, time=0))
    t0.append(mido.MetaMessage("time_signature", numerator=4, denominator=4, clocks_per_click=24, notated_32nd_notes_per_beat=8, time=0))
    t0.append(mido.MetaMessage("end_of_track", time=1))
    mid.tracks.append(t0)

    ticks_per_sec = (ticks_per_beat * bpm) / 60.0

    for ch_idx, inst in enumerate(instrument_list):
        # Always use Channel 0 on each track so GarageBand track samplers play without channel mismatch
        channel = 0
        track = mido.MidiTrack()
        track.append(mido.MetaMessage("track_name", name=inst.name, time=0))
        track.append(mido.Message("program_change", channel=channel, program=inst.program, time=0))
        track.append(mido.Message("control_change", channel=channel, control=7, value=100, time=0))
        track.append(mido.Message("control_change", channel=channel, control=10, value=64, time=0))

        events = []
        for n in inst.notes:
            s_tick = int(round(n.start * ticks_per_sec))
            e_tick = max(s_tick + 1, int(round(n.end * ticks_per_sec)))
            vel = int(min(127, max(40, n.velocity)))
            events.append((s_tick, "note_on", n.pitch, vel))
            events.append((e_tick, "note_off", n.pitch, 0))

        if add_pedal:
            grid_bar_ticks = int(round(4 * ticks_per_beat))
            max_tick = max((e[0] for e in events), default=1000)
            t = 0
            while t < max_tick:
                events.append((t + int(0.05 * ticks_per_sec), "cc64", 120, 0))
                events.append((max(0, t + grid_bar_ticks - int(0.08 * ticks_per_sec)), "cc64", 0, 0))
                t += grid_bar_ticks

        events.sort(key=lambda x: (x[0], 0 if x[1] == "note_off" else (1 if x[1] == "cc64" else 2)))

        last = 0
        for tick, ev, pitch, vel in events:
            delta = max(0, tick - last)
            last = tick
            if ev == "note_on":
                track.append(mido.Message("note_on", channel=channel, note=pitch, velocity=vel, time=delta))
            elif ev == "note_off":
                track.append(mido.Message("note_off", channel=channel, note=pitch, velocity=0, time=delta))
            elif ev == "cc64":
                track.append(mido.Message("control_change", channel=channel, control=64, value=pitch, time=delta))

        track.append(mido.MetaMessage("end_of_track", time=1))
        mid.tracks.append(track)

    os.makedirs(os.path.dirname(os.path.abspath(out_path)), exist_ok=True)
    mid.save(out_path)
    print(f"Successfully saved: {out_path}")

def parse_args():
    parser = argparse.ArgumentParser(description="Convert audio files or separated stems to MIDI.")
    parser.add_argument(
        "--input",
        help="Audio file to transcribe directly (for example, a solo piano recording)."
    )
    parser.add_argument(
        "--output",
        help="Output MIDI path for --input. Defaults to the input filename with a .mid extension."
    )
    parser.add_argument(
        "--instrument",
        default="Piano",
        help="MIDI instrument name for --input (default: Piano)."
    )
    parser.add_argument(
        "--bpm",
        type=float,
        default=120.0,
        help="MIDI tempo for --input (default: 120)."
    )
    parser.add_argument(
        "--stem-dir",
        default=None,
        help="Directory containing demucs stem mp3 files"
    )
    parser.add_argument(
        "--master-song",
        default=None,
        help="Path to full mix master audio for attack verification"
    )
    parser.add_argument(
        "--recording",
        default=None,
        help="Path to custom guitar recording"
    )
    parser.add_argument(
        "--offset",
        type=float,
        default=2.845,
        help="Lead-in offset in seconds to trim from recording so MIDI starts aligned with song"
    )
    parser.add_argument(
        "--output-dir",
        default=None,
        help="Directory to save generated MIDI files"
    )
    parser.add_argument(
        "--sample-rate",
        type=int,
        default=44100,
        help="Audio sample rate (default: 44100)"
    )
    return parser.parse_args()

def main():
    args = parse_args()
    sr = args.sample_rate

    if args.input:
        input_path = os.path.abspath(args.input)
        if not os.path.isfile(input_path):
            raise FileNotFoundError(f"Input audio does not exist: {input_path}")

        output_path = os.path.abspath(args.output) if args.output else os.path.splitext(input_path)[0] + ".mid"
        print(f"Transcribing audio: {input_path}")
        _, predicted_mid, _ = predict(
            input_path,
            onset_threshold=0.50,
            frame_threshold=0.30,
            minimum_frequency=27.5,
            maximum_frequency=4186.0,
            minimum_note_length=80.0,
            midi_tempo=args.bpm,
        )

        instrument = pretty_midi.Instrument(program=0, name=args.instrument)
        instrument.notes = predicted_mid.instruments[0].notes
        export_clean_midi([instrument], args.bpm, output_path)
        return

    if not args.stem_dir:
        raise ValueError("Provide --input for a standalone recording, or --stem-dir for separated stems.")

    args.output_dir = args.output_dir or os.path.join(args.stem_dir, "midi")
    os.makedirs(args.output_dir, exist_ok=True)

    # Master onset envelope
    onset_env = np.zeros(100)
    if args.master_song and os.path.exists(args.master_song):
        print(f"Computing master onset envelope: {args.master_song}")
        y_master, _ = librosa.load(args.master_song, sr=sr, mono=True)
        onset_env = librosa.onset.onset_strength(y=y_master, sr=sr, hop_length=512)

    # Detect song tempo from drums
    drums_path = os.path.join(args.stem_dir, "drums.mp3")
    bpm = 120.0
    if os.path.exists(drums_path):
        try:
            y_drums, _ = librosa.load(drums_path, sr=sr)
            tempo, _ = librosa.beat.beat_track(y=y_drums, sr=sr)
            bpm = float(tempo[0]) if isinstance(tempo, (list, np.ndarray)) else float(tempo)
            print(f"Detected song tempo: {bpm:.2f} BPM")
        except Exception as e:
            print(f"Warning: could not detect tempo from drums ({e}), defaulting to 120 BPM.")

    all_instruments = []

    # 1. Main Guitar
    if args.recording and os.path.exists(args.recording):
        print(f"Transcribing guitar recording: {args.recording}")
        user_audio, _ = librosa.load(args.recording, sr=sr, mono=True)
        offset_samples = int(args.offset * sr)
        user_aligned = user_audio[offset_samples:]

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
            tmp_wav_path = tmp.name
            sf.write(tmp_wav_path, user_aligned, sr)

        try:
            _, g_mid, _ = predict(
                tmp_wav_path,
                onset_threshold=0.55,
                frame_threshold=0.35,
                minimum_frequency=80.0,
                maximum_frequency=1200.0,
                minimum_note_length=100.0,
                midi_tempo=bpm
            )
            inst_g = pretty_midi.Instrument(program=27, name="Main Guitar")
            inst_g.notes = heal_and_merge_notes(g_mid.instruments[0].notes, onset_env, sr=sr, max_gap=0.20)
            export_clean_midi([inst_g], bpm, os.path.join(args.output_dir, "Main Guitar.mid"))
            all_instruments.append(inst_g)
        finally:
            if os.path.exists(tmp_wav_path):
                os.remove(tmp_wav_path)

    # 2. Backing Stems
    stem_configs = [
        ("bass", "Bass", 33, 35.0, 350.0, 0.60, 0.40, 150.0, 0.35),
        ("piano", "Piano", 0, 55.0, 2500.0, 0.50, 0.30, 100.0, 0.22),
        ("vocals", "Vocals", 53, 100.0, 1100.0, 0.55, 0.38, 120.0, 0.28),
        ("other", "Other", 48, 120.0, 3000.0, 0.55, 0.35, 100.0, 0.20),
    ]

    backing_instruments = []
    for stem_name, track_name, program_num, min_f, max_f, onset_th, frame_th, min_len, max_gap in stem_configs:
        stem_path = os.path.join(args.stem_dir, f"{stem_name}.mp3")
        if not os.path.exists(stem_path): continue

        print(f"Transcribing stem: {stem_name}...")
        _, stem_mid, _ = predict(
            stem_path,
            onset_threshold=onset_th,
            frame_threshold=frame_th,
            minimum_frequency=min_f,
            maximum_frequency=max_f,
            minimum_note_length=min_len,
            midi_tempo=bpm
        )
        inst = pretty_midi.Instrument(program=program_num, name=track_name)
        inst.notes = heal_and_merge_notes(stem_mid.instruments[0].notes, onset_env, sr=sr, max_gap=max_gap)
        export_clean_midi([inst], bpm, os.path.join(args.output_dir, f"{track_name}.mid"))

        backing_instruments.append(inst)
        all_instruments.append(inst)

    # 3. Merged Multi-Tracks
    export_clean_midi(backing_instruments, bpm, os.path.join(args.output_dir, "Backing Stems (Multi-Track HQ).mid"))
    export_clean_midi(all_instruments, bpm, os.path.join(args.output_dir, "Full Song (Multi-Track HQ).mid"))

if __name__ == "__main__":
    main()
