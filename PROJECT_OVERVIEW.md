# AI-Powered Self-Optimizing Data Warehouse — Project Overview

This document summarizes the project for presentation: what it does, how data flows, how it is used, which ML models are involved, and how they are trained.

---

## 1. What the Project Is

The project is an **AI-powered self-optimizing data warehouse** that:

- Stores and processes data in a **medallion architecture** (Bronze → Silver → Gold).
- Runs an **ETL pipeline** to move and clean data from raw (Bronze) to analytics-ready (Gold).
- Uses **machine learning** to analyze query patterns, predict performance, and suggest optimizations (e.g. indexes).
- Exposes a **REST API** and a **React monitoring dashboard** for warehouse stats, metrics, and recommendations.

The goal is to combine a classic data warehouse with an ML layer that learns from how the database is queried and suggests (or applies, with approval) improvements.

---

## 2. High-Level Architecture

```
  [Source / OLTP]  →  Bronze (raw)  →  Silver (cleaned)  →  Gold (aggregated)
                            ↑                    ↑                    ↑
                            |                    |                    |
                     ETL pipeline          ETL pipeline         Used by API
                     (run_etl.py)         (same run)            and dashboard
                            |
                            v
              [ML Engine: query logs → models → recommendations]
                            ↑
              [PostgreSQL: pg_stat_statements, query_logs]
```

- **Bronze:** Raw data as received (e.g. country, location, product, orders, customer, employee). No transformation; used as staging.
- **Silver:** Cleaned and standardized data with keys, types, and constraints. Built from Bronze by the ETL.
- **Gold:** Star-schema style analytics (dimensions + facts + aggregates). Built from Silver by the same ETL run.
- **ML engine:** Reads query statistics (and optionally query logs), trains models, and produces optimization recommendations.

---

## 3. How the Database Was Created

The project uses **PostgreSQL**. The database is created and set up in one of these ways:

### 3.1 Option A: Docker (recommended for a full stack)

1. **Start PostgreSQL** via Docker (e.g. using `infrastructure/docker/`). The init scripts run on first start:
   - **01-create-databases.sql** — creates databases (e.g. `airflow`).
   - **02-create-schemas.sql** — creates schemas: `bronze`, `silver`, `gold`, `etl`, `ml_optimization`, and grants privileges.
   - **03-create-extensions.sql** — any required extensions (e.g. for `pg_stat_statements`).
   - **04-create-tables.sql** — placeholder; actual tables are created separately (see below).

2. **Create the data warehouse tables** by running the DDL that defines Bronze, Silver, and Gold:
   - The **single source of truth** for the ETL pipeline is **`data-warehouse/schemas/complete_warehouse.sql`**.
   - It defines all Bronze tables (e.g. `country`, `location`, `warehouse`, `product`, `inventory`, `person`, `customer`, `employment`, `orders`, `order_item`, etc.), all Silver tables (with keys and foreign keys), and all Gold tables (dimensions, facts, aggregates).
   - Run this file against your database (e.g. `psql -f data-warehouse/schemas/complete_warehouse.sql` or execute it from your SQL client) so that the schemas `bronze`, `silver`, and `gold` contain the correct tables.

3. **Alternative schema path:** The repo also has **`scripts/data-warehouse/create_schemas.py`**, which creates the same schemas and then runs a different set of SQL files under `data-warehouse/schemas/bronze/`, `silver/`, `gold/` (e.g. `raw_customers`, `raw_products`). That path is for an **alternative** schema (different table names). The ETL described in this document and in `etl/scripts/run_etl.py` uses the **`complete_warehouse.sql`** schema (e.g. `bronze.customer`, `bronze.orders`), not the `raw_*` tables.

**Short answer:** *We created the database by starting PostgreSQL (Docker or local), creating the `bronze`, `silver`, and `gold` schemas (and `ml_optimization`), then executing `data-warehouse/schemas/complete_warehouse.sql` to create all tables used by the ETL.*

---

## 4. How Data Was Populated

### 4.1 Populating the Bronze layer (initial data)

Bronze holds raw data. It can be filled in one of these ways:

1. **From an external source:** Load from your OLTP, CSV, or another system into the Bronze tables defined in `complete_warehouse.sql` (e.g. `bronze.country`, `bronze.customer`, `bronze.orders`). This is typically a one-time or periodic load script you run (not included in this repo).

2. **Using the data generator (synthetic data):** The project includes a **data-generator** (`data-generator/main.py`) that generates realistic synthetic data (customers, products, orders, inventory, reviews, sessions, clickstream) and loads it into Bronze via **BatchLoader** (`data-generator/loaders/batch_loader.py`). The generator uses Faker and configurable seeds. **Note:** The loader currently targets tables like `bronze.raw_customers`, `bronze.raw_products`, `bronze.raw_orders` — i.e. an alternative schema. To use the ETL that expects `bronze.customer`, `bronze.orders`, etc., you would either point the loader at those tables or populate Bronze with another script (e.g. manual INSERTs or a small loader for the `complete_warehouse` Bronze tables).

3. **Manual or custom scripts:** Execute INSERTs (or COPY) into `bronze.country`, `bronze.location`, `bronze.orders`, etc., so that the ETL has something to read.

### 4.2 Populating Silver and Gold (ETL)

- **Single entry point:** `python etl/scripts/run_etl.py`
- **Optional pre-check:** `python scripts/verify_schemas_and_tables.py` (checks that Bronze, Silver, and Gold schemas/tables exist).
- **What the ETL does:**
  1. **Bronze → Silver:** For each Bronze table, the transformer reads only “new” rows (not yet in Silver), applies cleaning and key lookups (e.g. `country_id` → `country_key`), and inserts into the corresponding Silver table with `ON CONFLICT DO NOTHING`. Order respects dependencies (e.g. country → location → warehouse; person → customer, employee → orders → order_item).
  2. **Silver → Gold:** The aggregator fills Gold dimension and fact tables from Silver (e.g. `dim_customer`, `dim_product`, `fact_sales`, `fact_orders`, `agg_daily_sales`, `agg_customer_lifetime`, etc.). It also ensures `dim_date` is populated for the needed dates.
- **When:** ETL is run **on demand** (e.g. after loading new data into Bronze, or on a schedule via cron/scheduler). It is **incremental**: only new/changed Bronze rows are processed; Gold is updated accordingly.
- **Verification:** After ETL, run `python scripts/verify_etl_population.py` to see how many rows are in each Silver and Gold table.

### 4.3 Summary (short answer for "how did you populate data?")

| Stage   | How it’s populated |
|--------|---------------------|
| Bronze | Loaded from an external source, or by the **data-generator** (synthetic data), or by custom INSERT/loader scripts. |’s |
| Silver | **ETL** from Bronze: `python etl/scripts/run_etl.py` (BronzeToSilverTransformer). |
| Gold   | **ETL** from Silver: same `run_etl.py` (SilverToGoldAggregator). |

*In short: we populate Bronze by loading from source or using the data generator (or custom scripts); we populate Silver and Gold by running the ETL pipeline.*

---

## 5. How the Data Is Used

### 5.1 REST API (FastAPI)

- The **ML Optimization API** (`ml-optimization/api/main.py`, started e.g. via `start_services.py`) exposes endpoints such as:
  - **Warehouse:** `/api/v1/warehouse/schemas`, `/api/v1/warehouse/tables/{schema}`, `/api/v1/warehouse/stats/{schema}/{table}`, `/api/v1/warehouse/summary` — list schemas, tables, row counts, and sizes for Bronze, Silver, Gold.
  - **Metrics / monitoring:** Query performance and system metrics.
  - **Recommendations:** Optimization suggestions (indexes, etc.) produced by the ML pipeline.
  - **Alerts, storage, WebSocket:** For monitoring and real-time updates.
- The API reads **from the same PostgreSQL database** that holds Bronze, Silver, and Gold (and `ml_optimization.query_logs`). So “how data is used” here means: **the API serves warehouse metadata and metrics to the dashboard and other clients.**

### 5.2 Monitoring Dashboard (React)

- The **monitoring-dashboard** (React app) calls the API above to show:
  - Data warehouse overview (schemas, tables, row counts).
  - Metrics and performance.
  - Optimizations and recommendations.
  - Storage, alerts, analytics views.
- If the API is unavailable, the dashboard can show **mock data** so the UI still demonstrates layout and features.

### 5.3 ML Optimization Pipeline

- **Query log collection:** A script (`scripts/ml-optimization/run_query_collection.py`) uses the **QueryLogCollector** to pull query statistics from PostgreSQL (e.g. `pg_stat_statements`) and store them in `ml_optimization.query_logs` (query text, execution time, calls, rows, blocks, etc.).
- **Workload analysis:** The **WorkloadAnalyzer** uses `query_logs` to extract features (query type, tables, joins, filters, etc.) and classify workload patterns.
- **Recommendations:** Scripts like `scripts/ml-optimization/generate_recommendations.py` analyze `query_logs` (e.g. frequent filters on `silver.orders.order_date`) and produce **index** (and optionally **partition**) recommendations. These can be approved and applied (e.g. `approve_and_apply_recommendations.py` / `apply_recommendations.py`).
- So the **data used by ML** is: (1) **warehouse data** (Bronze/Silver/Gold) for business logic and reporting, and (2) **query logs** (and optionally plan/features) for training and recommendation generation.

---

## 6. ML Models Used

The project includes several ML components under `ml-optimization/`:

| Model / Component      | Purpose |
|------------------------|--------|
| **Query Time Predictor** | Predicts query execution time from query features (e.g. from `query_logs`). Uses tree-based regression (e.g. Gradient Boosting / XGBoost). |
| **Workload Clustering**   | Groups queries by workload characteristics (execution time, row counts, joins, filters) using clustering (e.g. K-Means). Helps identify workload types. |
| **Anomaly Detector**      | Detects anomalous query performance (e.g. unusually slow or heavy queries) using Isolation Forest on metrics from query logs. |
| **Cache Predictor**       | Predicts cache usefulness (e.g. for caching decisions). |
| **Index Advisor**        | Uses query patterns to suggest indexes (which columns to index). |
| **Partition Advisor**     | Suggests partitioning strategies. |
| **RL Resource Allocator** | (Optional) Reinforcement learning for resource allocation; may be stubbed or partial. |

The ones that are **explicitly trained** in the training scripts are: **Query Time Predictor**, **Workload Clustering**, and **Anomaly Detector**.

---

## 7. How the ML Models Are Trained

### 7.1 Data Used for Training

- Training uses **query execution data** stored in **`ml_optimization.query_logs`**.
- This table is filled by the **Query Log Collector**, which reads from PostgreSQL’s **`pg_stat_statements`** (and optionally other sources) and stores per-query statistics: `query_text`, `mean_exec_time_ms`, `calls`, `rows_affected`, `shared_blks_hit`/`read`, etc., plus optional `extracted_features` (JSON).
- So **training is driven by real usage**: the more the warehouse is queried, the more data in `query_logs`, and the better the models can learn.

### 7.2 Training Pipeline

1. **Collect query logs** (so that `ml_optimization.query_logs` has enough rows):
   - Run: `python scripts/ml-optimization/run_query_collection.py`
2. **Train all models** (Query Time Predictor, Workload Clustering, Anomaly Detector):
   - Run: `python scripts/ml-optimization/train_all_models.py`
   - This script:
     - Connects to the database and reads from `ml_optimization.query_logs` (e.g. recent 1000 rows with non-null `query_text` and positive execution time).
     - Builds feature sets (e.g. query length, presence of JOIN/WHERE/GROUP BY, execution time, calls, rows).
     - Trains each model:
       - **Workload Clustering:** Unsupervised clustering (e.g. K-Means) on query features; saves the fitted clusterer.
       - **Query Time Predictor:** Supervised regression (train/test split, scaling, then fit); saves the predictor and scaler.
       - **Anomaly Detector:** Fits an Isolation Forest on query metrics; saves the detector and scaler.
     - Saves serialized models (e.g. `.pkl`) under `ml-optimization/saved_models/`.

### 7.3 Training Configuration

- **Config** for models and training lives under `ml-optimization/config/` (e.g. `model_config.py`, `training_config.py`): train/test split, minimum samples, cross-validation folds, etc.
- **Minimum data:** The training script and some models require a minimum number of records (e.g. at least 10–100 rows in `query_logs`); otherwise training is skipped or raises.
- **Retraining:** The design supports periodic retraining (e.g. when enough new query logs are available). The **model_retrainer** and **feedback_loop** modules are intended to support re-training and evaluation of optimization impact over time.

### 7.4 End-to-End ML Workflow (How / When)

| Step | How | When |
|------|-----|------|
| 1. Ingest warehouse data | Your process loads source data into Bronze. | Before ETL. |
| 2. Run ETL | `python etl/scripts/run_etl.py` | After Bronze load; repeat when new data arrives. |
| 3. Generate query activity | Users or apps query the warehouse (and/or run built-in reports). | Ongoing. |
| 4. Collect query logs | `python scripts/ml-optimization/run_query_collection.py` | Periodically (e.g. daily or after heavy use). |
| 5. Train models | `python scripts/ml-optimization/train_all_models.py` | After enough rows in `query_logs` (e.g. after step 4). |
| 6. Generate recommendations | `python scripts/ml-optimization/generate_recommendations.py` | After training or when new patterns appear. |
| 7. Apply recommendations | Approve and run apply scripts (e.g. create indexes). | After review. |

---

## 8. Technology Stack

- **Database:** PostgreSQL (Bronze, Silver, Gold, and `ml_optimization` schema).
- **ETL:** Python 3, `psycopg2`, batch processing; single script `etl/scripts/run_etl.py`.
- **Backend API:** FastAPI (Python), CORS enabled; serves warehouse info, metrics, recommendations, alerts.
- **Frontend:** React, Material-UI, Redux, TanStack Query; optional mock data when API is down.
- **ML:** Python, scikit-learn (e.g. Isolation Forest, K-Means, Gradient Boosting), XGBoost; joblib for saving/loading models.
- **Query observation:** PostgreSQL `pg_stat_statements`; custom `QueryLogCollector` and `ml_optimization.query_logs` table.

---

## 9. Quick Reference: Important Commands and Paths

| Task | Command or path |
|------|------------------|
| Check schemas/tables before ETL | `python scripts/verify_schemas_and_tables.py` |
| Run full ETL (Bronze → Silver → Gold) | `python etl/scripts/run_etl.py` |
| Check population after ETL | `python scripts/verify_etl_population.py` |
| Truncate layers (reset) | `python scripts/truncate_all_layers.py` (or truncate_silver_layer / truncate_gold_layer) |
| Start API | `python start_services.py` (or run uvicorn on `ml-optimization/api/main.py`) |
| Collect query logs for ML | `python scripts/ml-optimization/run_query_collection.py` |
| Train all ML models | `python scripts/ml-optimization/train_all_models.py` |
| Generate recommendations | `python scripts/ml-optimization/generate_recommendations.py` |
| Warehouse schema (DDL) | `data-warehouse/schemas/complete_warehouse.sql` |

---

## 10. Questions to Ask the Professor (Making the Project Less Generic / More Research-Oriented)

The professor said the project is *very generic* and needs *some research*. Below are questions you can ask to get clear direction and narrow the scope toward a research contribution.

### Scope and novelty

1. **What would make this project “less generic” in your view?** For example: a specific industry (e.g. healthcare, retail), a particular type of workload (OLAP vs mixed), or a defined research question we’re trying to answer?
2. **Should we focus the research on one part of the pipeline?** For example: ETL design, index recommendation, query prediction, anomaly detection, or the feedback loop—rather than touching everything lightly?
3. **Is there a particular conference or journal (e.g. SIGMOD, VLDB, ICDE, or a data-engineering venue) whose style of contribution we should aim for?** That would help me narrow the problem and related work.

### Related work and baselines

4. **Are there specific papers or systems you’d like us to compare against?** For example: AutoAdmin, Microsoft’s index advisors, or recent “learning for databases” papers (e.g. learned indexes, query time prediction)?
5. **Should we implement a simple “non-ML” baseline (e.g. rule-based index advisor or cost-model-based predictor) and show that our ML approach improves over it?** If yes, what baseline would you consider fair?

### Evaluation and methodology

6. **What kind of evaluation would you consider sufficient for a research-oriented project?** For example: controlled experiments on standard benchmarks (e.g. TPC-H, TPC-DS), A/B comparison before/after optimizations, or a case study on a real/synthetic workload with clear metrics (latency, throughput, cost)?
7. **Do you want a formal “related work” and “methodology” section (e.g. hypothesis, design, metrics, threats to validity)?** That would push the write-up toward a research report rather than a project report.

### Technical depth

8. **For the ML side, should we go deeper on one model?** For example: proper hyperparameter tuning, ablation (which features matter for query-time prediction or anomaly detection), or comparing several model families (e.g. tree-based vs neural) with a clear experimental setup?
9. **Should we add a “research question” we’re testing?** For instance: “Does workload clustering improve index recommendation quality?” or “Can we predict query execution time within X% error using only query-log features?”—and then design experiments to answer it.

### Domain and data

10. **Would using a public benchmark (e.g. TPC-H) or a specific open dataset make the project more defensible as research?** So the setup is reproducible and comparable to prior work?
11. **Is there a preference for focusing on “real” workloads (e.g. from pg_stat_statements in a running system) vs synthetic but controlled workloads for the experiments?**

### Deliverables

12. **Besides the code and this overview, what deliverables do you expect?** For example: a short research-style report (problem, related work, method, experiments, conclusion), a poster, or a presentation that emphasizes the research contribution rather than only the implementation?
13. **Should the “research” part be a separate section or document (e.g. “Research component: question, method, and results”) so it’s clear what is novel or experimental vs what is standard implementation?**

---

Using these questions in a short meeting will help you get concrete guidance on: *what to research*, *how to evaluate it*, and *what to deliver*, so the project becomes less generic and more research-oriented.

---

This document gives a single reference for: **what** the project is, **how** and **when** data is populated, **how** data is used (API and dashboard), **which** ML models exist, and **how** they are trained and used in the optimization workflow.
