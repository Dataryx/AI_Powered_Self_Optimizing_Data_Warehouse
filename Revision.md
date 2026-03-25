# Revision Guide: ETL Monitoring Dashboard

This document explains—in plain language—how the **ETL Monitoring** section of our data warehouse dashboard works: what each panel means, where the numbers come from (which database queries and rules), and how the user interface presents that information. You can use this to walk a professor through the design and implementation.

---

## Big picture

The **React dashboard** (Vite app under `dashboard/`) calls our **ML Optimization API** (FastAPI, under `ml-optimization/`). The monitoring hook `useMonitoringData` loads several endpoints in parallel:

| What you see on screen | API endpoint |
|------------------------|--------------|
| Recent ETL Runs | `GET /api/v1/monitoring/etl/jobs` |
| Pipeline DAG (backend data) | `GET /api/v1/monitoring/etl/pipeline-dag` |
| Data Freshness & SLA | `GET /api/v1/monitoring/etl/freshness` |
| Data Quality | `GET /api/v1/monitoring/data-quality` |
| Run ETL Manually (job list) | `GET /api/v1/monitoring/etl/job-definitions` |
| Run ETL Manually (start run) | `POST /api/v1/monitoring/etl/run` |

The API reads from **PostgreSQL**, especially the `monitoring` schema (`job_runs`, `etl_jobs`) and catalog/statistics views (`information_schema`, `pg_stat_user_tables`).

---

## 1. ETL Lineage Visualization

### Why we include it

**Lineage** means: data flows from **Bronze** (raw ingest) → **Silver** (cleaned/conformed) → **Gold** (analytics-ready facts and dimensions). The visualization is meant to show that story as a left-to-right, layer-by-layer pipeline.

### What it does:

- Shows the medallion-layer flow (Bronze → Silver → Gold) at a glance
- Helps explain where tables “belong” in the pipeline and how the overall system is connected

### How it is calculated / where data comes from

**Important for an accurate demo to your professor:** The **on-screen “ETL Lineage Visualization” component is currently illustrative**. It uses **hard-coded** layer names (BRONZE, SILVER, GOLD) and example node names (e.g. ingestion steps, example table names) defined in the React file `dashboard/src/components/monitoring/LineageVisualization.tsx`. It does **not** read the API response `data.pipeline` today—the `data` and `loading` props are accepted but unused.

The **backend** *does* expose a structured DAG at `GET /monitoring/etl/pipeline-dag`. That endpoint returns a fixed JSON object: a list of **nodes** (id, label, type, layer) and **edges** (from/to) describing a canonical medallion flow (bronze tables → silver transform → gold aggregate, etc.). That DAG is **documentation-style**: it describes the intended pipeline shape rather than discovering lineage dynamically from metadata.

**If asked “is this live from the database?”** you can say: the **live** parts of monitoring are jobs, freshness, and quality; the **lineage card** is a **conceptual diagram** (and the server has a matching static DAG you could wire to the UI in a future iteration).

### How it is displayed in the UI

- Three stacked sections (Bronze, Silver, Gold), each with colored chips for “nodes” connected by small arrows.
- Framer Motion animates nodes appearing in sequence.
- Horizontal scroll is available on small screens so the flow does not break the layout.

---

## 2. Recent ETL Runs

### Why we include it

This panel answers: **“What ETL jobs ran recently, and did they succeed?”** It is grounded in real **job run history** from the database.

### What it does:

- Pulls the latest ETL runs from `monitoring.job_runs` (optionally joined to `monitoring.etl_jobs` for better naming)
- Displays a short, readable list (latest 10) with status icons and timestamps
- Lets an instructor/proctor quickly see whether ETL is progressing normally

### Which query is used (backend)

The handler `get_etl_jobs` in `ml-optimization/api/routes/monitoring_routes.py` runs SQL against **`monitoring.job_runs`**, optionally joined to **`monitoring.etl_jobs`** for friendly job names and metadata.

**When `monitoring.etl_jobs` exists**, the query is essentially:

- Select from **`monitoring.job_runs`** (`jr`) **LEFT JOIN** **`monitoring.etl_jobs`** (`j`) on `jr.job_id = j.job_id`.
- Return: run id (exposed as `job_id` for the frontend), resolved **job name** (`COALESCE(j.job_name, jr.table_name, 'ETL Job')`), **job type**, **status**, progress, layer, table, **started_at**, **completed_at**, records processed/total, error message, metadata, cron pattern.
- **Order:** `started_at DESC` (newest first).

**If `etl_jobs` is missing**, it falls back to selecting from **`job_runs` only**, still ordered by `started_at DESC`.

The API also computes **duration_seconds** when both `started_at` and `completed_at` are present.

### Logic behind the display

- The React component takes `data.jobs` from the hook, ensures it is an array, and shows **at most the first 10 runs** (`slice(0, 10)`).
- Each row shows:
  - **Green check** if `status === 'completed'`, **red X** if `failed`, **clock** otherwise (e.g. running/pending).
  - **Job name** from `job_name` (or falls back to `job_type` or the string `"Run"`).
  - **Status** text and a **timestamp**: `completed_at` formatted for completed jobs, or “In progress” when status is `running`.

So: **calculation = database ordering + optional duration math**; **UI = truncate to 10 + iconography by status**.

---

## 3. Run ETL Manually

### Why we include it

This lets an operator **trigger a predefined ETL script once** from the dashboard, without waiting for the scheduler.

### What it does:

- Loads available job definitions from `monitoring.etl_jobs`
- Provides a dropdown + “Run ETL” button to dispatch a selected job on demand
- Uses backend safety checks (inactive job + already-running protection) and then refreshes the monitoring cards after dispatch

### How the job list is loaded

On mount, `ManualETLJobRunner` calls **`GET /monitoring/etl/job-definitions`**, which:

1. Checks that **`monitoring.etl_jobs`** exists.
2. If yes, runs:
   - `SELECT job_id, job_name, job_type, tables, cron_pattern, active_status FROM monitoring.etl_jobs ORDER BY job_name`
3. Returns `{ jobs: [...], total }`.

If the API fails or returns empty, the UI falls back to a single option: **“Complete ETL Pipeline”**.

### What happens when you click “Run ETL”

The UI **`POST`s** to **`/monitoring/etl/run`** with JSON `{ "job_name": "<selected name>" }`.

**Server logic (summary):**

1. **Validates** `job_name` and maps it to a **Python command** (subprocess), e.g.:
   - `"Complete ETL Pipeline"` → `python etl/scripts/run_etl.py`
   - Other names can map to specific scripts (e.g. bronze shopping ingest, random bronze populator)—see the same route file for the exact list.
2. **Safety checks** (when monitoring tables exist):
   - Skips if the job is marked **inactive** in `etl_jobs`.
   - If a run for that job is already **`running`**, returns **`already_running`** unless the run is “stale” (older than `ETL_STALE_RUNNING_MINUTES`, default 360 minutes)—then it allows a new dispatch.
3. Starts the process with **`subprocess.Popen`** (fire-and-forget: API does not wait for the script to finish). Postgres connection parameters are copied from the API’s own DB connection into the child process environment when possible, so the script talks to the same database as the API.
4. Returns JSON like `{ "status": "started", "job_name": "...", "pid": ... }` or error statuses such as `already_running`, `skipped_inactive`.

### How the UI behaves

- Dropdown = job names from definitions (or fallback).
- Button shows **“Running…”** while the request is in flight.
- If the response is not `started`, it shows an **error message** (e.g. already running).
- On success it calls **`onAfterDispatch`**, which refreshes monitoring data so **Recent ETL Runs** can show the new run once the tracker writes to `job_runs`.

---

## 4. Data Freshness & SLA

### What it represents

For each **table** in **bronze, silver, and gold**, we estimate **how recently the data (or the table) was “touched”** and classify it against a simple **SLA policy**:

- **On time (fresh):** last activity **under 1 hour**
- **At risk (stale):** between **1 and 6 hours**
- **SLA breach (outdated):** **6 hours or more**
- **Unknown:** we could not determine any trustworthy timestamp

These thresholds are defined in code as `SLA_FRESH_H = 1` and `SLA_STALE_H = 6` hours and are also echoed in the JSON as `sla_policy` so the UI can explain them.

### Why we include it

Even the best “optimization recommendations” are only useful if the warehouse is receiving fresh data. **Data Freshness & SLA** is a monitoring panel that tells us whether each medallion-layer table is being updated within the agreed freshness windows.

### What it does:
- Creates an **age** (how long since the newest reliable activity clock for a table)
- Converts that age into an **SLA bucket**: `Fresh` / `At risk` / `SLA breach` / `Unknown`
- Lets you **spot problem areas quickly** using the summary counts and colored cards
- Lets you **inspect the exact signal** used for each table (via the modal “reason” lines), so you can explain what happened to that data.

### How “last activity” is determined (priority order)

For each `(schema, table)` the API tries, in order:

1. **ETL completion time**  
   - From **`monitoring.job_runs`**: for rows with `status = 'completed'` and non-null `completed_at`, it aggregates  
     `MAX(completed_at)` and `SUM(records_processed)` **per `(layer, table_name)`**.  
   - If this exists for the table, that timestamp is the **clock** (“activity_signal”: **etl**).

2. **Business / row timestamps**  
   - If no ETL time, it looks for known column names (`ingestion_timestamp`, `created_at`, `updated_at`, `order_date`, etc.).  
   - For the **first column that exists**, it runs  
     `SELECT MAX(<column>), COUNT(*) FROM schema.table`  
   - The **MAX** becomes the clock (“activity_signal”: **column**), and the column name is recorded.

3. **PostgreSQL table maintenance stats**  
   - If still no time, it reads **`pg_stat_user_tables`** for `last_autoanalyze`, `last_analyze`, `last_autovacuum`, `last_vacuum` and picks the **latest** non-null timestamp (“activity_signal”: **pg_stat**).  
   - **`n_live_tup`** can supply row estimates when useful.

4. **Still nothing**  
   - It may still run **`COUNT(*)`** for display, but **status = unknown** (no fake timestamp).

**Age** = hours between **now (UTC)** and that clock time (the code normalizes time zones to avoid naive/aware bugs).

### Which queries (high level)

- ETL aggregates: `SELECT layer, table_name, MAX(completed_at), SUM(records_processed) FROM monitoring.job_runs WHERE status = 'completed' ... GROUP BY layer, table_name`
- Table list per schema: `information_schema.tables` for `BASE TABLE`s
- Column existence: `information_schema.columns`
- Optional `MAX(column)` and `COUNT(*)` on each physical table
- Fallback: `pg_stat_user_tables` for `schemaname`, `relname`

### API response shape (what the UI consumes)

The endpoint returns:

- **`datasets`**: flat list of all tables with `name`, `layer`, `sla_lag`, `last_updated` (humanized), `last_updated_at`, `records`, `status`, `hours_ago`, `reason_lines`, etc.
- **Counts:** `on_time`, `at_risk`, `sla_breach`, `unknown_datasets`, `total_datasets` (the UI can also recompute counts from `datasets` if needed).
- **`sla_policy`**: documents the 1h / 6h rule.
- **`freshness`**: nested per-layer structure (legacy); the UI can merge from `datasets` or this nested form.

### How the UI displays it

- **Summary row:** counts for On Time, At Risk, SLA Breach, Unknown, Total Datasets (icons + numbers).
- **Grid of cards** (paginated, 6 per page): each card shows **layer.table**, SLA label, last activity line, record count, color accent by severity.
- **Click a card** → modal with **per-table `reason_lines`** from the API (plain English bullets explaining which clock was used and why the SLA bucket was chosen), plus optional expandable “how freshness works” text.

---

## 5. Data Quality

### Why we include it

**Data quality** here is a **composite score per table** (0–100), rolled up to a **layer average** for Bronze, Silver, and Gold. It combines **physical storage health** (dead vs live tuples) with **ETL reliability** over the last week, then applies **penalties** for failures and stale jobs.

### What it does:

- Computes a per-table quality score using storage + ETL reliability signals
- Roll-ups those scores into three layer cards (Bronze/Silver/Gold) so issues are easy to spot
- Supports drill-down in a modal so you can explain why a layer/table scored high or low

### ETL reliability input (query)

The API loads per-table job stats from the last **7 days**:

```sql
SELECT layer, table_name,
       COUNT(*) AS total_jobs,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS successful_jobs,
       SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_jobs,
       MAX(started_at) AS last_job_at
FROM monitoring.job_runs
WHERE started_at >= CURRENT_TIMESTAMP - INTERVAL '7 days'
GROUP BY layer, table_name;
```

From that it derives a **success rate** = successful / total (when total > 0).

### Per-table storage input (queries)

For up to **10 tables per layer** (from `information_schema.tables`, or from distinct `job_runs` if the schema is empty):

- **`SELECT COUNT(*) FROM schema.table_name`** for row count.
- **`pg_stat_user_tables`** for `n_live_tup` and `n_dead_tup` to estimate **dead tuple ratio** vs live rows.

A **storage component** score starts from:  
`100 - (dead_tup / live_tup * 100)` when live tuples exist (capped at 0), with conservative defaults if stats are missing.

### How the score is blended (logic)

When ETL stats exist for that table:

- **Weighted blend:**  
  **`quality_score = 0.55 × storage_component + 0.45 × etl_success_rate`**
- **Failure penalty:** subtract up to **25 points** scaled by the fraction of failed runs.
- **Recency penalties** based on hours since `last_job_at`:
  - **> 72 hours:** −15 points  
  - **> 24 hours:** −8 points  

When **no** ETL rows exist in the 7-day window, the score falls back to **storage-only** or conservative baselines (empty table → low score; storage-only capped without ETL proof).

Each table gets a **status** label: excellent / good / fair / poor based on score bands (e.g. ≥80 “good” tier for green in the UI).

The API also builds **`factors`**: string lines explaining each ingredient (storage %, ETL rate, blend formula, penalties)—these are what the modal shows as “reason behind the score.”

### Layer roll-up

For each schema, the API averages table scores → **`average_quality_score`** and **`overall_status`**. It then builds a **`layers`** array for the dashboard: name, color, dataset count, average score, whether there are issues, and a short **`failingRules`** summary (e.g. number of tables under 80%).

### How the UI displays it

- **Three large clickable cards** (Bronze, Silver, Gold): layer name, dataset count text, **average %**, and either a **warning strip** (“top failing rules”) or a green “no failing rules” line.
- **Click a layer** → modal listing **tables** with row count, dead tuples, score, status badge; **expand a table** to see the **`factors`** list from the API.

---

## Closing summary (elevator pitch)

- **Recent ETL Runs** and **Run ETL Manually** are tied to **real `monitoring.job_runs` / `etl_jobs`** and subprocess dispatch.  
- **Data Freshness** is **rule-based SLA** (1h / 6h) using **ETL timestamps first**, then **MAX(timestamp columns)**, then **PostgreSQL stats**, with honest **unknown** when needed.  
- **Data Quality** is a **weighted mix of storage health and 7-day ETL success**, with **penalties**, explained per table in **`factors`**.  
- **Lineage** on the screen today is a **fixed illustrative diagram**; the API exposes a **static DAG** you can describe as the **intended medallion design** for future dynamic wiring.

---

*Document generated to match the codebase in this repository. If you change thresholds, SQL, or components, update this file so it stays accurate for demos.*





Bronze -> Silver (clean + conform)
From etl/transformers/bronze_to_silver.py, it transforms on these bases:

Incremental load check
Usually loads only records not already in silver (LEFT JOIN ... WHERE silver.id IS NULL).
Uses ON CONFLICT DO NOTHING to avoid duplicate inserts.
Referential integrity checks
Looks up surrogate keys from already-built silver dims (e.g. country_key, person_key, customer_key, order_key, product_key).
Skips records when required FK is missing (e.g., inventory/order_item rows).
Null/default handling
Fills missing values with defaults (Unknown, USD, 0, current date, etc.).
Standardization / derivation
Builds fields like full_name, full_address, status_category, income_bracket, credit_tier, usage_type.
Sensitive data protection
Hashes government/passport IDs in restricted info.
Basic numeric validation
Prevents negative values for some fields (e.g. unit price/quantity), rounds precision.
SCD-like metadata
Sets is_valid, valid_from, valid_to, _etl_timestamp.



Silver -> Gold (analytics model)
From etl/aggregators/silver_to_gold.py, it builds dims/facts/aggs based on:

Prerequisite table checks
Won’t build aggregates if required silver tables are empty.
Date-key consistency
Ensures dim_date has all needed dates (creates missing date rows).
Business aggregations
Daily sales, monthly product sales, customer lifetime, sales rep performance, fact tables.
Segmentation logic
RFM scores/segments, customer tiers, status buckets, stock status.
Idempotency/skip logic
Many gold tables skip if already populated unless forced refresh.



What it “checks” explicitly
New-vs-existing row existence
Required foreign key presence
Table emptiness/prerequisites before downstream steps
Duplicate detection after pipeline run (etl/utils/duplicate_checker.py)
Data quality-ish safety rules (defaults, normalization, type/format shaping)
But not advanced schema-drift/anomaly validation in transform stage itself
