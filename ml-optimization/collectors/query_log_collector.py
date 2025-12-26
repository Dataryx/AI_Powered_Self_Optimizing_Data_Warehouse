"""
Query Log Collector
Collects query execution statistics from PostgreSQL using pg_stat_statements.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from datetime import datetime, timedelta
import hashlib
import json
from typing import List, Dict, Optional
import logging

logger = logging.getLogger(__name__)


class QueryLogCollector:
    """Collects and processes query execution statistics from PostgreSQL."""
    
    def __init__(self, db_connection_string: str, schema: str = "ml_optimization"):
        """
        Initialize query log collector.
        
        Args:
            db_connection_string: PostgreSQL connection string
            schema: Schema to store collected metrics
        """
        self.db_conn_str = db_connection_string
        self.schema = schema
        self._ensure_schema_exists()
        self._ensure_table_exists()
    
    def _ensure_schema_exists(self):
        """Ensure the analytics schema exists."""
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor()
        cursor.execute(f"CREATE SCHEMA IF NOT EXISTS {self.schema}")
        conn.commit()
        cursor.close()
        conn.close()
    
    def _ensure_table_exists(self):
        """Create query_logs table if it doesn't exist."""
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor()
        
        create_table_sql = f"""
        CREATE TABLE IF NOT EXISTS {self.schema}.query_logs (
            log_id BIGSERIAL PRIMARY KEY,
            query_hash VARCHAR(64),
            query_text TEXT,
            query_template TEXT,
            calls BIGINT,
            total_exec_time_ms NUMERIC(15, 3),
            mean_exec_time_ms NUMERIC(15, 3),
            min_exec_time_ms NUMERIC(15, 3),
            max_exec_time_ms NUMERIC(15, 3),
            stddev_exec_time_ms NUMERIC(15, 3),
            rows_affected BIGINT,
            shared_blks_hit BIGINT,
            shared_blks_read BIGINT,
            shared_blks_dirtied BIGINT,
            shared_blks_written BIGINT,
            local_blks_hit BIGINT,
            local_blks_read BIGINT,
            local_blks_dirtied BIGINT,
            local_blks_written BIGINT,
            temp_blks_read BIGINT,
            temp_blks_written BIGINT,
            blk_read_time_ms NUMERIC(15, 3),
            blk_write_time_ms NUMERIC(15, 3),
            query_plan JSONB,
            extracted_features JSONB,
            collected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        );
        
        CREATE INDEX IF NOT EXISTS idx_query_logs_query_hash 
            ON {self.schema}.query_logs(query_hash);
        CREATE INDEX IF NOT EXISTS idx_query_logs_collected_at 
            ON {self.schema}.query_logs(collected_at);
        """
        
        cursor.execute(create_table_sql)
        conn.commit()
        cursor.close()
        conn.close()
    
    def collect_from_pg_stat_statements(self) -> List[Dict]:
        """
        Collect query statistics from pg_stat_statements.
        
        Returns:
            List of query statistics dictionaries
        """
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Check if pg_stat_statements extension is enabled
            cursor.execute("""
                SELECT COUNT(*) as count 
                FROM pg_extension 
                WHERE extname = 'pg_stat_statements'
            """)
            ext_check = cursor.fetchone()
            
            if ext_check['count'] == 0:
                logger.warning("pg_stat_statements extension not found. Attempting to create...")
                try:
                    cursor.execute("CREATE EXTENSION IF NOT EXISTS pg_stat_statements")
                    conn.commit()
                except Exception as e:
                    logger.error(f"Failed to create pg_stat_statements extension: {e}")
                    return []
            
            # Collect query statistics
            query = """
                SELECT 
                    queryid,
                    query,
                    calls,
                    total_exec_time as total_exec_time_ms,
                    mean_exec_time as mean_exec_time_ms,
                    min_exec_time as min_exec_time_ms,
                    max_exec_time as max_exec_time_ms,
                    stddev_exec_time as stddev_exec_time_ms,
                    rows,
                    shared_blks_hit,
                    shared_blks_read,
                    shared_blks_dirtied,
                    shared_blks_written,
                    local_blks_hit,
                    local_blks_read,
                    local_blks_dirtied,
                    local_blks_written,
                    temp_blks_read,
                    temp_blks_written,
                    blk_read_time as blk_read_time_ms,
                    blk_write_time as blk_write_time_ms
                FROM pg_stat_statements
                WHERE calls > 0
                ORDER BY total_exec_time DESC
                LIMIT 1000
            """
            
            cursor.execute(query)
            results = cursor.fetchall()
            
            # Convert to list of dictionaries
            query_stats = []
            for row in results:
                stats = dict(row)
                
                # Calculate rows_affected (rows * calls)
                stats['rows_affected'] = stats.get('rows', 0) * stats.get('calls', 0)
                
                # Generate query hash and template
                query_text = stats.get('query', '')
                stats['query_hash'] = self._hash_query(query_text)
                stats['query_template'] = self._normalize_query(query_text)
                
                query_stats.append(stats)
            
            return query_stats
            
        except Exception as e:
            logger.error(f"Error collecting query statistics: {e}")
            return []
        finally:
            cursor.close()
            conn.close()
    
    def parse_query_plan(self, query: str) -> Optional[Dict]:
        """
        Parse query execution plan using EXPLAIN.
        
        Args:
            query: SQL query string
            
        Returns:
            Query plan as dictionary or None
        """
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor()
        
        try:
            # Use EXPLAIN (FORMAT JSON) to get plan
            cursor.execute(f"EXPLAIN (FORMAT JSON) {query}")
            plan_result = cursor.fetchone()
            
            if plan_result and plan_result[0]:
                return plan_result[0][0] if isinstance(plan_result[0], list) else plan_result[0]
            
            return None
            
        except Exception as e:
            logger.warning(f"Failed to parse query plan for query: {e}")
            return None
        finally:
            cursor.close()
            conn.close()
    
    def extract_features(self, query: str, query_plan: Optional[Dict] = None) -> Dict:
        """
        Extract features from query and execution plan.
        
        Args:
            query: SQL query string
            query_plan: Optional query execution plan
            
        Returns:
            Dictionary of extracted features
        """
        features = {
            'query_type': self._extract_query_type(query),
            'table_count': self._count_tables(query),
            'join_count': self._count_joins(query),
            'has_aggregation': self._has_aggregation(query),
            'has_window_function': self._has_window_function(query),
            'has_subquery': self._has_subquery(query),
            'has_cte': self._has_cte(query),
            'filter_predicate_count': self._count_filter_predicates(query),
            'order_by_count': self._count_order_by(query),
            'group_by_count': self._count_group_by(query),
            'estimated_rows': None,
            'estimated_cost': None,
            'plan_depth': None,
        }
        
        # Extract features from query plan if available
        if query_plan:
            features['estimated_rows'] = query_plan.get('Plan', {}).get('Plan Rows')
            features['estimated_cost'] = query_plan.get('Plan', {}).get('Total Cost')
            features['plan_depth'] = self._calculate_plan_depth(query_plan.get('Plan', {}))
        
        return features
    
    def store_metrics(self, query_stats: List[Dict]) -> int:
        """
        Store collected metrics in the database.
        
        Args:
            query_stats: List of query statistics dictionaries
            
        Returns:
            Number of records stored
        """
        if not query_stats:
            return 0
        
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor()
        
        stored_count = 0
        
        try:
            insert_sql = f"""
                INSERT INTO {self.schema}.query_logs (
                    query_hash, query_text, query_template, calls,
                    total_exec_time_ms, mean_exec_time_ms, min_exec_time_ms,
                    max_exec_time_ms, stddev_exec_time_ms, rows_affected,
                    shared_blks_hit, shared_blks_read, shared_blks_dirtied,
                    shared_blks_written, local_blks_hit, local_blks_read,
                    local_blks_dirtied, local_blks_written, temp_blks_read,
                    temp_blks_written, blk_read_time_ms, blk_write_time_ms,
                    extracted_features
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s
                )
            """
            
            for stats in query_stats:
                query_text = stats.get('query', '')
                features = self.extract_features(query_text)
                
                cursor.execute(insert_sql, (
                    stats.get('query_hash'),
                    query_text,
                    stats.get('query_template'),
                    stats.get('calls', 0),
                    stats.get('total_exec_time_ms', 0),
                    stats.get('mean_exec_time_ms', 0),
                    stats.get('min_exec_time_ms', 0),
                    stats.get('max_exec_time_ms', 0),
                    stats.get('stddev_exec_time_ms', 0),
                    stats.get('rows_affected', 0),
                    stats.get('shared_blks_hit', 0),
                    stats.get('shared_blks_read', 0),
                    stats.get('shared_blks_dirtied', 0),
                    stats.get('shared_blks_written', 0),
                    stats.get('local_blks_hit', 0),
                    stats.get('local_blks_read', 0),
                    stats.get('local_blks_dirtied', 0),
                    stats.get('local_blks_written', 0),
                    stats.get('temp_blks_read', 0),
                    stats.get('temp_blks_written', 0),
                    stats.get('blk_read_time_ms', 0),
                    stats.get('blk_write_time_ms', 0),
                    json.dumps(features)
                ))
                stored_count += 1
            
            conn.commit()
            logger.info(f"Stored {stored_count} query log records")
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error storing query metrics: {e}")
        finally:
            cursor.close()
            conn.close()
        
        return stored_count
    
    def collect_and_store(self) -> int:
        """Collect query statistics and store in database."""
        query_stats = self.collect_from_pg_stat_statements()
        return self.store_metrics(query_stats)
    
    # Helper methods for query analysis
    def _hash_query(self, query: str) -> str:
        """Generate hash for query."""
        return hashlib.sha256(query.encode()).hexdigest()
    
    def _normalize_query(self, query: str) -> str:
        """Normalize query by replacing literals with placeholders."""
        # Simple normalization - replace string literals and numbers
        import re
        normalized = re.sub(r"'[^']*'", "'?'", query)
        normalized = re.sub(r'\b\d+\b', '?', normalized)
        normalized = ' '.join(normalized.split())  # Normalize whitespace
        return normalized
    
    def _extract_query_type(self, query: str) -> str:
        """Extract query type (SELECT, INSERT, UPDATE, DELETE)."""
        query_upper = query.strip().upper()
        for qtype in ['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'CREATE', 'ALTER', 'DROP']:
            if query_upper.startswith(qtype):
                return qtype
        return 'OTHER'
    
    def _count_tables(self, query: str) -> int:
        """Count number of tables in FROM/JOIN clauses."""
        # Simple heuristic - count FROM and JOIN keywords
        query_upper = query.upper()
        from_count = query_upper.count('FROM')
        join_count = query_upper.count('JOIN')
        return from_count + join_count
    
    def _count_joins(self, query: str) -> int:
        """Count number of JOIN clauses."""
        return query.upper().count('JOIN')
    
    def _has_aggregation(self, query: str) -> bool:
        """Check if query has aggregation functions."""
        agg_keywords = ['COUNT', 'SUM', 'AVG', 'MIN', 'MAX', 'GROUP BY']
        query_upper = query.upper()
        return any(keyword in query_upper for keyword in agg_keywords)
    
    def _has_window_function(self, query: str) -> bool:
        """Check if query has window functions."""
        return 'OVER (' in query.upper()
    
    def _has_subquery(self, query: str) -> bool:
        """Check if query has subqueries."""
        return '(' in query and 'SELECT' in query.upper()
    
    def _has_cte(self, query: str) -> bool:
        """Check if query has Common Table Expressions."""
        return 'WITH' in query.upper()
    
    def _count_filter_predicates(self, query: str) -> int:
        """Count WHERE clause predicates."""
        where_pos = query.upper().find('WHERE')
        if where_pos == -1:
            return 0
        where_clause = query[where_pos:]
        return where_clause.count('AND') + where_clause.count('OR') + 1
    
    def _count_order_by(self, query: str) -> int:
        """Count ORDER BY columns."""
        order_by_pos = query.upper().find('ORDER BY')
        if order_by_pos == -1:
            return 0
        order_clause = query[order_by_pos:order_by_pos+100]  # Limit search
        return order_clause.count(',') + 1
    
    def _count_group_by(self, query: str) -> int:
        """Count GROUP BY columns."""
        group_by_pos = query.upper().find('GROUP BY')
        if group_by_pos == -1:
            return 0
        group_clause = query[group_by_pos:group_by_pos+100]  # Limit search
        return group_clause.count(',') + 1
    
    def _calculate_plan_depth(self, plan: Dict, depth: int = 0) -> int:
        """Calculate depth of execution plan tree."""
        if 'Plans' not in plan:
            return depth
        max_depth = depth
        for subplan in plan['Plans']:
            sub_depth = self._calculate_plan_depth(subplan, depth + 1)
            max_depth = max(max_depth, sub_depth)
        return max_depth


