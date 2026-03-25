"""
Alert Routes
API routes for alerting, incidents, and anomaly detection.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List
from datetime import datetime, timedelta
from pydantic import BaseModel
from ml_optimization.utils.db_utils import get_db_connection

router = APIRouter()


class AlertConfig(BaseModel):
    alert_type: str
    threshold: float
    enabled: bool = True
    severity: str = "medium"


@router.get("/active")
async def get_active_alerts():
    """Get active alerts list with severity.

    This endpoint is defensive: if any individual diagnostic query fails,
    it will skip that signal but still return whatever alerts it can build,
    instead of raising a 500.
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()

            alerts = []

            # 1. Tables with no data (pg_stat_user_tables uses relname, not tablename)
            try:
                cursor.execute("""
                    SELECT schemaname, relname AS tablename
                    FROM pg_stat_user_tables
                    WHERE schemaname IN ('bronze', 'silver', 'gold')
                    AND n_live_tup = 0
                """)
                empty_tables = cursor.fetchall()
                for table in empty_tables:
                    alerts.append({
                        "alert_id": f"empty_table_{table[0]}_{table[1]}",
                        "type": "empty_table",
                        "severity": "warning",
                        "title": f"Empty table detected: {table[0]}.{table[1]}",
                        "message": f"The table {table[1]} in {table[0]} layer has no data. ETL process may have failed.",
                        "timestamp": datetime.now().isoformat(),
                        "status": "active",
                        "acknowledged": False,
                    })
            except Exception:
                # If this diagnostic fails, continue with others.
                pass

            # 2. High dead tuple ratio (pg_stat_user_tables uses relname)
            try:
                cursor.execute("""
                    SELECT schemaname, relname AS tablename,
                           n_dead_tup::float / NULLIF(n_live_tup + n_dead_tup, 0) * 100 as dead_ratio
                    FROM pg_stat_user_tables
                    WHERE schemaname IN ('bronze', 'silver', 'gold')
                    AND n_dead_tup::float / NULLIF(n_live_tup + n_dead_tup, 0) > 0.1
                """)
                dead_tuple_issues = cursor.fetchall()
                for issue in dead_tuple_issues:
                    alerts.append({
                        "alert_id": f"dead_tuples_{issue[0]}_{issue[1]}",
                        "type": "data_quality",
                        "severity": "medium",
                        "title": f"High dead tuple ratio: {issue[0]}.{issue[1]}",
                        "message": f"Table {issue[1]} has {round(issue[2] or 0.0, 2)}% dead tuples. Consider running VACUUM.",
                        "timestamp": datetime.now().isoformat(),
                        "status": "active",
                        "acknowledged": False,
                    })
            except Exception:
                pass

            # 3. Cache hit rate below threshold (pg_statio_user_tables uses relname)
            try:
                cursor.execute("""
                    SELECT schemaname, relname AS tablename,
                           heap_blks_hit::float / NULLIF(heap_blks_read + heap_blks_hit, 0) * 100 as hit_rate
                    FROM pg_statio_user_tables
                    WHERE schemaname IN ('bronze', 'silver', 'gold')
                    AND heap_blks_hit::float / NULLIF(heap_blks_read + heap_blks_hit, 0) < 0.70
                    AND (heap_blks_read + heap_blks_hit) > 1000
                """)
                cache_issues = cursor.fetchall()
                for issue in cache_issues:
                    alerts.append({
                        "alert_id": f"cache_poor_{issue[0]}_{issue[1]}",
                        "type": "performance",
                        "severity": "low",
                        "title": f"Low cache hit rate: {issue[0]}.{issue[1]}",
                        "message": f"Table {issue[1]} has only {round(issue[2] or 0.0, 2)}% cache hit rate. Consider index optimization.",
                        "timestamp": datetime.now().isoformat(),
                        "status": "active",
                        "acknowledged": False,
                    })
            except Exception:
                pass

            # 4. Large tables (pg_tables has tablename; use regclass for size)
            try:
                cursor.execute("""
                    SELECT schemaname, tablename,
                           pg_total_relation_size((quote_ident(schemaname)||'.'||quote_ident(tablename))::regclass) AS size_bytes
                    FROM pg_tables
                    WHERE schemaname IN ('bronze', 'silver', 'gold')
                    AND pg_total_relation_size((quote_ident(schemaname)||'.'||quote_ident(tablename))::regclass) > 5368709120
                    ORDER BY pg_total_relation_size((quote_ident(schemaname)||'.'||quote_ident(tablename))::regclass) DESC
                    LIMIT 5
                """)
                large_tables = cursor.fetchall()
                for table in large_tables:
                    size_gb = (table[2] or 0) / (1024**3)
                    alerts.append({
                        "alert_id": f"large_table_{table[0]}_{table[1]}",
                        "type": "storage",
                        "severity": "info",
                        "title": f"Large table: {table[0]}.{table[1]}",
                        "message": f"Table {table[1]} is {round(size_gb, 2)} GB. Consider partitioning or archival.",
                        "timestamp": datetime.now().isoformat(),
                        "status": "active",
                        "acknowledged": False,
                    })
            except Exception:
                pass

            # 5. ETL failures from monitoring.job_runs (real monitoring data)
            try:
                # Check that the ETL job run tracking table exists
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
                    # Recent failed/error job runs
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
                        ORDER BY jr.started_at DESC
                        LIMIT 20
                    """)
                    for job_id, job_name, status, layer, table_name, started_at, completed_at, error_message in cursor.fetchall():
                        ts = started_at or completed_at or datetime.now()
                        alerts.append({
                            "alert_id": f"etl_{status}_{job_id}",
                            "type": "etl_failure",
                            "severity": "high",
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
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error fetching active alerts: {e}")


@router.get("/history")
async def get_alert_history(days: int = Query(30, description="Number of days to retrieve")):
    """Get alert history and resolution times."""
    try:
        # In a real system, this would query from an alerts log table
        # For now, we'll generate history based on current alerts
        active_response = await get_active_alerts()
        
        # Create historical alerts (simulated)
        history = []
        base_time = datetime.now() - timedelta(days=days)
        
        for i in range(10):
            alert_time = base_time + timedelta(days=i * 3)
            resolved_time = alert_time + timedelta(hours=2 + i)
            
            history.append({
                "alert_id": f"hist_{i}",
                "type": "system_check",
                "severity": ["info", "low", "medium"][i % 3],
                "title": f"System check {i+1}",
                "message": f"Automated system check performed",
                "occurred_at": alert_time.isoformat(),
                "resolved_at": resolved_time.isoformat(),
                "resolution_time_seconds": (resolved_time - alert_time).total_seconds(),
                "status": "resolved",
            })
        
        # Add current active alerts to history
        for alert in active_response["alerts"]:
            history.append({
                **alert,
                "occurred_at": alert["timestamp"],
                "resolved_at": None,
                "resolution_time_seconds": None,
            })
        
        return {
            "history": sorted(history, key=lambda x: x["occurred_at"], reverse=True),
            "total": len(history),
            "resolved": len([h for h in history if h.get("status") == "resolved"]),
            "active": len([h for h in history if h.get("status") == "active"]),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/anomalies")
async def get_anomalies():
    """Get anomaly detection visualizations data.

    Anomalies are detected from:
    - Recent failed ETL runs (monitoring.job_runs, last 7 days)
    - Insert rate drop (tables with very low n_tup_ins vs average; requires avg > 1000)
    - Unusual row size (tables with row size > 2x average)
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            anomalies = []

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

            return {
                "anomalies": anomalies,
                "total": len(anomalies),
                "by_type": {
                    a["type"]: len([x for x in anomalies if x["type"] == a["type"]])
                    for a in anomalies
                },
            }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/incidents")
async def get_incidents():
    """Get incident timeline."""
    try:
        # Simulate incident timeline based on alerts
        alerts_response = await get_active_alerts()
        
        incidents = []
        
        # Group alerts by type to create incidents
        alert_groups = {}
        for alert in alerts_response["alerts"]:
            alert_type = alert["type"]
            if alert_type not in alert_groups:
                alert_groups[alert_type] = []
            alert_groups[alert_type].append(alert)
        
        incident_id = 1
        for alert_type, alerts in alert_groups.items():
            if len(alerts) > 0:
                # Determine severity based on alert severities
                severities = [a["severity"] for a in alerts]
                if "critical" in severities or "high" in severities:
                    incident_severity = "high"
                elif "medium" in severities:
                    incident_severity = "medium"
                else:
                    incident_severity = "low"
                
                incidents.append({
                    "incident_id": f"inc_{incident_id}",
                    "title": f"{alert_type.replace('_', ' ').title()} Incident",
                    "severity": incident_severity,
                    "status": "open" if any(a["status"] == "active" for a in alerts) else "resolved",
                    "started_at": min(a["timestamp"] for a in alerts),
                    "resolved_at": None,
                    "affected_tables": [a.get("table", a["title"]) for a in alerts[:5]],
                    "alert_count": len(alerts),
                    "description": f"Multiple {alert_type} alerts detected",
                })
                incident_id += 1
        
        return {
            "incidents": sorted(incidents, key=lambda x: x["started_at"], reverse=True),
            "total": len(incidents),
            "open": len([i for i in incidents if i["status"] == "open"]),
            "resolved": len([i for i in incidents if i["status"] == "resolved"]),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/acknowledge/{alert_id}")
async def acknowledge_alert(alert_id: str):
    """Acknowledge an alert."""
    # In a real system, this would update the alert status in the database
    return {
        "alert_id": alert_id,
        "acknowledged": True,
        "acknowledged_at": datetime.now().isoformat(),
    }


@router.get("/config")
async def get_alert_config():
    """Get alert configuration."""
    # Default alert configurations
    configs = [
        {
            "alert_type": "empty_table",
            "enabled": True,
            "severity": "warning",
            "threshold": 0,
            "description": "Alert when a table has no data",
        },
        {
            "alert_type": "data_quality",
            "enabled": True,
            "severity": "medium",
            "threshold": 10.0,  # 10% dead tuples
            "description": "Alert when dead tuple ratio exceeds threshold",
        },
        {
            "alert_type": "performance",
            "enabled": True,
            "severity": "low",
            "threshold": 70.0,  # 70% cache hit rate
            "description": "Alert when cache hit rate drops below threshold",
        },
        {
            "alert_type": "storage",
            "enabled": True,
            "severity": "info",
            "threshold": 5.0,  # 5GB
            "description": "Alert when table size exceeds threshold",
        },
    ]
    
    return {"configs": configs}


@router.post("/config")
async def update_alert_config(config: AlertConfig):
    """Update alert configuration."""
    # In a real system, this would save to database
    return {
        "message": "Alert configuration updated",
        "config": config.dict(),
    }

