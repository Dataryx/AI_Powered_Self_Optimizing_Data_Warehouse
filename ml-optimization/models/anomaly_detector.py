"""
Anomaly Detector
Detects anomalies in query performance and behavior.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import IsolationForest
from sklearn.preprocessing import StandardScaler
import joblib
import logging
from typing import Dict, List, Optional, Tuple
from datetime import datetime

from ml_optimization.config.model_config import AnomalyDetectorConfig

logger = logging.getLogger(__name__)


class QueryAnomalyDetector:
    """Detects anomalies in query performance metrics."""
    
    def __init__(self, config: Optional[AnomalyDetectorConfig] = None):
        """
        Initialize anomaly detector.
        
        Args:
            config: Configuration for anomaly detection
        """
        self.config = config or AnomalyDetectorConfig()
        self.model = None
        self.scaler = StandardScaler()
        self.baseline_stats = {}
    
    def train(self, historical_metrics: pd.DataFrame):
        """
        Train anomaly detection model on historical metrics.
        
        Args:
            historical_metrics: DataFrame with historical query metrics
        """
        # Extract features
        features = self._extract_features(historical_metrics)
        
        if len(features) < 100:
            logger.warning(f"Insufficient samples for anomaly detection: {len(features)}")
            return
        
        # Scale features
        features_scaled = self.scaler.fit_transform(features)
        
        # Train isolation forest
        self.model = IsolationForest(
            contamination=self.config.contamination,
            n_estimators=self.config.n_estimators,
            max_samples=self.config.max_samples,
            random_state=self.config.random_state,
            n_jobs=self.config.n_jobs,
        )
        
        self.model.fit(features_scaled)
        
        # Calculate baseline statistics
        predictions = self.model.predict(features_scaled)
        normal_samples = features[predictions == 1]
        
        self.baseline_stats = {
            'mean': normal_samples.mean().to_dict(),
            'std': normal_samples.std().to_dict(),
        }
        
        logger.info(f"Anomaly detector trained on {len(features)} samples")
    
    def _extract_features(self, metrics: pd.DataFrame) -> pd.DataFrame:
        """Extract features from metrics DataFrame."""
        feature_cols = [
            'mean_exec_time_ms',
            'calls',
            'rows_affected',
            'shared_blks_hit',
            'shared_blks_read',
        ]
        
        # Use available columns
        available_cols = [col for col in feature_cols if col in metrics.columns]
        features = metrics[available_cols].copy()
        
        # Fill missing values
        features = features.fillna(0)
        
        # Log transform execution time
        if 'mean_exec_time_ms' in features.columns:
            features['mean_exec_time_ms'] = np.log1p(features['mean_exec_time_ms'])
        
        return features
    
    def detect_anomaly(self, query_metrics: Dict) -> Tuple[bool, float, str]:
        """
        Detect if query metrics indicate an anomaly.
        
        Args:
            query_metrics: Dictionary with query metrics
            
        Returns:
            Tuple of (is_anomaly, anomaly_score, reason)
        """
        if self.model is None:
            return False, 0.0, "Model not trained"
        
        # Extract features
        features_df = pd.DataFrame([query_metrics])
        features = self._extract_features(features_df)
        
        if features.empty:
            return False, 0.0, "No features available"
        
        # Scale features
        features_scaled = self.scaler.transform(features)
        
        # Predict
        prediction = self.model.predict(features_scaled)[0]
        anomaly_score = self.model.score_samples(features_scaled)[0]
        
        is_anomaly = prediction == -1
        
        # Determine reason
        reason = self._classify_anomaly_type(query_metrics)
        
        return is_anomaly, float(anomaly_score), reason
    
    def _classify_anomaly_type(self, metrics: Dict) -> str:
        """Classify the type of anomaly."""
        exec_time = metrics.get('mean_exec_time_ms', 0)
        
        # Simple heuristic-based classification
        if exec_time > 5000:
            return "Execution time spike"
        elif exec_time < 1 and metrics.get('calls', 0) > 1000:
            return "Unusual query pattern"
        else:
            return "Performance anomaly"
    
    def get_anomaly_types(self) -> List[str]:
        """Get list of possible anomaly types."""
        return [
            "Execution time spike",
            "Resource consumption anomaly",
            "Unusual query pattern",
            "Data volume anomaly",
        ]
    
    def save_model(self, filepath: str):
        """Save trained model to file."""
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'baseline_stats': self.baseline_stats,
            'config': self.config,
        }
        joblib.dump(model_data, filepath)
        logger.info(f"Saved anomaly detector to {filepath}")
    
    def load_model(self, filepath: str):
        """Load trained model from file."""
        model_data = joblib.load(filepath)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.baseline_stats = model_data.get('baseline_stats', {})
        self.config = model_data.get('config', AnomalyDetectorConfig())
        logger.info(f"Loaded anomaly detector from {filepath}")
