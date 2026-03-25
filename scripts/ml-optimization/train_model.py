"""
Train Individual ML Models
Train a single ML optimization model by name (clustering, predictor, anomaly) or all.
Usage:
  python scripts/ml-optimization/train_model.py --model clustering
  python scripts/ml-optimization/train_model.py --model predictor
  python scripts/ml-optimization/train_model.py --model anomaly
  python scripts/ml-optimization/train_model.py --model all
  python scripts/ml-optimization/train_model.py --model all --limit 500000
  python scripts/ml-optimization/train_model.py --model all --limit 0   # all rows (heavy RAM/time)
"""

import argparse
import sys
import logging
import psycopg2
import pandas as pd
import numpy as np
import os
from pathlib import Path

# Add parent directory to path
project_root = Path(__file__).parent.parent.parent
ml_opt_dir = project_root / "ml-optimization"
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(ml_opt_dir))

# Bootstrap ml_optimization.config so model code can "from ml_optimization.config.model_config import ..."
# (ml-optimization code uses ml_optimization.* but the folder is named ml-optimization)
import importlib.util


def _bootstrap_ml_optimization_config():
    """Load ml-optimization/config as ml_optimization.config so model imports work."""
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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger(__name__)

try:
    from models.workload_clustering import WorkloadClusterer
    from models.query_time_predictor import QueryTimePredictor
    from models.anomaly_detector import QueryAnomalyDetector
except ImportError as e:
    logger.error("Failed to import ML models: %s", e, exc_info=True)
    sys.exit(1)

MIN_RECORDS = 10
# Default cap keeps quick dev runs fast; override with --limit or TRAIN_QUERY_LOGS_LIMIT.
DEFAULT_QUERY_LIMIT = int(os.getenv("TRAIN_QUERY_LOGS_LIMIT", "1000"))


def get_db_connection_string():
    return (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'datawarehouse')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASSWORD', 'postgres')}"
    )


def load_query_data(db_conn_str, limit: int):
    """Load query logs from the database. Returns (query_data, queries, execution_times, df).

    Args:
        limit: Max rows (most recent first). Use 0 for no LIMIT (entire filtered table).
    """
    connection = psycopg2.connect(db_conn_str)
    cursor = connection.cursor()
    base_sql = """
        SELECT query_text, mean_exec_time_ms, calls, rows_affected,
               shared_blks_hit, shared_blks_read, extracted_features
        FROM ml_optimization.query_logs
        WHERE query_text IS NOT NULL
        AND mean_exec_time_ms > 0
        ORDER BY collected_at DESC
    """
    if limit > 0:
        cursor.execute(base_sql + " LIMIT %s", (limit,))
    else:
        cursor.execute(base_sql)
    query_data = cursor.fetchall()
    cursor.close()
    connection.close()

    queries = [row[0] for row in query_data]
    execution_times = [row[1] for row in query_data]

    # DataFrame for predictor and anomaly (expected columns)
    df = pd.DataFrame(
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
    return query_data, queries, execution_times, df


def train_clustering(models_dir, query_logs_df):
    """Train workload clustering model only."""
    logger.info("Training Workload Clustering Model")
    # Build numeric features expected by WorkloadClusterer.fit(...)
    features = []
    for _, row in query_logs_df.iterrows():
        extracted = row.get("extracted_features", {}) or {}
        if isinstance(extracted, str):
            import json
            extracted = json.loads(extracted)

        features.append([
            float(row.get("mean_exec_time_ms", 0) or 0),
            float(extracted.get("estimated_rows", 0) or 0),
            float(extracted.get("table_count", 0) or 0),
            float(extracted.get("join_count", 0) or 0),
            float(extracted.get("filter_predicate_count", 0) or 0),
        ])

    if len(features) < MIN_RECORDS:
        logger.warning("Not enough training data for clustering (need >= %d)", MIN_RECORDS)
        return False

    clusterer = WorkloadClusterer()
    clusterer.fit(np.array(features))
    if clusterer.model is None:
        logger.warning("Clustering model did not train (insufficient or invalid features)")
        return False

    cluster_path = models_dir / "workload_clustering.pkl"
    clusterer.save_model(str(cluster_path))
    logger.info("Workload clustering model saved to %s", cluster_path)
    return True


def train_predictor(models_dir, query_logs_df):
    """Train query time predictor model only. query_logs_df must have extracted_features, calls, mean_exec_time_ms."""
    logger.info("Training Query Time Predictor Model")
    if len(query_logs_df) < MIN_RECORDS:
        logger.warning("Not enough training data for query time predictor (need >= %d)", MIN_RECORDS)
        return False
    predictor = QueryTimePredictor()
    predictor.train(query_logs_df)
    predictor_path = models_dir / "query_time_predictor.pkl"
    predictor.save_model(str(predictor_path))
    logger.info("Query time predictor model saved to %s", predictor_path)
    return True


def train_anomaly(models_dir, query_logs_df):
    """Train anomaly detector model only. query_logs_df must have mean_exec_time_ms, calls, rows_affected, shared_blks_*."""
    logger.info("Training Anomaly Detector Model")
    # Anomaly detector requires at least 100 samples internally
    if len(query_logs_df) < 100:
        logger.warning("Not enough training data for anomaly detector (need >= 100)")
        return False
    detector = QueryAnomalyDetector()
    detector.train(query_logs_df)
    if detector.model is None:
        return False
    detector_path = models_dir / "anomaly_detector.pkl"
    detector.save_model(str(detector_path))
    logger.info("Anomaly detector model saved to %s", detector_path)
    return True


def main():
    parser = argparse.ArgumentParser(
        description="Train individual ML optimization models (or all).",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python scripts/ml-optimization/train_model.py --model clustering
  python scripts/ml-optimization/train_model.py --model predictor
  python scripts/ml-optimization/train_model.py --model anomaly
  python scripts/ml-optimization/train_model.py --model all
  python scripts/ml-optimization/train_model.py --model all --limit 200000
  python scripts/ml-optimization/train_model.py --model all --limit 0
        """,
    )
    parser.add_argument(
        "--model",
        "-m",
        choices=["clustering", "predictor", "anomaly", "all"],
        required=True,
        help="Model to train: clustering, predictor, anomaly, or all",
    )
    parser.add_argument(
        "--limit",
        "-n",
        type=int,
        default=None,
        metavar="N",
        help=(
            "Max query_logs rows to load (newest first). Default: env TRAIN_QUERY_LOGS_LIMIT or 1000. "
            "Use 0 for no cap (all rows matching filters; high RAM and long train time)."
        ),
    )
    args = parser.parse_args()

    train_limit = DEFAULT_QUERY_LIMIT if args.limit is None else args.limit
    if train_limit < 0:
        logger.error("--limit must be >= 0 (0 means no SQL LIMIT)")
        sys.exit(1)
    if train_limit == 0:
        logger.warning(
            "Loading ALL matching query_logs (no LIMIT). This can use a lot of RAM and time "
            "for multi-million-row tables; consider --limit 200000 or 500000 instead."
        )

    db_conn_str = get_db_connection_string()
    models_dir = project_root / "ml-optimization" / "saved_models"
    models_dir.mkdir(exist_ok=True)

    try:
        query_data, queries, execution_times, query_logs_df = load_query_data(
            db_conn_str, train_limit
        )
    except Exception as e:
        logger.error("Failed to load query data: %s", e, exc_info=True)
        sys.exit(1)

    if len(query_data) < MIN_RECORDS:
        logger.error(
            "Not enough query logs for training. Need at least %d records. Run run_query_collection.py first.",
            MIN_RECORDS,
        )
        sys.exit(1)

    if train_limit > 0:
        logger.info(
            "Loaded %d query records for training (SQL LIMIT %d, newest first)",
            len(query_data),
            train_limit,
        )
    else:
        logger.info(
            "Loaded %d query records for training (no SQL LIMIT; all matching rows)",
            len(query_data),
        )

    models_to_run = []
    if args.model == "all":
        models_to_run = ["clustering", "predictor", "anomaly"]
    else:
        models_to_run = [args.model]

    success = True
    for model_name in models_to_run:
        logger.info("=" * 60)
        try:
            if model_name == "clustering":
                if not train_clustering(models_dir, query_logs_df):
                    success = False
            elif model_name == "predictor":
                if not train_predictor(models_dir, query_logs_df):
                    success = False
            elif model_name == "anomaly":
                if not train_anomaly(models_dir, query_logs_df):
                    success = False
        except Exception as e:
            logger.error("Error training %s: %s", model_name, e, exc_info=True)
            success = False

    logger.info("=" * 60)
    logger.info("Models saved to: %s", models_dir)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
