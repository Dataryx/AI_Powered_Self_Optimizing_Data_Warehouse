"""
Optimization Routes
API routes for optimization operations.
"""

from fastapi import APIRouter, HTTPException, Query, Body
from typing import List, Optional, Dict, Tuple, Any
from datetime import datetime, timedelta, timezone
from pydantic import BaseModel
import asyncio
import logging
import pandas as pd
import numpy as np
import os
from functools import lru_cache
from pathlib import Path
import re
import hashlib
import json
import threading
from concurrent.futures import ThreadPoolExecutor
import joblib
import psycopg2
from psycopg2.extras import RealDictCursor, Json
from ml_optimization.utils.db_utils import get_db_connection, get_db_connection_string

# Model inference (trained artifacts)
from models.query_time_predictor import QueryTimePredictor
from models.anomaly_detector import QueryAnomalyDetector
from models.workload_clustering import WorkloadClusterer
from models.cache_predictor import CachePredictor

router = APIRouter()
logger = logging.getLogger(__name__)

# Log once per process when GET recommendations would use live ML but artifacts are missing.
_live_ml_models_missing_warned = False
_apply_events_schema_ensured = False
_apply_events_schema_lock = threading.Lock()

_IDENT_RE = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")


def _ddl_allowed_schemas() -> frozenset:
    raw = os.environ.get("OPTIMIZATION_DDL_ALLOWED_SCHEMAS", "bronze,silver,gold,public").strip()
    return frozenset(s.strip().lower() for s in raw.split(",") if s.strip())


def _is_safe_sql_ident(name: str) -> bool:
    return bool(name and _IDENT_RE.match(name))


def _parse_qualified_table(table: str) -> Tuple[str, str]:
    """Return (schema, relation) for ``schema.table``; single segment is (public, table)."""
    t = (table or "").strip().replace('"', "")
    if not t:
        raise ValueError("empty table")
    parts = [p.strip() for p in t.split(".") if p.strip()]
    if len(parts) == 1:
        return "public", parts[0]
    # Use last two segments so ``catalog.schema.table``-style strings still resolve.
    return parts[-2], parts[-1]


def _resolve_bare_table_in_allowed_schemas(cursor, bare_relname: str, allowed: frozenset) -> Optional[Tuple[str, str]]:
    """
    When ``table_name`` has no schema (e.g. ``orders``), locate a base/partitioned table
    in allowlisted warehouse schemas. Prefer silver → gold → bronze → public on ambiguity.
    """
    name = (bare_relname or "").strip().replace('"', "")
    if not name or not _is_safe_sql_ident(name):
        return None
    # pg relnames for unquoted identifiers are stored lowercased
    name_l = name.lower()
    schemas = sorted(allowed)
    cursor.execute(
        """
        SELECT n.nspname AS sch, c.relname AS rel
        FROM pg_catalog.pg_class c
        JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relkind IN ('r', 'p', 'm')
          AND n.nspname = ANY(%s)
          AND c.relname = %s
        """,
        (schemas, name_l),
    )
    rows = cursor.fetchall()
    if not rows:
        return None
    if len(rows) == 1:
        r = rows[0]
        return str(r.get("sch", "")).lower(), str(r.get("rel", ""))
    priority = ("silver", "gold", "bronze", "public")

    def rank_row(r) -> Tuple[int, str]:
        sch = str(r.get("sch", "")).lower()
        try:
            return priority.index(sch), sch
        except ValueError:
            return len(priority), sch

    best = min(rows, key=rank_row)
    return str(best.get("sch", "")).lower(), str(best.get("rel", ""))


def _validate_physical_relation(cursor, schema: str, table: str) -> bool:
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1 FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = %s AND c.relname = %s AND c.relkind IN ('r', 'p', 'm')
        ) AS ok
        """,
        (schema, table),
    )
    row = cursor.fetchone()
    return bool(row and row.get("ok"))


def _validate_table_column(cursor, schema: str, table: str, column: str) -> bool:
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_schema = %s AND table_name = %s
              AND lower(column_name) = lower(%s)
        ) AS ok
        """,
        (schema, table, column),
    )
    row = cursor.fetchone()
    return bool(row and row.get("ok"))


def _index_signature_name(schema: str, table: str, column: str) -> str:
    h = hashlib.sha256(f"{schema}.{table}.{column}".encode()).hexdigest()[:14]
    name = f"idx_mlopt_{h}"
    return name[:63]


def _build_create_index_ddl(schema: str, table: str, column: str, concurrent: bool) -> Tuple[str, str]:
    """Server-generated DDL only (never execute client-provided SQL)."""
    idx = _index_signature_name(schema, table, column)
    conc = "CONCURRENTLY " if concurrent else ""
    ddl = f"CREATE INDEX {conc}IF NOT EXISTS {idx} ON {schema}.{table} ({column})"
    return ddl, idx


def _filter_redundant_indexes_in_recommendations_list() -> bool:
    """
    When true, drop index/partition rows whose target column is already the leading column of a
    valid B-tree (same rule as apply 409). Default on so the dashboard does not list work that is
    already done; set OPTIMIZATION_FILTER_REDUNDANT_INDEXES=0 to show all ML/persisted rows anyway.
    Implement still returns 409 if redundant when this filter is off.
    """
    raw = os.environ.get("OPTIMIZATION_FILTER_REDUNDANT_INDEXES", "1").strip().lower()
    return raw not in ("0", "false", "no", "off")


def _min_query_evidence_hits() -> int:
    """Min query_logs rows referencing table+column (0 = disabled). Prod: 2–5."""
    raw = os.environ.get("OPTIMIZATION_MIN_QUERY_EVIDENCE_HITS", "0").strip()
    try:
        return max(0, int(raw))
    except ValueError:
        return 0


def _fallback_min_seq_scan() -> int:
    """Min sequential scans for pg_stat fallback recommendations (prod: 10+)."""
    raw = os.environ.get("OPTIMIZATION_FALLBACK_MIN_SEQ_SCAN", "5").strip()
    try:
        return max(0, int(raw))
    except ValueError:
        return 5


def _partition_fallback_min_rows() -> int:
    """Skip tiny tables for partition hints unless row count reaches this (env)."""
    raw = os.environ.get("OPTIMIZATION_PARTITION_FALLBACK_MIN_ROWS", "1000").strip()
    try:
        return max(0, int(raw))
    except ValueError:
        return 1000


def _partition_fallback_min_mb() -> float:
    """Skip tiny tables for partition hints unless on-disk size (MB) reaches this (env)."""
    raw = os.environ.get("OPTIMIZATION_PARTITION_FALLBACK_MIN_MB", "0.25").strip()
    try:
        return max(0.0, float(raw))
    except ValueError:
        return 0.25


def _optimization_augment_partition_hints_from_workload() -> bool:
    """
    When true (default), add RANGE-partition hints from catalog time/ingest columns for
    warehouse tables that appear in live index ML rows (and, if none, top pg_stat tables).
    """
    raw = os.environ.get("OPTIMIZATION_AUGMENT_PARTITION_HINTS_FROM_WORKLOAD", "1").strip().lower()
    return raw not in ("0", "false", "no", "off")


def _ddl_lock_timeout_ms() -> int:
    raw = os.environ.get("OPTIMIZATION_DDL_LOCK_TIMEOUT_MS", "30000").strip()
    try:
        return max(1000, min(int(raw), 600_000))
    except ValueError:
        return 30_000


def _ddl_statement_timeout_setting() -> Optional[str]:
    """
    e.g. '15min', '0' for unlimited (long CONCURRENTLY builds).
    Empty env = no statement_timeout set (warehouse default).
    """
    raw = os.environ.get("OPTIMIZATION_DDL_STATEMENT_TIMEOUT", "").strip()
    return raw if raw else None


def _query_logs_table_exists(cursor) -> bool:
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'ml_optimization' AND table_name = 'query_logs'
        ) AS ok
        """
    )
    row = cursor.fetchone()
    return bool(row and row.get("ok"))


def _query_log_evidence_hits(cursor, schema: str, table: str, column: str) -> int:
    """Count captured statements that reference both the relation and column (heuristic)."""
    if not _query_logs_table_exists(cursor):
        return 0
    look_sql, look_params = _query_logs_recent_sql_fragment()
    needle_rel = f"{schema}.{table}"
    cursor.execute(
        f"""
        SELECT COUNT(*)::bigint AS c
        FROM ml_optimization.query_logs
        WHERE (query_text ILIKE %s OR COALESCE(query_template, '') ILIKE %s)
          AND (query_text ILIKE %s OR COALESCE(query_template, '') ILIKE %s)
          {look_sql}
        """,
        (f"%{needle_rel}%", f"%{needle_rel}%", f"%{column}%", f"%{column}%", *look_params),
    )
    row = cursor.fetchone()
    return int(row.get("c", 0) if row else 0)


def _index_leading_column_already_indexed(cursor, schema: str, table: str, column: str) -> bool:
    """
    True if some valid index on the table already leads with this column (prefix use = redundant B-tree).
    """
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1
            FROM pg_index ix
            JOIN pg_class tbl ON tbl.oid = ix.indrelid AND tbl.relkind IN ('r', 'p', 'm')
            JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
            WHERE ns.nspname = %s
              AND tbl.relname = %s
              AND ix.indisvalid
              AND ix.indkey IS NOT NULL
              AND ix.indkey[0] IS NOT NULL
              AND ix.indkey[0] > 0
              AND EXISTS (
                  SELECT 1 FROM pg_attribute a
                  WHERE a.attrelid = ix.indrelid
                    AND a.attnum = ix.indkey[0]
                    AND NOT a.attisdropped
                    AND a.attname = %s
              )
        ) AS ok
        """,
        (schema, table, column),
    )
    row = cursor.fetchone()
    return bool(row and row.get("ok"))


def _role_can_create_in_schema(cursor, schema: str) -> bool:
    cursor.execute(
        """
        SELECT COALESCE(
            pg_catalog.has_schema_privilege(pg_catalog.current_user(), %s::name, 'CREATE'),
            false
        ) AS ok
        """,
        (schema,),
    )
    row = cursor.fetchone()
    return bool(row and row.get("ok"))


def _execute_ddl_autocommit(ddl: str) -> None:
    """CONCURRENTLY index builds require autocommit (not inside a transaction)."""
    conn = psycopg2.connect(get_db_connection_string())
    conn.autocommit = True
    lock_ms = _ddl_lock_timeout_ms()
    stmt = _ddl_statement_timeout_setting()
    try:
        with conn.cursor() as cur:
            cur.execute("SET lock_timeout = %s", (f"{lock_ms}ms",))
            if stmt is not None:
                cur.execute("SET statement_timeout = %s", (stmt,))
            cur.execute(ddl)
    finally:
        conn.close()


def _recommendation_resolves_to_index_target(
    cursor,
    rec: Dict[str, Any],
    allowed: frozenset,
) -> Tuple[bool, str, str, str]:
    """
    Return (ok, schema, table, column) for a single-column B-tree index target.
    Partition recommendations map to an index on the partition key (legitimate speed-up without table rewrite).
    Unqualified ``table`` names are resolved against allowlisted schemas (not assumed to be ``public``).
    """
    rtype = str(rec.get("type") or "index").lower()
    table_raw = str(rec.get("table") or "").strip()
    if not table_raw:
        return False, "", "", ""
    if "." in table_raw:
        try:
            schema, table = _parse_qualified_table(table_raw)
        except ValueError:
            return False, "", "", ""
        schema_l = schema.lower()
        table_rel = table.lower()
    else:
        resolved = _resolve_bare_table_in_allowed_schemas(cursor, table_raw, allowed)
        if not resolved:
            return False, "", "", ""
        schema_l, table_rel = resolved
    if schema_l not in allowed:
        return False, "", "", ""
    if not _is_safe_sql_ident(schema_l) or not _is_safe_sql_ident(table_rel):
        return False, "", "", ""
    col: Optional[str] = None
    if rtype == "partition":
        pc = rec.get("partition_column")
        if pc and str(pc).strip():
            col = str(pc).strip()
        else:
            cols = rec.get("columns") or []
            if isinstance(cols, list) and cols:
                col = str(cols[0]).strip()
    else:
        cols = rec.get("columns") or []
        if isinstance(cols, list) and cols:
            col = str(cols[0]).strip()
        elif isinstance(cols, str) and cols.strip():
            col = cols.strip()
    if rtype == "cache":
        return False, "", "", ""
    col_l = (col or "").strip().lower()
    if not col_l or not _is_safe_sql_ident(col_l):
        return False, "", "", ""
    return True, schema_l, table_rel, col_l


def _filter_genuine_recommendations(conn, items: List[dict]) -> List[dict]:
    """
    Keep only recommendations that:
    - resolve to allowlisted schema + real table/column
    - have optional query_log evidence (OPTIMIZATION_MIN_QUERY_EVIDENCE_HITS)
    - optionally drop leading-column redundancies (OPTIMIZATION_FILTER_REDUNDANT_INDEXES; default on)
    """
    if not items:
        return []
    allowed = _ddl_allowed_schemas()
    min_ev = _min_query_evidence_hits()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        out: List[dict] = []
        dropped: Dict[str, int] = {
            "resolve": 0,
            "relation": 0,
            "column": 0,
            "redundant": 0,
            "evidence": 0,
        }
        for rec in items:
            ok, schema, table, col = _recommendation_resolves_to_index_target(cursor, rec, allowed)
            if not ok:
                dropped["resolve"] += 1
                continue
            if not _validate_physical_relation(cursor, schema, table):
                dropped["relation"] += 1
                continue
            if not _validate_table_column(cursor, schema, table, col):
                dropped["column"] += 1
                continue
            if _filter_redundant_indexes_in_recommendations_list():
                if _index_leading_column_already_indexed(cursor, schema, table, col):
                    dropped["redundant"] += 1
                    continue
            if min_ev > 0 and _query_logs_table_exists(cursor):
                hits = _query_log_evidence_hits(cursor, schema, table, col)
                if hits < min_ev:
                    dropped["evidence"] += 1
                    continue
            # Normalize to qualified name so UI/clients match catalog (bare names are resolved above).
            out.append({**rec, "table": f"{schema}.{table}"})
        if not out and items:
            n = len(items)
            # Empty list after filter is normal (indexes exist, views-only targets, schemas outside
            # allowlist, etc.). Log at DEBUG only — enable DEBUG to see drop breakdown.
            logger.debug(
                "All %s optimization recommendations filtered out (resolve=%s relation=%s column=%s "
                "redundant=%s evidence=%s). Hints: OPTIMIZATION_DDL_ALLOWED_SCHEMAS, "
                "OPTIMIZATION_MIN_QUERY_EVIDENCE_HITS, OPTIMIZATION_FILTER_REDUNDANT_INDEXES=0.",
                n,
                dropped["resolve"],
                dropped["relation"],
                dropped["column"],
                dropped["redundant"],
                dropped["evidence"],
            )
        return out
    finally:
        cursor.close()


def _optimization_query_log_limit() -> int:
    """Max query_log rows sampled per live recommendation generation (env: OPTIMIZATION_QUERY_LOG_LIMIT)."""
    raw = os.environ.get("OPTIMIZATION_QUERY_LOG_LIMIT", "30000")
    try:
        return max(500, min(int(raw), 500_000))
    except ValueError:
        return 30_000


def _optimization_live_recommendations_cap() -> int:
    """Max live (model-generated) rows returned per request (env: OPTIMIZATION_LIVE_RECOMMENDATIONS_CAP)."""
    raw = os.environ.get("OPTIMIZATION_LIVE_RECOMMENDATIONS_CAP", "300")
    try:
        return max(10, min(int(raw), 500))
    except ValueError:
        return 300


def _norm_recommendation_pair_key(table: str, col: str) -> Tuple[str, str]:
    """Case-insensitive key for matching live sample scores to persisted rows."""
    return (str(table or "").strip().lower(), str(col or "").strip().lower())


def _optimization_rescore_unique_pairs_max() -> int:
    """Max distinct (table, column) pairs to re-score via query_logs ILIKE per request (rest keep DB fields)."""
    raw = os.environ.get("OPTIMIZATION_RESCORE_UNIQUE_PAIRS_MAX", "20").strip()
    try:
        return max(0, min(int(raw), 500))
    except ValueError:
        return 20


def _optimization_live_on_recommendations_get() -> bool:
    """When false, skip live query_logs scan + model grouping (faster GET; persisted rows only)."""
    v = os.environ.get("OPTIMIZATION_LIVE_ON_RECOMMENDATIONS_GET", "1").strip().lower()
    return v not in ("0", "false", "no", "off")


def _optimization_merge_pg_stat_live() -> bool:
    """
    When true, merge current pg_stat_user_tables index/partition heuristics into the payload.
    Default off so recommendations are only from query_logs + ML and persisted DB rows
    (no synthesized catalog-only suggestions unless explicitly enabled).
    """
    v = os.environ.get("OPTIMIZATION_MERGE_PG_STAT_LIVE", "0").strip().lower()
    return v not in ("0", "false", "no", "off")


def _optimization_include_recommendation_debug_counts() -> bool:
    """Include debug counters in recommendations payload (env: OPTIMIZATION_INCLUDE_RECOMMENDATION_DEBUG=1)."""
    v = os.environ.get("OPTIMIZATION_INCLUDE_RECOMMENDATION_DEBUG", "1").strip().lower()
    return v not in ("0", "false", "no", "off")


def _optimization_query_log_lookback_hours() -> Optional[int]:
    """If set, only use query_logs from the last N hours (env: OPTIMIZATION_QUERY_LOG_LOOKBACK_HOURS)."""
    raw = os.environ.get("OPTIMIZATION_QUERY_LOG_LOOKBACK_HOURS", "").strip()
    if not raw:
        return None
    try:
        h = int(raw)
        return h if h > 0 else None
    except ValueError:
        return None


def _query_logs_recent_sql_fragment() -> Tuple[str, List[Any]]:
    """SQL fragment and params for optional collected_at lookback."""
    hours = _optimization_query_log_lookback_hours()
    if hours is None:
        return "", []
    return " AND collected_at >= NOW() - %s::interval", [f"{hours} hours"]


def _recommendation_dedupe_key(r: dict) -> Tuple[str, str, str]:
    """Stable key: type + table + all column names (same table, different cols = distinct rows)."""
    cols = r.get("columns") or []
    if isinstance(cols, str):
        cols = [cols]
    col_sig = ",".join(sorted(str(c).lower() for c in cols if c is not None))
    return (str(r.get("type", "index")), str(r.get("table", "")).lower(), col_sig)


def _merge_recommendations_live_first(live: List[dict], persisted: List[dict]) -> List[dict]:
    """Dedup by type + table + full column list. Live rows win so rankings track the newest query_logs sample."""
    def dedupe_key(r: dict) -> Tuple[str, str, str]:
        return _recommendation_dedupe_key(r)

    seen: set = set()
    out: List[dict] = []
    for r in live:
        k = dedupe_key(r)
        if k in seen:
            continue
        seen.add(k)
        out.append(r)
    for r in persisted:
        k = dedupe_key(r)
        if k in seen:
            continue
        seen.add(k)
        out.append(r)
    return out


def _sort_recommendations_by_priority(items: List[dict]) -> List[dict]:
    priority_rank = {"high": 3, "medium": 2, "low": 1}
    items.sort(
        key=lambda r: (priority_rank.get(str(r.get("priority", "")).lower(), 0), r.get("query_count", 0) or 0),
        reverse=True,
    )
    return items


def _project_models_dir() -> Path:
    # ml-optimization/api/routes/<this file> -> .../ml-optimization
    ml_opt_dir = Path(__file__).resolve().parents[2]
    return ml_opt_dir / "saved_models"


@lru_cache(maxsize=1)
def _load_trained_models() -> Dict[str, Any]:
    """Load trained model artifacts once per API process (best-effort)."""
    models_dir = _project_models_dir()
    predictor_path = models_dir / "query_time_predictor.pkl"
    anomaly_path = models_dir / "anomaly_detector.pkl"

    loaded: Dict[str, Any] = {}
    xgb_json_only = models_dir / "query_time_predictor_xgboost.json"
    if predictor_path.exists():
        try:
            predictor = QueryTimePredictor()
            predictor.load_model(str(predictor_path))
            loaded["predictor"] = predictor
        except Exception as e:
            logger.warning("Failed to load QueryTimePredictor: %s", e)
    elif xgb_json_only.exists():
        try:
            predictor = QueryTimePredictor()
            predictor.load_xgboost_json_only(str(xgb_json_only))
            loaded["predictor"] = predictor
        except Exception as e:
            logger.warning("Failed to load QueryTimePredictor from XGBoost JSON: %s", e)
    if anomaly_path.exists():
        try:
            detector = QueryAnomalyDetector()
            detector.load_model(str(anomaly_path))
            loaded["anomaly_detector"] = detector
        except Exception as e:
            logger.warning("Failed to load QueryAnomalyDetector: %s", e)

    cluster_path = models_dir / "workload_clustering.pkl"
    if cluster_path.exists():
        try:
            wc = WorkloadClusterer()
            wc.load_model(str(cluster_path))
            loaded["workload_clusterer"] = wc
        except Exception as e:
            logger.warning("Failed to load WorkloadClusterer: %s", e)

    cache_path = models_dir / "cache_predictor.pkl"
    if cache_path.exists():
        try:
            cp = CachePredictor()
            cp.load_model(str(cache_path))
            loaded["cache_predictor"] = cp
        except Exception as e:
            logger.warning("Failed to load CachePredictor: %s", e)

    return loaded


def _serialize_training_metrics(tm: Any) -> Optional[Dict[str, float]]:
    """Convert numpy / sklearn metric dict to JSON-safe floats."""
    if not isinstance(tm, dict):
        return None
    out: Dict[str, float] = {}
    for k, v in tm.items():
        try:
            if v is None:
                continue
            x = float(v)
            if np.isnan(x) or np.isinf(x):
                continue
            out[str(k)] = x
        except (TypeError, ValueError):
            continue
    return out or None


@router.get("/ml-model-metrics")
def get_ml_model_metrics():
    """
    Regression fit metrics for the trained query-time model (test/train R², MAE, RMSE, CV RMSE)
    when present in the saved artifact. Re-train with ``scripts/ml-optimization/train_model.py`` to populate.
    """
    models_dir = _project_models_dir()
    predictor_path = models_dir / "query_time_predictor.pkl"
    sidecar = models_dir / "query_time_predictor_metrics.json"
    predictor: Dict[str, Any] = {
        "artifact_exists": predictor_path.exists(),
        "model_type": None,
        "feature_count": None,
        "metrics": None,
        "metrics_source": None,
    }
    if predictor_path.exists():
        try:
            raw = joblib.load(predictor_path)
            if isinstance(raw, dict):
                predictor["model_type"] = raw.get("model_type")
                fn = raw.get("feature_names") or []
                predictor["feature_count"] = len(fn) if isinstance(fn, list) else None
                ser = _serialize_training_metrics(raw.get("training_metrics"))
                if ser:
                    predictor["metrics"] = ser
                    predictor["metrics_source"] = "artifact"
        except Exception as ex:
            logger.warning("get_ml_model_metrics: predictor unpack failed: %s", ex)
    if predictor["metrics"] is None and sidecar.exists():
        try:
            data = json.loads(sidecar.read_text(encoding="utf-8"))
            if isinstance(data, dict) and data:
                flat = _serialize_training_metrics(data)
                if flat:
                    predictor["metrics"] = flat
                    predictor["metrics_source"] = "sidecar"
        except Exception as ex:
            logger.warning("get_ml_model_metrics: sidecar failed: %s", ex)

    anomaly_path = models_dir / "anomaly_detector.pkl"
    anomaly: Dict[str, Any] = {
        "artifact_exists": anomaly_path.exists(),
        "note": "IsolationForest on query metrics (unsupervised) — no held-out accuracy; use Alerts anomalies for outcomes.",
    }

    wc_path = models_dir / "workload_clustering.pkl"
    workload_clustering_meta: Dict[str, Any] = {"artifact_exists": wc_path.exists()}
    if wc_path.exists():
        try:
            raw_wc = joblib.load(wc_path)
            if isinstance(raw_wc, dict):
                cfg = raw_wc.get("config")
                if cfg is not None:
                    workload_clustering_meta["algorithm"] = getattr(cfg, "algorithm", None)
                    workload_clustering_meta["n_clusters"] = getattr(cfg, "n_clusters", None)
        except Exception as ex:
            logger.warning("get_ml_model_metrics: workload clustering unpack failed: %s", ex)

    cp_path = models_dir / "cache_predictor.pkl"
    cache_predictor_meta: Dict[str, Any] = {"artifact_exists": cp_path.exists()}
    if cp_path.exists():
        try:
            raw_cp = joblib.load(cp_path)
            if isinstance(raw_cp, dict):
                cache_predictor_meta["is_trained"] = bool(raw_cp.get("is_trained", True))
                ts = raw_cp.get("training_stats") or {}
                if isinstance(ts, dict):
                    cache_predictor_meta["training_stats"] = {
                        k: float(v) if isinstance(v, (int, float)) else v
                        for k, v in ts.items()
                        if k in ("n_groups", "positive_rate", "n_features")
                    }
        except Exception as ex:
            logger.warning("get_ml_model_metrics: cache predictor unpack failed: %s", ex)

    return {
        "query_time_predictor": predictor,
        "anomaly_detector": anomaly,
        "workload_clustering": workload_clustering_meta,
        "cache_predictor": cache_predictor_meta,
    }


def _enrich_query_logs_for_cluster_profiles(df: pd.DataFrame) -> pd.DataFrame:
    """Add optional columns for ``WorkloadClusterer.get_cluster_profiles``."""
    if df is None or df.empty:
        return df
    out = df.copy()
    tc, jc, ha, hw = [], [], [], []
    for _, row in out.iterrows():
        ex: Any = row.get("extracted_features", {}) or {}
        if isinstance(ex, str):
            try:
                ex = json.loads(ex)
            except json.JSONDecodeError:
                ex = {}
        if not isinstance(ex, dict):
            ex = {}
        tc.append(float(ex.get("table_count", 0) or 0))
        jc.append(float(ex.get("join_count", 0) or 0))
        ha.append(float(ex.get("has_aggregation", 0) or 0))
        hw.append(float(ex.get("has_window_function", 0) or 0))
    out["table_count"] = tc
    out["join_count"] = jc
    out["has_aggregation"] = ha
    out["has_window_function"] = hw
    return out


def _fetch_query_logs_sample_df(conn, limit: int) -> pd.DataFrame:
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        """
        SELECT log_id, query_hash, query_text, mean_exec_time_ms, total_exec_time_ms, max_exec_time_ms,
               calls, rows_affected, collected_at,
               shared_blks_hit, shared_blks_read, extracted_features
        FROM ml_optimization.query_logs
        WHERE query_text IS NOT NULL
          AND trim(query_text) <> ''
          AND (
            COALESCE(mean_exec_time_ms, 0) > 0
            OR COALESCE(calls, 0) > 0
          )
        ORDER BY collected_at DESC
        LIMIT %s
        """,
        (limit,),
    )
    rows = cursor.fetchall()
    cursor.close()
    return pd.DataFrame(rows) if rows else pd.DataFrame()


@router.get("/workload-clusters")
def get_workload_clusters(
    limit: int = Query(2000, ge=50, le=20000, description="Recent query_logs rows to cluster"),
):
    """
    Assign recent ``query_logs`` rows to workload clusters using the trained ``WorkloadClusterer``.
    Train with ``python scripts/ml-optimization/train_model.py --model clustering`` or ``train_all_models.py``.
    """
    models = _load_trained_models()
    wc: Optional[WorkloadClusterer] = models.get("workload_clusterer")
    if wc is None or wc.model is None:
        return {
            "model_loaded": False,
            "message": "Train and save workload_clustering.pkl (see train_model.py --model clustering).",
            "total_queries": 0,
            "cluster_counts": {},
            "profiles": {},
            "metadata": {
                "sample_limit": int(limit),
                "data_watermark_utc": None,
                "degraded_mode": True,
                "degraded_reason": "workload_clustering_model_missing",
                "contract_version": "v1",
            },
        }
    try:
        with get_db_connection() as conn:
            df = _fetch_query_logs_sample_df(conn, limit)
        if df.empty:
            return {
                "model_loaded": True,
                "total_queries": 0,
                "cluster_counts": {},
                "profiles": {},
                "message": "No query_logs rows matched.",
                "metadata": {
                    "sample_limit": int(limit),
                    "data_watermark_utc": None,
                    "degraded_mode": True,
                    "degraded_reason": "no_query_logs_rows",
                    "contract_version": "v1",
                },
            }
        labels = wc.predict_from_query_logs(df)
        enriched = _enrich_query_logs_for_cluster_profiles(df)
        profiles_raw = wc.get_cluster_profiles(enriched, labels)
        profiles = {str(k): v for k, v in profiles_raw.items()}
        unique, counts = np.unique(labels, return_counts=True)
        cluster_counts = {str(int(u)): int(c) for u, c in zip(unique, counts)}
        labeled = df.copy()
        labeled["cluster_id"] = labels
        examples: Dict[str, List[Dict[str, Any]]] = {}
        try:
            grp = (
                labeled.groupby(["cluster_id", "query_text"], dropna=True)
                .agg(
                    sample_count=("query_text", "size"),
                    calls_sum=("calls", "sum"),
                    mean_exec_ms=("mean_exec_time_ms", "mean"),
                )
                .reset_index()
            )
            for cid, sub in grp.groupby("cluster_id"):
                s = sub.sort_values(["calls_sum", "sample_count"], ascending=[False, False]).head(25)
                rows: List[Dict[str, Any]] = []
                for _, r in s.iterrows():
                    qt = str(r.get("query_text") or "").strip()
                    if not qt:
                        continue
                    rows.append(
                        {
                            "query_preview": " ".join(qt.split())[:260],
                            "calls_sum": int(float(r.get("calls_sum") or 0)),
                            "mean_exec_ms": float(r.get("mean_exec_ms") or 0),
                            "sample_count": int(float(r.get("sample_count") or 0)),
                        }
                    )
                examples[str(int(cid))] = rows
        except Exception:
            logger.debug("workload cluster example query build failed", exc_info=True)
        return {
            "model_loaded": True,
            "total_queries": int(len(df)),
            "cluster_counts": cluster_counts,
            "profiles": profiles,
            "query_samples": examples,
            "algorithm": getattr(wc.config, "algorithm", None),
            "metadata": {
                "sample_limit": int(limit),
                "data_watermark_utc": _iso_utc_or_none(df["collected_at"].max() if "collected_at" in df else None),
                "degraded_mode": False,
                "degraded_reason": "",
                "contract_version": "v1",
            },
        }
    except Exception as e:
        logger.error("get_workload_clusters failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/workload-clusters/{cluster_id}/queries")
def get_workload_cluster_queries(
    cluster_id: int,
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(10, ge=1, le=50, description="Rows per page"),
    sample_limit: int = Query(5000, ge=200, le=20000, description="Recent query_logs rows used for clustering"),
):
    """Return paginated query samples for a single workload cluster."""
    models = _load_trained_models()
    wc: Optional[WorkloadClusterer] = models.get("workload_clusterer")
    if wc is None or wc.model is None:
        return {
            "model_loaded": False,
            "cluster_id": int(cluster_id),
            "page": int(page),
            "page_size": int(page_size),
            "total": 0,
            "total_pages": 0,
            "queries": [],
            "message": "Train and save workload_clustering.pkl (see train_model.py --model clustering).",
            "metadata": {
                "sample_limit": int(sample_limit),
                "data_watermark_utc": None,
                "degraded_mode": True,
                "degraded_reason": "workload_clustering_model_missing",
                "contract_version": "v1",
            },
        }

    try:
        with get_db_connection() as conn:
            df = _fetch_query_logs_sample_df(conn, sample_limit)
        if df.empty:
            return {
                "model_loaded": True,
                "cluster_id": int(cluster_id),
                "page": int(page),
                "page_size": int(page_size),
                "total": 0,
                "total_pages": 0,
                "queries": [],
                "message": "No query_logs rows matched.",
                "metadata": {
                    "sample_limit": int(sample_limit),
                    "data_watermark_utc": None,
                    "degraded_mode": True,
                    "degraded_reason": "no_query_logs_rows",
                    "contract_version": "v1",
                },
            }

        labels = wc.predict_from_query_logs(df)
        labeled = df.copy()
        labeled["cluster_id"] = labels
        group_df = labeled[labeled["cluster_id"] == int(cluster_id)]
        if group_df.empty:
            return {
                "model_loaded": True,
                "cluster_id": int(cluster_id),
                "page": int(page),
                "page_size": int(page_size),
                "total": 0,
                "total_pages": 0,
                "queries": [],
                "message": f"No rows found for cluster {cluster_id}.",
                "metadata": {
                    "sample_limit": int(sample_limit),
                    "data_watermark_utc": _iso_utc_or_none(df["collected_at"].max() if "collected_at" in df else None),
                    "degraded_mode": True,
                    "degraded_reason": "cluster_has_no_rows",
                    "contract_version": "v1",
                },
            }

        sorted_rows = group_df.sort_values(["collected_at"], ascending=[False], na_position="last").reset_index(drop=True)
        total = int(len(sorted_rows))
        total_pages = max(1, (total + page_size - 1) // page_size)
        current_page = min(max(1, int(page)), total_pages)
        offset = (current_page - 1) * page_size
        chunk = sorted_rows.iloc[offset : offset + page_size]

        rows: List[Dict[str, Any]] = []
        for _, r in chunk.iterrows():
            qt = str(r.get("query_text") or "").strip()
            if not qt:
                continue
            log_id = r.get("log_id")
            qh = r.get("query_hash")
            calls_v = float(r.get("calls") or 0)
            total_v = r.get("total_exec_time_ms")
            try:
                total_f = float(total_v) if total_v is not None else 0.0
            except (TypeError, ValueError):
                total_f = 0.0
            mean_col = float(r.get("mean_exec_time_ms") or 0)
            if calls_v > 0:
                row_ms = total_f if total_f > 0 else mean_col * calls_v
                mean_ms = row_ms / calls_v
            else:
                mean_ms = mean_col
            rows.append(
                {
                    "log_id": int(log_id) if log_id is not None else None,
                    "query_hash": str(qh).strip() if qh is not None else None,
                    "query_preview": " ".join(qt.split())[:260],
                    "calls_sum": int(float(r.get("calls") or 0)),
                    "mean_exec_ms": float(mean_ms),
                    "sample_count": 1,
                    "collected_at": r.get("collected_at").isoformat() if r.get("collected_at") is not None else None,
                }
            )

        return {
            "model_loaded": True,
            "cluster_id": int(cluster_id),
            "page": int(current_page),
            "page_size": int(page_size),
            "total": total,
            "total_pages": int(total_pages),
            "queries": rows,
            "metadata": {
                "sample_limit": int(sample_limit),
                "data_watermark_utc": _iso_utc_or_none(
                    sorted_rows["collected_at"].max() if "collected_at" in sorted_rows else None
                ),
                "degraded_mode": False,
                "degraded_reason": "",
                "contract_version": "v1",
            },
        }
    except Exception as e:
        logger.error("get_workload_cluster_queries failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cache-candidates")
def get_cache_candidates(
    logs_limit: int = Query(5000, ge=200, le=50000, description="Recent query_logs rows to aggregate"),
    limit: int = Query(50, ge=1, le=200, description="Max candidates to return"),
    threshold: float = Query(0.6, ge=0.0, le=1.0, description="Min predicted cache probability"),
):
    """
    Rank query templates by cache-worthiness using ``CachePredictor`` (RandomForest) when trained,
    else frequency/latency heuristics. Train with ``train_model.py --model cache``.
    """
    models = _load_trained_models()
    cp: Optional[CachePredictor] = models.get("cache_predictor")
    if cp is None:
        cp = CachePredictor()
    try:
        with get_db_connection() as conn:
            df = _fetch_query_logs_sample_df(conn, logs_limit)
        if df.empty:
            return {
                "candidates": [],
                "total_query_rows": 0,
                "model_trained": False,
                "message": "No query_logs rows matched.",
                "metadata": {
                    "logs_limit": int(logs_limit),
                    "data_watermark_utc": None,
                    "degraded_mode": True,
                    "degraded_reason": "no_query_logs_rows",
                    "contract_version": "v1",
                },
            }
        candidates = cp.top_cache_candidates(df, limit=limit, threshold=threshold)
        return {
            "candidates": candidates,
            "total_query_rows": int(len(df)),
            "model_trained": bool(cp.is_trained),
            "metadata": {
                "logs_limit": int(logs_limit),
                "data_watermark_utc": _iso_utc_or_none(df["collected_at"].max() if "collected_at" in df else None),
                "degraded_mode": False,
                "degraded_reason": "",
                "contract_version": "v1",
            },
        }
    except Exception as e:
        logger.error("get_cache_candidates failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/cache-candidates/paged")
def get_cache_candidates_paged(
    page: int = Query(1, ge=1, description="1-based page number"),
    page_size: int = Query(10, ge=1, le=50, description="Rows per page"),
    logs_limit: int = Query(8000, ge=200, le=50000, description="Recent query_logs rows to aggregate"),
    threshold: float = Query(0.45, ge=0.0, le=1.0, description="Min predicted cache probability"),
):
    """Paginated cache opportunities list for UI modal view."""
    models = _load_trained_models()
    cp: Optional[CachePredictor] = models.get("cache_predictor")
    if cp is None:
        cp = CachePredictor()
    try:
        with get_db_connection() as conn:
            df = _fetch_query_logs_sample_df(conn, logs_limit)
        if df.empty:
            return {
                "candidates": [],
                "total_query_rows": 0,
                "total": 0,
                "page": int(page),
                "page_size": int(page_size),
                "total_pages": 0,
                "model_trained": False,
                "message": "No query_logs rows matched.",
                "metadata": {
                    "logs_limit": int(logs_limit),
                    "data_watermark_utc": None,
                    "degraded_mode": True,
                    "degraded_reason": "no_query_logs_rows",
                    "contract_version": "v1",
                },
            }

        candidates = cp.top_cache_candidates(df, limit=max(1000, int(logs_limit)), threshold=threshold)
        total = int(len(candidates))
        total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 0
        current_page = min(max(1, int(page)), total_pages) if total_pages > 0 else 1
        offset = (current_page - 1) * page_size
        chunk = candidates[offset : offset + page_size]

        return {
            "candidates": chunk,
            "total_query_rows": int(len(df)),
            "total": total,
            "page": int(current_page),
            "page_size": int(page_size),
            "total_pages": int(total_pages),
            "model_trained": bool(cp.is_trained),
            "metadata": {
                "logs_limit": int(logs_limit),
                "data_watermark_utc": _iso_utc_or_none(df["collected_at"].max() if "collected_at" in df else None),
                "degraded_mode": False,
                "degraded_reason": "",
                "contract_version": "v1",
            },
        }
    except Exception as e:
        logger.error("get_cache_candidates_paged failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


# Columns commonly filtered/joined in warehouse SQL; used when strict FROM/WHERE parsing finds nothing.
_WAREHOUSE_INDEX_COLUMN_HINTS: Tuple[str, ...] = (
    "order_date_key",
    "order_date",
    "sales_key",
    "product_key",
    "customer_key",
    "inventory_key",
    "net_amount",
    "quantity",
    "category_name",
    "state_province",
    "customer_id",
    "product_id",
    "order_id",
    "created_at",
    "updated_at",
    "event_ts",
    "loaded_at",
    "sku",
    "email",
    "line_no",
)


def _parse_index_candidates_broad(query_text: str) -> List[Tuple[str, str]]:
    """
    Match ``gold|silver|bronze.relname`` anywhere in the text, crossed with column
    names that appear as whole tokens. Helps API/ORM SQL and simple SELECTs that
    skip the stricter FROM/WHERE grammar.
    """
    if not query_text or len(query_text) > 500_000:
        return []
    lower = query_text.lower()
    tables = []
    seen_t: set = set()
    for m in re.finditer(r"\b(gold|silver|bronze)\.([a-z0-9_]+)\b", lower):
        full = f"{m.group(1)}.{m.group(2)}"
        if full not in seen_t:
            seen_t.add(full)
            tables.append(full)
    if not tables:
        return []
    pairs: List[Tuple[str, str]] = []
    for hint in sorted(_WAREHOUSE_INDEX_COLUMN_HINTS, key=len, reverse=True):
        if not _is_safe_sql_ident(hint):
            continue
        if not re.search(rf"\b{re.escape(hint)}\b", lower):
            continue
        for tbl in tables:
            pairs.append((tbl, hint))
    return list({(t, c) for (t, c) in pairs})


def _parse_index_candidates_lenient(query_text: str) -> List[Tuple[str, str]]:
    """FROM/JOIN + WHERE heuristics (aligned with scripts/ml-optimization/generate_recommendations_ml.py)."""
    if not query_text:
        return []

    upper = query_text.upper()
    pairs: List[Tuple[str, str]] = []
    table_aliases: Dict[str, str] = {}
    table_names: List[str] = []

    from_join_re = re.findall(
        r"\b(FROM|JOIN)\s+([A-Z0-9_\.]+)(?:\s+AS)?\s+([A-Z0-9_]+)?",
        upper,
    )
    for _kw, raw_table, alias in from_join_re:
        if "." in raw_table:
            schema, tbl = raw_table.split(".", 1)
            full = f"{schema.lower()}.{tbl.lower()}"
        else:
            full = f"silver.{raw_table.lower()}"
        table_names.append(full)
        if alias:
            table_aliases[alias] = full

    where_section_match = re.search(r"\bWHERE\b(.+)", upper, re.DOTALL)
    where_text = where_section_match.group(1) if where_section_match else upper

    col_matches = re.findall(r"\b([A-Z0-9_]+)\.([A-Z0-9_]+)\s*=\s*", where_text)
    simple_cols = re.findall(r"\b([A-Z0-9_]+)\s*=\s*", where_text)

    for left, col in col_matches:
        tbl = None
        if left in table_aliases:
            tbl = table_aliases[left]
        elif "." in left:
            schema, t = left.split(".", 1)
            tbl = f"{schema.lower()}.{t.lower()}"
        elif table_names:
            tbl = table_names[0]

        if tbl:
            pairs.append((tbl, col.lower()))

    key_like_cols = {
        "ID", "ORDER_ID", "CUSTOMER_ID", "PRODUCT_ID",
        "CREATED_AT", "UPDATED_AT", "DATE", "ORDER_DATE",
    }
    for col in simple_cols:
        if any(c.lower() == col.lower() for _t, c in pairs):
            continue
        if col not in key_like_cols:
            continue
        for tbl in table_names or ["silver.unknown"]:
            pairs.append((tbl, col.lower()))

    return list({(t, c) for (t, c) in pairs})


def _parse_index_candidates(query_text: str) -> List[Tuple[str, str]]:
    """Map query text -> candidate (table, column) for index suggestions.

    Combines strict schema-qualified patterns with lenient FROM/WHERE parsing
    so more workload shapes produce recommendations.
    """
    upper = query_text.upper()
    candidates: List[Tuple[str, str]] = []
    cmp_re = re.findall(
        r"\b(SILVER|BRONZE|GOLD)\.([A-Z0-9_]+)\.([A-Z0-9_]+)\b\s*(=|IN\b|BETWEEN\b|>|<)",
        upper,
    )
    for schema, table, col, _op in cmp_re:
        candidates.append((f"{schema.lower()}.{table.lower()}", col.lower()))

    if not candidates:
        if "ORDER_DATE" in upper and "ORDERS" in upper:
            candidates.append(("silver.orders", "order_date"))
        if "CUSTOMER_ID" in upper and "CUSTOMERS" in upper:
            candidates.append(("silver.customers", "customer_id"))
        if "PRODUCT_ID" in upper and "PRODUCTS" in upper:
            candidates.append(("silver.products", "product_id"))
        if "CATEGORY" in upper and "PRODUCTS" in upper:
            candidates.append(("silver.products", "category"))

    loose = _parse_index_candidates_lenient(query_text)
    broad = _parse_index_candidates_broad(query_text)
    return list({(t, c) for (t, c) in candidates + loose + broad})


def _column_suitable_for_range_partition(col: str) -> bool:
    """Columns that plausibly support RANGE partitioning (time / ingest dimensions)."""
    c = (col or "").strip().lower()
    if not c:
        return False
    if c in {
        "order_date",
        "created_at",
        "updated_at",
        "event_ts",
        "event_time",
        "date",
        "timestamp",
        "occurred_at",
        "loaded_at",
        "ingested_at",
    }:
        return True
    if c.endswith("_at") or c.endswith("_date") or c.endswith("_ts") or c.endswith("_time"):
        return True
    return False


def _parse_partition_candidates(query_text: str) -> List[Tuple[str, str]]:
    """Heuristic mapping from query text -> candidate partition keys (aligned with index parsing)."""
    if not query_text:
        return []
    query_upper = query_text.upper()
    candidates: List[Tuple[str, str]] = []

    # Schema-qualified comparisons on known time column names (strict).
    time_cols = {"ORDER_DATE", "CREATED_AT", "UPDATED_AT", "EVENT_TS", "DATE", "TIMESTAMP", "EVENT_TIME", "LOADED_AT", "INGESTED_AT"}
    cmp_re = re.findall(r"\b(SILVER|BRONZE|GOLD)\.([A-Z0-9_]+)\.([A-Z0-9_]+)\b\s*(=|IN\b|BETWEEN\b|>|<)", query_upper)
    for schema, table, col, _op in cmp_re:
        if col in time_cols or col.endswith("_AT") or col.endswith("_DATE") or col.endswith("_TS"):
            candidates.append((f"{schema.lower()}.{table.lower()}", col.lower()))

    # Same workload shapes as index recommendations: FROM/WHERE heuristics, filtered to partition-suitable columns.
    for table, col in _parse_index_candidates(query_text):
        if _column_suitable_for_range_partition(col):
            candidates.append((table, col))

    # Narrow fallbacks when SQL lacks qualified names.
    if not candidates:
        if "ORDER_DATE" in query_upper and "ORDERS" in query_upper:
            candidates.append(("silver.orders", "order_date"))
        if "CREATED_AT" in query_upper:
            candidates.append(("bronze.customer_events", "created_at"))
        if "EVENT_TS" in query_upper:
            candidates.append(("bronze.events", "event_ts"))

    return list({(t, c) for (t, c) in candidates})


def _optimization_ml_live_source() -> str:
    """
    Sample source for live ML recommendation scoring.

    - query_logs: ml_optimization.query_logs only (kept fresh by run_query_collection).
    - pg_stat: pg_stat_statements directly (fresher; requires extension).
    - both (default): merge half from each, dedupe by query text (pg_stat rows first).
    """
    raw = os.environ.get("OPTIMIZATION_ML_LIVE_SOURCE", "both").strip().lower()
    if raw in ("pg_stat", "pg_stat_statements", "pgstat"):
        return "pg_stat"
    if raw in ("both", "all", "query_logs_and_pg_stat"):
        return "both"
    return "query_logs"


def _pg_stat_statements_extension_exists(cursor) -> bool:
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1 FROM pg_extension WHERE extname = 'pg_stat_statements'
        ) AS ok
        """
    )
    row = cursor.fetchone()
    return bool(row and row.get("ok"))


def _ml_fetch_query_logs_sample_for_live(
    cursor,
    limit_rows: int,
    look_sql: str,
    look_params: List[Any],
) -> List[dict]:
    cursor.execute(
        f"""
        SELECT
            query_text,
            mean_exec_time_ms,
            calls,
            rows_affected,
            shared_blks_hit,
            shared_blks_read,
            extracted_features,
            collected_at
        FROM ml_optimization.query_logs
        WHERE query_text IS NOT NULL
          AND trim(query_text) <> ''
          AND (
            COALESCE(mean_exec_time_ms, 0) > 0
            OR COALESCE(calls, 0) > 0
          )
        {look_sql}
        ORDER BY collected_at DESC
        LIMIT %s
        """,
        tuple(look_params + [limit_rows]),
    )
    rows = cursor.fetchall()
    out: List[dict] = []
    for r in rows:
        d = dict(r)
        d["_ml_row_source"] = "ml_query_logs"
        out.append(d)
    return out


def _ml_fetch_pg_stat_sample_for_live(cursor, limit_rows: int) -> List[dict]:
    if not _pg_stat_statements_extension_exists(cursor):
        logger.warning(
            "OPTIMIZATION_ML_LIVE_SOURCE uses pg_stat but pg_stat_statements extension is not installed"
        )
        return []
    cursor.execute(
        """
        SELECT
            query AS query_text,
            mean_exec_time AS mean_exec_time_ms,
            calls,
            rows AS rows_affected,
            shared_blks_hit,
            shared_blks_read
        FROM pg_stat_statements
        WHERE query IS NOT NULL
          AND trim(query) <> ''
          AND calls > 0
        ORDER BY mean_exec_time DESC, total_exec_time DESC
        LIMIT %s
        """,
        (limit_rows,),
    )
    rows = cursor.fetchall()
    now_iso = datetime.now(timezone.utc).isoformat()
    out: List[dict] = []
    for r in rows:
        d = dict(r)
        d["extracted_features"] = d.get("extracted_features") or {}
        d["collected_at"] = now_iso
        d["_ml_row_source"] = "ml_pg_stat"
        out.append(d)
    return out


def _ml_merge_live_samples_pg_stat_first(
    pg_rows: List[dict],
    ql_rows: List[dict],
    limit_rows: int,
) -> List[dict]:
    """Merge pg_stat + query_logs rows for live ML, deduped by ``query_text``.

    Previously all ``pg_stat`` rows were walked before any ``query_logs`` rows. With a
    large ``OPTIMIZATION_QUERY_LOG_LIMIT`` and many distinct instrumented statements,
    the deduped prefix could consist entirely of non-warehouse SQL, so parsers found no
    ``gold.``/``silver.``/``bronze.`` candidates and returned zero recommendations. We
    now **ping-pong** between sources (always advancing cursors) so ``query_logs`` is
    represented whenever the collector has stored workload-shaped statements.
    """
    seen: set = set()
    uniq: List[dict] = []
    i = 0
    j = 0
    while len(uniq) < limit_rows and (i < len(pg_rows) or j < len(ql_rows)):
        if i < len(pg_rows):
            r = pg_rows[i]
            i += 1
            qt = str(r.get("query_text") or "").strip()
            if qt and qt not in seen:
                seen.add(qt)
                uniq.append(r)
        if len(uniq) >= limit_rows:
            break
        if j < len(ql_rows):
            r = ql_rows[j]
            j += 1
            qt = str(r.get("query_text") or "").strip()
            if qt and qt not in seen:
                seen.add(qt)
                uniq.append(r)
    return uniq


def _ml_build_live_recommendations_rows(
    conn,
    limit_rows: int,
    look_sql: str,
    look_params: List[Any],
) -> Tuple[List[dict], str]:
    """Return (rows, mode) for logging; mode is query_logs|pg_stat|both."""
    mode = _optimization_ml_live_source()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        if mode == "query_logs":
            rows = _ml_fetch_query_logs_sample_for_live(cursor, limit_rows, look_sql, look_params)
            return rows, "query_logs"
        if mode == "pg_stat":
            rows = _ml_fetch_pg_stat_sample_for_live(cursor, limit_rows)
            if not rows:
                logger.info(
                    "ML live source=pg_stat returned 0 rows; falling back to query_logs sample"
                )
                rows = _ml_fetch_query_logs_sample_for_live(
                    cursor, limit_rows, look_sql, look_params
                )
                return rows, "query_logs"
            return rows, "pg_stat"
        # both
        n_pg = max(1, limit_rows // 2)
        n_ql = max(1, limit_rows - n_pg)
        pg_rows = _ml_fetch_pg_stat_sample_for_live(cursor, n_pg)
        ql_rows = _ml_fetch_query_logs_sample_for_live(cursor, n_ql, look_sql, look_params)
        merged = _ml_merge_live_samples_pg_stat_first(pg_rows, ql_rows, limit_rows)
        if not merged and not pg_rows:
            merged = _ml_fetch_query_logs_sample_for_live(
                cursor, limit_rows, look_sql, look_params
            )
            return merged, "query_logs"
        return merged, "both"
    finally:
        cursor.close()


def _generate_model_based_recommendations(
    conn,
    type_filter: Optional[str],
    limit_rows: Optional[int] = None,
    return_cap: Optional[int] = None,
) -> Tuple[List[dict], Dict[Tuple[str, str], Tuple[float, Optional[float]]]]:
    """Generate ML-scored recommendations for the dashboards.

    Also returns ``pair_scores``: normalized (table, column) -> (severity_avg, pred_avg_ms)
    from the same query_logs sample, so GET /recommendations can reuse them instead of
    issuing one ILIKE-heavy query per persisted row.
    """
    models = _load_trained_models()
    predictor: Optional[QueryTimePredictor] = models.get("predictor")
    detector: Optional[QueryAnomalyDetector] = models.get("anomaly_detector")
    if predictor is None and detector is None:
        logger.debug(
            "Live model recommendations disabled: no query_time_predictor.pkl / "
            "query_time_predictor_xgboost.json and no anomaly_detector.pkl in %s",
            _project_models_dir(),
        )
        return [], {}

    if limit_rows is None:
        limit_rows = _optimization_query_log_limit()
    look_sql, look_params = _query_logs_recent_sql_fragment()

    rows, sample_mode = _ml_build_live_recommendations_rows(
        conn, limit_rows, look_sql, look_params
    )
    if sample_mode in ("pg_stat", "both"):
        logger.info(
            "Live ML sample_mode=%s (OPTIMIZATION_ML_LIVE_SOURCE=%s)",
            sample_mode,
            _optimization_ml_live_source(),
        )
    if not rows:
        return [], {}

    df_logs = pd.DataFrame(rows)
    # Rows with mean_exec_time_ms = 0 but calls > 0 break severity math; use a small positive proxy.
    if "mean_exec_time_ms" in df_logs.columns:
        df_logs["mean_exec_time_ms"] = pd.to_numeric(
            df_logs["mean_exec_time_ms"], errors="coerce"
        ).fillna(0.0)
        mask = (df_logs["mean_exec_time_ms"] <= 0) & (pd.to_numeric(df_logs.get("calls", 0), errors="coerce").fillna(0) > 0)
        df_logs.loc[mask, "mean_exec_time_ms"] = 0.001
    source_series = (
        df_logs["_ml_row_source"]
        if "_ml_row_source" in df_logs.columns
        else pd.Series(["ml_query_logs"] * len(df_logs), index=df_logs.index)
    )
    predict_df = df_logs.drop(columns=["_ml_row_source"], errors="ignore")
    query_texts = predict_df["query_text"].fillna("").astype(str)

    # Predictor scores (batch)
    predicted_ms: Optional[np.ndarray] = None
    if predictor is not None:
        try:
            X, _y = predictor.extract_features(predict_df)
            predicted_ms = predictor.predict(X)
        except Exception as ex:
            logger.warning("Query time predictor failed for live recommendations (using latency fallback): %s", ex)
            predicted_ms = None

    # Candidate grouping
    # key: (type, table, column)
    groups: Dict[Tuple[str, str, str], Dict[str, Any]] = {}
    for i in range(len(predict_df)):
        q_sql = str(query_texts.iloc[i])
        row_src = str(source_series.iloc[i] if i < len(source_series) else "ml_query_logs")

        index_candidates = _parse_index_candidates(q_sql)
        partition_candidates = _parse_partition_candidates(q_sql)

        if type_filter == "index":
            partition_candidates = []
        elif type_filter == "partition":
            index_candidates = []

        matched_any = bool(index_candidates or partition_candidates)
        if not matched_any:
            continue

        # Build model features for anomaly detection lazily (only if needed)
        anom_reason: str = "Model anomaly"
        anomaly_score: Optional[float] = None
        if detector is not None:
            metrics = {
                "mean_exec_time_ms": float(predict_df.iloc[i].get("mean_exec_time_ms", 0) or 0),
                "calls": float(predict_df.iloc[i].get("calls", 0) or 0),
                "rows_affected": float(predict_df.iloc[i].get("rows_affected", 0) or 0),
                "shared_blks_hit": float(predict_df.iloc[i].get("shared_blks_hit", 0) or 0),
                "shared_blks_read": float(predict_df.iloc[i].get("shared_blks_read", 0) or 0),
            }
            is_anom, score, reason = detector.detect_anomaly(metrics)
            if is_anom:
                anomaly_score = float(score)
                anom_reason = reason

        base_actual_ms = float(predict_df.iloc[i].get("mean_exec_time_ms", 0) or 0)
        base_pred_ms = float(predicted_ms[i]) if predicted_ms is not None else base_actual_ms
        if predicted_ms is not None and not np.isfinite(base_pred_ms):
            base_pred_ms = base_actual_ms
        if anomaly_score is not None:
            severity = max(0.0, -float(anomaly_score))
        elif predicted_ms is not None and base_actual_ms > 0:
            rel_err = abs(base_pred_ms - base_actual_ms) / max(base_actual_ms, 1e-3)
            severity = float(min(2.0, rel_err))
        else:
            severity = 0.05

        # Add index groups
        for table, col in index_candidates:
            key = ("index", table, col)
            g = groups.setdefault(
                key,
                {
                    "type": "index",
                    "table": table,
                    "columns": [col],
                    "count": 0,
                    "severity_sum": 0.0,
                    "severity_max": 0.0,
                    "pred_sum": 0.0,
                    "actual_sum": 0.0,
                    "reasons": [],
                    "_source_tags": set(),
                },
            )
            g["count"] += 1
            g["severity_sum"] += severity
            g["severity_max"] = max(g["severity_max"], severity)
            g["pred_sum"] += base_pred_ms
            g["actual_sum"] += base_actual_ms
            g["_source_tags"].add(row_src)
            if detector is not None and anomaly_score is not None:
                g["reasons"].append(anom_reason)

        # Add partition groups
        for table, col in partition_candidates:
            key = ("partition", table, col)
            g = groups.setdefault(
                key,
                {
                    "type": "partition",
                    "table": table,
                    "columns": [col],
                    "count": 0,
                    "severity_sum": 0.0,
                    "severity_max": 0.0,
                    "pred_sum": 0.0,
                    "actual_sum": 0.0,
                    "reasons": [],
                    "_source_tags": set(),
                },
            )
            g["count"] += 1
            g["severity_sum"] += severity
            g["severity_max"] = max(g["severity_max"], severity)
            g["pred_sum"] += base_pred_ms
            g["actual_sum"] += base_actual_ms
            g["_source_tags"].add(row_src)
            if detector is not None and anomaly_score is not None:
                g["reasons"].append(anom_reason)

    if not groups:
        logger.info(
            "Live ML recommendations: sampled %s rows (mode=%s) but extracted 0 (table, column) groups "
            "(SQL may lack gold./silver./bronze. names or known column tokens).",
            len(predict_df),
            sample_mode,
        )
        return [], {}

    pair_scores: Dict[Tuple[str, str], Tuple[float, Optional[float]]] = {}
    for (_rec_type, table, col), g in groups.items():
        cnt = max(int(g["count"]), 1)
        sev = float(g["severity_sum"] / cnt)
        pred_avg = float(g["pred_sum"] / cnt)
        pair_scores[_norm_recommendation_pair_key(table, col)] = (sev, pred_avg)

    # Score groups
    max_severity = max(g["severity_max"] for g in groups.values()) or 0.0
    now = datetime.now(timezone.utc).isoformat()
    recommendations: List[dict] = []
    for (rec_type, table, col), g in groups.items():
        count = int(g["count"])
        if count < 1:
            continue
        severity_avg = g["severity_sum"] / max(count, 1)
        normalized = (severity_avg / max_severity) if max_severity > 0 else 0.0
        estimated_improvement = float(min(0.5, 0.05 + 0.45 * normalized))

        if estimated_improvement >= 0.30:
            priority = "high"
        elif estimated_improvement >= 0.15:
            priority = "medium"
        else:
            priority = "low"

        idx_name = f"idx_{table.replace('.', '_')}_{col}"
        if rec_type == "index":
            sql_stmt = f"CREATE INDEX CONCURRENTLY {idx_name} ON {table} ({col});"
            reason = (
                f"Model anomaly severity={severity_avg:.4f}. "
                + (f"Reason: {g['reasons'][0]}." if g["reasons"] else "No specific anomaly reason classified.")
            )
        else:
            sql_stmt = (
                f"-- Template: CREATE TABLE {table}_partitioned (LIKE {table} INCLUDING ALL) "
                f"PARTITION BY RANGE ({col});\n"
                f"-- Align child partition bounds with query filters on {col} (e.g., monthly)."
            )
            reason = (
                f"Workload hits {table} on `{col}`; model severity={severity_avg:.4f}. "
                + (f"{g['reasons'][0]}." if g["reasons"] else "Consider RANGE partitioning to prune scans.")
            )

        rec_body: Dict[str, Any] = {
            "recommendation_id": f"model-{rec_type}-{table}-{col}-{abs(hash((table, col, rec_type))) % 100000}",
            "type": rec_type,
            "table": table,
            "columns": g["columns"],
            "estimated_improvement": estimated_improvement,
            "cost": 0.15 if priority == "medium" else 0.20 if priority == "high" else 0.10,
            "priority": priority,
            "status": "pending",
            "created_at": now,
            "query_count": count,
            "avg_execution_time_ms": float(g["actual_sum"] / max(count, 1)),
            "sql_statement": sql_stmt,
            "reason": reason,
            "explanation": reason,
        }
        if rec_type == "partition":
            rec_body["partition_column"] = col
        tags = g.get("_source_tags") or set()
        if len(tags) > 1:
            rec_body["recommendation_source"] = "ml_mixed"
        elif tags:
            rec_body["recommendation_source"] = next(iter(tags))
        else:
            rec_body["recommendation_source"] = "ml_query_logs"
        recommendations.append(rec_body)

    # Sort by priority + severity proxy
    priority_rank = {"high": 3, "medium": 2, "low": 1}
    recommendations.sort(key=lambda r: (priority_rank.get(r.get("priority"), 0), r.get("query_count", 0)), reverse=True)
    cap = _optimization_live_recommendations_cap()
    if return_cap is not None:
        cap = max(cap, min(int(return_cap), 500))
    return recommendations[:cap], pair_scores


def _model_score_for_table_column(
    conn,
    table: str,
    column: str,
    predictor: Optional[QueryTimePredictor],
    detector: Optional[QueryAnomalyDetector],
    limit_logs: int = 200,
) -> Tuple[float, Optional[float]]:
    """Compute a lightweight model-based severity score for a (table, column)."""
    look_sql, look_params = _query_logs_recent_sql_fragment()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    cursor.execute(
        f"""
        SELECT
            mean_exec_time_ms,
            calls,
            rows_affected,
            shared_blks_hit,
            shared_blks_read,
            extracted_features
        FROM ml_optimization.query_logs
        WHERE query_text ILIKE %s
          AND query_text ILIKE %s
        {look_sql}
        ORDER BY collected_at DESC
        LIMIT %s
        """,
        (f"%{table}%", f"%{column}%", *look_params, limit_logs),
    )
    rows = cursor.fetchall()
    cursor.close()
    if not rows:
        return 0.0, None

    severity_strengths: List[float] = []
    predicted_ms: Optional[np.ndarray] = None

    df_logs = pd.DataFrame(rows)
    if predictor is not None:
        try:
            X, _y = predictor.extract_features(df_logs)
            predicted_ms = predictor.predict(X)
        except Exception:
            predicted_ms = None

    if detector is not None:
        for _, r in df_logs.head(100).iterrows():
            metrics = {
                "mean_exec_time_ms": float(r.get("mean_exec_time_ms", 0) or 0),
                "calls": float(r.get("calls", 0) or 0),
                "rows_affected": float(r.get("rows_affected", 0) or 0),
                "shared_blks_hit": float(r.get("shared_blks_hit", 0) or 0),
                "shared_blks_read": float(r.get("shared_blks_read", 0) or 0),
            }
            is_anom, anomaly_score, _reason = detector.detect_anomaly(metrics)
            if is_anom:
                severity_strengths.append(max(0.0, -float(anomaly_score or 0.0)))

    severity_mean = float(np.mean(severity_strengths)) if severity_strengths else 0.0
    pred_avg_ms = float(np.mean(np.maximum(predicted_ms, 0))) if predicted_ms is not None else None
    return severity_mean, pred_avg_ms


class OptimizationRecommendation(BaseModel):
    """Optimization recommendation model."""
    recommendation_id: str
    type: str  # index, partition, cache
    table: str
    columns: List[str]
    estimated_improvement: float
    cost: float
    priority: str
    status: str
    created_at: str


class ApplyOptimizationRequest(BaseModel):
    """Request to apply optimization."""

    optimization_id: str = ""
    auto: bool = False
    snapshot: Optional[Dict[str, Any]] = None


def _iso_utc_or_none(v: Any) -> Optional[str]:
    if v is None:
        return None
    if hasattr(v, "isoformat"):
        try:
            return v.isoformat()
        except Exception:
            return None
    if isinstance(v, str):
        s = v.strip()
        return s or None
    return None


def _query_perf_contract_meta(
    *,
    start_date: Optional[str],
    end_date: Optional[str],
    rows: List[dict],
    used_unbounded_fallback: bool,
    query_logs_exists: bool,
    degraded_reason: str = "",
) -> Dict[str, Any]:
    wm = None
    for r in rows:
        le = _iso_utc_or_none(r.get("last_executed"))
        if le and (wm is None or le > wm):
            wm = le
    return {
        "window_start_utc": start_date,
        "window_end_utc": end_date,
        "data_watermark_utc": wm,
        "query_logs_exists": bool(query_logs_exists),
        "degraded_mode": bool(used_unbounded_fallback or degraded_reason),
        "degraded_reason": degraded_reason
        or ("window_empty_using_unbounded_fallback" if used_unbounded_fallback else ""),
        "used_unbounded_fallback": bool(used_unbounded_fallback),
        "contract_version": "v1",
    }


def _ensure_apply_events_table(cursor) -> None:
    """
    Create/migrate apply-audit schema once per API process.

    Running ALTER TABLE on every history request can deadlock under concurrent traffic.
    """
    global _apply_events_schema_ensured
    if _apply_events_schema_ensured:
        return
    with _apply_events_schema_lock:
        if _apply_events_schema_ensured:
            return
        cursor.execute("CREATE SCHEMA IF NOT EXISTS ml_optimization")
        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS ml_optimization.optimization_apply_events (
                event_id BIGSERIAL PRIMARY KEY,
                recommendation_id TEXT NOT NULL,
                recommendation_type VARCHAR(50) NOT NULL DEFAULT 'index',
                table_name TEXT,
                column_names JSONB DEFAULT '[]'::jsonb,
                priority VARCHAR(20),
                query_count INTEGER,
                avg_execution_time_ms DOUBLE PRECISION,
                sql_statement TEXT,
                explanation TEXT,
                estimated_improvement DOUBLE PRECISION,
                partition_column TEXT,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                applied_by VARCHAR(128) NOT NULL DEFAULT 'dashboard'
            )
            """
        )
        cursor.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_optimization_apply_events_applied_at
            ON ml_optimization.optimization_apply_events (applied_at DESC)
            """
        )
        cursor.execute(
            "ALTER TABLE ml_optimization.optimization_apply_events ADD COLUMN IF NOT EXISTS executed_ddl TEXT"
        )
        cursor.execute(
            "ALTER TABLE ml_optimization.optimization_apply_events ADD COLUMN IF NOT EXISTS created_index_name TEXT"
        )
        cursor.execute(
            "ALTER TABLE ml_optimization.optimization_apply_events ADD COLUMN IF NOT EXISTS apply_outcome VARCHAR(32) NOT NULL DEFAULT 'applied'"
        )
        _apply_events_schema_ensured = True


def _insert_apply_event(
    cursor,
    *,
    recommendation_id: str,
    rtype: str,
    table_name: Optional[str],
    column_names: List[str],
    priority: str,
    query_count: Optional[int],
    avg_execution_time_ms: Optional[float],
    sql_statement: str,
    explanation: str,
    estimated_improvement: Optional[float],
    partition_column: Optional[str],
    applied_by: str = "dashboard",
    executed_ddl: str = "",
    created_index_name: str = "",
    apply_outcome: str = "applied",
) -> None:
    _ensure_apply_events_table(cursor)
    cursor.execute(
        """
        INSERT INTO ml_optimization.optimization_apply_events (
            recommendation_id, recommendation_type, table_name, column_names,
            priority, query_count, avg_execution_time_ms, sql_statement, explanation,
            estimated_improvement, partition_column, applied_by,
            executed_ddl, created_index_name, apply_outcome
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """,
        (
            recommendation_id,
            rtype,
            table_name or None,
            Json(column_names),
            priority or None,
            query_count,
            avg_execution_time_ms,
            sql_statement or None,
            explanation or None,
            estimated_improvement,
            partition_column,
            applied_by,
            executed_ddl,
            created_index_name,
            apply_outcome,
        ),
    )


def _fetch_persisted_recommendation_for_apply(cursor, recommendation_id: str) -> Dict[str, Any]:
    rid = str(recommendation_id).strip()
    if not rid:
        return {}
    cursor.execute(
        """
        SELECT recommendation_id::text AS recommendation_id,
               recommendation_type AS type,
               table_name AS "table",
               column_name,
               priority,
               query_count,
               avg_execution_time_ms,
               sql_statement,
               explanation,
               estimated_improvement
        FROM ml_optimization.index_recommendations
        WHERE recommendation_id::text = %s
        """,
        (rid,),
    )
    row = cursor.fetchone()
    if not row:
        return {}
    est_raw = row.get("estimated_improvement")
    est_f = 0.0
    if est_raw is not None:
        try:
            if isinstance(est_raw, (int, float)):
                est_f = float(est_raw)
            else:
                est_f = float(str(est_raw).strip().rstrip("%"))
        except (TypeError, ValueError):
            est_f = 0.0
    col = row.get("column_name")
    cols = [str(col)] if col else []
    return {
        "recommendation_id": row.get("recommendation_id", ""),
        "type": row.get("type") or "index",
        "table": row.get("table") or "",
        "columns": cols,
        "priority": row.get("priority") or "medium",
        "query_count": int(row.get("query_count") or 0),
        "avg_execution_time_ms": float(row.get("avg_execution_time_ms") or 0),
        "sql_statement": str(row.get("sql_statement") or ""),
        "explanation": str(row.get("explanation") or ""),
        "estimated_improvement": est_f,
    }


def _maybe_mark_index_recommendation_applied(cursor, recommendation_id: str) -> None:
    rid = str(recommendation_id).strip()
    if not rid:
        return
    try:
        cursor.execute(
            """
            ALTER TABLE ml_optimization.index_recommendations
            ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'pending'
            """
        )
    except Exception as ex:
        logger.debug("Could not ensure index_recommendations.status column: %s", ex)
    cursor.execute(
        """
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'ml_optimization'
          AND table_name = 'index_recommendations'
          AND column_name = 'status'
        """
    )
    if not cursor.fetchone():
        return
    cursor.execute(
        """
        UPDATE ml_optimization.index_recommendations
        SET status = 'applied'
        WHERE recommendation_id::text = %s
        """,
        (rid,),
    )


def _index_recommendations_has_status_column(cursor) -> bool:
    cursor.execute(
        """
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'ml_optimization'
          AND table_name = 'index_recommendations'
          AND column_name = 'status'
        LIMIT 1
        """
    )
    return cursor.fetchone() is not None


def _coerce_api_recommendation_status_query(status: Optional[str]) -> Optional[str]:
    """
    Map GET ``status`` query param to ``_build_optimization_recommendations_payload`` filter.

    - Param omitted (None): default ``pending`` (actionable recommendations only).
    - ``all`` / ``any`` / ``*``: no status filter (include applied/rejected from DB).
    - Otherwise: ``pending`` | ``applied`` | ``rejected``, or ``pending`` if unknown.
    """
    if status is None:
        return "pending"
    s = str(status).strip().lower()
    if s in ("all", "any", "*"):
        return None
    if s in ("pending", "applied", "rejected"):
        return s
    return "pending"


def _optimization_suppress_pending_after_apply_audit() -> bool:
    """When true, drop pending rows whose (type, table, column) already has an apply audit row."""
    raw = os.environ.get("OPTIMIZATION_SUPPRESS_PENDING_AFTER_APPLY", "1").strip().lower()
    return raw not in ("0", "false", "no", "off")


def _optimization_apply_events_table_exists(cursor) -> bool:
    cursor.execute(
        """
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'ml_optimization'
              AND table_name = 'optimization_apply_events'
        )
        """
    )
    row = cursor.fetchone()
    return bool(row and (row.get("exists") if isinstance(row, dict) else row[0]))


def _first_apply_event_column(cols: Any) -> Optional[str]:
    """First column name from optimization_apply_events.column_names (json/jsonb or Python list)."""
    if cols is None:
        return None
    if isinstance(cols, list):
        if not cols:
            return None
        s = str(cols[0]).strip()
        return s.lower() if s else None
    if isinstance(cols, str):
        t = cols.strip()
        if not t:
            return None
        try:
            parsed = json.loads(t)
            if isinstance(parsed, list) and parsed:
                s = str(parsed[0]).strip()
                return s.lower() if s else None
        except (TypeError, ValueError, json.JSONDecodeError):
            return None
    return None


def _recommendation_apply_suppress_key(rec: Dict[str, Any]) -> Optional[Tuple[str, str, str]]:
    """(type_lower, table_lower, column_lower) for matching apply audit rows."""
    rtype = str(rec.get("type") or "index").strip().lower()
    if rtype not in ("index", "partition"):
        return None
    tbl = str(rec.get("table") or rec.get("table_name") or "").strip().lower()
    if not tbl:
        return None
    cols = rec.get("columns") or []
    col0: Optional[str] = None
    if isinstance(cols, list) and cols:
        col0 = str(cols[0]).strip().lower() or None
    elif isinstance(cols, str) and cols.strip():
        col0 = cols.strip().lower()
    if not col0 and rtype == "partition":
        pc = rec.get("partition_column")
        if pc and str(pc).strip():
            col0 = str(pc).strip().lower()
    if not col0:
        return None
    return (rtype, tbl, col0)


def _strip_recommendations_matching_apply_events(cursor, items: List[dict]) -> List[dict]:
    """
    Remove pending recommendations when Implement already ran for the same
    (recommendation_type, table_name, leading column). Covers ``model-*`` rows that
    regenerate with new IDs and cases where catalog redundancy checks lag behind.
    """
    if not items or not _optimization_suppress_pending_after_apply_audit():
        return items
    if not _optimization_apply_events_table_exists(cursor):
        return items
    try:
        cursor.execute(
            """
            SELECT recommendation_type, table_name, column_names
            FROM ml_optimization.optimization_apply_events
            WHERE LOWER(COALESCE(recommendation_type, '')) IN ('index', 'partition')
              AND applied_at >= NOW() - INTERVAL '730 days'
            ORDER BY applied_at DESC
            LIMIT 5000
            """
        )
        rows = cursor.fetchall()
    except Exception as ex:
        logger.debug("apply-events suppress skipped: %s", ex)
        return items
    applied: set[Tuple[str, str, str]] = set()
    for row in rows:
        rtype = str(row.get("recommendation_type") or "index").strip().lower()
        if rtype not in ("index", "partition"):
            continue
        tbl = str(row.get("table_name") or "").strip().lower()
        c0 = _first_apply_event_column(row.get("column_names"))
        if tbl and c0:
            applied.add((rtype, tbl, c0))
            if "." in tbl:
                applied.add((rtype, tbl.split(".", 1)[1], c0))
    if not applied:
        return items
    out: List[dict] = []
    for rec in items:
        key = _recommendation_apply_suppress_key(rec)
        if key is None:
            out.append(rec)
            continue
        rtype, tbl, c0 = key
        candidates = {key}
        if "." in tbl:
            candidates.add((rtype, tbl.split(".", 1)[1], c0))
        if candidates & applied:
            continue
        out.append(rec)
    return out


def _get_table_columns(cursor, schema: str, table: str, limit: int = 5) -> list:
    """Get real column names for a table, preferring id/date/key-like columns first."""
    cursor.execute("""
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
        LIMIT %s
    """, (schema, table, limit * 2))
    raw = [r.get("column_name", "") for r in cursor.fetchall() if r.get("column_name")]
    # Prefer columns that look like keys/dates for indexing
    key_like = [c for c in raw if c in ("id", "pk", "key", "created_at", "updated_at", "date", "order_id", "customer_id", "product_id")]
    other = [c for c in raw if c not in key_like]
    return (key_like + other)[:limit] if (key_like or other) else raw[:limit]


def _get_partition_key_candidates(cursor, schema: str, table: str, limit: int = 5) -> List[str]:
    """Real catalog columns suited for RANGE partitioning (timestamp/date first), like index fallback uses real columns."""
    cursor.execute(
        """
        SELECT column_name, data_type
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
        """,
        (schema, table),
    )
    rows = cursor.fetchall()
    if not rows:
        return []

    time_types = frozenset(
        {
            "timestamp without time zone",
            "timestamp with time zone",
            "date",
            "time without time zone",
            "time with time zone",
        }
    )
    name_hints = frozenset(
        {
            "created_at",
            "updated_at",
            "order_date",
            "event_ts",
            "event_time",
            "occurred_at",
            "timestamp",
            "date",
            "loaded_at",
            "ingested_at",
        }
    )

    typed_time: List[str] = []
    name_time: List[str] = []

    for r in rows:
        cn = (r.get("column_name") or "").strip()
        if not cn:
            continue
        dt = (r.get("data_type") or "").lower()
        cl = cn.lower()
        if dt in time_types or "timestamp" in dt or dt == "date":
            typed_time.append(cn)
        elif cl in name_hints or _column_suitable_for_range_partition(cn):
            name_time.append(cn)

    # Only time/ingest-like columns — do not suggest RANGE partition on arbitrary IDs.
    ordered = typed_time + name_time
    seen: set = set()
    out: List[str] = []
    for c in ordered:
        lk = c.lower()
        if lk in seen:
            continue
        seen.add(lk)
        out.append(c)
    return out[:limit]


def _get_fallback_index_recommendations(conn, type_filter: Optional[str]) -> dict:
    """Derive index recommendations from pg_stat_user_tables and real schema when index_recommendations table is missing."""
    if type_filter and type_filter != "index":
        return {"recommendations": [], "total": 0}
    result = []
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                schemaname,
                relname AS tablename,
                COALESCE(seq_scan, 0) AS seq_scan,
                COALESCE(idx_scan, 0) AS idx_scan,
                COALESCE(n_live_tup, 0) AS n_live_tup
            FROM pg_stat_user_tables
            WHERE schemaname IN ('bronze', 'silver', 'gold')
            ORDER BY COALESCE(seq_scan, 0) DESC, COALESCE(n_live_tup, 0) DESC
            LIMIT 20
        """)
        rows = cursor.fetchall()
        min_seq = _fallback_min_seq_scan()
        for i, row in enumerate(rows):
            schema = row.get("schemaname", "")
            table = row.get("tablename", "")
            seq_scan = int(row.get("seq_scan", 0) or 0)
            idx_scan = int(row.get("idx_scan", 0) or 0)
            n_live = int(row.get("n_live_tup", 0) or 0)
            if seq_scan < min_seq:
                continue
            full_name = f"{schema}.{table}" if schema else table
            priority = "high" if seq_scan > 100 else "medium" if seq_scan > 10 else "low"
            reason = f"Sequential scans: {seq_scan}, index scans: {idx_scan}"
            if n_live > 0:
                reason += f", ~{n_live:,} rows"
            reason += ". Consider a B-tree index on the leading catalog column (filter/join keys)."
            columns = _get_table_columns(cursor, schema, table, 5)
            primary_col = columns[0] if columns else "id"
            sql_stmt = f"CREATE INDEX IF NOT EXISTS idx_{table}_recommended ON {full_name} ({primary_col});"
            result.append({
                "recommendation_id": f"fallback-index-{schema}-{table}-{i}",
                "type": "index",
                "table": full_name,
                "columns": [primary_col],
                "estimated_improvement": 0.25,
                "cost": 0.15,
                "priority": priority,
                "status": "pending",
                "created_at": datetime.now(timezone.utc).isoformat(),
                "query_count": seq_scan,
                "avg_execution_time_ms": 0.0,
                "sql_statement": sql_stmt,
                "reason": reason,
                "recommendation_source": "pg_stat_heuristic",
            })
        return {"recommendations": result, "total": len(result)}
    except Exception as e:
        logger.warning(f"Fallback index recommendations failed: {e}")
        return {"recommendations": [], "total": 0}


def _get_fallback_partition_recommendations(conn) -> list:
    """Derive partition recommendations from pg stats + real columns (mirrors index fallback shape)."""
    result = []
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        cursor.execute("""
            SELECT
                s.schemaname,
                s.relname AS tablename,
                COALESCE(s.seq_scan, 0) AS seq_scan,
                COALESCE(s.idx_scan, 0) AS idx_scan,
                COALESCE(s.n_live_tup, 0) AS n_live_tup,
                pg_total_relation_size(s.schemaname||'.'||s.relname) AS total_bytes
            FROM pg_stat_user_tables s
            WHERE s.schemaname IN ('bronze', 'silver', 'gold')
            ORDER BY COALESCE(s.seq_scan, 0) DESC, COALESCE(s.n_live_tup, 0) DESC
            LIMIT 20
        """)
        rows = cursor.fetchall()
        min_seq = _fallback_min_seq_scan()
        for i, row in enumerate(rows):
            schema = row.get("schemaname", "")
            table = row.get("tablename", "")
            seq_scan = int(row.get("seq_scan", 0) or 0)
            idx_scan = int(row.get("idx_scan", 0) or 0)
            n_live = int(row.get("n_live_tup", 0) or 0)
            total_bytes = int(row.get("total_bytes", 0) or 0)
            if seq_scan < min_seq:
                continue
            full_name = f"{schema}.{table}" if schema else table
            size_mb = total_bytes / (1024.0 * 1024.0)
            pr_min = _partition_fallback_min_rows()
            mb_min = _partition_fallback_min_mb()
            if n_live < pr_min and size_mb < mb_min:
                continue
            part_cols = _get_partition_key_candidates(cursor, schema, table, 5)
            if not part_cols:
                continue
            primary = part_cols[0]
            priority = "high" if seq_scan > 100 else "medium" if seq_scan > 10 else "low"
            reason = f"Sequential scans: {seq_scan}, index scans: {idx_scan}"
            if n_live > 0:
                reason += f", ~{n_live:,} rows"
            if size_mb >= 0.1:
                reason += f", {size_mb:.1f} MB"
            reason += f". Consider RANGE partitioning on `{primary}` (catalog-ranked time/ingest columns)."
            sql_stmt = (
                f"-- Template: CREATE TABLE {full_name}_partitioned (LIKE {full_name} INCLUDING ALL) "
                f"PARTITION BY RANGE ({primary});\n"
                f"-- Create monthly (or other) child partitions on {primary}, load, validate, then cutover."
            )
            result.append({
                "recommendation_id": f"fallback-partition-{schema}-{table}-{i}",
                "type": "partition",
                "table": full_name,
                "partition_column": primary,
                "columns": part_cols,
                "estimated_improvement": 0.2,
                "cost": 0.2,
                "priority": priority,
                "status": "pending",
                "created_at": datetime.utcnow().isoformat(),
                "query_count": seq_scan,
                "avg_execution_time_ms": 0.0,
                "sql_statement": sql_stmt,
                "reason": reason,
                "recommendation_source": "pg_stat_heuristic",
            })
        return result
    except Exception as e:
        logger.warning(f"Fallback partition recommendations failed: {e}")
        return []


def _warehouse_top_tables_for_partition_augment(conn, limit: int = 15) -> List[str]:
    """Schema-qualified bronze/silver/gold tables ordered by activity (seq_scan, then live rows)."""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cursor.execute(
            """
            SELECT schemaname, relname
            FROM pg_stat_user_tables
            WHERE schemaname IN ('bronze', 'silver', 'gold')
            ORDER BY COALESCE(seq_scan, 0) DESC, COALESCE(n_live_tup, 0) DESC
            LIMIT %s
            """,
            (limit,),
        )
        out: List[str] = []
        for r in cursor.fetchall():
            sch = (r.get("schemaname") or "").strip()
            rel = (r.get("relname") or "").strip()
            if sch and rel:
                out.append(f"{sch}.{rel}")
        return out
    finally:
        cursor.close()


def _augment_live_partition_hints_from_workload_tables(
    conn,
    live: List[dict],
    type_filter: Optional[str],
) -> List[dict]:
    """
    Ensure partition recommendations exist when ML workload mostly yields index (join/id) columns.

    Uses catalog time/ingest columns from `_get_partition_key_candidates` for each distinct
    table seen in live **index** rows. If there are no index rows (e.g. type=partition-only
    request with empty ML output), falls back to top warehouse tables by pg_stat activity.
    """
    if type_filter == "index":
        return live
    if not _optimization_augment_partition_hints_from_workload():
        return live

    seen_keys = {_recommendation_dedupe_key(r) for r in live}
    tables_ordered: List[str] = []
    seen_tbl: set = set()

    for r in live:
        if str(r.get("type", "index") or "index").lower() != "index":
            continue
        tbl = str(r.get("table") or "").strip()
        if not tbl or "." not in tbl:
            continue
        lk = tbl.lower()
        if lk in seen_tbl:
            continue
        seen_tbl.add(lk)
        tables_ordered.append(tbl)

    if not tables_ordered:
        for tbl in _warehouse_top_tables_for_partition_augment(conn, 15):
            lk = tbl.lower()
            if lk not in seen_tbl:
                seen_tbl.add(lk)
                tables_ordered.append(tbl)

    if not tables_ordered:
        return live

    cursor = conn.cursor(cursor_factory=RealDictCursor)
    extra: List[dict] = []
    try:
        now = datetime.now(timezone.utc).isoformat()
        for full_name in tables_ordered[:25]:
            parts = full_name.split(".", 1)
            if len(parts) != 2:
                continue
            schema, table = parts[0].strip(), parts[1].strip()
            part_cols = _get_partition_key_candidates(cursor, schema, table, 5)
            if not part_cols:
                continue
            primary = part_cols[0]
            # Single-column signature avoids duplicate rows vs ML partition on the same key.
            cand = {"type": "partition", "table": f"{schema}.{table}", "columns": [primary]}
            k = _recommendation_dedupe_key(cand)
            if k in seen_keys:
                continue
            seen_keys.add(k)

            idx_for_table = [
                r
                for r in live
                if str(r.get("type", "index") or "").lower() == "index"
                and str(r.get("table") or "").strip().lower() == f"{schema}.{table}".lower()
            ]
            ref = None
            if idx_for_table:
                ref = max(
                    idx_for_table,
                    key=lambda x: float(x.get("estimated_improvement") or 0),
                )

            if ref is not None:
                est = float(
                    min(
                        0.45,
                        max(
                            0.12,
                            float(ref.get("estimated_improvement") or 0.2) * 0.85,
                        ),
                    )
                )
                pri = str(ref.get("priority") or "medium")
                qc = int(ref.get("query_count") or 0)
                avg_ms = float(ref.get("avg_execution_time_ms") or 0)
                reason = (
                    f"Workload index activity on `{schema}.{table}`; catalog candidate for "
                    f"RANGE partition on `{primary}` (time/ingest column)."
                )
            else:
                est = 0.2
                pri = "medium"
                qc = 0
                avg_ms = 0.0
                reason = (
                    f"Active warehouse table `{schema}.{table}`; catalog candidate for RANGE "
                    f"partition on `{primary}`."
                )

            sql_stmt = (
                f"-- Template: CREATE TABLE {schema}.{table}_partitioned "
                f"(LIKE {schema}.{table} INCLUDING ALL) PARTITION BY RANGE ({primary});\n"
                f"-- Create child partitions on {primary}, validate, then cutover."
            )
            safe_primary = re.sub(r"[^a-z0-9_]", "_", primary.lower())
            extra.append(
                {
                    "recommendation_id": f"workload-partition-{schema}-{table}-{safe_primary}",
                    "type": "partition",
                    "table": f"{schema}.{table}",
                    "partition_column": primary,
                    "columns": [primary],
                    "estimated_improvement": est,
                    "cost": 0.2,
                    "priority": pri,
                    "status": "pending",
                    "created_at": now,
                    "query_count": qc,
                    "avg_execution_time_ms": avg_ms,
                    "sql_statement": sql_stmt,
                    "reason": reason,
                    "recommendation_source": "workload_partition",
                }
            )
        return live + extra
    finally:
        cursor.close()


def _merge_pg_stat_live_recommendations(
    conn,
    type_filter: Optional[str],
    live: List[dict],
) -> List[dict]:
    """Append catalog/pg_stat-derived suggestions; ML rows keep priority on duplicate keys."""
    if not _optimization_merge_pg_stat_live():
        return live
    try:
        idx_res = _get_fallback_index_recommendations(conn, type_filter)
        idx_pg = list(idx_res.get("recommendations") or [])
        part_pg: List[dict] = []
        if type_filter is None or type_filter == "partition":
            part_pg = _get_fallback_partition_recommendations(conn)
        raw = idx_pg + part_pg
        if not raw:
            return live
        vetted = _filter_genuine_recommendations(conn, raw)
        if not vetted:
            return live
        return _merge_recommendations_live_first(live, vetted)
    except Exception as ex:
        logger.debug("pg_stat live merge failed: %s", ex, exc_info=True)
        return live


def _warn_if_live_ml_models_missing_once(models: Dict[str, Any]) -> None:
    global _live_ml_models_missing_warned
    if _live_ml_models_missing_warned:
        return
    if not _optimization_live_on_recommendations_get():
        return
    if models.get("predictor") or models.get("anomaly_detector"):
        return
    _live_ml_models_missing_warned = True
    logger.warning(
        "Live ML recommendations are disabled: no query_time_predictor (.pkl or "
        "query_time_predictor_xgboost.json) and no anomaly_detector.pkl under %s. "
        "Train models (e.g. scripts/ml-optimization/train_model.py) or run "
        "scripts/ml-optimization/generate_recommendations_ml.py to insert persisted rows.",
        _project_models_dir(),
    )


def _build_optimization_recommendations_payload(
    conn,
    type_filter: Optional[str],
    limit: int,
    status_filter: Optional[str] = None,
    *,
    analytics_bundle_fast: bool = False,
) -> dict:
    """
    Core recommendations builder used by both REST and WebSocket.

    It returns the final merged list (live ML output + persisted DB rows, when available).

    ``status_filter``: ``None`` = no status narrowing. ``pending`` / ``applied`` / ``rejected``
    filter persisted rows (when a ``status`` column exists) and post-filter the merged list.

    ``analytics_bundle_fast``: for ``/analytics-dashboard-bundle`` only — skip live ML sampling,
    pg_stat merge, partition augmentation, and per-row model rescore (persisted rows + merge only).
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    status_s = status_filter

    # Check if table exists
    cursor.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'ml_optimization' AND table_name = 'index_recommendations'
        )
    """)
    table_exists = cursor.fetchone().get('exists', False)

    if not table_exists:
        # Fallback: derive index and/or partition recommendations from table stats
        index_res = _get_fallback_index_recommendations(conn, type_filter)
        index_list = index_res.get("recommendations", [])
        partition_list = (
            _get_fallback_partition_recommendations(conn)
            if (type_filter is None or type_filter == "partition")
            else []
        )
        combined = index_list + partition_list
        combined = _filter_genuine_recommendations(conn, combined)
        return {"recommendations": combined, "total": len(combined)}

    if analytics_bundle_fast:
        models = {}
    else:
        models = _load_trained_models()
        _warn_if_live_ml_models_missing_once(models)
    live: List[dict] = []
    live_pair_scores: Dict[Tuple[str, str], Tuple[float, Optional[float]]] = {}
    live_ml_rows = 0
    if not analytics_bundle_fast and _optimization_live_on_recommendations_get() and (
        models.get("predictor") or models.get("anomaly_detector")
    ):
        live, live_pair_scores = _generate_model_based_recommendations(
            conn,
            type_filter=type_filter,
            return_cap=limit,
        )
        live_ml_rows = len(live)

    if not analytics_bundle_fast:
        live = _augment_live_partition_hints_from_workload_tables(conn, live, type_filter)

        # Current pg_stat activity (seq scans, table size) — refreshed every request / WS tick.
        live = _merge_pg_stat_live_recommendations(conn, type_filter, live)

    # Persisted recommendations (merged under live rows for the same table/column)
    has_status_col = _index_recommendations_has_status_column(cursor)
    status_expr = (
        "COALESCE(NULLIF(TRIM(BOTH FROM ir.status::text), ''), 'pending')"
        if has_status_col
        else "'pending'"
    )
    query = f"""
        SELECT 
            ir.recommendation_id::text as recommendation_id,
            ir.recommendation_type as type,
            ir.table_name as table,
            ARRAY[ir.column_name] as columns,
            CASE 
                WHEN ir.estimated_improvement::text ~ '^[0-9]+\\.?[0-9]*$' 
                THEN CAST(ir.estimated_improvement AS FLOAT) / 100.0
                ELSE 0.3
            END as estimated_improvement,
            CASE 
                WHEN ir.priority = 'high' THEN 0.2
                WHEN ir.priority = 'medium' THEN 0.15
                ELSE 0.1
            END as cost,
            ir.priority,
            {status_expr} as status,
            ir.created_at::text as created_at,
            ir.query_count,
            ir.avg_execution_time_ms,
            ir.sql_statement
        FROM ml_optimization.index_recommendations ir
        WHERE 1=1
    """
    params = []
    if type_filter:
        query += " AND ir.recommendation_type = %s"
        params.append(type_filter)
    if has_status_col and status_s == "pending":
        query += """
            AND (
                ir.status IS NULL
                OR TRIM(BOTH FROM ir.status::text) = ''
                OR LOWER(TRIM(BOTH FROM ir.status::text)) = 'pending'
            )
        """
    elif has_status_col and status_s == "applied":
        query += " AND LOWER(TRIM(BOTH FROM ir.status::text)) = 'applied'"
    elif has_status_col and status_s == "rejected":
        query += " AND LOWER(TRIM(BOTH FROM ir.status::text)) = 'rejected'"

    fetch_limit = min(max(limit * 2, 120), 500)
    query += " ORDER BY ir.priority DESC, ir.query_count DESC LIMIT %s"
    params.append(fetch_limit)

    cursor.execute(query, params)
    recommendations = cursor.fetchall()

    result: List[dict] = []
    for rec in recommendations:
        qc = rec.get("query_count", 0) or 0
        avg_ms = float(rec.get("avg_execution_time_ms", 0) or 0)
        rec_type = str(rec.get("type", "index") or "index").lower()
        cols = rec.get("columns") or []
        col0 = cols[0] if isinstance(cols, list) and cols else None
        if rec_type == "partition":
            reason = (
                f"Query count: {qc}, avg {avg_ms:.0f} ms — "
                f"consider RANGE partitioning on `{col0 or 'a time/ingest column'}` (same signals as index advisor)."
            )
        else:
            reason = f"Query count: {qc}, avg {avg_ms:.0f} ms — consider index to improve performance."
        row: Dict[str, Any] = {
            "recommendation_id": rec.get("recommendation_id", ""),
            "type": rec.get("type", "index"),
            "table": rec.get("table", ""),
            "columns": rec.get("columns", []),
            "estimated_improvement": float(rec.get("estimated_improvement", 0.3)),
            "cost": float(rec.get("cost", 0.15)),
            "priority": rec.get("priority", "medium"),
            "status": rec.get("status", "pending"),
            "created_at": rec.get("created_at", datetime.now(timezone.utc).isoformat()),
            "query_count": qc,
            "avg_execution_time_ms": avg_ms,
            "sql_statement": rec.get("sql_statement", ""),
            "reason": reason,
            "recommendation_source": "persisted_db",
        }
        if rec_type == "partition" and col0:
            row["partition_column"] = col0
        result.append(row)

    # If ML models are available, rescore DB-backed recommendations using model outputs.
    # Each (table, column) used to trigger its own ILIKE-heavy query_logs scan; dedupe + cap
    # keeps /optimization/recommendations responsive on large query_logs tables.
    predictor: Optional[QueryTimePredictor] = models.get("predictor")
    detector: Optional[QueryAnomalyDetector] = models.get("anomaly_detector")
    if not analytics_bundle_fast and (predictor is not None or detector is not None) and result:
        pair_order: List[Tuple[str, str]] = []
        seen_norm: set = set()
        for rec in result:
            table = rec.get("table")
            cols = rec.get("columns") or []
            col = cols[0] if isinstance(cols, list) and cols else None
            if not table or not col:
                continue
            nk = _norm_recommendation_pair_key(str(table), str(col))
            if nk in seen_norm:
                continue
            seen_norm.add(nk)
            pair_order.append((str(table).strip(), str(col).strip()))

        rescore_max = _optimization_rescore_unique_pairs_max()
        score_cache: Dict[Tuple[str, str], Tuple[float, Optional[float]]] = {}
        for table, col in pair_order[:rescore_max] if rescore_max > 0 else []:
            nk = _norm_recommendation_pair_key(table, col)
            if nk in live_pair_scores:
                score_cache[nk] = live_pair_scores[nk]
            else:
                score_cache[nk] = _model_score_for_table_column(
                    conn,
                    table=table,
                    column=col,
                    predictor=predictor,
                    detector=detector,
                    limit_logs=200,
                )

        for rec in result:
            table = rec.get("table")
            cols = rec.get("columns") or []
            col = cols[0] if isinstance(cols, list) and cols else None
            if not table or not col:
                continue
            nk = _norm_recommendation_pair_key(str(table), str(col))
            scored = score_cache.get(nk)
            if scored is None:
                continue
            severity_mean, pred_avg_ms = scored
            normalized = severity_mean / (severity_mean + 1.0) if severity_mean >= 0 else 0.0
            estimated_improvement = float(min(0.5, 0.05 + 0.45 * normalized))
            if estimated_improvement >= 0.30:
                priority = "high"
            elif estimated_improvement >= 0.15:
                priority = "medium"
            else:
                priority = "low"
            rec["estimated_improvement"] = estimated_improvement
            rec["priority"] = priority
            rec["cost"] = 0.20 if priority == "high" else 0.15 if priority == "medium" else 0.10
            pred_part = f"{pred_avg_ms:.0f} ms" if pred_avg_ms is not None else "n/a"
            rtype = str(rec.get("type", "index") or "index").lower()
            if rtype == "partition":
                rec["reason"] = (
                    f"Model-scored severity={severity_mean:.4f}, pred_avg={pred_part} — "
                    "partitioning may prune range/time filters seen in workload."
                )
                if col:
                    rec["partition_column"] = col
            else:
                rec["reason"] = f"Model-scored severity={severity_mean:.4f}, pred_avg={pred_part}."
            rec["explanation"] = rec["reason"]

    merged = _merge_recommendations_live_first(live, result)
    merged = _sort_recommendations_by_priority(merged)
    merged = _filter_genuine_recommendations(conn, merged)
    merged_after_catalog_filter = len(merged)
    if status_s == "pending":
        merged = _strip_recommendations_matching_apply_events(cursor, merged)
        merged = [
            r
            for r in merged
            if str(r.get("status") or "pending").strip().lower() in ("", "pending")
        ]
    elif status_s == "applied":
        merged = [r for r in merged if str(r.get("status") or "").strip().lower() == "applied"]
    elif status_s == "rejected":
        merged = [r for r in merged if str(r.get("status") or "").strip().lower() == "rejected"]
    merged_after_status_filter = len(merged)
    merged = merged[:limit]
    payload: Dict[str, Any] = {"recommendations": merged, "total": len(merged)}
    if _optimization_include_recommendation_debug_counts():
        try:
            live_after_catalog = len(_filter_genuine_recommendations(conn, list(live)))
        except Exception:
            live_after_catalog = None
        payload["debug"] = {
            "live_ml_rows": live_ml_rows,
            "live_rows_post_merge": len(live),
            "live_rows_after_catalog_filter": live_after_catalog,
            "merged_rows_after_catalog_filter": merged_after_catalog_filter,
            "merged_rows_after_status_filter": merged_after_status_filter,
            "returned_rows": len(payload["recommendations"]),
            "limit": limit,
            "status_filter": status_s,
            "type_filter": type_filter,
        }
    return payload


@router.get("/recommendations")
def get_optimization_recommendations(
    type: Optional[str] = Query(None, description="Filter by type"),
    status: Optional[str] = Query(None, description="Filter by status"),
    limit: int = Query(100, ge=1, le=250, description="Max recommendations to return after merge"),
) -> dict:
    """
    Get ML-generated optimization recommendations.

    Each request re-samples the newest rows in ``query_logs`` (see env:
    ``OPTIMIZATION_QUERY_LOG_LIMIT``, ``OPTIMIZATION_QUERY_LOG_LOOKBACK_HOURS``),
    merges **current** ``pg_stat_user_tables`` index/partition hints when
    ``OPTIMIZATION_MERGE_PG_STAT_LIVE`` is on (default off), then merges persisted
    rows in ``index_recommendations`` so the UI tracks live workload + catalog stats.

    Args:
        type: Filter by recommendation type (index, partition, cache)
        status: Filter by status (``pending`` default when omitted, ``applied``, ``rejected``).
            Use ``all`` to include every persisted status.

    Returns:
        List of optimization recommendations
    """
    try:
        with get_db_connection() as conn:
            eff = _coerce_api_recommendation_status_query(status)
            return _build_optimization_recommendations_payload(
                conn,
                type_filter=type,
                limit=limit,
                status_filter=eff,
            )

    except Exception as e:
        logger.error(f"Error fetching optimization recommendations: {e}", exc_info=True)
        return {"recommendations": [], "total": 0}


def _apply_optimization_sync(recommendation_id: str, body: Dict[str, Any]) -> dict:
    """
    Blocking apply path: validate catalog + privileges, optional query_log evidence,
    then server-generated CREATE INDEX (optionally CONCURRENTLY) and audit insert.
    """
    request = ApplyOptimizationRequest(**body)
    applied_at = datetime.now(timezone.utc)
    allowed = _ddl_allowed_schemas()
    use_concurrent = os.environ.get("OPTIMIZATION_INDEX_USE_CONCURRENTLY", "1").strip().lower() not in (
        "0",
        "false",
        "no",
    )
    lock_ms = _ddl_lock_timeout_ms()

    persisted: Dict[str, Any] = {}
    with get_db_connection() as conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            _ensure_apply_events_table(cur)
            try:
                persisted = _fetch_persisted_recommendation_for_apply(cur, recommendation_id)
            except Exception as ex:
                logger.debug("Persisted recommendation lookup skipped: %s", ex)
                persisted = {}
        finally:
            cur.close()

    snap = request.snapshot if isinstance(request.snapshot, dict) else {}
    merged: Dict[str, Any] = {**persisted, **snap}
    merged["recommendation_id"] = recommendation_id

    rtype = str(merged.get("type") or "index").lower()
    if rtype == "cache":
        raise HTTPException(
            status_code=400,
            detail="Cache-type recommendations are not applied as database DDL.",
        )
    if rtype not in ("index", "partition"):
        rtype = "index"
    merged["type"] = rtype

    with get_db_connection() as conn:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        try:
            ok_tgt, sch, rel, idx_col = _recommendation_resolves_to_index_target(cur, merged, allowed)
            if not ok_tgt:
                raise HTTPException(
                    status_code=400,
                    detail="Recommendation does not resolve to an indexable table/column in allowed schemas "
                    f"({', '.join(sorted(allowed))}).",
                )
            if not _validate_physical_relation(cur, sch, rel):
                raise HTTPException(
                    status_code=400,
                    detail=f"Table {sch}.{rel} is missing or is not a base/partitioned table.",
                )
            if not _validate_table_column(cur, sch, rel, idx_col):
                raise HTTPException(
                    status_code=400,
                    detail=f"Column {idx_col!r} not found on {sch}.{rel}.",
                )
            if not _role_can_create_in_schema(cur, sch):
                raise HTTPException(
                    status_code=403,
                    detail=f"Current role cannot CREATE in schema {sch!r} (required for index DDL).",
                )
            if _index_leading_column_already_indexed(cur, sch, rel, idx_col):
                # Keep already-optimized rows visible in Optimization History and suppress
                # re-showing in pending recommendations by recording an audit event.
                tbl_display = f"{sch}.{rel}"
                qc = merged.get("query_count")
                try:
                    query_count = int(qc) if qc is not None else None
                except (TypeError, ValueError):
                    query_count = None
                avg_raw = merged.get("avg_execution_time_ms")
                try:
                    avg_ms = float(avg_raw) if avg_raw is not None else None
                except (TypeError, ValueError):
                    avg_ms = None
                est_raw = merged.get("estimated_improvement")
                est_f: Optional[float] = None
                if est_raw is not None:
                    try:
                        est_f = (
                            float(est_raw)
                            if isinstance(est_raw, (int, float))
                            else float(str(est_raw).strip().rstrip("%"))
                        )
                    except (TypeError, ValueError):
                        est_f = None
                part_raw = merged.get("partition_column")
                part_col = str(part_raw).strip() if part_raw else None
                if not part_col and rtype == "partition":
                    part_col = idx_col
                detail = (
                    f"A valid index on {sch}.{rel} already leads with column {idx_col!r}; "
                    "no new DDL required."
                )
                with get_db_connection() as sat_conn:
                    sat_cur = sat_conn.cursor(cursor_factory=RealDictCursor)
                    try:
                        _insert_apply_event(
                            sat_cur,
                            recommendation_id=recommendation_id,
                            rtype=rtype,
                            table_name=tbl_display,
                            column_names=[idx_col],
                            priority=str(merged.get("priority") or "medium"),
                            query_count=query_count,
                            avg_execution_time_ms=avg_ms,
                            sql_statement=str(merged.get("sql_statement") or ""),
                            explanation=detail,
                            estimated_improvement=est_f,
                            partition_column=part_col,
                            applied_by="dashboard",
                            executed_ddl="",
                            created_index_name="",
                            apply_outcome="already_satisfied",
                        )
                        _maybe_mark_index_recommendation_applied(sat_cur, recommendation_id)
                    finally:
                        sat_cur.close()
                return {
                    "recommendation_id": recommendation_id,
                    "status": "already_satisfied",
                    "outcome": "already_satisfied",
                    "detail": detail,
                    "persisted": True,
                    "ddl_executed": "",
                    "created_index_name": "",
                    "applied_at": applied_at.isoformat(),
                }
            min_ev = _min_query_evidence_hits()
            if min_ev > 0 and _query_logs_table_exists(cur):
                hits = _query_log_evidence_hits(cur, sch, rel, idx_col)
                if hits < min_ev:
                    raise HTTPException(
                        status_code=422,
                        detail=(
                            f"Workload evidence too low ({hits} < {min_ev} query_logs hits for "
                            f"{sch}.{rel} + {idx_col!r}). Raise OPTIMIZATION_MIN_QUERY_EVIDENCE_HITS "
                            "or collect more matching query_logs."
                        ),
                    )
        finally:
            cur.close()

    ddl_sql, index_name = _build_create_index_ddl(sch, rel, idx_col, use_concurrent)

    try:
        if use_concurrent:
            _execute_ddl_autocommit(ddl_sql)
        else:
            with get_db_connection() as ddl_conn:
                dcur = ddl_conn.cursor()
                try:
                    dcur.execute("SET lock_timeout = %s", (f"{lock_ms}ms",))
                    stmt_to = _ddl_statement_timeout_setting()
                    if stmt_to is not None:
                        dcur.execute("SET statement_timeout = %s", (stmt_to,))
                    dcur.execute(ddl_sql)
                finally:
                    dcur.close()
    except Exception as dex:
        logger.error("Index DDL failed: %s", dex, exc_info=True)
        raise HTTPException(status_code=500, detail=f"Index DDL failed: {dex}") from dex

    # Canonical qualified name for audit + pending-list suppression (matches post-filter_genuine ``table``).
    tbl_display = f"{sch}.{rel}"
    cols_list = [idx_col]
    priority = str(merged.get("priority") or "medium")
    qc = merged.get("query_count")
    try:
        query_count = int(qc) if qc is not None else None
    except (TypeError, ValueError):
        query_count = None
    avg_raw = merged.get("avg_execution_time_ms")
    try:
        avg_ms = float(avg_raw) if avg_raw is not None else None
    except (TypeError, ValueError):
        avg_ms = None
    sql_stmt = str(merged.get("sql_statement") or ddl_sql)
    expl = str(merged.get("explanation") or merged.get("reason") or "") or f"Applied index {index_name}"
    est_raw = merged.get("estimated_improvement")
    est_f: Optional[float] = None
    if est_raw is not None:
        try:
            est_f = (
                float(est_raw)
                if isinstance(est_raw, (int, float))
                else float(str(est_raw).strip().rstrip("%"))
            )
        except (TypeError, ValueError):
            est_f = None
    part_raw = merged.get("partition_column")
    part_col = str(part_raw).strip() if part_raw else None
    if not part_col and rtype == "partition":
        part_col = idx_col

    with get_db_connection() as conn:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        try:
            _insert_apply_event(
                cursor,
                recommendation_id=recommendation_id,
                rtype=rtype,
                table_name=tbl_display,
                column_names=cols_list,
                priority=priority,
                query_count=query_count,
                avg_execution_time_ms=avg_ms,
                sql_statement=sql_stmt,
                explanation=expl,
                estimated_improvement=est_f,
                partition_column=part_col,
                applied_by="dashboard",
                executed_ddl=ddl_sql,
                created_index_name=index_name,
                apply_outcome="applied",
            )
            _maybe_mark_index_recommendation_applied(cursor, recommendation_id)
        finally:
            cursor.close()

    logger.info(
        "Implement: created index %s for recommendation_id=%s",
        index_name,
        recommendation_id,
    )
    return {
        "recommendation_id": recommendation_id,
        "status": "applied",
        "applied_at": applied_at.isoformat(),
        "persisted": True,
        "ddl_executed": ddl_sql,
        "created_index_name": index_name,
        "production_hints": {
            "ddl_lock_timeout_ms": lock_ms,
            "index_build_concurrent": use_concurrent,
            "statement_timeout_set": _ddl_statement_timeout_setting() is not None,
        },
    }


@router.post("/recommendations/{recommendation_id}/apply")
async def apply_optimization(
    recommendation_id: str,
    request: ApplyOptimizationRequest = Body(default_factory=ApplyOptimizationRequest),
) -> dict:
    """
    Create a real B-tree index on a verified warehouse table/column, then record an audit row.

    DDL is generated server-side only (never runs client ``sql_statement`` verbatim).
    Set ``OPTIMIZATION_INDEX_USE_CONCURRENTLY=0`` to use a transactional build (simpler for CI).

    Production-oriented checks (env-tunable): schema CREATE privilege, redundant leading-column index,
    optional ``OPTIMIZATION_MIN_QUERY_EVIDENCE_HITS`` against ``query_logs``, and DDL
    ``lock_timeout`` / optional ``statement_timeout``.
    """
    try:
        body = request.model_dump()
        return await asyncio.to_thread(_apply_optimization_sync, recommendation_id, body)
    except HTTPException:
        raise
    except Exception as e:
        logger.error("apply_optimization failed: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


def _date_strings_to_utc_ts_bounds(start_date: str, end_date: str) -> Tuple[datetime, datetime]:
    """
    Inclusive calendar [start_date, end_date] → [start_ts, end_exclusive_ts) for indexed time filters.

    For large ``query_logs`` tables, ensure an index on ``collected_at`` (e.g. btree on
    ``ml_optimization.query_logs (collected_at)``) so these windows stay fast.
    """
    s = datetime.strptime(start_date[:10], "%Y-%m-%d").date()
    e = datetime.strptime(end_date[:10], "%Y-%m-%d").date()
    start_ts = datetime(s.year, s.month, s.day, tzinfo=timezone.utc)
    end_exclusive = datetime(e.year, e.month, e.day, tzinfo=timezone.utc) + timedelta(days=1)
    return start_ts, end_exclusive


def _empty_query_perf_payload() -> Dict[str, Any]:
    return {"queries": [], "metrics": [], "total": 0, "used_unbounded_fallback": False}


def _empty_analytics_query_log_rollups() -> Dict[str, Any]:
    z = {"sample_rows": 0, "total_calls": 0.0}
    return {
        "hourly_calls_utc_7d": [0.0] * 24,
        "rollup_1d": dict(z),
        "rollup_7d": dict(z),
        "peak_utc_hour_7d": None,
        "peak_hour_total_calls_7d": 0.0,
        "peak_sample_log_id_7d": None,
    }


def _analytics_peak_hour_sample_log(cur, ts7, end_ex, from_sql: str) -> Dict[str, Any]:
    """
    UTC hour with max Σ calls in 7d window, plus one recent ``log_id`` from that hour
    (for manual verification in the UI).
    ``from_sql`` is ``_analytics_bundle_recent`` or ``ml_optimization.query_logs``.
    """
    out: Dict[str, Any] = {"peak_utc_hour_7d": None, "peak_hour_total_calls_7d": 0.0, "peak_sample_log_id_7d": None}
    try:
        cur.execute(
            f"""
            WITH hh AS (
                SELECT (EXTRACT(HOUR FROM (collected_at AT TIME ZONE 'UTC')))::int AS utc_h,
                       SUM(COALESCE(calls, 0))::double precision AS tot
                FROM {from_sql}
                WHERE collected_at >= %s AND collected_at < %s
                GROUP BY 1
            ),
            top_h AS (
                SELECT utc_h, tot FROM hh ORDER BY tot DESC NULLS LAST LIMIT 1
            )
            SELECT th.utc_h, th.tot, z.log_id
            FROM top_h th
            LEFT JOIN LATERAL (
                SELECT lq.log_id
                FROM {from_sql} lq
                WHERE lq.collected_at >= %s AND lq.collected_at < %s
                  AND (EXTRACT(HOUR FROM (lq.collected_at AT TIME ZONE 'UTC')))::int = th.utc_h
                ORDER BY lq.collected_at DESC NULLS LAST
                LIMIT 1
            ) z ON true
            """,
            (ts7, end_ex, ts7, end_ex),
        )
        row = cur.fetchone()
        if not row:
            return out
        uh = row.get("utc_h")
        if uh is not None:
            out["peak_utc_hour_7d"] = int(uh)
        out["peak_hour_total_calls_7d"] = float(row.get("tot") or 0.0)
        lid = row.get("log_id")
        if lid is not None:
            try:
                out["peak_sample_log_id_7d"] = int(lid)
            except (TypeError, ValueError):
                pass
    except Exception:
        logger.debug("peak hour sample log failed", exc_info=True)
    return out


def _analytics_rollups_from_temp(cur, ts1, ts7, end_ex) -> Dict[str, Any]:
    """True DB totals from ``_analytics_bundle_recent`` (matches ``query_logs`` in the same windows)."""
    hourly = [0.0] * 24
    cur.execute(
        """
        SELECT (EXTRACT(HOUR FROM (collected_at AT TIME ZONE 'UTC')))::int AS utc_hour,
               SUM(COALESCE(calls, 0))::double precision AS total_calls
        FROM _analytics_bundle_recent
        WHERE collected_at >= %s AND collected_at < %s
        GROUP BY 1
        """,
        (ts7, end_ex),
    )
    for row in cur.fetchall() or []:
        h = int(row.get("utc_hour") or 0)
        if 0 <= h < 24:
            hourly[h] = float(row.get("total_calls") or 0.0)

    def one_rollup(t0, t1) -> Dict[str, Any]:
        cur.execute(
            """
            SELECT COUNT(*)::bigint AS sample_rows,
                   SUM(COALESCE(calls, 0))::double precision AS total_calls
            FROM _analytics_bundle_recent
            WHERE collected_at >= %s AND collected_at < %s
            """,
            (t0, t1),
        )
        r = cur.fetchone() or {}
        return {
            "sample_rows": int(r.get("sample_rows") or 0),
            "total_calls": float(r.get("total_calls") or 0.0),
        }

    base = {
        "hourly_calls_utc_7d": hourly,
        "rollup_1d": one_rollup(ts1, end_ex),
        "rollup_7d": one_rollup(ts7, end_ex),
    }
    base.update(_analytics_peak_hour_sample_log(cur, ts7, end_ex, "_analytics_bundle_recent"))
    return base


def _analytics_rollups_from_query_logs_table(conn, ts1, ts7, end_ex) -> Dict[str, Any]:
    """Same rollups as ``_analytics_rollups_from_temp`` but reading ``ml_optimization.query_logs`` directly."""
    hourly = [0.0] * 24
    cur = conn.cursor(cursor_factory=RealDictCursor)
    try:
        cur.execute(
            """
            SELECT (EXTRACT(HOUR FROM (collected_at AT TIME ZONE 'UTC')))::int AS utc_hour,
                   SUM(COALESCE(calls, 0))::double precision AS total_calls
            FROM ml_optimization.query_logs
            WHERE collected_at >= %s AND collected_at < %s
            GROUP BY 1
            """,
            (ts7, end_ex),
        )
        for row in cur.fetchall() or []:
            h = int(row.get("utc_hour") or 0)
            if 0 <= h < 24:
                hourly[h] = float(row.get("total_calls") or 0.0)

        def one_rollup(t0, t1) -> Dict[str, Any]:
            cur.execute(
                """
                SELECT COUNT(*)::bigint AS sample_rows,
                       SUM(COALESCE(calls, 0))::double precision AS total_calls
                FROM ml_optimization.query_logs
                WHERE collected_at >= %s AND collected_at < %s
                """,
                (t0, t1),
            )
            r = cur.fetchone() or {}
            return {
                "sample_rows": int(r.get("sample_rows") or 0),
                "total_calls": float(r.get("total_calls") or 0.0),
            }

        base = {
            "hourly_calls_utc_7d": hourly,
            "rollup_1d": one_rollup(ts1, end_ex),
            "rollup_7d": one_rollup(ts7, end_ex),
        }
        base.update(_analytics_peak_hour_sample_log(cur, ts7, end_ex, "ml_optimization.query_logs"))
        return base
    finally:
        cur.close()


def _safe_float_ms_to_seconds(v: Any) -> float:
    """SQL aggregates can be NULL; psycopg2 may return Decimal."""
    if v is None:
        return 0.0
    try:
        return float(v) / 1000.0
    except (TypeError, ValueError):
        return 0.0


def _safe_int_metric(v: Any) -> int:
    if v is None:
        return 0
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


def _query_perf_aggregate_rows_to_metrics_list(metrics: List[Any]) -> List[dict]:
    """Turn GROUP BY query_hash rows into API metric dicts (seconds, cache rate)."""
    result: List[dict] = []
    for metric in metrics:
        hit = float(metric.get("sum_blks_hit") or 0)
        read = float(metric.get("sum_blks_read") or 0)
        denom = hit + read
        cache_hit = (hit / denom) if denom > 0 else None
        le = metric.get("last_executed")
        if le is not None and hasattr(le, "isoformat"):
            last_executed = le.isoformat()
        else:
            last_executed = None
        sl = metric.get("sample_log_id")
        sample_log_id: Optional[int] = None
        if sl is not None:
            try:
                sample_log_id = int(sl)
            except (TypeError, ValueError):
                sample_log_id = None
        result.append(
            {
                "query_id": metric.get("query_id", ""),
                "query_hash": metric.get("query_hash", ""),
                "execution_count": _safe_int_metric(metric.get("execution_count")),
                "avg_execution_time": _safe_float_ms_to_seconds(metric.get("avg_execution_time")),
                "p50_execution_time": _safe_float_ms_to_seconds(metric.get("p50_execution_time")),
                "p95_execution_time": _safe_float_ms_to_seconds(metric.get("p95_execution_time")),
                "p99_execution_time": _safe_float_ms_to_seconds(metric.get("p99_execution_time")),
                "total_execution_time": _safe_float_ms_to_seconds(metric.get("total_execution_time")),
                "cache_hit_rate": cache_hit,
                "last_executed": last_executed,
                "sample_log_id": sample_log_id,
            }
        )
    return result


def _batch_attach_query_text_previews_multi(cursor: Any, *groups: List[dict]) -> None:
    """One DISTINCT ON query for all query_ids appearing in any group."""
    qids: List[str] = []
    seen: set = set()
    for g in groups:
        for row in g:
            qid = str(row.get("query_id") or "")
            if qid and qid not in seen:
                seen.add(qid)
                qids.append(qid)
    preview_by_qid: Dict[str, str] = {}
    if qids:
        try:
            cursor.execute(
                """
                SELECT DISTINCT ON (query_hash)
                    query_hash::text AS qh,
                    COALESCE(
                        NULLIF(BTRIM(query_template), ''),
                        NULLIF(BTRIM(query_text), '')
                    ) AS qpreview
                FROM ml_optimization.query_logs
                WHERE query_hash::text = ANY(%s)
                ORDER BY query_hash, collected_at DESC
                """,
                (qids,),
            )
            for prow in cursor.fetchall():
                qh = str(prow.get("qh") or "")
                text = prow.get("qpreview")
                if qh and text:
                    preview_by_qid[qh] = str(text)[:4000]
        except Exception:
            logger.debug("query_text_preview enrichment failed", exc_info=True)
    for g in groups:
        for item in g:
            qid = str(item.get("query_id") or "")
            item["query_text_preview"] = preview_by_qid.get(qid, "")


def _build_analytics_triple_query_performance(
    s1: str,
    s7: str,
    s_long: str,
    end_date: str,
    limit: int,
    query_logs_ok: bool,
) -> Tuple[dict, dict, dict, Dict[str, Any], Dict[str, Any]]:
    """
    One scan of ``query_logs`` into a temp table, then three GROUP BYs (1d / 7d / long).

    Avoids triple parallel full-window reads and duplicate I/O from separate connections.

    Also returns ``query_logs`` rollups (total_calls, sample_rows) and UTC hourly Σ ``calls``
    for the 7-day window so the dashboard matches the database without client-side heuristics.
    """
    if not query_logs_ok:
        a, b, c = _empty_query_perf_payload(), _empty_query_perf_payload(), _empty_query_perf_payload()
        meta = {
            "degraded_mode": True,
            "degraded_reason": "query_logs_table_missing",
            "contract_version": "v1",
        }
        return a, b, c, _empty_analytics_query_log_rollups(), meta

    ts1, end_ex = _date_strings_to_utc_ts_bounds(s1, end_date)
    ts7, _ = _date_strings_to_utc_ts_bounds(s7, end_date)
    ts_long, _ = _date_strings_to_utc_ts_bounds(s_long, end_date)

    agg_from_recent = """
        SELECT
            query_hash::text AS query_id,
            query_hash::text AS query_hash,
            SUM(COALESCE(calls, 0))::bigint AS execution_count,
            (SUM(COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0)::numeric, 0)::numeric)
                / NULLIF(SUM(COALESCE(calls, 0))::numeric, 0)) AS avg_execution_time,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (
                COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0)::numeric, 0)::numeric
                / NULLIF(COALESCE(calls, 0)::numeric, 0)
            )) AS p50_execution_time,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (
                COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0)::numeric, 0)::numeric
                / NULLIF(COALESCE(calls, 0)::numeric, 0)
            )) AS p95_execution_time,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY (
                COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0)::numeric, 0)::numeric
                / NULLIF(COALESCE(calls, 0)::numeric, 0)
            )) AS p99_execution_time,
            SUM(COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0), 0)) AS total_execution_time,
            MAX(collected_at) AS last_executed,
            SUM(shared_blks_hit)::double precision AS sum_blks_hit,
            SUM(shared_blks_read)::double precision AS sum_blks_read,
            (array_agg(log_id ORDER BY collected_at DESC) FILTER (WHERE log_id IS NOT NULL))[1] AS sample_log_id
        FROM _analytics_bundle_recent
    """

    try:
        with get_db_connection() as conn:
            cur = conn.cursor(cursor_factory=RealDictCursor)
            cur.execute(
                """
                CREATE TEMP TABLE _analytics_bundle_recent ON COMMIT DROP AS
                SELECT
                    query_hash,
                    log_id,
                    mean_exec_time_ms,
                    total_exec_time_ms,
                    max_exec_time_ms,
                    calls,
                    collected_at,
                    COALESCE(shared_blks_hit, 0)::double precision AS shared_blks_hit,
                    COALESCE(shared_blks_read, 0)::double precision AS shared_blks_read
                FROM ml_optimization.query_logs
                WHERE collected_at >= %s AND collected_at < %s
                """,
                [ts_long, end_ex],
            )

            def run_slice(extra_where: str, params: List[Any]) -> List[dict]:
                q = f"{agg_from_recent} {extra_where} GROUP BY query_hash ORDER BY total_execution_time DESC NULLS LAST LIMIT %s"
                cur.execute(q, params + [limit])
                return _query_perf_aggregate_rows_to_metrics_list(cur.fetchall())

            r1 = run_slice("WHERE collected_at >= %s AND collected_at < %s", [ts1, end_ex])
            r7 = run_slice("WHERE collected_at >= %s AND collected_at < %s", [ts7, end_ex])
            r_long = run_slice("", [])

            _batch_attach_query_text_previews_multi(cur, r1, r7, r_long)

            rollups = _analytics_rollups_from_temp(cur, ts1, ts7, end_ex)

            out1 = {"queries": r1, "metrics": r1, "total": len(r1), "used_unbounded_fallback": False}
            out7 = {"queries": r7, "metrics": r7, "total": len(r7), "used_unbounded_fallback": False}
            out_long = {"queries": r_long, "metrics": r_long, "total": len(r_long), "used_unbounded_fallback": False}
            meta = {
                "degraded_mode": False,
                "degraded_reason": "",
                "contract_version": "v1",
            }
            return out1, out7, out_long, rollups, meta
    except Exception as ex:
        logger.warning(
            "analytics triple query_perf failed (temp table path), using per-window fallback: %s",
            ex,
            exc_info=True,
        )
        with get_db_connection() as conn:
            p1 = _build_query_performance_payload(conn, s1, end_date, None, limit, query_logs_exists=True)
            p7 = _build_query_performance_payload(conn, s7, end_date, None, limit, query_logs_exists=True)
            p30 = _build_query_performance_payload(conn, s_long, end_date, None, limit, query_logs_exists=True)
            ts1, end_ex = _date_strings_to_utc_ts_bounds(s1, end_date)
            ts7, _ = _date_strings_to_utc_ts_bounds(s7, end_date)
            rollups = _analytics_rollups_from_query_logs_table(conn, ts1, ts7, end_ex)
        meta = {
            "degraded_mode": True,
            "degraded_reason": "temp_table_path_failed_using_per_window_fallback",
            "contract_version": "v1",
        }
        return p1, p7, p30, rollups, meta


def _build_query_performance_payload(
    conn,
    start_date: Optional[str],
    end_date: Optional[str],
    query_id: Optional[str],
    limit: int,
    *,
    query_logs_exists: Optional[bool] = None,
) -> dict:
    """
    Core query-performance builder used by REST and WebSocket.
    Aggregates match ``ml_optimization.query_logs``: Σ ``calls`` as runs, weighted mean latency, etc.

    ``query_logs_exists``: if False, return empty immediately; if True, skip information_schema check
    (caller verified once); if None, check as before.
    """
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    ql_exists = True

    if query_logs_exists is False:
        out = _empty_query_perf_payload()
        out["metadata"] = _query_perf_contract_meta(
            start_date=start_date,
            end_date=end_date,
            rows=[],
            used_unbounded_fallback=False,
            query_logs_exists=False,
            degraded_reason="query_logs_table_missing",
        )
        return out

    if query_logs_exists is None:
        cursor.execute("""
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'ml_optimization' AND table_name = 'query_logs'
            )
        """)
        table_exists = cursor.fetchone().get("exists", False)
        ql_exists = bool(table_exists)
        if not table_exists:
            logger.warning("ml_optimization.query_logs table does not exist.")
            out = _empty_query_perf_payload()
            out["metadata"] = _query_perf_contract_meta(
                start_date=start_date,
                end_date=end_date,
                rows=[],
                used_unbounded_fallback=False,
                query_logs_exists=False,
                degraded_reason="query_logs_table_missing",
            )
            return out

    # Default to last 7 days if dates not provided (UTC-aware)
    if not start_date:
        start_date = (datetime.now(timezone.utc) - timedelta(days=7)).strftime("%Y-%m-%d")
    if not end_date:
        end_date = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    agg_select = """
        SELECT 
            query_hash::text as query_id,
            query_hash::text as query_hash,
            SUM(COALESCE(calls, 0))::bigint as execution_count,
            (SUM(COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0)::numeric, 0)::numeric)
                / NULLIF(SUM(COALESCE(calls, 0))::numeric, 0)) as avg_execution_time,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY (
                COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0)::numeric, 0)::numeric
                / NULLIF(COALESCE(calls, 0)::numeric, 0)
            )) as p50_execution_time,
            PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (
                COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0)::numeric, 0)::numeric
                / NULLIF(COALESCE(calls, 0)::numeric, 0)
            )) as p95_execution_time,
            PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY (
                COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0)::numeric, 0)::numeric
                / NULLIF(COALESCE(calls, 0)::numeric, 0)
            )) as p99_execution_time,
            SUM(COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0), 0)) as total_execution_time,
            MAX(collected_at) as last_executed,
            SUM(COALESCE(shared_blks_hit, 0))::double precision as sum_blks_hit,
            SUM(COALESCE(shared_blks_read, 0))::double precision as sum_blks_read,
            (array_agg(log_id ORDER BY collected_at DESC) FILTER (WHERE log_id IS NOT NULL))[1] as sample_log_id
        FROM ml_optimization.query_logs
        WHERE 1=1
    """

    # Timestamp range allows btree use on collected_at; ::date on column forces seq scans on large tables.
    start_ts, end_exclusive = _date_strings_to_utc_ts_bounds(start_date, end_date)
    query = agg_select + " AND collected_at >= %s AND collected_at < %s"
    params: List[Any] = [start_ts, end_exclusive]
    if query_id:
        query += " AND query_hash::text = %s"
        params.append(query_id)

    query += " GROUP BY query_hash ORDER BY total_execution_time DESC NULLS LAST LIMIT %s"
    params.append(limit)

    cursor.execute(query, params)
    metrics = cursor.fetchall()

    used_unbounded_fallback = False
    if not metrics and not query_id:
        fb = agg_select + " GROUP BY query_hash ORDER BY total_execution_time DESC NULLS LAST LIMIT %s"
        cursor.execute(fb, [limit])
        metrics = cursor.fetchall()
        used_unbounded_fallback = bool(metrics)

    result = _query_perf_aggregate_rows_to_metrics_list(metrics)

    _batch_attach_query_text_previews_multi(cursor, result)

    out = {
        "queries": result,
        "metrics": result,
        "total": len(result),
        "used_unbounded_fallback": used_unbounded_fallback,
    }
    out["metadata"] = _query_perf_contract_meta(
        start_date=start_date,
        end_date=end_date,
        rows=result,
        used_unbounded_fallback=used_unbounded_fallback,
        query_logs_exists=ql_exists,
    )
    return out


@router.get("/query-performance")
def get_query_performance(
    start_date: Optional[str] = Query(None, description="Start date (YYYY-MM-DD)"),
    end_date: Optional[str] = Query(None, description="End date (YYYY-MM-DD)"),
    query_id: Optional[str] = Query(None, description="Filter by query ID"),
    limit: int = Query(100, description="Maximum results"),
) -> dict:
    """
    Get query performance metrics.
    
    Args:
        start_date: Start date
        end_date: End date
        query_id: Optional query ID filter
        limit: Maximum results
        
    Returns:
        Query performance metrics
    """
    try:
        with get_db_connection() as conn:
            return _build_query_performance_payload(
                conn=conn,
                start_date=start_date,
                end_date=end_date,
                query_id=query_id,
                limit=limit,
            )
            
    except Exception as e:
        logger.error(f"Error fetching query performance: {e}", exc_info=True)
        return {
            "queries": [],
            "metrics": [],
            "total": 0,
            "metadata": {
                "window_start_utc": start_date,
                "window_end_utc": end_date,
                "data_watermark_utc": None,
                "query_logs_exists": False,
                "degraded_mode": True,
                "degraded_reason": "query_performance_endpoint_exception",
                "used_unbounded_fallback": False,
                "contract_version": "v1",
            },
        }


@router.get("/history")
def get_optimization_history(
    limit: int = Query(100, description="Maximum results"),
) -> dict:
    """
    Get optimization history.
    
    Args:
        limit: Maximum results
        
    Returns:
        Optimization history
    """
    try:
        with get_db_connection() as conn:
            return _build_optimization_history_payload(conn, limit=limit)
    except Exception as e:
        logger.error(f"Error fetching optimization history: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e)) from e


def _build_optimization_history_payload(conn, limit: int) -> dict:
    """History = Implement-button actions only (ml_optimization.optimization_apply_events)."""
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    rows: List[Any] = []
    try:
        # Read path: never run DDL here (prevents deadlocks under concurrent WS/HTTP load).
        if not _optimization_apply_events_table_exists(cursor):
            return {
                "history": [],
                "total": 0,
                "metadata": {
                    "data_watermark_utc": None,
                    "degraded_mode": True,
                    "degraded_reason": "optimization_apply_events_table_missing",
                    "contract_version": "v1",
                },
            }

        cursor.execute(
            """
            SELECT
                recommendation_id,
                recommendation_type AS type,
                table_name AS tbl,
                column_names,
                priority,
                query_count,
                avg_execution_time_ms,
                sql_statement,
                explanation,
                estimated_improvement,
                partition_column,
                applied_at,
                applied_by,
                executed_ddl,
                created_index_name,
                apply_outcome
            FROM ml_optimization.optimization_apply_events
            ORDER BY applied_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cursor.fetchall()
    finally:
        cursor.close()

    result: List[dict] = []
    for item in rows:
        cols = item.get("column_names")
        if isinstance(cols, list):
            col_list = [str(c) for c in cols]
        elif isinstance(cols, str):
            raw = cols.strip()
            if raw.startswith(("[", "{")):
                try:
                    parsed = json.loads(raw)
                    if isinstance(parsed, list):
                        col_list = [str(c) for c in parsed]
                    else:
                        col_list = [raw] if raw else []
                except json.JSONDecodeError:
                    col_list = [raw] if raw else []
            else:
                col_list = [raw] if raw else []
        elif cols is None:
            col_list = []
        else:
            col_list = [str(cols)]
        at = item.get("applied_at")
        if at is not None and hasattr(at, "isoformat"):
            created = at.isoformat()
        elif isinstance(at, str) and at.strip():
            created = at.strip()
        else:
            created = datetime.now(timezone.utc).isoformat()
        expl = str(item.get("explanation") or "")
        sql_stmt = str(item.get("sql_statement") or "")
        est = item.get("estimated_improvement")
        est_f = float(est) if est is not None else 0.0
        result.append(
            {
                "recommendation_id": str(item.get("recommendation_id") or ""),
                "type": str(item.get("type") or "index"),
                "table": str(item.get("tbl") or ""),
                "columns": col_list,
                "priority": str(item.get("priority") or "medium"),
                "created_at": created,
                "applied_at": created,
                "query_count": int(item.get("query_count") or 0),
                "avg_execution_time_ms": float(item.get("avg_execution_time_ms") or 0),
                "sql_statement": sql_stmt,
                "explanation": expl,
                "estimated_improvement": est_f,
                "reason": expl or (sql_stmt[:280] + ("…" if len(sql_stmt) > 280 else "")),
                "partition_column": item.get("partition_column"),
                "applied_by": str(item.get("applied_by") or "dashboard"),
                "executed_ddl": str(item.get("executed_ddl") or ""),
                "created_index_name": str(item.get("created_index_name") or ""),
                "apply_outcome": str(item.get("apply_outcome") or "applied"),
            }
        )
    watermark = result[0]["applied_at"] if result else None
    return {
        "history": result,
        "total": len(result),
        "metadata": {
            "data_watermark_utc": watermark,
            "degraded_mode": False,
            "degraded_reason": "",
            "contract_version": "v1",
        },
    }


def _sync_fetch_analytics_query_performance(limit: int = 100) -> dict:
    with get_db_connection() as conn:
        return _build_query_performance_payload(
            conn=conn,
            start_date=None,
            end_date=None,
            query_id=None,
            limit=limit,
        )


def _sync_fetch_analytics_history(limit: int = 100) -> dict:
    with get_db_connection() as conn:
        return _build_optimization_history_payload(conn, limit=limit)


def _sync_fetch_analytics_recommendations(limit: int = 100) -> dict:
    with get_db_connection() as conn:
        return _build_optimization_recommendations_payload(
            conn,
            type_filter=None,
            limit=limit,
            status_filter="pending",
        )


def _utc_analytics_date_window(performance_days: int) -> Tuple[str, str]:
    """Match dashboard ``utcPerformanceDateRange`` (UTC calendar dates)."""
    now = datetime.now(timezone.utc)
    end = datetime(now.year, now.month, now.day, tzinfo=timezone.utc).date()
    start = end - timedelta(days=performance_days)
    return start.isoformat(), end.isoformat()


def _sync_analytics_dashboard_bundle(
    perf_limit: int,
    hist_limit: int,
    rec_limit: int,
    performance_days_long: int = 30,
) -> dict:
    """
    Analytics bundle: (1) one ``query_logs`` scan into a temp table + three GROUP BYs;
    (2) history; (3) recommendations in **fast** mode (persisted merge only, no live ML / pg_stat).

    Heavy work runs across three DB connections in parallel.
    """
    long_days = max(1, min(int(performance_days_long), 3650))
    s1, e = _utc_analytics_date_window(1)
    s7, _ = _utc_analytics_date_window(7)
    s_long, _ = _utc_analytics_date_window(long_days)

    with get_db_connection() as conn:
        cur = conn.cursor()
        cur.execute(
            """
            SELECT EXISTS (
                SELECT 1 FROM information_schema.tables
                WHERE table_schema = 'ml_optimization' AND table_name = 'query_logs'
            )
            """
        )
        query_logs_ok = bool(cur.fetchone()[0])
        cur.close()

    def _perf_triple() -> Tuple[dict, dict, dict, Dict[str, Any], Dict[str, Any]]:
        return _build_analytics_triple_query_performance(
            s1, s7, s_long, e, perf_limit, query_logs_ok
        )

    def _hist() -> dict:
        with get_db_connection() as c:
            return _build_optimization_history_payload(c, hist_limit)

    def _recs() -> dict:
        with get_db_connection() as c:
            return _build_optimization_recommendations_payload(
                c,
                type_filter=None,
                limit=rec_limit,
                status_filter="pending",
                analytics_bundle_fast=True,
            )

    with ThreadPoolExecutor(max_workers=3) as ex:
        fp = ex.submit(_perf_triple)
        fh = ex.submit(_hist)
        fr = ex.submit(_recs)
        p1, p7, p30, query_log_rollups, perf_meta = fp.result()
        hist = fh.result()
        recs = fr.result()

    return {
        "queryPerformance1d": p1,
        "queryPerformance7d": p7,
        "queryPerformance30d": p30,
        "queryLogRollup1d": query_log_rollups.get("rollup_1d"),
        "queryLogRollup7d": query_log_rollups.get("rollup_7d"),
        "hourlyCallsUtc7d": query_log_rollups.get("hourly_calls_utc_7d"),
        "peakUtcHour7d": query_log_rollups.get("peak_utc_hour_7d"),
        "peakHourTotalCalls7d": query_log_rollups.get("peak_hour_total_calls_7d"),
        "peakSampleLogId7d": query_log_rollups.get("peak_sample_log_id_7d"),
        "optimizationHistory": hist,
        "recommendations": recs,
        "metadata": {
            "window_start_utc": s_long,
            "window_end_utc": e,
            "data_watermark_utc": (
                (p30.get("metadata") or {}).get("data_watermark_utc")
                if isinstance(p30, dict)
                else None
            ),
            "degraded_mode": bool(perf_meta.get("degraded_mode")),
            "degraded_reason": str(perf_meta.get("degraded_reason") or ""),
            "contract_version": "v1",
        },
    }


@router.get("/analytics-dashboard-bundle")
def get_analytics_dashboard_bundle(
    performance_limit: int = Query(200, ge=1, le=500, description="Max rows per query-performance window"),
    history_limit: int = Query(200, ge=1, le=500),
    recommendations_limit: int = Query(120, ge=1, le=250),
    performance_days_long: int = Query(
        30,
        ge=1,
        le=3650,
        description="Third query-performance window length in days (maps from dashboard data retention setting)",
    ),
):
    """One request for Analytics page core payloads (3× date windows + history + recs), one DB connection."""
    try:
        return _sync_analytics_dashboard_bundle(
            performance_limit,
            history_limit,
            recommendations_limit,
            performance_days_long,
        )
    except Exception as ex:
        logger.error("analytics-dashboard-bundle failed: %s", ex, exc_info=True)
        raise HTTPException(status_code=500, detail=str(ex)) from ex


@router.get("/analytics-page-bundle")
async def get_analytics_page_bundle():
    """One browser round-trip for the Analytics page (query perf + history + recommendations)."""
    loop = asyncio.get_running_loop()

    async def _g(name: str, fn):
        try:
            return await loop.run_in_executor(None, fn)
        except Exception as e:
            logger.warning("analytics page-bundle %s: %s", name, e)
            return None

    perf, hist, recs = await asyncio.gather(
        _g("query-performance", lambda: _sync_fetch_analytics_query_performance(100)),
        _g("history", lambda: _sync_fetch_analytics_history(100)),
        _g("recommendations", lambda: _sync_fetch_analytics_recommendations(100)),
    )
    return {"queryPerformance": perf, "optimizationHistory": hist, "recommendations": recs}


