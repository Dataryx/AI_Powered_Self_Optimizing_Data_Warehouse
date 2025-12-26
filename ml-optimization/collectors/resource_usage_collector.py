"""
Resource Usage Collector
Collects database resource usage metrics including table sizes, index sizes, cache hit ratios, and bloat analysis.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import json
import logging
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


class ResourceUsageCollector:
    """Collects database resource usage metrics."""
    
    def __init__(self, db_connection_string: str, schema: str = "ml_optimization"):
        """
        Initialize resource usage collector.
        
        Args:
            db_connection_string: PostgreSQL connection string
            schema: Schema to store collected metrics
        """
        self.db_conn_str = db_connection_string
        self.schema = schema
        self._ensure_table_exists()
    
    def _ensure_table_exists(self):
        """Create resource_usage table if it doesn't exist."""
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor()
        
        create_table_sql = f"""
        CREATE TABLE IF NOT EXISTS {self.schema}.resource_usage (
            usage_id BIGSERIAL PRIMARY KEY,
            resource_type VARCHAR(50),
            resource_name VARCHAR(255),
            schema_name VARCHAR(100),
            size_bytes BIGINT,
            cache_hit_ratio NUMERIC(5, 4),
            bloat_percent NUMERIC(5, 2),
            metadata JSONB,
            collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_resource_usage_type 
            ON {self.schema}.resource_usage(resource_type);
        CREATE INDEX IF NOT EXISTS idx_resource_usage_collected_at 
            ON {self.schema}.resource_usage(collected_at);
        """
        
        cursor.execute(create_table_sql)
        conn.commit()
        cursor.close()
        conn.close()
    
    def collect_table_sizes(self) -> List[Dict]:
        """Collect table sizes for all schemas."""
        metrics = []
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("""
                SELECT 
                    schemaname,
                    tablename,
                    pg_total_relation_size(schemaname||'.'||tablename) as total_size_bytes,
                    pg_relation_size(schemaname||'.'||tablename) as table_size_bytes,
                    pg_indexes_size(schemaname||'.'||tablename) as indexes_size_bytes
                FROM pg_tables
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                ORDER BY total_size_bytes DESC
            """)
            
            tables = cursor.fetchall()
            for table in tables:
                metrics.append({
                    'resource_type': 'table',
                    'resource_name': table['tablename'],
                    'schema_name': table['schemaname'],
                    'size_bytes': table['total_size_bytes'],
                    'cache_hit_ratio': None,
                    'bloat_percent': None,
                    'metadata': {
                        'table_size_bytes': table['table_size_bytes'],
                        'indexes_size_bytes': table['indexes_size_bytes']
                    }
                })
                
        except Exception as e:
            logger.error(f"Error collecting table sizes: {e}")
        finally:
            cursor.close()
            conn.close()
        
        return metrics
    
    def collect_index_sizes(self) -> List[Dict]:
        """Collect index sizes."""
        metrics = []
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("""
                SELECT 
                    schemaname,
                    tablename,
                    indexname,
                    pg_relation_size(indexrelid) as index_size_bytes
                FROM pg_indexes
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                ORDER BY index_size_bytes DESC
            """)
            
            indexes = cursor.fetchall()
            for index in indexes:
                metrics.append({
                    'resource_type': 'index',
                    'resource_name': index['indexname'],
                    'schema_name': index['schemaname'],
                    'size_bytes': index['index_size_bytes'],
                    'cache_hit_ratio': None,
                    'bloat_percent': None,
                    'metadata': {
                        'table_name': index['tablename']
                    }
                })
                
        except Exception as e:
            logger.error(f"Error collecting index sizes: {e}")
        finally:
            cursor.close()
            conn.close()
        
        return metrics
    
    def collect_cache_hit_ratios(self) -> List[Dict]:
        """Collect cache hit ratios for tables and indexes."""
        metrics = []
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Table cache hit ratios
            cursor.execute("""
                SELECT 
                    schemaname,
                    relname as tablename,
                    heap_blks_read + heap_blks_hit as total_reads,
                    heap_blks_hit,
                    CASE 
                        WHEN (heap_blks_read + heap_blks_hit) = 0 THEN 0
                        ELSE heap_blks_hit::float / (heap_blks_read + heap_blks_hit)
                    END as hit_ratio
                FROM pg_statio_user_tables
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                    AND (heap_blks_read + heap_blks_hit) > 0
            """)
            
            table_stats = cursor.fetchall()
            for stat in table_stats:
                metrics.append({
                    'resource_type': 'table_cache',
                    'resource_name': stat['tablename'],
                    'schema_name': stat['schemaname'],
                    'size_bytes': None,
                    'cache_hit_ratio': float(stat['hit_ratio']),
                    'bloat_percent': None,
                    'metadata': {
                        'total_reads': stat['total_reads'],
                        'cache_hits': stat['heap_blks_hit']
                    }
                })
            
            # Index cache hit ratios
            cursor.execute("""
                SELECT 
                    schemaname,
                    indexrelname as indexname,
                    idx_blks_read + idx_blks_hit as total_reads,
                    idx_blks_hit,
                    CASE 
                        WHEN (idx_blks_read + idx_blks_hit) = 0 THEN 0
                        ELSE idx_blks_hit::float / (idx_blks_read + idx_blks_hit)
                    END as hit_ratio
                FROM pg_statio_user_indexes
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                    AND (idx_blks_read + idx_blks_hit) > 0
            """)
            
            index_stats = cursor.fetchall()
            for stat in index_stats:
                metrics.append({
                    'resource_type': 'index_cache',
                    'resource_name': stat['indexname'],
                    'schema_name': stat['schemaname'],
                    'size_bytes': None,
                    'cache_hit_ratio': float(stat['hit_ratio']),
                    'bloat_percent': None,
                    'metadata': {
                        'total_reads': stat['total_reads'],
                        'cache_hits': stat['idx_blks_hit']
                    }
                })
                
        except Exception as e:
            logger.error(f"Error collecting cache hit ratios: {e}")
        finally:
            cursor.close()
            conn.close()
        
        return metrics
    
    def analyze_bloat(self, table_name: str, schema_name: str = 'public') -> Optional[float]:
        """
        Analyze table bloat percentage.
        
        Note: This is a simplified version. Full bloat analysis requires
        pgstattuple extension or more complex calculations.
        """
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Check if pgstattuple extension is available
            cursor.execute("""
                SELECT COUNT(*) as count 
                FROM pg_extension 
                WHERE extname = 'pgstattuple'
            """)
            
            ext_check = cursor.fetchone()
            if ext_check['count'] == 0:
                logger.warning("pgstattuple extension not available, skipping bloat analysis")
                return None
            
            # Get bloat statistics
            cursor.execute(f"""
                SELECT 
                    dead_tuple_percent,
                    free_percent
                FROM pgstattuple('{schema_name}.{table_name}')
            """)
            
            bloat_stats = cursor.fetchone()
            if bloat_stats:
                total_bloat = bloat_stats['dead_tuple_percent'] + bloat_stats['free_percent']
                return float(total_bloat)
            
        except Exception as e:
            logger.warning(f"Error analyzing bloat for {schema_name}.{table_name}: {e}")
        finally:
            cursor.close()
            conn.close()
        
        return None
    
    def collect_all_resources(self) -> List[Dict]:
        """Collect all resource usage metrics."""
        all_metrics = []
        
        all_metrics.extend(self.collect_table_sizes())
        all_metrics.extend(self.collect_index_sizes())
        all_metrics.extend(self.collect_cache_hit_ratios())
        
        # Add bloat analysis for large tables (sample)
        table_sizes = self.collect_table_sizes()
        for table in table_sizes[:10]:  # Analyze top 10 largest tables
            bloat = self.analyze_bloat(table['resource_name'], table['schema_name'])
            if bloat is not None:
                table['bloat_percent'] = bloat
        
        return all_metrics
    
    def store_metrics(self, metrics: List[Dict]) -> int:
        """Store collected metrics in database."""
        if not metrics:
            return 0
        
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor()
        
        stored_count = 0
        
        try:
            insert_sql = f"""
                INSERT INTO {self.schema}.resource_usage (
                    resource_type, resource_name, schema_name, size_bytes,
                    cache_hit_ratio, bloat_percent, metadata
                ) VALUES (%s, %s, %s, %s, %s, %s, %s)
            """
            
            for metric in metrics:
                cursor.execute(insert_sql, (
                    metric.get('resource_type'),
                    metric.get('resource_name'),
                    metric.get('schema_name'),
                    metric.get('size_bytes'),
                    metric.get('cache_hit_ratio'),
                    metric.get('bloat_percent'),
                    json.dumps(metric.get('metadata', {}))
                ))
                stored_count += 1
            
            conn.commit()
            logger.info(f"Stored {stored_count} resource usage records")
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error storing resource usage metrics: {e}")
        finally:
            cursor.close()
            conn.close()
        
        return stored_count
    
    def collect_and_store(self) -> int:
        """Collect all resource metrics and store in database."""
        metrics = self.collect_all_resources()
        return self.store_metrics(metrics)


