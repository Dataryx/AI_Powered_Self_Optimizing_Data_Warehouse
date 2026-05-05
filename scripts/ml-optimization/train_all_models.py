"""
Train All ML Models
Trains workload clustering, query-time predictor, anomaly detector, and cache predictor
using collected query logs (same shapes as ``train_model.py``).

By default loads **all** matching rows from ``ml_optimization.query_logs`` (no SQL LIMIT).
Cap with ``--limit N`` or env ``TRAIN_QUERY_LOGS_LIMIT`` (positive integer); use ``0`` for all rows.
"""

import argparse
import logging
import os
import sys
from pathlib import Path
from typing import Optional

import pandas as pd
import psycopg2

# Add parent directory to path
project_root = Path(__file__).parent.parent.parent
ml_opt_dir = project_root / "ml-optimization"
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_opt_dir))

# Bootstrap ml_optimization.config so ``from ml_optimization.config.model_config import ...`` works
# (folder is ``ml-optimization``; models use underscore package name).
import importlib.util


def _bootstrap_ml_optimization_config():
    class FakeModule:
        def __init__(self, name):
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

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

try:
    from models.cache_predictor import CachePredictor
    from models.query_time_predictor import QueryTimePredictor
    from models.anomaly_detector import QueryAnomalyDetector
    from models.workload_clustering import WorkloadClusterer
except ImportError:
    logger.error("Failed to import ML models. Check PYTHONPATH.")
    sys.exit(1)

MIN_ROWS = 10


def _resolve_query_log_limit(cli_limit: Optional[int]) -> int:
    """0 = load all matching rows (no SQL LIMIT)."""
    if cli_limit is not None:
        return max(0, cli_limit)
    raw = os.getenv("TRAIN_QUERY_LOGS_LIMIT", "").strip()
    if not raw:
        return 0
    try:
        return max(0, int(raw))
    except ValueError:
        return 0


def train_all_models(query_log_limit: int = 0):
    """Train all ML optimization models on query logs.

    Args:
        query_log_limit: Max rows, newest first. ``0`` loads every matching row (can be heavy).
    """
    db_conn_str = (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'datawarehouse')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASSWORD', 'postgres')}"
    )

    models_dir = project_root / "ml-optimization" / "saved_models"
    models_dir.mkdir(parents=True, exist_ok=True)

    logger.info("=" * 60)
    logger.info("Training All ML Models")
    logger.info("=" * 60)

    base_sql = """
        SELECT query_text, mean_exec_time_ms, calls, rows_affected,
               shared_blks_hit, shared_blks_read, extracted_features
        FROM ml_optimization.query_logs
        WHERE query_text IS NOT NULL
          AND trim(query_text) <> ''
          AND (
            COALESCE(mean_exec_time_ms, 0) > 0
            OR COALESCE(calls, 0) > 0
          )
        ORDER BY collected_at DESC
    """
    connection = psycopg2.connect(db_conn_str)
    cursor = connection.cursor()
    if query_log_limit > 0:
        cursor.execute(base_sql + " LIMIT %s", (query_log_limit,))
    else:
        logger.warning(
            "Loading ALL matching query_logs (no LIMIT). This can use significant RAM and time "
            "on large tables; use --limit N or TRAIN_QUERY_LOGS_LIMIT to cap."
        )
        cursor.execute(base_sql)
    query_data = cursor.fetchall()
    cursor.close()
    connection.close()

    if len(query_data) < MIN_ROWS:
        logger.error("Not enough query logs for training. Need at least %s records.", MIN_ROWS)
        return

    query_logs_df = pd.DataFrame(
        query_data,
        columns=[
            "query_text",
            "mean_exec_time_ms",
            "calls",
            "rows_affected",
            "shared_blks_hit",
            "shared_blks_read",
            "extracted_features",
        ],
    )
    query_logs_df["mean_exec_time_ms"] = pd.to_numeric(
        query_logs_df["mean_exec_time_ms"], errors="coerce"
    ).fillna(0.0)
    _calls = pd.to_numeric(query_logs_df["calls"], errors="coerce").fillna(0)
    _mask = (query_logs_df["mean_exec_time_ms"] <= 0) & (_calls > 0)
    query_logs_df.loc[_mask, "mean_exec_time_ms"] = 0.001
    logger.info("Loaded %s query records for training", len(query_logs_df))

    # 1. Workload clustering
    logger.info("\n" + "=" * 60)
    logger.info("Training Workload Clustering Model")
    logger.info("=" * 60)
    try:
        clusterer = WorkloadClusterer()
        if clusterer.fit_from_query_logs(query_logs_df):
            cluster_path = models_dir / "workload_clustering.pkl"
            clusterer.save_model(str(cluster_path))
            logger.info("Workload clustering model saved to %s", cluster_path)
        else:
            logger.warning("Workload clustering skipped (insufficient samples for config)")
    except Exception as e:
        logger.error("Error training workload clustering: %s", e, exc_info=True)

    # 2. Query time predictor
    logger.info("\n" + "=" * 60)
    logger.info("Training Query Time Predictor Model")
    logger.info("=" * 60)
    try:
        predictor = QueryTimePredictor()
        predictor.train(query_logs_df)
        predictor_path = models_dir / "query_time_predictor.pkl"
        predictor.save_model(str(predictor_path))
        logger.info("Query time predictor saved to %s", predictor_path)
    except Exception as e:
        logger.error("Error training query time predictor: %s", e, exc_info=True)

    # 3. Anomaly detector
    logger.info("\n" + "=" * 60)
    logger.info("Training Anomaly Detector Model")
    logger.info("=" * 60)
    try:
        detector = QueryAnomalyDetector()
        detector.train(query_logs_df)
        if detector.model is not None:
            detector_path = models_dir / "anomaly_detector.pkl"
            detector.save_model(str(detector_path))
            logger.info("Anomaly detector saved to %s", detector_path)
        else:
            logger.warning("Anomaly detector not trained (need >= 100 samples)")
    except Exception as e:
        logger.error("Error training anomaly detector: %s", e, exc_info=True)

    # 4. Cache predictor
    logger.info("\n" + "=" * 60)
    logger.info("Training Cache Predictor Model")
    logger.info("=" * 60)
    try:
        cache = CachePredictor()
        if cache.fit_from_query_logs(query_logs_df):
            cache_path = models_dir / "cache_predictor.pkl"
            cache.save_model(str(cache_path))
            logger.info("Cache predictor saved to %s", cache_path)
        else:
            logger.warning(
                "Cache predictor not saved (too few templates or single-class labels); "
                "API will fall back to heuristics"
            )
    except Exception as e:
        logger.error("Error training cache predictor: %s", e, exc_info=True)

    logger.info("\n" + "=" * 60)
    logger.info("Model training batch complete. Models directory: %s", models_dir)
    logger.info("=" * 60)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Train all ML models on query_logs (default: use all available rows).",
    )
    parser.add_argument(
        "--limit",
        "-n",
        type=int,
        default=None,
        metavar="N",
        help=(
            "Max query_logs rows (newest first). Omit to use TRAIN_QUERY_LOGS_LIMIT env, "
            "or all rows if unset. 0 means no SQL LIMIT (all matching rows)."
        ),
    )
    args = parser.parse_args()
    lim = _resolve_query_log_limit(args.limit)
    train_all_models(query_log_limit=lim)
