## Abstract

This project implements an AI-powered, self-optimizing data warehouse on top of PostgreSQL using a medallion architecture (Bronze → Silver → Gold). The system ingests raw operational data, transforms it into analytics-ready fact and dimension tables, exposes it through a REST API, and visualizes it via a React-based monitoring dashboard. Beyond traditional warehousing, it continuously observes its own query workload, collects execution statistics, and applies machine learning techniques—workload clustering, query-time prediction, and anomaly detection—to generate data-driven optimization recommendations such as index candidates. This closed feedback loop allows the warehouse to reason about its performance and suggest structural changes that can improve query latency, resource utilization, and overall efficiency over time.

---

## Introduction

Modern analytical systems face two simultaneous challenges: handling increasing data volume and complexity, and adapting to highly dynamic query workloads. Traditional data warehouses are typically statically tuned: DBAs design schemas, create indexes, and periodically revisit performance issues manually. This approach does not scale well as workloads evolve. The goal of this project is to prototype a **self-optimizing data warehouse** that combines classical warehousing best practices with an automated feedback and learning loop.

The core of the system is a PostgreSQL database organized into three logical layers:

- **Bronze**: Raw, ingested data from operational systems or synthetic generators; minimally transformed and used as a staging area.
- **Silver**: Cleaned, standardized, and conformed data with enforced keys, types, and constraints.
- **Gold**: Star-schema style analytical layer containing fact and dimension tables optimized for BI and dashboard queries.

Around this core, the project builds three additional components:

- A **data generation and ETL pipeline** that populates the Bronze layer with realistic e-commerce style data (customers, products, orders, inventory, reviews, sessions, clickstream) and incrementally moves it to Silver and Gold.
- A **FastAPI backend and React monitoring dashboard** that expose and visualize warehouse state—row counts, table sizes, sales metrics, data freshness, storage utilization, alerts, and optimization recommendations.
- An **ML optimization engine** that observes query logs, trains models on real workload behavior, and produces optimization recommendations (e.g., index suggestions) which can be inspected and, in a production setting, automatically or semi-automatically applied.

By integrating these layers, the system demonstrates how a warehouse can (1) ingest and transform data, (2) provide observability and analytics, and (3) learn from its own usage to drive continuous performance tuning.

---

## System Workflow

### 1. Data Ingestion and Medallion Architecture

1. **Schema provisioning**  
   The project begins by creating PostgreSQL schemas `bronze`, `silver`, and `gold` using a comprehensive DDL file (`data-warehouse/schemas/complete_warehouse.sql`). This file defines all required staging tables, conformed tables, and star-schema fact/dimension tables, as well as relationships between them.

2. **Bronze population**  
   Raw data is loaded into the Bronze layer either from external sources or from the built-in **data generator**. The data generator simulates an e-commerce workload by synthesizing customers, products, orders and order items, inventory movements, product reviews, user sessions, and clickstream events. These records are written into appropriately designed Bronze tables, preserving source-system semantics and timestamps.

3. **Bronze → Silver → Gold ETL**  
   A single ETL driver script (`etl/scripts/run_etl.py`) orchestrates the movement of data through the medallion layers:
   - **Bronze to Silver**: Reads new rows from Bronze, cleans and standardizes values, enforces data types and key constraints, and resolves foreign keys (e.g., linking orders to customers and products). The ETL ensures dependency order (dimensions before facts) and uses idempotent operations (`ON CONFLICT DO NOTHING`) to support incremental runs.
   - **Silver to Gold**: Aggregates Silver data into analytical structures: customer and product dimensions, sales facts, order facts, and pre-aggregated summaries such as daily sales. The Gold layer is the primary source for dashboards and BI queries.

The result is a fully populated warehouse where each layer has a clear purpose: Bronze for ingestion, Silver for cleaning and conformance, and Gold for fast analytics.

### 2. API and Monitoring Layer

4. **Backend service (FastAPI)**  
   A FastAPI application (`ml-optimization/api/main.py`) connects to the same PostgreSQL instance and exposes a versioned REST API under `/api/v1`. Dedicated route modules provide endpoints for:
   - **Warehouse metadata and analytics** (`/warehouse/...`): schema and table listings, row counts, table sizes, sales statistics, top products, and customer statistics, primarily derived from the Gold layer.
   - **ETL monitoring** (`/monitoring/...`): ETL job status, pipeline DAG, data freshness, error tracking, and throughput metrics using the `monitoring` schema and PostgreSQL system views.
   - **Storage and performance** (`/storage/...`): per-table and per-schema storage usage, growth trends, compression estimates, cache hit rates, connection statistics, and cost estimation.
   - **Alerts and anomalies** (`/alerts/...`): automatically derived alerts for empty or oversized tables, high dead-tuple ratios, low cache hit rates, and unusual table footprints.
   - **Optimization** (`/optimization/...`): optimization recommendations and query performance summaries based on ML outputs and query logs.

5. **Monitoring dashboard (React)**  
   The **monitoring-dashboard** React application consumes these APIs via a centralized client (`apiService`). It renders:
   - A **Data Warehouse Dashboard** that presents the medallion architecture (Bronze/Silver/Gold), total records and tables, sales KPIs, sales trends, and top products, all sourced from `/warehouse/...` endpoints.
   - Additional views for ETL pipeline status, data freshness, data quality, storage and cost, active alerts, historical incidents, and optimization recommendations.

This API + UI layer provides both high-level observability and drill-down capabilities, enabling users and evaluators to see how the warehouse behaves over time.

### 3. ML Optimization Workflow

6. **Workload observation and query logging**  
   As the warehouse is queried—either by dashboards, analytical tools, or ad-hoc SQL—PostgreSQL’s `pg_stat_statements` extension records execution statistics such as query text, average execution time, number of calls, and rows processed. A query-log collection component periodically extracts these metrics and persists them in the `ml_optimization.query_logs` table, converting transient statistics into a historical workload dataset.

7. **Model training: clustering, prediction, anomaly detection**  
   When a sufficient volume of fresh query logs is available, the ML training pipeline performs a joint training pass:
   - **Workload clustering** groups similar queries based on features derived from their SQL text (length, presence of joins, filters, group-by, etc.) so that distinct workload types can be identified (e.g., simple lookups vs. heavy analytical joins).
   - **Query-time prediction** fits a regression model that predicts execution time from query features, enabling the system to estimate performance for new or modified queries and to reason about the benefit of proposed optimizations.
   - **Anomaly detection** learns what “normal” performance looks like in the feature space (execution time, calls, rows affected, etc.) and flags outliers whose behavior deviates significantly, indicating potential regressions or problematic queries.

8. **Recommendation generation and exposure**  
   Using the trained models and the latest query logs, an optimization engine produces concrete recommendations, such as:
   - Candidate indexes on frequently filtered or joined columns.
   - Tables or workloads that are strong candidates for partitioning or other physical design changes.
   These recommendations are stored in `ml_optimization.index_recommendations` and exposed via the `/api/v1/optimization/recommendations` endpoint. The monitoring dashboard visualizes them so users can review and, in a production setting, approve or apply them.

9. **Feedback loop and self-optimization**  
   Once recommendations are applied (e.g., indexes created), subsequent queries see improved execution characteristics. These improvements are captured again in `pg_stat_statements` and `query_logs`, feeding back into the next training cycle. Over time, this loop—observe → learn → recommend → apply → observe—allows the system to adapt its physical design to actual workloads, embodying the notion of a **self-optimizing data warehouse** rather than a static, manually tuned system.







