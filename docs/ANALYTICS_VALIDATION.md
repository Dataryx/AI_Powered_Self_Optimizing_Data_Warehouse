# Analytics Validation Runbook

This runbook maps `dashboard` `/analytics` sections to SQL checks against production data.

Use with:

- [docs/analytics_validation.sql](docs/analytics_validation.sql)

## Inputs

Set:

- `start_date` (UTC date)
- `end_date` (UTC date)

for the window you are validating.

## Section Mapping

- **Overview cards / query stats**
  - `query_performance_window_aggregate`
  - `query_performance_top_slow`
- **Busy times (UTC peak hour)**
  - `busiest_utc_hour_7d`
- **Optimization history**
  - `optimization_history_recent`
- **Recommendations consistency**
  - `pending_recommendations`
- **Workload groups input quality**
  - `workload_sample_quality`
- **Cache opportunities baseline**
  - `cache_candidates_baseline`
- **Storage insights and cost source**
  - `largest_tables`
  - `storage_cost_source`

## Production Validation Checklist

1. Confirm API response metadata includes:
   - `data_watermark_utc`
   - `window_start_utc`
   - `window_end_utc`
   - `degraded_mode`
   - `degraded_reason`
2. Run matching SQL section in `analytics_validation.sql`.
3. Compare:
   - totals/counts
   - top-N ordering
   - watermark freshness
4. If mismatch:
   - verify window parameters (UTC calendar)
   - check fallback/degraded flags in API response
   - verify dataset filters (non-empty query text, call/latency predicates).
