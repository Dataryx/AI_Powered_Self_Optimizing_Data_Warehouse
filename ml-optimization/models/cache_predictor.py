"""
Cache Predictor
Predicts which queries should be cached based on access patterns.
"""

import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from datetime import datetime, timedelta
from typing import Dict, List, Optional
import logging

logger = logging.getLogger(__name__)


class CachePredictor:
    """Predicts cache probability for queries based on access patterns."""
    
    def __init__(self):
        """Initialize cache predictor."""
        self.model = RandomForestClassifier(n_estimators=50, max_depth=10, random_state=42)
        self.access_patterns = {}
        self.is_trained = False
    
    def track_access(self, query_template: str, timestamp: datetime, execution_time_ms: float):
        """
        Track query access pattern.
        
        Args:
            query_template: Normalized query template
            timestamp: Access timestamp
            execution_time_ms: Query execution time
        """
        if query_template not in self.access_patterns:
            self.access_patterns[query_template] = {
                'access_times': [],
                'execution_times': [],
                'last_access': None,
            }
        
        pattern = self.access_patterns[query_template]
        pattern['access_times'].append(timestamp)
        pattern['execution_times'].append(execution_time_ms)
        pattern['last_access'] = timestamp
        
        # Keep only recent accesses (last 1000)
        if len(pattern['access_times']) > 1000:
            pattern['access_times'] = pattern['access_times'][-1000:]
            pattern['execution_times'] = pattern['execution_times'][-1000:]
    
    def predict_cache_probability(self, query_template: str) -> float:
        """
        Predict probability that query should be cached.
        
        Args:
            query_template: Normalized query template
            
        Returns:
            Cache probability (0-1)
        """
        if query_template not in self.access_patterns:
            return 0.5  # Default probability
        
        pattern = self.access_patterns[query_template]
        
        # Simple heuristic: more frequent and slower queries should be cached
        frequency = len(pattern['access_times'])
        avg_exec_time = np.mean(pattern['execution_times']) if pattern['execution_times'] else 0
        
        # Normalize to probability
        freq_prob = min(frequency / 100.0, 1.0)  # More frequent = higher prob
        time_prob = min(avg_exec_time / 1000.0, 1.0)  # Slower = higher prob
        
        probability = (freq_prob * 0.6 + time_prob * 0.4)
        return min(probability, 1.0)
    
    def get_cache_candidates(self, threshold: float = 0.7) -> List[Dict]:
        """
        Get list of query templates that should be cached.
        
        Args:
            threshold: Minimum probability threshold
            
        Returns:
            List of cache candidate dictionaries
        """
        candidates = []
        
        for query_template, pattern in self.access_patterns.items():
            probability = self.predict_cache_probability(query_template)
            
            if probability >= threshold:
                candidates.append({
                    'query_template': query_template,
                    'probability': probability,
                    'access_count': len(pattern['access_times']),
                    'avg_execution_time_ms': np.mean(pattern['execution_times']),
                    'last_access': pattern['last_access'],
                })
        
        # Sort by probability descending
        candidates.sort(key=lambda x: x['probability'], reverse=True)
        return candidates
