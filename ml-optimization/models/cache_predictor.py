"""
Cache Predictor
Predicts cache-worthiness for query templates from aggregated query_logs using RandomForest.
"""

from __future__ import annotations

import logging
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import joblib
import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.preprocessing import StandardScaler

from ml_optimization.config.model_config import CachePredictorConfig

logger = logging.getLogger(__name__)


class CachePredictor:
    """Predicts P(cache beneficial) for query templates from access and latency aggregates."""

    def __init__(self, config: Optional[CachePredictorConfig] = None):
        self.config = config or CachePredictorConfig()
        self.model = RandomForestClassifier(
            n_estimators=self.config.n_estimators,
            max_depth=self.config.max_depth,
            min_samples_split=self.config.min_samples_split,
            random_state=self.config.random_state,
            n_jobs=-1,
        )
        self.scaler = StandardScaler()
        self.is_trained = False
        self.feature_names: List[str] = [
            "log1p_sample_count",
            "log1p_calls_sum",
            "log1p_mean_exec_ms",
            "log1p_max_exec_ms",
            "log1p_mean_rows_affected",
            "mean_hit_ratio",
        ]
        self.training_stats: Dict[str, Any] = {}
        self.access_patterns: Dict[str, Dict[str, Any]] = {}

    def _aggregate_groups(self, df: pd.DataFrame) -> pd.DataFrame:
        """One row per distinct query_text with telemetry aggregates."""
        if df.empty or "query_text" not in df.columns:
            return pd.DataFrame()

        rows_out: List[Dict[str, Any]] = []
        for _qtext, g in df.groupby(df["query_text"].astype(str), sort=False, dropna=False):
            hits = g.get("shared_blks_hit", pd.Series([0] * len(g))).fillna(0).astype(float)
            reads = g.get("shared_blks_read", pd.Series([0] * len(g))).fillna(0).astype(float)
            denom = hits + reads
            ratio = float((hits / denom.replace(0, np.nan)).mean()) if len(denom) else 0.0
            if np.isnan(ratio):
                ratio = 0.0
            calls_col = g["calls"] if "calls" in g.columns else pd.Series([1] * len(g))
            ra = g.get("rows_affected", pd.Series([0] * len(g))).fillna(0).astype(float)
            sample_log_id: Optional[int] = None
            if "log_id" in g.columns and "collected_at" in g.columns:
                try:
                    g2 = g.sort_values("collected_at", ascending=False, na_position="last")
                    lid = g2.iloc[0].get("log_id")
                    if lid is not None and not (isinstance(lid, float) and np.isnan(lid)):
                        sample_log_id = int(lid)
                except Exception:
                    sample_log_id = None
            elif "log_id" in g.columns:
                try:
                    lid = g["log_id"].iloc[0]
                    if lid is not None and not (isinstance(lid, float) and np.isnan(lid)):
                        sample_log_id = int(lid)
                except Exception:
                    sample_log_id = None
            c = pd.to_numeric(calls_col, errors="coerce").fillna(0).astype(float)
            calls_sum = float(c.sum())
            me = pd.to_numeric(g["mean_exec_time_ms"], errors="coerce").fillna(0).astype(float)
            if "total_exec_time_ms" in g.columns:
                te = pd.to_numeric(g["total_exec_time_ms"], errors="coerce").fillna(0).astype(float)
                row_tot = np.where(te > 0, te, me * c)
            else:
                row_tot = (me * c).to_numpy()
            mean_exec_ms = float(np.sum(row_tot) / calls_sum) if calls_sum > 0 else float(me.mean() or 0)
            if "max_exec_time_ms" in g.columns:
                max_exec_ms = float(pd.to_numeric(g["max_exec_time_ms"], errors="coerce").fillna(0).max() or 0)
            else:
                max_exec_ms = float(g["mean_exec_time_ms"].max() or 0)
            rows_out.append(
                {
                    "sample_count": len(g),
                    "calls_sum": max(calls_sum, float(len(g))),
                    "mean_exec_ms": float(mean_exec_ms),
                    "max_exec_ms": float(max_exec_ms),
                    "mean_rows_affected": float(ra.mean() or 0),
                    "mean_hit_ratio": ratio,
                    "query_preview": str(g["query_text"].iloc[0])[:500],
                    "sample_log_id": sample_log_id,
                }
            )
        return pd.DataFrame(rows_out)

    def _build_xy(
        self, agg: pd.DataFrame
    ) -> Tuple[Optional[np.ndarray], Optional[np.ndarray]]:
        if agg is None or len(agg) < self.config.min_training_groups:
            return None, None

        X_list: List[List[float]] = []
        y_list: List[int] = []
        min_calls = self.config.min_calls_sum_for_positive
        min_ms = self.config.min_mean_exec_ms_for_positive

        for __, row in agg.iterrows():
            sc = int(row.get("sample_count", 1) or 1)
            calls = float(row.get("calls_sum", sc) or sc)
            mean_ms = float(row.get("mean_exec_ms", 0) or 0)
            max_ms = float(row.get("max_exec_ms", 0) or 0)
            mra = float(row.get("mean_rows_affected", 0) or 0)
            hit_r = float(row.get("mean_hit_ratio", 0) or 0)
            X_list.append(
                [
                    np.log1p(sc),
                    np.log1p(calls),
                    np.log1p(max(mean_ms, 0.0)),
                    np.log1p(max(max_ms, 0.0)),
                    np.log1p(max(mra, 0.0)),
                    min(max(hit_r, 0.0), 1.0),
                ]
            )
            positive = calls >= min_calls and mean_ms >= min_ms
            y_list.append(1 if positive else 0)

        y = np.asarray(y_list, dtype=int)
        if len(np.unique(y)) < 2:
            logger.warning(
                "CachePredictor: labels are single-class; need mix of high/low traffic templates"
            )
            return None, None

        return np.asarray(X_list, dtype=np.float64), y

    def fit_from_query_logs(self, df: pd.DataFrame) -> bool:
        """Train on query_logs-shaped DataFrame (same columns as predictor training)."""
        agg = self._aggregate_groups(df)
        X, y = self._build_xy(agg)
        if X is None or y is None:
            self.is_trained = False
            return False

        Xs = self.scaler.fit_transform(X)
        self.model.fit(Xs, y)
        self.is_trained = True
        self.training_stats = {
            "n_groups": int(len(agg)),
            "positive_rate": float(np.mean(y)),
            "n_features": X.shape[1],
        }
        logger.info(
            "CachePredictor trained on %s query templates (positive_rate=%.3f)",
            len(agg),
            self.training_stats["positive_rate"],
        )
        return True

    def _features_from_agg_row(self, row: pd.Series) -> np.ndarray:
        sc = int(row.get("sample_count", 1) or 1)
        calls = float(row.get("calls_sum", sc) or sc)
        mean_ms = float(row.get("mean_exec_ms", 0) or 0)
        max_ms = float(row.get("max_exec_ms", 0) or 0)
        mra = float(row.get("mean_rows_affected", 0) or 0)
        hit_r = float(row.get("mean_hit_ratio", 0) or 0)
        v = np.array(
            [
                [
                    np.log1p(sc),
                    np.log1p(calls),
                    np.log1p(max(mean_ms, 0.0)),
                    np.log1p(max(max_ms, 0.0)),
                    np.log1p(max(mra, 0.0)),
                    min(max(hit_r, 0.0), 1.0),
                ]
            ],
            dtype=np.float64,
        )
        return v

    def predict_proba_groups(self, agg: pd.DataFrame) -> np.ndarray:
        """P(class=1) per aggregate row; requires trained model."""
        if not self.is_trained or agg is None or len(agg) == 0:
            return np.array([])
        rows = np.vstack([self._features_from_agg_row(row)[0] for _, row in agg.iterrows()])
        Xs = self.scaler.transform(rows)
        proba = self.model.predict_proba(Xs)
        # class 1 = cache candidate
        if proba.shape[1] < 2:
            return proba[:, 0]
        return proba[:, 1]

    def top_cache_candidates(
        self, df: pd.DataFrame, limit: int = 50, threshold: Optional[float] = None
    ) -> List[Dict[str, Any]]:
        """Rank grouped query templates by predicted cache benefit."""
        thr = self.config.cache_threshold if threshold is None else threshold
        agg = self._aggregate_groups(df)
        if agg is None or len(agg) == 0:
            return []

        if not self.is_trained:
            out: List[Dict[str, Any]] = []
            for _, row in agg.iterrows():
                calls = float(row.get("calls_sum", 0) or 0)
                mean_ms = float(row.get("mean_exec_ms", 0) or 0)
                freq_p = min(calls / 100.0, 1.0)
                time_p = min(mean_ms / 1000.0, 1.0)
                p = min(0.99, freq_p * 0.6 + time_p * 0.4)
                if p >= thr:
                    sl = row.get("sample_log_id")
                    out.append(
                        {
                            "query_preview": str(row.get("query_preview", ""))[:500],
                            "cache_probability": float(p),
                            "sample_count": int(row.get("sample_count", 0)),
                            "calls_sum": calls,
                            "mean_exec_ms": mean_ms,
                            "source": "heuristic",
                            "sample_log_id": int(sl) if sl is not None and not pd.isna(sl) else None,
                        }
                    )
            out.sort(key=lambda x: x["cache_probability"], reverse=True)
            return out[:limit]

        probs = self.predict_proba_groups(agg)
        ranked: List[Dict[str, Any]] = []
        for i, (_, row) in enumerate(agg.iterrows()):
            p = float(probs[i]) if i < len(probs) else 0.0
            if p < thr:
                continue
            sl = row.get("sample_log_id")
            ranked.append(
                {
                    "query_preview": str(row.get("query_preview", ""))[:500],
                    "cache_probability": p,
                    "sample_count": int(row.get("sample_count", 0)),
                    "calls_sum": float(row.get("calls_sum", 0) or 0),
                    "mean_exec_ms": float(row.get("mean_exec_ms", 0) or 0),
                    "source": "random_forest",
                    "sample_log_id": int(sl) if sl is not None and not pd.isna(sl) else None,
                }
            )
        ranked.sort(key=lambda x: x["cache_probability"], reverse=True)
        return ranked[:limit]

    def track_access(self, query_template: str, timestamp: datetime, execution_time_ms: float):
        """Optional online tracking (not persisted across API restarts unless saved)."""
        if query_template not in self.access_patterns:
            self.access_patterns[query_template] = {
                "access_times": [],
                "execution_times": [],
                "last_access": None,
            }
        pattern = self.access_patterns[query_template]
        pattern["access_times"].append(timestamp)
        pattern["execution_times"].append(execution_time_ms)
        pattern["last_access"] = timestamp
        if len(pattern["access_times"]) > 1000:
            pattern["access_times"] = pattern["access_times"][-1000:]
            pattern["execution_times"] = pattern["execution_times"][-1000:]

    def predict_cache_probability(self, query_template: str) -> float:
        """Heuristic fallback when model untrained; uses in-memory access_patterns only."""
        if query_template not in self.access_patterns:
            return 0.5
        pattern = self.access_patterns[query_template]
        frequency = len(pattern["access_times"])
        avg_exec_time = (
            float(np.mean(pattern["execution_times"])) if pattern["execution_times"] else 0.0
        )
        freq_prob = min(frequency / 100.0, 1.0)
        time_prob = min(avg_exec_time / 1000.0, 1.0)
        return float(min(1.0, freq_prob * 0.6 + time_prob * 0.4))

    def get_cache_candidates(self, threshold: float = 0.7) -> List[Dict[str, Any]]:
        """Templates from track_access() above threshold."""
        candidates: List[Dict[str, Any]] = []
        for query_template, pattern in self.access_patterns.items():
            probability = self.predict_cache_probability(query_template)
            if probability >= threshold:
                candidates.append(
                    {
                        "query_template": query_template,
                        "probability": probability,
                        "access_count": len(pattern["access_times"]),
                        "avg_execution_time_ms": float(np.mean(pattern["execution_times"]))
                        if pattern["execution_times"]
                        else 0.0,
                        "last_access": pattern["last_access"],
                    }
                )
        candidates.sort(key=lambda x: x["probability"], reverse=True)
        return candidates

    def save_model(self, filepath: str) -> None:
        payload = {
            "model": self.model,
            "scaler": self.scaler,
            "config": self.config,
            "feature_names": self.feature_names,
            "is_trained": self.is_trained,
            "training_stats": self.training_stats,
        }
        joblib.dump(payload, filepath)
        logger.info("CachePredictor saved to %s", filepath)

    def load_model(self, filepath: str) -> None:
        data = joblib.load(filepath)
        self.model = data["model"]
        self.scaler = data["scaler"]
        self.config = data.get("config", CachePredictorConfig())
        self.feature_names = data.get("feature_names", self.feature_names)
        self.is_trained = bool(data.get("is_trained", True))
        self.training_stats = data.get("training_stats", {})
        logger.info("CachePredictor loaded from %s", filepath)
