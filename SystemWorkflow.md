## System Workflow (Technical Overview)

This document explains the end-to-end workflow of the AI‑Powered Self‑Optimizing Data Warehouse in technical terms, without focusing on script execution.

---

## 1. Data Ingestion into the Medallion Layers

### 1.1 Source Data → Bronze

- Raw operational events (customers, products, orders, inventory, sessions, clickstream) are written into **Bronze schema tables** in PostgreSQL.
- Bronze tables preserve:
  - Source identifiers and natural keys
  - Original timestamps
  - Semi-structured fields as needed for traceability
- Data is minimally transformed at this stage; Bronze acts as a **staging and landing zone**.

### 1.2 Bronze → Silver (Standardization and Conformance)

- A **transformation layer** reads new rows from Bronze and populates **Silver tables** that enforce:
  - Cleaned and normalized data types (dates, numerics, enums)
  - Consistent formats (e.g., standardized currencies, codes)
  - Referential integrity between entities (e.g., customer–order–product relationships)
- Key operations:
  - Mapping natural business identifiers to **surrogate keys** (e.g., `customer_id` → `customer_key`)
  - Deduplication and basic data quality checks
  - Ensuring foreign keys are resolvable before facts are loaded

### 1.3 Silver → Gold (Analytics Modeling)

- A **modeling layer** aggregates and reshapes Silver data into **Gold fact and dimension tables**:
  - Dimensions: `dim_customer`, `dim_product`, `dim_date`, etc.
  - Facts: `fact_sales`, `fact_orders`, and other measures of business activity
  - Pre-aggregated summaries: e.g., daily or monthly sales, customer lifetime metrics
- The Gold layer is optimized for:
  - Star-schema queries
  - OLAP-style aggregations
  - BI dashboards and analytical tools

The result is a three-layer medallion architecture where:

- Bronze = ingestion/staging
- Silver = cleaned, conformed data
- Gold = analytics-ready, performance-oriented schema

---

## 2. Serving and Monitoring Layer

### 2.1 API over the Warehouse

- A **FastAPI backend** connects to PostgreSQL and exposes a versioned REST API under `/api/v1`.
- It groups endpoints by concern:
  - **Warehouse metadata and analytics** (`/warehouse/...`):
    - Lists of schemas and tables
    - Row counts and table sizes
    - Sales and customer statistics (driven by Gold facts and dimensions)
  - **ETL and pipeline monitoring** (`/monitoring/...`):
    - ETL job metadata (status, progress, records processed)
    - Pipeline DAG (logical data flow between Bronze, Silver, Gold)
    - Data freshness per table and per layer
    - ETL error summaries and throughput metrics
  - **Storage and performance** (`/storage/...`):
    - Per-table and per-schema storage size
    - Approximated growth trends over time
    - Compression estimates
    - Cache performance (hit rates) from PostgreSQL I/O statistics
    - Connection counts and overall database size
  - **Alerts and anomalies** (`/alerts/...`):
    - Empty or underpopulated tables
    - High dead-tuple ratios (VACUUM candidates)
    - Low cache hit rates for frequently accessed tables
    - Oversized tables that may require partitioning or archival
  - **Optimization** (`/optimization/...`):
    - Exposes ML-generated optimization recommendations
    - Surfaces query performance summaries

Each endpoint translates a **well-defined question** into SQL queries over:

- `bronze`, `silver`, `gold` schemas
- `ml_optimization` and `monitoring` schemas
- PostgreSQL system catalogs and views (`pg_stat_*`, `information_schema`, `pg_statio_user_tables`, etc.)

### 2.2 Monitoring Dashboard (React)

- A **React + Material UI dashboard** consumes the FastAPI endpoints through a centralized API client.
- Key views:
  - **Data Warehouse Dashboard**:
    - Visualizes Bronze/Silver/Gold table counts and estimated row counts
    - Shows sales KPIs (total sales, revenue, average sale value) and trends
    - Displays top products by revenue
  - **ETL and Freshness View**:
    - ETL job timelines and statuses
    - Table-level freshness and overall freshness status per layer
  - **Data Quality and Storage Views**:
    - Per-table quality metrics derived from dead tuples, row counts, ETL success rates
    - Storage utilization, compression, and cost breakdowns
  - **Alerts and Optimization Views**:
    - Active alerts and their severity
    - Historical incidents
    - Optimization recommendations produced by the ML layer

This serving and visualization layer provides **operational observability** over the warehouse and is what end users and stakeholders interact with.

---

## 3. Workload Observation and ML Optimization Loop

### 3.1 Query Workload Capture

- PostgreSQL’s **`pg_stat_statements`** extension continuously aggregates statistics for executed SQL statements:
  - Normalized query text
  - Average execution time
  - Number of calls
  - Rows processed
  - Buffer hits and reads
- A **query logging mechanism** periodically exports these statistics into a persistent table `ml_optimization.query_logs`, transforming in-memory statistics into a historical workload dataset.

### 3.2 When the System Decides to Learn

- The ML component periodically inspects `ml_optimization.query_logs` and evaluates:
  - Volume of recent records
  - Presence of valid execution times and other required metrics
- If there is **sufficient, recent, high-quality data**, the system initiates a training pass; otherwise, it delays retraining to avoid learning from noisy or insufficient samples.
- This logic ensures that models reflect the **current workload** while remaining robust.

### 3.3 Workload Clustering

- The system derives features from SQL text, such as:
  - Query length and word count
  - Presence of structural clauses: `SELECT`, `JOIN`, `WHERE`, `GROUP BY`, `ORDER BY`, etc.
- These features form a vector representation of each query.
- A clustering algorithm (e.g., K-Means) groups queries into **workload clusters**, e.g.:
  - Simple point lookups
  - Star-join analytical queries
  - Aggregation-heavy reports
- Each cluster represents a distinct workload pattern that may benefit from different optimization strategies.

### 3.4 Query-Time Prediction

- For each query in `query_logs`, the system pairs:
  - Feature vectors derived from the SQL text
  - Observed execution times from PostgreSQL statistics
- A regression model is trained to map query features to **predicted execution time**.
- Once trained, this model can:
  - Estimate the cost of existing queries under different conditions
  - Support “what-if” reasoning about how beneficial a potential optimization (e.g., new index) might be.

### 3.5 Anomaly Detection

- The system builds feature vectors that summarize **performance behavior**:
  - Execution time
  - Call frequency
  - Rows affected
  - Optionally, buffer I/O statistics
- An anomaly detection model learns the normal distribution of query performance in this feature space.
- Queries or periods of time whose behavior deviates significantly from this learned normality are flagged as **anomalies**, indicating potential regressions or performance incidents that need attention.

### 3.6 Recommendation Generation and Feedback Loop

- Using clustered workloads, predicted execution times, and anomaly scores, the optimization engine identifies:
  - Tables and columns that are repeatedly involved in slow or heavily used queries
  - Workload patterns that would benefit from specific physical design changes (e.g., indexes, partitioning)
- It transforms these findings into **concrete recommendations**, such as:
  - “Create a composite index on `gold.fact_sales(order_date_key, product_key)` to accelerate the dominant sales-reporting workload.”
- Recommendations are stored in `ml_optimization.index_recommendations` and exposed via the `/optimization` API namespace, making them visible in the dashboard.
- When such recommendations are implemented at the database level, subsequent queries run faster or more efficiently, and these improvements:
  - Are captured again by `pg_stat_statements`
  - Re-enter `query_logs`
  - Influence the next training cycle

This continuous **observe → learn → recommend → apply → observe** loop is what turns the warehouse from a statically tuned system into a **self-optimizing data warehouse** that adapts to how it is actually used.

---

## 4. Q&A View of the Workflow (What / Why / How / When / How Often)

This section summarizes the workflow in terms of the questions your professor is likely to ask.

### 4.1 Medallion Data Flow (Bronze / Silver / Gold)

- **What happens?**  
  Raw operational events are ingested into Bronze, standardized into Silver, and modeled into Gold facts and dimensions.

- **Why this design?**  
  - Bronze preserves raw data and lineage.  
  - Silver ensures clean, relationally consistent data.  
  - Gold provides fast, business-friendly schemas for analytics and dashboards.

- **How does it work technically?**  
  - Bronze tables store minimally transformed records with natural keys and timestamps.  
  - Transformation logic reads new Bronze rows, validates and normalizes fields, resolves foreign keys, and writes to Silver tables.  
  - Modeling logic joins and aggregates Silver tables to build denormalized fact and dimension tables in Gold.

- **When do these steps run?**  
  After new source data arrives, Bronze is populated; then Bronze→Silver and Silver→Gold flows are executed to bring Silver and Gold up to date.

- **How often?**  
  In a realistic deployment: on a schedule (e.g. hourly or nightly), or triggered by data arrival events; conceptually: “whenever there is enough new data that analytics should be refreshed.”

### 4.2 API and Dashboard

- **What happens?**  
  A FastAPI backend exposes the warehouse and monitoring data as REST endpoints; a React dashboard calls those endpoints to visualize warehouse state and business metrics.

- **Why is this layer needed?**  
  - To separate storage/processing concerns from presentation and control.  
  - To provide a unified interface for querying warehouse health, performance, and optimization status.

- **How does it work technically?**  
  - Each endpoint corresponds to one or more SQL queries over warehouse schemas and PostgreSQL system views.  
  - The dashboard uses a centralized HTTP client to consume these endpoints and render cards, charts, and tables.

- **When is it used?**  
  Whenever operators, students, or tools need to inspect the warehouse—e.g. when the dashboard is opened, or when external monitoring tools call the API.

- **How often?**  
  - Read operations can be as frequent as desired (e.g., every few seconds for ETL job status, or on page load for dashboards).  
  - The API is stateless and read-mostly, so repeated reads do not alter warehouse state.

### 4.3 Workload Observation and ML Optimization

- **What is being optimized?**  
  Query performance and physical design (primarily indexing, with room for future partitioning and caching decisions) based on observed workloads.

- **Why do clustering, prediction, and anomaly detection?**  
  - **Clustering** groups queries into workload types so optimizations can be targeted to the most impactful patterns.  
  - **Query-time prediction** provides a learned cost model that can estimate how slow a query is likely to be.  
  - **Anomaly detection** automatically spots regressions and unusual behavior without manual thresholds.

- **How does the system know *when* to learn?**  
  - It periodically inspects the `ml_optimization.query_logs` table.  
  - If there are enough recent records with meaningful metrics (e.g. non-zero execution times), a training pass is run; otherwise, learning is deferred.  
  - This ensures models are trained on representative, up-to-date workloads.

- **How does each ML step work technically (at a high level)?**  
  - **Clustering**: convert SQL text into feature vectors (length, word count, presence of `JOIN`, `WHERE`, `GROUP BY`, `ORDER BY`, etc.), then cluster those vectors to identify workload groups.  
  - **Query-time prediction**: pair those features with observed execution times, train a regression model to predict execution time from features.  
  - **Anomaly detection**: build feature vectors from performance behavior (time, calls, rows, I/O), fit an anomaly detector that learns the normal distribution and flags outliers.

- **When and how often does learning happen?**  
  - At regular intervals or after enough new query activity has accumulated (depending on deployment policy).  
  - Every training pass is gated by simple data sufficiency checks in `query_logs` to avoid training on too little or stale data.

- **What happens after learning, and why does it matter?**  
  - The optimization engine uses the learned models plus current logs to generate concrete recommendations (e.g., new indexes on hot columns).  
  - These recommendations are stored in `ml_optimization.index_recommendations` and exposed via the `/optimization` API and dashboard.  
  - Once applied, they typically reduce query latency or resource usage, which is then observed again in future logs—closing the feedback loop and enabling the system to adapt over time.






