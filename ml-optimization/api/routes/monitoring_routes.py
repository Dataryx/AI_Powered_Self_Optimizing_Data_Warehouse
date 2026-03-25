"""
Monitoring Routes
API routes for ETL monitoring, pipeline status, and data quality metrics.
"""

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
import logging
import os
from pathlib import Path
import subprocess
import sys
from psycopg2.extras import RealDictCursor
from ml_optimization.utils.db_utils import get_db_connection

router = APIRouter()
logger = logging.getLogger(__name__)


def _to_utc_datetime(dt: datetime) -> datetime:
    """Normalize to UTC-aware so we never mix naive vs offset-aware datetimes."""
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)


def _hours_since_reference(last_updated) -> Optional[float]:
    """Hours between now (UTC) and last_updated (datetime from DB or ISO string)."""
    if last_updated is None:
        return None
    if isinstance(last_updated, datetime):
        now = datetime.now(timezone.utc)
        ref = _to_utc_datetime(last_updated)
        return (now - ref).total_seconds() / 3600
    if isinstance(last_updated, str):
        try:
            dt = datetime.fromisoformat(last_updated.replace("Z", "+00:00"))
            now = datetime.now(timezone.utc)
            ref = _to_utc_datetime(dt)
            return (now - ref).total_seconds() / 3600
        except Exception:
            return None
    return None


class RunETLJobRequest(BaseModel):
    """
    Request payload for manually running an ETL job.
    """
    job_name: str = "Complete ETL Pipeline"


@router.get("/etl/jobs")
async def get_etl_jobs():
    """Get ETL job status and progress from tracking table."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Check if monitoring.etl_jobs table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema = 'monitoring' AND table_name = 'etl_jobs'
                )
            """)
            table_exists = cursor.fetchone().get('exists', False)

            # Get all job runs (latest first). Prefer job metadata from etl_jobs when available,
            # but still return runs even if etl_jobs is missing/incomplete.
            if table_exists:
                cursor.execute("""
                    SELECT 
                        jr.run_id AS job_id,          -- keep response field name for frontend
                        COALESCE(j.job_name, jr.table_name, 'ETL Job') AS job_name,
                        COALESCE(j.job_type, 'unknown') AS job_type,
                        jr.status,
                        jr.progress,
                        jr.layer,
                        jr.table_name AS table,
                        jr.started_at,
                        jr.completed_at,
                        jr.records_processed,
                        jr.records_total,
                        jr.error_message,
                        jr.metadata,
                        j.cron_pattern
                    FROM monitoring.job_runs jr
                    LEFT JOIN monitoring.etl_jobs j
                      ON jr.job_id = j.job_id
                    ORDER BY jr.started_at DESC
                """)
            else:
                logger.warning("monitoring.etl_jobs table does not exist; returning runs from monitoring.job_runs only.")
                cursor.execute("""
                    SELECT 
                        jr.run_id AS job_id,
                        COALESCE(jr.table_name, 'ETL Job') AS job_name,
                        'unknown' AS job_type,
                        jr.status,
                        jr.progress,
                        jr.layer,
                        jr.table_name AS table,
                        jr.started_at,
                        jr.completed_at,
                        jr.records_processed,
                        jr.records_total,
                        jr.error_message,
                        jr.metadata,
                        NULL::text AS cron_pattern
                    FROM monitoring.job_runs jr
                    ORDER BY jr.started_at DESC
                """)
            
            jobs = []
            for row in cursor.fetchall():
                started_at = row.get('started_at')
                completed_at = row.get('completed_at')
                duration_seconds = 0
                if started_at and completed_at:
                    try:
                        delta = completed_at - started_at
                        duration_seconds = round(delta.total_seconds(), 2)
                    except (TypeError, AttributeError):
                        pass
                job = {
                    "job_id": row.get('job_id'),
                    "job_name": row.get('job_name'),
                    "status": row.get('status', 'pending'),
                    "progress": int(row.get('progress', 0)),
                    "started_at": started_at.isoformat() if started_at else None,
                    "completed_at": completed_at.isoformat() if completed_at else None,
                    "records_processed": int(row.get('records_processed', 0) or 0),
                    "layer": row.get('layer'),
                    "table": row.get('table'),
                    "cron_pattern": row.get('cron_pattern'),
                    "duration_seconds": duration_seconds,
                }
                jobs.append(job)
            
            return {"jobs": jobs, "total": len(jobs)}
    except Exception as e:
        logger.error(f"Error in get_etl_jobs: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/etl/job-definitions")
async def get_etl_job_definitions():
    """
    Return ETL job definitions from monitoring.etl_jobs.
    This is used for manual 'Run' actions in the UI.
    """
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            cursor.execute("""
                SELECT EXISTS (
                    SELECT 1 FROM information_schema.tables
                    WHERE table_schema = 'monitoring' AND table_name = 'etl_jobs'
                )
            """)
            table_exists = cursor.fetchone().get("exists", False)
            if not table_exists:
                return {"jobs": []}

            cursor.execute("""
                SELECT
                    job_id,
                    job_name,
                    job_type,
                    tables,
                    cron_pattern,
                    active_status
                FROM monitoring.etl_jobs
                ORDER BY job_name
            """)
            jobs = cursor.fetchall()
            return {"jobs": jobs, "total": len(jobs)}
    except Exception as e:
        logger.error(f"Error in get_etl_job_definitions: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/etl/run")
async def run_etl_job(payload: RunETLJobRequest):
    """
    Manually run a specific ETL job.
    This dispatches the corresponding script once (no scheduler loop).
    """
    job_name = (payload.job_name or "").strip()
    if not job_name:
        raise HTTPException(status_code=400, detail="job_name is required")

    # Determine script to execute
    create_no_window = getattr(subprocess, "CREATE_NO_WINDOW", 0) if sys.platform == "win32" else 0
    project_root = Path(__file__).resolve().parents[3]
    etl_scripts_dir = project_root / "etl" / "scripts"

    cmd: list[str]
    if job_name == "Complete ETL Pipeline":
        cmd = [sys.executable, str(etl_scripts_dir / "run_etl.py")]
    elif job_name == "BRONZE - Shopping Orders Ingestion":
        cmd = [sys.executable, str(etl_scripts_dir / "populate_bronze_shopping_every_minute.py"), "--once"]
    elif job_name == "BRONZE - Random Bronze Tables Populator (100)":
        cmd = [
            sys.executable,
            str(etl_scripts_dir / "populate_bronze_random_tables_with_orders_items.py"),
            "--once",
            "--count",
            "100",
        ]
    else:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown/unsupported job_name for manual run: {job_name}",
        )

    # Optional safety: respect active_status and prevent duplicate concurrent runs.
    # If a previous run crashed and left `status='running'`, we treat it as stale
    # after a grace period so manual runs still work.
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)

            stale_running_minutes = int(os.getenv("ETL_STALE_RUNNING_MINUTES", "360"))

            # Check if job is configured inactive
            cursor.execute(
                """
                SELECT active_status, job_type
                FROM monitoring.etl_jobs
                WHERE job_name = %s
                ORDER BY job_type
                LIMIT 1
                """,
                (job_name,),
            )
            job_row = cursor.fetchone()
            if job_row and (str(job_row.get("active_status") or "").strip().upper() == "I"):
                return {"status": "skipped_inactive", "job_name": job_name}

            cursor.execute(
                """
                SELECT jr.run_id, jr.started_at
                FROM monitoring.job_runs jr
                JOIN monitoring.etl_jobs j ON jr.job_id = j.job_id
                WHERE j.job_name = %s
                  AND jr.status = 'running'
                ORDER BY jr.started_at DESC NULLS LAST
                LIMIT 1
                """,
                (job_name,),
            )
            running_row = cursor.fetchone()
            if running_row:
                running_started_at = running_row.get("started_at")
                is_stale = False
                if running_started_at:
                    try:
                        age_minutes = (datetime.now() - running_started_at).total_seconds() / 60.0
                        is_stale = age_minutes >= stale_running_minutes
                    except Exception:
                        # If timestamp math fails, be conservative and block.
                        is_stale = False

                if not is_stale:
                    return {
                        "status": "already_running",
                        "job_name": job_name,
                        "running_job_run_id": running_row.get("run_id"),
                        "running_started_at": running_started_at.isoformat() if running_started_at else None,
                        "stale_running_minutes": stale_running_minutes,
                    }

                stale_rid = running_row.get("run_id")
                stale_msg = (
                    f"Stale run cleared (>{stale_running_minutes}m without completion); "
                    "may have lost DB connection or crashed. Marked failed so a new run can start."
                )
                cursor.execute(
                    """
                    UPDATE monitoring.job_runs
                    SET status = 'failed',
                        error_message = %s,
                        completed_at = CURRENT_TIMESTAMP,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE run_id = %s AND status = 'running'
                    """,
                    (stale_msg, stale_rid),
                )
                logger.warning(
                    "Found stale running ETL job; marked failed and allowing dispatch. job_name=%s run_id=%s started_at=%s stale_running_minutes=%s",
                    job_name,
                    stale_rid,
                    running_started_at,
                    stale_running_minutes,
                )
    except Exception:
        # If monitoring tables aren't ready yet, still try to dispatch the script once.
        logger.warning("Safety checks for ETL job run failed; dispatching anyway.", exc_info=True)

    # Fire-and-forget dispatch (do not block API request)
    env = os.environ.copy()

    # Best-effort: use the exact DB connection parameters that *this API*
    # can successfully connect with. This avoids mismatches like passing
    # `localhost` when Postgres is actually running in a Docker service.
    postgres_env: Optional[dict[str, str]] = None
    try:
        with get_db_connection() as conn:
            dsn_params = conn.get_dsn_parameters()  # includes host/port/dbname/user/password
            postgres_env = {
                "POSTGRES_HOST": str(dsn_params.get("host") or ""),
                "POSTGRES_PORT": str(dsn_params.get("port") or ""),
                "POSTGRES_DB": str(dsn_params.get("dbname") or ""),
                "POSTGRES_USER": str(dsn_params.get("user") or ""),
                "POSTGRES_PASSWORD": str(dsn_params.get("password") or ""),
            }
            # Drop empty values so we don't override valid env with "".
            postgres_env = {k: v for k, v in postgres_env.items() if v}
    except Exception:
        logger.warning("Could not derive Postgres env from API DB connection; using process env/defaults.", exc_info=True)

    if postgres_env:
        env.update(postgres_env)
    else:
        # Fallbacks only. Prefer derived env above.
        env.setdefault("POSTGRES_HOST", "localhost")
        env.setdefault("POSTGRES_PORT", "5432")
        env.setdefault("POSTGRES_DB", "datawarehouse")
        env.setdefault("POSTGRES_USER", "postgres")
        env.setdefault("POSTGRES_PASSWORD", "postgres")

    proc = subprocess.Popen(
        cmd,
        cwd=str(project_root),
        creationflags=create_no_window,
        env=env,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    logger.info("Dispatched manual ETL run: %s", job_name)
    return {"status": "started", "job_name": job_name, "pid": getattr(proc, "pid", None)}


@router.get("/etl/pipeline-dag")
async def get_pipeline_dag():
    """Get pipeline DAG visualization data."""
    try:
        # Define the ETL pipeline structure
        dag = {
            "nodes": [
                {"id": "bronze_ingest", "label": "Bronze Ingestion", "type": "source", "layer": "bronze"},
                {"id": "bronze_raw_orders", "label": "raw_orders", "type": "table", "layer": "bronze"},
                {"id": "bronze_raw_customers", "label": "raw_customers", "type": "table", "layer": "bronze"},
                {"id": "bronze_raw_products", "label": "raw_products", "type": "table", "layer": "bronze"},
                {"id": "silver_transform", "label": "Silver Transformation", "type": "transform", "layer": "silver"},
                {"id": "silver_orders", "label": "orders", "type": "table", "layer": "silver"},
                {"id": "silver_customers", "label": "customers", "type": "table", "layer": "silver"},
                {"id": "silver_products", "label": "products", "type": "table", "layer": "silver"},
                {"id": "gold_aggregate", "label": "Gold Aggregation", "type": "aggregate", "layer": "gold"},
                {"id": "gold_fact_sales", "label": "fact_sales", "type": "table", "layer": "gold"},
                {"id": "gold_dim_customer", "label": "dim_customer", "type": "table", "layer": "gold"},
                {"id": "gold_dim_product", "label": "dim_product", "type": "table", "layer": "gold"},
            ],
            "edges": [
                {"from": "bronze_ingest", "to": "bronze_raw_orders"},
                {"from": "bronze_ingest", "to": "bronze_raw_customers"},
                {"from": "bronze_ingest", "to": "bronze_raw_products"},
                {"from": "bronze_raw_orders", "to": "silver_transform"},
                {"from": "bronze_raw_customers", "to": "silver_transform"},
                {"from": "bronze_raw_products", "to": "silver_transform"},
                {"from": "silver_transform", "to": "silver_orders"},
                {"from": "silver_transform", "to": "silver_customers"},
                {"from": "silver_transform", "to": "silver_products"},
                {"from": "silver_orders", "to": "gold_aggregate"},
                {"from": "silver_customers", "to": "gold_aggregate"},
                {"from": "silver_products", "to": "gold_aggregate"},
                {"from": "gold_aggregate", "to": "gold_fact_sales"},
                {"from": "gold_aggregate", "to": "gold_dim_customer"},
                {"from": "gold_aggregate", "to": "gold_dim_product"},
            ]
        }
        
        return dag
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/etl/freshness")
async def get_data_freshness():
    """Get data freshness indicators per layer using real table data and ETL job completion times."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            freshness = {}
            all_datasets = []
            on_time = 0
            at_risk = 0
            sla_breach_count = 0
            unknown_count = 0
            status_to_label = {"fresh": "On time", "stale": "At risk", "outdated": "Breach", "unknown": "Unknown"}
            # Must match hours_ago thresholds below and sla_policy in the JSON response
            SLA_FRESH_H = 1.0
            SLA_STALE_H = 6.0

            # First, get ETL job completion times for each table from job_runs (primary source of truth)
            etl_completion_times = {}
            etl_records_processed = {}
            try:
                cursor.execute("""
                    SELECT 
                        layer,
                        table_name,
                        MAX(completed_at) as last_completed,
                        SUM(records_processed) as total_records
                    FROM monitoring.job_runs
                    WHERE status = 'completed' AND completed_at IS NOT NULL
                    GROUP BY layer, table_name
                """)
                for row in cursor.fetchall():
                    layer = row.get('layer')
                    table_name = row.get('table_name')
                    last_completed = row.get('last_completed')
                    total_records = row.get('total_records', 0)
                    if layer and table_name and last_completed:
                        key = f"{layer}.{table_name}"
                        etl_completion_times[key] = last_completed
                        etl_records_processed[key] = int(total_records or 0)
                logger.info(f"Found {len(etl_completion_times)} tables with ETL job data")
            except Exception as etl_error:
                logger.warning(f"Could not fetch ETL completion times: {etl_error}", exc_info=True)
            
            for schema in ['bronze', 'silver', 'gold']:
                try:
                    # Start with tables from ETL jobs (most reliable)
                    etl_tables = {}
                    for key, last_completed in etl_completion_times.items():
                        if key.startswith(f"{schema}."):
                            table_name = key.replace(f"{schema}.", "")
                            etl_tables[table_name] = {
                                'last_updated': last_completed,
                                'total_records': etl_records_processed.get(key, 0)
                            }
                    
                    # Check if schema exists and get actual tables
                    cursor.execute("""
                        SELECT EXISTS (
                            SELECT 1 FROM information_schema.schemata 
                            WHERE schema_name = %s
                        )
                    """, (schema,))
                    schema_exists = cursor.fetchone().get('exists', False)
                    
                    table_names_set = set(etl_tables.keys())  # Start with ETL job tables
                    
                    if schema_exists:
                        # Get all tables in the schema
                        cursor.execute("""
                            SELECT table_name
                            FROM information_schema.tables
                            WHERE table_schema = %s
                            AND table_type = 'BASE TABLE'
                            ORDER BY table_name
                        """, (schema,))
                        
                        db_tables = [row.get('table_name') for row in cursor.fetchall()]
                        table_names_set.update(db_tables)
                        logger.info(f"Found {len(db_tables)} tables in schema {schema}: {db_tables}")
                    
                    table_names = list(table_names_set)
                    table_freshness = []
                    
                    for table_name in table_names:
                        if not table_name:
                            continue
                            
                        last_updated = None
                        total_records = 0
                        activity_signal = None  # "etl" | "column" | "pg_stat" | None until classified
                        source_column = None
                        signal_candidates = []  # list[tuple[str, datetime|str, Optional[str]]]
                        
                        # Candidate 1: latest successful ETL completion for this table
                        etl_key = f"{schema}.{table_name}"
                        if etl_key in etl_completion_times:
                            signal_candidates.append(("etl", etl_completion_times[etl_key], None))
                            if etl_key in etl_records_processed:
                                total_records = etl_records_processed[etl_key]
                        
                        # Candidate 2: manual/automatic row-level updates from known timestamp columns.
                        # We collect all candidates and later pick whichever is newest.
                        timestamp_columns = [
                            'ingestion_timestamp',
                            'created_at',
                            'updated_at',
                            'order_date',
                            'event_timestamp',
                            'start_time',
                            'date',
                            'timestamp'
                        ]
                        latest_column_ts = None
                        latest_column_name = None
                        for col in timestamp_columns:
                            try:
                                cursor.execute("""
                                    SELECT EXISTS (
                                        SELECT 1 FROM information_schema.columns
                                        WHERE table_schema = %s AND table_name = %s AND column_name = %s
                                    )
                                """, (schema, table_name, col))
                                col_exists = cursor.fetchone().get('exists', False)

                                if col_exists:
                                    cursor.execute(f"""
                                        SELECT MAX({col}) as max_ts, COUNT(*) as row_count
                                        FROM {schema}.{table_name}
                                    """)
                                    result = cursor.fetchone()
                                    if result:
                                        row_count = int(result.get('row_count', 0) or 0)
                                        if row_count > 0:
                                            total_records = row_count
                                        max_ts = result.get('max_ts')
                                        if max_ts:
                                            if latest_column_ts is None:
                                                latest_column_ts = max_ts
                                                latest_column_name = col
                                            else:
                                                try:
                                                    if _to_utc_datetime(max_ts) > _to_utc_datetime(latest_column_ts):
                                                        latest_column_ts = max_ts
                                                        latest_column_name = col
                                                except Exception:
                                                    pass
                            except Exception as col_error:
                                logger.debug(f"Error checking column {col} in {schema}.{table_name}: {col_error}")
                                continue
                        if latest_column_ts is not None:
                            signal_candidates.append(("column", latest_column_ts, latest_column_name))
                        
                        # Candidate 3: maintenance/activity from PostgreSQL table stats
                        try:
                            cursor.execute(
                                """
                                SELECT last_vacuum, last_autovacuum, last_analyze, last_autoanalyze, n_live_tup
                                FROM pg_stat_user_tables
                                WHERE schemaname = %s AND relname = %s
                                """,
                                (schema, table_name),
                            )
                            prow = cursor.fetchone()
                            if prow:
                                candidates = [
                                    prow.get("last_autoanalyze"),
                                    prow.get("last_analyze"),
                                    prow.get("last_autovacuum"),
                                    prow.get("last_vacuum"),
                                ]
                                best = None
                                best_utc = None
                                for cand in candidates:
                                    if cand is None or not isinstance(cand, datetime):
                                        continue
                                    try:
                                        cu = _to_utc_datetime(cand)
                                    except Exception:
                                        continue
                                    if best_utc is None or cu > best_utc:
                                        best_utc = cu
                                        best = cand
                                if best is not None:
                                    signal_candidates.append(("pg_stat", best, None))
                                if (not total_records or total_records == 0) and prow.get("n_live_tup") is not None:
                                    total_records = int(prow.get("n_live_tup") or 0)
                        except Exception as stat_err:
                            logger.debug(
                                "pg_stat_user_tables fallback failed for %s.%s: %s",
                                schema,
                                table_name,
                                stat_err,
                            )

                        # Pick the newest timestamp across ETL + manual/column + pg_stat.
                        if signal_candidates:
                            chosen_sig = None
                            chosen_ts = None
                            chosen_col = None
                            for sig, ts, col in signal_candidates:
                                try:
                                    ts_utc = _to_utc_datetime(ts) if isinstance(ts, datetime) else _to_utc_datetime(datetime.fromisoformat(str(ts).replace("Z", "+00:00")))
                                except Exception:
                                    continue
                                if chosen_ts is None:
                                    chosen_sig, chosen_ts, chosen_col = sig, ts_utc, col
                                elif ts_utc > chosen_ts:
                                    chosen_sig, chosen_ts, chosen_col = sig, ts_utc, col
                            if chosen_sig is not None and chosen_ts is not None:
                                activity_signal = chosen_sig
                                source_column = chosen_col
                                last_updated = chosen_ts
                        
                        # If still no timestamp found, we can still compute row_count for display,
                        # but freshness must be marked as "unknown" (no invented timestamps).
                        # If we still don't know when the table was last updated, do NOT invent a timestamp.
                        # We may still compute `total_records`, but status becomes "unknown".
                        if not last_updated:
                            try:
                                cursor.execute(f"SELECT COUNT(*) as row_count FROM {schema}.{table_name}")
                                result = cursor.fetchone()
                                if result:
                                    total_records = int(result.get('row_count', 0) or 0)
                            except Exception:
                                total_records = 0
                        
                        # Calculate hours ago (UTC-normalized; avoids naive/aware subtraction errors)
                        hours_ago = _hours_since_reference(last_updated)
                        
                        # Determine freshness status
                        if hours_ago is None:
                            status = "unknown"
                            color = "neutral"
                        elif hours_ago < SLA_FRESH_H:
                            status = "fresh"
                            color = "success"
                        elif hours_ago < SLA_STALE_H:
                            status = "stale"
                            color = "warning"
                        else:
                            status = "outdated"
                            color = "error"
                        
                        # Format last_updated for display
                        if isinstance(last_updated, datetime):
                            last_updated_iso = last_updated.isoformat()
                        elif isinstance(last_updated, str):
                            last_updated_iso = last_updated
                        else:
                            last_updated_iso = None

                        qn = f"{schema}.{table_name}"
                        reason_lines = []
                        sig = activity_signal or "unknown"
                        if activity_signal == "etl":
                            reason_lines.append(
                                f"{qn}: Freshness clock picked from monitoring.job_runs (latest successful completed_at). "
                                f"This was newer than other available signals."
                            )
                        elif activity_signal == "column" and source_column:
                            reason_lines.append(
                                f"{qn}: Freshness clock picked from MAX({source_column}) — newest row-level timestamp "
                                f"(manual or automatic updates). This was newer than ETL/pg_stat signals."
                            )
                        elif activity_signal == "pg_stat":
                            reason_lines.append(
                                f"{qn}: Freshness clock picked from pg_stat_user_tables "
                                f"(latest of analyze / autoanalyze / vacuum / autovacuum) because it was the newest "
                                f"available activity signal."
                            )
                        else:
                            reason_lines.append(
                                f"{qn}: No usable timestamp — cannot measure age. Row count uses COUNT(*) or n_live_tup."
                            )

                        if hours_ago is not None:
                            reason_lines.append(
                                f"Age: {hours_ago:.2f} hours since that clock time (UTC vs now)."
                            )
                            if status == "fresh":
                                reason_lines.append(
                                    f"SLA: under {SLA_FRESH_H:g}h → On time."
                                )
                            elif status == "stale":
                                reason_lines.append(
                                    f"SLA: {SLA_FRESH_H:g}h–{SLA_STALE_H:g}h → At risk."
                                )
                            elif status == "outdated":
                                reason_lines.append(
                                    f"SLA: {SLA_STALE_H:g}h or more → Breach."
                                )
                        else:
                            reason_lines.append("SLA: Unknown — no age, so policy cannot assign fresh/stale/breach.")
                        
                        table_freshness.append({
                            "table": table_name,
                            "last_updated": last_updated_iso,
                            "hours_ago": (round(hours_ago, 2) if hours_ago is not None else None),
                            "status": status,
                            "color": color,
                            "total_records": total_records,
                            "activity_signal": sig,
                            "source_column": source_column,
                            "reason_lines": reason_lines,
                        })
                    
                    # Sort by hours_ago (most recent first)
                    table_freshness.sort(key=lambda x: x['hours_ago'] if x['hours_ago'] is not None else float('inf'))

                    # Accumulate full datasets and SLA counts for dashboard (all tables, not just 10)
                    for t in table_freshness:
                        status = t.get("status") or "unknown"
                        ha = t.get("hours_ago")
                        if status == "fresh":
                            on_time += 1
                        elif status == "stale":
                            at_risk += 1
                        elif status == "unknown":
                            unknown_count += 1
                        else:
                            sla_breach_count += 1
                        name = t.get("table") or "unknown"
                        if ha is None:
                            last_updated_str = "—"
                        else:
                            last_updated_str = f"{int(ha)}h ago" if ha < 24 else f"{int(ha / 24)}d ago"
                        all_datasets.append({
                            "name": name,
                            "layer": schema,
                            "sla_lag": status_to_label.get(status, status),
                            "last_updated": last_updated_str,
                            "last_updated_at": t.get("last_updated"),
                            "records": t.get("total_records", 0),
                            "status": status,
                            "hours_ago": ha,
                            "activity_signal": t.get("activity_signal"),
                            "source_column": t.get("source_column"),
                            "reason_lines": t.get("reason_lines") or [],
                        })
                    
                    # Determine overall status
                    # If we couldn't determine freshness for any table, mark the layer as unknown
                    # instead of guessing stale/outdated.
                    any_unknown = any(t.get("status") == "unknown" for t in table_freshness)
                    if not table_freshness:
                        overall_status = "outdated"
                    elif any_unknown:
                        overall_status = "unknown"
                    elif all(t["status"] == "fresh" for t in table_freshness[:3]):
                        overall_status = "fresh"
                    elif all(t["status"] != "outdated" for t in table_freshness[:3]):
                        overall_status = "stale"
                    else:
                        overall_status = "outdated"
                    
                    freshness[schema] = {
                        "tables": table_freshness[:10],  # Limit to top 10 most recent for legacy shape
                        "overall_status": overall_status,
                    }
                except Exception as schema_error:
                    logger.error(f"Error processing freshness for schema {schema}: {schema_error}", exc_info=True)
                    freshness[schema] = {
                        "tables": [],
                        "overall_status": "outdated",
                    }
            # For dashboard ETL metrics: layers meeting freshness SLA (fresh = on time)
            layers_status = [freshness.get(s, {}).get("overall_status") for s in ("bronze", "silver", "gold")]
            sla_met = sum(1 for st in layers_status if st == "fresh")
            sla_total = len(layers_status)
            total_datasets = len(all_datasets)

            return {
                "freshness": freshness,
                "sla_met": sla_met,
                "sla_total": sla_total,
                "datasets": all_datasets,
                "on_time": on_time,
                "at_risk": at_risk,
                "sla_breach": sla_breach_count,
                "unknown_datasets": unknown_count,
                "total_datasets": total_datasets,
                # Document policy for dashboards (must match logic above: hours_ago)
                "sla_policy": {
                    "fresh_max_hours": SLA_FRESH_H,
                    "stale_max_hours": SLA_STALE_H,
                    "description": "On time if last activity < 1h; at risk if 1h–6h; SLA breach if ≥ 6h; unknown if time unavailable.",
                },
            }
    except Exception as e:
        logger.error(f"Error in get_data_freshness: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/etl/errors")
async def get_etl_errors():
    """Get error and retry tracking information from ETL jobs."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            errors = []
            
            # Get failed ETL runs (primary source of errors)
            try:
                cursor.execute("""
                    SELECT 
                        jr.run_id AS job_id,
                        j.job_name,
                        j.job_type,
                        jr.layer,
                        jr.table_name,
                        jr.status,
                        jr.error_message,
                        jr.started_at,
                        jr.completed_at,
                        jr.progress,
                        jr.records_processed
                    FROM monitoring.job_runs jr
                    JOIN monitoring.etl_jobs j
                      ON jr.job_id = j.job_id
                    WHERE jr.status = 'failed' 
                    AND jr.started_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
                    ORDER BY jr.started_at DESC
                    LIMIT 50
                """)
                
                failed_jobs = cursor.fetchall()
                for job in failed_jobs:
                    error_id = job.get('job_id')
                    error_message = job.get('error_message') or 'ETL job failed'
                    table_name = job.get('table_name')
                    layer = job.get('layer')
                    
                    # Determine severity based on layer and error type
                    if layer == 'gold':
                        severity = 'critical'
                    elif layer == 'silver':
                        severity = 'high'
                    else:
                        severity = 'warning'
                    
                    # Determine error type
                    if 'timeout' in error_message.lower() or 'timeout' in error_message.lower():
                        error_type = 'timeout'
                    elif 'connection' in error_message.lower() or 'network' in error_message.lower():
                        error_type = 'connection'
                    elif 'constraint' in error_message.lower() or 'violation' in error_message.lower():
                        error_type = 'constraint_violation'
                    elif 'null' in error_message.lower() or 'missing' in error_message.lower():
                        error_type = 'data_quality'
                    else:
                        error_type = 'processing_error'
                    
                    errors.append({
                        "error_id": error_id,
                        "type": error_type,
                        "severity": severity,
                        "table": f"{layer}.{table_name}" if layer and table_name else None,
                        "message": error_message[:200],  # Truncate long messages
                        "occurred_at": job.get('started_at').isoformat() if job.get('started_at') else datetime.now().isoformat(),
                        "retry_count": 0,  # Could track retries if we add that field
                        "status": "active",
                        "job_name": job.get('job_name'),
                        "progress": job.get('progress', 0),
                    })
                
                logger.info(f"Found {len(failed_jobs)} failed ETL jobs")
            except Exception as etl_error:
                logger.warning(f"Could not fetch ETL job errors: {etl_error}", exc_info=True)
            
            # Also check for tables with no recent updates (potential issues)
            for schema in ['bronze', 'silver', 'gold']:
                try:
                    cursor.execute("""
                        SELECT table_name
                        FROM information_schema.tables
                        WHERE table_schema = %s
                        AND table_type = 'BASE TABLE'
                    """, (schema,))
                    
                    all_tables = cursor.fetchall()
                    
                    # Check if tables exist but have no data
                    for table in all_tables[:5]:  # Limit to avoid too many errors
                        tablename = table.get('table_name')
                        try:
                            cursor.execute(f"SELECT COUNT(*) as cnt FROM {schema}.{tablename}")
                            result = cursor.fetchone()
                            row_count = result.get('cnt', 0) if result else 0
                            
                            # Check if table should have data but doesn't (based on completed ETL runs)
                            cursor.execute("""
                                SELECT COUNT(*) as job_count
                                FROM monitoring.job_runs
                                WHERE layer = %s AND table_name = %s AND status = 'completed'
                            """, (schema, tablename))
                            job_result = cursor.fetchone()
                            has_completed_jobs = (job_result.get('job_count', 0) or 0) > 0 if job_result else False
                            
                            if has_completed_jobs and row_count == 0:
                                errors.append({
                                    "error_id": f"{schema}_{tablename}_empty",
                                    "type": "empty_table",
                                    "severity": "warning",
                                    "table": f"{schema}.{tablename}",
                                    "message": f"Table {tablename} in {schema} layer has no data despite completed ETL jobs",
                                    "occurred_at": datetime.now().isoformat(),
                                    "retry_count": 0,
                                    "status": "active",
                                })
                        except Exception:
                            continue
                except Exception as schema_error:
                    logger.error(f"Error processing errors for schema {schema}: {schema_error}")
                    continue
            
            return {
                "errors": errors,
                "total": len(errors),
                "active": len([e for e in errors if e.get("status") == "active"]),
                "timestamp": datetime.now().isoformat(),
            }
    except Exception as e:
        logger.error(f"Error in get_etl_errors: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/etl/throughput")
async def get_throughput_metrics():
    """Get throughput metrics (records/second) based on ETL job performance."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            throughput_data = []
            
            # Get throughput from ETL job runs (most accurate)
            try:
                cursor.execute("""
                    SELECT 
                        layer,
                        table_name,
                        records_processed,
                        started_at,
                        completed_at,
                        EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds
                    FROM monitoring.job_runs
                    WHERE status = 'completed' 
                    AND completed_at IS NOT NULL 
                    AND started_at IS NOT NULL
                    AND records_processed > 0
                    AND completed_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
                    ORDER BY completed_at DESC
                """)
                
                job_throughput = {}
                for row in cursor.fetchall():
                    layer = row.get('layer')
                    table_name = row.get('table_name')
                    records = int(row.get('records_processed', 0) or 0)
                    duration = float(row.get('duration_seconds', 0) or 0)
                    
                    if not layer or not table_name or records == 0 or duration == 0:
                        continue
                    
                    table_key = f"{layer}.{table_name}"
                    records_per_second = records / duration if duration > 0 else 0
                    
                    # Keep the highest throughput for each table
                    if table_key not in job_throughput or records_per_second > job_throughput[table_key]['records_per_second']:
                        job_throughput[table_key] = {
                            "table": table_key,
                            "layer": layer,
                            "records_per_second": round(records_per_second, 2),
                            "total_records": records,
                            "total_operations": records,
                            "duration_seconds": round(duration, 2),
                        }
                
                throughput_data = list(job_throughput.values())
                logger.info(f"Found {len(throughput_data)} tables with ETL job throughput data")
            except Exception as etl_error:
                logger.warning(f"Could not fetch ETL job throughput: {etl_error}", exc_info=True)
            
            # Fallback to pg_stat_user_tables if no ETL data
            if not throughput_data:
                for schema in ['bronze', 'silver', 'gold']:
                    try:
                        cursor.execute("""
                            SELECT 
                                relname AS tablename,
                                COALESCE(n_tup_ins, 0) as total_inserts,
                                COALESCE(n_tup_upd, 0) as total_updates,
                                COALESCE(n_live_tup, 0) as live_tuples
                            FROM pg_stat_user_tables
                            WHERE schemaname = %s
                            ORDER BY COALESCE(n_tup_ins, 0) DESC
                            LIMIT 5
                        """, (schema,))
                        
                        tables = cursor.fetchall()
                        
                        for table in tables:
                            total_inserts = table.get('total_inserts', 0) or 0
                            total_updates = table.get('total_updates', 0) or 0
                            total_ops = total_inserts + total_updates
                            # Estimate throughput (assuming 1 hour window)
                            estimated_throughput = total_ops / 3600 if total_ops > 0 else 0
                            
                            throughput_data.append({
                                "table": f"{schema}.{table.get('tablename', 'unknown')}",
                                "layer": schema,
                                "records_per_second": round(estimated_throughput, 2),
                                "total_records": table.get('live_tuples', 0) or 0,
                                "total_operations": total_ops,
                                "duration_seconds": 3600,  # Estimated
                            })
                    except Exception as schema_error:
                        logger.error(f"Error processing throughput for schema {schema}: {schema_error}")
                        continue
            
            # Sort by throughput (highest first)
            throughput_data.sort(key=lambda x: x['records_per_second'], reverse=True)
            
            # Calculate overall throughput
            total_throughput = sum(t["records_per_second"] for t in throughput_data)
            
            return {
                "throughput": throughput_data[:10],  # Top 10
                "overall_throughput": round(total_throughput, 2),
                "timestamp": datetime.now().isoformat(),
            }
    except Exception as e:
        logger.error(f"Error in get_throughput_metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/data-quality")
async def get_data_quality_metrics():
    """Get data quality metrics per pipeline stage using real table data and ETL job success rates."""
    try:
        with get_db_connection() as conn:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            quality_metrics = {}
            
            # Get ETL job reliability per table from recent job_runs
            etl_table_metrics = {}
            latest_job_by_table = {}
            try:
                cursor.execute("""
                    SELECT 
                        layer,
                        table_name,
                        COUNT(*) as total_jobs,
                        SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as successful_jobs,
                        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed_jobs,
                        MAX(started_at) as last_job_at
                    FROM monitoring.job_runs
                    WHERE started_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
                    GROUP BY layer, table_name
                """)
                
                for row in cursor.fetchall():
                    layer = row.get('layer')
                    table_name = row.get('table_name')
                    total = int(row.get('total_jobs', 0) or 0)
                    successful = int(row.get('successful_jobs', 0) or 0)
                    failed = int(row.get('failed_jobs', 0) or 0)
                    last_job_at = row.get('last_job_at')
                    
                    if layer and table_name and total > 0:
                        key = f"{layer}.{table_name}"
                        success_rate = (successful / total) * 100
                        etl_table_metrics[key] = {
                            "success_rate": success_rate,
                            "total_jobs": total,
                            "failed_jobs": failed,
                            "last_job_at": last_job_at,
                        }

                # Also keep latest historical ETL timestamp per table so we do not
                # freeze quality at a hard cap when 7-day activity is absent.
                cursor.execute("""
                    SELECT
                        layer,
                        table_name,
                        MAX(started_at) AS last_job_at
                    FROM monitoring.job_runs
                    GROUP BY layer, table_name
                """)
                for row in cursor.fetchall():
                    layer = row.get('layer')
                    table_name = row.get('table_name')
                    last_job_at = row.get('last_job_at')
                    if layer and table_name and last_job_at:
                        latest_job_by_table[f"{layer}.{table_name}"] = last_job_at
            except Exception as etl_error:
                logger.warning(f"Could not fetch ETL success rates: {etl_error}")
                try:
                    conn.rollback()
                except Exception:
                    pass

            for schema in ['bronze', 'silver', 'gold']:
                try:
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    # Get tables from information_schema first
                    cursor.execute("""
                        SELECT table_name
                        FROM information_schema.tables
                        WHERE table_schema = %s
                        AND table_type = 'BASE TABLE'
                        ORDER BY table_name
                        LIMIT 10
                    """, (schema,))
                    
                    table_names = [row.get('table_name') for row in cursor.fetchall()]
                    
                    # If no tables in schema, try to get from ETL job definitions
                    if not table_names:
                        cursor.execute("""
                            SELECT DISTINCT table_name
                            FROM monitoring.job_runs
                            WHERE layer = %s
                            LIMIT 10
                        """, (schema,))
                        table_names = [row.get('table_name') for row in cursor.fetchall()]
                    
                    table_metrics = []
                    
                    for table_name in table_names:
                        if not table_name:
                            continue
                            
                        row_count = 0
                        dead_rows = 0
                        quality_score = 0.0
                        base_quality_score = None
                        
                        # Try to get table statistics
                        try:
                            cursor.execute(f"""
                                SELECT 
                                    COUNT(*) as row_count
                                FROM {schema}.{table_name}
                            """)
                            result = cursor.fetchone()
                            row_count = int(result.get('row_count', 0) or 0) if result else 0
                            
                            # Try to get dead tuples from pg_stat_user_tables (column is relname, not tablename)
                            cursor.execute("""
                                SELECT 
                                    COALESCE(n_live_tup, 0) as live_tup,
                                    COALESCE(n_dead_tup, 0) as dead_tup
                                FROM pg_stat_user_tables
                                WHERE schemaname = %s AND relname = %s
                            """, (schema, table_name))
                            stat_result = cursor.fetchone()
                            if stat_result:
                                live_tup = int(stat_result.get('live_tup', 0) or 0)
                                dead_tup = int(stat_result.get('dead_tup', 0) or 0)
                                if live_tup > 0:
                                    dead_rows = dead_tup
                                    dead_row_percentage = (dead_tup / live_tup) * 100
                                    # Strict storage health score from dead tuple ratio.
                                    base_quality_score = max(0.0, 100.0 - dead_row_percentage)
                                elif row_count > 0:
                                    # Has rows, but no live_tup stats; keep conservative score.
                                    base_quality_score = 70.0
                        except Exception:
                            # If we can't query the table, rollback and use ETL success rate
                            try:
                                conn.rollback()
                            except Exception:
                                pass
                        
                        # Factor in ETL reliability + recency, with strict penalties (with human-readable factors).
                        factors = []
                        quality_score = 0.0
                        table_key = f"{schema}.{table_name}"
                        etl_meta = etl_table_metrics.get(table_key)
                        if etl_meta:
                            etl_rate = float(etl_meta.get("success_rate", 0.0) or 0.0)
                            total_jobs = int(etl_meta.get("total_jobs", 0) or 0)
                            failed_jobs = int(etl_meta.get("failed_jobs", 0) or 0)
                            last_job_at = etl_meta.get("last_job_at")

                            storage_component = base_quality_score if base_quality_score is not None else (60.0 if row_count > 0 else 30.0)
                            factors.append(
                                f"Storage component {storage_component:.1f}/100 — from pg_stat_user_tables dead/live "
                                f"tuples (or fallback when stats missing)."
                            )
                            factors.append(
                                f"ETL success rate (7d): {etl_rate:.1f}% over {total_jobs} run(s) in monitoring.job_runs."
                            )

                            quality_score = (storage_component * 0.55) + (etl_rate * 0.45)
                            factors.append(
                                f"Weighted blend: 0.55×storage + 0.45×ETL = {quality_score:.2f} (before penalties)."
                            )

                            if total_jobs > 0:
                                failure_ratio = failed_jobs / total_jobs
                                pen = failure_ratio * 25.0
                                quality_score -= pen
                                if pen > 0:
                                    factors.append(
                                        f"Failure penalty: −{pen:.1f} pts ({failed_jobs}/{total_jobs} runs failed)."
                                    )

                            hrs_etl = _hours_since_reference(last_job_at)
                            if hrs_etl is not None:
                                if hrs_etl > 72:
                                    quality_score -= 15.0
                                    factors.append(
                                        f"Stale ETL penalty: −15 pts (last job ~{hrs_etl:.1f}h ago, threshold 72h)."
                                    )
                                elif hrs_etl > 24:
                                    quality_score -= 8.0
                                    factors.append(
                                        f"ETL aging penalty: −8 pts (last job ~{hrs_etl:.1f}h ago, threshold 24h)."
                                    )
                                else:
                                    factors.append(
                                        f"Last ETL job ~{hrs_etl:.1f}h ago — within 24h, no staleness penalty."
                                    )
                            elif last_job_at is not None:
                                factors.append("Last job timestamp present but age could not be computed.")
                        else:
                            factors.append(
                                "No monitoring.job_runs activity in the last 7 days for this table — conservative scoring."
                            )
                            if row_count == 0:
                                quality_score = 20.0
                                factors.append("Table is empty (0 rows) → low baseline score.")
                            elif base_quality_score is not None:
                                quality_score = float(base_quality_score)
                                factors.append(
                                    f"Storage-only signal {base_quality_score:.1f}% used directly (no 65% hard cap)."
                                )
                            else:
                                quality_score = 50.0
                                factors.append("No storage stats and no ETL rows — neutral 50%.")

                            # Apply aging penalty using latest historical ETL activity if available.
                            hist_last_job_at = latest_job_by_table.get(table_key)
                            hrs_hist = _hours_since_reference(hist_last_job_at)
                            if hrs_hist is not None:
                                if hrs_hist > 72:
                                    quality_score -= 12.0
                                    factors.append(
                                        f"Historical ETL staleness penalty: −12 pts (latest run ~{hrs_hist:.1f}h ago, no 7d runs)."
                                    )
                                elif hrs_hist > 24:
                                    quality_score -= 6.0
                                    factors.append(
                                        f"Historical ETL aging penalty: −6 pts (latest run ~{hrs_hist:.1f}h ago, no 7d runs)."
                                    )
                                else:
                                    factors.append(
                                        f"Latest historical ETL run ~{hrs_hist:.1f}h ago."
                                    )
                            else:
                                factors.append("No ETL timestamp available for this table.")

                        quality_score = max(0.0, min(100.0, quality_score))
                        
                        table_metrics.append({
                            "table": table_name,
                            "row_count": row_count,
                            "dead_rows": dead_rows,
                            "quality_score": round(quality_score, 2),
                            "status": "excellent" if quality_score >= 95 else "good" if quality_score >= 80 else "fair" if quality_score >= 60 else "poor",
                            "factors": factors,
                        })
                    
                    # Calculate average quality for layer
                    avg_quality = sum(t["quality_score"] for t in table_metrics) / len(table_metrics) if table_metrics else 0
                    
                    quality_metrics[schema] = {
                        "tables": table_metrics,
                        "average_quality_score": round(avg_quality, 2),
                        "overall_status": "excellent" if avg_quality >= 95 else "good" if avg_quality >= 80 else "fair" if avg_quality >= 60 else "poor",
                    }
                except Exception as schema_error:
                    logger.error(f"Error processing quality metrics for schema {schema}: {schema_error}", exc_info=True)
                    try:
                        conn.rollback()
                    except Exception:
                        pass
                    quality_metrics[schema] = {
                        "tables": [],
                        "average_quality_score": 0,
                        "overall_status": "poor",
                    }

            # Build layers array for dashboard Data Quality panel (real data)
            layer_config = {
                "bronze": {"name": "Bronze Layer", "initial": "B", "color": "#e07a3a"},
                "silver": {"name": "Silver Layer", "initial": "S", "color": "#8a9aaa"},
                "gold": {"name": "Gold Layer", "initial": "G", "color": "#c4a43a"},
            }
            layers = []
            for schema in ("bronze", "silver", "gold"):
                meta = quality_metrics.get(schema, {})
                tables = meta.get("tables", [])
                avg_score = meta.get("average_quality_score", 0) or 0
                overall_status = meta.get("overall_status", "poor")
                cfg = layer_config.get(schema, {"name": schema.capitalize(), "initial": schema[0].upper(), "color": "#5a6a8a"})
                has_issue = overall_status in ("poor", "fair")
                failing_rules = None
                if has_issue and tables:
                    low = [t for t in tables if (t.get("quality_score") or 0) < 80]
                    if low:
                        failing_rules = f"{len(low)} table(s) below 80% quality"
                    else:
                        failing_rules = f"Average quality: {avg_score:.1f}%"
                layers.append({
                    "schema": schema,
                    "name": cfg["name"],
                    "datasets": f"{len(tables)} datasets",
                    "score": round(avg_score, 1),
                    "initial": cfg["initial"],
                    "color": cfg["color"],
                    "failingRules": failing_rules,
                    "hasIssue": has_issue,
                    "overall_status": overall_status,
                })

            return {"quality_metrics": quality_metrics, "layers": layers}
    except Exception as e:
        logger.error(f"Error in get_data_quality_metrics: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

