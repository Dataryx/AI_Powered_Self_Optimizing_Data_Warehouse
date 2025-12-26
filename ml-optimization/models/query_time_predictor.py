"""
Query Time Predictor
Predicts query execution time using machine learning models.
"""

import numpy as np
import pandas as pd
from sklearn.ensemble import GradientBoostingRegressor, RandomForestRegressor
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score
import xgboost as xgb
import joblib
import logging
from typing import Dict, List, Optional, Tuple
from pathlib import Path

from ml_optimization.config.model_config import QueryTimePredictorConfig

logger = logging.getLogger(__name__)


class QueryTimePredictor:
    """Predicts query execution time based on query features."""
    
    def __init__(self, config: Optional[QueryTimePredictorConfig] = None):
        """
        Initialize query time predictor.
        
        Args:
            config: Configuration for the predictor model
        """
        self.config = config or QueryTimePredictorConfig()
        self.model = None
        self.scaler = StandardScaler()
        self.feature_names = []
        self.feature_importance_ = None
    
    def _create_model(self):
        """Create model based on configuration."""
        if self.config.model_type == "xgboost":
            self.model = xgb.XGBRegressor(
                n_estimators=self.config.n_estimators,
                max_depth=self.config.max_depth,
                learning_rate=self.config.learning_rate,
                random_state=self.config.random_state,
                n_jobs=self.config.n_jobs,
            )
        elif self.config.model_type == "random_forest":
            self.model = RandomForestRegressor(
                n_estimators=self.config.n_estimators,
                max_depth=self.config.max_depth,
                min_samples_split=self.config.min_samples_split,
                min_samples_leaf=self.config.min_samples_leaf,
                random_state=self.config.random_state,
                n_jobs=self.config.n_jobs,
            )
        elif self.config.model_type == "gradient_boosting":
            self.model = GradientBoostingRegressor(
                n_estimators=self.config.n_estimators,
                max_depth=self.config.max_depth,
                learning_rate=self.config.learning_rate,
                min_samples_split=self.config.min_samples_split,
                min_samples_leaf=self.config.min_samples_leaf,
                random_state=self.config.random_state,
            )
        else:
            raise ValueError(f"Unsupported model type: {self.config.model_type}")
    
    def extract_features(self, query_logs: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """
        Extract features and target from query logs.
        
        Args:
            query_logs: DataFrame with query log data
            
        Returns:
            Tuple of (features DataFrame, target Series)
        """
        features = []
        targets = []
        
        for _, row in query_logs.iterrows():
            # Extract features from extracted_features JSONB
            extracted = row.get('extracted_features', {})
            if isinstance(extracted, str):
                import json
                extracted = json.loads(extracted)
            
            feature_vector = [
                extracted.get('table_count', 0),
                extracted.get('join_count', 0),
                extracted.get('has_aggregation', 0),
                extracted.get('has_window_function', 0),
                extracted.get('has_subquery', 0),
                extracted.get('has_cte', 0),
                extracted.get('filter_predicate_count', 0),
                extracted.get('order_by_count', 0),
                extracted.get('group_by_count', 0),
                np.log1p(extracted.get('estimated_rows', 0) or 0),
                np.log1p(extracted.get('estimated_cost', 0) or 0),
                extracted.get('plan_depth', 0) or 0,
                row.get('calls', 0),
            ]
            
            features.append(feature_vector)
            targets.append(row.get('mean_exec_time_ms', 0))
        
        feature_names = [
            'table_count', 'join_count', 'has_aggregation',
            'has_window_function', 'has_subquery', 'has_cte',
            'filter_predicate_count', 'order_by_count', 'group_by_count',
            'estimated_rows_log', 'estimated_cost_log', 'plan_depth',
            'calls',
        ]
        
        self.feature_names = feature_names
        features_df = pd.DataFrame(features, columns=feature_names)
        targets_series = pd.Series(targets)
        
        return features_df, targets_series
    
    def train(self, query_logs: pd.DataFrame) -> Dict:
        """
        Train the prediction model.
        
        Args:
            query_logs: DataFrame with query log data
            
        Returns:
            Dictionary with training metrics
        """
        # Extract features and targets
        X, y = self.extract_features(query_logs)
        
        if len(X) < self.config.min_samples_for_training:
            raise ValueError(f"Insufficient samples: {len(X)} < {self.config.min_samples_for_training}")
        
        # Split data
        X_train, X_test, y_train, y_test = train_test_split(
            X, y, test_size=0.2, random_state=self.config.random_state
        )
        
        # Scale features
        X_train_scaled = self.scaler.fit_transform(X_train)
        X_test_scaled = self.scaler.transform(X_test)
        
        # Create and train model
        self._create_model()
        self.model.fit(X_train_scaled, y_train)
        
        # Get feature importance
        if hasattr(self.model, 'feature_importances_'):
            self.feature_importance_ = dict(zip(self.feature_names, self.model.feature_importances_))
        
        # Evaluate model
        y_pred_train = self.model.predict(X_train_scaled)
        y_pred_test = self.model.predict(X_test_scaled)
        
        metrics = {
            'train_rmse': np.sqrt(mean_squared_error(y_train, y_pred_train)),
            'train_mae': mean_absolute_error(y_train, y_pred_train),
            'train_r2': r2_score(y_train, y_pred_train),
            'test_rmse': np.sqrt(mean_squared_error(y_test, y_pred_test)),
            'test_mae': mean_absolute_error(y_test, y_pred_test),
            'test_r2': r2_score(y_test, y_pred_test),
        }
        
        # Cross-validation
        cv_scores = cross_val_score(
            self.model, X_train_scaled, y_train,
            cv=5, scoring='neg_mean_squared_error'
        )
        metrics['cv_rmse'] = np.sqrt(-cv_scores.mean())
        metrics['cv_std'] = np.sqrt(cv_scores.std())
        
        logger.info(f"Model training completed. Test RMSE: {metrics['test_rmse']:.2f} ms")
        
        return metrics
    
    def predict(self, query_features: pd.DataFrame) -> np.ndarray:
        """
        Predict execution time for queries.
        
        Args:
            query_features: DataFrame with query features
            
        Returns:
            Array of predicted execution times
        """
        if self.model is None:
            raise ValueError("Model must be trained before prediction")
        
        # Ensure all required features are present
        for feature in self.feature_names:
            if feature not in query_features.columns:
                query_features[feature] = 0
        
        # Select and order features
        X = query_features[self.feature_names]
        
        # Scale features
        X_scaled = self.scaler.transform(X)
        
        # Predict
        predictions = self.model.predict(X_scaled)
        
        return predictions
    
    def explain_prediction(self, query_features: pd.DataFrame) -> Dict:
        """
        Explain prediction using feature importance.
        
        Args:
            query_features: DataFrame with query features
            
        Returns:
            Dictionary with feature contributions
        """
        if self.feature_importance_ is None:
            return {}
        
        # Get feature values
        feature_values = {}
        for feature in self.feature_names:
            if feature in query_features.columns:
                feature_values[feature] = float(query_features[feature].iloc[0])
        
        # Calculate contributions (simplified)
        contributions = {}
        for feature, importance in self.feature_importance_.items():
            if feature in feature_values:
                contributions[feature] = {
                    'value': feature_values[feature],
                    'importance': float(importance),
                }
        
        return contributions
    
    def save_model(self, filepath: str):
        """Save trained model to file."""
        model_data = {
            'model': self.model,
            'scaler': self.scaler,
            'config': self.config,
            'feature_names': self.feature_names,
            'feature_importance': self.feature_importance_,
        }
        joblib.dump(model_data, filepath)
        logger.info(f"Saved model to {filepath}")
    
    def load_model(self, filepath: str):
        """Load trained model from file."""
        model_data = joblib.load(filepath)
        self.model = model_data['model']
        self.scaler = model_data['scaler']
        self.config = model_data.get('config', QueryTimePredictorConfig())
        self.feature_names = model_data.get('feature_names', [])
        self.feature_importance_ = model_data.get('feature_importance')
        logger.info(f"Loaded model from {filepath}")


