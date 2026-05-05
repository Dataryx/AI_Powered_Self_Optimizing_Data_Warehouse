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
  python scripts/ml-optimization/train_model.py --model predictor --limit 100000  # cap rows if needed

  # One DB load, then train each model on full table (default: all four):
  python scripts/ml-optimization/train_models_individual_full_data.py
"""

import argparse
import sys
import logging
import psycopg2
import pandas as pd
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
    from models.cache_predictor import CachePredictor
    from ml_optimization.config.model_config import QueryTimePredictorConfig
except ImportError as e:
    logger.error("Failed to import ML models: %s", e, exc_info=True)
    sys.exit(1)

MIN_RECORDS = 10
# Default cap for clustering / anomaly / ``--model all`` (keeps quick dev runs fast).
DEFAULT_QUERY_LIMIT = int(os.getenv("TRAIN_QUERY_LOGS_LIMIT", "1000"))
# ``--model predictor`` alone loads all matching rows unless you pass ``--limit``.


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
          AND trim(query_text) <> ''
          AND (
            COALESCE(mean_exec_time_ms, 0) > 0
            OR COALESCE(calls, 0) > 0
          )
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
    df["mean_exec_time_ms"] = pd.to_numeric(df["mean_exec_time_ms"], errors="coerce").fillna(0.0)
    _calls = pd.to_numeric(df["calls"], errors="coerce").fillna(0)
    _mask = (df["mean_exec_time_ms"] <= 0) & (_calls > 0)
    df.loc[_mask, "mean_exec_time_ms"] = 0.001
    return query_data, queries, execution_times, df


def train_clustering(models_dir, query_logs_df):
    """Train workload clustering model only."""
    logger.info("Training Workload Clustering Model")
    if len(query_logs_df) < MIN_RECORDS:
        logger.warning("Not enough training data for clustering (need >= %d)", MIN_RECORDS)
        return False

    clusterer = WorkloadClusterer()
    if not clusterer.fit_from_query_logs(query_logs_df):
        logger.warning("Clustering model did not train (insufficient or invalid features)")
        return False

    cluster_path = models_dir / "workload_clustering.pkl"
    clusterer.save_model(str(cluster_path))
    logger.info("Workload clustering model saved to %s", cluster_path)
    return True


def train_cache_predictor(models_dir, query_logs_df):
    """Train cache-worthiness RandomForest on aggregated query templates."""
    logger.info("Training Cache Predictor Model")
    if len(query_logs_df) < MIN_RECORDS:
        logger.warning("Not enough training data for cache predictor (need >= %d)", MIN_RECORDS)
        return False
    cp = CachePredictor()
    if not cp.fit_from_query_logs(query_logs_df):
        logger.warning(
            "Cache predictor not saved (too few distinct templates, single-class labels, or weak signal)"
        )
        return False
    cache_path = models_dir / "cache_predictor.pkl"
    cp.save_model(str(cache_path))
    logger.info("Cache predictor saved to %s", cache_path)
    return True


def train_predictor(models_dir, query_logs_df):
    """Train query time predictor model only. query_logs_df must have extracted_features, calls, mean_exec_time_ms."""
    logger.info("Training Query Time Predictor Model")
    if len(query_logs_df) < MIN_RECORDS:
        logger.warning("Not enough training data for query time predictor (need >= %d)", MIN_RECORDS)
        return False

    target_r2 = float(os.getenv("PREDICTOR_TARGET_R2", "0.90"))
    target_r2 = max(0.0, min(0.999, target_r2))

    # Multiple realistic candidate settings; best test_r2 is kept and saved.
    candidate_cfgs = [
        {"model_type": "xgboost", "n_estimators": 300, "max_depth": 8, "learning_rate": 0.05},
        {"model_type": "xgboost", "n_estimators": 500, "max_depth": 10, "learning_rate": 0.03},
        {"model_type": "xgboost", "n_estimators": 200, "max_depth": 6, "learning_rate": 0.08},
        {"model_type": "random_forest", "n_estimators": 500, "max_depth": 24, "min_samples_split": 2, "min_samples_leaf": 1},
        {"model_type": "random_forest", "n_estimators": 300, "max_depth": 18, "min_samples_split": 2, "min_samples_leaf": 1},
        {"model_type": "gradient_boosting", "n_estimators": 500, "max_depth": 6, "learning_rate": 0.05, "min_samples_split": 2, "min_samples_leaf": 1},
    ]

    best_predictor = None
    best_metrics = None
    best_r2 = float("-inf")

    for idx, cfg_overrides in enumerate(candidate_cfgs, start=1):
        cfg = QueryTimePredictorConfig(**cfg_overrides)
        predictor = QueryTimePredictor(config=cfg)
        try:
            metrics = predictor.train(query_logs_df)
        except Exception as ex:
            logger.warning("Predictor trial %d failed (%s): %s", idx, cfg_overrides, ex)
            continue
        test_r2 = float(metrics.get("test_r2", float("-inf")) or float("-inf"))
        logger.info(
            "Predictor trial %d/%d: model=%s test_r2=%.4f test_rmse=%.2fms test_mae=%.2fms",
            idx,
            len(candidate_cfgs),
            cfg.model_type,
            test_r2,
            float(metrics.get("test_rmse", 0.0) or 0.0),
            float(metrics.get("test_mae", 0.0) or 0.0),
        )
        if test_r2 > best_r2:
            best_r2 = test_r2
            best_predictor = predictor
            best_metrics = metrics
        if test_r2 >= target_r2:
            logger.info(
                "Reached target predictor accuracy: test_r2=%.4f (target %.2f).",
                test_r2,
                target_r2,
            )
            break

    if best_predictor is None or best_metrics is None:
        logger.error("All predictor training trials failed.")
        return False

    logger.info(
        "Best predictor selected: model=%s, test_r2=%.4f, test_rmse=%.2fms, test_mae=%.2fms",
        best_predictor.config.model_type,
        best_r2,
        float(best_metrics.get("test_rmse", 0.0) or 0.0),
        float(best_metrics.get("test_mae", 0.0) or 0.0),
    )
    if best_r2 < target_r2:
        logger.warning(
            "Best predictor test_r2 %.4f is below target %.2f. Collect more representative query_logs and retrain.",
            best_r2,
            target_r2,
        )

    predictor_path = models_dir / "query_time_predictor.pkl"
    best_predictor.save_model(str(predictor_path))
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
  python scripts/ml-optimization/train_model.py --model predictor   # loads ALL matching query_logs (no LIMIT)
  python scripts/ml-optimization/train_model.py --model anomaly
  python scripts/ml-optimization/train_model.py --model cache
  python scripts/ml-optimization/train_model.py --model all
  python scripts/ml-optimization/train_model.py --model all --limit 200000
  python scripts/ml-optimization/train_model.py --model all --limit 0
  python scripts/ml-optimization/train_model.py --model predictor --limit 100000
        """,
    )
    parser.add_argument(
        "--model",
        "-m",
        choices=["clustering", "predictor", "anomaly", "cache", "all"],
        required=True,
        help="Model to train: clustering, predictor, anomaly, cache, or all",
    )
    parser.add_argument(
        "--limit",
        "-n",
        type=int,
        default=None,
        metavar="N",
        help=(
            "Max query_logs rows to load (newest first). For --model predictor, default is 0 (all rows). "
            "For clustering, anomaly, cache, or all, default is TRAIN_QUERY_LOGS_LIMIT or 1000. "
            "Use 0 for no SQL LIMIT (high RAM and train time)."
        ),
    )
    args = parser.parse_args()

    if args.limit is not None:
        train_limit = args.limit
    elif args.model == "predictor":
        train_limit = 0
    else:
        train_limit = DEFAULT_QUERY_LIMIT
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
        models_to_run = ["clustering", "predictor", "anomaly", "cache"]
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
            elif model_name == "cache":
                if not train_cache_predictor(models_dir, query_logs_df):
                    success = False
        except Exception as e:
            logger.error("Error training %s: %s", model_name, e, exc_info=True)
            success = False

    logger.info("=" * 60)
    logger.info("Models saved to: %s", models_dir)
    sys.exit(0 if success else 1)


if __name__ == "__main__":
    main()
