"""Smoke tests for the package seams."""


def test_audio_modules_import():
    import open_mic.audio.mix  # noqa: F401
    import open_mic.audio.separate  # noqa: F401


def test_midi_modules_import():
    import open_mic.midi.align  # noqa: F401
    import open_mic.midi.prepare  # noqa: F401
    import open_mic.midi.quantize  # noqa: F401
