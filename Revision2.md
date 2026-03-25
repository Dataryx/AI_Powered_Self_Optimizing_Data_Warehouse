# Revision 2 — REST API reference (GET / POST, JSON)

This document lists the **ML Optimization API** endpoints that return or accept **JSON** (FastAPI default). Base URL is typically `http://localhost:8001` when running `main.py` directly (`ML_SERVICE_PORT`, default `8001`), or whatever you set as `VITE_API_BASE_URL` for the dashboard (often `http://localhost:8000/api/v1` if behind a proxy—**paths below are the app’s real prefixes**).

**Global prefixes** (from `ml-optimization/api/main.py`):

| Router prefix | Tag |
|---------------|-----|
| `/api/v1/optimization` | Optimization |
| `/api/v1/metrics` | Metrics |
| `/api/v1/recommendations` | Recommendations (legacy stub) |
| `/api/v1/warehouse` | Data Warehouse |
| `/api/v1/monitoring` | Monitoring |
| `/api/v1/storage` | Storage |
| `/api/v1/alerts` | Alerts |

**Also (no `/api/v1` prefix):**

| Method | Path | JSON response | Use |
|--------|------|---------------|-----|
| GET | `/` | `{ service, version, status }` | Quick service identity check. |
| GET | `/health` | `{ status, service, database: { name, version, connected, schemas } }` or unhealthy payload | Liveness/readiness; verifies DB and counts bronze/silver/gold tables. |

---

## 1. Data warehouse — `/api/v1/warehouse`

| Method | Path | Query / body | JSON (summary) | Use |
|--------|------|--------------|----------------|-----|
| GET | `/schemas` | — | `{ schemas: [{ name, table_count }] }` | List bronze/silver/gold schemas and table counts. |
| GET | `/tables/{schema}` | `schema` = `bronze` \| `silver` \| `gold` | `{ schema, tables: [{ name, column_count }] }` | Browse tables in a layer. |
| GET | `/stats/{schema}/{table}` | Path: safe alphanumeric `table` | Row count, size, vacuum/analyze timestamps, `n_live_tup`, etc. | Table-level ops stats for capacity planning. |
| GET | `/summary` | — | `{ warehouse_summary: { bronze/silver/gold: { table_count, estimated_rows, total_size, total_size_bytes } }, database }` | Executive / dashboard overview of the warehouse. |
| GET | `/data/{schema}/{table}` | `limit` (default 100), `offset` (default 0) | `{ schema, table, columns, data[], total_count, limit, offset }` | Paginated sample rows for exploration / debugging. |
| GET | `/sales-stats` | — | Sales aggregates from gold (when tables exist) | BI-style sales KPIs. |
| GET | `/top-products` | — | Top products by sales | Product performance ranking. |
| GET | `/customer-stats` | — | Customer-related aggregates | Customer analytics. |

---

## 2. Monitoring — `/api/v1/monitoring`

| Method | Path | Query / body | JSON (summary) | Use |
|--------|------|--------------|----------------|-----|
| GET | `/etl/jobs` | — | `{ jobs[], total }` — job runs with status, progress, layer, table, timestamps | ETL job status board / live pipeline state. |
| GET | `/etl/job-definitions` | — | Registered ETL jobs (names, types, cron, etc.) | Populate job pickers and scheduler UI. |
| **POST** | `/etl/run` | **Body:** `{ "job_name": string }` e.g. `"Complete ETL Pipeline"`, `"BRONZE - Shopping Orders Ingestion"`, `"BRONZE - Random Bronze Tables Populator (100)"` | `{ status, job_name, ... }` — `started`, `already_running`, `skipped_inactive`, or error | **Trigger a one-off ETL** from the dashboard or automation. |
| GET | `/etl/pipeline-dag` | — | `{ nodes[], edges[] }` | Render pipeline DAG visualization. |
| GET | `/etl/freshness` | — | Per-layer freshness, SLA policy, dataset-level status | **Data freshness** vs SLA (ETL completions + table activity). |
| GET | `/etl/errors` | — | `{ errors[], total, active, timestamp }` | Failed runs and anomaly-style issues for **error/retry** views. |
| GET | `/etl/throughput` | — | `{ throughput[], overall_throughput, timestamp }` | **Throughput** (records/sec) from recent job runs. |
| GET | `/data-quality` | — | Quality metrics by stage/table (ETL success rates, table checks) | **Data quality** dashboard metrics. |

---

## 3. Optimization — `/api/v1/optimization`

| Method | Path | Query / body | JSON (summary) | Use |
|--------|------|--------------|----------------|-----|
| GET | `/recommendations` | — | `{ recommendations[], total }` — index/SQL-style suggestions from DB | List ML/rule-based **optimization recommendations**. |
| **POST** | `/recommendations/{recommendation_id}/apply` | **Body:** `{ "optimization_id": string, "auto": boolean }` | `{ recommendation_id, status, applied_at }` (stub apply) | **Apply** a recommendation (wired for future real DDL/automation). |
| GET | `/query-performance` | `start_date`, `end_date`, `query_id`, `limit` (optional query params) | Query performance series / stats | Analyze slow queries over a window. |
| GET | `/history` | — | Optimization / application history | Audit trail of past optimization actions. |

---

## 4. Storage — `/api/v1/storage`

| Method | Path | JSON (summary) | Use |
|--------|------|----------------|-----|
| GET | `/utilization` | Disk/schema utilization | **Storage utilization** widgets. |
| GET | `/growth-trends` | Growth time series | **Capacity trending**. |
| GET | `/compression` | Compression-related stats | Compression / space savings view. |
| GET | `/cache` | Cache hit / buffer metrics | **Cache** performance monitoring. |
| GET | `/resources` | CPU/memory-style allocation view | **Resource allocation** dashboard. |
| GET | `/cost` | Cost estimates | **Cost** estimation cards. |

---

## 5. Alerts — `/api/v1/alerts`

| Method | Path | Query / body | JSON (summary) | Use |
|--------|------|--------------|----------------|-----|
| GET | `/active` | — | Active alerts (empty tables, quality, etc.) | **Active alerts** list. |
| GET | `/history` | — | Past alerts | Historical alert timeline. |
| GET | `/anomalies` | — | Detected anomalies | Anomaly detection panel. |
| GET | `/incidents` | — | `{ incidents[], total, open, resolved }` | **Incident** tracking. |
| POST | `/acknowledge/{alert_id}` | Path only (no JSON body) | `{ alert_id, acknowledged, acknowledged_at }` | Mark an alert acknowledged. |
| GET | `/config` | — | `{ configs[] }` — alert types, thresholds, severity | Read alert **configuration**. |
| **POST** | `/config` | **Body:** `{ "alert_type": string, "threshold": number, "enabled": boolean, "severity": string }` | Updated config echo | **Update** alert rules (in-memory / stub persistence). |

---

## 6. Metrics (stub) — `/api/v1/metrics`

| Method | Path | JSON (summary) | Use |
|--------|------|----------------|-----|
| GET | `/` | `{ message, metrics: [] }` | Placeholder for generic metrics. |
| GET | `/query-performance` | `{ message, data: [] }` | Placeholder; prefer `/api/v1/optimization/query-performance` for real data. |

---

## 7. Recommendations (stub) — `/api/v1/recommendations`

| Method | Path | JSON (summary) | Use |
|--------|------|----------------|-----|
| GET | `/` | `{ message, recommendations: [] }` | Legacy stub; real list is under **`/api/v1/optimization/recommendations`**. |

---

## 8. WebSocket (JSON messages, not HTTP GET/POST)

| Protocol | URL | Use |
|----------|-----|-----|
| WebSocket | `/api/v1/ws/etl-jobs` | **Live ETL updates** pushed as JSON to connected clients. |

---

## Client note

The dashboard `api` service typically calls these paths under **`/api/v1/...`** with `Content-Type: application/json` on **POST** bodies (`job_name`, alert `config`, optimization `apply`).

---

*Generated from route modules in `ml-optimization/api/routes/` and router registration in `ml-optimization/api/main.py`.*
