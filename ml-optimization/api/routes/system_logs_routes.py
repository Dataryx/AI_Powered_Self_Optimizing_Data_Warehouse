"""
System activity logging routes.

Writes ``system_activity.log`` as tab-separated rows so humans can skim columns in a text
editor while the last column remains full JSON per line (pipe to jq). File appends are
serialized with a lock to avoid interleaved/corrupt lines under concurrent requests.
"""

from __future__ import annotations

import logging
import threading
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter, Query
from pydantic import BaseModel, Field

from ml_optimization.utils.system_activity_log_format import (
    build_summary_from_parts,
    format_tsv_log_line,
    parse_log_line,
)

router = APIRouter()
logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[3]
SYSTEM_LOG_DIR = REPO_ROOT / "system log"
SYSTEM_LOG_FILE = SYSTEM_LOG_DIR / "system_activity.log"

_log_io_lock = threading.Lock()


class SystemEventBody(BaseModel):
    event_type: Literal["page_load", "route_change", "click", "api_activity", "system"]
    page: str | None = Field(default=None, max_length=300)
    message: str | None = Field(default=None, max_length=2000)
    details: dict[str, Any] | None = None
    source: str = Field(default="dashboard", max_length=100)


def _append_system_log(payload: dict[str, Any]) -> None:
    line = format_tsv_log_line(payload)
    try:
        with _log_io_lock:
            SYSTEM_LOG_DIR.mkdir(parents=True, exist_ok=True)
            with SYSTEM_LOG_FILE.open("a", encoding="utf-8") as f:
                f.write(line)
                f.write("\n")
    except OSError as ex:
        logger.warning("Could not append system activity log: %s", ex)


def _read_log_tail_for_parse(max_lines: int) -> list[str]:
    if not SYSTEM_LOG_FILE.is_file():
        return []
    try:
        text = SYSTEM_LOG_FILE.read_text(encoding="utf-8", errors="replace")
    except OSError as ex:
        logger.warning("Could not read system activity log: %s", ex)
        return []
    lines = text.splitlines()
    if len(lines) <= max_lines:
        return lines
    return lines[-max_lines:]


@router.post("/events")
def record_system_event(body: SystemEventBody):
    now = datetime.now(timezone.utc).isoformat()
    details = body.details or {}
    summary = build_summary_from_parts(body.event_type, body.page, body.message, details)
    event_id = str(uuid.uuid4())
    payload: dict[str, Any] = {
        "timestamp": now,
        "event_id": event_id,
        "event_type": body.event_type,
        "source": body.source,
        "page": body.page,
        "message": body.message,
        "summary": summary,
        "details": details,
    }
    _append_system_log(payload)
    return {
        "ok": True,
        "logged_at": now,
        "event_id": event_id,
        "summary": summary,
    }


@router.get("/events")
def list_system_events(
    limit: int = Query(50, ge=1, le=500, description="Max events to return (newest first)"),
):
    """
    Return the most recent parsed events from ``system_activity.log``.

    Supports both legacy JSON-only lines and newer tab-separated rows. Lines that fail to
    parse appear in ``parse_errors_in_tail`` count only (not listed by default).
    """
    raw = _read_log_tail_for_parse(max_lines=min(limit * 4, 20000))
    events: list[dict[str, Any]] = []
    parse_errors = 0
    for line in reversed(raw):
        parsed = parse_log_line(line)
        if parsed is None:
            continue
        if parsed.get("_parse_error"):
            parse_errors += 1
            continue
        events.append(parsed)
        if len(events) >= limit:
            break

    rel_path = None
    try:
        if SYSTEM_LOG_FILE.is_file():
            rel_path = str(SYSTEM_LOG_FILE.relative_to(REPO_ROOT))
    except ValueError:
        rel_path = str(SYSTEM_LOG_FILE)

    return {
        "events": events,
        "returned": len(events),
        "limit": limit,
        "parse_errors_in_tail": parse_errors,
        "log_path": rel_path,
    }
