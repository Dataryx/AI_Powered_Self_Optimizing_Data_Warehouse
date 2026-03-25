"""
Simple ETL scheduler that runs the full ETL pipeline every 2 minutes.

This is an alternative to system cron and works on any platform
(including Windows). Run it as a long‑lived process:

    python -m etl.scripts.run_etl_every_5_minutes

or

    python etl/scripts/run_etl_every_5_minutes.py
"""

import sys
import time
from datetime import datetime
from pathlib import Path


def run_once() -> int:
  """
  Run the existing run_etl.py script once.

  Returns the exit code of the ETL process.
  """
  script_dir = Path(__file__).parent
  etl_script = script_dir / "run_etl.py"

  if not etl_script.exists():
    print(f"[ERROR] ETL script not found at {etl_script}")
    return 1

  # Use the same Python interpreter that launched this script
  cmd = [sys.executable, str(etl_script)]
  print(f"[{datetime.now().isoformat(timespec='seconds')}] Starting ETL pipeline...")
  from subprocess import run

  result = run(cmd)
  print(f"[{datetime.now().isoformat(timespec='seconds')}] ETL pipeline finished with exit code {result.returncode}")
  return result.returncode


def main() -> None:
  interval_seconds = 2 * 60  # 2 minutes
  print(f"ETL scheduler started – running every {interval_seconds} seconds (2 minutes).")

  try:
    while True:
      start = time.time()
      _ = run_once()
      elapsed = time.time() - start
      # Sleep the remaining time in the 5-minute window
      remaining = interval_seconds - elapsed
      if remaining > 0:
        time.sleep(remaining)
  except KeyboardInterrupt:
    print("ETL scheduler stopped by user.")


if __name__ == "__main__":
  main()

