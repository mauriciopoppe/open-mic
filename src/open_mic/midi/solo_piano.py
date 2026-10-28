#!/usr/bin/env python3
"""
create_solo_piano.py

Synthesizes a cohesive Solo Piano arrangement of a song by combining:
1. Left Hand: Bass roots and rhythmic foundation (Octaves 1-2, solid velocity).
2. Right Hand: Harmonic chord voicings (Octaves 3-4, gentle accompaniment velocity).
3. Lead Voice: Vocal melody & guitar licks voiced as the top singing note (Octaves 4-5, prominent velocity).
4. Sustain Pedaling: Automatic CC 64 pedal automation synced to measure and chord transitions.
"""

import argparse
import os
import pretty_midi
import librosa
import numpy as np

def parse_args():
    parser = argparse.ArgumentParser(description="Create a humanized Solo Piano MIDI arrangement.")
    parser.add_argument(
        "--midi-dir",
        default="workspace/midi",
        help="Directory containing individual HQ stem MIDI files"
    )
    parser.add_argument(
        "--bpm",
        type=float,
        default=107.67,
        help="Song tempo (BPM)"
    )
    parser.add_argument(
        "--output",
        default="workspace/midi/solo_piano.mid",
        help="Output MIDI path"
    )
    return parser.parse_args()

def main():
    args = parse_args()
    bpm = args.bpm

    vocal_path = os.path.join(args.midi_dir, "Vocals.mid")
    guitar_path = os.path.join(args.midi_dir, "Main Guitar.mid")
    bass_path = os.path.join(args.midi_dir, "Bass.mid")
    piano_path = os.path.join(args.midi_dir, "Piano.mid")

    solo_piano = pretty_midi.PrettyMIDI(initial_tempo=bpm)
    piano_inst = pretty_midi.Instrument(program=0, is_drum=False, name="Acoustic Grand Piano")

    # 1. Left Hand: Bass Roots
    if os.path.exists(bass_path):
        b_mid = pretty_midi.PrettyMIDI(bass_path)
        if b_mid.instruments:
            for n in b_mid.instruments[0].notes:
                pitch = n.pitch
                while pitch > 55: pitch -= 12
                while pitch < 28: pitch += 12
                piano_inst.notes.append(pretty_midi.Note(
                    velocity=int(min(115, max(75, n.velocity * 1.1))),
                    pitch=pitch,
                    start=n.start,
                    end=n.end
                ))

    # 2. Right Hand Chords: Piano & Guitar
    for path in [piano_path, guitar_path]:
        if os.path.exists(path):
            mid = pretty_midi.PrettyMIDI(path)
            if mid.instruments:
                for n in mid.instruments[0].notes:
                    if 45 <= n.pitch <= 72:
                        piano_inst.notes.append(pretty_midi.Note(
                            velocity=int(60 + (n.velocity / 127.0) * 18),
                            pitch=n.pitch,
                            start=n.start,
                            end=n.end
                        ))

    # 3. Soprano Melody: Vocals
    if os.path.exists(vocal_path):
        v_mid = pretty_midi.PrettyMIDI(vocal_path)
        if v_mid.instruments:
            for n in v_mid.instruments[0].notes:
                pitch = n.pitch
                while pitch < 60: pitch += 12
                piano_inst.notes.append(pretty_midi.Note(
                    velocity=int(95 + (n.velocity / 127.0) * 20),
                    pitch=pitch,
                    start=n.start,
                    end=n.end
                ))

    # 4. Sustain Pedal Automation (CC 64)
    grid_bar = (60.0 / bpm) * 4
    total_time = max(n.end for n in piano_inst.notes) if piano_inst.notes else 300.0

    t = 0.0
    while t < total_time:
        piano_inst.control_changes.append(pretty_midi.ControlChange(number=64, value=120, time=t + 0.05))
        piano_inst.control_changes.append(pretty_midi.ControlChange(number=64, value=0, time=max(0, t + grid_bar - 0.08)))
        t += grid_bar

    piano_inst.notes.sort(key=lambda n: n.start)
    piano_inst.control_changes.sort(key=lambda cc: cc.time)
    solo_piano.instruments.append(piano_inst)

    os.makedirs(os.path.dirname(os.path.abspath(args.output)), exist_ok=True)
    solo_piano.write(args.output)
    print(f"Successfully generated Solo Piano arrangement: {args.output}")

if __name__ == "__main__":
    main()
