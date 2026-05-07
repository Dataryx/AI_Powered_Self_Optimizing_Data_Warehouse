"""
Alert Routes
API routes for alerting, incidents, and anomaly detection.
"""

from fastapi import APIRouter, HTTPException, Query, Body
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from pydantic import BaseModel, Field
import hashlib
import json
import logging
from functools import lru_cache
from pathlib import Path
from ml_optimization.utils.db_utils import get_db_connection
from psycopg2 import sql
from psycopg2.extras import RealDictCursor, Json, execute_batch

from models.anomaly_detector import QueryAnomalyDetector

router = APIRouter()
logger = logging.getLogger(__name__)


def _stable_alert_id_suffix(*parts: str) -> str:
    """Stable hash for alert_id fragments (same inputs across requests and process restarts)."""
    h = hashlib.sha256()
    for p in parts:
        h.update((p or "").encode("utf-8", errors="replace"))
    return h.hexdigest()[:24]


def _project_models_dir() -> Path:
    # ml-optimization/api/routes/<this file> -> .../ml-optimization
    ml_opt_dir = Path(__file__).resolve().parents[2]
    return ml_opt_dir / "saved_models"


@lru_cache(maxsize=1)
def _load_anomaly_detector() -> Optional[QueryAnomalyDetector]:
    models_dir = _project_models_dir()
    anomaly_path = models_dir / "anomaly_detector.pkl"
    if not anomaly_path.exists():
        return None
    detector = QueryAnomalyDetector()
    detector.load_model(str(anomaly_path))
    return detector


def _extract_table_hints(query_upper: str) -> Optional[str]:
    """Best-effort table hint from query text for alert display."""
    # Extremely small heuristic; this is only to make UI messages more readable.
    if "SILVER.ORDERS" in query_upper or " ORDERS" in query_upper:
        return "silver.orders"
    if "SILVER.CUSTOMERS" in query_upper or " CUSTOMERS" in query_upper:
        return "silver.customers"
    if "SILVER.PRODUCTS" in query_upper or " PRODUCTS" in query_upper:
        return "silver.products"
    return None


def _detect_model_anomalies(
    conn,
    max_rows: int = 2000,
    max_anomalies: int = 20,
    recency_hours: int = 24,
) -> List[Dict[str, Any]]:
    """Detect anomalies using the trained IsolationForest model."""
    detector = _load_anomaly_detector()
    if detector is None:
        return []

    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        """
        SELECT
            query_text,
            mean_exec_time_ms,
            calls,
            rows_affected,
            shared_blks_hit,
            shared_blks_read,
            collected_at
        FROM ml_optimization.query_logs
        WHERE query_text IS NOT NULL
          AND mean_exec_time_ms > 0
          AND collected_at >= (CURRENT_TIMESTAMP - (%s * INTERVAL '1 hour'))
        ORDER BY collected_at DESC
        LIMIT %s
        """,
        (max(1, int(recency_hours)), max_rows),
    )
    rows = cursor.fetchall()
    cursor.close()

    anomalies: List[Dict[str, Any]] = []
    for row in rows:
        query_text = str(row.get("query_text") or "")
        query_upper = query_text.upper()
        table_hint = _extract_table_hints(query_upper)

        metrics = {
            "mean_exec_time_ms": float(row.get("mean_exec_time_ms", 0) or 0),
            "calls": float(row.get("calls", 0) or 0),
            "rows_affected": float(row.get("rows_affected", 0) or 0),
            "shared_blks_hit": float(row.get("shared_blks_hit", 0) or 0),
            "shared_blks_read": float(row.get("shared_blks_read", 0) or 0),
        }
        is_anom, anomaly_score, reason = detector.detect_anomaly(metrics)
        if not is_anom:
            continue

        # In IsolationForest, score_samples is typically "more normal" for higher values.
        # We negate it so bigger => more severe.
        severity_strength = max(0.0, -float(anomaly_score or 0.0))
        if reason == "Execution time spike" or severity_strength > 1.0:
            severity = "high"
        elif reason and severity_strength > 0.3:
            severity = "medium"
        else:
            severity = "low"

        coll = row.get("collected_at")
        coll_s = coll.isoformat() if hasattr(coll, "isoformat") else str(coll or "")
        anomaly_stable_id = f"model_anom_{_stable_alert_id_suffix(query_upper[:240], coll_s)}"
        anomalies.append(
            {
                "id": anomaly_stable_id,
                "type": "model_anomaly",
                "severity": severity,
                "title": "Model-detected anomaly",
                "message": f"{reason} (score={float(anomaly_score):.3f})",
                "description": f"ML anomaly based on query performance baseline. Table hint: {table_hint or 'unknown'}.",
                "timestamp": row.get("collected_at").isoformat() if row.get("collected_at") else datetime.now().isoformat(),
                "table": table_hint,
            }
        )
        if len(anomalies) >= max_anomalies:
            break

    return anomalies


class AlertConfig(BaseModel):
    alert_type: str
    threshold: float
    enabled: bool = True
    severity: str = "medium"


class AcknowledgeBatchBody(BaseModel):
    alert_ids: List[str] = Field(default_factory=list)


# Runtime overrides (per process). POST /alerts/config merges into these.
_runtime_alert_overrides: Dict[str, Dict[str, Any]] = {}


def _ensure_monitoring_alert_tables(conn) -> None:
    """Create persistence tables for acknowledgments and incidents (idempotent)."""
    cur = conn.cursor()
    try:
        cur.execute("CREATE SCHEMA IF NOT EXISTS monitoring;")
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS monitoring.alert_acknowledgments (
                alert_id TEXT PRIMARY KEY,
                acknowledged_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS monitoring.incidents (
                incident_id TEXT PRIMARY KEY,
                alert_type TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                severity TEXT NOT NULL,
                status TEXT NOT NULL,
                started_at TIMESTAMPTZ,
                resolved_at TIMESTAMPTZ,
                alert_count INTEGER NOT NULL DEFAULT 0,
                affected_tables JSONB NOT NULL DEFAULT '[]'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            );
            """
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_incidents_status ON monitoring.incidents (status);"
        )
        cur.execute(
            "CREATE INDEX IF NOT EXISTS idx_incidents_alert_type ON monitoring.incidents (alert_type);"
        )
    finally:
        cur.close()


def _filter_acknowledged_db(conn, alerts: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    if not alerts:
        return alerts
    ids = [str(a.get("alert_id") or "") for a in alerts if str(a.get("alert_id") or "").strip()]
    if not ids:
        return alerts
    cur = conn.cursor()
    try:
        cur.execute(
            "SELECT alert_id FROM monitoring.alert_acknowledgments WHERE alert_id = ANY(%s);",
            (ids,),
        )
        blocked = {str(r[0]) for r in cur.fetchall()}
    except Exception:
        logger.exception("alert_acknowledgments lookup failed; returning unfiltered alerts")
        return alerts
    finally:
        cur.close()
    return [a for a in alerts if str(a.get("alert_id") or "") not in blocked]


def _coerce_dt(value: Any) -> Optional[datetime]:
    if value is None:
        return None
    if isinstance(value, datetime):
        return value
    try:
        s = str(value).replace("Z", "+00:00")
        return datetime.fromisoformat(s)
    except Exception:
        return None


def _min_alert_time(alerts: List[Dict[str, Any]]) -> datetime:
    dts = [_coerce_dt(x.get("timestamp")) for x in alerts]
    dts = [d for d in dts if d is not None]
    return min(dts) if dts else datetime.now()


def sync_incidents_to_db(conn, alerts: List[Dict[str, Any]]) -> None:
    """Upsert incidents from the current active-alerts snapshot; resolve stale types."""
    cur = conn.cursor()
    try:
        groups: Dict[str, List[Dict[str, Any]]] = {}
        for a in alerts:
            t = str(a.get("type") or "unknown")
            groups.setdefault(t, []).append(a)
        active_types = list(groups.keys())

        cur.execute(
            """
            UPDATE monitoring.incidents
            SET status = 'resolved',
                resolved_at = COALESCE(resolved_at, NOW()),
                alert_count = 0,
                updated_at = NOW()
            WHERE status = 'open'
              AND NOT (alert_type = ANY(%s::text[]));
            """,
            (active_types,),
        )

        for alert_type, galerts in groups.items():
            incident_id = f"inc_{alert_type}"
            severities = [str(x.get("severity") or "low") for x in galerts]
            if "critical" in severities or "high" in severities:
                inc_sev = "high"
            elif "medium" in severities:
                inc_sev = "medium"
            else:
                inc_sev = "low"
            status_open = any(str(x.get("status") or "") == "active" for x in galerts)
            status_val = "open" if status_open else "resolved"
            started_at = _min_alert_time(galerts)
            affected: List[Any] = [x.get("table") or x.get("title") for x in galerts[:5]]
            desc = f'{len(galerts)} active signal(s) of type "{alert_type.replace("_", " ")}".'
            title = f"{alert_type.replace('_', ' ').title()} — grouped alerts"
            cur.execute(
                """
                INSERT INTO monitoring.incidents (
                    incident_id, alert_type, title, description, severity, status,
                    started_at, alert_count, affected_tables, created_at, updated_at
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW(), NOW()
                )
                ON CONFLICT (incident_id) DO UPDATE SET
                    title = EXCLUDED.title,
                    description = EXCLUDED.description,
                    severity = EXCLUDED.severity,
                    status = EXCLUDED.status,
                    started_at = CASE
                        WHEN monitoring.incidents.started_at IS NULL THEN EXCLUDED.started_at
                        ELSE LEAST(monitoring.incidents.started_at, EXCLUDED.started_at)
                    END,
                    alert_count = EXCLUDED.alert_count,
                    affected_tables = EXCLUDED.affected_tables,
                    updated_at = NOW(),
                    resolved_at = CASE
                        WHEN EXCLUDED.status = 'open' THEN NULL
                        ELSE COALESCE(monitoring.incidents.resolved_at, NOW())
                    END;
                """,
                (
                    incident_id,
                    alert_type,
                    title,
                    desc,
                    inc_sev,
                    status_val,
                    started_at,
                    len(galerts),
                    Json(affected),
                ),
            )
    finally:
        cur.close()


def fetch_incidents_from_db(conn) -> dict:
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT incident_id, title, description, severity, status, started_at, resolved_at,
                   alert_count, affected_tables
            FROM monitoring.incidents
            WHERE status = 'open'
               OR (status = 'resolved' AND resolved_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours')
            ORDER BY COALESCE(started_at, updated_at) DESC NULLS LAST, updated_at DESC
            LIMIT 500;
            """
        )
        rows = cur.fetchall()
    finally:
        cur.close()

    incidents: List[Dict[str, Any]] = []
    for r in rows:
        aff = r.get("affected_tables")
        if isinstance(aff, str):
            try:
                aff = json.loads(aff)
            except Exception:
                aff = []
        if aff is None:
            aff = []
        if not isinstance(aff, list):
            aff = list(aff) if aff else []
        sa = r.get("started_at")
        ra = r.get("resolved_at")
        incidents.append(
            {
                "incident_id": r.get("incident_id"),
                "title": r.get("title"),
                "description": r.get("description"),
                "severity": r.get("severity"),
                "status": r.get("status"),
                "started_at": sa.isoformat() if sa and hasattr(sa, "isoformat") else None,
                "resolved_at": ra.isoformat() if ra and hasattr(ra, "isoformat") else None,
                "alert_count": r.get("alert_count") or 0,
                "affected_tables": aff,
            }
        )
    open_c = sum(1 for i in incidents if str(i.get("status") or "").lower() == "open")
    resolved_c = sum(1 for i in incidents if str(i.get("status") or "").lower() == "resolved")
    return {
        "incidents": incidents,
        "total": len(incidents),
        "open": open_c,
        "resolved": resolved_c,
    }

_BASE_ALERT_ROWS: List[Dict[str, Any]] = [
    {
        "alert_type": "empty_table",
        "enabled": True,
        "severity": "medium",
        "threshold": 0.0,
        "description": "Alert when a medallion table has no rows",
    },
    {
        "alert_type": "data_quality",
        "enabled": True,
        "severity": "medium",
        "threshold": 10.0,
        "description": "Dead tuple ratio above this percent triggers an alert",
    },
    {
        "alert_type": "performance",
        "enabled": True,
        "severity": "low",
        "threshold": 70.0,
        "description": "Minimum acceptable cache hit rate (percent)",
    },
    {
        "alert_type": "storage",
        "enabled": True,
        "severity": "info",
        "threshold": 5.0,
        "description": "Table size above this many GB is flagged",
    },
    {
        "alert_type": "etl_failure",
        "enabled": True,
        "severity": "high",
        "threshold": 0.0,
        "description": "Surface failed / error ETL runs from monitoring.job_runs",
    },
    {
        "alert_type": "model_anomaly",
        "enabled": True,
        "severity": "medium",
        "threshold": 0.0,
        "description": "IsolationForest anomalies on query_logs",
    },
    {
        "alert_type": "slow_query",
        "enabled": True,
        "severity": "high",
        "threshold": 5.0,
        "description": "Queries slower than this many seconds (mean_exec_time_ms)",
    },
]


def _merged_alert_config_list() -> List[Dict[str, Any]]:
    out: List[Dict[str, Any]] = []
    for row in _BASE_ALERT_ROWS:
        t = str(row["alert_type"])
        ov = _runtime_alert_overrides.get(t, {})
        merged = {**row, **ov}
        out.append(merged)
    return out


def _alert_rules_map() -> Dict[str, Dict[str, Any]]:
    return {str(r["alert_type"]): r for r in _merged_alert_config_list()}


def build_active_alerts_payload(conn) -> dict:
    """Build the same payload as GET /alerts/active using an existing DB connection."""
    _ensure_monitoring_alert_tables(conn)
    cursor = conn.cursor()

    alerts = []
    rules = _alert_rules_map()
    sev_empty = str(rules.get("empty_table", {}).get("severity", "medium"))
    sev_dq = str(rules.get("data_quality", {}).get("severity", "medium"))
    sev_perf = str(rules.get("performance", {}).get("severity", "low"))
    sev_storage = str(rules.get("storage", {}).get("severity", "info"))
    sev_etl = str(rules.get("etl_failure", {}).get("severity", "high"))
    sev_slow = str(rules.get("slow_query", {}).get("severity", "high"))

    # 1. Tables with no data (pg_stat_user_tables uses relname, not tablename)
    if rules.get("empty_table", {}).get("enabled", True):
        try:
            cursor.execute("""
                SELECT schemaname, relname AS tablename
                FROM pg_stat_user_tables
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                AND n_live_tup = 0
            """)
            maybe_empty_tables = cursor.fetchall()
            for table in maybe_empty_tables:
                schema_name, table_name = table[0], table[1]
                # Verify with real data scan (LIMIT 1) to avoid false positives from stale n_live_tup stats.
                try:
                    cursor.execute(
                        sql.SQL("SELECT EXISTS (SELECT 1 FROM {}.{} LIMIT 1)").format(
                            sql.Identifier(schema_name),
                            sql.Identifier(table_name),
                        )
                    )
                    has_rows = bool(cursor.fetchone()[0])
                except Exception:
                    # If we cannot verify accurately, skip alert rather than emit a false positive.
                    continue
                if has_rows:
                    continue
                alerts.append({
                    "alert_id": f"empty_table_{schema_name}_{table_name}",
                    "type": "empty_table",
                    "severity": sev_empty,
                    "title": f"Empty table detected: {schema_name}.{table_name}",
                    "message": f"The table {table_name} in {schema_name} layer has no data. ETL process may have failed.",
                    "timestamp": datetime.now().isoformat(),
                    "status": "active",
                    "acknowledged": False,
                })
        except Exception:
            pass

    # 2. High dead tuple ratio (pg_stat_user_tables uses relname)
    if rules.get("data_quality", {}).get("enabled", True):
        try:
            dead_ratio = float(rules.get("data_quality", {}).get("threshold", 10.0)) / 100.0
            dead_ratio = max(0.0001, min(0.99, dead_ratio))
            cursor.execute("""
                SELECT schemaname, relname AS tablename,
                       n_dead_tup::float / NULLIF(n_live_tup + n_dead_tup, 0) * 100 as dead_ratio
                FROM pg_stat_user_tables
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                AND n_dead_tup::float / NULLIF(n_live_tup + n_dead_tup, 0) > %s
            """, (dead_ratio,))
            dead_tuple_issues = cursor.fetchall()
            for issue in dead_tuple_issues:
                alerts.append({
                    "alert_id": f"dead_tuples_{issue[0]}_{issue[1]}",
                    "type": "data_quality",
                    "severity": sev_dq,
                    "title": f"High dead tuple ratio: {issue[0]}.{issue[1]}",
                    "message": f"Table {issue[1]} has {round(issue[2] or 0.0, 2)}% dead tuples. Consider running VACUUM.",
                    "timestamp": datetime.now().isoformat(),
                    "status": "active",
                    "acknowledged": False,
                })
        except Exception:
            pass

    # 3. Cache hit rate below threshold (pg_statio_user_tables uses relname)
    if rules.get("performance", {}).get("enabled", True):
        try:
            min_hit = float(rules.get("performance", {}).get("threshold", 70.0)) / 100.0
            min_hit = max(0.01, min(0.999, min_hit))
            cursor.execute("""
                SELECT schemaname, relname AS tablename,
                       heap_blks_hit::float / NULLIF(heap_blks_read + heap_blks_hit, 0) * 100 as hit_rate
                FROM pg_statio_user_tables
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                AND heap_blks_hit::float / NULLIF(heap_blks_read + heap_blks_hit, 0) < %s
                AND (heap_blks_read + heap_blks_hit) > 1000
            """, (min_hit,))
            cache_issues = cursor.fetchall()
            for issue in cache_issues:
                alerts.append({
                    "alert_id": f"cache_poor_{issue[0]}_{issue[1]}",
                    "type": "performance",
                    "severity": sev_perf,
                    "title": f"Low cache hit rate: {issue[0]}.{issue[1]}",
                    "message": f"Table {issue[1]} has only {round(issue[2] or 0.0, 2)}% cache hit rate. Consider index optimization.",
                    "timestamp": datetime.now().isoformat(),
                    "status": "active",
                    "acknowledged": False,
                })
        except Exception:
            pass

    # 4. Large tables (pg_tables has tablename; use regclass for size)
    if rules.get("storage", {}).get("enabled", True):
        try:
            gb = float(rules.get("storage", {}).get("threshold", 5.0))
            gb = max(0.1, min(10000.0, gb))
            size_bytes = int(gb * (1024 ** 3))
            cursor.execute("""
                SELECT schemaname, tablename,
                       pg_total_relation_size((quote_ident(schemaname)||'.'||quote_ident(tablename))::regclass) AS size_bytes
                FROM pg_tables
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                AND pg_total_relation_size((quote_ident(schemaname)||'.'||quote_ident(tablename))::regclass) > %s
                ORDER BY pg_total_relation_size((quote_ident(schemaname)||'.'||quote_ident(tablename))::regclass) DESC
                LIMIT 5
            """, (size_bytes,))
            large_tables = cursor.fetchall()
            for table in large_tables:
                size_g = (table[2] or 0) / (1024**3)
                alerts.append({
                    "alert_id": f"large_table_{table[0]}_{table[1]}",
                    "type": "storage",
                    "severity": sev_storage,
                    "title": f"Large table: {table[0]}.{table[1]}",
                    "message": f"Table {table[1]} is {round(size_g, 2)} GB. Consider partitioning or archival.",
                    "timestamp": datetime.now().isoformat(),
                    "status": "active",
                    "acknowledged": False,
                })
        except Exception:
            pass

    # 5. ETL failures from monitoring.job_runs (recent failures only).
    if rules.get("etl_failure", {}).get("enabled", True):
        try:
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'monitoring'
                      AND table_name = 'job_runs'
                )
            """)
            exists_row = cursor.fetchone()
            etl_table_exists = bool(exists_row[0]) if exists_row is not None else False

            if etl_table_exists:
                cursor.execute("""
                    SELECT
                        jr.run_id,
                        j.job_name,
                        jr.status,
                        jr.layer,
                        jr.table_name,
                        jr.started_at,
                        jr.completed_at,
                        jr.error_message
                    FROM monitoring.job_runs jr
                    JOIN monitoring.etl_jobs j
                      ON jr.job_id = j.job_id
                    WHERE jr.status IN ('failed', 'error')
                      AND jr.started_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
                    ORDER BY jr.started_at DESC
                    LIMIT 20
                """)
                for job_id, job_name, status, layer, table_name, started_at, completed_at, error_message in cursor.fetchall():
                    ts = started_at or completed_at or datetime.now()
                    alerts.append({
                        "alert_id": f"etl_{status}_{job_id}",
                        "type": "etl_failure",
                        "severity": sev_etl,
                        "title": f"ETL job {status}: {job_name}",
                        "message": (
                            f"ETL job '{job_name}' on layer {layer or 'unknown'}"
                            f"{' for table ' + table_name if table_name else ''} "
                            f"finished with status {status.upper()}."
                            + (f" Error: {error_message}" if error_message else "")
                        ).strip(),
                        "layer": layer,
                        "table": table_name,
                        "timestamp": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
                        "status": "active",
                        "acknowledged": False,
                    })
        except Exception:
            pass

    # 6. Model-based anomalies (trained anomaly_detector.pkl, recent window only).
    if rules.get("model_anomaly", {}).get("enabled", True):
        try:
            model_anoms = _detect_model_anomalies(conn, max_rows=1500, max_anomalies=10, recency_hours=24)
            for anom in model_anoms:
                alerts.append({
                    "alert_id": anom.get("id")
                    or f"model_anom_{_stable_alert_id_suffix(str(anom.get('message', '')), str(anom.get('timestamp', '')))}",
                    "type": anom.get("type", "model_anomaly"),
                    "severity": anom.get("severity", "medium"),
                    "title": anom.get("title", "Model anomaly"),
                    "message": anom.get("message", "Anomaly detected"),
                    "timestamp": anom.get("timestamp", datetime.now().isoformat()),
                    "status": "active",
                    "acknowledged": False,
                    "table": anom.get("table"),
                })
        except Exception as e:
            logger.warning("Model anomaly detection failed: %s", e)

    # 7. Slow queries from query_logs (recent window only).
    if rules.get("slow_query", {}).get("enabled", True):
        try:
            sec = float(rules.get("slow_query", {}).get("threshold", 5.0))
            sec = max(0.1, min(3600.0, sec))
            threshold_ms = sec * 1000.0
            cursor.execute("""
                SELECT query_text, mean_exec_time_ms, collected_at
                FROM ml_optimization.query_logs
                WHERE mean_exec_time_ms IS NOT NULL
                  AND mean_exec_time_ms > %s
                  AND collected_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
                ORDER BY collected_at DESC NULLS LAST
                LIMIT 15
            """, (threshold_ms,))
            for row in cursor.fetchall():
                qtext, ms, coll = row[0], row[1], row[2]
                snippet = (str(qtext)[:120] + "…") if qtext and len(str(qtext)) > 120 else (str(qtext or ""))
                ts = coll.isoformat() if hasattr(coll, "isoformat") else datetime.now().isoformat()
                alerts.append({
                    "alert_id": f"slow_q_{_stable_alert_id_suffix(snippet[:160], str(coll))}",
                    "type": "slow_query",
                    "severity": sev_slow,
                    "title": f"Slow query ({round(float(ms or 0), 0)} ms mean)",
                    "message": snippet or "Query exceeded configured duration threshold.",
                    "timestamp": ts,
                    "status": "active",
                    "acknowledged": False,
                })
        except Exception:
            pass

    alerts = _filter_acknowledged_db(conn, alerts)

    return {
        "alerts": alerts,
        "total": len(alerts),
        "by_severity": {
            "critical": len([a for a in alerts if a["severity"] == "critical"]),
            "high": len([a for a in alerts if a["severity"] == "high"]),
            "medium": len([a for a in alerts if a["severity"] == "medium"]),
            "low": len([a for a in alerts if a["severity"] == "low"]),
            "info": len([a for a in alerts if a["severity"] == "info"]),
        },
    }


def _sync_fetch_active_alerts_dict() -> dict:
    with get_db_connection() as conn:
        return build_active_alerts_payload(conn)


def _compute_anomalies_payload(conn) -> dict:
    """Build anomalies using an existing connection (single round-trip with alerts bundle)."""
    cursor = conn.cursor()
    anomalies: List[Dict[str, Any]] = []

    try:
        # 1. Anomaly: Recent failed ETL runs (so ML-Detected Anomalies reflects real failures)
        try:
            cursor.execute("""
                SELECT r.run_id, r.job_id, r.started_at, r.error_message, r.layer, r.table_name, j.job_name
                FROM monitoring.job_runs r
                JOIN monitoring.etl_jobs j ON j.job_id = r.job_id
                WHERE r.status = 'failed'
                  AND r.started_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
                ORDER BY r.started_at DESC
                LIMIT 50
            """)
            for row in cursor.fetchall():
                run_id, job_id, started_at, error_message, layer, table_name, job_name = row
                anomalies.append({
                    "id": f"anomaly_etl_failure_{run_id}",
                    "type": "etl_failure",
                    "severity": "high",
                    "title": f"ETL job failed: {job_name or job_id}",
                    "message": error_message or "Job failed",
                    "description": f"Failed run in last 7 days. Layer: {layer or '—'}, table: {table_name or '—'}.",
                    "table": f"{layer or 'unknown'}.{table_name or 'unknown'}" if layer or table_name else None,
                    "timestamp": started_at.isoformat() if hasattr(started_at, "isoformat") else str(started_at),
                })
        except Exception:
            pass

        # 2. Anomaly: Sudden drop in insert rate (pg_stat_user_tables uses relname)
        try:
            cursor.execute("""
                SELECT schemaname, relname AS tablename, n_tup_ins
                FROM pg_stat_user_tables
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                ORDER BY n_tup_ins DESC
                LIMIT 20
            """)
            tables = cursor.fetchall()
            if tables:
                avg_inserts = sum(t[2] or 0 for t in tables) / len(tables)
                for table in tables:
                    inserts = table[2] or 0
                    if inserts > 0 and inserts < avg_inserts * 0.1 and avg_inserts > 1000:
                        anomalies.append({
                            "id": f"anomaly_inserts_{table[0]}_{table[1]}",
                            "type": "insert_rate_drop",
                            "severity": "medium",
                            "metric": "insert_rate",
                            "table": f"{table[0]}.{table[1]}",
                            "expected_value": round(avg_inserts, 2),
                            "actual_value": inserts,
                            "deviation_percent": round(((avg_inserts - inserts) / avg_inserts * 100), 2),
                            "timestamp": datetime.now().isoformat(),
                        })
        except Exception:
            pass

        # 3. Anomaly: Unusual table size (pg_stat_user_tables uses relname)
        try:
            cursor.execute("""
                SELECT s.schemaname, s.relname AS tablename,
                       pg_total_relation_size((quote_ident(s.schemaname)||'.'||quote_ident(s.relname))::regclass) AS size_bytes,
                       s.n_live_tup AS row_count
                FROM pg_stat_user_tables s
                WHERE s.schemaname IN ('bronze', 'silver', 'gold')
                  AND s.n_live_tup > 0
                ORDER BY pg_total_relation_size((quote_ident(s.schemaname)||'.'||quote_ident(s.relname))::regclass) DESC
                LIMIT 20
            """)
            size_data = cursor.fetchall()
            if size_data:
                row_sizes = [(s[2] or 0) / (s[3] or 1) for s in size_data if (s[3] or 0) > 0]
                avg_row_size = sum(row_sizes) / len(row_sizes) if row_sizes else 0
                for data in size_data:
                    row_count = data[3] or 0
                    size_bytes = data[2] or 0
                    if row_count > 0 and avg_row_size > 0:
                        row_size = size_bytes / row_count
                        if row_size > avg_row_size * 2:
                            anomalies.append({
                                "id": f"anomaly_size_{data[0]}_{data[1]}",
                                "type": "unusual_row_size",
                                "severity": "low",
                                "metric": "row_size",
                                "table": f"{data[0]}.{data[1]}",
                                "expected_value": round(avg_row_size, 2),
                                "actual_value": round(row_size, 2),
                                "deviation_percent": round(((row_size - avg_row_size) / avg_row_size * 100), 2),
                                "timestamp": datetime.now().isoformat(),
                            })
        except Exception:
            pass

        # 4. Model-based anomalies (trained anomaly_detector.pkl)
        try:
            model_anoms = _detect_model_anomalies(conn, max_rows=1500, max_anomalies=15)
            anomalies = model_anoms + anomalies
        except Exception as e:
            logger.warning("Model anomaly detection failed in /anomalies: %s", e)

        return {
            "anomalies": anomalies,
            "total": len(anomalies),
            "by_type": {
                a["type"]: len([x for x in anomalies if x["type"] == a["type"]])
                for a in anomalies
            },
        }
    finally:
        cursor.close()


def _sync_compute_anomalies_dict() -> dict:
    with get_db_connection() as conn:
        return _compute_anomalies_payload(conn)


def _sync_fetch_incidents_dict() -> dict:
    """Rebuild incidents from current active alerts, persist, then return DB-backed rows."""
    with get_db_connection() as conn:
        _ensure_monitoring_alert_tables(conn)
        active = build_active_alerts_payload(conn)
        try:
            sync_incidents_to_db(conn, list(active.get("alerts") or []))
            return fetch_incidents_from_db(conn)
        except Exception as e:
            logger.exception("GET /incidents sync failed: %s", e)
            return {"incidents": [], "total": 0, "open": 0, "resolved": 0}


def _sync_alerts_page_bundle_payload() -> dict:
    """One DB connection: active alerts + anomalies + DB-backed incidents (synced from active snapshot)."""
    with get_db_connection() as conn:
        active = build_active_alerts_payload(conn)
        anomalies = _compute_anomalies_payload(conn)
        incidents: Dict[str, Any] = {
            "incidents": [],
            "total": 0,
            "open": 0,
            "resolved": 0,
        }
        try:
            sync_incidents_to_db(conn, list(active.get("alerts") or []))
            incidents = fetch_incidents_from_db(conn)
        except Exception as e:
            logger.exception("Incidents sync/fetch failed; returning empty incidents: %s", e)
    return {"active": active, "anomalies": anomalies, "incidents": incidents}


@router.get("/active")
def get_active_alerts():
    """Get active alerts list with severity.

    This endpoint is defensive: if any individual diagnostic query fails,
    it will skip that signal but still return whatever alerts it can build,
    instead of raising a 500.
    """
    try:
        return _sync_fetch_active_alerts_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching active alerts: {e}")


@router.get("/history")
def get_alert_history(days: int = Query(30, description="Number of days to retrieve")):
    """Recent failed ETL runs and current active signals (no fabricated rows)."""
    days_i = max(1, min(365, int(days)))
    history: List[Dict[str, Any]] = []
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            try:
                cursor.execute(
                    """
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables
                        WHERE table_schema = 'monitoring' AND table_name = 'job_runs'
                    )
                    """
                )
                if cursor.fetchone()[0]:
                    cursor.execute(
                        """
                        SELECT jr.run_id, j.job_name, jr.status, jr.started_at, jr.completed_at,
                               jr.error_message, jr.layer, jr.table_name
                        FROM monitoring.job_runs jr
                        JOIN monitoring.etl_jobs j ON j.job_id = jr.job_id
                        WHERE jr.status IN ('failed', 'error')
                          AND jr.started_at >= (CURRENT_TIMESTAMP - (%s * INTERVAL '1 day'))
                        ORDER BY jr.started_at DESC
                        LIMIT 200
                        """,
                        (days_i,),
                    )
                    for row in cursor.fetchall():
                        run_id, job_name, status, started_at, completed_at, err, layer, table_name = row
                        ts = started_at.isoformat() if hasattr(started_at, "isoformat") else str(started_at)
                        end = completed_at.isoformat() if completed_at and hasattr(completed_at, "isoformat") else None
                        res_sec = None
                        if started_at and completed_at:
                            try:
                                res_sec = (completed_at - started_at).total_seconds()
                            except (TypeError, AttributeError):
                                res_sec = None
                        history.append(
                            {
                                "alert_id": f"hist_etl_{run_id}",
                                "type": "etl_failure",
                                "severity": "high",
                                "title": f"ETL {status}: {job_name or run_id}",
                                "message": (err or "Run failed")[:2000],
                                "occurred_at": ts,
                                "resolved_at": end,
                                "resolution_time_seconds": res_sec,
                                "status": "failed",
                                "layer": layer,
                                "table": table_name,
                            }
                        )
            except Exception:
                pass
            finally:
                try:
                    cursor.close()
                except Exception:
                    pass

        active_response = _sync_fetch_active_alerts_dict()
        for alert in active_response.get("alerts") or []:
            history.append(
                {
                    **alert,
                    "occurred_at": alert.get("timestamp"),
                    "resolved_at": None,
                    "resolution_time_seconds": None,
                    "status": alert.get("status") or "active",
                }
            )

        def _occ_key(x: Dict[str, Any]) -> str:
            return str(x.get("occurred_at") or x.get("timestamp") or "")

        history_sorted = sorted(history, key=_occ_key, reverse=True)
        return {
            "history": history_sorted,
            "total": len(history_sorted),
            "resolved": len([h for h in history_sorted if h.get("resolved_at")]),
            "active": len([h for h in history_sorted if not h.get("resolved_at") and h.get("status") == "active"]),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/anomalies")
def get_anomalies():
    """Get anomaly detection visualizations data.

    Anomalies are detected from:
    - Recent failed ETL runs (monitoring.job_runs, last 7 days)
    - Insert rate drop (tables with very low n_tup_ins vs average; requires avg > 1000)
    - Unusual row size (tables with row size > 2x average)
    """
    try:
        return _sync_compute_anomalies_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/incidents")
def get_incidents():
    """Incident roll-ups persisted in monitoring.incidents (synced from active alerts each fetch)."""
    try:
        return _sync_fetch_incidents_dict()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/acknowledge/{alert_id}")
def acknowledge_alert(alert_id: str):
    """Persist acknowledgment in monitoring.alert_acknowledgments (survives API restarts)."""
    aid = (alert_id or "").strip()
    if not aid:
        raise HTTPException(status_code=400, detail="alert_id is required")
    try:
        with get_db_connection() as conn:
            _ensure_monitoring_alert_tables(conn)
            cur = conn.cursor()
            try:
                cur.execute(
                    """
                    INSERT INTO monitoring.alert_acknowledgments (alert_id, acknowledged_at)
                    VALUES (%s, NOW())
                    ON CONFLICT (alert_id) DO UPDATE SET acknowledged_at = EXCLUDED.acknowledged_at;
                    """,
                    (aid,),
                )
            finally:
                cur.close()
        return {
            "alert_id": aid,
            "acknowledged": True,
            "acknowledged_at": datetime.now().isoformat(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("acknowledge failed for %s", aid)
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.post("/acknowledge-batch")
def acknowledge_alerts_batch(body: AcknowledgeBatchBody):
    """Persist multiple acknowledgments in one request (same table as single acknowledge)."""
    cleaned = sorted({str(x).strip() for x in body.alert_ids if str(x).strip()})
    if not cleaned:
        return {"acknowledged": [], "count": 0}
    try:
        with get_db_connection() as conn:
            _ensure_monitoring_alert_tables(conn)
            cur = conn.cursor()
            try:
                execute_batch(
                    cur,
                    """
                    INSERT INTO monitoring.alert_acknowledgments (alert_id, acknowledged_at)
                    VALUES (%s, NOW())
                    ON CONFLICT (alert_id) DO UPDATE SET acknowledged_at = EXCLUDED.acknowledged_at;
                    """,
                    [(aid,) for aid in cleaned],
                    page_size=500,
                )
            finally:
                cur.close()
        now = datetime.now().isoformat()
        return {
            "acknowledged": [{"alert_id": aid, "acknowledged": True, "acknowledged_at": now} for aid in cleaned],
            "count": len(cleaned),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("acknowledge-batch failed for %s ids", len(cleaned))
        raise HTTPException(status_code=500, detail=str(e)) from e


@router.get("/config")
def get_alert_config():
    """Merged alert rules (defaults + runtime overrides for this API process)."""
    return {"configs": _merged_alert_config_list()}


def _parse_alert_config_body(body: Any) -> List[AlertConfig]:
    """Accept {configs: []}, {config: []}, a single object, or a raw list."""
    if isinstance(body, list):
        return [AlertConfig(**x) for x in body]
    if not isinstance(body, dict):
        raise ValueError("Invalid JSON body")
    if "configs" in body and isinstance(body["configs"], list):
        return [AlertConfig(**x) for x in body["configs"]]
    if "config" in body and isinstance(body["config"], list):
        return [AlertConfig(**x) for x in body["config"]]
    if "alert_type" in body:
        return [AlertConfig(**body)]
    raise ValueError("Expected alert config, {configs: [...]}, or {config: [...]}")


@router.post("/config")
def update_alert_config(body: Any = Body(...)):
    """Update one or more alert rules (stored in memory until API restart)."""
    try:
        items = _parse_alert_config_body(body)
    except Exception as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    for c in items:
        _runtime_alert_overrides[c.alert_type] = {
            "enabled": c.enabled,
            "threshold": float(c.threshold),
            "severity": c.severity,
        }
    return {
        "message": "Alert configuration updated",
        "configs": _merged_alert_config_list(),
    }


@router.get("/page-bundle")
def get_alerts_page_bundle():
    """One browser round-trip and one DB connection: active + anomalies + incidents."""
    try:
        return _sync_alerts_page_bundle_payload()
    except Exception as e:
        logger.error("alerts page-bundle failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e

