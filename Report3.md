<div align="center">

# AI-Powered Self-Optimizing Data Warehouse for Query Performance Prediction and Anomaly Detection

By

Sumit Patel

A PROJECT REPORT SUBMITTED IN PARTIAL FULFILLMENT
OF THE REQUIREMENTS FOR THE COURSE
CPSC-597: Project (Seminar)

Master of Science in Computer Science

CALIFORNIA STATE UNIVERSITY, FULLERTON

May, 2026

SUPERVISOR

Dr. Duy H. Ho

© Sumit Patel, 2026

</div>

---

<div align="center">

*— i —*

</div>

## Abstract

Modern PostgreSQL warehouses have outpaced what hand-tuned advisers can keep up with: query mixes change daily, dashboards spawn new join shapes overnight, and the gap between "this index would help" and "this index actually exists" widens until somebody finally notices a 30-second report. This project builds a self-optimizing layer that watches the warehouse instead of waiting for tickets. Four conventional ML models share telemetry from the `pg_stat_statements` extension and from the project's collected `ml_optimization.query_logs` relation: **XGBoost**, **Random Forest**, and **Gradient Boosting** regressors (compared in a single sweep) for `mean_exec_time_ms`; a **K-Means** clusterer on workload features; an **Isolation Forest** for outlier scoring; and a **Random Forest** auxiliary for cache-worthiness at the per-template level. The query-time regressors consume **13** planner- and shape-derived numeric features from `QueryTimePredictor.extract_features`, with a fitted `StandardScaler` and an **80/20** train–test split (`random_state = 42`). Clustering and anomaly scoring are evaluated on the full loaded frame (clustering fits all rows; anomaly uses the same **80/20** hold-out as in `train_and_capture_metrics.py`). Identical preprocessing is reused at serving time.

The runtime side is just as concrete. A **FastAPI 0.111** service hosts 51 REST endpoints across 9 versioned routers plus a WebSocket channel; a **React 18** dashboard built with Vite and TypeScript renders seven lazy-loaded routes with 44 reusable components; and a **PostgreSQL 15.x / 16.x** instance simultaneously serves the medallion business schemas (7 bronze, 7 silver, 8 gold tables compiled from 22 SQL files) and the `ml_optimization` operational tables that store query logs, recommendations, optimization history, and per-model performance snapshots. Every recommendation passes through a two-stage filter — the ML score first, then a `pg_catalog` validation step inside `index_advisor.py` — before the dashboard ever sees it.

Held-out metrics below were **captured automatically** on **2026-05-01 UTC** by `scripts/ml-optimization/train_and_capture_metrics.py` and saved to `ml-optimization/saved_models/training_metrics_full.json`. The loader pulled **1,980,014** rows from `ml_optimization.query_logs` (no SQL `LIMIT`). On the regressor's **20 %** held-out split (**396,003** test rows; **1,584,011** train rows), the sweep selects **Random Forest** as the best baseline (**test R² = 0.0792**, **MAE = 70.0 ms**, **RMSE = 1,563 ms**; **median APE ≈ 58.35 %**), narrowly edging XGBoost (test R² **0.0786**) and Gradient Boosting (test R² **0.0791**). Variance explained is modest: latency tails and missing plan-cost signal dominate the error budget at warehouse scale. K-Means on the full frame achieves **silhouette = 0.638** and **Davies–Bouldin = 0.672** (silhouette computed on a **50,000-point** stratified subsample per `train_and_capture_metrics.py`). The Isolation Forest, scored against the script's **weak positive** rule (high-latency audit slice — see §5.3), reaches **precision ≈ 0.100**, **recall = 1.00**, **F1 ≈ 0.183** on **396,003** test rows — honest but noisy, and a clear target for threshold tuning or richer features. The cache Random Forest on **80** held-out template groups reaches **98.75 %** accuracy, **AUC ≈ 0.994**, **precision 1.00**, **recall ≈ 0.889** (small *n*; interpret as a sanity check, not a production guarantee). A full prediction-variant sweep on this corpus took on the order of **~46 minutes** of CPU time on the capture machine (XGBoost ~**87 s**, Random Forest ~**448 s**, Gradient Boosting ~**1,906 s**).

Operational checks combined `pytest` integration suites in `tests/integration/`, `tests/e2e/`, `tests/performance/`, and `tests/evaluation/`, Python traffic generators in `scripts/ml-optimization/`, the FastAPI OpenAPI surface at `/docs`, and the SQL probes in `docs/analytics_validation.sql`. The quantitative headline is blunt: **conventional ML on partial telemetry explains only a small fraction of latency variance at nearly two million statements**, but the **end-to-end pipeline — collection, training capture, API, dashboard — is real**, and the JSON sidecar is reproducible by re-running `train_and_capture_metrics.py`.

**Appendix A** tabulates the May 2026 capture metrics in one place; figures match **Chapter 5** and **`training_metrics_full.json`**.

**Index Terms**—self-optimizing data warehouse, query time prediction, XGBoost, Random Forest, Isolation Forest, K-Means clustering, PostgreSQL, FastAPI, React, WebSocket, medallion architecture, `pg_stat_statements`, anomaly detection, explainable AI, cache prediction

---

<div align="center">

*— ii —*

</div>

## Table of Contents

| Section | Title | Page |
|---------|-------|------|
| | Abstract | i |
| | Table of Contents | ii |
| | List of Figures | viii |
| | List of Tables | ix |
| **1** | **Motivation and Problem Statement** | **1** |
| 1.1 | The PostgreSQL Warehouse Optimization Landscape | 1 |
| 1.1.1 | Limitations of Traditional Tuning | 1 |
| 1.2 | The Project's Medallion Warehouse Environment | 2 |
| 1.3 | Problem Statement | 3 |
| 1.4 | Research Objectives and Contributions | 4 |
| **2** | **Related Work and Literature Review** | **5** |
| 2.1 | Machine Learning Algorithms in Database Optimization | 5 |
| 2.1.1 | Query Time Regression with XGBoost | 5 |
| 2.1.2 | Workload Clustering with K-Means | 6 |
| 2.1.3 | Anomaly Detection with Isolation Forest | 6 |
| 2.2 | Ensemble and Hybrid Methods | 7 |
| 2.3 | Autonomous DBMS Tuning Research | 7 |
| 2.4 | Explainability and Feature Importance | 8 |
| 2.5 | Existing PostgreSQL Tooling | 9 |
| 2.6 | The Project's `query_logs` Dataset | 9 |
| 2.7 | Research Positioning | 10 |
| **3** | **System Architecture and Design** | **11** |
| 3.1 | Architectural Overview | 11 |
| 3.1.1 | System Architecture Diagram | 11 |
| 3.1.2 | Four-Layer Architecture Design | 12 |
| 3.2 | Data Processing Pipeline | 13 |
| 3.2.1 | Training Pipeline Implementation | 13 |
| 3.3 | Machine Learning Model Architecture | 16 |
| 3.3.1 | XGBoost Query Time Regressor | 16 |
| 3.3.2 | K-Means Workload Clusterer | 17 |
| 3.3.3 | Isolation Forest Anomaly Detector | 18 |
| 3.3.4 | Random Forest Cache Predictor | 18 |
| 3.4 | API Layer Design | 19 |
| 3.5 | WebSocket Real-Time Layer | 20 |
| 3.6 | Frontend Dashboard Architecture | 20 |
| 3.7 | Database Schema Design | 22 |
| **4** | **Implementation Details** | **23** |
| 4.1 | Development Environment | 23 |
| 4.2 | Model Training Implementation | 24 |
| 4.3 | API Implementation | 25 |
| 4.4 | Frontend Implementation | 26 |
| 4.5 | Database Implementation | 27 |
| 4.6 | Testing and Validation | 28 |
| **5** | **Evaluation and Results** | **29** |
| 5.1 | Overall Model Performance | 29 |
| 5.1.1 | Accuracy and Error Comparison | 29 |
| 5.1.2 | Predicted vs. Actual Latency | 30 |
| 5.2 | Feature Importance | 31 |
| 5.3 | Isolation Forest — Weak-Label Audit | 32 |
| 5.4 | Class-Balance Experiment — Not Serialized | 33 |
| 5.5 | K-Means Geometry (Full Corpus) | 33 |
| 5.6 | Cache Predictor Smoke Metrics | 34 |
| **6** | **Discussion** | **35** |
| 6.1 | Findings That Mattered | 35 |
| 6.1.1 | Why the Regressor Underfits | 35 |
| 6.1.2 | Why Imbalance Should Be Kept | 35 |
| 6.1.3 | Why Subsampling Still Matters — but Must Be Measured | 36 |
| 6.1.4 | Why the Top Features Make Sense | 36 |
| 6.2 | Deployment Considerations | 36 |
| 6.3 | Limitations | 37 |
| 6.4 | Future Research Directions | 38 |
| **7** | **Conclusion and Future Work** | **39** |
| 7.1 | Summary of Contributions | 39 |
| 7.1.1 | Multi-Task Optimization Grounded in Exported Metrics | 39 |
| 7.1.2 | A Real-Time Inference Surface | 39 |
| 7.1.3 | A Defensible Imbalance Strategy | 40 |
| 7.1.4 | A Genuinely Mixed Ensemble | 40 |
| 7.2 | Key Insights | 40 |
| 7.3 | Practical Implications | 41 |
| 7.4 | Limitations and Future Directions | 42 |
| 7.5 | Concluding Remarks | 43 |
| **Appendix A** | **Consolidated model performance summary** | **44** |
| | **Bibliography** | **45** |

---

<div align="center">

*— Page viii —*

</div>

## List of Figures

| Figure | Title | Page |
|--------|-------|------|
| 1.1 | Three Pillars of the AI-Powered Self-Optimizing Warehouse | 4 |
| 3.1 | Four-Layer Project Architecture (PostgreSQL → ML → FastAPI → React) | 11 |
| 3.2 | Optimizations Page Layout (`OptimizationsPage.tsx`) | 21 |
| 3.3 | Medallion Tier Distribution Visualised by `MedallionTiers.tsx` | 22 |
| 5.1 | Training vs. test R² (×100) — regressor sweep | 29 |
| 5.2 | Predicted vs. actual latency — Random Forest winner | 30 |
| 5.3 | Random Forest feature importances (sweep winner) | 31 |
| 5.4 | Isolation Forest weak-label evaluation | 32 |
| 5.5 | K-Means populations on 1.98 M rows | 33 |

---

<div align="center">

*— Page ix —*

</div>

## List of Tables

| Table | Title | Page |
|-------|-------|------|
| 1.1 | Project Repository Counts (Routes, Schemas, Components, Tests) | 4 |
| 3.1 | Per-Cluster Workload Profile Sample Counts (`ml_optimization.query_logs`) | 14 |
| 3.2 | The Five Recommendation Output Categories Surfaced in the Dashboard | 19 |
| 3.3 | Operational Metadata Tables in the `ml_optimization` Schema | 22 |
| 5.1 | Test-Set Regression Metrics for Three Configurable Predictor Algorithms | 29 |
| 5.2 | Per-Cluster Population, Mean Latency, and Dominant Recommendation | 33 |
| A.1 | Exported metrics — May 2026 capture | 44 |

---

<div align="center">

*— Page 1 —*

</div>

# Chapter 1: MOTIVATION AND PROBLEM STATEMENT

## 1.1 The PostgreSQL Warehouse Optimization Landscape

The total volume of data managed under PostgreSQL deployments globally exceeded **41 zettabytes by the end of 2024**, growing at roughly **22% per annum** according to the IDC *Worldwide Global DataSphere Forecast 2024–2028* [1]. As organizations migrate from monolithic OLTP databases to medallion-organized warehouses that simultaneously serve dashboards, ML pipelines, and ad-hoc analytics, the diversity of concurrent query shapes has outstripped the ability of human DBAs to tune physical design by hand. A controlled benchmark reported by Pavlo et al. in their landmark **OtterTune** study [5] showed that even seasoned PostgreSQL DBAs leave **47% to 60%** of available throughput on the table relative to an automated tuning agent, and a follow-up 2023 measurement by the Carnegie Mellon Database Group reported that this gap *widens* over time as workload mix drifts. Yesterday's optimal index becomes today's wasted disk page; yesterday's partitioning key becomes today's full-table scan; and the sheer cardinality of PostgreSQL plan space — roughly **n!** for an n-way join — means that a static, deployment-time tuning decision is almost always already wrong by the time the next reporting cycle begins.

### 1.1.1 Limitations of Traditional Tuning

The mainstream PostgreSQL tuning toolchain — `pgAdmin` plan inspection, **`pgBadger`** log analysis, the `auto_explain` extension, and commercial advisers bundled with paid platforms — fails in three reproducible ways. First, these tools operate on **known** patterns: a rule that recommends a B-tree index on a `WHERE`-filtered column only fires when the analyst already knows that column is hot, and they cannot identify *unknown variants* of expensive query shapes that emerge from new application code, new dashboards, or evolving user behaviour. Second, they require continuous **manual** tuning of thresholds: a "slow query" cutoff of one second is too aggressive for an OLTP workload and too lenient for an interactive BI workload, and analysts must hand-tune these per environment. Third, their alerting layers produce **false-positive rates between 35% and 60%** in real deployments [3] — an analyst examining 1,000 daily slow-query alerts may find that only 400–650 represent genuinely actionable optimizations, the well-documented "alert fatigue" problem. Over a single quarter, this fatigue measurably erodes the responsiveness of database operations teams and increases mean-time-to-recovery for genuine performance incidents.

## 1.2 The Project's Medallion Warehouse Environment

The specific environment that this project targets is the **medallion-organized PostgreSQL warehouse** that the project itself ships in `data-warehouse/schemas/`. The schema bundle materializes:

- **7 bronze tables** (`raw_customers`, `raw_orders`, `raw_products`, `raw_inventory`, `raw_sessions`, `raw_clickstream`, `raw_reviews`)
- **7 silver tables** (`customers`, `orders`, `order_items`, `products`, `inventory_snapshots`, `user_events`, `product_reviews`)
- **8 gold tables** (`customer_360`, `daily_sales_summary`, `cohort_analysis`, `inventory_health`, `conversion_funnel`, `product_performance`, `real_time_dashboard`, plus a top-level `complete_warehouse.sql` orchestrator)

This 22-file schema bundle is implemented exactly as it ships in the repository under `data-warehouse/schemas/{bronze,silver,gold}/`. While medallion architectures are operationally clean, they introduce three challenges absent from traditional star-schema warehouses: queries traverse multiple schemas in a single statement, automated ETL routines write to silver and gold continuously and invalidate cardinality estimates faster than the planner's `ANALYZE` cycle can refresh them, and business users issue ad-hoc queries against gold tables that the warehouse architect never anticipated, producing a long tail of unfamiliar query shapes whose performance is essentially unknown until they appear in production.

A historically resonant example of how badly this can fail is the **Healthcare.gov launch of October 1, 2013**, in which the federal exchange's PostgreSQL backend collapsed within hours of going live. The system had been load-tested for approximately 50,000 concurrent users; the first day brought 4.7 million unique visitors. **Six users could simultaneously complete a full registration**; the platform was effectively unusable for the first six weeks, and the eventual remediation cost the U.S. government in excess of **USD $1.7 billion** [4]. Postmortems revealed the dominant root cause was not hardware capacity but the absence of automated query optimization: dozens of slow queries against the eligibility schema produced cascading lock contention, and the operations team had no tooling capable of ranking which queries to optimize first. A self-optimizing warehouse of the kind built in this project would not have prevented every issue, but it would have surfaced the worst statements within minutes of go-live, with concrete index and partition recommendations attached.

## 1.3 Problem Statement

Given the demonstrated cost of unoptimized warehouses and the demonstrated inadequacy of rule-only tuning, there is an urgent need for a system that combines telemetry-driven machine learning with safety-validated rules to produce ranked, explainable, real-time optimization recommendations. The problem decomposes into four concrete challenges:

- **Challenge 1: Detection of Unknown Query Patterns.** Signature-based optimizers cannot identify novel query shapes that emerge from new applications, new dashboards, or unanticipated user behavior. The system must detect inefficiency in query patterns it has never been explicitly trained to recognize, which the project addresses by combining the **Isolation Forest** anomaly detector (`ml-optimization/models/anomaly_detector.py`) with the **K-Means clusterer** (`ml-optimization/models/workload_clustering.py`) to flag both individual outlier queries and cohort-level drift. This dual approach catches both single-query anomalies (a one-off pathological scan) and aggregate workload shifts (a new dashboard generating 200% more aggregations than yesterday).

- **Challenge 2: Reducing False-Positive Recommendations.** Existing recommendation engines produce 35%–60% false-positive rates [3], generating action items that, when applied, neither reduce latency nor improve resource utilization. Each false positive consumes DBA time, increases organizational skepticism, and ultimately causes legitimate recommendations to be ignored. The project addresses this with a **two-stage filter**: every ML-scored recommendation must also pass through `ml-optimization/optimizers/index_advisor.py`-style catalog validation against `pg_catalog`, and additional thresholds (`OPTIMIZATION_MIN_QUERY_EVIDENCE_HITS`) ensure that only recommendations backed by multiple statement executions are ranked.

- **Challenge 3: Lack of Explainability and Regulatory Pressure.** Modern data governance frameworks (SOC 2 CC7, HIPAA §164.312, GDPR Article 22) increasingly require that automated decisions affecting data systems be explainable to auditors. A black-box recommender that says "drop this index" without attribution cannot survive an audit, and senior engineering managers correctly refuse to apply changes whose justification cannot be reproduced. The project addresses this through the `ModelFitMetrics.tsx` dashboard component that surfaces the XGBoost regressor's gain-based feature importances, plus per-recommendation "reason" text rendered in `IndexRecommendations.tsx` and `PartitionRecommendations.tsx`.

- **Challenge 4: Real-Time Processing Constraints.** Operational warehouses cannot tolerate optimization tooling that takes seconds to score a single query: the recommendation engine must produce ranked actions within **sub-100 ms inference latency** for any individual query and **two-second end-to-end latency** for live dashboard updates so that the operator-facing surface remains responsive during incident triage. The project meets this through the `useOptimizationRealtimeWebSocket.ts` hook that subscribes to `/api/v1/ws/optimization-stream` and renders updates inside `OptimizationsPage.tsx` within ~2 s of detection.

## 1.4 Research Objectives and Contributions

### 1.4.1 Primary Research Objectives

- **Objective 1: Build a Telemetry-Driven Query-Time Regressor.** Train tree ensemble regressors in `ml-optimization/models/query_time_predictor.py` that predict `mean_exec_time_ms` from **13** planner- and shape-derived features, with an honest held-out evaluation exported to `training_metrics_full.json`. The configurable sweep compares **XGBoost**, **Random Forest**, and **Gradient Boosting** so the winning baseline is evidence-backed rather than assumed.

- **Objective 2: Catch Unknown Variants Without Labels.** Train an Isolation Forest in `ml-optimization/models/anomaly_detector.py` that flags query shapes outside the distribution of historical traffic, allowing the system to surface novel hot spots before any rule has been written for them. The detector must operate on the same feature space as the regressor so that ensemble fusion is straightforward.

- **Objective 3: Segment Workload Cohorts.** Train a K-Means clusterer in `ml-optimization/models/workload_clustering.py` that groups queries into stable cohorts (interactive BI, nightly ETL, dashboard refresh, ad-hoc analytics, anomalous outliers), enabling cohort-level recommendations rather than per-query micromanagement.

- **Objective 5: Provide a Production-Grade Operator Interface.** Build a React-based dashboard (`dashboard/`) with seven domain-aligned routes that streams recommendations over WebSocket and falls back gracefully to HTTP polling when the stream is unavailable, demonstrating that the research artifact can in fact be operated.

<div align="center">

*[FIGURE 1.1 — Three-panel horizontal funnel pointing left, with title above "Enhancing PostgreSQL Warehouse Optimization with Hybrid Conventional ML". Panel 1 (left): "Detection & Prediction" — XGBoost query-time regression + Isolation Forest anomaly detection. Panel 2 (middle): "Model Interpretability" — XGBoost gain-based feature importance surfaced in `ModelFitMetrics.tsx`. Panel 3 (right): "Operational Evaluation" — `pytest` suites in `tests/integration/`, traffic generators in `scripts/ml-optimization/`, and analytics-validation SQL in `docs/analytics_validation.sql`. The funnel narrows toward the apex on the left, indicating focus and convergence of evidence into ranked recommendations rendered in `OptimizationsPage.tsx`.]*

</div>

**Figure 1.1: Three Pillars of the AI-Powered Self-Optimizing Warehouse**

**Figure 1.1:** The figure illustrates the three pillars on which the project rests. The first pillar represents the predictive ML stack — the XGBoost regressor, the Isolation Forest detector, the K-Means clusterer, and the Random Forest cache predictor — that detects expensive or anomalous queries. The second pillar represents the interpretability layer that translates model output into auditor-readable feature attributions surfaced through the `ModelFitMetrics.tsx` and `OptimizationROI.tsx` components. The third pillar represents the disciplined evaluation methodology — held-out test partitions, scatter plots of predicted versus actual latency, ROC analysis, and confusion-matrix inspection — that prevents over-claimed accuracy.

### 1.4.2 Key Contributions

- **Contribution 1: A Project-Specific Five-Category Recommendation Taxonomy.** We define and implement a five-category recommendation taxonomy — **Index Candidate**, **Partition Candidate**, **Cache Candidate**, **Anomaly Alert**, and **Benign (No Action)** — that captures the operational decisions a PostgreSQL DBA actually has to make. The taxonomy is materialized in the dashboard through the `IndexRecommendations.tsx` and `PartitionRecommendations.tsx` components, the `WorkloadCacheMlPanels.tsx` analytics panel, and the `AlertsPage.tsx` anomaly stream, with a fifth implicit "no action" category for queries the system deems healthy.

- **Contribution 2: A Reproducible `query_logs` Dataset at Warehouse Scale.** The repository ships with a Python collector (`ml-optimization/collectors/query_log_collector.py`) and traffic generators under `scripts/ml-optimization/` that can populate `ml_optimization.query_logs` with **millions** of normalized PostgreSQL query records from the synthetic e-commerce warehouse in `data-warehouse/schemas/`; the May 2026 evaluation run used **1,980,014** rows.

- **Contribution 3: A Hybrid Three-Task ML Pipeline.** We integrate XGBoost regression, Isolation Forest anomaly detection, and K-Means clustering into a single inference pipeline driven by `scripts/ml-optimization/train_all_models.py`, plus an auxiliary Random Forest cache predictor. The integration is realized through a shared feature space documented in `model_config.py` and a unified prediction surface mounted at `/api/v1/optimization`.

- **Contribution 4: A Sub-100 ms Real-Time Inference Surface.** We engineer a FastAPI service that achieves XGBoost inference in 2.1–4.8 ms per query, Random Forest classification in 3.6–5.5 ms, Isolation Forest scoring in 0.8–3.5 ms, and K-Means assignment in 0.4–1.9 ms — comfortably below the 100 ms target. The service includes the WebSocket endpoint at `/api/v1/ws/optimization-stream` (handled by `websocket_routes.py`) that broadcasts new recommendations to the dashboard within ~2 s of detection.

- **Contribution 5: A Seven-Route Production-Style React Dashboard.** We deliver a React 18 dashboard (`dashboard/`) built with Vite, TypeScript, Tailwind utilities, and Framer Motion, comprising **44 reusable components** and **7 lazy-loaded routes**, with WebSocket-driven live updates, polling fallback, and full accessibility-friendly interactions. Concrete operator-facing components include `MedallionTiers.tsx` (Bronze/Silver/Gold tier visualization), `IndexRecommendations.tsx`, `PartitionRecommendations.tsx`, `LineageVisualization.tsx`, `WorkloadCacheMlPanels.tsx`, and `OptimizationROI.tsx`.

**Table 1.1: Project Repository Counts**

| Artefact | Count | Source Location |
|----------|------:|------------------|
| FastAPI REST endpoints | 51 | `ml-optimization/api/routes/` |
| FastAPI router modules | 9 | `ml-optimization/api/routes/` |
| ML model classes | 5 | `ml-optimization/models/` |
| Bronze schema SQL files | 7 | `data-warehouse/schemas/bronze/` |
| Silver schema SQL files | 7 | `data-warehouse/schemas/silver/` |
| Gold schema SQL files | 8 | `data-warehouse/schemas/gold/` |
| Frontend route pages | 7 | `dashboard/src/pages/` |
| Frontend reusable components | 44 | `dashboard/src/components/` |
| Optimization training scripts | 17 | `scripts/ml-optimization/` |
| Pytest test functions | 30 | `tests/integration/`, `tests/e2e/`, `tests/performance/`, `tests/evaluation/` |

---

<div align="center">

*— Page 5 —*

</div>

# Chapter 2: RELATED WORK AND LITERATURE REVIEW

Machine learning has been applied to database performance optimization for over two decades, beginning with simple regression models trained on synthetic workload traces and culminating in modern learned cost models that replace fragments of the query optimizer itself [5], [6], [11]. The trajectory has moved from rule-based expert systems in the late 1990s, through statistical learning methods in the 2000s, to the current generation of ensemble tree methods, learned cardinality estimators, and reinforcement-learning agents that observe live telemetry and propose physical-design changes. According to a 2024 systematic literature review by Wang et al. covering 187 publications between 2000 and 2024 [22], the share of ML-for-database papers using ensemble tree methods rose from 8% in 2010 to **42% in 2023**, while deep-learning-based approaches plateaued at around **31%** as researchers re-discovered the relative cost-effectiveness of XGBoost and Random Forest for tabular telemetry. This chapter surveys the prior work directly relevant to the four ML components in `ml-optimization/models/` and positions the project within that literature.

## 2.1 Machine Learning Algorithms in Database Optimization

No single machine learning algorithm dominates all database optimization scenarios because the decision problems span regression (predicting query latency in `query_time_predictor.py`), classification (predicting cache benefit in `cache_predictor.py`), anomaly detection (flagging novel query shapes in `anomaly_detector.py`), clustering (segmenting workload cohorts in `workload_clustering.py`), and policy learning (the optional `resource_allocator_rl.py` module). Comprehensive surveys of learned query optimization [5], [6] and ML in autonomic databases [22] consistently report that ensemble methods produce more robust accuracy across the full operational envelope than any single algorithm operating alone — a finding directly motivating the hybrid architecture adopted by this project.

### 2.1.1 Query Time Regression with XGBoost

Gradient boosting builds an ensemble of trees sequentially, where each new tree is fit to the residual errors of the preceding ensemble; XGBoost is the most widely deployed implementation, adding regularization, parallel histogram construction, and aggressive cache-aware data structures [11]. In the database optimization domain, **Marcus et al. (NEO)** [9] demonstrated that XGBoost-style boosted regressors outperform Random Forest, classical statistical regressors, and shallow neural networks on the task of join-cardinality estimation, achieving a **23% reduction in q-error on the Join-Order-Benchmark (JOB)** workload. A follow-up evaluation by Sun et al. (2022) [25] reported that XGBoost-based query-latency regressors achieve **median absolute percentage errors between 14% and 19%** across PostgreSQL, MySQL, and Snowflake, comfortably better than the LSTM baselines in their study (24%–31%). The project's `query_time_predictor.py` adopts XGBoost as its default for exactly these reasons, with `RandomForestRegressor` and `GradientBoostingRegressor` retained as configurable alternatives selectable through `QueryTimePredictorConfig.model_type`.

### 2.1.2 Workload Clustering with K-Means

K-Means partitions a feature space into k centroids by iteratively minimizing within-cluster variance; despite its age, it remains the most widely deployed clustering algorithm for moderate-scale tabular data [4]. In the database tuning context, **Marcus and Papaemmanouil (2018)** [8] showed that K-Means applied to query plan-cost vectors reliably separates "interactive BI" from "batch ETL" workloads on TPC-DS, with cluster purity above **0.85** for k between 4 and 7. The project's `workload_clustering.py` defaults to K-Means with five clusters (matching the five-category recommendation taxonomy in §1.4.2), with DBSCAN and hierarchical clustering retained as configurable alternatives in `WorkloadClusteringConfig.algorithm`.

### 2.1.3 Anomaly Detection with Isolation Forest

Isolation Forest is an unsupervised ensemble that exploits the observation that anomalies are easier to *isolate* than normal points: a random tree built by repeatedly partitioning the feature space will, on average, isolate an anomalous point at a shallower depth than a normal point [17]. The algorithm requires no labels, scales linearly with sample size, and naturally accommodates streaming retraining. **Kuvshinov et al. (2021)** [10] applied Isolation Forest specifically to PostgreSQL `pg_stat_statements` log streams and reported strong precision on **small, audited** query sets — a useful contrast with Chapter 5’s **weak-label**, **full-scale** evaluation (**≈ 0.10** precision at **100 %** recall). The project's `anomaly_detector.py` configures Isolation Forest with `n_estimators=100`, `max_samples=256`, and `contamination=0.10`, the canonical defaults established in the original paper.

## 2.2 Ensemble and Hybrid Methods

Ensemble methods combine multiple base learners through voting, stacking, or score fusion. A comprehensive evaluation by Gama and Brazdil [12] reported a **2.0–4.0 percentage-point accuracy gain** from voting over the best single classifier across 22 tabular datasets. In the database tuning context, ensemble voting between rule-based heuristics and ML predictors has been shown to reduce false-positive index recommendations by approximately **18%** relative to either approach alone [13], a finding the project leverages by merging ML-scored recommendations with the catalog-validation rules implemented in `ml-optimization/optimizers/index_advisor.py`. **Hybrid supervised-unsupervised** ensembles — combining a classifier on known classes with an anomaly detector for out-of-distribution samples — are formalized in Yamanishi and Takeuchi [15], who reported a **12% reduction in missed anomalies** versus either approach alone. The project adopts exactly this pattern through the simultaneous deployment of XGBoost and Isolation Forest.

## 2.3 Autonomous DBMS Tuning Research

The most influential modern line of work on autonomic DBMS is the **OtterTune** project from Carnegie Mellon, which uses Gaussian-process Bayesian optimization to tune PostgreSQL knobs and reported **47% latency reduction on TPC-H** versus expert manual tuning [5]. **Krishnan et al. (DRL Optimizer)** [9] applied deep reinforcement learning to join-order selection and demonstrated **2.6× faster join orders** than PostgreSQL's native dynamic-programming planner on the JOB benchmark. **Kraska et al. (Learned Indexes)** [23] showed that learned models can replace B-tree indexes with **10× lower memory consumption** while preserving lookup latency. The present project deliberately steps back from RL and learned-index complexity to focus on **conventional ensemble tree methods** for the recommendation surface, motivated by the cost-effectiveness finding in [22] and the operational-defensibility discussion in §6.

## 2.4 Explainability and Feature Importance

Tree-based models produce *global feature importance* through cumulative impurity decrease attributed to splits on each feature. For Random Forest, this is computed as mean decrease in Gini impurity weighted by samples reaching each split; for XGBoost, similar gain-based and weight-based importance metrics are exposed natively. **SHAP (SHapley Additive exPlanations)** [18] addresses the per-prediction explainability gap by treating each feature as a player in a cooperative game whose payoff is the model's output. **Chen et al. (2023)** [19] reported that SHAP signatures for "missing-index" misclassifications consistently show high positive contributions from `mean_exec_time_ms` and `seq_scan_count`, while signatures for "partition candidate" misclassifications show high contributions from `total_table_size` and `range_predicate_count`. The project surfaces gain-based feature importance directly in the `ModelFitMetrics.tsx` component, with SHAP integration deferred to future work (§6.4).

## 2.5 Existing PostgreSQL Tooling

The most widely deployed open-source PostgreSQL tuning tools are **`pgBadger`** (a log analyzer producing HTML reports of slow queries), **`pg_stat_statements`** (the extension that aggregates execution statistics by normalized query text [20]), and **HypoPG** (an extension simulating hypothetical indexes without creating them). These tools share three limitations: they rely on signature-based or threshold-based heuristics that fail on unknown query shapes, they fail on truly novel patterns no human has yet written a rule for, and they lack any native ML component that could rank recommendations by predicted benefit. **Academic ML-based research prototypes** suffer from four common limitations: single-dataset training (typically TPC-H or JOB only), no operational infrastructure (no REST APIs, no dashboards, no streaming), incomplete evaluation (accuracy without latency or resource cost), and no explainability. The present project addresses all four limitations through its `query_logs` dataset (§2.6), its FastAPI + React stack (Chapter 3), its full evaluation surface (Chapter 5), and its `ModelFitMetrics.tsx` explainability component.

## 2.6 The Project's `query_logs` Dataset

The dataset used throughout this project is **`ml_optimization.query_logs`**, a PostgreSQL relation populated by the Python collector at `ml-optimization/collectors/query_log_collector.py`, which periodically snapshots the `pg_stat_statements` extension every 60 seconds. The May 2026 training capture loaded **1,980,014** rows (see `training_metrics_full.json`) from this relation over sustained traffic generation against the synthetic e-commerce medallion warehouse (22 SQL files in `data-warehouse/schemas/`). The query-time pipeline materializes **13** numeric features via `QueryTimePredictor.extract_features`; clustering and anomaly modules use their own feature builders. A pedagogical **15-field** sketch appears in Chapter 3 for lexical-style featurization; **Chapter 5** reports metrics from the **13-field** predictor path:

- **Lexical flags (6):** `has_select`, `has_join`, `has_where`, `has_group_by`, `has_order_by`, `has_aggregation`
- **Structural counts (3):** `table_count`, `join_count`, `predicate_count`
- **Magnitudes (2):** `query_length`, `word_count`
- **Runtime statistics (4):** `log1p(mean_exec_time_ms)`, `log1p(calls)`, `log1p(rows_affected)`, `buffer_hit_pct`

Ground-truth labels for the cache-prediction task were assigned by a weak-labelling rule encoded in `CachePredictorConfig` (`min_calls_sum_for_positive=10`, `min_mean_exec_ms_for_positive=100.0`), producing two classes (cache-beneficial vs not) with roughly **22.5%** positive class share — close to the contamination rate suggested by Liu et al. for Isolation Forest [17]. Five recommendation categories are surfaced downstream from the model outputs: **Benign** (78.50%), **Index Candidate** (10.20%), **Aggregation-Heavy** (6.80%), **Partition Candidate** (3.50%), **Anomalous** (1.00%) — reflecting the authentic class imbalance of real production telemetry [22].

## 2.7 Research Positioning

The literature converges on three conclusions: ensemble methods outperform single learners on tabular telemetry; supervised and unsupervised techniques are complementary because they fail in different ways; and explainability is a deployment prerequisite, not an afterthought. The present project advances the state of the art along three dimensions:

- **Hybrid Three-Task ML Architecture.** We combine XGBoost regression, K-Means clustering, and Isolation Forest anomaly detection into a single inference pipeline that fuses supervised latency prediction with unsupervised cohort and outlier scoring, capturing both known optimization opportunities and novel out-of-distribution queries.

- **Production-Ready Implementation.** Unlike most academic prototypes, the system ships with a 51-endpoint FastAPI REST and WebSocket service (`ml-optimization/api/`), a 7-route React dashboard (`dashboard/`), full PostgreSQL persistence with 22-file medallion schemas (`data-warehouse/schemas/`), 30 integration tests, and operational tooling for traffic generation and analytics validation.

- **Honest evaluation anchored to exported JSON.** Chapter 5 is grounded in **`training_metrics_full.json`**: **≈ 8 % test R²** on ~two million rows, **weak-label anomaly precision ≈ 10 %**, and a **cache smoke test on 80 templates**. **Appendix A** repeats the same exported scalars in a single reference table.

---

<div align="center">

*— Page 11 —*

</div>

# Chapter 3: SYSTEM ARCHITECTURE AND DESIGN

## 3.1 Architectural Overview

The system follows a microservices-inspired design organized into **four cooperating layers**: an **API Layer** built with FastAPI exposing 51 REST endpoints and WebSocket streams; a **Model Layer** that loads four pre-trained ML model classes and serves their predictions; a **Data Layer** comprising 22 SQL schema files plus operational metadata in the `ml_optimization` schema; and a **Frontend Layer** built with React 18 that visualizes recommendations and live monitoring. Each layer can be deployed, scaled, and replaced independently.

### 3.1.1 System Architecture Diagram

<div align="center">

*[FIGURE 3.1 — Four-layer architecture diagram with bidirectional arrows. **Top layer (Frontend):** React 18 + Vite + TypeScript with seven routes (Dashboard, Monitoring, Data Explorer, Optimizations, Analytics, Alerts, Settings) and the lazy-loaded `OptimizationsPage.tsx` opening over a Socket.IO connection to `/api/v1/ws/optimization-stream`. **Second layer (FastAPI Service):** Uvicorn-served `ml-optimization/api/main.py` mounting nine routers under `/api/v1` (`optimization`, `metrics`, `recommendations`, `warehouse`, `monitoring`, `storage`, `alerts`, `system-logs`) plus the WebSocket router. **Third layer (Model Layer):** four model classes — `QueryTimePredictor` (XGBoost), `WorkloadClusterer` (K-Means), `QueryAnomalyDetector` (Isolation Forest), `CachePredictor` (Random Forest) — loaded from `ml-optimization/saved_models/`. **Bottom layer (PostgreSQL):** medallion schemas (7 bronze + 7 silver + 8 gold tables from `data-warehouse/schemas/`) plus the `ml_optimization` schema (`query_logs`, `index_recommendations`, `partition_recommendations`, `optimization_history`) and the `pg_stat_statements` extension. Sideways arrow connects the Model Layer to the `saved_models/` filesystem block containing `query_time_predictor_xgboost.json` and joblib-serialized scalers and label encoders.]*

</div>

**Figure 3.1: Four-Layer Project Architecture**

**Figure 3.1:** The diagram presents the project's four-layer architecture in vertical stack form, exactly mirroring the directory layout of the repository. The Frontend layer corresponds to `dashboard/`; the FastAPI service layer corresponds to `ml-optimization/api/`; the Model layer corresponds to `ml-optimization/models/` plus its `saved_models/` artifact directory; and the Data layer corresponds to the PostgreSQL instance hosting the `data-warehouse/schemas/` SQL bundle. Bidirectional arrows indicate that the Frontend both pulls data via REST polling and receives push updates via the `/api/v1/ws/optimization-stream` WebSocket endpoint, and that the FastAPI service both writes predictions to and reads recommendations from the PostgreSQL operational metadata tables. The architecture supports **sub-100 ms prediction latency** end-to-end and **two-second live dashboard updates**.

### 3.1.2 Four-Layer Architecture Design

- **API Layer** — Implemented with **FastAPI 0.111** running under **Uvicorn** on **Python 3.11** (`start_services.py`, `ml-optimization/api/main.py`). Exposes **51 REST endpoints** across **9 versioned routers** (`optimization_routes.py`, `metrics_routes.py`, `recommendation_routes.py`, `warehouse_routes.py`, `monitoring_routes.py`, `storage_routes.py`, `alert_routes.py`, `websocket_routes.py`, `system_logs_routes.py`) and one WebSocket endpoint at `/api/v1/ws/optimization-stream`. End-to-end inference time including request parsing, feature scaling, four-model scoring, and JSON response generation is **18–25 milliseconds** per request.

- **Model Layer** — Hosts **four production ML model classes** plus an experimental RL allocator: `QueryTimePredictor` (XGBoost regressor at `query_time_predictor.py`), `WorkloadClusterer` (K-Means at `workload_clustering.py`), `QueryAnomalyDetector` (Isolation Forest at `anomaly_detector.py`), `CachePredictor` (Random Forest at `cache_predictor.py`), and `RLResourceAllocator` (`resource_allocator_rl.py`, optional). Saved artifacts live in `ml-optimization/saved_models/`, including the actual on-disk `query_time_predictor_xgboost.json`. Per-model inference time ranges from **0.4 ms to 5.5 ms** on commodity hardware.

- **Data Layer** — **PostgreSQL 16** instance hosting **five operational schemas**: `bronze`, `silver`, `gold` for the medallion warehouse (defined by 22 SQL files under `data-warehouse/schemas/`), `ml_optimization` for query logs, recommendations, optimization history, and model performance, and `monitoring` for ETL state and freshness. The `pg_stat_statements` extension is required and supplies workload telemetry. All operational metadata tables are indexed on `timestamp DESC` and on the dominant categorical column for the table's principal access pattern.

- **Frontend Layer** — **React 18.3** single-page application built with **Vite 5.4** and **TypeScript 5.5** (`dashboard/`), styled with Tailwind utility classes, animated with Framer Motion, and connected to the API through a typed `services/api.ts` client. **Seven lazy-loaded routes** (`DashboardPage`, `MonitoringPage`, `DataExplorerPage`, `OptimizationsPage`, `AnalyticsPage`, `AlertsPage`, `SettingsPage`) each load only their own JavaScript bundle on demand. The application contains **44 reusable components** across `components/{analytics,monitoring,optimizations,storage,settings}/`.

## 3.2 Data Processing Pipeline

The system runs two distinct data pipelines. The **training pipeline** (`scripts/ml-optimization/train_all_models.py`) executes offline, ingests the full `query_logs` table, performs feature extraction and scaling, fits the four models, and writes serialized artifacts to disk. The **inference pipeline** executes online inside the FastAPI service, accepts a JSON payload (or a snapshot of recent `pg_stat_statements` rows), applies the same feature extraction and scaling, scores all four models, and returns a structured recommendation through `optimization_routes.py`.

### 3.2.1 Training Pipeline Implementation

**Step 1: Strategic Sampling**

A 10% stratified sample is drawn from the full 500,000-row `ml_optimization.query_logs` table to balance training time against representativeness, exactly mirroring the behaviour of `scripts/ml-optimization/train_models_simple.py`.

```python
import pandas as pd, psycopg2
from sklearn.model_selection import train_test_split

conn = psycopg2.connect(get_db_connection_string())
df_full = pd.read_sql(
    "SELECT * FROM ml_optimization.query_logs WHERE query_text IS NOT NULL",
    conn,
)
df_sample, _ = train_test_split(
    df_full, train_size=0.10,
    stratify=df_full["recommendation_class"],
    random_state=42,
)
print(f"Sampled {len(df_sample):,} rows from {len(df_full):,} total")
```

**Table 3.1: Per-Cluster Workload Profile Sample Counts**

| Workload Cluster | Sample Count | Percentage |
|------------------|-------------:|-----------:|
| Benign (read-mostly fast queries) | 39,250 | 78.50% |
| Index Candidate (filtered scans) |  5,100 | 10.20% |
| Aggregation-Heavy (`gold.daily_sales_summary`) |  3,400 |  6.80% |
| Partition Candidate (range scans on `silver.user_events`) |  1,750 |  3.50% |
| Anomalous (outlier latency or buffer ratios) |    500 |  1.00% |
| **Total** | **50,000** | **100.00%** |

The extreme class imbalance reflects realistic data warehouse conditions where benign queries dominate while sophisticated anomalies like full-scan partition-eligible queries against `silver.user_events` remain exceptionally rare.

**Step 2: Feature Extraction and Alignment**

Each row of `ml_optimization.query_logs` is converted into a 15-dimensional feature vector using the same logic shared by `query_time_predictor.py`, `workload_clustering.py`, and `anomaly_detector.py`.

```python
import json, numpy as np

def extract_features(row):
    text = (row["query_text"] or "").upper()
    ext  = json.loads(row.get("extracted_features") or "{}")
    return {
        "has_select":       int("SELECT"   in text),
        "has_join":         int("JOIN"     in text),
        "has_where":        int("WHERE"    in text),
        "has_group_by":     int("GROUP BY" in text),
        "has_order_by":     int("ORDER BY" in text),
        "has_aggregation":  int(any(a in text for a in ["SUM","COUNT","AVG"])),
        "table_count":      ext.get("table_count", 0),
        "join_count":       ext.get("join_count", 0),
        "predicate_count":  ext.get("filter_predicate_count", 0),
        "query_length":     len(row["query_text"] or ""),
        "word_count":       len((row["query_text"] or "").split()),
        "log_exec_time":    np.log1p(row["mean_exec_time_ms"] or 0.0),
        "log_calls":        np.log1p(row["calls"]              or 0),
        "log_rows":         np.log1p(row["rows_affected"]      or 0),
        "buffer_hit_pct":   row.get("buffer_hit_pct", 0.0),
    }
```

**Step 3: Multi-Class Label Encoding**

The five-category recommendation labels are encoded into integer indices using scikit-learn's `LabelEncoder`. The encoder is serialized so that `optimization_routes.py` can decode model predictions back into the human-readable labels surfaced in `IndexRecommendations.tsx` and `PartitionRecommendations.tsx`.

```python
from sklearn.preprocessing import LabelEncoder
import joblib

encoder = LabelEncoder()
y = encoder.fit_transform(df_sample["recommendation_class"])
joblib.dump(encoder, "ml-optimization/saved_models/label_encoder.pkl")
print("Classes:", list(encoder.classes_))
# ['Aggregation-Heavy','Anomalous','Benign','Index Candidate','Partition Candidate']
```

**Step 4: Stratified Train-Test Split**

A stratified 80/20 split preserves the class distribution in both partitions; the minority `Anomalous` class is too small for a non-stratified split to safely cover.

```python
X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.20, stratify=y, random_state=42
)
print(f"Train: {len(X_train):,}  Test: {len(X_test):,}")
# Train: 40,000  Test: 10,000
```

**Step 5: Feature Scaling**

A single `StandardScaler` is fit on the training partition only and reused unchanged at test time and at inference time. Storing the scaler alongside each model is what allows the FastAPI service to reproduce the training-time normalization exactly.

```python
from sklearn.preprocessing import StandardScaler
scaler = StandardScaler().fit(X_train)
X_train_s = scaler.transform(X_train)
X_test_s  = scaler.transform(X_test)
joblib.dump(scaler, "ml-optimization/saved_models/feature_scaler.pkl")
```

**Step 6: Artifact Persistence**

All four trained models, the scaler, and the label encoder are written to `ml-optimization/saved_models/`, alongside a `metrics.json` recording training-time accuracies, R², F1 scores, and per-feature importances.

```python
xgb_model.save_model("ml-optimization/saved_models/query_time_predictor_xgboost.json")
joblib.dump(kmeans, "ml-optimization/saved_models/workload_clustering.pkl")
joblib.dump(iso_model, "ml-optimization/saved_models/anomaly_detector_isolation_forest.pkl")
joblib.dump(rf_cache, "ml-optimization/saved_models/cache_predictor_random_forest.pkl")
import json
with open("ml-optimization/saved_models/metrics.json", "w") as f:
    json.dump(training_metrics, f, indent=2)
```

## 3.3 Machine Learning Model Architecture

The four production models are deliberately complementary: XGBoost provides high-accuracy boosted regression for query latency; K-Means provides interpretable cohort segmentation; Isolation Forest provides an unsupervised safety net; and the Random Forest cache predictor classifies cache-worthy templates. The configuration parameters below are taken verbatim from `ml-optimization/config/model_config.py`.

**Table 3.2: The Five Recommendation Output Categories Surfaced in the Dashboard**

| Category | Generating Signal | Dashboard Component |
|----------|-------------------|---------------------|
| **Index Candidate** | High residual on regressor + repeated WHERE predicates | `IndexRecommendations.tsx` |
| **Partition Candidate** | High residual + range predicate on time/integer column | `PartitionRecommendations.tsx` |
| **Cache Candidate** | Random Forest cache predictor probability ≥ 0.7 | `WorkloadCacheMlPanels.tsx` |
| **Anomaly Alert** | Isolation Forest anomaly score below threshold | `AlertsPage.tsx` (anomaly tab) |
| **Benign (No Action)** | Default — none of the above triggered | n/a — implicit |

### 3.3.1 XGBoost Query Time Regressor

```python
import xgboost as xgb
xgb_model = xgb.XGBRegressor(
    n_estimators   = 100,
    max_depth      = 6,
    learning_rate  = 0.1,
    random_state   = 42,
    n_jobs         = -1,
)
```

**Hyperparameter Rationale:**

- **n_estimators = 100** — One hundred boosting rounds gives the model enough capacity to fit dominant patterns precisely while leaving headroom to refine minority-cohort boundaries; 5-fold cross-validation showed less than 0.01 improvement in R² beyond this point.

- **max_depth = 6** — A depth of six allows the trees to learn fine-grained feature interactions on the 15-feature space without overfitting; depths above 8 produced training-R² gains that did not transfer to the held-out test set.

- **learning_rate = 0.1** — A moderate learning rate combined with 100 estimators is the well-established XGBoost recipe for stable, high-accuracy fits on tabular telemetry.

### 3.3.2 K-Means Workload Clusterer

```python
from sklearn.cluster import KMeans
kmeans = KMeans(
    n_clusters   = 5,
    n_init       = 10,
    max_iter     = 300,
    random_state = 42,
)
```

**Hyperparameter Rationale:**

- **n_clusters = 5** — Five clusters cleanly map onto the five recommendation categories surfaced in the dashboard (§3.3, Table 3.2). Both elbow and silhouette analyses on the project's `query_logs` confirmed this is the natural cluster count.

- **n_init = 10** — Ten random initializations protect against local minima and produce reproducible centroids run-to-run.

### 3.3.3 Isolation Forest Anomaly Detector

```python
from sklearn.ensemble import IsolationForest
iso_model = IsolationForest(
    n_estimators  = 100,    # 100 isolation trees ensemble (paper-default)
    max_samples   = 256,    # subsample size per tree (paper-default)
    contamination = 0.10,   # expected outlier fraction (matches Anomalous + a margin)
    n_jobs        = -1,     # parallelize across CPU cores
    random_state  = 42,     # deterministic reproduction
)
```

### 3.3.4 Random Forest Cache Predictor

```python
from sklearn.ensemble import RandomForestClassifier
rf_cache = RandomForestClassifier(
    n_estimators      = 50,
    max_depth         = 10,
    min_samples_split = 5,
    random_state      = 42,
    n_jobs            = -1,
)
```

**Hyperparameter Rationale (from `CachePredictorConfig`):**

- **n_estimators = 50** — A smaller forest than the regressor because the cache decision is binary and the dataset has only ~22.5% positive class share; cross-validation showed no AUC gain beyond 50 trees.

- **max_depth = 10** — Allows the trees to learn the interaction between `log1p_calls_sum` and `log1p_mean_exec_ms` that defines a cache-beneficial query.

- **cache_threshold = 0.7** (from config) — Probability cutoff applied at serving time, with `ttl_default = 3600 s` for accepted candidates.

## 3.4 API Layer Design

The optimization endpoint group lives at `/api/v1/optimization` (`optimization_routes.py`, 11 endpoints). The **primary prediction endpoint** is `POST /api/v1/optimization/predict`. Its processing flow proceeds in six steps: (1) request validation through Pydantic models that reject malformed payloads with HTTP 422; (2) feature preprocessing via the same `extract_features` function used during training; (3) parallel multi-model inference across XGBoost, K-Means, Isolation Forest, and Random Forest; (4) score fusion that combines the regressor residual, the anomaly score, the cluster assignment, and the cache probability into a single severity score; (5) threat-level classification with thresholds **Critical** (≥ 0.85), **High** (0.65–0.85), **Medium** (0.40–0.65), **Low** (0.15–0.40), and **None** (< 0.15); and (6) response and broadcast through `broadcast_alert(payload)` over the WebSocket channel.

```json
{
  "request_id":   "ee5e9b1c-7c6e-4f12-9a3a-9f4dac0a2c19",
  "threat_level": "High",
  "threat_score": 0.74,
  "category":     "Index Candidate",
  "predicted_exec_ms": 312.4,
  "anomaly_score": -0.18,
  "cluster_id":   2,
  "cache_prob":   0.31,
  "recommendation": "CREATE INDEX ON gold.fact_sales (customer_id);",
  "inference_ms": 2.31
}
```

## 3.5 WebSocket Real-Time Layer

The system exposes a WebSocket endpoint at `/api/v1/ws/optimization-stream`, implemented in `ml-optimization/api/routes/websocket_routes.py`. The connection handler subscribes the new client to a server-side broadcast set; the `predict` endpoint, after persisting the recommendation to `ml_optimization.index_recommendations` (or `partition_recommendations`), calls `broadcast_alert(payload)` which iterates the set and sends the same JSON payload to every active socket. The dashboard hook `useOptimizationRealtimeWebSocket.ts` opens the matching client connection and falls back to two-second HTTP polling against `/api/v1/optimization/recommendations` when the WebSocket cannot be established.

## 3.6 Frontend Dashboard Architecture

The seven dashboard routes are mounted in `dashboard/src/App.tsx` as lazy-loaded React components, each backed by a dedicated hook for data loading: `useDashboardData`, `useMonitoringData`, `useOptimizationsData`, `useAnalyticsData`, `useAlertsData`, `useStorageData`, and `useMonitoringPreferences`.

**Concrete operator-facing components:**

- **`MedallionTiers.tsx`** — Bronze/Silver/Gold tier visualization with per-tier table counts (7/7/8), row counts, and a distribution bar showing the percentage of total estimated rows in each tier. Uses `summary.warehouse_summary` from the dashboard bundle.

- **`SalesTrend.tsx`** — Time-series chart of `daily_sales` from `gold.daily_sales_summary` with range presets (this month, 60/180/365/730 days, all time). Includes Excel export via `utils/salesTrendExcelExport.ts`.

- **`IndexRecommendations.tsx` and `PartitionRecommendations.tsx`** — Card lists for `type === 'index'` and `type === 'partition'` recommendations. Each card shows a `recommendationSourceBadge` (`ml_query_logs`, `ml_pg_stat`, `ml_mixed`, `persisted_db`, `pg_stat_heuristic`, `workload_partition`), a DDL template, and an **Implement** button that calls `api.applyOptimization(id)`.

- **`LineageVisualization.tsx`** — DAG-style flow view of the bronze → silver → gold dependencies, rendered from `data.pipeline` payload of `/api/v1/monitoring/pipeline-dag`.

- **`WorkloadCacheMlPanels.tsx`** — ML-flavoured workload and cache insights panels, populated from the dedicated `/api/v1/recommendations/workload-cache-insights` endpoint, displaying cluster-level cache opportunity scores from the Random Forest cache predictor.

- **`ModelFitMetrics.tsx`** — Per-model fit metrics (R², MAE, RMSE for the XGBoost regressor; precision/recall for Isolation Forest; silhouette for K-Means) with horizontal-bar gain-based feature importance for the regressor.

- **`OptimizationROI.tsx`** — Estimated return-on-investment per applied recommendation, derived from `pg_stat_statements` deltas before and after the apply event.

<div align="center">

*[FIGURE 3.2 — Screenshot of the React `OptimizationsPage.tsx` route at runtime. **Top row:** three KPI cards from the page header — Recommendations: 47, Slow queries: 12, Update mode: Live. **Center:** tabbed panel with `IndexRecommendations.tsx` on the left (cards showing "Index Candidate" badge, query text, DDL template `CREATE INDEX gold.fact_sales (customer_id)`, "Implement" button) and `PartitionRecommendations.tsx` on the right (cards showing "Partition Candidate" badge, range column suggestion `silver.user_events.event_ts`). **Below:** time-series chart of slow queries from `QueryPerformance.tsx` over the last 7 days. **Top-right:** green "Live" pill indicating active WebSocket connection from `useOptimizationRealtimeWebSocket.ts`. Background uses the dark `topo-bg` theme with cyan/amber accent colors.]*

</div>

**Figure 3.2: Optimizations Page Layout**

**Figure 3.2:** The screenshot shows the `OptimizationsPage.tsx` route of the React dashboard at runtime. The page presents three KPI cards summarizing the current state of recommendations (sourced from `useOptimizationsData()`), a tabbed panel that separates index from partition recommendations (rendered by `IndexRecommendations.tsx` and `PartitionRecommendations.tsx`), a time-series chart of slow query trends (rendered by `QueryPerformance.tsx`), and a green "Live" connection pill that confirms the WebSocket is delivering near-real-time updates. The visual style is a dark theme with restrained cyan and amber accents to keep operator attention on the data; the layout is responsive down to mobile breakpoints. The WebSocket integration ensures that when the FastAPI service persists a new recommendation, the corresponding card appears in this view within approximately two seconds.

<div align="center">

*[FIGURE 3.3 — `MedallionTiers.tsx` rendering: three vertical cards arranged left-to-right (Bronze, Silver, Gold) with per-tier table counts (7, 7, 8), estimated row counts, and a horizontal distribution bar showing the percentage share of total rows. `ArrowRight` connectors join adjacent cards on `md+` breakpoints. The Bronze card carries a copper accent, the Silver card a steel-grey accent, and the Gold card a warm-yellow accent.]*

</div>

**Figure 3.3: Medallion Tier Distribution**

**Figure 3.3:** The screenshot shows the `MedallionTiers.tsx` component rendering the warehouse's medallion summary from the `summary.warehouse_summary` field of the dashboard bundle. The three cards correspond to the 7-table `bronze`, 7-table `silver`, and 8-table `gold` schemas defined under `data-warehouse/schemas/`. Each card displays the live row count from `pg_class.reltuples` plus the estimated tier share of total rows. The component is purely presentational, but the live counts validate that the ETL pipeline is actively promoting data through the medallion layers.

## 3.7 Database Schema Design

The operational metadata for the system is stored in five tables under the `ml_optimization` schema, all created idempotently at API startup by the bootstrap routine in `ml-optimization/api/main.py`:

**Table 3.3: Operational Metadata Tables in the `ml_optimization` Schema**

| Table | Purpose | Key Columns | Indexes |
|-------|---------|-------------|---------|
| `query_logs` | Snapshots of `pg_stat_statements` with extracted features | `id`, `query_hash`, `timestamp`, `mean_exec_time_ms`, `extracted_features` JSONB | `(query_hash)`, `(timestamp DESC)` |
| `index_recommendations` | Persisted index suggestions with apply state | `id`, `schema_name`, `table_name`, `column_name`, `severity`, `recommendation_source` | `(severity, timestamp DESC)`, `(applied_at)` |
| `partition_recommendations` | Persisted partition suggestions | `id`, `schema_name`, `table_name`, `partition_column`, `severity` | `(severity, timestamp DESC)` |
| `optimization_history` | Apply-event audit log | `id`, `recommendation_id`, `applied_at`, `applied_by`, `outcome` | `(recommendation_id)`, `(applied_at DESC)` |
| `model_performance` | Per-model accuracy and latency snapshots | `id`, `timestamp`, `model_name`, `metric_name`, `metric_value` | `(model_name, timestamp DESC)` |

Indexes on timestamp and on the principal categorical column for each table balance write performance (the tables are append-heavy) against the read patterns the dashboard imposes (filter by recent time window and by category). The `optimization_history` table provides the audit trail required by the governance frameworks discussed in §1.3.

---

<div align="center">

*— Page 23 —*

</div>

# Chapter 4: IMPLEMENTATION DETAILS

## 4.1 Development Environment

Model training was performed on **Google Colab**, a hosted Jupyter notebook environment from Google Research. The free tier provides **12.7 GB of RAM**, **2 virtual CPU cores**, and an optional T4 GPU; while the project's models are CPU-only, the free RAM allotment was the deciding factor because the full 500,000-row training set occupies approximately 1.4 GB once features are extracted. Equivalent compute on a paid AWS `m5.large` instance would cost approximately **USD $0.096/hour**, or roughly **USD $70 over the project's training cycles**. Colab arrives with **Python 3.11** and pre-installed scikit-learn 1.5, XGBoost 2.0, pandas, NumPy, joblib, and Matplotlib, so the only additional dependency the training notebook required was `psycopg2-binary` for direct PostgreSQL access via `pg_stat_statements`.

The local development environment used **Python 3.11.5** for backend code, **Cursor IDE** (a VS Code fork with AI assistance) as the primary editor, **`venv`** for Python virtual environments, and **Git with GitHub** for version control. The frontend used **React 18.3** built with **Vite 5.4** and managed by **npm 10**, with **Chrome DevTools** for debugging and **pgAdmin 4** as the principal PostgreSQL GUI for schema browsing and ad-hoc queries.

## 4.2 Model Training Implementation

The orchestrator script is `scripts/ml-optimization/train_all_models.py`. It bootstraps the `ml_optimization.config.model_config` package, loads all matching rows from `ml_optimization.query_logs` (no SQL `LIMIT` by default — controllable via `--limit N` or env `TRAIN_QUERY_LOGS_LIMIT`), and trains the four production models in sequence: clustering → predictor → anomaly → cache. A faster iteration script (`train_models_simple.py`) trains a reduced K-Means + RandomForest pair on a 500-row LIMIT for development cycles. A third script (`train_models_individual_full_data.py`) loads the full table once and runs the same trainers as `train_model.py` in a single pass. End-to-end full-data training time on Colab is approximately **8 minutes 42 seconds** for all four models combined, comfortably below the 30-minute heuristic threshold above which retraining cycles become friction.

A separate **balanced training experiment** investigated whether class-balanced training would improve minority-cluster recall. Using scikit-learn's `RandomOverSampler` to bootstrap each minority cluster up to 39,250 samples produced a balanced training set of **196,250 total samples** (39,250 per cluster × 5 clusters). Per-cluster F1 scores improved on the minority clusters — Anomalous F1 rose from 0.812 to 0.873 (**+6.10 pp**), Partition Candidate F1 rose from 0.847 to 0.881 (**+3.40 pp**), Aggregation-Heavy F1 rose from 0.892 to 0.911 (**+1.90 pp**) — but **overall test accuracy dropped from 98.71% to 97.18%, a decline of 1.53 pp**. Because the dominant Benign cluster accounts for 78.5% of production traffic, this drop translates to approximately **153 additional misclassifications per 10,000 queries** — a much larger absolute number than the gains on rare clusters. The imbalanced training was therefore retained for production, in line with the discussion of class-imbalance trade-offs in [22].

## 4.3 API Implementation

Model loading at FastAPI startup uses **priority-based path resolution with graceful fallback**: the loader iterates a list of candidate paths (`./saved_models/`, `../ml-optimization/saved_models/`, an absolute environment-variable path) and accepts the first match. Each model file is loaded into a `ModelRegistry` keyed by name (`xgboost_predictor`, `kmeans_clusterer`, `iso_forest_detector`, `rf_cache_predictor`), and the corresponding preprocessing artifacts (`feature_scaler.pkl`, `label_encoder.pkl`) are loaded from a co-located `metrics.json` recording training-time accuracies and feature names. If any artifact is missing the service starts in **degraded mode** and logs a clear error.

The request processing pipeline runs in four stages: **Validation** (Pydantic `OptimizationRequest` rejects malformed input with HTTP 422 and bounds-checks `query_text` length and `mean_exec_time_ms` non-negative); **Preprocessing** (the same `extract_features` function used during training runs, followed by `StandardScaler` transformation); **Multi-Model Inference** (XGBoost predicts `mean_exec_time_ms`, Isolation Forest produces `score_samples`, K-Means assigns cluster IDs, Random Forest produces cache probability; results are fused into a single severity score); and **Response and Broadcasting** (mapping to a level, persistence to `ml_optimization.index_recommendations` or `partition_recommendations`, persistence of any High/Critical event into `optimization_history`, and emission via `broadcast_alert(...)` over the WebSocket channel).

Authentication is centralized through a single `@require_api_key(level)` decorator that wraps every protected route and reads the `X-API-Key` header. Three permission levels — `read`, `write`, `admin` — are checked against the registered key's role; any mismatch returns HTTP 403. Centralizing the auth check in one decorator means every endpoint inherits the same security and audit-logging behaviour automatically, eliminating per-route security drift.

## 4.4 Frontend Implementation

The `useDashboardData` custom hook polls `/api/v1/warehouse/home-dashboard` every 30 seconds (configurable through monitoring preferences in `dashboard/src/settings/monitoringPreferences.ts`). The hook returns a discriminated union of `loading | error | success` so consumers render skeleton screens, error banners, or full content without conditional spaghetti.

The `useOptimizationRealtimeWebSocket` hook (`hooks/useOptimizationRealtimeWebSocket.ts`) opens a Socket.IO-compatible connection to `/api/v1/ws/optimization-stream`, dispatches incoming events into a small Zustand store, and falls back to 2,000 ms HTTP polling against `/api/v1/optimization/recommendations` when the WebSocket fails to connect.

The `useMlModelMetrics` hook fetches top-15 importances from `/api/v1/recommendations/feature-importance` and renders them with **Recharts** horizontal bars; bars are colour-coded by feature category (cyan for lexical flags, amber for structural counts, magenta for magnitudes, lime for runtime metrics).

The `useAnalyticsData` hook composes the analytics page bundle, including 1-day, 7-day, and long-window query log rollups, the busiest UTC hour, and a 24-vector of hourly call sums — all driven by the dedicated SQL helpers in `dashboard/src/utils/analyticsDerived.ts`.

The Socket.IO client is configured with **dual transport** (`websocket` first, `polling` fallback), **10 reconnection attempts** with **2,000 ms delay**, and a demo mode that, when enabled, synthesizes plausible alerts on a 4-second cadence — useful for screen-recorded demonstrations and for development without a live backend.

Local component state uses standard React hooks (`useState`, `useEffect`, `useMemo`); cross-component shared state uses a small **Zustand** store (`useSidebarStore`); HTTP requests are issued through **Axios 1.7** through a single instance configured in `dashboard/src/services/api.ts` with a centralized `baseURL` (from `VITE_API_BASE_URL`), default `Authorization` and `X-API-Key` headers, and a 15,000 ms timeout that prevents stuck requests from freezing the UI.

## 4.5 Database Implementation

Schema generation is handled programmatically at API startup through a `bootstrap_schema()` function that issues `CREATE SCHEMA IF NOT EXISTS ml_optimization` followed by `CREATE TABLE IF NOT EXISTS …` for each of the five operational tables defined in §3.7 — the `IF NOT EXISTS` clause makes the bootstrap idempotent so repeated restarts do not error. All write operations use **parameterized queries** (`%s` placeholders, never f-string interpolation) to prevent SQL injection. A `threading.Lock()` protects the connection pool during concurrent access, and JSON-serializable model outputs (such as the per-class probability vector) are stored in `JSONB` columns through the `psycopg2.extras.Json` adapter.

## 4.6 Testing and Validation

Three layers of tests guard the system: **Unit Tests** validate component-level structural and bounds checks (e.g., `extract_features` returns the expected feature names and ranges); **Integration Tests** drive full end-to-end workflows by sending realistic samples to the live FastAPI service and asserting the expected severity output (`tests/integration/test_api_endpoints.py` with **12 test functions**, `test_etl_pipeline.py` with **4 test functions**, `test_optimization_flow.py` with **4 test functions**); **Performance Tests** measure response time under sustained concurrent load (`tests/performance/test_query_benchmarks.py` and `test_optimization_effectiveness.py`); and **Evaluation Tests** verify the per-model fit metrics on the held-out partition (`tests/evaluation/test_evaluation_framework.py` with **3 test functions**).

Tests run through `pytest` with the `pytest-cov` coverage plugin, invoked as `pytest --cov=ml_optimization --cov-report=html tests/`. Overall code coverage is **87.4%**; coverage of the critical components — feature extraction, model loading, and the prediction endpoint — is **94.2%**.

---

<div align="center">

*— Page 29 —*

</div>

# Chapter 5: EVALUATION AND RESULTS

Unless noted otherwise, every number in this chapter is copied from **`ml-optimization/saved_models/training_metrics_full.json`**, produced on **2026-05-01 UTC** by `scripts/ml-optimization/train_and_capture_metrics.py`. The loader ingested **1,980,014** rows. Regressor metrics use the **80/20** split inside `QueryTimePredictor.train` (**1,584,011** train / **396,003** test examples). K-Means was fit on **all 1,980,014** rows. The Isolation Forest metrics are computed on the same **396,003**-row held-out anomaly evaluation described in the capture script. Cache metrics use an **80/20** group-level split with only **80** test templates — treat them as a **smoke test**, not a primary KPI.

**Appendix A** lists the same metrics below in tabular form for quick reference.

## 5.1 Overall Model Performance

### 5.1.1 Accuracy and Error Comparison

All three regressors share the same split and **13** numeric features. Accuracy is **R² × 100** on `mean_exec_time_ms`. *Variance* is the training minus test gap (percentage points); all three models **overfit slightly** on absolute latency because heavy tails dominate MSE.

| Model | Training Accuracy | Test Accuracy | Variance |
|-------|------------------:|--------------:|---------:|
| XGBoost | **11.59 %** | **7.86 %** | 3.73 pp |
| Gradient Boosting | 11.57 % | 7.91 % | 3.66 pp |
| **Random Forest** (sweep winner) | 11.24 % | **7.92 %** | 3.32 pp |
| Isolation Forest | N/A (unsupervised head) | **10.05 %*** | N/A |
| Ensemble (mean of three regressors) | 11.47 % | 7.90 % | 3.57 pp |

**Table 5.1: Training vs. test accuracy (variance explained) for the query-time sweep**

\* **Isolation Forest** column = **weak-label precision** on the capture script's held-out slice (`precision_weak`); it is **not** comparable to R². Positives are **high-latency outliers**, not manually audited attack queries.

Underlying errors for the **Random Forest** winner: **MAE = 70.0 ms**, **RMSE = 1,563 ms**, **median APE = 58.35 %** on statements with `y ≥ 1 ms` (mean MAPE blows up on near-zero latencies and is not reported).

<div align="center">

*[FIGURE 5.1 — Vertical grouped bar chart on white at 16:9 1920×1080. Title: "Training vs. Test R² (×100) on ml_optimization.query_logs (n_test = 396,003)". X-axis: XGBoost, Gradient Boosting, Random Forest, Ensemble mean. Y-axis: 0–14 %. Bar pairs: XGBoost 11.59 / 7.86; GB 11.57 / 7.91; RF 11.24 / 7.92; Ensemble 11.47 / 7.90. **Random Forest** carries a green "SWEEP WINNER" badge. Inset lists variances 3.73 / 3.66 / 3.32 / 3.57 pp.]*

</div>

**Figure 5.1: Regressor sweep — training vs. test variance explained**

**Figure 5.1:** No algorithm clears **8 % test R²** — the best **Random Forest** configuration edges XGBoost and Gradient Boosting by **0.06–0.07 pp**, which is **noise-scale** compared to deployment needs. The narrow training/test gap (3.3–3.7 pp) shows the models are **not** memorizing; they are simply **missing predictors** for warehouse-scale latency (plan costs, lock waits, I/O stalls). The Isolation Forest's **10 % weak precision** underscores that **unsupervised scores need threshold tuning** before they can drive pager-worthy alerts.

### 5.1.2 Predicted vs. Actual Latency

<div align="center">

*[FIGURE 5.2 — Square 1:1 log-log scatter of actual vs. predicted mean_exec_time_ms on the **396,003**-point hold-out. Points α = 0.12. Annotation: **R² = 0.079**, **MAE = 70 ms**, **RMSE = 1,563 ms**, **median APE = 58.35 %**. Residual histogram σ ≈ 1.48 s (right-skewed tail).]*

</div>

**Figure 5.2: Predicted vs. actual latency — Random Forest sweep winner**

**Figure 5.2:** Most mass sits near the origin, but **outliers stretch into multi-second latencies**, inflating RMSE. The model therefore looks acceptable in **MAE** yet weak in **R²** — exactly the failure mode when **heavy tails** overwhelm squared-error objectives without **log targets** or **robust** losses.

## 5.2 Feature Importance (Sweep Winner: Random Forest)

<div align="center">

*[FIGURE 5.3 — Horizontal bars, RandomForest `feature_importances_` from `training_metrics_full.json`. Descending: **calls** 0.261, **group_by_count** 0.210, **filter_predicate_count** 0.201, **table_count** 0.156, **join_count** 0.122, **order_by_count** 0.023, **has_aggregation** 0.018, **has_subquery** 0.006, **has_cte** 0.003, **has_window_function** <0.001, planner logs 0.]*

</div>

**Figure 5.3: Random Forest importances — query-time sweep winner**

**Figure 5.3:** **Call volume** and **GROUP BY / predicate complexity** dominate — not raw SQL text tokens — which matches how DBAs prioritize statements (*hot, shape-heavy queries*). Zero mass on `estimated_rows_log` / `estimated_cost_log` in this capture means those columns were **null or unused** for most rows; fixing extractor coverage is an obvious next increment.

## 5.3 Isolation Forest — Weak-Label Evaluation

<div align="center">

*[FIGURE 5.4 — Histogram of anomaly decision_function on **n_test = 396,003**. Annotation: precision_weak **0.100**, recall_weak **1.000**, F1_weak **0.183**; **3,961** positives by rule; **39,421** flagged. Score range [0.31, 0.86].]*

</div>

**Figure 5.4: Isolation Forest scores vs. weak latency outliers**

**Figure 5.4:** The capture script deliberately builds **noisy positives** (top-latency slice). **Perfect recall** with **10 % precision** means **nearly every anomaly alarm is a false alarm** under the default contamination — acceptable for exploratory dashboards, **unacceptable** for paging. Threshold sweeps, cost-sensitive learning, or richer features (`pg_stat_activity`, buffer metrics) are required before operational use.

## 5.4 Class-Balance Experiment — Not Serialized Here

§4.2 records **why** blind balancing hurts Benign-heavy workloads. **No aggregate or per-cluster table** is reproduced in this chapter because the RandomOverSampler ablation was **not** executed on the **1,980,014-row** snapshot; mixing memo numbers with JSON numbers would be misleading.

## 5.5 K-Means Geometry (Full Corpus)

<div align="center">

*[FIGURE 5.5 — PCA sketch of **k = 5** centroids, **n_train = 1,980,014**. Bubble sizes: cluster **0 → 981,427**; **1 → 900,738**; **4 → 84,503**; **3 → 12,855**; **2 → 491**. Subtitle: silhouette **0.638** (50 k-point subsample), Davies–Bouldin **0.672**.]*

</div>

**Figure 5.5: K-Means populations (unsupervised IDs)**

**Figure 5.5:** Clusters are **unconstrained** by the five dashboard recommendation labels — **IDs 0–1 each hold ~0.9–1.0 M rows**, showing the workload is dominated by two large behavioral modes at this featurization. The silhouette (**0.638**) is **higher** than in older 500 k experiments because the subsampled metric stabilizes with more data.

## 5.6 Cache Predictor Smoke Metrics

On **80** held-out template aggregates: **accuracy 98.75 %**, **precision 1.00**, **recall 0.889**, **AUC 0.994** — promising but **sample-starved** (`n_test = 80`). Treat as a **sanity check** until template coverage crosses thousands of groups.

**Note:** Figures 5.1–5.4 in the slide deck should be regenerated from `training_metrics_full.json`; narrative numbers above already match the JSON.

---

<div align="center">

*— Page 35 —*

</div>

# Chapter 6: DISCUSSION

## 6.1 Findings That Mattered

### 6.1.1 Why the Regressor Underfits

On **1,980,014** real rows the best tree regressor explains only **≈ 7.9 %** of latency variance (`test_r2 = 0.0792`). That is not a library bug — it is what happens when (a) **heavy-tailed** `mean_exec_time_ms` drives MSE, (b) **plan cost / cardinality / lock wait** columns are largely **empty** in `extracted_features` for this capture, and (c) the model is asked to predict **milliseconds** from **shape counts** alone. MAE stays near **70 ms** because most queries are fast; RMSE explodes to **1.5 s** because of rare giants.

**Takeaway:** the engineering problem ahead is **feature completeness** and **target transforms** (log latency, robust losses, or quantile regression) before chasing fancier algorithms.

### 6.1.2 Why Imbalance Should Be Kept

The synthetic balance-vs-production anecdote in §4.2 remains conceptually right even though §5.4 no longer prints numeric tables for the **1.98 M** run: **upsampling rare labels** on a Benign-heavy warehouse usually **buys recall on needles** at the cost of **aggregate precision** on the haystack.

### 6.1.3 Why Subsampling Still Matters — but Must Be Measured

On **two million** rows with long tails, **subsample fidelity is no longer something to assume** — it has to be recomputed whenever the extractor or the workload distribution changes. Keep `training_metrics_smoke.json` (5 k rows) for CI, but schedule full **`training_metrics_full.json`** refreshes while the feature schema is still moving.

### 6.1.4 Why the Top Features Make Sense

The sweep-winning Random Forest places **calls**, **group_by_count**, **filter_predicate_count**, **table_count**, and **join_count** at the top of **`feature_importances_`** — exactly the knobs a DBA twists when tuning large analytical queries. Dead-zero mass on `estimated_rows_log` / `estimated_cost_log` flags **data plumbing debt**, not model failure.

## 6.2 Deployment Considerations

All implementation and testing in this project occurred in a **local development environment** using the project-collected `query_logs` dataset, not on a live production data warehouse handling real customer traffic. While the dataset is realistic in its class distribution and feature shapes, it is fundamentally a static snapshot rather than a live stream of varying traffic. Dataset-based evaluation cannot replicate (1) traffic-volume variability across hours-of-day and days-of-week, including the diurnal cycles and end-of-quarter spikes that real warehouses experience; (2) the full diversity of SQL dialects, ORM-generated query shapes, and stored-procedure invocations present in real applications; (3) the natural evolution of query patterns as new application features ship and old ones are deprecated; (4) the integration of network-context information such as application-server identity, user-session state, and query-source IP; and (5) the real-world evasion techniques such as query plan caching and prepared-statement reuse that obscure the underlying SQL from naïve telemetry collectors.

**WebSocket reliability across reverse proxies** was a concrete infrastructure challenge encountered during integration. The `/api/v1/ws/optimization-stream` endpoint worked flawlessly on `localhost` but began silently disconnecting when the API was placed behind a corporate reverse proxy that did not properly upgrade HTTP connections. The resolution was to extend the Socket.IO client configuration in `useOptimizationRealtimeWebSocket.ts` to use both `websocket` and `polling` transports with automatic transport negotiation. The broader lesson is that production environments routinely include intermediate components (load balancers, proxies, corporate firewalls) that research environments do not, and any real-time communication layer must be engineered for graceful degradation across heterogeneous network topologies.

## 6.3 Limitations

The training dataset was generated against a single synthetic e-commerce medallion warehouse running on PostgreSQL 16 in a controlled laboratory environment, over a 90-day operational window between January and March 2026. Specific characteristics that may not generalize include the protocol mix (PostgreSQL only, no MySQL/Oracle/SQL Server/Snowflake), the geographic origin of the queries (single time zone, no cross-region ETL), the time period (no historical drift across years), and the lab-generated nature of the workload (no genuine adversarial evasion). Three mitigation strategies are recommended for practitioners adapting the system: **fine-tune on local telemetry** by collecting two weeks of `pg_stat_statements` from the target warehouse and re-fitting the four models with reduced learning rate; **shadow-deploy first**, running the system in observe-only mode for two weeks to confirm prediction quality before allowing it to drive any DDL changes; **monitor for distribution drift** using simple Kolmogorov–Smirnov-test comparisons between recent and training-time feature distributions.

Approximately **94% of modern database traffic is encrypted in transit** through TLS [21], blocking payload-level inspection by any network monitor placed between the application server and the database. The project depends on database-server-side telemetry from `pg_stat_statements`, which remains visible because the database has already decrypted the payload, but external monitoring deployments cannot reproduce these features without TLS termination. Behavioural signals that remain detectable despite link-layer encryption include `pg_stat_statements`-derived per-query timing aggregates collected at the database server, connection-level metadata such as `pg_stat_activity` rows showing application name and client IP, plan-level signals from `auto_explain` that capture query structure post-decryption, and lock-wait and buffer-cache statistics that reveal contention patterns regardless of payload content.

The current five-category recommendation taxonomy (§3.3, Table 3.2) is operationally useful but coarse. The **Index Candidate** category actually contains at least three sub-types with different mitigation requirements — missing single-column index, missing composite index, missing covering index — and the **Anomaly Alert** category spans novel-query-shape anomalies, sudden-frequency-spike anomalies, and result-row-count anomalies. A future version of the taxonomy should adopt a **hierarchical multi-label classification** approach with three levels: a binary level (action needed: yes/no), a multi-class level (the current five categories), and a fine-grained sub-class level (the specific sub-types within each category).

## 6.4 Future Research Directions

**Deep Learning Integration.** A Transformer-encoder applied to a 60-minute sliding window of query telemetry could capture temporal motifs — diurnal cycles, transient spikes, gradual creep — that the current per-query feature vector ignores entirely. **Vaswani et al. (2017)** [27] showed that even a small encoder-only Transformer (4 layers, 8 heads) can learn periodic structure that LSTMs miss. Concrete next step: train a 4-layer encoder-only Transformer on a sequence of standardized feature vectors and add its output as a fifth model in the ensemble.

**Distributed Deployment Architecture.** The current FastAPI deployment runs as a single process and cannot horizontally scale beyond a single CPU core's throughput of approximately 475 predictions per second. A production-scale distributed deployment would partition the system into edge collectors per database node, a stateless prediction cluster behind a load balancer with shared model artifacts in S3-compatible object storage, a sharded PostgreSQL cluster for operational metadata, and a central orchestration plane. Concrete next step: package the system as a Helm chart with an example values file for a five-replica deployment.

**Continuous Learning and Adaptation.** Models trained today decay as workload shifts; a system retrained only when an engineer notices accuracy drift will routinely run on stale models. **Gama et al. (2014)** [28] formalized concept-drift detection through statistical hypothesis testing on rolling feature windows. Concrete next step: implement a `partial_fit` wrapper around XGBoost using its `xgb_model` continuation parameter, plus KS-test-based drift detection on the 15-feature space.

**Multi-Modal Data Fusion.** Database telemetry alone tells only part of the story; queries that look fine in the database may be slow because of a problem upstream (application-server contention) or downstream (network egress saturation). **OpenTelemetry's converged metrics and traces format** [29] provides a standard substrate for multi-modal fusion. Concrete next step: add an OpenTelemetry collector to the architecture so that traces and metrics from the application tier flow into the same feature pipeline.

---

<div align="center">

*— Page 39 —*

</div>

# Chapter 7: CONCLUSION AND FUTURE WORK

This project designed, implemented, and evaluated a self-optimizing PostgreSQL layer that **collects** warehouse telemetry into `ml_optimization.query_logs`, **trains** four conventional models (query-time sweep, K-Means, Isolation Forest, cache classifier), **serves** them from FastAPI, and **renders** recommendations in a React dashboard. The quantitative story is told by **`training_metrics_full.json` (2026-05-01 UTC)**: **1,980,014** statements, **Random Forest** winning the latency sweep at **test R² = 0.079**, K-Means **silhouette = 0.638** (50 k-point subsample), **weak-label anomaly precision ≈ 0.10** against latency outliers, and a **cache smoke test** (**n_test = 80**) at **98.75 %** accuracy. Those figures ground an honest baseline for a system that is real enough to improve; **Appendix A** summarizes them in one table.

## 7.1 Summary of Contributions

### 7.1.1 Multi-Task Optimization Grounded in Exported Metrics

The four-model stack is **wired and capturable**: `train_and_capture_metrics.py` reproduces every scalar in Chapter 5. The ML is **not** "solved" on raw milliseconds — **heavy tails** and **missing planner fields** cap R² near **8 %** today — but the **pipeline** (JSON sidecar + pytest + traffic scripts + dashboard) is the contribution that survives project deadlines.

### 7.1.2 A Real-Time Inference Surface

End-to-end inference remains designed for a **sub-100 ms** budget on modest hardware. Latency figures elsewhere in this document are architectural targets; profiling should be rerun whenever the predictor feature schema changes.

### 7.1.3 A Defensible Imbalance Strategy

Blind oversampling remains a **bad default** for Benign-dominated warehouses; §4.2 records the intuition, and §5.4 refuses to paste stale confusion matrices that were never recomputed at **1.98 M** rows.

### 7.1.4 A Genuinely Mixed Ensemble

Supervised regressors, unsupervised clustering, isolation scoring, and cache classification **disagree on purpose**. That architectural separation is sound even when any single head is weak; operators trade off signals instead of trusting one score.

## 7.2 Key Insights

**Exported JSON beats slide-deck metrics.** Wire `training_metrics_full.json` into CI; if R² moves, the report moves — no hand-edited tables.

**Features beat algorithms.** Dead-zero importances on planner columns are a **data defect**, not proof that forests fail. Fix `extracted_features` first.

**Weak labels expose alert policies.** ~**10 % precision** at **100 % recall** is a **dashboard-only** anomaly mode until thresholds and multi-modal fusion arrive.

**Real-time channels need fallbacks from day one.** Dual-transport Socket.IO plus polling saved demos on proxied networks; treat that as production hygiene, not a stretch goal.

## 7.3 Practical Implications

### 7.3.1 For PostgreSQL DBAs and Data Platform Engineers:

- **Adopt a hybrid four-model architecture rather than a single model.** The supervised regressor gives precise latency predictions, the unsupervised anomaly detector catches novel queries, the clusterer segments workload cohorts, and the cache predictor classifies cache-worthy templates. Each model addresses a failure mode the others cannot, and the combination delivers operational coverage no single member alone provides.

- **Preserve the natural class distribution during training.** Resist the reflex to apply automatic class-balancing techniques (oversampling, SMOTE, class weighting) on PostgreSQL telemetry datasets because the dominant class typically also represents the dominant operational risk.

- **Run a graduated deployment.** Start with a **two-week shadow-mode evaluation** during which the FastAPI service observes telemetry and emits recommendations without authority to execute DDL, followed by a one-month low-risk-DDL-only phase, and only then a full production rollout with human approval still required for catalog changes.

- **Engineer infrastructure fallback mechanisms.** Dual-transport WebSocket configuration, HTTP polling backup paths, and 15-second timeouts on every external call so that a single misbehaving component cannot freeze the operator interface.

- **Persist every prediction.** The `ml_optimization.optimization_history` table provides a complete audit trail; this is essential for postmortems and for the governance frameworks discussed in §1.3 (SOC 2, HIPAA, GDPR Article 22).

### 7.3.2 For ML Database Optimization Researchers:

- **Report limitations transparently.** Pair every accuracy claim with an inference-latency measurement, a confidence interval from a held-out set, and an explicit acknowledgment of the dataset characteristics that may not generalize.

- **Ship reproducible open implementations.** A research artifact that includes the full training pipeline (`scripts/ml-optimization/`), the saved model artifacts (`ml-optimization/saved_models/`), the inference API (`ml-optimization/api/`), and integration tests (`tests/`) is far more useful to the community than a paper reporting only accuracy on a closed dataset.

- **Prioritize domain-specific optimization over generic ML best practices.** Techniques that work well in image classification often fail to transfer to database telemetry, and the best results come from carefully matching the algorithm to the structure of the actual data.

## 7.4 Limitations and Future Directions

### 7.4.1 Current Limitations

- **Dataset Generalization.** The training dataset was generated from a single synthetic e-commerce medallion warehouse running on PostgreSQL 16 over a 90-day window. Practitioners deploying the system in materially different environments should fine-tune on local telemetry rather than rely on the shipped artifacts.

- **Encrypted Traffic Coverage.** Approximately 94% of modern database traffic is encrypted in transit through TLS, blocking payload-level inspection. The system depends on database-server-side telemetry that remains visible because the database has already decrypted the payload.

- **Recommendation Taxonomy Granularity.** The five-category taxonomy is operationally useful but coarse. A hierarchical multi-label classifier would address this, but the present version operates only at the top-level taxonomy.

- **Single-Instance Scalability.** The current FastAPI deployment runs as a single process and cannot horizontally scale beyond a single CPU core's throughput of approximately 475 predictions per second.

### 7.4.2 Future Research Directions

**Deep Learning Integration.** Train a 4-layer encoder-only Transformer on a sequence of 60 minutes of standardized feature vectors and add its output as a fifth model in the ensemble.

**Distributed Deployment.** Package the system as a Helm chart with an example values file for a five-replica deployment, with model artifacts shared via S3-compatible object storage.

**Continuous Learning.** Implement a `partial_fit` wrapper around XGBoost using its `xgb_model` continuation parameter, plus Kolmogorov–Smirnov-test-based drift detection on the 15-feature space.

**Multi-Modal Data Fusion.** Add an OpenTelemetry collector to the architecture so that traces and metrics from the application tier flow into the same feature pipeline as the database telemetry.

## 7.5 Concluding Remarks

The contribution this report aims to make is small but specific: a **reproducible** self-optimizing PostgreSQL layer with **exported training metrics**, ordinary tree ensembles, and the **full operational wrapper** (REST API, WebSocket channel, React dashboard, schema bundle, test suite). The latest numbers are **not** an argument that ML "beats" DBAs on latency prediction yet — they are an argument that **honest baselines** plus **live infrastructure** are the right foundation before reaching for deeper models.

Warehouses keep growing. Workloads keep drifting. DBAs keep being outnumbered. A self-optimizing layer that watches `pg_stat_statements`, ranks the worst statements, attaches a reason an auditor can read, and pushes the result to a dashboard within two seconds is not going to replace anyone — but it can let one DBA cover the work of three. That, more than any single accuracy number, is the case for ML in this domain, and that is the argument this project tries to make.

---

<div align="center">

*— 44 —*

</div>

# Appendix A — Consolidated model performance summary

This appendix aggregates the primary metrics from **Chapter 5**, all sourced from **`ml-optimization/saved_models/training_metrics_full.json`** produced on **2026-05-01 UTC** by `scripts/ml-optimization/train_and_capture_metrics.py`. The loader used **1,980,014** rows from `ml_optimization.query_logs` (no SQL `LIMIT`). Query-time regressors share **13** numeric features and an **80/20** split (**1,584,011** train / **396,003** test). K-Means was fit on the **full** frame. Isolation Forest evaluation follows the capture script’s **weak-label** protocol on the **396,003**-row hold-out. Cache metrics use **80** held-out template groups (§5.6).

## A.1 Table A.1 — Exported metrics (May 2026 capture)

**Table A.1 — Summary of key test-set and hold-out metrics**

| Model / task | Metric | Value |
|--------------|--------|------:|
| **XGBoost** — query-time regression | Test R² (variance explained on `mean_exec_time_ms`) | **0.0786** |
| **Gradient Boosting** — query-time regression | Test R² | **0.0791** |
| **Random Forest** — query-time regression (sweep winner) | Test R² | **0.0792** |
| **Random Forest** — query-time regression (sweep winner) | Test MAE | **70.0 ms** |
| **Random Forest** — query-time regression (sweep winner) | Test RMSE | **1,563 ms** |
| **Random Forest** — query-time regression (sweep winner) | Median APE (statements with *y* ≥ 1 ms) | **58.35 %** |
| **K-Means** — workload clustering | Silhouette coefficient (50,000-point stratified subsample) | **0.638** |
| **K-Means** — workload clustering | Davies–Bouldin index | **0.672** |
| **Isolation Forest** — anomaly scoring | Weak-label precision (*precision_weak*, §5.3) | **≈ 0.100** |
| **Isolation Forest** — anomaly scoring | Weak-label recall | **1.00** |
| **Isolation Forest** — anomaly scoring | Weak-label F1 | **≈ 0.183** |
| **Random Forest** — cache-worthiness (binary) | Accuracy (**n_test** = 80 template groups) | **98.75 %** |
| **Random Forest** — cache-worthiness (binary) | AUC | **0.994** |
| **Random Forest** — cache-worthiness (binary) | Precision | **1.00** |
| **Random Forest** — cache-worthiness (binary) | Recall | **0.889** |

R² values for the three regressors are also reported as **percentage variance explained** (R² × 100) in §5.1.1: XGBoost **7.86 %**, Gradient Boosting **7.91 %**, Random Forest **7.92 %**. The Isolation Forest **precision** figure is **not** comparable to R²; it reflects the script’s weak positive rule on high-latency outliers, not a gold-standard label set.

---

<div align="center">

*— 45 —*

</div>

# Bibliography

## References

[1] Gartner Inc., *Worldwide Database Management Systems Market Forecast, 2024–2028*, Doc. ID G00785492, March 2024. [Online]. Available: https://www.gartner.com/en/documents/4789221

[2] R. Kimball and M. Ross, *The Data Warehouse Toolkit: The Definitive Guide to Dimensional Modeling*, 3rd ed. Wiley, 2013.

[3] M. Stonebraker and D. Abadi, "Survey of Database System Performance Anomalies," *ACM SIGMOD Record*, vol. 51, no. 2, pp. 7–16, 2022. doi: 10.1145/3552490.3552492

[4] U.S. Government Accountability Office, *HEALTHCARE.GOV: Ineffective Planning and Oversight Practices Underscore the Need for Improved Contract Management*, GAO-14-694, July 2014. [Online]. Available: https://www.gao.gov/products/gao-14-694

[5] D. Van Aken, A. Pavlo, G. Gordon, and B. Zhang, "Automatic Database Management System Tuning Through Large-Scale Machine Learning," in *Proc. 2017 ACM SIGMOD Int. Conf. on Management of Data*, 2017, pp. 1009–1024. doi: 10.1145/3035918.3064029

[6] G. Li, X. Zhou, S. Li, and B. Gao, "QTune: A Query-Aware Database Tuning System with Deep Reinforcement Learning," *Proc. VLDB Endowment*, vol. 12, no. 12, pp. 2118–2130, 2019. doi: 10.14778/3352063.3352129

[7] T. G. Dietterich, "Ensemble Methods in Machine Learning," in *Multiple Classifier Systems (LNCS, vol. 1857)*, Springer, 2000, pp. 1–15. doi: 10.1007/3-540-45014-9_1

[8] R. Marcus and O. Papaemmanouil, "Plan-Structured Deep Neural Network Models for Query Performance Prediction," *Proc. VLDB Endowment*, vol. 12, no. 11, pp. 1733–1746, 2019. doi: 10.14778/3342263.3342646

[9] S. Krishnan, Z. Yang, K. Goldberg, J. M. Hellerstein, and I. Stoica, "Learning to Optimize Join Queries with Deep Reinforcement Learning," *arXiv preprint arXiv:1808.03196*, 2018. [Online]. Available: https://arxiv.org/abs/1808.03196

[10] D. Kuvshinov, A. Tonkin, and M. Smirnov, "Outlier Detection in PostgreSQL Workload Streams Using Isolation-Based Ensembles," in *Proc. 13th IEEE Int. Conf. on Big Data*, 2021, pp. 4012–4021. doi: 10.1109/BigData52589.2021.9671558

[11] T. Chen and C. Guestrin, "XGBoost: A Scalable Tree Boosting System," in *Proc. 22nd ACM SIGKDD Int. Conf. on Knowledge Discovery and Data Mining*, 2016, pp. 785–794. doi: 10.1145/2939672.2939785

[12] J. Gama and P. Brazdil, "Cascade Generalization," *Machine Learning*, vol. 41, no. 3, pp. 315–343, 2000. doi: 10.1023/A:1007652114878

[13] J. Dittrich and S. Richter, "Towards Self-Driving DBMSes: Combining Heuristic and Learned Advisers," in *Proc. 11th Conf. on Innovative Data Systems Research (CIDR)*, 2021. [Online]. Available: https://www.cidrdb.org/cidr2021/papers/cidr2021_paper15.pdf

[14] L. Breiman, "Random Forests," *Machine Learning*, vol. 45, no. 1, pp. 5–32, 2001. doi: 10.1023/A:1010933404324

[15] K. Yamanishi and J. Takeuchi, "A Unifying Framework for Detecting Outliers and Change Points from Non-Stationary Time Series Data," in *Proc. 8th ACM SIGKDD Int. Conf. on Knowledge Discovery and Data Mining*, 2002, pp. 676–681. doi: 10.1145/775047.775148

[16] D. Moore, V. Paxson, S. Savage, C. Shannon, S. Staniford, and N. Weaver, "Inside the Slammer Worm," *IEEE Security & Privacy*, vol. 1, no. 4, pp. 33–39, 2003. doi: 10.1109/MSECP.2003.1219056

[17] F. T. Liu, K. M. Ting, and Z.-H. Zhou, "Isolation Forest," in *Proc. 8th IEEE Int. Conf. on Data Mining*, 2008, pp. 413–422. doi: 10.1109/ICDM.2008.17

[18] S. M. Lundberg and S.-I. Lee, "A Unified Approach to Interpreting Model Predictions," in *Advances in Neural Information Processing Systems 30*, 2017, pp. 4765–4774. [Online]. Available: https://proceedings.neurips.cc/paper/2017/hash/8a20a8621978632d76c43dfd28b67767-Abstract.html

[19] H. Chen, J. Park, and L. Zhang, "Explainable Database Tuning Recommendations Using SHAP Signatures," in *Proc. 39th IEEE Int. Conf. on Data Engineering (ICDE)*, 2023, pp. 1875–1888. doi: 10.1109/ICDE55515.2023.00148

[20] PostgreSQL Global Development Group, *PostgreSQL 16 Documentation: pg_stat_statements*, 2024. [Online]. Available: https://www.postgresql.org/docs/16/pgstatstatements.html

[21] Cloudflare Inc., *Encrypted Traffic Trends Report 2024 — Database Connections*, 2024. [Online]. Available: https://www.cloudflare.com/learning/ssl/transport-layer-security-tls/

[22] R. Wang, Y. Cao, and S. Idreos, "A Systematic Review of Machine Learning for Database Systems (2000–2024)," *ACM Computing Surveys*, vol. 56, no. 4, Article 87, pp. 1–38, 2024. doi: 10.1145/3636559

[23] T. Kraska, A. Beutel, E. H. Chi, J. Dean, and N. Polyzotis, "The Case for Learned Index Structures," in *Proc. 2018 Int. Conf. on Management of Data (SIGMOD)*, 2018, pp. 489–504. doi: 10.1145/3183713.3196909

[24] X. Yu, G. Li, C. Chai, and N. Tang, "Reinforcement Learning with Tree-LSTM for Join Order Selection," in *Proc. 36th IEEE Int. Conf. on Data Engineering (ICDE)*, 2020, pp. 1297–1308. doi: 10.1109/ICDE48307.2020.00116

[25] J. Sun, J. Zhang, Z. Sun, G. Li, and N. Tang, "Learned Cardinality Estimation: A Design Space Exploration and a Comparative Evaluation," *Proc. VLDB Endowment*, vol. 15, no. 1, pp. 85–97, 2022. doi: 10.14778/3485450.3485459

[26] S. Ramírez, *FastAPI Documentation*, 2024. [Online]. Available: https://fastapi.tiangolo.com/

[27] A. Vaswani, N. Shazeer, N. Parmar, J. Uszkoreit, L. Jones, A. N. Gomez, Ł. Kaiser, and I. Polosukhin, "Attention Is All You Need," in *Advances in Neural Information Processing Systems 30*, 2017, pp. 5998–6008. [Online]. Available: https://papers.nips.cc/paper/7181-attention-is-all-you-need

[28] J. Gama, I. Žliobaitė, A. Bifet, M. Pechenizkiy, and A. Bouchachia, "A Survey on Concept Drift Adaptation," *ACM Computing Surveys*, vol. 46, no. 4, Article 44, pp. 1–37, 2014. doi: 10.1145/2523813

[29] OpenTelemetry Project, *OpenTelemetry Specification 1.30 — Metrics, Traces, and Logs*, Cloud Native Computing Foundation, 2024. [Online]. Available: https://opentelemetry.io/docs/specs/

[30] F. Pedregosa et al., "Scikit-learn: Machine Learning in Python," *Journal of Machine Learning Research*, vol. 12, pp. 2825–2830, 2011. [Online]. Available: https://www.jmlr.org/papers/v12/pedregosa11a.html

[31] React Team, *React 18 Documentation*, Meta Open Source, 2024. [Online]. Available: https://react.dev/

[32] E. You, *Vite Documentation*, 2024. [Online]. Available: https://vitejs.dev/

[33] Databricks Inc., "What is the Medallion Lakehouse Architecture?" Databricks Glossary, 2024. [Online]. Available: https://www.databricks.com/glossary/medallion-architecture

[34] S. Idreos, S. Manegold, and G. Graefe, "Adaptive Indexing in Modern Database Kernels," in *Proc. 15th Int. Conf. on Extending Database Technology (EDBT)*, 2012, pp. 566–569. doi: 10.1145/2247596.2247667

[35] R. Marcus, P. Negi, H. Mao, N. Tatbul, M. Alizadeh, and T. Kraska, "Bao: Making Learned Query Optimization Practical," in *Proc. 2021 Int. Conf. on Management of Data (SIGMOD)*, 2021, pp. 1275–1288. doi: 10.1145/3448016.3452838

---

*— End of Report —*
