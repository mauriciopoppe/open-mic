#!/usr/bin/env python3
"""Quantize MIDI note events while preserving the source file."""

from pathlib import Path

import mido


def quantize_tick(tick: float, ticks_per_beat: int, subdivision: int) -> int:
    grid = ticks_per_beat / subdivision
    return max(0, int(round(tick / grid) * grid))


def quantize_midi(
    input_path: Path,
    output_path: Path,
    source_bpm: float,
    target_bpm: float,
    subdivision: int | None,
) -> None:
    midi = mido.MidiFile(input_path)
    stretch = target_bpm / source_bpm
    events = []

    for track_index, track in enumerate(midi.tracks):
        absolute_tick = 0
        for event_index, message in enumerate(track):
            absolute_tick += message.time

            stretched_tick = absolute_tick * stretch

            if message.type == "set_tempo":
                if absolute_tick == 0:
                    message = message.copy(tempo=mido.bpm2tempo(target_bpm))
                events.append((track_index, int(round(stretched_tick)), event_index, message))
            elif message.type in {"note_on", "note_off"}:
                note_tick = (
                    quantize_tick(stretched_tick, midi.ticks_per_beat, subdivision)
                    if subdivision is not None
                    else int(round(stretched_tick))
                )
                events.append((track_index, note_tick, event_index, message))
            else:
                events.append((track_index, int(round(stretched_tick)), event_index, message))

    output_tracks = [[] for _ in midi.tracks]
    for track_index, absolute_tick, event_index, message in events:
        output_tracks[track_index].append((absolute_tick, event_index, message))

    for track_index, track_events in enumerate(output_tracks):
        # At the same tick, release notes before starting new notes.
        track_events.sort(
            key=lambda item: (
                item[0],
                0 if item[2].type == "note_off" else 1 if item[2].type == "note_on" else 2,
                item[1],
            )
        )
        new_track = mido.MidiTrack()
        previous_tick = 0
        for absolute_tick, _, message in track_events:
            delta = max(0, absolute_tick - previous_tick)
            new_track.append(message.copy(time=delta))
            previous_tick = absolute_tick
        midi.tracks[track_index] = new_track

    output_path.parent.mkdir(parents=True, exist_ok=True)
    midi.save(output_path)
