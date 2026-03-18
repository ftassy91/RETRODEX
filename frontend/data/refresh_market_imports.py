#!/usr/bin/env python3
"""
refresh_market_imports.py
=========================
Runs the RetroMarket import pipeline:
1. build JS files from JSON templates
2. validate imports
3. generate coverage reports
"""

import os
import subprocess
import sys

DATA_DIR = os.path.dirname(os.path.abspath(__file__))


def run(command):
    if isinstance(command, str):
        command = [command]
    script_path = os.path.join(DATA_DIR, command[0])
    result = subprocess.run([sys.executable, script_path, *command[1:]], check=False)
    if result.returncode != 0:
        raise SystemExit(result.returncode)


def main():
    run(["build_market_import_js.py"])
    run(["validate_market_imports.py", "--verbose"])
    run(["generate_market_coverage_report.py"])
    print("RetroMarket import refresh complete.")


if __name__ == "__main__":
    main()
