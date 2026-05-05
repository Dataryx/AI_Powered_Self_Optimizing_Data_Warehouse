#!/usr/bin/env python3
"""
Report why optimization recommendations may be empty: data vs ML vs filters.

From project root:

  python scripts/ml-optimization/diagnose_recommendations.py

Uses POSTGRES_* and the same OPTIMIZATION_* env vars as the API.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

project_root = Path(__file__).resolve().parent.parent.parent
ml_opt = project_root / "ml-optimization"
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_opt))

import importlib.util

import psycopg2
from psycopg2.extras import RealDictCursor


def _load_optimization_routes():
    """Same ml_optimization package shim as start_services.py (hyphenated ml-optimization dir)."""
    if "ml_optimization.api.routes.optimization_routes" in sys.modules:
        return sys.modules["ml_optimization.api.routes.optimization_routes"]

    class FakeModule:
        def __init__(self, name: str):
            self.__name__ = name
            self.__path__ = []
            self.__file__ = None
            self.__spec__ = None

    sys.modules["ml_optimization"] = FakeModule("ml_optimization")
    sys.modules["ml_optimization.api"] = FakeModule("ml_optimization.api")
    sys.modules["ml_optimization.api.routes"] = FakeModule("ml_optimization.api.routes")
    sys.modules["ml_optimization.utils"] = FakeModule("ml_optimization.utils")
    sys.modules["ml_optimization.config"] = FakeModule("ml_optimization.config")

    db_utils_path = ml_opt / "utils" / "db_utils.py"
    spec = importlib.util.spec_from_file_location(
        "ml_optimization.utils.db_utils", db_utils_path
    )
    if spec and spec.loader:
        m = importlib.util.module_from_spec(spec)
        sys.modules["ml_optimization.utils.db_utils"] = m
        spec.loader.exec_module(m)

    model_config_path = ml_opt / "config" / "model_config.py"
    spec = importlib.util.spec_from_file_location(
        "ml_optimization.config.model_config", model_config_path
    )
    if spec and spec.loader:
        m = importlib.util.module_from_spec(spec)
        sys.modules["ml_optimization.config.model_config"] = m
        spec.loader.exec_module(m)

    route_path = ml_opt / "api" / "routes" / "optimization_routes.py"
    spec = importlib.util.spec_from_file_location(
        "ml_optimization.api.routes.optimization_routes", route_path
    )
    if not spec or not spec.loader:
        raise RuntimeError("Cannot load optimization_routes.py")
    mod = importlib.util.module_from_spec(spec)
    sys.modules["ml_optimization.api.routes.optimization_routes"] = mod
    spec.loader.exec_module(mod)
    return mod


def _conn():
    try:
        from utils.db_utils import get_psycopg2_connection_string

        return psycopg2.connect(get_psycopg2_connection_string())
    except ImportError:
        host = os.getenv("POSTGRES_HOST", "localhost")
        if sys.platform == "win32" and host.lower() == "localhost":
            host = "127.0.0.1"
        return psycopg2.connect(
            host=host,
            port=os.getenv("POSTGRES_PORT", "5432"),
            dbname=os.getenv("POSTGRES_DB", "datawarehouse"),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "postgres"),
            connect_timeout=15,
        )


def main() -> int:
    with_merge = "--merge" in sys.argv
    saved = ml_opt / "saved_models"
    pkl = saved / "query_time_predictor.pkl"
    xgb = saved / "query_time_predictor_xgboost.json"
    anomaly = saved / "anomaly_detector.pkl"

    print("=== Saved model artifacts (ml-optimization/saved_models) ===")
    print(f"  query_time_predictor.pkl     : {'yes' if pkl.exists() else 'no'}")
    print(f"  query_time_predictor_xgboost.json: {'yes' if xgb.exists() else 'no'}")
    print(f"  anomaly_detector.pkl         : {'yes' if anomaly.exists() else 'no'}")
    has_predictor_art = pkl.exists() or xgb.exists()
    has_anomaly_art = anomaly.exists()
    live_ml = has_predictor_art or has_anomaly_art
    if not live_ml:
        print(
            "  -> Live ML recommendations are skipped (need query_time_predictor .pkl or "
            "query_time_predictor_xgboost.json and/or anomaly_detector.pkl)."
        )
    elif not has_predictor_art and has_anomaly_art:
        print("  -> Predictor artifact missing; live recs can still use anomaly detector only.")

    print("\n=== Relevant env (defaults in parentheses) ===")
    for k in (
        "OPTIMIZATION_LIVE_ON_RECOMMENDATIONS_GET",
        "OPTIMIZATION_ML_LIVE_SOURCE",
        "OPTIMIZATION_QUERY_LOG_LIMIT",
        "OPTIMIZATION_QUERY_LOG_LOOKBACK_HOURS",
        "OPTIMIZATION_MIN_QUERY_EVIDENCE_HITS",
        "OPTIMIZATION_FILTER_REDUNDANT_INDEXES",
        "OPTIMIZATION_FALLBACK_MIN_SEQ_SCAN",
        "OPTIMIZATION_DDL_ALLOWED_SCHEMAS",
        "OPTIMIZATION_MERGE_PG_STAT_LIVE",
        "OPTIMIZATION_WS_INTERVAL_MS",
    ):
        print(f"  {k}={os.environ.get(k, '')!r}")

    try:
        conn = _conn()
    except Exception as e:
        print(f"\n[DB] Connection failed: {e}")
        return 1

    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)

        cur.execute(
            """
            SELECT EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'ml_optimization' AND table_name = 'index_recommendations'
            ) AS ok
            """
        )
        has_ir = bool(cur.fetchone()["ok"])
        print("\n=== Database ===")
        print(f"  ml_optimization.index_recommendations exists: {has_ir}")

        cur.execute(
            """
            SELECT EXISTS (
              SELECT 1 FROM information_schema.tables
              WHERE table_schema = 'ml_optimization' AND table_name = 'query_logs'
            ) AS ok
            """
        )
        has_ql = bool(cur.fetchone()["ok"])
        print(f"  ml_optimization.query_logs exists: {has_ql}")

        try:
            opt = _load_optimization_routes()
            live_flag = opt._optimization_live_on_recommendations_get()
            ml_src = opt._optimization_ml_live_source()
            has_pss = opt._pg_stat_statements_extension_exists(cur)
            print("\n=== Live ML branch (same helpers as API) ===")
            print(f"  Live ML on GET/WS (_optimization_live_on): {live_flag}")
            print(f"  ML live sample source (OPTIMIZATION_ML_LIVE_SOURCE): {ml_src!r}")
            print(f"  pg_stat_statements extension installed: {has_pss}")
            if ml_src == "pg_stat" and not has_pss:
                print(
                    "  -> With source=pg_stat and no extension, API falls back to query_logs (if any)."
                )
            elif ml_src == "pg_stat" and has_pss:
                cur.execute(
                    """
                    SELECT COUNT(*)::bigint AS c
                    FROM pg_stat_statements
                    WHERE query IS NOT NULL AND trim(query) <> '' AND calls > 0
                    """
                )
                print(
                    f"  pg_stat_statements rows (calls > 0): {int(cur.fetchone()['c'])}"
                )

            would_run_live = bool(live_flag and live_ml)
            print(f"  Would run live ML grouping/scoring this process: {would_run_live}")
            if would_run_live:
                limit_rows = opt._optimization_query_log_limit()
                look_sql, look_params = opt._query_logs_recent_sql_fragment()
                sample_rows, built_mode = opt._ml_build_live_recommendations_rows(
                    conn, limit_rows, look_sql, look_params
                )
                print(
                    f"  Rows passed to predictor/anomaly (built_mode={built_mode!r}): {len(sample_rows)}"
                )
                with_parse = 0
                with_idx = 0
                with_part = 0
                for r in sample_rows:
                    qt = (r.get("query_text") or "").strip()
                    if not qt:
                        continue
                    idx = opt._parse_index_candidates(qt)
                    part = opt._parse_partition_candidates(qt)
                    if idx or part:
                        with_parse += 1
                    if idx:
                        with_idx += 1
                    if part:
                        with_part += 1
                print("  Parse hit rate on that live sample:")
                print(f"    any index/partition hit: {with_parse} / {len(sample_rows)}")
                print(f"    index candidates: {with_idx}")
                print(f"    partition candidates: {with_part}")
                if sample_rows and with_parse == 0:
                    print(
                        "    -> Sample has SQL but no gold./silver./bronze. parse matches; "
                        "shape traffic to warehouse-qualified names."
                    )
            elif not live_ml:
                print("  (Skipped live sample: no predictor/anomaly artifacts under saved_models.)")
            elif not live_flag:
                print("  (Skipped live sample: OPTIMIZATION_LIVE_ON_RECOMMENDATIONS_GET is off.)")
        except Exception as ex:
            print(f"\n=== Live ML branch ===\n  Could not load API module or sample: {ex}")

        # One full scoring pass: shows whether catalog/redundant/evidence filters zero out the UI.
        try:
            opt2 = _load_optimization_routes()
            live_raw, _pairs = opt2._generate_model_based_recommendations(
                conn, None, None, 100
            )
            live_ok = opt2._filter_genuine_recommendations(conn, list(live_raw))
            fr = os.environ.get("OPTIMIZATION_FILTER_REDUNDANT_INDEXES", "1").strip().lower()
            print("\n=== Live ML vs catalog filter (same as API) ===")
            print(f"  Model-generated rows (before _filter_genuine): {len(live_raw)}")
            print(f"  After _filter_genuine_recommendations: {len(live_ok)}")
            print(
                f"  OPTIMIZATION_FILTER_REDUNDANT_INDEXES env: {fr!r} "
                "(default on; set 0 to show rows whose leading column is already indexed)"
            )
            if len(live_raw) > 0 and len(live_ok) == 0:
                print(
                    "  -> All live rows were dropped here. Typical causes: schema outside "
                    "OPTIMIZATION_DDL_ALLOWED_SCHEMAS, missing table/column, evidence threshold, "
                    "or redundant leading indexes (filter on by default)."
                )
        except Exception as ex:
            print(f"\n=== Live ML vs catalog filter ===\n  Skipped: {ex}")

        qual = 0
        if has_ql:
            cur.execute("SELECT COUNT(*)::bigint AS c FROM ml_optimization.query_logs")
            total_ql = int(cur.fetchone()["c"])
            cur.execute(
                """
                SELECT COUNT(*)::bigint AS c FROM ml_optimization.query_logs
                WHERE query_text IS NOT NULL
                  AND trim(query_text) <> ''
                  AND (
                    COALESCE(mean_exec_time_ms, 0) > 0
                    OR COALESCE(calls, 0) > 0
                  )
                """
            )
            qual = int(cur.fetchone()["c"])
            print(f"  query_logs total rows: {total_ql}")
            print(f"  query_logs rows usable for live ML WHERE: {qual}")
            if qual == 0:
                print(
                    "  -> No rows match API filter; run traffic + run_query_collection.py."
                )

        if not has_ir:
            min_seq = os.environ.get("OPTIMIZATION_FALLBACK_MIN_SEQ_SCAN", "5")
            try:
                min_seq_i = max(0, int(min_seq))
            except ValueError:
                min_seq_i = 5
            cur.execute(
                """
                SELECT COUNT(*)::bigint AS c
                FROM pg_stat_user_tables
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                  AND COALESCE(seq_scan, 0) >= %s
                """,
                (min_seq_i,),
            )
            fb = int(cur.fetchone()["c"])
            print("\n=== Fallback path (no index_recommendations table) ===")
            print(
                f"  Warehouse tables with seq_scan >= {min_seq_i}: {fb} "
                f"(below threshold => no fallback index/partition ideas)"
            )

        # Deep query_logs-only parse sample (broader than live ML cap); complements live sample above.
        if has_ql and live_ml:
            try:
                opt = _load_optimization_routes()

                cur.execute(
                    """
                    SELECT query_text
                    FROM ml_optimization.query_logs
                    WHERE query_text IS NOT NULL
                      AND trim(query_text) <> ''
                      AND (
                        COALESCE(mean_exec_time_ms, 0) > 0
                        OR COALESCE(calls, 0) > 0
                      )
                    ORDER BY collected_at DESC
                    LIMIT 2000
                    """
                )
                sample = [r["query_text"] for r in cur.fetchall() if r.get("query_text")]
                with_parse = 0
                with_idx = 0
                with_part = 0
                for qt in sample:
                    idx = opt._parse_index_candidates(qt or "")
                    part = opt._parse_partition_candidates(qt or "")
                    if idx or part:
                        with_parse += 1
                    if idx:
                        with_idx += 1
                    if part:
                        with_part += 1
                print("\n=== SQL parsing (last up to 2000 qualifying query_logs) ===")
                print(f"  Statements with any index/partition parse hit: {with_parse}")
                print(f"  With at least one index candidate: {with_idx}")
                print(f"  With at least one partition candidate: {with_part}")
                if qual > 0 and with_parse == 0:
                    print(
                        "  -> ML models may load fine, but SQL text lacks gold./silver./bronze. "
                        "patterns the parser expects; generate warehouse-shaped traffic."
                    )
            except Exception as ex:
                print(f"\n[parse sample] Skipped: {ex}")

        if has_ir and has_ql:
            cur.execute(
                "SELECT COUNT(*)::bigint AS c FROM ml_optimization.index_recommendations"
            )
            ir_count = int(cur.fetchone()["c"])
            print("\n=== Persisted recommendations ===")
            print(f"  index_recommendations rows: {ir_count}")
            if ir_count == 0 and not live_ml:
                print(
                    "  -> No persisted rows and no model artifacts; run generate_recommendations_ml.py "
                    "or train models + collect query_logs."
                )

        cur.close()
    finally:
        conn.close()

    if with_merge:
        try:
            opt = _load_optimization_routes()
            from ml_optimization.utils.db_utils import get_db_connection

            print("\n=== API merge (GET .../recommendations?status=all, no status narrowing) ===")
            with get_db_connection() as c2:
                for tf, label in (
                    (None, "all types"),
                    ("index", "index only"),
                    ("partition", "partition only"),
                ):
                    payload = opt._build_optimization_recommendations_payload(
                        c2, tf, 100, None
                    )
                    print(f"  {label}: {payload['total']} recommendations after filters")
                pend = opt._build_optimization_recommendations_payload(
                    c2, None, 120, "pending"
                )
                print(
                    "\n=== Dashboard parity (status=pending, limit=120, same as UI fetch) ==="
                )
                print(f"  pending: {pend['total']} recommendations after filters")
        except Exception as e:
            print(f"\n[merge] Could not run API merge sample: {e}")

    print("\n=== Interpretation ===")
    print(
        "  Empty index + partition usually means one or more of: "
        "(1) no predictor/anomaly files, (2) empty or unparseable query_logs / pg_stat text, "
        "(3) OPTIMIZATION_ML_LIVE_SOURCE=pg_stat but extension missing or no statements, "
        "(4) OPTIMIZATION_MIN_QUERY_EVIDENCE_HITS too high, "
        "(5) OPTIMIZATION_FILTER_REDUNDANT_INDEXES (default on) drops rows whose leading column is already "
        "indexed — if raw>0 and after=0, try FILTER=0 or fix schema/evidence, "
        "(6) dashboard only shows status=pending — use diagnose --merge to see pending count, "
        "(7) fallback seq_scan threshold too high when index_recommendations table is missing."
    )
    return 0


if __name__ == "__main__":
    # Optional: python diagnose_recommendations.py --merge
    raise SystemExit(main())
