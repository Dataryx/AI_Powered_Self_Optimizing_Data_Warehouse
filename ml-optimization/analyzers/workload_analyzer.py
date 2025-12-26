"""
Workload Analyzer
Analyzes query patterns and workload characteristics.
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import json
import logging
from collections import Counter

logger = logging.getLogger(__name__)


class WorkloadAnalyzer:
    """Analyzes database workload patterns and characteristics."""
    
    def __init__(self, query_logs: pd.DataFrame):
        """
        Initialize workload analyzer.
        
        Args:
            query_logs: DataFrame with query log data
        """
        self.query_logs = query_logs
        self.patterns = {}
        self.classifications = {}
    
    def extract_query_features(self) -> pd.DataFrame:
        """
        Extract features from query logs.
        
        Returns:
            DataFrame with extracted features
        """
        if self.query_logs.empty:
            return pd.DataFrame()
        
        features = []
        
        for _, row in self.query_logs.iterrows():
            extracted = json.loads(row.get('extracted_features', '{}')) if isinstance(row.get('extracted_features'), str) else row.get('extracted_features', {})
            
            feature_row = {
                'query_hash': row.get('query_hash'),
                'query_type': extracted.get('query_type', 'UNKNOWN'),
                'table_count': extracted.get('table_count', 0),
                'join_count': extracted.get('join_count', 0),
                'has_aggregation': 1 if extracted.get('has_aggregation', False) else 0,
                'has_window_function': 1 if extracted.get('has_window_function', False) else 0,
                'has_subquery': 1 if extracted.get('has_subquery', False) else 0,
                'has_cte': 1 if extracted.get('has_cte', False) else 0,
                'filter_predicate_count': extracted.get('filter_predicate_count', 0),
                'order_by_count': extracted.get('order_by_count', 0),
                'group_by_count': extracted.get('group_by_count', 0),
                'estimated_rows': extracted.get('estimated_rows', 0) or 0,
                'estimated_cost': extracted.get('estimated_cost', 0) or 0,
                'plan_depth': extracted.get('plan_depth', 0) or 0,
                'mean_exec_time_ms': row.get('mean_exec_time_ms', 0),
                'calls': row.get('calls', 0),
                'total_exec_time_ms': row.get('total_exec_time_ms', 0),
            }
            
            features.append(feature_row)
        
        return pd.DataFrame(features)
    
    def identify_patterns(self) -> Dict:
        """
        Identify patterns in workload.
        
        Returns:
            Dictionary with identified patterns
        """
        if self.query_logs.empty:
            return {}
        
        patterns = {
            'time_based': self._analyze_time_patterns(),
            'query_type_distribution': self._analyze_query_types(),
            'tables_accessed': self._analyze_table_access(),
            'complexity_distribution': self._analyze_complexity(),
        }
        
        self.patterns = patterns
        return patterns
    
    def classify_workload(self) -> Dict:
        """
        Classify workload characteristics.
        
        Returns:
            Dictionary with workload classifications
        """
        features_df = self.extract_query_features()
        
        if features_df.empty:
            return {}
        
        classifications = {
            'oltp_vs_olap': self._classify_oltp_olap(features_df),
            'light_vs_heavy': self._classify_light_heavy(features_df),
            'ad_hoc_vs_scheduled': self._classify_ad_hoc_scheduled(),
        }
        
        self.classifications = classifications
        return classifications
    
    def _analyze_time_patterns(self) -> Dict:
        """Analyze time-based patterns (hourly, daily, weekly)."""
        if 'collected_at' not in self.query_logs.columns:
            return {}
        
        self.query_logs['collected_at'] = pd.to_datetime(self.query_logs['collected_at'])
        self.query_logs['hour'] = self.query_logs['collected_at'].dt.hour
        self.query_logs['day_of_week'] = self.query_logs['collected_at'].dt.dayofweek
        
        return {
            'hourly_distribution': self.query_logs.groupby('hour')['calls'].sum().to_dict(),
            'daily_distribution': self.query_logs.groupby('day_of_week')['calls'].sum().to_dict(),
        }
    
    def _analyze_query_types(self) -> Dict:
        """Analyze query type distribution."""
        features_df = self.extract_query_features()
        if features_df.empty:
            return {}
        
        return features_df['query_type'].value_counts().to_dict()
    
    def _analyze_table_access(self) -> Dict:
        """Analyze table access patterns."""
        # This would require parsing query_text to extract table names
        # Simplified version
        return {}
    
    def _analyze_complexity(self) -> Dict:
        """Analyze query complexity distribution."""
        features_df = self.extract_query_features()
        if features_df.empty:
            return {}
        
        features_df['complexity_score'] = (
            features_df['join_count'] * 2 +
            features_df['has_aggregation'] * 2 +
            features_df['has_subquery'] * 3 +
            features_df['has_window_function'] * 2 +
            features_df['filter_predicate_count'] * 0.5
        )
        
        return {
            'mean_complexity': float(features_df['complexity_score'].mean()),
            'median_complexity': float(features_df['complexity_score'].median()),
            'complexity_distribution': features_df['complexity_score'].describe().to_dict(),
        }
    
    def _classify_oltp_olap(self, features_df: pd.DataFrame) -> str:
        """Classify workload as OLTP or OLAP."""
        if features_df.empty:
            return 'UNKNOWN'
        
        olap_indicators = (
            features_df['has_aggregation'].sum() +
            features_df['has_window_function'].sum() +
            features_df['join_count'].sum()
        )
        
        oltp_indicators = (
            features_df[features_df['query_type'] == 'SELECT'].shape[0] +
            features_df[features_df['join_count'] == 0].shape[0]
        )
        
        if olap_indicators > oltp_indicators * 1.5:
            return 'OLAP'
        elif oltp_indicators > olap_indicators * 1.5:
            return 'OLTP'
        else:
            return 'MIXED'
    
    def _classify_light_heavy(self, features_df: pd.DataFrame) -> str:
        """Classify workload as light or heavy."""
        if features_df.empty:
            return 'UNKNOWN'
        
        avg_exec_time = features_df['mean_exec_time_ms'].mean()
        
        if avg_exec_time < 100:
            return 'LIGHT'
        elif avg_exec_time > 1000:
            return 'HEAVY'
        else:
            return 'MODERATE'
    
    def _classify_ad_hoc_scheduled(self) -> str:
        """Classify workload as ad-hoc or scheduled."""
        # This would require additional metadata about query sources
        # Simplified version assumes scheduled if calls are high
        if self.query_logs.empty:
            return 'UNKNOWN'
        
        avg_calls = self.query_logs['calls'].mean()
        if avg_calls > 100:
            return 'SCHEDULED'
        else:
            return 'AD_HOC'
    
    def get_summary(self) -> Dict:
        """Get comprehensive workload summary."""
        patterns = self.identify_patterns()
        classifications = self.classify_workload()
        features_df = self.extract_query_features()
        
        summary = {
            'total_queries': len(self.query_logs),
            'unique_query_templates': self.query_logs['query_hash'].nunique(),
            'patterns': patterns,
            'classifications': classifications,
            'statistics': {
                'avg_execution_time_ms': float(self.query_logs['mean_exec_time_ms'].mean()),
                'total_execution_time_ms': float(self.query_logs['total_exec_time_ms'].sum()),
                'avg_calls': float(self.query_logs['calls'].mean()),
            }
        }
        
        if not features_df.empty:
            summary['feature_statistics'] = features_df.describe().to_dict()
        
        return summary


