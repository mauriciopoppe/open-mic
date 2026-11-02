import math
import sys
import tempfile
import unittest
from pathlib import Path

import numpy as np
import soundfile as sf

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from open_mic.karaoke.prepare import bridge_short_gaps, correct_octave_jumps, extend_note_fades, extract_pitch_frames
from open_mic.karaoke.compare import _rms_strength, disagreement
from open_mic.karaoke.compare_separators import fuse
from open_mic.karaoke.coach_analyze import analyze
from open_mic.karaoke.consensus import bridge_phrase_gaps, merge_pitch_tracks, smooth_strength, vibrato_depth
from open_mic.karaoke.validate_site import published_audio_files, song_asset_errors


class PitchExtractionTests(unittest.TestCase):
    def write_audio(self, directory: Path, samples: np.ndarray, sample_rate: int = 16000) -> Path:
        path = directory / "test.wav"
        sf.write(path, samples, sample_rate)
        return path

    def test_extracts_stable_a3(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            sr = 16000
            time = np.arange(sr * 2) / sr
            audio = 0.4 * np.sin(2 * np.pi * 220.0 * time)
            frames, duration = extract_pitch_frames(self.write_audio(root, audio), frames_per_second=40)
            voiced = [frame["midi"] for frame in frames if frame["voiced"]]
            self.assertAlmostEqual(float(np.median(voiced)), 57.0, delta=0.25)
            self.assertAlmostEqual(duration, 2.0, delta=0.01)
            self.assertLess(float(np.std(voiced)), 0.1)

    def test_silence_is_unvoiced(self):
        with tempfile.TemporaryDirectory() as directory:
            frames, _ = extract_pitch_frames(
                self.write_audio(Path(directory), np.zeros(16000)), frames_per_second=40
            )
            self.assertFalse(any(frame["voiced"] for frame in frames))

    def test_respects_configured_vocal_range(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            sr = 16000
            time = np.arange(sr) / sr
            audio = 0.4 * np.sin(2 * np.pi * 880.0 * time)
            frames, _ = extract_pitch_frames(
                self.write_audio(root, audio), frames_per_second=40, maximum_note="C5"
            )
            voiced = [frame["midi"] for frame in frames if frame["voiced"]]
            self.assertTrue(all(value <= 72.1 for value in voiced))

    def test_short_gap_is_interpolated(self):
        values = np.array([60.0, 60.5, math.nan, math.nan, 62.0, math.nan, math.nan, math.nan, 64.0])
        result = bridge_short_gaps(values, max_frames=2)
        self.assertFalse(np.isnan(result[2:4]).any())
        self.assertTrue(np.isnan(result[5:8]).all())

    def test_octave_tracking_resets_after_silence(self):
        values = np.array([60.0, 60.4, math.nan, 71.0, 72.0])
        result = correct_octave_jumps(values)
        self.assertAlmostEqual(result[3], 71.0)

    def test_strength_tracks_vocal_energy(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            sr = 16000
            time = np.arange(sr) / sr
            quiet = 0.08 * np.sin(2 * np.pi * 220.0 * time)
            loud = 0.65 * np.sin(2 * np.pi * 220.0 * time)
            frames, _ = extract_pitch_frames(self.write_audio(root, np.concatenate([quiet, loud])))
            strengths = [frame["strength"] for frame in frames if frame["voiced"]]
            midpoint = len(strengths) // 2
            self.assertGreater(float(np.median(strengths[midpoint:])), float(np.median(strengths[:midpoint])) + 0.4)

    def test_note_fade_extends_pitch_and_tapers_strength(self):
        midi, strength = extend_note_fades(
            np.array([60.0, 60.0, math.nan, math.nan, math.nan]),
            np.array([0.8, 0.8, 0.0, 0.0, 0.0]),
            max_frames=2,
        )
        self.assertTrue(np.allclose(midi[:4], [60.0, 60.0, 60.0, 60.0]))
        self.assertGreater(strength[2], strength[3])


class SiteAudioValidationTests(unittest.TestCase):
    def test_finds_audio_but_ignores_metadata(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            (root / "pitch.json").write_text("{}")
            self.assertEqual(published_audio_files(root), [])
            audio = root / "song.mp3"
            audio.write_bytes(b"not real audio")
            self.assertEqual(published_audio_files(root), [audio])

    def test_validates_manifest_backed_song_assets(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            song = root / "assets" / "example-song"
            song.mkdir(parents=True)
            (song / "pitch.json").write_text('{"frames":[]}')
            (song / "cues.json").write_text('{"cues":[]}')
            (song / "manifest.json").write_text(
                '{"id":"example-song","title":"Example","artist":"Singer",'
                '"sourceUrl":"https://example.com","duration":10,"frameRate":100,'
                '"pitch":"pitch.json","cues":"cues.json",'
                '"sections":{"full":{"start":0,"end":10}}}'
            )
            self.assertEqual(song_asset_errors(root), [])
            (song / "cues.json").unlink()
            self.assertIn("referenced cues file is missing", song_asset_errors(root)[0])


class TrackerComparisonTests(unittest.TestCase):
    def test_coach_analysis_ranks_measured_passages(self):
        frames = []
        for index in range(200):
            time = index / 100
            midi = 60 + (index % 8) * 0.5 if time >= 1 else 60
            frames.append({"time": time, "midi": midi, "voiced": True, "strength": .7, "vibratoDepth": 20 if time < 1 else 0})
        transcript = {"segments": [{"start": 0, "end": 1, "text": "held note"}, {"start": 1, "end": 2, "text": "fast run"}]}
        report = analyze({"frames": frames}, transcript)
        self.assertEqual(report["highlights"]["vibrato"][0]["fragment"], "held note")
        self.assertEqual(report["highlights"]["agility"][0]["fragment"], "fast run")

    def test_separator_fusion_prefers_mdx_and_only_fills_consistent_short_gaps(self):
        primary = np.array([60.0, math.nan, 60.4, math.nan, math.nan, 64.0])
        secondary = np.array([60.2, 60.2, 60.5, 72.0, 72.0, 64.1])
        merged, confidence = fuse(primary, secondary, np.ones(len(primary)), maximum_gap=1)
        self.assertAlmostEqual(merged[0], 60.05)
        self.assertAlmostEqual(merged[1], 60.2)
        self.assertTrue(np.isnan(merged[3:5]).all())
        self.assertAlmostEqual(confidence[1], 0.65)

    def test_disagreement_marks_large_pitch_spreads(self):
        tracks = {
            "one": np.array([60.0, 60.0, math.nan]),
            "two": np.array([60.2, 72.0, 61.0]),
        }
        result = disagreement(tracks, frame_rate=100, threshold_cents=70)
        self.assertEqual(result, [{"time": 0.01, "spreadCents": 1200.0}])

    def test_comparison_loudness_uses_global_peak_and_silence_floor(self):
        sample_rate = 16000
        time = np.arange(sample_rate) / sample_rate
        audio = np.r_[np.zeros(sample_rate), .1 * np.sin(2 * np.pi * 220 * time), .8 * np.sin(2 * np.pi * 220 * time)]
        strength = _rms_strength(audio, sample_rate, 100, 301)
        self.assertEqual(float(np.max(strength[:90])), 0.0)
        self.assertAlmostEqual(float(np.max(strength)), 1.0, places=3)
        self.assertLess(float(np.median(strength[100:190])), 0.5)

    def test_merge_uses_two_rmvpe_tracks_to_correct_an_octave(self):
        pyin = np.array([60.0, 60.0])
        vocal = np.array([72.0, 60.1])
        mix = np.array([72.1, 60.2])
        merged, source = merge_pitch_tracks(pyin, vocal, mix, np.ones(2), frame_rate=100)
        self.assertAlmostEqual(merged[0], 72.0)
        self.assertEqual(source[0], "rmvpe-octave")
        self.assertAlmostEqual(merged[1], 60.0)

    def test_vibrato_detector_finds_a_six_hertz_modulation(self):
        frame_rate = 100
        time = np.arange(frame_rate * 2) / frame_rate
        midi = 60 + 0.25 * np.sin(2 * np.pi * 6 * time)
        depth = vibrato_depth(midi, frame_rate)
        self.assertGreater(np.count_nonzero(depth), frame_rate)

    def test_strength_envelope_releases_more_slowly_than_it_attacks(self):
        values = np.r_[np.zeros(10), np.ones(10), np.zeros(20)]
        smoothed = smooth_strength(values, frame_rate=100)
        self.assertGreater(smoothed[14], 0.7)
        self.assertGreater(smoothed[24], 0.4)

    def test_phrase_bridge_connects_energetic_detector_gap(self):
        midi = np.r_[60.0, np.full(14, np.nan), 62.0]
        source = np.array(["pyin", *(["none"] * 14), "pyin"], dtype=object)
        bridged, sources = bridge_phrase_gaps(midi, source, np.full(16, 0.8), frame_rate=100)
        self.assertFalse(np.isnan(bridged).any())
        self.assertTrue(np.all(sources[1:-1] == "phrase-bridge"))

    def test_phrase_bridge_preserves_quiet_breath(self):
        midi = np.r_[60.0, np.full(14, np.nan), 62.0]
        source = np.array(["pyin", *(["none"] * 14), "pyin"], dtype=object)
        bridged, _ = bridge_phrase_gaps(midi, source, np.zeros(16), frame_rate=100)
        self.assertTrue(np.isnan(bridged[1:-1]).all())


if __name__ == "__main__":
    unittest.main()
