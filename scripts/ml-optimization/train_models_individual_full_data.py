#!/usr/bin/env python3
"""
Train ML models one at a time using **all** matching rows in ``ml_optimization.query_logs``
(no SQL ``LIMIT``).

Loads the dataset **once**, then runs the same trainers as ``train_model.py`` in sequence
(default: clustering → predictor → anomaly → cache).

Prerequisites: ``POSTGRES_*`` env (or defaults), populated ``query_logs`` (e.g. run
``run_query_collection.py`` / ``run_traffic_and_collection.py``).

Usage (from repository root):

  python scripts/ml-optimization/train_models_individual_full_data.py

  # Only some models (still one full-table load):
  python scripts/ml-optimization/train_models_individual_full_data.py --models predictor anomaly

  # Equivalent per-model commands (each reloads from DB):
  python scripts/ml-optimization/train_model.py --model predictor --limit 0
  python scripts/ml-optimization/train_model.py --model clustering --limit 0
"""

from __future__ import annotations

import argparse
import importlib.util
import logging
import sys
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
logger = logging.getLogger("train_models_individual_full_data")


def _load_train_model_module():
    here = Path(__file__).resolve().parent
    path = here / "train_model.py"
    spec = importlib.util.spec_from_file_location("train_model_runner", path)
    if spec is None or spec.loader is None:
        raise RuntimeError(f"Cannot load {path}")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Train selected ML models sequentially on full query_logs (no LIMIT).",
    )
    parser.add_argument(
        "--models",
        nargs="+",
        choices=["clustering", "predictor", "anomaly", "cache"],
        default=["clustering", "predictor", "anomaly", "cache"],
        metavar="NAME",
        help="Models to train (default: all four)",
    )
    args = parser.parse_args()

    tm = _load_train_model_module()
    db_conn_str = tm.get_db_connection_string()
    models_dir = Path(tm.project_root) / "ml-optimization" / "saved_models"
    models_dir.mkdir(parents=True, exist_ok=True)

    logger.warning(
        "Loading ALL matching query_logs rows (no LIMIT). High RAM/time on large tables; "
        "use train_model.py --limit N for a cap."
    )

    try:
        query_data, _q, _e, df = tm.load_query_data(db_conn_str, 0)
    except Exception as ex:
        logger.error("Failed to load query logs: %s", ex, exc_info=True)
        sys.exit(1)

    if len(query_data) < tm.MIN_RECORDS:
        logger.error(
            "Need at least %s query_logs rows; got %s. Collect logs first.",
            tm.MIN_RECORDS,
            len(query_data),
        )
        sys.exit(1)

    logger.info("Loaded %s rows for training", len(df))

    runners = {
        "clustering": tm.train_clustering,
        "predictor": tm.train_predictor,
        "anomaly": tm.train_anomaly,
        "cache": tm.train_cache_predictor,
    }

    ok = True
    for name in args.models:
        logger.info("=" * 60)
        logger.info("Training: %s", name)
        logger.info("=" * 60)
        try:
            if not runners[name](models_dir, df):
                ok = False
        except Exception as ex:
            logger.error("%s failed: %s", name, ex, exc_info=True)
            ok = False

    logger.info("Artifacts directory: %s", models_dir)
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
