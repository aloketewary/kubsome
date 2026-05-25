import os
import unittest
from unittest.mock import patch, MagicMock
from core.notify import notify

class TestNotificationSecurity(unittest.TestCase):
    @patch("platform.system")
    @patch("subprocess.run")
    @patch.dict("os.environ", {"KUBSOME_TESTING": ""}, clear=False)
    def test_macos_notification_secure(self, mock_run, mock_system):
        mock_system.return_value = "Darwin"

        # Malicious input designed to break out of the AppleScript string
        malicious_message = 'test" & (do shell script "echo INJECTED") & "'
        malicious_title = "Innocent Title"

        notify(malicious_title, malicious_message)

        # Verify that subprocess.run was called
        self.assertTrue(mock_run.called)

        # Get the arguments passed to subprocess.run
        args, kwargs = mock_run.call_args
        cmd = args[0]

        # cmd should be ['osascript', '-e', script, message, title]
        self.assertEqual(cmd[0], "osascript")
        self.assertEqual(cmd[1], "-e")
        script = cmd[2]

        print(f"Executed script: {script}")

        # Verify that the script does NOT contain the malicious message directly
        self.assertNotIn(malicious_message, script)

        # Verify that the malicious message and title are passed as separate arguments
        self.assertEqual(cmd[3], malicious_message)
        self.assertEqual(cmd[4], malicious_title)

        # Verify the script structure
        self.assertIn("on run {msg, sub}", script)
        self.assertIn("display notification msg", script)

if __name__ == "__main__":
    unittest.main()
