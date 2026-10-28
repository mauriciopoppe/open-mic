#!/usr/bin/env python3
"""Analyze and locally align MIDI note timing against an audio recording."""

import csv
from pathlib import Path

import librosa
import mido
import numpy as np
from scipy.ndimage import gaussian_filter1d, median_filter


def normalize(values: np.ndarray) -> np.ndarray:
    values = values.astype(float)
    values -= np.median(values)
    scale = np.percentile(np.abs(values), 95)
    return values / max(scale, 1e-9)


def midi_note_events(path: Path, bpm: float | None = None):
    midi = mido.MidiFile(path)
    if bpm is None:
        tempo = next(
            (message.tempo for track in midi.tracks for message in track if message.type == "set_tempo"),
            mido.bpm2tempo(120),
        )
    else:
        tempo = mido.bpm2tempo(bpm)

    events = []
    for track_index, track in enumerate(midi.tracks):
        tick = 0
        for event_index, message in enumerate(track):
            tick += message.time
            if message.type in {"note_on", "note_off"}:
                seconds = mido.tick2second(tick, midi.ticks_per_beat, tempo)
                events.append((track_index, event_index, tick, seconds, message))
    return midi, tempo, events


def onset_signal(audio_path: Path, hop_length: int):
    audio, sample_rate = librosa.load(audio_path, sr=22050, mono=True)
    onset = librosa.onset.onset_strength(
        y=audio, sr=sample_rate, hop_length=hop_length, aggregate=np.mean
    )
    onset = normalize(onset)
    onset = np.maximum(onset, 0)
    return onset, sample_rate, len(audio) / sample_rate


def midi_signal(events, frame_count: int, seconds_per_frame: float):
    signal = np.zeros(frame_count, dtype=float)
    for _, _, _, seconds, message in events:
        if message.type == "note_on" and message.velocity > 0:
            frame = int(round(seconds / seconds_per_frame))
            if 0 <= frame < frame_count:
                signal[frame] += max(0.25, message.velocity / 127.0)
    # A 20 ms blur models the fact that an acoustic piano attack occupies more
    # than one analysis frame and makes the two signals easier to compare.
    signal = gaussian_filter1d(signal, sigma=1.0)
    return normalize(signal)


def local_lag(audio, midi, window_frames: int, search_frames: int):
    """Return audio-minus-MIDI lag and a correlation score for every frame."""
    n = min(len(audio), len(midi))
    audio, midi = audio[:n], midi[:n]
    half = max(2, window_frames // 2)
    lags = np.arange(-search_frames, search_frames + 1)
    scores = np.full((len(lags), n), -np.inf)

    for row, lag in enumerate(lags):
        shifted = np.zeros(n)
        if lag >= 0:
            # Positive lag means the matching audio event occurs later than
            # the MIDI event, so compare audio[t + lag] with MIDI[t].
            shifted[: n - lag] = audio[lag:]
        else:
            shifted[-lag:] = audio[: n + lag]
        product = shifted * midi
        scores[row] = np.convolve(product, np.ones(window_frames), mode="same")

    best = np.argmax(scores, axis=0)
    best_scores = scores[best, np.arange(n)]
    second_scores = np.partition(scores, -2, axis=0)[-2]
    confidence = best_scores - second_scores
    offset_frames = lags[best].astype(float)

    # Local estimates can be ambiguous during silence or repeated patterns.
    # Suppress isolated jumps, then smooth only modestly so real drift remains.
    offset_frames = median_filter(offset_frames, size=window_frames // 2 * 2 + 1)
    offset_frames = gaussian_filter1d(offset_frames, sigma=max(1.0, window_frames / 8))
    return offset_frames, confidence


def write_report(path: Path, offsets, confidence, frame_seconds):
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(["time_sec", "offset_ms_audio_minus_midi", "confidence"])
        for frame, (offset, score) in enumerate(zip(offsets, confidence)):
            writer.writerow([f"{frame * frame_seconds:.3f}", f"{offset * frame_seconds * 1000:.3f}", f"{score:.6f}"])


def warp_midi(input_path: Path, output_path: Path, events, midi, tempo, offsets, frame_seconds):
    def offset_at(seconds):
        frame = np.clip(seconds / frame_seconds, 0, len(offsets) - 1)
        return float(np.interp(frame, np.arange(len(offsets)), offsets)) * frame_seconds

    event_offsets = {
        (track_index, event_index): offset_at(seconds)
        for track_index, event_index, _, seconds, message in events
        if message.type in {"note_on", "note_off"}
    }

    for track_index, track in enumerate(midi.tracks):
        absolute_tick = 0
        rewritten = []
        for event_index, message in enumerate(track):
            absolute_tick += message.time
            key = (track_index, event_index)
            if key in event_offsets:
                original_seconds = mido.tick2second(absolute_tick, midi.ticks_per_beat, tempo)
                corrected_seconds = max(0.0, original_seconds + event_offsets[key])
                corrected_tick = round(mido.second2tick(corrected_seconds, midi.ticks_per_beat, tempo))
                rewritten.append((corrected_tick, event_index, message))
            else:
                rewritten.append((absolute_tick, event_index, message))

        rewritten.sort(key=lambda item: (item[0], 0 if item[2].type == "note_off" else 1, item[1]))
        new_track = mido.MidiTrack()
        previous_tick = 0
        for tick, _, message in rewritten:
            new_track.append(message.copy(time=max(0, tick - previous_tick)))
            previous_tick = tick
        track.clear()
        track.extend(new_track)

    output_path.parent.mkdir(parents=True, exist_ok=True)
    midi.save(output_path)


def align_midi(
    audio_path: Path,
    midi_path: Path,
    output_midi: Path | None = None,
    report: Path = Path("workspace/midi/alignment_report.csv"),
    bpm: float | None = None,
    frame_ms: float = 10.0,
    window_ms: float = 1000.0,
    search_ms: float = 150.0,
) -> None:
    hop_length = max(1, round(22050 * frame_ms / 1000.0))
    frame_seconds = hop_length / 22050.0
    audio, _, audio_duration = onset_signal(audio_path, hop_length)
    midi, tempo, events = midi_note_events(midi_path, bpm)
    duration = max(audio_duration, max((event[3] for event in events), default=0))
    frame_count = max(len(audio), round(duration / frame_seconds) + 1)
    audio = np.pad(audio, (0, max(0, frame_count - len(audio))))
    midi_onsets = midi_signal(events, frame_count, frame_seconds)
    offsets, confidence = local_lag(
        audio,
        midi_onsets,
        max(3, round(window_ms / frame_ms)),
        max(1, round(search_ms / frame_ms)),
    )
    write_report(report, offsets, confidence, frame_seconds)

    reliable = confidence > np.percentile(confidence, 60)
    print(f"Audio duration: {audio_duration:.3f}s")
    print(f"Analysis resolution: {frame_seconds * 1000:.2f}ms")
    print(f"Median offset: {np.median(offsets[reliable]) * frame_seconds * 1000:.2f}ms audio-minus-MIDI")
    print(f"Offset range: {np.percentile(offsets[reliable], 5) * frame_seconds * 1000:.2f}ms to {np.percentile(offsets[reliable], 95) * frame_seconds * 1000:.2f}ms")
    print(f"Wrote report: {report}")

    if output_midi:
        warp_midi(midi_path, output_midi, events, midi, tempo, offsets, frame_seconds)
        print(f"Wrote aligned MIDI: {output_midi}")
