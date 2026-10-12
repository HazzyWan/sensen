"""Run the whole data pipeline in order: download -> clean -> weekly -> publish.

This is the one command the monthly refresh will call later.

Run from the repo root:
    python pipeline/run.py
"""

import subprocess
import sys

STEPS = ["download", "clean", "weekly", "geocode", "publish", "ship"]

for step in STEPS:
    print(f"\n===== {step}.py =====")
    # sys.executable = the Python running this script (the .venv one), so
    # every step uses the same packages. check=True stops at the first failure.
    subprocess.run([sys.executable, f"pipeline/{step}.py"], check=True)

print("\nPipeline finished.")