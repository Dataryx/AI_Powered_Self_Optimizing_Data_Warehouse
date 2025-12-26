"""
ETL Aggregators Package
Aggregates Silver layer data to Gold layer.
"""

from .silver_to_gold import SilverToGoldAggregator

__all__ = ['SilverToGoldAggregator']
