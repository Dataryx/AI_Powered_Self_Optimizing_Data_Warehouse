"""
Workload Clustering Model
Clusters queries by workload characteristics using unsupervised learning.
"""

import numpy as np
import pandas as pd
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
import joblib
import logging
from typing import List, Dict, Optional, Tuple
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
        self.feature_names = [
            'execution_time_normalized',
            'row_count_log',
            'table_count',
            'join_complexity',
            'filter_selectivity',
        ]
    
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
        
        logger.info(f"Fitted {self.config.algorithm} model with {len(set(self.model.labels_))} clusters")
        
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
        if self.config.algorithm == 'kmeans':
            labels = self.model.predict(features_scaled)
        elif self.config.algorithm == 'dbscan':
            labels = self.model.fit_predict(features_scaled)  # DBSCAN doesn't have predict
        else:
            raise ValueError(f"Unsupported algorithm: {self.config.algorithm}")
        
        return labels
    
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
        queries_with_labels['cluster'] = labels
        
        profiles = {}
        
        for cluster_id in set(labels):
            if cluster_id == -1:  # Noise cluster (DBSCAN)
                continue
            
            cluster_queries = queries_with_labels[queries_with_labels['cluster'] == cluster_id]
            
            profiles[cluster_id] = {
                'size': len(cluster_queries),
                'avg_execution_time_ms': float(cluster_queries['mean_exec_time_ms'].mean()),
                'avg_table_count': float(cluster_queries['table_count'].mean()),
                'avg_join_count': float(cluster_queries['join_count'].mean()),
                'has_aggregation_ratio': float(cluster_queries['has_aggregation'].mean()),
                'has_window_function_ratio': float(cluster_queries['has_window_function'].mean()),
            }
        
        self.cluster_profiles = profiles
        return profiles
    
    def save_model(self, filepath: str):
        """Save trained model to file."""
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'pca': self.pca,
            'config': self.config,
            'cluster_profiles': self.cluster_profiles,
            'feature_names': self.feature_names,
        }
        joblib.dump(model_data, filepath)
        logger.info(f"Saved model to {filepath}")
    
    def load_model(self, filepath: str):
        """Load trained model from file."""
        model_data = joblib.load(filepath)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.pca = model_data.get('pca')
        self.config = model_data.get('config', WorkloadClusteringConfig())
        self.cluster_profiles = model_data.get('cluster_profiles', {})
        self.feature_names = model_data.get('feature_names', self.feature_names)
        logger.info(f"Loaded model from {filepath}")


