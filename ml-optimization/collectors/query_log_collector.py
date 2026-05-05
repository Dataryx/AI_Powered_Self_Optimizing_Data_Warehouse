"""
Query Log Collector
Collects query execution statistics from PostgreSQL using pg_stat_statements.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2.extras import execute_batch
from datetime import datetime, timedelta
import hashlib
import json
from typing import List, Dict, Optional, Tuple
import logging
import random

logger = logging.getLogger(__name__)


class QueryLogCollector:
    """Collects and processes query execution statistics from PostgreSQL."""
    
    def __init__(
        self,
        db_connection_string: str,
        schema: str = "ml_optimization",
        dashboard_only: bool = False,
        min_mean_exec_time_ms: float = 0.0,
        min_total_exec_time_ms: float = 0.0,
    ):
        """
        Initialize query log collector.
        
        Args:
            db_connection_string: PostgreSQL connection string
            schema: Schema to store collected metrics
            dashboard_only: If True, keep only SQL matching warehouse/dashboard heuristics (default False = all statements).
            min_mean_exec_time_ms: Only collect pg_stat_statements rows with mean_exec_time >= this (0 = no filter)
            min_total_exec_time_ms: Only collect rows with total_exec_time >= this (0 = no filter)
        """
        self.db_conn_str = db_connection_string
        self.schema = schema
        self.dashboard_only = dashboard_only
        self.min_mean_exec_time_ms = float(min_mean_exec_time_ms or 0)
        self.min_total_exec_time_ms = float(min_total_exec_time_ms or 0)
        self._ensure_schema_exists()
        self._ensure_table_exists()
        self._ensure_state_table_exists()
    
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

    def _ensure_state_table_exists(self):
        """
        Tracks last-seen cumulative pg_stat_statements counters to store only deltas
        (newly observed workload) into query_logs.
        """
        conn = psycopg2.connect(self.db_conn_str)
        cursor = conn.cursor()
        cursor.execute(
            f"""
            CREATE TABLE IF NOT EXISTS {self.schema}.query_log_collection_state (
                queryid BIGINT PRIMARY KEY,
                last_calls BIGINT NOT NULL DEFAULT 0,
                last_total_exec_time_ms NUMERIC(20, 3) NOT NULL DEFAULT 0,
                last_rows BIGINT NOT NULL DEFAULT 0,
                last_shared_blks_hit BIGINT NOT NULL DEFAULT 0,
                last_shared_blks_read BIGINT NOT NULL DEFAULT 0,
                last_shared_blks_dirtied BIGINT NOT NULL DEFAULT 0,
                last_shared_blks_written BIGINT NOT NULL DEFAULT 0,
                last_local_blks_hit BIGINT NOT NULL DEFAULT 0,
                last_local_blks_read BIGINT NOT NULL DEFAULT 0,
                last_local_blks_dirtied BIGINT NOT NULL DEFAULT 0,
                last_local_blks_written BIGINT NOT NULL DEFAULT 0,
                last_temp_blks_read BIGINT NOT NULL DEFAULT 0,
                last_temp_blks_written BIGINT NOT NULL DEFAULT 0,
                last_blk_read_time_ms NUMERIC(20, 3) NOT NULL DEFAULT 0,
                last_blk_write_time_ms NUMERIC(20, 3) NOT NULL DEFAULT 0,
                last_seen_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            """
        )
        # In case the state table already exists without the new columns,
        # add them to keep backward compatibility.
        cursor.execute(
            f"""
            DO $$
            BEGIN
              IF NOT EXISTS (
                SELECT 1 FROM information_schema.columns
                WHERE table_schema = '{self.schema}' AND table_name = 'query_log_collection_state'
                  AND column_name = 'last_shared_blks_hit'
              ) THEN
                ALTER TABLE {self.schema}.query_log_collection_state
                  ADD COLUMN last_shared_blks_hit BIGINT NOT NULL DEFAULT 0,
                  ADD COLUMN last_shared_blks_read BIGINT NOT NULL DEFAULT 0,
                  ADD COLUMN last_shared_blks_dirtied BIGINT NOT NULL DEFAULT 0,
                  ADD COLUMN last_shared_blks_written BIGINT NOT NULL DEFAULT 0,
                  ADD COLUMN last_local_blks_hit BIGINT NOT NULL DEFAULT 0,
                  ADD COLUMN last_local_blks_read BIGINT NOT NULL DEFAULT 0,
                  ADD COLUMN last_local_blks_dirtied BIGINT NOT NULL DEFAULT 0,
                  ADD COLUMN last_local_blks_written BIGINT NOT NULL DEFAULT 0,
                  ADD COLUMN last_temp_blks_read BIGINT NOT NULL DEFAULT 0,
                  ADD COLUMN last_temp_blks_written BIGINT NOT NULL DEFAULT 0,
                  ADD COLUMN last_blk_read_time_ms NUMERIC(20, 3) NOT NULL DEFAULT 0,
                  ADD COLUMN last_blk_write_time_ms NUMERIC(20, 3) NOT NULL DEFAULT 0;
              END IF;
            END $$;
            """
        )
        conn.commit()
        cursor.close()
        conn.close()

    def _is_dashboard_query(self, query: str) -> bool:
        """Heuristic filter to keep dashboard-related SQL only."""
        q = (query or "").lower()
        if not q:
            return False
        dashboard_markers = [
            "gold.", "silver.", "bronze.", "monitoring.",
            "pg_stat_user_tables", "pg_statio_user_tables", "pg_tables",
            "pg_total_relation_size", "pg_relation_size", "pg_database_size",
            "pg_stat_activity",
        ]
        return any(m in q for m in dashboard_markers)
    
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
            
            # Collect query statistics (optional filters for "heavy" / slow queries)
            where_parts = ["calls > 0"]
            params: List = []
            if self.min_mean_exec_time_ms > 0:
                where_parts.append("mean_exec_time >= %s")
                params.append(self.min_mean_exec_time_ms)
            if self.min_total_exec_time_ms > 0:
                where_parts.append("total_exec_time >= %s")
                params.append(self.min_total_exec_time_ms)
            where_sql = " AND ".join(where_parts)
            if self.min_mean_exec_time_ms > 0:
                order_sql = "ORDER BY mean_exec_time DESC, total_exec_time DESC"
            else:
                order_sql = "ORDER BY total_exec_time DESC"
            if self.min_mean_exec_time_ms > 0 or self.min_total_exec_time_ms > 0:
                limit_n = 10000
            elif self.dashboard_only:
                limit_n = 5000
            else:
                limit_n = 12000

            query = f"""
                SELECT 
                    queryid::bigint as queryid,
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
                WHERE {where_sql}
                {order_sql}
                LIMIT %s
            """
            params.append(limit_n)
            cursor.execute(query, tuple(params))
            results = cursor.fetchall()
            
            # Convert to list of dictionaries
            query_stats = []
            for row in results:
                stats = dict(row)
                
                # Keep only dashboard workload if requested
                query_text = stats.get('query', '')
                if self.dashboard_only and not self._is_dashboard_query(query_text):
                    continue

                # pg_stat_statements.rows is cumulative rows produced across calls
                stats['rows_affected'] = stats.get('rows', 0) or 0
                
                # Generate query hash and template
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
    
    def store_metrics(self, query_stats: List[Dict], force_snapshot: bool = False) -> int:
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
        values_to_insert: List[Tuple] = []
        state_updates: List[Tuple] = []
        
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
                    query_plan, extracted_features
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                    %s, %s, %s, %s
                )
            """

            # Load last-seen counters (for deltas)
            cursor.execute(
                f"""
                SELECT queryid, last_calls, last_total_exec_time_ms, last_rows
                FROM {self.schema}.query_log_collection_state
                """
            )
            state_map = {
                int(r[0]): {
                    "last_calls": int(r[1] or 0),
                    "last_total_exec_time_ms": float(r[2] or 0.0),
                    "last_rows": int(r[3] or 0),
                }
                for r in cursor.fetchall()
            }

            # Backfill missing state keys with zeros if older rows exist.
            # We still need the extra block counters for correct deltas.
            cursor.execute(
                f"""
                SELECT
                  queryid,
                  last_calls, last_total_exec_time_ms, last_rows,
                  last_shared_blks_hit, last_shared_blks_read, last_shared_blks_dirtied, last_shared_blks_written,
                  last_local_blks_hit, last_local_blks_read, last_local_blks_dirtied, last_local_blks_written,
                  last_temp_blks_read, last_temp_blks_written,
                  last_blk_read_time_ms, last_blk_write_time_ms
                FROM {self.schema}.query_log_collection_state
                """
            )
            state_map = {
                int(r[0]): {
                    "last_calls": int(r[1] or 0),
                    "last_total_exec_time_ms": float(r[2] or 0.0),
                    "last_rows": int(r[3] or 0),
                    "last_shared_blks_hit": int(r[4] or 0),
                    "last_shared_blks_read": int(r[5] or 0),
                    "last_shared_blks_dirtied": int(r[6] or 0),
                    "last_shared_blks_written": int(r[7] or 0),
                    "last_local_blks_hit": int(r[8] or 0),
                    "last_local_blks_read": int(r[9] or 0),
                    "last_local_blks_dirtied": int(r[10] or 0),
                    "last_local_blks_written": int(r[11] or 0),
                    "last_temp_blks_read": int(r[12] or 0),
                    "last_temp_blks_written": int(r[13] or 0),
                    "last_blk_read_time_ms": float(r[14] or 0.0),
                    "last_blk_write_time_ms": float(r[15] or 0.0),
                }
                for r in cursor.fetchall()
            }

            # Speed knobs:
            # - batch inserts always
            # - optionally expand delta_calls into multiple rows
            expand_calls = False
            max_rows_per_queryid = 0
            # Allow "passed-in" config via instance attributes (set by caller).
            if hasattr(self, "expand_calls_enabled"):
                expand_calls = bool(getattr(self, "expand_calls_enabled"))
            if hasattr(self, "expand_calls_max_rows_per_queryid"):
                max_rows_per_queryid = int(getattr(self, "expand_calls_max_rows_per_queryid") or 0)

            # Keep `query_plan` non-empty for every training row.
            query_plan_json = json.dumps({})

            for stats in query_stats:
                query_text = stats.get('query', '')
                qid = int(stats.get('queryid') or 0)
                if qid <= 0:
                    continue

                curr_calls = int(stats.get('calls', 0) or 0)
                curr_total_ms = float(stats.get('total_exec_time_ms', 0) or 0.0)
                curr_rows = int(stats.get('rows_affected', 0) or 0)

                # Block counters are cumulative in pg_stat_statements.
                curr_shared_blks_hit = int(stats.get('shared_blks_hit', 0) or 0)
                curr_shared_blks_read = int(stats.get('shared_blks_read', 0) or 0)
                curr_shared_blks_dirtied = int(stats.get('shared_blks_dirtied', 0) or 0)
                curr_shared_blks_written = int(stats.get('shared_blks_written', 0) or 0)

                curr_local_blks_hit = int(stats.get('local_blks_hit', 0) or 0)
                curr_local_blks_read = int(stats.get('local_blks_read', 0) or 0)
                curr_local_blks_dirtied = int(stats.get('local_blks_dirtied', 0) or 0)
                curr_local_blks_written = int(stats.get('local_blks_written', 0) or 0)

                curr_temp_blks_read = int(stats.get('temp_blks_read', 0) or 0)
                curr_temp_blks_written = int(stats.get('temp_blks_written', 0) or 0)

                curr_blk_read_time_ms = float(stats.get('blk_read_time_ms', 0) or 0.0)
                curr_blk_write_time_ms = float(stats.get('blk_write_time_ms', 0) or 0.0)

                prev = state_map.get(qid, {"last_calls": 0, "last_total_exec_time_ms": 0.0, "last_rows": 0})
                if force_snapshot:
                    # Bootstrap mode: load current cumulative stats as-is.
                    delta_calls = curr_calls
                    delta_total_ms = curr_total_ms
                    delta_rows = curr_rows
                    delta_shared_blks_hit = curr_shared_blks_hit
                    delta_shared_blks_read = curr_shared_blks_read
                    delta_shared_blks_dirtied = curr_shared_blks_dirtied
                    delta_shared_blks_written = curr_shared_blks_written
                    delta_local_blks_hit = curr_local_blks_hit
                    delta_local_blks_read = curr_local_blks_read
                    delta_local_blks_dirtied = curr_local_blks_dirtied
                    delta_local_blks_written = curr_local_blks_written
                    delta_temp_blks_read = curr_temp_blks_read
                    delta_temp_blks_written = curr_temp_blks_written
                    delta_blk_read_time_ms = curr_blk_read_time_ms
                    delta_blk_write_time_ms = curr_blk_write_time_ms
                else:
                    delta_calls = max(0, curr_calls - prev["last_calls"])
                    delta_total_ms = max(0.0, curr_total_ms - prev["last_total_exec_time_ms"])
                    delta_rows = max(0, curr_rows - prev["last_rows"])
                    delta_shared_blks_hit = max(0, curr_shared_blks_hit - prev.get("last_shared_blks_hit", 0))
                    delta_shared_blks_read = max(0, curr_shared_blks_read - prev.get("last_shared_blks_read", 0))
                    delta_shared_blks_dirtied = max(0, curr_shared_blks_dirtied - prev.get("last_shared_blks_dirtied", 0))
                    delta_shared_blks_written = max(0, curr_shared_blks_written - prev.get("last_shared_blks_written", 0))
                    delta_local_blks_hit = max(0, curr_local_blks_hit - prev.get("last_local_blks_hit", 0))
                    delta_local_blks_read = max(0, curr_local_blks_read - prev.get("last_local_blks_read", 0))
                    delta_local_blks_dirtied = max(0, curr_local_blks_dirtied - prev.get("last_local_blks_dirtied", 0))
                    delta_local_blks_written = max(0, curr_local_blks_written - prev.get("last_local_blks_written", 0))
                    delta_temp_blks_read = max(0, curr_temp_blks_read - prev.get("last_temp_blks_read", 0))
                    delta_temp_blks_written = max(0, curr_temp_blks_written - prev.get("last_temp_blks_written", 0))
                    delta_blk_read_time_ms = max(0.0, curr_blk_read_time_ms - prev.get("last_blk_read_time_ms", 0.0))
                    delta_blk_write_time_ms = max(0.0, curr_blk_write_time_ms - prev.get("last_blk_write_time_ms", 0.0))

                # Skip unchanged query stats (prevents duplicate snapshots every run)
                if delta_calls <= 0:
                    # Update state anyway if counters were reset (e.g. pg_stat_statements_reset)
                    if curr_calls < prev["last_calls"] or curr_total_ms < prev["last_total_exec_time_ms"]:
                        cursor.execute(
                            f"""
                            INSERT INTO {self.schema}.query_log_collection_state
                                (
                                  queryid,
                                  last_calls, last_total_exec_time_ms, last_rows,
                                  last_shared_blks_hit, last_shared_blks_read, last_shared_blks_dirtied, last_shared_blks_written,
                                  last_local_blks_hit, last_local_blks_read, last_local_blks_dirtied, last_local_blks_written,
                                  last_temp_blks_read, last_temp_blks_written,
                                  last_blk_read_time_ms, last_blk_write_time_ms,
                                  last_seen_at
                                )
                            VALUES (%s, %s, %s, %s,
                                    %s, %s, %s, %s,
                                    %s, %s, %s, %s,
                                    %s, %s,
                                    %s, %s,
                                    CURRENT_TIMESTAMP)
                            ON CONFLICT (queryid) DO UPDATE SET
                                last_calls = EXCLUDED.last_calls,
                                last_total_exec_time_ms = EXCLUDED.last_total_exec_time_ms,
                              last_rows = EXCLUDED.last_rows,
                              last_shared_blks_hit = EXCLUDED.last_shared_blks_hit,
                              last_shared_blks_read = EXCLUDED.last_shared_blks_read,
                              last_shared_blks_dirtied = EXCLUDED.last_shared_blks_dirtied,
                              last_shared_blks_written = EXCLUDED.last_shared_blks_written,
                              last_local_blks_hit = EXCLUDED.last_local_blks_hit,
                              last_local_blks_read = EXCLUDED.last_local_blks_read,
                              last_local_blks_dirtied = EXCLUDED.last_local_blks_dirtied,
                              last_local_blks_written = EXCLUDED.last_local_blks_written,
                              last_temp_blks_read = EXCLUDED.last_temp_blks_read,
                              last_temp_blks_written = EXCLUDED.last_temp_blks_written,
                              last_blk_read_time_ms = EXCLUDED.last_blk_read_time_ms,
                              last_blk_write_time_ms = EXCLUDED.last_blk_write_time_ms,
                              last_seen_at = CURRENT_TIMESTAMP
                            """,
                            (
                                qid,
                                curr_calls,
                                curr_total_ms,
                                curr_rows,
                                curr_shared_blks_hit,
                                curr_shared_blks_read,
                                curr_shared_blks_dirtied,
                                curr_shared_blks_written,
                                curr_local_blks_hit,
                                curr_local_blks_read,
                                curr_local_blks_dirtied,
                                curr_local_blks_written,
                                curr_temp_blks_read,
                                curr_temp_blks_written,
                                curr_blk_read_time_ms,
                                curr_blk_write_time_ms,
                            ),
                        )
                    continue

                delta_mean_ms = (delta_total_ms / delta_calls) if delta_calls > 0 else float(stats.get('mean_exec_time_ms', 0) or 0.0)

                # Cache extracted_features per query_hash/text to avoid repeated parsing.
                # (Heuristic: query_text itself is the best cache key here.)
                if not hasattr(self, "_features_cache"):
                    self._features_cache = {}
                features_cache_key = f"{stats.get('query_hash')}::{stats.get('query_template')}"
                if features_cache_key in self._features_cache:
                    features = self._features_cache[features_cache_key]
                else:
                    features = self.extract_features(query_text)
                    self._features_cache[features_cache_key] = features
                features_json = json.dumps(features)

                if not expand_calls:
                    values_to_insert.append(
                        (
                            stats.get('query_hash'),
                            query_text,
                            stats.get('query_template'),
                            delta_calls,
                            round(delta_total_ms, 3),
                            round(delta_mean_ms, 3),
                            stats.get('min_exec_time_ms', 0),
                            stats.get('max_exec_time_ms', 0),
                            stats.get('stddev_exec_time_ms', 0),
                            delta_rows,
                            delta_shared_blks_hit,
                            delta_shared_blks_read,
                            delta_shared_blks_dirtied,
                            delta_shared_blks_written,
                            delta_local_blks_hit,
                            delta_local_blks_read,
                            delta_local_blks_dirtied,
                            delta_local_blks_written,
                            delta_temp_blks_read,
                            delta_temp_blks_written,
                            delta_blk_read_time_ms,
                            delta_blk_write_time_ms,
                            query_plan_json,
                            features_json,
                        )
                    )
                    stored_count += 1
                else:
                    # Expand delta_calls into multiple rows for faster dataset growth.
                    # Values are sampled from the observed delta distribution proxies.
                    cap = max_rows_per_queryid if max_rows_per_queryid > 0 else delta_calls
                    per_q_rows = int(min(delta_calls, cap))

                    avg_rows = (delta_rows / delta_calls) if delta_calls > 0 else 0.0
                    avg_shared_read = (delta_shared_blks_read / delta_calls) if delta_calls > 0 else 0.0
                    avg_shared_hit = (delta_shared_blks_hit / delta_calls) if delta_calls > 0 else 0.0
                    avg_shared_dirtied = (delta_shared_blks_dirtied / delta_calls) if delta_calls > 0 else 0.0
                    avg_shared_written = (delta_shared_blks_written / delta_calls) if delta_calls > 0 else 0.0
                    avg_local_read = (delta_local_blks_read / delta_calls) if delta_calls > 0 else 0.0
                    avg_local_hit = (delta_local_blks_hit / delta_calls) if delta_calls > 0 else 0.0
                    avg_local_dirtied = (delta_local_blks_dirtied / delta_calls) if delta_calls > 0 else 0.0
                    avg_local_written = (delta_local_blks_written / delta_calls) if delta_calls > 0 else 0.0
                    avg_temp_read = (delta_temp_blks_read / delta_calls) if delta_calls > 0 else 0.0
                    avg_temp_written = (delta_temp_blks_written / delta_calls) if delta_calls > 0 else 0.0
                    avg_blk_read_time_ms = (delta_blk_read_time_ms / delta_calls) if delta_calls > 0 else 0.0
                    avg_blk_write_time_ms = (delta_blk_write_time_ms / delta_calls) if delta_calls > 0 else 0.0

                    std_ms = float(stats.get("stddev_exec_time_ms", 0) or 0) or (delta_mean_ms * 0.25)
                    min_ms = float(stats.get("min_exec_time_ms", 0) or 0)
                    max_ms = float(stats.get("max_exec_time_ms", 0) or 0)

                    for _j in range(per_q_rows):
                        sample_ms = random.gauss(delta_mean_ms, std_ms)
                        if min_ms > 0:
                            sample_ms = max(sample_ms, min_ms)
                        if max_ms > 0:
                            sample_ms = min(sample_ms, max_ms)
                        sample_ms = max(0.001, sample_ms)

                        # Per-call row/blk sampling (kept integer-ish)
                        sample_rows = int(max(0, random.gauss(avg_rows, max(1.0, avg_rows * 0.3))))

                        sample_shared_hit = int(max(0, random.gauss(avg_shared_hit, max(1.0, avg_shared_hit * 0.3))))
                        sample_shared_read = int(max(0, random.gauss(avg_shared_read, max(1.0, avg_shared_read * 0.3))))
                        sample_shared_dirtied = int(max(0, random.gauss(avg_shared_dirtied, max(0.1, avg_shared_dirtied * 0.3))))
                        sample_shared_written = int(max(0, random.gauss(avg_shared_written, max(0.1, avg_shared_written * 0.3))))

                        sample_local_hit = int(max(0, random.gauss(avg_local_hit, max(1.0, avg_local_hit * 0.3))))
                        sample_local_read = int(max(0, random.gauss(avg_local_read, max(1.0, avg_local_read * 0.3))))
                        sample_local_dirtied = int(max(0, random.gauss(avg_local_dirtied, max(0.1, avg_local_dirtied * 0.3))))
                        sample_local_written = int(max(0, random.gauss(avg_local_written, max(0.1, avg_local_written * 0.3))))

                        sample_temp_read = int(max(0, random.gauss(avg_temp_read, max(0.1, avg_temp_read * 0.3))))
                        sample_temp_written = int(max(0, random.gauss(avg_temp_written, max(0.1, avg_temp_written * 0.3))))

                        sample_blk_read_time_ms = max(0.0, random.gauss(avg_blk_read_time_ms, max(0.001, avg_blk_read_time_ms * 0.3)))
                        sample_blk_write_time_ms = max(0.0, random.gauss(avg_blk_write_time_ms, max(0.001, avg_blk_write_time_ms * 0.3)))

                        values_to_insert.append(
                            (
                                stats.get('query_hash'),
                                query_text,
                                stats.get('query_template'),
                                1,  # calls
                                round(sample_ms, 3),  # total_exec_time_ms
                                round(sample_ms, 3),  # mean_exec_time_ms (single call)
                                round(sample_ms, 3),  # min_exec_time_ms
                                round(sample_ms, 3),  # max_exec_time_ms
                                0.0,  # stddev_exec_time_ms
                                sample_rows,
                                sample_shared_hit,
                                sample_shared_read,
                                sample_shared_dirtied,
                                sample_shared_written,
                                sample_local_hit,
                                sample_local_read,
                                sample_local_dirtied,
                                sample_local_written,
                                sample_temp_read,
                                sample_temp_written,
                                round(sample_blk_read_time_ms, 3),
                                round(sample_blk_write_time_ms, 3),
                                query_plan_json,
                                features_json,
                            )
                        )
                        stored_count += 1

                # Stage state update value (always update even when expanding)
                state_updates.append(
                    (
                        qid,
                        curr_calls,
                        curr_total_ms,
                        curr_rows,
                        curr_shared_blks_hit,
                        curr_shared_blks_read,
                        curr_shared_blks_dirtied,
                        curr_shared_blks_written,
                        curr_local_blks_hit,
                        curr_local_blks_read,
                        curr_local_blks_dirtied,
                        curr_local_blks_written,
                        curr_temp_blks_read,
                        curr_temp_blks_written,
                        curr_blk_read_time_ms,
                        curr_blk_write_time_ms,
                    )
                )
            
            if values_to_insert:
                execute_batch(cursor, insert_sql, values_to_insert, page_size=5000)

            # Apply state updates in bulk
            if state_updates:
                cursor.executemany(
                    f"""
                    INSERT INTO {self.schema}.query_log_collection_state
                        (
                          queryid,
                          last_calls, last_total_exec_time_ms, last_rows,
                          last_shared_blks_hit, last_shared_blks_read, last_shared_blks_dirtied, last_shared_blks_written,
                          last_local_blks_hit, last_local_blks_read, last_local_blks_dirtied, last_local_blks_written,
                          last_temp_blks_read, last_temp_blks_written,
                          last_blk_read_time_ms, last_blk_write_time_ms,
                          last_seen_at
                        )
                    VALUES (
                      %s, %s, %s, %s,
                      %s, %s, %s, %s,
                      %s, %s, %s, %s,
                      %s, %s,
                      %s, %s,
                      CURRENT_TIMESTAMP
                    )
                    ON CONFLICT (queryid) DO UPDATE SET
                      last_calls = EXCLUDED.last_calls,
                      last_total_exec_time_ms = EXCLUDED.last_total_exec_time_ms,
                      last_rows = EXCLUDED.last_rows,
                      last_shared_blks_hit = EXCLUDED.last_shared_blks_hit,
                      last_shared_blks_read = EXCLUDED.last_shared_blks_read,
                      last_shared_blks_dirtied = EXCLUDED.last_shared_blks_dirtied,
                      last_shared_blks_written = EXCLUDED.last_shared_blks_written,
                      last_local_blks_hit = EXCLUDED.last_local_blks_hit,
                      last_local_blks_read = EXCLUDED.last_local_blks_read,
                      last_local_blks_dirtied = EXCLUDED.last_local_blks_dirtied,
                      last_local_blks_written = EXCLUDED.last_local_blks_written,
                      last_temp_blks_read = EXCLUDED.last_temp_blks_read,
                      last_temp_blks_written = EXCLUDED.last_temp_blks_written,
                      last_blk_read_time_ms = EXCLUDED.last_blk_read_time_ms,
                      last_blk_write_time_ms = EXCLUDED.last_blk_write_time_ms,
                      last_seen_at = CURRENT_TIMESTAMP
                    """,
                    state_updates,
                )

            conn.commit()
            logger.info(f"Stored {stored_count} query log records")
            
        except Exception as e:
            conn.rollback()
            logger.error(f"Error storing query metrics: {e}")
        finally:
            cursor.close()
            conn.close()
        
        return stored_count
    
    def collect_and_store(
        self,
        force_snapshot: bool = False,
        expand_calls: bool = False,
        max_rows_per_queryid: int = 0,
    ) -> int:
        """Collect query statistics and store in database.

        Args:
            force_snapshot: If True, bootstrap from current cumulative counters.
            expand_calls: If True, expand delta_calls into multiple rows per queryid delta.
            max_rows_per_queryid: Safety cap when expand_calls is enabled.
        """
        # Set instance attributes that store_metrics reads (keeps signature changes minimal).
        self.expand_calls_enabled = bool(expand_calls)
        self.expand_calls_max_rows_per_queryid = int(max_rows_per_queryid or 0)

        query_stats = self.collect_from_pg_stat_statements()
        return self.store_metrics(query_stats, force_snapshot=force_snapshot)
    
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


