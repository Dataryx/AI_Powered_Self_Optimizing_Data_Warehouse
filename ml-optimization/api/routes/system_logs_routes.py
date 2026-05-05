"""
System activity logging routes.
"""

from __future__ import annotations

from datetime import datetime, timezone
import json
from pathlib import Path
from typing import Any, Literal

from fastapi import APIRouter
from pydantic import BaseModel, Field


router = APIRouter()

REPO_ROOT = Path(__file__).resolve().parents[3]
SYSTEM_LOG_DIR = REPO_ROOT / "system log"
SYSTEM_LOG_FILE = SYSTEM_LOG_DIR / "system_activity.log"


class SystemEventBody(BaseModel):
    event_type: Literal["page_load", "route_change", "click", "api_activity", "system"]
    page: str | None = Field(default=None, max_length=300)
    message: str | None = Field(default=None, max_length=2000)
    details: dict[str, Any] | None = None
    source: str = Field(default="dashboard", max_length=100)


def _append_system_log(event: dict[str, Any]) -> None:
    SYSTEM_LOG_DIR.mkdir(parents=True, exist_ok=True)
    with SYSTEM_LOG_FILE.open("a", encoding="utf-8") as f:
        f.write(json.dumps(event, ensure_ascii=True))
        f.write("\n")


@router.post("/events")
def record_system_event(body: SystemEventBody):
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "timestamp": now,
        "event_type": body.event_type,
        "source": body.source,
        "page": body.page,
        "message": body.message,
        "details": body.details or {},
    }
    _append_system_log(payload)
    return {"ok": True, "logged_at": now}

