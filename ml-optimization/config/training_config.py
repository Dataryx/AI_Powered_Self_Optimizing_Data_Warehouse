"""
Training Configuration
Configuration for model training pipelines.
"""

from dataclasses import dataclass
from typing import Dict, Optional


@dataclass
class TrainingConfig:
    """Configuration for model training."""
    train_test_split: float = 0.2
    validation_split: float = 0.1
    random_state: int = 42
    cross_validation_folds: int = 5
    n_jobs: int = -1
    
    # Early stopping
    early_stopping_rounds: int = 10
    early_stopping_metric: str = "loss"
    
    # Hyperparameter tuning
    n_iter: int = 50
    cv_folds: int = 3
    
    # Model selection
    scoring_metric: str = "neg_mean_squared_error"  # For regression
    scoring_metric_classification: str = "accuracy"  # For classification
    
    # Data requirements
    min_samples_for_training: int = 1000
    min_samples_per_class: int = 10  # For classification
    
    def to_dict(self) -> Dict:
        """Convert to dictionary."""
        return {
            "train_test_split": self.train_test_split,
            "validation_split": self.validation_split,
            "random_state": self.random_state,
            "cross_validation_folds": self.cross_validation_folds,
            "n_jobs": self.n_jobs,
            "early_stopping_rounds": self.early_stopping_rounds,
            "early_stopping_metric": self.early_stopping_metric,
            "n_iter": self.n_iter,
            "cv_folds": self.cv_folds,
            "scoring_metric": self.scoring_metric,
            "scoring_metric_classification": self.scoring_metric_classification,
            "min_samples_for_training": self.min_samples_for_training,
            "min_samples_per_class": self.min_samples_per_class,
        }


