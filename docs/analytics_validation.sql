-- Analytics validation queries for dashboard /analytics
-- Set these two values per validation run.
\set start_date '2026-01-01'
\set end_date   '2026-01-31'

-- 1) Query performance aggregate for selected window.
WITH w AS (
  SELECT *
  FROM ml_optimization.query_logs
  WHERE collected_at >= (:start_date::date AT TIME ZONE 'UTC')
    AND collected_at <  ((:end_date::date + 1) AT TIME ZONE 'UTC')
),
agg AS (
  SELECT
    query_hash::text AS query_id,
    SUM(COALESCE(calls, 0))::bigint AS execution_count,
    (SUM(COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0)::numeric, 0)::numeric)
      / NULLIF(SUM(COALESCE(calls, 0))::numeric, 0)) / 1000.0 AS avg_sec,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY (
      COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0)::numeric, 0)::numeric
      / NULLIF(COALESCE(calls, 0)::numeric, 0)
    )) / 1000.0 AS p95_sec,
    SUM(COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0), 0)) / 1000.0 AS total_sec,
    MAX(collected_at) AS last_executed
  FROM w
  GROUP BY query_hash
)
SELECT
  'query_performance_window_aggregate' AS section,
  COUNT(*) AS distinct_query_groups,
  SUM(execution_count) AS total_runs,
  MAX(last_executed) AS data_watermark_utc
FROM agg;

-- 2) Top slow query groups (aligns with Query Performance Impact panel ranking).
WITH w AS (
  SELECT *
  FROM ml_optimization.query_logs
  WHERE collected_at >= (:start_date::date AT TIME ZONE 'UTC')
    AND collected_at <  ((:end_date::date + 1) AT TIME ZONE 'UTC')
)
SELECT
  'query_performance_top_slow' AS section,
  query_hash::text AS query_id,
  SUM(COALESCE(calls, 0))::bigint AS execution_count,
  (SUM(COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0)::numeric, 0)::numeric)
      / NULLIF(SUM(COALESCE(calls, 0))::numeric, 0)) / 1000.0 AS avg_sec,
  SUM(COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0), 0)) / 1000.0 AS total_sec
FROM w
GROUP BY query_hash
ORDER BY total_sec DESC NULLS LAST
LIMIT 8;

-- 3) Busiest UTC hour over trailing 7d.
SELECT
  'busiest_utc_hour_7d' AS section,
  EXTRACT(HOUR FROM (collected_at AT TIME ZONE 'UTC'))::int AS utc_hour,
  SUM(COALESCE(calls, 0))::double precision AS total_calls
FROM ml_optimization.query_logs
WHERE collected_at >= (CURRENT_DATE - INTERVAL '7 days')::timestamptz
  AND collected_at <  (CURRENT_DATE + INTERVAL '1 day')::timestamptz
GROUP BY 2
ORDER BY total_calls DESC
LIMIT 1;

-- 4) Optimization history.
SELECT
  'optimization_history_recent' AS section,
  recommendation_id,
  recommendation_type,
  table_name,
  column_names,
  apply_outcome,
  applied_at
FROM ml_optimization.optimization_apply_events
ORDER BY applied_at DESC
LIMIT 50;

-- 5) Pending recommendations consistency.
SELECT
  'pending_recommendations' AS section,
  recommendation_id::text AS recommendation_id,
  recommendation_type,
  table_name,
  column_name,
  COALESCE(NULLIF(BTRIM(status::text), ''), 'pending') AS status_norm,
  created_at
FROM ml_optimization.index_recommendations
WHERE status IS NULL
   OR BTRIM(status::text) = ''
   OR LOWER(BTRIM(status::text)) = 'pending'
ORDER BY created_at DESC
LIMIT 100;

-- 6) Workload clustering sample quality baseline.
WITH sample AS (
  SELECT *
  FROM ml_optimization.query_logs
  WHERE query_text IS NOT NULL
    AND BTRIM(query_text) <> ''
    AND (COALESCE(mean_exec_time_ms, 0) > 0 OR COALESCE(calls, 0) > 0)
  ORDER BY collected_at DESC
  LIMIT 5000
)
SELECT
  'workload_sample_quality' AS section,
  COUNT(*) AS sampled_rows,
  COUNT(*) FILTER (WHERE extracted_features IS NULL) AS missing_extracted_features,
  MAX(collected_at) AS data_watermark_utc
FROM sample;

-- 7) Cache candidates SQL baseline on sampled logs.
WITH sample AS (
  SELECT *
  FROM ml_optimization.query_logs
  WHERE query_text IS NOT NULL
    AND BTRIM(query_text) <> ''
    AND (COALESCE(mean_exec_time_ms, 0) > 0 OR COALESCE(calls, 0) > 0)
  ORDER BY collected_at DESC
  LIMIT 8000
),
base AS (
  SELECT
    query_text,
    COUNT(*) AS sample_count,
    SUM(COALESCE(calls, 0))::double precision AS calls_sum,
    (
      SUM(COALESCE(total_exec_time_ms, mean_exec_time_ms * NULLIF(calls, 0), 0)::double precision)
      / NULLIF(SUM(COALESCE(calls, 0))::double precision, 0)
    ) AS mean_exec_ms
  FROM sample
  GROUP BY query_text
)
SELECT
  'cache_candidates_baseline' AS section,
  LEFT(query_text, 180) AS query_preview,
  sample_count,
  calls_sum,
  mean_exec_ms
FROM base
ORDER BY calls_sum DESC, mean_exec_ms DESC
LIMIT 50;

-- 8) Largest tables for storage panels.
SELECT
  'largest_tables' AS section,
  n.nspname AS schema_name,
  c.relname AS table_name,
  pg_total_relation_size(c.oid) AS size_bytes
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname IN ('bronze', 'silver', 'gold')
  AND c.relkind IN ('r', 'p', 'm')
ORDER BY size_bytes DESC
LIMIT 20;

-- 9) Storage cost source totals.
SELECT
  'storage_cost_source' AS section,
  schemaname,
  SUM(pg_total_relation_size(schemaname || '.' || tablename))::double precision AS total_bytes,
  (SUM(pg_total_relation_size(schemaname || '.' || tablename))::double precision / 1024 / 1024 / 1024) AS storage_gb
FROM pg_tables
WHERE schemaname IN ('bronze', 'silver', 'gold')
GROUP BY schemaname
ORDER BY schemaname;
