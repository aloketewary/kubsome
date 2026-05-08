"""
Command Chaining — run multiple commands in sequence.

Examples:
  pods && events
  overview && alerts && check
"""


def split_chain(user_input):
    """
    Split input by && into individual commands.
    Returns list of commands to run in sequence.
    """
    if "&&" not in user_input:
        return [user_input]

    commands = [
        cmd.strip()
        for cmd in user_input.split("&&")
        if cmd.strip()
    ]

    return commands
