"""
Workload Clustering Model
Clusters queries by workload characteristics using unsupervised learning.
"""

import json
import numpy as np
import pandas as pd
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import joblib
import logging
from typing import List, Dict, Optional, Tuple, Any
from pathlib import Path

from ml_optimization.config.model_config import WorkloadClusteringConfig

logger = logging.getLogger(__name__)


class WorkloadClusterer:
    """Clusters database queries based on workload characteristics."""
    
    def __init__(self, config: Optional[WorkloadClusteringConfig] = None):
        """
        Initialize workload clusterer.
        
        Args:
            config: Configuration for clustering model
        """
        self.config = config or WorkloadClusteringConfig()
        self.model = None
        self.scaler = StandardScaler()
        self.pca = None
        self.cluster_profiles = {}
        self._dbscan_centroids: Dict[int, np.ndarray] = {}
        self._fit_X_scaled: Optional[np.ndarray] = None
        self.feature_names = [
            'execution_time_normalized',
            'row_count_log',
            'table_count',
            'join_complexity',
            'filter_selectivity',
        ]

    @staticmethod
    def feature_matrix_from_query_logs_df(df: pd.DataFrame) -> np.ndarray:
        """
        Build (n, 5) raw feature rows aligned with training scripts:
        mean_exec_time_ms, estimated_rows, table_count, join_count, filter_predicate_count
        (from ``extracted_features`` JSON when present).
        """
        rows: List[List[float]] = []
        for _, row in df.iterrows():
            extracted: Any = row.get("extracted_features", {}) or {}
            if isinstance(extracted, str):
                try:
                    extracted = json.loads(extracted)
                except json.JSONDecodeError:
                    extracted = {}
            if not isinstance(extracted, dict):
                extracted = {}
            rows.append(
                [
                    float(row.get("mean_exec_time_ms", 0) or 0),
                    float(extracted.get("estimated_rows", 0) or 0),
                    float(extracted.get("table_count", 0) or 0),
                    float(extracted.get("join_count", 0) or 0),
                    float(extracted.get("filter_predicate_count", 0) or 0),
                ]
            )
        return np.asarray(rows, dtype=np.float64)

    def fit_from_query_logs(self, df: pd.DataFrame) -> bool:
        """Fit on ``ml_optimization.query_logs``-shaped DataFrame (same as train_model.py)."""
        X = self.feature_matrix_from_query_logs_df(df)
        if X.shape[0] < self.config.min_samples:
            logger.warning(
                "Insufficient samples for clustering: %s < %s",
                X.shape[0],
                self.config.min_samples,
            )
            return False
        self.fit(X)
        return self.model is not None

    def predict_from_query_logs(self, df: pd.DataFrame) -> np.ndarray:
        """Assign cluster ids to each query log row (same feature construction as training)."""
        X = self.feature_matrix_from_query_logs_df(df)
        return self.predict(X)

    def prepare_features(self, queries: pd.DataFrame) -> np.ndarray:
        """
        Prepare features for clustering.
        
        Args:
            queries: DataFrame with query features
            
        Returns:
            Array of prepared features
        """
        features = []
        
        for _, row in queries.iterrows():
            # Normalize execution time (log scale)
            exec_time = max(row.get('mean_exec_time_ms', 0), 0.1)  # Avoid log(0)
            exec_time_norm = np.log1p(exec_time) / np.log1p(10000)  # Normalize to [0, 1]
            
            # Log-transform row count
            row_count = max(row.get('estimated_rows', 0) or 0, 1)
            row_count_log = np.log1p(row_count) / np.log1p(1000000)
            
            # Table count (normalized)
            table_count = min(row.get('table_count', 0) / 10.0, 1.0)
            
            # Join complexity
            join_count = row.get('join_count', 0)
            join_complexity = min(join_count / 10.0, 1.0)
            
            # Filter selectivity (heuristic)
            filter_count = row.get('filter_predicate_count', 0)
            filter_selectivity = min(filter_count / 20.0, 1.0)
            
            feature_vector = [
                exec_time_norm,
                row_count_log,
                table_count,
                join_complexity,
                filter_selectivity,
            ]
            
            features.append(feature_vector)
        
        return np.array(features)
    
    def fit(self, query_features: np.ndarray) -> 'WorkloadClusterer':
        """
        Fit clustering model to query features.
        
        Args:
            query_features: Array of query features
            
        Returns:
            Self for chaining
        """
        if query_features.shape[0] < self.config.min_samples:
            logger.warning(f"Insufficient samples for clustering: {query_features.shape[0]}")
            return self
        
        # Scale features
        features_scaled = self.scaler.fit_transform(query_features)
        
        # Apply PCA for dimensionality reduction if needed
        if features_scaled.shape[1] > 10:
            self.pca = PCA(n_components=10)
            features_scaled = self.pca.fit_transform(features_scaled)
        
        # Fit clustering model
        if self.config.algorithm == 'kmeans':
            self.model = KMeans(
                n_clusters=self.config.n_clusters,
                random_state=self.config.random_state,
                n_init=self.config.n_init,
                max_iter=self.config.max_iter,
            )
        elif self.config.algorithm == 'dbscan':
            self.model = DBSCAN(
                eps=self.config.eps,
                min_samples=self.config.min_samples,
            )
        else:
            raise ValueError(f"Unsupported algorithm: {self.config.algorithm}")
        
        self.model.fit(features_scaled)
        self._fit_X_scaled = features_scaled

        self._dbscan_centroids = {}
        if self.config.algorithm == "dbscan" and hasattr(self.model, "labels_"):
            for lab in set(self.model.labels_):
                if lab == -1:
                    continue
                mask = self.model.labels_ == lab
                if np.any(mask):
                    self._dbscan_centroids[int(lab)] = np.mean(features_scaled[mask], axis=0)

        n_lab = (
            len(set(self.model.labels_))
            if hasattr(self.model, "labels_")
            else getattr(self.model, "n_clusters", 0)
        )
        logger.info("Fitted %s model (%s cluster labels)", self.config.algorithm, n_lab)

        return self
    
    def predict(self, query_features: np.ndarray) -> np.ndarray:
        """
        Predict cluster labels for new queries.
        
        Args:
            query_features: Array of query features
            
        Returns:
            Array of cluster labels
        """
        if self.model is None:
            raise ValueError("Model must be fitted before prediction")
        
        # Scale features
        features_scaled = self.scaler.transform(query_features)
        
        # Apply PCA if used during training
        if self.pca is not None:
            features_scaled = self.pca.transform(features_scaled)
        
        # Predict clusters
        if self.config.algorithm == "kmeans":
            labels = self.model.predict(features_scaled)
        elif self.config.algorithm == "dbscan":
            labels = self._predict_dbscan_assign(features_scaled)
        else:
            raise ValueError(f"Unsupported algorithm: {self.config.algorithm}")

        return labels

    def _predict_dbscan_assign(self, features_scaled: np.ndarray) -> np.ndarray:
        """Assign points to nearest DBSCAN cluster centroid (trained centroids only)."""
        if not self._dbscan_centroids:
            return np.full(features_scaled.shape[0], -1, dtype=int)
        out = np.empty(features_scaled.shape[0], dtype=int)
        eps = float(self.config.eps)
        for i in range(features_scaled.shape[0]):
            v = features_scaled[i]
            best_lab = -1
            best_d = float("inf")
            for lab, c in self._dbscan_centroids.items():
                d = float(np.linalg.norm(v - c))
                if d < best_d:
                    best_d = d
                    best_lab = lab
            out[i] = best_lab if best_d <= eps else -1
        return out
    
    def get_cluster_profiles(self, queries: pd.DataFrame, labels: np.ndarray) -> Dict:
        """
        Get profile statistics for each cluster.
        
        Args:
            queries: DataFrame with query data
            labels: Cluster labels
            
        Returns:
            Dictionary with cluster profiles
        """
        queries_with_labels = queries.copy()
        queries_with_labels["cluster"] = labels

        for col, default in [
            ("mean_exec_time_ms", 0.0),
            ("table_count", 0.0),
            ("join_count", 0.0),
            ("has_aggregation", 0.0),
            ("has_window_function", 0.0),
        ]:
            if col not in queries_with_labels.columns:
                queries_with_labels[col] = default

        profiles = {}

        for cluster_id in set(labels):
            if cluster_id == -1:  # Noise cluster (DBSCAN)
                continue

            cluster_queries = queries_with_labels[queries_with_labels["cluster"] == cluster_id]

            profiles[cluster_id] = {
                "size": len(cluster_queries),
                "avg_execution_time_ms": float(cluster_queries["mean_exec_time_ms"].mean() or 0),
                "avg_table_count": float(cluster_queries["table_count"].mean() or 0),
                "avg_join_count": float(cluster_queries["join_count"].mean() or 0),
                "has_aggregation_ratio": float(cluster_queries["has_aggregation"].mean() or 0),
                "has_window_function_ratio": float(cluster_queries["has_window_function"].mean() or 0),
            }
        
        self.cluster_profiles = profiles
        return profiles
    
    def save_model(self, filepath: str):
        """Save trained model to file."""
        model_data = {
            "model": self.model,
            "scaler": self.scaler,
            "pca": self.pca,
            "config": self.config,
            "cluster_profiles": self.cluster_profiles,
            "feature_names": self.feature_names,
            "dbscan_centroids": self._dbscan_centroids,
        }
        joblib.dump(model_data, filepath)
        logger.info(f"Saved model to {filepath}")

    def load_model(self, filepath: str):
        """Load trained model from file."""
        model_data = joblib.load(filepath)
        self.model = model_data["model"]
        self.scaler = model_data["scaler"]
        self.pca = model_data.get("pca")
        self.config = model_data.get("config", WorkloadClusteringConfig())
        self.cluster_profiles = model_data.get("cluster_profiles", {})
        self.feature_names = model_data.get("feature_names", self.feature_names)
        self._dbscan_centroids = model_data.get("dbscan_centroids") or {}
        logger.info(f"Loaded model from {filepath}")


