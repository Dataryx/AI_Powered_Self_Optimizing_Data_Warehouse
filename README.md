## AI-Powered Self-Optimizing Data Warehouse

An end‑to‑end data warehouse that:

- **Ingests data** into a medallion architecture (Bronze → Silver → Gold)
- **Runs ETL** to clean and aggregate data
- **Exposes a REST API** for warehouse metadata and analytics
- **Provides React dashboards** for monitoring and analytics
- **Collects query logs and trains ML models** to recommend optimizations (e.g. indexes)

This README focuses on: **what each part does, how data flows, how to run it, how the system learns, and how optimization happens.**

### Project Summary (for Professor)

- **Goal**: Demonstrate a complete, working prototype of a **self‑optimizing data warehouse** that not only ingests and transforms data, but also **observes its own workload and learns how to improve performance over time**.
- **How it runs end‑to‑end**:
  - PostgreSQL hosts a medallion‑style warehouse (Bronze/Silver/Gold) created from a single DDL file.
  - A **data generator** produces realistic e‑commerce data and (optionally) loads it into Bronze.
  - A single **ETL script** (`etl/scripts/run_etl.py`) incrementally moves data Bronze → Silver → Gold, building facts and dimensions.
  - A **FastAPI backend** exposes warehouse stats, analytics, monitoring, and optimization endpoints on `/api/v1/...`.
  - A **React monitoring dashboard** calls those endpoints to show: warehouse health, sales analytics, ETL status, storage/cost, alerts, and optimization recommendations.
  - A separate **ML pipeline** collects query logs, trains models, and produces index recommendations stored in `ml_optimization.index_recommendations` and exposed via the API.
- **Why this is “good” / non‑trivial**:
  - It covers the **full lifecycle**: data generation → ingestion → ETL → analytics → monitoring → ML‑driven optimization, rather than focusing on just one piece.
  - It uses **real database signals** (PostgreSQL schemas, `pg_stat_statements`, `pg_stat_user_tables`, `pg_statio_user_tables`) to drive metrics, alerts, and ML, instead of hard‑coded dummy numbers.
  - It provides a **closed feedback loop**: the system can observe workload, learn which queries are slow or frequent, generate recommendations (e.g. indexes), and (when wired to `CREATE INDEX`) measure improvement over time.
  - The architecture and code are organized so each layer is clear and testable: DDL and ETL are decoupled from ML and from the dashboards, but all use the same warehouse.

### Working Mechanism (Step‑by‑Step)

1. **Warehouse Setup**  
   PostgreSQL is initialized with `bronze`, `silver`, `gold`, `ml_optimization`, and `monitoring` schemas using `complete_warehouse.sql`. This creates all base, dimension, and fact tables that every other component relies on.

2. **Data Ingestion into Bronze**  
   Either a real source system or the synthetic **data generator** (`data-generator/main.py`) writes raw e‑commerce–style records (customers, products, orders, inventory, sessions, clickstream) into Bronze. At this point the data is raw and not yet analytics‑ready.

3. **ETL: Bronze → Silver → Gold**  
   The ETL entry point (`etl/scripts/run_etl.py`) reads new rows from Bronze, cleans and standardizes them into Silver, then aggregates and denormalizes them into Gold (facts + dimensions). After ETL, analysts and dashboards can query Gold for fast, business‑friendly metrics.

4. **API Reads the Warehouse**  
   The FastAPI service (`ml-optimization/api/main.py`) connects to the same PostgreSQL instance and exposes REST endpoints that compute row counts, sizes, sales metrics, top products, freshness, storage usage, cache hit‑rates, etc., by querying Bronze/Silver/Gold and `pg_*` views.

5. **Dashboards Visualize State and Analytics**  
   The React monitoring dashboard (`monitoring-dashboard/`) calls those API endpoints to render the **Data Warehouse Dashboard** (medallion overview + sales KPIs and charts) and additional monitoring pages (ETL jobs, freshness, data quality, storage, alerts, optimizations). This is how users and instructors “see” the warehouse in action.

6. **Workload Generation and Query Logging**  
   As users and BI tools query the warehouse (especially Gold tables), PostgreSQL records statistics in `pg_stat_statements`. The **QueryLogCollector** script (`run_query_collection.py`) periodically reads those stats and persists them into `ml_optimization.query_logs`, capturing which queries run, how long they take, and how often.

7. **ML Training and Recommendation Generation**  
   The training script (`train_all_models.py`) consumes `query_logs` to fit models (workload clustering, query‑time prediction, anomaly detection). The recommendation script (`generate_recommendations.py`) uses those logs and models to propose concrete optimizations (e.g. “add an index on `gold.fact_sales(order_date_key, product_key)`”), which are stored in `ml_optimization.index_recommendations`.

8. **Serving and Applying Optimizations**  
   Optimization endpoints (`/api/v1/optimization/...`) surface recommendations to the dashboard or external tools. When the `apply` path is fully implemented, the system can translate a recommendation into `CREATE INDEX` or related DDL, apply it to PostgreSQL, and mark the recommendation as applied.

9. **Feedback Loop and Self‑Optimization**  
   After optimizations are applied, future queries run faster (or more efficiently), which is reflected back into `pg_stat_statements` and subsequently into `query_logs`. Re‑running the collection, training, and recommendation steps lets the system measure impact and refine future suggestions, closing the **self‑optimization loop**.

---

## 1. High‑Level Architecture

- **Database**: PostgreSQL with schemas:
  - `bronze` – raw / staging data
  - `silver` – cleaned, conformed data
  - `gold` – star‑schema analytics (facts + dimensions)
  - `ml_optimization` – query logs and ML metadata
  - `monitoring` – ETL and monitoring metadata
- **Data Generator** (`data-generator/`): creates synthetic e‑commerce data (customers, products, orders, inventory, reviews, sessions, clickstream) and can load it into Bronze.
- **ETL Pipeline** (`etl/scripts/run_etl.py`): moves data Bronze → Silver → Gold incrementally.
- **ML Optimization Service** (`ml-optimization/api/`): FastAPI service that:
  - Reads the warehouse and monitoring schemas
  - Serves REST endpoints for warehouse stats, metrics, recommendations, alerts, storage, etc.
  - Serves as backend for the monitoring dashboard.
- **Monitoring Dashboard** (`monitoring-dashboard/`): React app that calls the API to show:
  - Warehouse overview (Bronze / Silver / Gold)
  - Sales analytics (from Gold)
  - ETL status, data freshness, data quality
  - Storage, cache, cost, alerts, optimization recommendations
- **ML Pipeline** (`ml-optimization/`, `scripts/ml-optimization/`):
  - Collects query logs from PostgreSQL (`pg_stat_statements`)
  - Trains models (query time prediction, workload clustering, anomaly detection)
  - Generates optimization recommendations (e.g. indexes)

---

## 2. How Data Enters and Flows Through the Warehouse

### 2.1 Create Schemas and Tables

PostgreSQL must have at least:

- Schemas: `bronze`, `silver`, `gold`, `ml_optimization`, `monitoring`
- Tables for each layer, defined in:
  - `data-warehouse/schemas/complete_warehouse.sql` (canonical medallion schema)

Typical setup:

1. Start PostgreSQL (Docker or local).
2. Run the warehouse DDL:
   - `psql -f data-warehouse/schemas/complete_warehouse.sql`

This creates all Bronze, Silver, and Gold tables used by the ETL.

### 2.2 Loading Bronze (Raw) Data

You have two main options:

- **External / real source**: load your own data into the Bronze tables defined in `complete_warehouse.sql` (`bronze.customer`, `bronze.orders`, etc.).
- **Synthetic data generator** (`data-generator/`):
  - Generates:
    - Customers
    - Products
    - Orders + order items
    - Inventory movements
    - Product reviews
    - Web sessions
    - Clickstream events
  - Uses `Faker` and configuration in `data-generator/config.py`.
  - When run with `--load`, uses `BatchLoader` to insert into Bronze tables (by default, the alternative `raw_*` schema; you can adapt it to target your main Bronze tables if desired).

Run the generator from the repo root (after installing its requirements):

```bash
cd data-generator
pip install -r requirements.txt

# Generate data only (no DB load)
python main.py

# Generate and load into Bronze (uses DataGeneratorConfig DB settings)
python main.py --load

# Override volumes
python main.py --load --customers 5000 --products 2000 --days 90
```

Key components (data-generator):

- `config.py` – `DataGeneratorConfig` (DB connection, volumes, seeds).
- `generators/*.py` – customer, product, order, inventory, review, session, clickstream generators.
- `loaders/batch_loader.py` – bulk inserts into Bronze tables using `psycopg2.execute_batch`.

### 2.3 ETL: Bronze → Silver → Gold

Single entry point:

```bash
python etl/scripts/run_etl.py
```

What it does (simplified):

1. **Bronze → Silver (transform/clean)**:
   - Reads new rows from each Bronze table.
   - Cleans and standardizes data.
   - Resolves keys (e.g. natural IDs → surrogate keys).
   - Inserts into corresponding Silver tables with `ON CONFLICT DO NOTHING`.
   - Order respects dependencies (country → location → warehouse; person → customer/employee → orders → order_item, etc.).
2. **Silver → Gold (aggregate / star schema)**:
   - Builds dimension tables (`gold.dim_customer`, `gold.dim_product`, `gold.dim_date`, etc.).
   - Builds fact and aggregate tables (`gold.fact_sales`, `gold.fact_orders`, `gold.agg_daily_sales`, etc.).
3. **Incremental**:
   - Designed to process only new / changed rows, so you can re‑run ETL as more data lands in Bronze.

Helpers:

- `scripts/verify_schemas_and_tables.py` – checks that required schemas and tables exist.
- `scripts/verify_etl_population.py` – inspects row counts after ETL.
- `scripts/truncate_all_layers.py` – resets Bronze/Silver/Gold for a fresh run.

**Running ETL on a schedule (cron / Task Scheduler):** Use `etl/scripts/run_etl_cron.sh` (Linux/macOS) or `etl/scripts/run_etl_cron.ps1` (Windows). Each run is recorded in `monitoring.etl_jobs` and shown in the dashboard (Recent ETL Runs, ETL metrics, Errors & Retries). See **[docs/ETL_CRON_AND_MONITORING.md](docs/ETL_CRON_AND_MONITORING.md)** for crontab examples and Task Scheduler setup.

---

## 3. Backend API: How the Warehouse Is Exposed

The **ML Optimization API** (`ml-optimization/api/main.py`) is a FastAPI app that exposes:

- Warehouse endpoints (`/api/v1/warehouse/...`)
- Monitoring endpoints (`/api/v1/monitoring/...`)
- Storage endpoints (`/api/v1/storage/...`)
- Alert endpoints (`/api/v1/alerts/...`)
- Optimization endpoints (`/api/v1/optimization/...`)
- Generic metrics and recommendations stubs (`/api/v1/metrics/...`, `/api/v1/recommendations/...`)

### 3.1 Starting the API

From the project root:

```bash
# Recommended entry if provided
python start_services.py

# Or directly with uvicorn
uvicorn ml_optimization.api.main:app --reload --host 0.0.0.0 --port 8000
```

Then:

- Open `http://localhost:8000/docs` for interactive Swagger UI.
- Health check:
  - `GET http://localhost:8000/health`

Base URL used by the dashboard:

- `http://localhost:8000/api/v1`

### 3.2 Key Warehouse Endpoints (used by the Dashboard)

Under `ml-optimization/api/routes/warehouse_routes.py`:

- **Warehouse summary**  
  - `GET /api/v1/warehouse/summary`  
  - Returns table counts, estimated rows, and sizes for Bronze, Silver, Gold, plus DB name.

- **Schemas & tables**  
  - `GET /api/v1/warehouse/schemas` – list `bronze`, `silver`, `gold` and table counts.  
  - `GET /api/v1/warehouse/tables/{schema}` – list tables and column counts.  
  - `GET /api/v1/warehouse/stats/{schema}/{table}` – row count + size for a table.  
  - `GET /api/v1/warehouse/data/{schema}/{table}?limit=&offset=` – sample rows (used by data explorer).

- **Sales & customers (Gold analytics)**  
  - `GET /api/v1/warehouse/sales-stats` – total sales, revenue, average sale, daily sales (30 days), top products.  
  - `GET /api/v1/warehouse/top-products?limit=20` – top products by revenue, used by the Top Products chart.  
  - `GET /api/v1/warehouse/customer-stats` – total customers and orders summary.

These endpoints read from **Gold** tables (`gold.fact_sales`, `gold.fact_orders`, `gold.dim_customer`, `gold.dim_product`) so the dashboard always shows analytics over the cleaned, aggregated layer.

---

## 4. Monitoring: ETL, Freshness, Data Quality, Storage, Alerts

The API also provides rich monitoring endpoints (see `ml-optimization/api/routes/monitoring_routes.py`, `storage_routes.py`, `alert_routes.py`):

- **ETL jobs & pipeline**
  - `GET /api/v1/monitoring/etl/jobs` – entries from `monitoring.etl_jobs` (status, progress, records processed).
  - `GET /api/v1/monitoring/etl/pipeline-dag` – static DAG structure describing Bronze→Silver→Gold pipeline.
  - `ws://localhost:8000/api/v1/ws/etl-jobs` – WebSocket streaming ETL job updates.

- **Data freshness**
  - `GET /api/v1/monitoring/etl/freshness`  
  - Uses `monitoring.etl_jobs` and/or timestamp columns in Bronze/Silver/Gold to estimate last update time, hours ago, and freshness status per table and per layer.

- **ETL errors & retries**
  - `GET /api/v1/monitoring/etl/errors` – failed ETL jobs + heuristic issues (e.g., tables with no data despite completed jobs).

- **Throughput**
  - `GET /api/v1/monitoring/etl/throughput` – records/second derived from ETL job durations or `pg_stat_user_tables`.

- **Data quality**
  - `GET /api/v1/monitoring/data-quality` – per‑table quality scores based on dead tuples, row counts, and ETL success rates.

- **Storage, cache, cost**
  - `GET /api/v1/storage/utilization` – per‑table size, per‑schema totals, overall size.  
  - `GET /api/v1/storage/growth-trends?days=30` – approximate growth rates and synthetic time series.  
  - `GET /api/v1/storage/compression` – per‑table compression ratio estimates.  
  - `GET /api/v1/storage/cache` – cache hit rates from `pg_statio_user_tables`.  
  - `GET /api/v1/storage/resources` – connection counts and DB size.  
  - `GET /api/v1/storage/cost` – storage cost estimates by schema (e.g., $/GB/month).

- **Alerts, anomalies, incidents**
  - `GET /api/v1/alerts/active` – generated alerts (empty tables, high dead tuples, low cache hit rate, large tables, etc.).  
  - `GET /api/v1/alerts/history?days=30` – synthetic alert history.  
  - `GET /api/v1/alerts/anomalies` – anomalies in insert rates and row size.  
  - `GET /api/v1/alerts/incidents` – groups of alerts presented as incidents.  
  - `POST /api/v1/alerts/acknowledge/{alert_id}` – mark an alert as acknowledged (in‑memory).  
  - `GET /api/v1/alerts/config` / `POST /api/v1/alerts/config` – read / update alert thresholds (in‑memory stub).

---

## 5. Frontend: Monitoring Dashboard and How It Uses the API

The monitoring dashboard lives under `monitoring-dashboard/` and is a React + MUI app.

### 5.1 Start the Dashboard

From the repo root:

```bash
cd monitoring-dashboard
npm install      # or yarn
npm run dev      # or yarn dev
```

Configure the backend URL via `VITE_API_BASE_URL` (defaults to `http://localhost:8000/api/v1`).

### 5.2 Data Warehouse Dashboard Page

Key file: `monitoring-dashboard/src/pages/DashboardPage.tsx`.

On load it calls:

- `GET /api/v1/warehouse/summary` → Warehouse overview card (Bronze/Silver/Gold counts & sizes) + database name.
- `GET /api/v1/warehouse/sales-stats` → KPI tiles, Sales chart, top products data.
- `GET /api/v1/warehouse/customer-stats` → Total customers KPI.

Charts/components:

- `WarehouseOverview` – shows Bronze/Silver/Gold metrics.
- `SalesChart` – area chart of daily sales (last 30 days).
- `TopProductsChart` – vertical bar chart of top products by revenue.
  - Also directly calls `GET /api/v1/warehouse/top-products?limit=20` if no data provided.
- Additional cards show total records, total tables, revenue, average sale value, and customers.

If the API is offline, the dashboard falls back to a mock data service so you can still demonstrate the UI.

Other pages (Monitoring, Storage, Analytics, Data Explorer) call the `/monitoring`, `/storage`, `/alerts`, and `/optimization` endpoints described above.

---

## 6. ML and Self‑Optimization: How It Learns and Optimizes

The “self‑optimizing” part is implemented under `ml-optimization/` and `scripts/ml-optimization/`.

### 6.1 Collecting Query Logs

Script (from project root):

```bash
python scripts/ml-optimization/run_query_collection.py
```

What it does:

- Connects to PostgreSQL.
- Reads from `pg_stat_statements` (and/or other query stats).
- Populates `ml_optimization.query_logs` with:
  - `query_text`
  - Execution times, number of calls
  - Rows processed
  - Buffer hits/reads
  - Timestamps
  - Extracted features (e.g., presence of joins, filters) if configured.

### 6.2 Training ML Models

Script:

```bash
python scripts/ml-optimization/train_all_models.py
```

It:

- Loads data from `ml_optimization.query_logs` (e.g., recent N queries).
- Builds feature vectors for each query.
- Trains:
  - **Workload clustering** (e.g., K‑Means) – groups queries by behavior.
  - **Query time predictor** (regression; tree‑based / boosting) – predicts execution time.  
  - **Anomaly detector** (e.g., Isolation Forest) – flags slow/outlier queries.
- Saves model artifacts in `ml-optimization/saved_models/`.

Configuration for models and training is under `ml-optimization/config/` (e.g., minimum samples, hyperparameters).

### 6.3 Generating Optimization Recommendations

Script:

```bash
python scripts/ml-optimization/generate_recommendations.py
```

It analyzes `ml_optimization.query_logs` (and model outputs) to create recommendations, stored in:

- `ml_optimization.index_recommendations`

Typical recommendation fields:

- Table name, column(s) to index
- Estimated improvement (e.g., % latency reduction)
- Priority (high/medium/low)
- Supporting query statistics (query count, avg exec time, etc.)

### 6.5 When Workload Clustering, Query‑Time Prediction, and Anomaly Detection Run

In the current implementation, **the system “knows” when to perform ML tasks based on the scripts you run and simple data‑availability checks** (rather than always‑on background daemons). This is intentional so you can control the cadence (e.g., after enough workload has accumulated).

- **Triggering point (you decide when):**
  - You or a scheduler (cron, Airflow, etc.) run:
    - `run_query_collection.py` → collect fresh query logs.
    - `train_all_models.py` → (re)train models when there is enough new data.
    - `generate_recommendations.py` → refresh recommendations from the latest models + logs.
- **Inside `train_all_models.py`:**
  - The script queries `ml_optimization.query_logs` and **checks simple thresholds** (e.g., minimum number of recent rows, non‑null execution times) before training each model.
  - If there is not enough data for a given task (clustering, prediction, anomaly detection), that part is skipped or logged instead of training on tiny samples.
  - When thresholds are met:
    - **Workload clustering** groups similar queries so you can see workload patterns and later reason about which groups to optimize.
    - **Query‑time prediction** is trained as a regression model to estimate execution time from query features, which can be used in more advanced advisors.
    - **Anomaly detection** learns a “normal” distribution of query performance and flags queries whose behavior deviates strongly (e.g., suddenly much slower), which can drive alerts or targeted optimization.
- **How you would automate it in production:**
  - Run `run_query_collection.py` and `train_all_models.py` on a schedule (e.g., nightly or hourly) via cron/Airflow.
  - Optionally run `generate_recommendations.py` right after training, so the `/optimization/recommendations` API always reflects the latest workload.

In short, the ML components are **event‑driven by your scheduled scripts plus simple “do we have enough fresh data?” checks** inside those scripts, not by hard‑coded timers inside the API.

**Conceptual view (no scripts):**

- The system periodically looks at **recent query logs** and decides whether there is enough fresh, high‑quality data to justify retraining; if not, it waits.  
- When there is enough data, it runs a **single training pass** that: (1) clusters queries into workload groups based on their SQL structure, (2) learns a regression model that predicts query execution time from query features, and (3) fits an anomaly detector that learns what “normal” performance looks like and flags outliers.  
- Those trained models are then used indirectly to drive **index/optimization recommendations** and to highlight problematic queries or workloads, closing the self‑optimization loop.

### 6.4 Surfacing & Applying Recommendations via API

Endpoints in `ml-optimization/api/routes/optimization_routes.py`:

- `GET /api/v1/optimization/recommendations?type=&status=`  
  Returns a list of recommendations from `ml_optimization.index_recommendations` (normalized for the frontend).

- `POST /api/v1/optimization/recommendations/{id}/apply`  
  Accepts a JSON body:

  ```json
  {
    "optimization_id": "<same-id>",
    "auto": false
  }
  ```

  Currently returns a stub “applied” response; this is the hook where you would:
  - Execute `CREATE INDEX ...` or `ALTER TABLE ...` statements against Postgres.
  - Update status in `index_recommendations` and any history tables.

Through the dashboard and these endpoints, the system forms a **closed loop**:

1. Workload hits the warehouse (queries against Bronze/Silver/Gold).
2. Query logs are collected into `ml_optimization.query_logs`.
3. ML models are trained / updated.
4. Recommendations are generated and served via the API.
5. User (or auto‑mode) applies recommendations.
6. New query logs reflect the impact; models can be retrained to refine future decisions.

This is what makes the warehouse **self‑optimizing** rather than static.

---

## 7. End‑to‑End “Quickstart” Flow

Here is a practical sequence to run the full project locally:

1. **Set up Postgres and schemas**
   - Start PostgreSQL (Docker or local).
   - Run `data-warehouse/schemas/complete_warehouse.sql` to create Bronze/Silver/Gold tables.

2. **(Optional) Generate synthetic Bronze data**
   - Configure DB connection in `data-generator/config.py` or environment variables (`POSTGRES_HOST`, `POSTGRES_DB`, etc.).
   - From `data-generator/`:
     - `pip install -r requirements.txt`
     - `python main.py --load`

3. **Run ETL to Silver & Gold**
   - From project root:
     - `python scripts/verify_schemas_and_tables.py` (optional check)
     - `python etl/scripts/run_etl.py`
     - `python scripts/verify_etl_population.py` (see row counts).

4. **Start the API**
   - `python start_services.py`  
   - Or: `uvicorn ml_optimization.api.main:app --reload --port 8000`

5. **Start the monitoring dashboard**
   - `cd monitoring-dashboard`
   - `npm install`
   - `npm run dev`
   - Open the shown URL (typically `http://localhost:5173`) and ensure `VITE_API_BASE_URL` points to `http://localhost:8000/api/v1`.

6. **Collect query logs and train models**
   - Generate some workload (e.g., run queries against Gold tables, use the dashboard/data explorer, run reporting queries).
   - Then:
     - `python scripts/ml-optimization/run_query_collection.py`
     - `python scripts/ml-optimization/train_all_models.py`
     - `python scripts/ml-optimization/generate_recommendations.py`

7. **Inspect and apply recommendations**
   - Via Postman or browser:
     - `GET http://localhost:8000/api/v1/optimization/recommendations`
   - (When implemented) use:
     - `POST http://localhost:8000/api/v1/optimization/recommendations/{id}/apply`
   - Observe impact by:
     - Re‑running `run_query_collection.py`
     - Calling `/api/v1/optimization/query-performance`
     - Checking dashboard charts and metrics.

---

## 8. Key Paths and Commands (Cheat Sheet)

- **Warehouse schema DDL**: `data-warehouse/schemas/complete_warehouse.sql`
- **Data generator**:
  - Code: `data-generator/`
  - Run: `python data-generator/main.py [--load]`
- **ETL pipeline**:
  - Entry: `etl/scripts/run_etl.py`
  - Verify schemas: `scripts/verify_schemas_and_tables.py`
  - Verify row counts: `scripts/verify_etl_population.py`
  - Truncate layers: `scripts/truncate_all_layers.py`
- **API / backend**:
  - App: `ml-optimization/api/main.py`
  - Start: `python start_services.py` or `uvicorn ml_optimization.api.main:app --reload`
- **Monitoring dashboard**:
  - Code: `monitoring-dashboard/`
  - Start: `npm run dev`
- **ML / optimization**:
  - Collect logs: `scripts/ml-optimization/run_query_collection.py`
  - Train models: `scripts/ml-optimization/train_all_models.py`
  - Generate recommendations: `scripts/ml-optimization/generate_recommendations.py`
  - Query performance API: `GET /api/v1/optimization/query-performance`

This README should give you a single place to understand **what the project does, how data flows, how to run it, how it exposes data, and how the self‑optimization loop works.**






Storage page hidden
