import contextlib
import io
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parents[1] / "src"))

from open_mic import cli


class CliHelpTests(unittest.TestCase):
    def run_cli(self, *arguments: str) -> str:
        output = io.StringIO()
        original_argv = sys.argv
        try:
            sys.argv = ["open-mic", *arguments]
            with contextlib.redirect_stdout(output):
                cli.main()
        finally:
            sys.argv = original_argv
        return output.getvalue()

    def test_top_level_help_lists_public_workflows(self):
        help_text = self.run_cli("--help")
        self.assertIn("midi/", help_text)
        self.assertIn("arrange/", help_text)
        self.assertIn("separate", help_text)
        self.assertNotIn("align-midi", help_text)

    def test_group_help_lists_nested_commands(self):
        help_text = self.run_cli("midi", "--help")
        self.assertIn("transcribe", help_text)
        self.assertIn("prepare", help_text)


if __name__ == "__main__":
    unittest.main()
