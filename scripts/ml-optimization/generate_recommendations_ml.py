"""ML-driven Index Recommendation Generator.

Usage (from repo root, PowerShell):

  .\\.venv-ml\\Scripts\\python.exe scripts\\ml-optimization\\generate_recommendations_ml.py --limit 50000
"""

import os
import sys
import logging
from pathlib import Path
from typing import List, Tuple, Dict, Optional

import psycopg2
import pandas as pd
import numpy as np
import re
import importlib.util

# Add project root and ml-optimization (models package) to path
project_root = Path(__file__).parent.parent.parent
ml_opt_dir = project_root / "ml-optimization"
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_opt_dir))


def _bootstrap_ml_optimization_config() -> None:
    """
    Make ml_optimization.config.model_config importable for model classes.
    Mirrors the bootstrapping used in train_model.py.
    """

    class FakeModule:
        def __init__(self, name: str):
            self.__name__ = name
            self.__path__ = []
            self.__file__ = None

    if "ml_optimization.config.model_config" in sys.modules:
        return

    sys.modules["ml_optimization"] = FakeModule("ml_optimization")
    sys.modules["ml_optimization.config"] = FakeModule("ml_optimization.config")

    model_config_path = ml_opt_dir / "config" / "model_config.py"
    spec = importlib.util.spec_from_file_location(
        "ml_optimization.config.model_config", model_config_path
    )
    if spec and spec.loader:
        mod = importlib.util.module_from_spec(spec)
        sys.modules["ml_optimization.config.model_config"] = mod
        spec.loader.exec_module(mod)


_bootstrap_ml_optimization_config()

from models.query_time_predictor import QueryTimePredictor
from models.anomaly_detector import QueryAnomalyDetector  # type: ignore[attr-defined]

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)


def _db_conn_str() -> str:
    try:
        from utils.db_utils import get_psycopg2_connection_string

        return get_psycopg2_connection_string()
    except ImportError:
        host = os.getenv("POSTGRES_HOST", "localhost")
        if sys.platform == "win32" and host.lower() == "localhost":
            host = "127.0.0.1"
        return (
            f"host={host} "
            f"port={os.getenv('POSTGRES_PORT', '5432')} "
            f"dbname={os.getenv('POSTGRES_DB', 'datawarehouse')} "
            f"user={os.getenv('POSTGRES_USER', 'postgres')} "
            f"password={os.getenv('POSTGRES_PASSWORD', 'postgres')} "
            f"connect_timeout=15"
        )


def _load_models() -> Tuple[Optional[QueryTimePredictor], Optional[QueryAnomalyDetector]]:
    models_dir = ml_opt_dir / "saved_models"
    predictor_path = models_dir / "query_time_predictor.pkl"
    anomaly_path = models_dir / "anomaly_detector.pkl"

    predictor = None
    detector = None

    xgb_json = models_dir / "query_time_predictor_xgboost.json"

    if predictor_path.exists():
        try:
            predictor = QueryTimePredictor()
            predictor.load_model(str(predictor_path))
            logger.info("Loaded query_time_predictor from %s", predictor_path)
        except Exception as e:
            logger.warning("Failed to load predictor: %s", e)
    if predictor is None and xgb_json.exists():
        try:
            predictor = QueryTimePredictor()
            predictor.load_xgboost_json_only(str(xgb_json))
            logger.info("Loaded query_time_predictor (XGBoost JSON) from %s", xgb_json)
        except Exception as e:
            logger.warning("Failed to load predictor from XGBoost JSON: %s", e)

    if anomaly_path.exists():
        try:
            detector = QueryAnomalyDetector()
            detector.load_model(str(anomaly_path))
            logger.info("Loaded anomaly_detector from %s", anomaly_path)
        except Exception as e:
            logger.warning("Failed to load anomaly detector: %s", e)

    return predictor, detector


def _extract_table_column_pairs(query_text: str) -> List[Tuple[str, str]]:
    """
    Extract candidate (schema.table, column) from SQL using lenient patterns.

    - Finds FROM/JOIN targets like "schema.table" or "table".
    - Finds WHERE/AND filter columns like "alias.col" or "col =".
    - Maps alias -> table and pairs (table, column).
    """
    if not query_text:
        return []

    upper = query_text.upper()
    pairs: List[Tuple[str, str]] = []

    for schema, table, col in re.findall(
        r"\b(BRONZE|SILVER|GOLD)\.([A-Z0-9_]+)\.([A-Z0-9_]+)\b",
        upper,
    ):
        pairs.append((f"{schema.lower()}.{table.lower()}", col.lower()))

    # 1) Collect tables and aliases from FROM / JOIN
    #    e.g. "FROM silver.orders o", "JOIN gold.fact_sales fs"
    table_aliases: Dict[str, str] = {}  # alias -> schema.table
    table_names: List[str] = []

    from_join_re = re.findall(
        r"\b(FROM|JOIN)\s+([A-Z0-9_\.]+)(?:\s+AS)?\s+([A-Z0-9_]+)?",
        upper,
    )
    for _kw, raw_table, alias in from_join_re:
        # Normalize table name: schema.table or just table
        if "." in raw_table:
            schema, tbl = raw_table.split(".", 1)
            full = f"{schema.lower()}.{tbl.lower()}"
        else:
            # Assume silver as default schema if missing
            full = f"silver.{raw_table.lower()}"
        table_names.append(full)
        if alias:
            table_aliases[alias] = full

    # 2) WHERE / AND filter columns
    where_section_match = re.search(r"\bWHERE\b(.+)", upper, re.DOTALL)
    where_text = where_section_match.group(1) if where_section_match else upper

    # Qualified: alias.col = ...
    col_matches = re.findall(
        r"\b([A-Z0-9_]+)\.([A-Z0-9_]+)\s*=\s*", where_text
    )
    # Unqualified: col = ...
    simple_cols = re.findall(
        r"\b([A-Z0-9_]+)\s*=\s*", where_text
    )

    # 2a) Qualified columns
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

    # 2b) Unqualified key‑like columns → map to all tables in this query
    key_like_cols = {"ID", "ORDER_ID", "CUSTOMER_ID", "PRODUCT_ID", "CREATED_AT", "UPDATED_AT", "DATE", "ORDER_DATE"}
    for col in simple_cols:
        if any(c.lower() == col.lower() for _t, c in pairs):
            continue
        if col not in key_like_cols:
            continue
        for tbl in table_names or ["silver.unknown"]:
            pairs.append((tbl, col.lower()))

    if not pairs:
        if "ORDERS" in upper:
            if "ORDER_DATE" in upper:
                pairs.append(("silver.orders", "order_date"))
            if "CUSTOMER_ID" in upper:
                pairs.append(("silver.orders", "customer_id"))
        if "CUSTOMERS" in upper or "CUSTOMER" in upper:
            if "EMAIL" in upper:
                pairs.append(("silver.customers", "email"))
            if "CUSTOMER_ID" in upper:
                pairs.append(("silver.customers", "customer_id"))
        if "PRODUCT" in upper or "PRODUCTS" in upper:
            if "PRODUCT_ID" in upper:
                pairs.append(("silver.products", "product_id"))
            if "SKU" in upper:
                pairs.append(("silver.products", "sku"))
            if "CATEGORY" in upper:
                pairs.append(("silver.products", "category"))

    return list({(t, c) for (t, c) in pairs})


def _min_rows_per_table_column_pair() -> int:
    raw = os.environ.get("ML_INDEX_REC_MIN_QUERY_ROWS", "2").strip()
    try:
        return max(1, min(int(raw), 10_000))
    except ValueError:
        return 2


def generate_ml_index_recommendations(limit: int = 50000) -> None:
    db_conn_str = _db_conn_str()
    predictor, detector = _load_models()

    if predictor is None and detector is None:
        logger.error("No trained models available. Train models first, then rerun.")
        return

    conn = psycopg2.connect(db_conn_str)
    cursor = conn.cursor()
    try:
        logger.info("=" * 60)
        logger.info("Generating ML-driven index recommendations (limit=%s)", limit)
        logger.info("=" * 60)

        cursor.execute(
            """
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
            ORDER BY collected_at DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cursor.fetchall()
        if not rows:
            logger.warning(
                "No qualifying rows in ml_optimization.query_logs "
                "(need non-empty query_text and mean_exec_time_ms > 0 or calls > 0). "
                "Run query collection and warehouse/API traffic first."
            )
            return

        df = pd.DataFrame(
            rows,
            columns=[
                "query_text",
                "mean_exec_time_ms",
                "calls",
                "rows_affected",
                "shared_blks_hit",
                "shared_blks_read",
                "extracted_features",
                "collected_at",
            ],
        )
        df["mean_exec_time_ms"] = pd.to_numeric(
            df["mean_exec_time_ms"], errors="coerce"
        ).fillna(0.0)
        calls_num = pd.to_numeric(df["calls"], errors="coerce").fillna(0)
        slow_zero = (df["mean_exec_time_ms"] <= 0) & (calls_num > 0)
        df.loc[slow_zero, "mean_exec_time_ms"] = 0.001

        pred_ms = None
        if predictor is not None:
            try:
                X, _ = predictor.extract_features(df)
                pred_ms = predictor.predict(X)
            except Exception as e:
                logger.warning("Predictor failed on logs: %s", e)
                pred_ms = None

        groups: Dict[Tuple[str, str], Dict[str, float]] = {}
        for i, row in df.iterrows():
            text = row["query_text"] or ""
            pairs = _extract_table_column_pairs(text)
            if not pairs:
                continue

            actual_ms = float(row.get("mean_exec_time_ms", 0) or 0)
            calls = float(row.get("calls", 0) or 0)
            shared_read = float(row.get("shared_blks_read", 0) or 0)
            pred_val = float(pred_ms[i]) if pred_ms is not None else actual_ms

            weight = max(1.0, calls) * max(1.0, actual_ms)

            for tbl, col in pairs:
                key = (tbl, col)
                g = groups.setdefault(
                    key,
                    {
                        "weight_sum": 0.0,
                        "actual_sum": 0.0,
                        "pred_sum": 0.0,
                        "rows": 0.0,
                        "io_sum": 0.0,
                    },
                )
                g["weight_sum"] += weight
                g["actual_sum"] += actual_ms
                g["pred_sum"] += pred_val
                g["rows"] += 1.0
                g["io_sum"] += shared_read

        if not groups:
            logger.warning(
                "No (table, column) pairs extracted from query_text "
                "(expect silver./gold./bronze. table names and filter columns in SQL)."
            )
            return

        min_evidence = _min_rows_per_table_column_pair()
        dropped_low_count = 0
        recs = []
        for (table, col), g in groups.items():
            if g["rows"] < min_evidence:
                dropped_low_count += 1
                continue

            avg_ms = g["actual_sum"] / g["rows"]
            pred_avg_ms = g["pred_sum"] / g["rows"] if g["pred_sum"] > 0 else avg_ms
            io_score = g["io_sum"] / g["rows"]

            benefit = (avg_ms * g["rows"]) + (io_score * 0.5)
            norm = benefit / (benefit + 1_000_000.0)
            est_improvement = float(0.1 + 0.4 * norm)

            if est_improvement >= 0.35:
                priority = "high"
            elif est_improvement >= 0.2:
                priority = "medium"
            else:
                priority = "low"

            explanation = (
                f"Model suggests heavy workload on {table}.{col}: "
                f"avg ~{avg_ms:.0f} ms over {int(g['rows'])} queries; "
                f"predicted ~{pred_avg_ms:.0f} ms. "
                "Indexing this column is likely to reduce latency and buffer reads."
            )

            recs.append(
                {
                    "table_name": table,
                    "column_name": col,
                    "priority": priority,
                    "est_improvement": est_improvement,
                    "query_count": int(g["rows"]),
                    "avg_execution_ms": avg_ms,
                    "explanation": explanation,
                }
            )

        if not recs:
            logger.warning(
                "No ML recommendations passed thresholds "
                "(%s (table,column) groups had <%s matching query_log rows each; "
                "raise ML_INDEX_REC_MIN_QUERY_ROWS or generate more traffic).",
                dropped_low_count,
                min_evidence,
            )
            return

        recs.sort(key=lambda r: (r["priority"], r["est_improvement"], r["query_count"]), reverse=True)
        recs = recs[:100]

        cursor.execute(
            """
            CREATE TABLE IF NOT EXISTS ml_optimization.index_recommendations (
                recommendation_id BIGSERIAL PRIMARY KEY,
                table_name VARCHAR(255) NOT NULL,
                column_name VARCHAR(255) NOT NULL,
                recommendation_type VARCHAR(50),
                priority VARCHAR(20),
                estimated_improvement NUMERIC,
                query_count INTEGER,
                avg_execution_time_ms NUMERIC,
                sql_statement TEXT,
                explanation TEXT,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            )
            """
        )

        inserted = 0
        for rec in recs:
            sql_stmt = (
                f"CREATE INDEX IF NOT EXISTS idx_{rec['table_name'].split('.')[-1]}_{rec['column_name']} "
                f"ON {rec['table_name']}({rec['column_name']})"
            )
            cursor.execute(
                """
                INSERT INTO ml_optimization.index_recommendations
                (table_name, column_name, recommendation_type, priority,
                 estimated_improvement, query_count, avg_execution_time_ms,
                 sql_statement, explanation)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                """,
                (
                    rec["table_name"],
                    rec["column_name"],
                    "index",
                    rec["priority"],
                    float(rec["est_improvement"]),
                    rec["query_count"],
                    rec["avg_execution_ms"],
                    sql_stmt,
                    rec["explanation"],
                ),
            )
            inserted += 1

        conn.commit()
        logger.info("Inserted %s ML-driven index recommendations.", inserted)

    except Exception as e:
        logger.error("Error generating ML recommendations: %s", e, exc_info=True)
        conn.rollback()
    finally:
        cursor.close()
        conn.close()


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="Generate ML-driven index recommendations")
    parser.add_argument(
        "--limit",
        type=int,
        default=50000,
        help="Max number of query_logs rows to scan (default: 50000)",
    )
    args = parser.parse_args()
    generate_ml_index_recommendations(limit=args.limit)
