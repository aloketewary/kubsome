import subprocess
from core.pipe import apply_pipe

def test_injection():
    # Attempt to create a file in /tmp via command injection
    injection_cmd = "grep test; touch /tmp/sentinel_vulnerable"
    output = apply_pipe("some data", injection_cmd)

    import os
    if os.path.exists("/tmp/sentinel_vulnerable"):
        print("VULNERABILITY CONFIRMED: /tmp/sentinel_vulnerable was created!")
        os.remove("/tmp/sentinel_vulnerable")
    else:
        print("Vulnerability NOT confirmed (maybe shell=True is not working as expected or permission denied)")

if __name__ == "__main__":
    test_injection()
