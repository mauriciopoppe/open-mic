import tempfile
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

import mido

from open_mic.audio.separate import sanitize_filename
from open_mic.midi.prepare import prepare_midi
from open_mic.midi.quantize import quantize_midi, quantize_tick


class AudioUtilityTests(unittest.TestCase):
    def test_sanitize_filename_removes_unsafe_characters(self):
        self.assertEqual(sanitize_filename("A song / demo"), "A_song___demo")
        self.assertEqual(sanitize_filename("..."), "audio")


class MidiUtilityTests(unittest.TestCase):
    def make_midi(self, path: Path) -> None:
        midi = mido.MidiFile()
        midi.tracks.append(
            mido.MidiTrack(
                [
                    mido.MetaMessage("set_tempo", tempo=mido.bpm2tempo(120), time=0),
                    mido.Message("note_on", note=60, velocity=80, time=0),
                    mido.Message("note_off", note=60, velocity=0, time=480),
                ]
            )
        )
        midi.save(path)

    def test_quantize_tick_snaps_to_grid(self):
        self.assertEqual(quantize_tick(239, 480, 8), 240)
        self.assertEqual(quantize_tick(241, 480, 8), 240)

    def test_quantize_writes_integer_event_times_and_target_tempo(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "input.mid"
            output = root / "output.mid"
            self.make_midi(source)

            quantize_midi(source, output, 120, 130, 8)
            result = mido.MidiFile(output)
            tempo = next(message.tempo for message in result.tracks[0] if message.type == "set_tempo")
            self.assertEqual(tempo, mido.bpm2tempo(130))
            self.assertTrue(all(isinstance(message.time, int) for message in result.tracks[0]))

    def test_prepare_requires_a_transformation(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "input.mid"
            self.make_midi(source)
            with self.assertRaisesRegex(ValueError, "--audio or --bpm"):
                prepare_midi(source, root / "output.mid")

    def test_prepare_can_change_tempo_and_grid(self):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            source = root / "input.mid"
            output = root / "output.mid"
            self.make_midi(source)

            prepare_midi(source, output, target_bpm=130, grid=8)
            self.assertTrue(output.is_file())
            result = mido.MidiFile(output)
            tempo = next(message.tempo for message in result.tracks[0] if message.type == "set_tempo")
            self.assertEqual(tempo, mido.bpm2tempo(130))


if __name__ == "__main__":
    unittest.main()
