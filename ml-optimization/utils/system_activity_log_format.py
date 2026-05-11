"""
Shared helpers for ``system_activity.log``: TSV + trailing JSON column, summaries, parsing.

Used by ``system_logs_routes`` POST/GET and by ``scripts/migrate_system_activity_log.py``.
"""

from __future__ import annotations

import json
import uuid
from typing import Any

# Deterministic UUID for legacy rows that had no event_id (migration / normalize).
_LEGACY_EVENT_ID_NAMESPACE = uuid.UUID("019a8f3e-2c1d-7e9b-a000-7f3e2d1c0b0a")


def squash_ws(s: str, max_len: int = 600) -> str:
    t = " ".join((s or "").replace("\r", " ").replace("\n", " ").replace("\t", " ").split())
    if len(t) > max_len:
        return t[: max_len - 1] + "…"
    return t


def build_summary_from_parts(
    event_type: str,
    page: str | None,
    message: str | None,
    details: dict[str, Any],
) -> str:
    """Single-line description for humans (grep / support); mirrors POST handler logic."""
    et = (event_type or "").strip() or "system"
    page_disp = (page or "").strip() or "(unknown path)"

    if et == "route_change":
        q = details.get("search")
        if isinstance(q, str) and q.strip():
            return squash_ws(f"Navigation → {page_disp} with query {q.strip()}", 500)
        return squash_ws(f"Navigation → {page_disp}", 500)

    if et == "page_load":
        return squash_ws(f"Dashboard SPA load / context: {page_disp}", 500)

    if et == "click":
        sel = details.get("selector")
        txt = details.get("text")
        sel_s = str(sel) if sel not in (None, "") else "?"
        if isinstance(txt, str) and txt.strip():
            return squash_ws(f'Click: "{squash_ws(txt, 120)}" via {sel_s}', 500)
        return squash_ws(f"Click: element {sel_s}", 500)

    if et == "api_activity":
        return squash_ws((message or "").strip() or "API client activity", 500)

    if et == "system":
        return squash_ws((message or "").strip() or "System event", 500)

    return squash_ws((message or "").strip() or et, 500)


def stable_event_id_for_legacy_row(canonical_json: str) -> str:
    """Same legacy row always maps to the same event_id (safe to re-run migration)."""
    return str(uuid.uuid5(_LEGACY_EVENT_ID_NAMESPACE, canonical_json))


def canonical_json_for_legacy_id(event: dict[str, Any]) -> str:
    """Fingerprint legacy rows for deterministic UUID (exclude old summary/event_id)."""
    keys = ("timestamp", "event_type", "source", "page", "message", "details")
    base = {k: event.get(k) for k in keys}
    return json.dumps(base, ensure_ascii=True, sort_keys=True, separators=(",", ":"))


def normalize_legacy_payload(obj: dict[str, Any]) -> dict[str, Any]:
    """
    Ensure legacy JSON-only log rows have event_id + summary for API consumers.
    Does not rewrite disk; used when parsing old lines for GET / migration output.
    """
    details = obj.get("details") if isinstance(obj.get("details"), dict) else {}
    et = str(obj.get("event_type") or "system")
    page = obj.get("page")
    message = obj.get("message")
    summary_existing = obj.get("summary")
    summary = (
        summary_existing
        if isinstance(summary_existing, str) and summary_existing.strip()
        else build_summary_from_parts(et, page if isinstance(page, str) else None, message if isinstance(message, str) else None, details)
    )
    eid = obj.get("event_id")
    if not eid or not str(eid).strip():
        eid = stable_event_id_for_legacy_row(canonical_json_for_legacy_id(obj))
    out = {
        "timestamp": str(obj.get("timestamp") or ""),
        "event_id": str(eid),
        "event_type": et,
        "source": str(obj.get("source") or "dashboard"),
        "page": page if isinstance(page, str) else None,
        "message": message if isinstance(message, str) else None,
        "summary": summary,
        "details": details,
    }
    return out


def format_tsv_log_line(payload: dict[str, Any]) -> str:
    """
    Columns (tab-separated): timestamp, event_id, event_type, source, page, summary, payload_json
    """
    summary = squash_ws(str(payload.get("summary") or ""), 600)
    json_blob = json.dumps(payload, ensure_ascii=True, separators=(",", ":"))
    parts = [
        str(payload.get("timestamp") or ""),
        str(payload.get("event_id") or ""),
        str(payload.get("event_type") or ""),
        str(payload.get("source") or ""),
        str(payload.get("page") or ""),
        summary,
        json_blob,
    ]
    return "\t".join(parts)


def parse_log_line(line: str) -> dict[str, Any] | None:
    """
    Parse one disk line into the canonical payload dict, or None if empty.
    On failure returns {"_parse_error": True, "_raw_preview": "..."}.
    """
    line = line.strip()
    if not line:
        return None
    if line.startswith("#"):
        return None

    # Legacy: single JSON object
    if line.startswith("{"):
        try:
            obj = json.loads(line)
            if not isinstance(obj, dict):
                return {"_parse_error": True, "_raw_preview": line[:400]}
            return normalize_legacy_payload(obj)
        except json.JSONDecodeError:
            return {"_parse_error": True, "_raw_preview": line[:400]}

    # TSV: last field is full JSON
    parts = line.split("\t")
    if len(parts) >= 7:
        blob = parts[6]
        try:
            obj = json.loads(blob)
            if isinstance(obj, dict):
                return obj
        except json.JSONDecodeError:
            pass
        return {"_parse_error": True, "_raw_preview": line[:400]}

    return {"_parse_error": True, "_raw_preview": line[:400]}


def is_new_tsv_format(line: str) -> bool:
    """True if line looks like timestamp\\tevent_id\\t...\\t{json}."""
    stripped = line.strip()
    if stripped.startswith("{") or not stripped:
        return False
    parts = stripped.split("\t")
    if len(parts) < 7:
        return False
    try:
        obj = json.loads(parts[6])
        return isinstance(obj, dict) and "event_id" in obj and "summary" in obj
    except json.JSONDecodeError:
        return False
