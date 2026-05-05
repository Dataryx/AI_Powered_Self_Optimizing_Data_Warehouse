# Literature Review, Methodology, and System Architecture

This chapter supports the final project report for the **AI-Powered Self-Optimizing Data Warehouse**. It reviews concepts and prior practice that motivate the design (Section 1), documents how the prototype was implemented and assessed (Section 2), and describes how software components are organized and interact (Section 3).

---

## 1. Literature Review

### 1.1 Purpose of the review

The project combines a classical data warehouse pipeline with workload observation and machine-assisted physical design. This section relates those elements to established data-management practice and to research on autonomic databases and learned performance models, without claiming novelty at the level of database theory; the contribution of the work is an integrated, demonstrable system.

### 1.2 Data warehousing and layered (medallion) architectures

Enterprise analytics historically separated operational systems from decision-support databases. Modern platforms often retain **raw** history while progressively refining data into **cleansed** and **analytics-ready** forms. The **medallion architecture** names three such layers: **Bronze** for source-aligned or minimally transformed landing data; **Silver** for conformed entities, consistent keys, and data-quality rules; and **Gold** for curated structures optimized for reporting and BI—commonly **star** or **snowflake** schemas built from facts and dimensions, consistent with dimensional modeling (Kimball-style design). Deploying Bronze, Silver, and Gold within a single **PostgreSQL** instance, as in this project, follows widespread “warehouse in Postgres” and **lakehouse**-style patterns where one engine holds both landing and curated relations.

### 1.3 Workload analysis and PostgreSQL instrumentation

**Physical database design**—indexes, partitioning, materialized views—traditionally rests on **workload analysis**: which queries recur, which predicates and join keys dominate cost, and how much storage or maintenance overhead is acceptable. Production systems expose **runtime statistics** so administrators need not rely only on synthetic benchmarks. In PostgreSQL, the **`pg_stat_statements`** extension records, per normalized query text, aggregates such as **number of calls**, **total and mean execution time**, and **buffer read/hit** counters. That design supports retrospective characterization of the workload actually executed against the warehouse, which is the empirical basis for both manual tuning and automated assistance.

### 1.4 Self-tuning databases and machine learning

Research on **autonomic** and **self-tuning** databases investigates closed loops from measurement to configuration change, often using the optimizer’s cost model or feedback from executed plans. **Machine learning** has been applied to **cardinality estimation**, **learned cost models**, **knob tuning**, **index recommendation**, and **anomaly detection** over query streams. For **tabular** features derived from logs—latency moments, call frequency, I/O proxies—**ensemble tree methods** (random forests, gradient boosting, implementations such as **XGBoost**) are a standard choice because they model non-linear interactions and mixed feature scales without extensive manual feature engineering. **Supervised regression** on observed execution time supports ranking and explanation of “expensive” query families. **Heuristic** or rule-based analysis of query text (e.g., repeated `WHERE` columns) remains a practical complement when proposing concrete **DDL** such as `CREATE INDEX`. The project adopts this split: learned models support **estimation and prioritization**; separate recommendation logic maps patterns to **index** (and related) suggestions.

### 1.5 Monitoring, APIs, and human oversight

Operational warehouses require **monitoring** of ETL health, **data freshness**, **quality**, **storage**, and **alerts**. Web **dashboards** and **REST APIs** are the usual interface for operators; **WebSockets** or similar push channels support near–real-time status. Physically impactful changes (large indexes, partition changes) are typically subject to **approval** rather than fully autonomous application. The reported system aligns with that pattern: recommendations are surfaced through a UI backed by an API; applying changes completes a **feedback loop** when subsequent executions refresh `pg_stat_statements` and downstream logs.

### 1.6 Summary

In summary, the literature and industry baseline support (i) a **medallion** warehouse in PostgreSQL, (ii) **workload capture** via `pg_stat_statements`, (iii) **ML-assisted** analysis alongside **heuristic** recommendations, and (iv) **observability** and **human-in-the-loop** control.

---

## 2. Methodology

### 2.1 Objectives and evaluation stance

The objective was to design and implement an **end-to-end prototype** in which data flows through **Bronze → Silver → Gold**, query statistics are **persisted** for analysis, **models** are trained on those statistics, and **optimization guidance** is delivered through a **service layer** and **dashboard**. The methodology is **design and engineering evaluation**: success is demonstrated by a **working pipeline**, consistent **API** behavior, and **offline** assessment of models and recommendations. A formal **user study** or long-running **production** trial was out of scope for the course project.

### 2.2 Database schema and data preparation

The warehouse schema was defined in project **DDL** (e.g., complete warehouse SQL). PostgreSQL schemas include **`bronze`**, **`silver`**, and **`gold`** for the medallion layers; **`ml_optimization`** for query logs, recommendations, and related ML metadata; and **`monitoring`** for ETL and operational metadata. **Synthetic e-commerce** data were generated (customers, products, orders, and related entities) and loaded into **Bronze**. An **incremental ETL** process then promoted data to **Silver** (cleansed/conformed) and **Gold** (facts, dimensions, aggregates suitable for dashboard analytics).

### 2.3 Workload logging

A **Query Log Collector** (Python, using **psycopg2**) connects to the same database instance, reads rows from **`pg_stat_statements`** (and associated fields), and inserts **normalized** records into **`ml_optimization.query_logs`**. Stored attributes include query hash and text (or template), **call counts**, **min/mean/max/total execution time**, **standard deviation** where available, **rows** affected, and **shared/local/temporary buffer** statistics. The collector may apply **filters**—for example, restricting to SQL patterns relevant to the dashboard or warehouse, or minimum time thresholds—to reduce noise in downstream training.

### 2.4 Feature engineering and predictive modeling

Training data were derived from **`query_logs`**. Features encode **frequency**, **latency**, and **resource** proxies suitable for regression. The **Query Time Predictor** module implements **supervised** learners configurable among **XGBoost**, **Random Forest**, and **Gradient Boosting** regressors, with configuration centralized (e.g., model type, estimators, depth, learning rate). **Feature scaling** (e.g., **StandardScaler**) is applied where the pipeline specifies it. Models are evaluated on **held-out** data using standard regression metrics (e.g., **MAE**, **RMSE**, **R²**). Trained parameters are **serialized** to disk (e.g., under `ml-optimization/saved_models/`) for reuse by training scripts and any inference paths wired into the API. Additional analysis components in the codebase (e.g., workload characterization) may **cluster** or **highlight** outliers to support interpretation.

### 2.5 Recommendation generation

Separate **scripts** scan **`query_logs`** (and optionally schema metadata) for **recurring access paths**—for example, frequent filters on date or foreign-key columns—and emit **index** recommendations, with optional extension to **partition** suggestions. Outputs are persisted in **`ml_optimization`** tables (e.g., index recommendation relations) for the API to query. **Qualitative** checks ensure suggestions respect table and column names present in the warehouse. **Quantitative online evaluation** would compare `pg_stat_statements` **before and after** approved `CREATE INDEX` statements; the architecture is intended to support that loop.

### 2.6 Service integration and demonstration

The **ML Optimization API** is implemented with **FastAPI**. Routers are mounted under versioned prefixes such as **`/api/v1/warehouse`**, **`/api/v1/metrics`**, **`/api/v1/monitoring`**, **`/api/v1/storage`**, **`/api/v1/alerts`**, **`/api/v1/recommendations`**, **`/api/v1/optimization`**, and **WebSocket** routes under **`/api/v1`**. The server is run with **Uvicorn** (e.g., via **`start_services.py`**), with path setup that loads the `ml-optimization` package layout on the host platform. **React** applications (Vite-based builds) consume JSON over HTTP and, where implemented, subscribe to WebSocket feeds for live optimization or monitoring panels. For demonstration resilience, the UI may **fall back to mock data** when the API is unreachable.

### 2.7 Summary of methodology

The methodology proceeds in order: **schema and load → ETL → query execution → log collection → offline training and recommendation generation → API and UI integration**, with evaluation emphasizing **functional correctness** and **offline model metrics**.

---

## 3. System Architecture

### 3.1 Design principles

The architecture is **database-centric**: **PostgreSQL** holds authoritative **business data**, **workload history**, and **optimization artifacts**. Application processes (**collectors**, **trainers**, **API**, **front end**) are largely **stateless** with respect to that data, which simplifies recovery and redeployment. **Separation of concerns** isolates ETL, batch ML, synchronous API queries, and interactive visualization.

### 3.2 Logical layers

| Layer | Responsibility |
|--------|----------------|
| **Data generator** | Produces synthetic transactional data and loads **Bronze**. |
| **ETL subsystem** | Incremental transforms: **Bronze → Silver → Gold**; updates monitoring metadata as designed. |
| **Database server** | Hosts medallion schemas, **`ml_optimization`**, **`monitoring`**, and extensions (e.g., **`pg_stat_statements`**). |
| **ML subsystem** | Python modules and scripts: collection, training, recommendation generation; read/write **`ml_optimization`**. |
| **API tier** | **FastAPI** application: executes SQL, aggregates results, returns JSON; **WebSocket** endpoints for push updates. |
| **Presentation tier** | **React** SPA(s): warehouse overview, analytics, monitoring, storage, alerts, optimizations. |

### 3.3 Data and control flows

1. **Ingestion**: New or updated rows are inserted into **Bronze** (via generator or loaders).  
2. **Transformation**: **ETL** jobs advance eligible rows to **Silver** and **Gold**.  
3. **Consumption**: Users and dashboards issue **SQL** against **Gold** (and related schemas).  
4. **Observation**: The planner records statistics in **`pg_stat_statements`**; the **collector** persists snapshots in **`query_logs`**.  
5. **Learning**: **Batch jobs** fit regressors and write **recommendations** to optimization tables.  
6. **Presentation**: The **API** reads catalogs, metrics, and recommendations; the **UI** renders them.  
7. **Action (optional)**: Approved **DDL** (e.g., index creation) changes physical design.  
8. **Feedback**: Subsequent queries update **`pg_stat_statements`**, renewing the **self-optimization** cycle.

### 3.4 API surface (conceptual map)

- **Warehouse**: schema list, per-schema tables, row counts, sizes, summaries for medallion layers.  
- **Metrics / monitoring**: query performance, ETL and pipeline health, freshness and quality indicators.  
- **Storage / alerts**: capacity-style metrics and alert configuration or status.  
- **Recommendations / optimization**: ranked or listed suggestions, history, and apply-related workflows where implemented.  
- **WebSocket**: incremental updates for monitoring or optimization dashboards.

### 3.5 Deployment view

The **reference deployment** uses **one PostgreSQL instance** co-located or network-accessible to the development machine. The **API** process binds to a configured host and port (e.g., **8000**); **OpenAPI** documentation is available at **`/docs`**. **React** clients run in development mode or as static builds served separately. **Trained model files** reside on the filesystem under the **`ml-optimization`** tree. This topology is appropriate for coursework and can be extended with containers, secrets management, or read replicas for production-like scenarios.

### 3.6 Summary

The system architecture integrates **medallion warehousing**, **workload telemetry**, **batch ML**, and **interactive monitoring** around a single **PostgreSQL** core, with clear boundaries between **ETL**, **analytics**, **optimization**, and **presentation** tiers.

---

## Closing note

Together, these sections document the **conceptual basis**, **implementation method**, and **structural layout** of the AI-powered self-optimizing data warehouse as required for the project report.
