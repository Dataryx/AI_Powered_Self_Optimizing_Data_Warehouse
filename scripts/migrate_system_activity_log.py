#!/usr/bin/env python3
"""
One-time migration: rewrite legacy JSON-only ``system_activity.log`` lines to the
tab-separated format (timestamp + ids + summary + trailing JSON).

Usage from repo root::

  python scripts/migrate_system_activity_log.py --dry-run
  python scripts/migrate_system_activity_log.py

Creates a timestamped backup ``system_activity.log.bak.<unix>`` before replacing the log.
Lines that cannot be parsed are appended to ``system_activity.rejected.log``.
"""

from __future__ import annotations

import argparse
import shutil
import sys
from datetime import datetime, timezone
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[1]
ML_OPTIMIZATION_ROOT = REPO_ROOT / "ml-optimization"
sys.path.insert(0, str(ML_OPTIMIZATION_ROOT))

from utils.system_activity_log_format import (  # noqa: E402
    format_tsv_log_line,
    is_new_tsv_format,
    parse_log_line,
)


def migrate_lines(lines: list[str]) -> tuple[list[str], list[str]]:
    """Return (new_lines, rejected_raw_lines)."""
    out: list[str] = []
    rejected: list[str] = []
    for line in lines:
        raw = line.rstrip("\n\r")
        if not raw.strip():
            continue
        if raw.strip().startswith("#"):
            continue
        if is_new_tsv_format(raw):
            out.append(raw)
            continue
        parsed = parse_log_line(raw)
        if parsed is None:
            continue
        if parsed.get("_parse_error"):
            rejected.append(raw)
            continue
        out.append(format_tsv_log_line(parsed))
    return out, rejected


def main() -> int:
    ap = argparse.ArgumentParser(description="Migrate system_activity.log to TSV format.")
    ap.add_argument(
        "--log-path",
        type=Path,
        default=REPO_ROOT / "system log" / "system_activity.log",
        help="Path to system_activity.log",
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Print counts only; do not write files.",
    )
    args = ap.parse_args()
    log_path: Path = args.log_path

    if not log_path.is_file():
        print(f"No file at {log_path}; nothing to do.", file=sys.stderr)
        return 0

    text = log_path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    new_lines, rejected = migrate_lines(lines)

    print(f"Source lines (non-empty): {len(lines)}")
    print(f"Output lines: {len(new_lines)}")
    print(f"Rejected (corrupt / unparseable): {len(rejected)}")

    if args.dry_run:
        return 0

    ts = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    bak = log_path.with_suffix(log_path.suffix + f".bak.{ts}")
    shutil.copy2(log_path, bak)
    print(f"Backup written: {bak}")

    log_path.write_text("\n".join(new_lines) + ("\n" if new_lines else ""), encoding="utf-8")
    print(f"Migrated file written: {log_path}")

    if rejected:
        rej_path = log_path.parent / "system_activity.rejected.log"
        rej_path.write_text(
            "\n".join(rejected) + "\n",
            encoding="utf-8",
        )
        print(f"Rejected lines saved: {rej_path} ({len(rejected)} lines)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
