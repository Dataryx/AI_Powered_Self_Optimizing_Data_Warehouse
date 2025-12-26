"""
Performance Metrics Collector
Collects system performance metrics including CPU, memory, disk I/O, and connection statistics.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime
import json
import logging
from typing import Dict, List, Optional
import platform

logger = logging.getLogger(__name__)


class PerformanceMetricsCollector:
    """Collects PostgreSQL and system performance metrics."""
    
    def __init__(self, db_connection_string: str, schema: str = "ml_optimization"):
        """
        Initialize performance metrics collector.
        
        Args:
            db_connection_string: PostgreSQL connection string
            schema: Schema to store collected metrics
        """
        self.db_conn_str = db_connection_string
        self.schema = schema
        self._ensure_table_exists()
    
    def _ensure_table_exists(self):
        """Create performance_metrics table if it doesn't exist."""
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor()
        
        create_table_sql = f"""
        CREATE TABLE IF NOT EXISTS {self.schema}.performance_metrics (
            metric_id BIGSERIAL PRIMARY KEY,
            metric_type VARCHAR(50),
            metric_name VARCHAR(100),
            metric_value NUMERIC(15, 3),
            metric_unit VARCHAR(20),
            metadata JSONB,
            collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_perf_metrics_type 
            ON {self.schema}.performance_metrics(metric_type);
        CREATE INDEX IF NOT EXISTS idx_perf_metrics_collected_at 
            ON {self.schema}.performance_metrics(collected_at);
        """
        
        cursor.execute(create_table_sql)
        conn.commit()
        cursor.close()
        conn.close()
    
    def collect_cpu_utilization(self) -> List[Dict]:
        """Collect CPU utilization metrics."""
        metrics = []
        
        try:
            if platform.system() == "Windows":
                import psutil
                cpu_percent = psutil.cpu_percent(interval=1)
                cpu_count = psutil.cpu_count()
                
                metrics.append({
                    'metric_type': 'cpu',
                    'metric_name': 'cpu_percent',
                    'metric_value': cpu_percent,
                    'metric_unit': 'percent',
                    'metadata': {'cpu_count': cpu_count}
                })
            else:
                # Try to get CPU stats from PostgreSQL if running in container
                # Otherwise, this would need psutil or similar
                metrics.append({
                    'metric_type': 'cpu',
                    'metric_name': 'cpu_percent',
                    'metric_value': 0.0,  # Placeholder
                    'metric_unit': 'percent',
                    'metadata': {}
                })
        except ImportError:
            logger.warning("psutil not available, skipping CPU metrics")
        
        return metrics
    
    def collect_memory_usage(self) -> List[Dict]:
        """Collect memory usage metrics."""
        metrics = []
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Get PostgreSQL memory settings and usage
            cursor.execute("""
                SELECT 
                    setting::bigint as shared_buffers,
                    (SELECT setting::bigint FROM pg_settings WHERE name = 'effective_cache_size') as effective_cache_size,
                    (SELECT setting::bigint FROM pg_settings WHERE name = 'work_mem') as work_mem
                FROM pg_settings 
                WHERE name = 'shared_buffers'
            """)
            
            settings = cursor.fetchone()
            
            if settings:
                metrics.append({
                    'metric_type': 'memory',
                    'metric_name': 'shared_buffers_bytes',
                    'metric_value': settings['shared_buffers'],
                    'metric_unit': 'bytes',
                    'metadata': {}
                })
                
                metrics.append({
                    'metric_type': 'memory',
                    'metric_name': 'effective_cache_size_bytes',
                    'metric_value': settings.get('effective_cache_size', 0),
                    'metric_unit': 'bytes',
                    'metadata': {}
                })
            
            # Get cache hit ratio
            cursor.execute("""
                SELECT 
                    sum(heap_blks_read) as disk_reads,
                    sum(heap_blks_hit) as cache_hits,
                    CASE 
                        WHEN sum(heap_blks_hit) = 0 THEN 0
                        ELSE sum(heap_blks_hit)::float / (sum(heap_blks_hit) + sum(heap_blks_read))
                    END as hit_ratio
                FROM pg_statio_user_tables
            """)
            
            cache_stats = cursor.fetchone()
            if cache_stats:
                metrics.append({
                    'metric_type': 'memory',
                    'metric_name': 'cache_hit_ratio',
                    'metric_value': float(cache_stats['hit_ratio']) * 100,
                    'metric_unit': 'percent',
                    'metadata': {
                        'disk_reads': cache_stats['disk_reads'],
                        'cache_hits': cache_stats['cache_hits']
                    }
                })
                
        except Exception as e:
            logger.error(f"Error collecting memory metrics: {e}")
        finally:
            cursor.close()
            conn.close()
        
        return metrics
    
    def collect_disk_io(self) -> List[Dict]:
        """Collect disk I/O metrics."""
        metrics = []
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Get database size
            cursor.execute("""
                SELECT 
                    pg_database.datname,
                    pg_database_size(pg_database.datname) as size_bytes
                FROM pg_database
                WHERE datname = current_database()
            """)
            
            db_size = cursor.fetchone()
            if db_size:
                metrics.append({
                    'metric_type': 'disk',
                    'metric_name': 'database_size_bytes',
                    'metric_value': db_size['size_bytes'],
                    'metric_unit': 'bytes',
                    'metadata': {'database': db_size['datname']}
                })
            
            # Get table sizes
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
                LIMIT 20
            """)
            
            table_sizes = cursor.fetchall()
            for table in table_sizes:
                metrics.append({
                    'metric_type': 'disk',
                    'metric_name': 'table_size_bytes',
                    'metric_value': table['total_size_bytes'],
                    'metric_unit': 'bytes',
                    'metadata': {
                        'schema': table['schemaname'],
                        'table': table['tablename'],
                        'table_size': table['table_size_bytes'],
                        'indexes_size': table['indexes_size_bytes']
                    }
                })
                
        except Exception as e:
            logger.error(f"Error collecting disk I/O metrics: {e}")
        finally:
            cursor.close()
            conn.close()
        
        return metrics
    
    def collect_connection_stats(self) -> List[Dict]:
        """Collect connection statistics."""
        metrics = []
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Get current connection count
            cursor.execute("""
                SELECT 
                    count(*) as active_connections,
                    (SELECT setting::int FROM pg_settings WHERE name = 'max_connections') as max_connections
                FROM pg_stat_activity
                WHERE datname = current_database()
            """)
            
            conn_stats = cursor.fetchone()
            if conn_stats:
                metrics.append({
                    'metric_type': 'connection',
                    'metric_name': 'active_connections',
                    'metric_value': conn_stats['active_connections'],
                    'metric_unit': 'count',
                    'metadata': {
                        'max_connections': conn_stats['max_connections'],
                        'utilization_percent': (conn_stats['active_connections'] / conn_stats['max_connections']) * 100
                    }
                })
            
            # Get connection states
            cursor.execute("""
                SELECT 
                    state,
                    count(*) as count
                FROM pg_stat_activity
                WHERE datname = current_database()
                GROUP BY state
            """)
            
            states = cursor.fetchall()
            for state in states:
                metrics.append({
                    'metric_type': 'connection',
                    'metric_name': f'connections_{state["state"]}',
                    'metric_value': state['count'],
                    'metric_unit': 'count',
                    'metadata': {'state': state['state']}
                })
                
        except Exception as e:
            logger.error(f"Error collecting connection stats: {e}")
        finally:
            cursor.close()
            conn.close()
        
        return metrics
    
    def collect_lock_statistics(self) -> List[Dict]:
        """Collect lock statistics."""
        metrics = []
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Get lock counts by mode
            cursor.execute("""
                SELECT 
                    mode,
                    count(*) as count
                FROM pg_locks
                WHERE database = (SELECT oid FROM pg_database WHERE datname = current_database())
                GROUP BY mode
            """)
            
            locks = cursor.fetchall()
            for lock in locks:
                metrics.append({
                    'metric_type': 'lock',
                    'metric_name': f'locks_{lock["mode"]}',
                    'metric_value': lock['count'],
                    'metric_unit': 'count',
                    'metadata': {'mode': lock['mode']}
                })
            
            # Get blocking queries
            cursor.execute("""
                SELECT count(*) as blocking_queries
                FROM pg_locks blocked_locks
                JOIN pg_stat_activity blocking_activity ON blocking_activity.pid = blocked_locks.pid
                JOIN pg_locks blocking_locks ON blocking_locks.locktype = blocked_locks.locktype
                    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
                    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
                JOIN pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
                WHERE NOT blocked_locks.granted
            """)
            
            blocking = cursor.fetchone()
            if blocking:
                metrics.append({
                    'metric_type': 'lock',
                    'metric_name': 'blocking_queries',
                    'metric_value': blocking['blocking_queries'],
                    'metric_unit': 'count',
                    'metadata': {}
                })
                
        except Exception as e:
            logger.error(f"Error collecting lock statistics: {e}")
        finally:
            cursor.close()
            conn.close()
        
        return metrics
    
    def collect_all_metrics(self) -> List[Dict]:
        """Collect all performance metrics."""
        all_metrics = []
        
        all_metrics.extend(self.collect_cpu_utilization())
        all_metrics.extend(self.collect_memory_usage())
        all_metrics.extend(self.collect_disk_io())
        all_metrics.extend(self.collect_connection_stats())
        all_metrics.extend(self.collect_lock_statistics())
        
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
                INSERT INTO {self.schema}.performance_metrics (
                    metric_type, metric_name, metric_value, metric_unit, metadata
                ) VALUES (%s, %s, %s, %s, %s)
            """
            
            for metric in metrics:
                cursor.execute(insert_sql, (
                    metric.get('metric_type'),
                    metric.get('metric_name'),
                    metric.get('metric_value'),
                    metric.get('metric_unit'),
                    json.dumps(metric.get('metadata', {}))
                ))
                stored_count += 1
            
            conn.commit()
            logger.info(f"Stored {stored_count} performance metrics")
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error storing performance metrics: {e}")
        finally:
            cursor.close()
            conn.close()
        
        return stored_count
    
    def collect_and_store(self) -> int:
        """Collect all metrics and store in database."""
        metrics = self.collect_all_metrics()
        return self.store_metrics(metrics)


