"""
Cache Manager
Manages query result caching with predictive caching capabilities.
"""

import redis
import hashlib
import json
import logging
from typing import Optional, Dict, Any
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class CacheManager:
    """Manages query result caching with Redis backend."""
    
    def __init__(self, redis_client: redis.Redis, predictor=None):
        """
        Initialize cache manager.
        
        Args:
            redis_client: Redis client instance
            predictor: Optional cache predictor for intelligent caching
        """
        self.cache = redis_client
        self.predictor = predictor
        self.cache_stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
        }
    
    def _generate_cache_key(self, query: str, params: Optional[Dict] = None) -> str:
        """Generate cache key for query."""
        query_str = query
        if params:
            query_str += json.dumps(params, sort_keys=True)
        return f"query:{hashlib.sha256(query_str.encode()).hexdigest()}"
    
    def should_cache(self, query: str, execution_time_ms: float) -> bool:
        """
        Determine if query result should be cached.
        
        Args:
            query: SQL query string
            execution_time_ms: Query execution time in milliseconds
            
        Returns:
            True if query should be cached
        """
        # Cache queries that take longer than 100ms
        if execution_time_ms < 100:
            return False
        
        # Use predictor if available
        if self.predictor:
            probability = self.predictor.predict_cache_probability(query)
            return probability > 0.7
        
        return True
    
    def get_cached(self, query: str, params: Optional[Dict] = None) -> Optional[Any]:
        """
        Get cached query result.
        
        Args:
            query: SQL query string
            params: Optional query parameters
            
        Returns:
            Cached result or None
        """
        cache_key = self._generate_cache_key(query, params)
        
        try:
            cached = self.cache.get(cache_key)
            if cached:
                self.cache_stats['hits'] += 1
                return json.loads(cached)
            else:
                self.cache_stats['misses'] += 1
                return None
        except Exception as e:
            logger.error(f"Error getting from cache: {e}")
            return None
    
    def cache_result(
        self,
        query: str,
        result: Any,
        ttl: int = 3600,
        params: Optional[Dict] = None
    ):
        """
        Cache query result.
        
        Args:
            query: SQL query string
            result: Query result to cache
            ttl: Time to live in seconds
            params: Optional query parameters
        """
        cache_key = self._generate_cache_key(query, params)
        
        try:
            cache_value = {
                'result': result,
                'cached_at': datetime.utcnow().isoformat(),
                'ttl': ttl,
            }
            self.cache.setex(
                cache_key,
                ttl,
                json.dumps(cache_value)
            )
            self.cache_stats['sets'] += 1
        except Exception as e:
            logger.error(f"Error caching result: {e}")
    
    def invalidate(self, query: str, params: Optional[Dict] = None):
        """Invalidate cached query result."""
        cache_key = self._generate_cache_key(query, params)
        try:
            self.cache.delete(cache_key)
        except Exception as e:
            logger.error(f"Error invalidating cache: {e}")
    
    def get_cache_effectiveness(self) -> Dict:
        """Get cache effectiveness metrics."""
        total = self.cache_stats['hits'] + self.cache_stats['misses']
        hit_rate = self.cache_stats['hits'] / total if total > 0 else 0
        
        return {
            'hit_rate': hit_rate,
            'hits': self.cache_stats['hits'],
            'misses': self.cache_stats['misses'],
            'total_requests': total,
            'cache_sets': self.cache_stats['sets'],
        }
    
    def clear_cache(self, pattern: str = "query:*"):
        """Clear cache entries matching pattern."""
        try:
            keys = self.cache.keys(pattern)
            if keys:
                self.cache.delete(*keys)
                logger.info(f"Cleared {len(keys)} cache entries")
        except Exception as e:
            logger.error(f"Error clearing cache: {e}")
