"""
Model Configuration
Defines configuration parameters for all ML models in the optimization engine.
"""

from dataclasses import dataclass
from typing import Dict, List, Optional
import os


@dataclass
class QueryTimePredictorConfig:
    """Configuration for query time prediction model."""
    model_type: str = "xgboost"  # xgboost, random_forest, gradient_boosting
    n_estimators: int = 100
    max_depth: int = 6
    learning_rate: float = 0.1
    min_samples_split: int = 2
    min_samples_leaf: int = 1
    random_state: int = 42
    n_jobs: int = -1
    feature_names: List[str] = None


@dataclass
class WorkloadClusteringConfig:
    """Configuration for workload clustering model."""
    algorithm: str = "kmeans"  # kmeans, dbscan, hierarchical
    n_clusters: int = 5
    random_state: int = 42
    n_init: int = 10
    max_iter: int = 300
    # DBSCAN parameters
    eps: float = 0.5
    min_samples: int = 5


@dataclass
class AnomalyDetectorConfig:
    """Configuration for anomaly detection model."""
    algorithm: str = "isolation_forest"  # isolation_forest, one_class_svm, local_outlier_factor
    contamination: float = 0.1  # Expected proportion of anomalies
    n_estimators: int = 100
    max_samples: int = 256
    random_state: int = 42
    n_jobs: int = -1


@dataclass
class CachePredictorConfig:
    """Configuration for cache prediction model."""
    model_type: str = "random_forest"
    n_estimators: int = 50
    max_depth: int = 10
    min_samples_split: int = 5
    random_state: int = 42
    cache_threshold: float = 0.7  # Probability threshold for caching
    ttl_default: int = 3600  # Default TTL in seconds


@dataclass
class RLResourceAllocatorConfig:
    """Configuration for RL-based resource allocator."""
    state_dim: int = 20
    action_dim: int = 5
    learning_rate: float = 0.001
    gamma: float = 0.95  # Discount factor
    epsilon_start: float = 1.0
    epsilon_end: float = 0.01
    epsilon_decay: float = 0.995
    batch_size: int = 64
    replay_buffer_size: int = 10000
    target_update_frequency: int = 100
    hidden_layers: List[int] = None  # Default: [128, 128]
    random_state: int = 42
    
    def __post_init__(self):
        if self.hidden_layers is None:
            self.hidden_layers = [128, 128]


@dataclass
class IndexAdvisorConfig:
    """Configuration for index advisor."""
    min_query_frequency: int = 10  # Minimum queries to consider index
    min_benefit_threshold: float = 0.15  # Minimum 15% improvement
    max_indexes_per_table: int = 10
    max_index_size_mb: int = 1024  # 1GB
    cost_benefit_ratio: float = 0.5  # Weight for cost in decision
    confidence_threshold: float = 0.7


@dataclass
class PartitionAdvisorConfig:
    """Configuration for partition advisor."""
    min_table_size_gb: float = 10.0  # Only consider partitioning large tables
    min_partition_size_mb: float = 100.0
    max_partitions: int = 100
    improvement_threshold: float = 0.20  # Minimum 20% improvement
    partition_types: List[str] = None  # Default: ["RANGE", "LIST", "HASH"]
    
    def __post_init__(self):
        if self.partition_types is None:
            self.partition_types = ["RANGE", "LIST", "HASH"]


@dataclass
class ModelConfig:
    """Main configuration container for all models."""
    query_time_predictor: QueryTimePredictorConfig = None
    workload_clustering: WorkloadClusteringConfig = None
    anomaly_detector: AnomalyDetectorConfig = None
    cache_predictor: CachePredictorConfig = None
    rl_resource_allocator: RLResourceAllocatorConfig = None
    index_advisor: IndexAdvisorConfig = None
    partition_advisor: PartitionAdvisorConfig = None
    
    # Model storage
    model_dir: str = "ml-optimization/saved_models"
    model_version: str = "1.0.0"
    
    # Training
    train_test_split: float = 0.2
    cross_validation_folds: int = 5
    
    # Retraining
    retrain_frequency_days: int = 7
    min_samples_for_training: int = 1000
    
    def __post_init__(self):
        if self.query_time_predictor is None:
            self.query_time_predictor = QueryTimePredictorConfig()
        if self.workload_clustering is None:
            self.workload_clustering = WorkloadClusteringConfig()
        if self.anomaly_detector is None:
            self.anomaly_detector = AnomalyDetectorConfig()
        if self.cache_predictor is None:
            self.cache_predictor = CachePredictorConfig()
        if self.rl_resource_allocator is None:
            self.rl_resource_allocator = RLResourceAllocatorConfig()
        if self.index_advisor is None:
            self.index_advisor = IndexAdvisorConfig()
        if self.partition_advisor is None:
            self.partition_advisor = PartitionAdvisorConfig()
        
        # Ensure model directory exists
        os.makedirs(self.model_dir, exist_ok=True)
    
    @classmethod
    def from_dict(cls, config_dict: Dict):
        """Create config from dictionary."""
        return cls(**config_dict)
    
    def to_dict(self) -> Dict:
        """Convert config to dictionary."""
        return {
            "model_dir": self.model_dir,
            "model_version": self.model_version,
            "train_test_split": self.train_test_split,
            "cross_validation_folds": self.cross_validation_folds,
            "retrain_frequency_days": self.retrain_frequency_days,
            "min_samples_for_training": self.min_samples_for_training,
        }


