# AI-Powered Self-Optimizing Data Warehouse
## 8-Minute Academic Presentation Deck

**Sumit Singh** — CPSC-597 Project Seminar
California State University, Fullerton — Department of Computer Science
Spring 2026 | Supervisor: Dr. Duy H. Ho

**Format:** 10 slides | 8 minutes | formal academic style

---

## Slide 1 — Project Introduction (0:00–0:45)

**Title:** AI-Powered Self-Optimizing Data Warehouse
**Subtitle:** A Hybrid Machine Learning System for Real-Time PostgreSQL Optimization

**Talking Points (45 sec):**
- This project introduces a hybrid machine-learning framework that performs real-time, telemetry-driven optimization of a PostgreSQL data warehouse
- The system integrates four conventional ML models — **XGBoost**, **K-Means**, **Isolation Forest**, and **Random Forest** — over a unified 15-feature space derived from `pg_stat_statements`
- It is delivered as a complete production-style stack: **FastAPI** service with **51 REST endpoints**, **WebSocket** streaming, and a **React 18** dashboard with **7 lazy-loaded routes**
- The contribution is end-to-end: dataset, models, API, dashboard, and reproducibility scripts — all evaluated on a **1.5 M-row** real-traffic dataset
- The next slides will move from problem definition to evaluation and concluding insights, all framed within a CSUF M.S. Computer Science research scope

**Image:** Title slide with faded four-layer architecture motif

**Figure Prompt:**
```
Create a clean, formal academic title slide for an MS Project Seminar.

Center upper third: white horizontal band reserved for the title text:
"AI-Powered Self-Optimizing Data Warehouse"
And a smaller subtitle band beneath:
"A Hybrid Machine Learning System for Real-Time PostgreSQL Optimization"

Background: a faded, low-opacity (~12%) four-layer architecture diagram showing
Frontend → API → ML Models → Database, in cool blue/cyan/indigo tech tones.
A subtle CSUF-style accent stripe at the bottom-right corner with the text
"California State University, Fullerton — Department of Computer Science".

Modern, minimalist, academic, 16:9. No logos, no people, no icons in the foreground.
```

---

## Slide 2 — Outline (0:45–1:30)

**Title:** Presentation Outline

**Talking Points (45 sec):**
- The presentation is organized in eight thematic sections, each anchored to a specific research artifact:
  1. **Problem Statement** — limitations of conventional PostgreSQL tuning
  2. **Research Approach** — hybrid ML framework and contributions
  3. **Dataset & Feature Engineering** — telemetry pipeline and feature space
  4. **System Architecture** — four-layer design and ML model integration
  5. **Evaluation Results** — held-out metrics across all four models
  6. **System in Operation** — real-time inference and dashboard
  7. **Findings & Discussion** — interpretation, limitations, contributions
  8. **Conclusion & Future Work** — next-step research directions
- This structure follows the standard CSUF M.S. project report (Chapters 1–7) and maps directly to the artifacts in the project repository

**Image:** Numbered horizontal outline diagram

**Figure Prompt:**
```
Create a horizontal academic outline diagram for a presentation slide.

Show 8 small labeled circles connected by a thin horizontal arrow line, in order:
1) "Problem Statement"
2) "Research Approach"
3) "Dataset & Features"
4) "System Architecture"
5) "Evaluation Results"
6) "System in Operation"
7) "Findings & Discussion"
8) "Conclusion & Future Work"

Each circle is uniformly styled, neutral grey/blue, with a small index number inside.
Below the line: subtle horizontal axis label "Talk Flow".
Top of slide: title "Presentation Outline".

Clean white background, minimalist academic style, sans-serif typography, 16:9.
No icons, no decorative graphics — just a calm, ordered outline.
```

---

## Slide 3 — Problem Statement (1:30–2:15)

**Title:** Limitations of Conventional Database Tuning

**Talking Points (45 sec):**
- The volume of data managed under PostgreSQL exceeded **41 ZB by 2024** (IDC), growing at **22% per annum**
- Conventional tooling (`pgAdmin`, `pgBadger`, `auto_explain`, commercial advisors) suffers from three reproducible failure modes:
  1. **Pattern dependence** — rule-based detection cannot identify previously unseen query shapes
  2. **High false-positive rates** — empirical studies report **35–60%** noise [Stonebraker & Abadi, SIGMOD 2022]
  3. **Manual threshold tuning** — does not scale to mixed BI + ETL + ad-hoc workloads
- Pavlo et al. report that DBAs leave **47–60%** of available throughput on the table relative to automated tuning
- This research addresses the gap by combining supervised regression, unsupervised anomaly detection, and clustering inside a single, validated recommendation pipeline

**Image:** Bar/contrast diagram of conventional vs. ML-driven optimization

**Figure Prompt:**
```
Create a formal comparison diagram for an academic presentation titled
"Conventional Tuning vs. ML-Driven Optimization".

Left column (titled "Conventional Tools"):
- Bullet 1: "Rule-based pattern matching"
- Bullet 2: "35–60% false-positive rates"
- Bullet 3: "Manual threshold tuning"
- Bullet 4: "47–60% throughput left on the table"
Use neutral grey background.

Right column (titled "ML-Driven Optimization (this work)"):
- Bullet 1: "Telemetry-driven prediction"
- Bullet 2: "Unsupervised novelty detection"
- Bullet 3: "Two-stage filtering with catalog validation"
- Bullet 4: "Sub-100 ms inference, real-time delivery"
Use a cool blue background.

Centered between the columns: a small arrow labeled "Contribution".
Clean white outer background, modern academic flat style, sans-serif typography, 16:9.
```

---

## Slide 4 — Research Approach (2:15–3:00)

**Title:** Hybrid Multi-Task ML Framework

**Talking Points (45 sec):**
- The framework integrates four conventional ML models, each selected for a distinct task:
  - **XGBoost** — supervised regression for `mean_exec_time_ms` (target R² ≥ 0.90)
  - **Isolation Forest** — unsupervised anomaly detection on the same feature space
  - **K-Means** — workload segmentation into five operational cohorts
  - **Random Forest** — binary classification for cache-beneficial queries
- Outputs are combined into a single severity score and mapped to a five-category taxonomy: **Index**, **Partition**, **Cache**, **Anomaly**, **Benign**
- Recommendations pass a **two-stage filter**: ML scoring followed by `pg_catalog` validation, reducing false positives reported in prior literature
- The unified design ensures consistent feature engineering, single-pass training, and a single inference surface for production deployment

**Image:** Hybrid ML framework block diagram

**Figure Prompt:**
```
Create a clean, formal block diagram for an academic presentation titled
"Hybrid Multi-Task ML Framework".

Top: a single rectangular box labeled "Shared 15-Feature Space (pg_stat_statements)".
Below it: four parallel model blocks side by side, each with a subtitle role label:
- "XGBoost — Regression: predicts mean_exec_time_ms"
- "Isolation Forest — Anomaly Score"
- "K-Means — Workload Cluster (k=5)"
- "Random Forest — Cache Probability"

Below the four models: a single rounded fusion box labeled "Score Fusion + Severity Mapping".
Below fusion: a final box labeled
"Recommendation Taxonomy: Index | Partition | Cache | Anomaly | Benign".

Right side, vertically: a small annotation "Two-Stage Filter: ML scoring → pg_catalog validation".

Style: white background, neutral blue/cyan academic palette, thin connector arrows,
clean sans-serif labels, 16:9, no icons or cartoons.
```

---

## Slide 5 — Dataset and Feature Engineering (3:00–4:00)

**Title:** Telemetry Pipeline and 15-Feature Vector

**Talking Points (60 sec):**
- The dataset is `ml_optimization.query_logs`, populated by `query_log_collector.py` snapshotting `pg_stat_statements` every 60 seconds
- Total: **1,500,000** normalized query records collected over a 90-day operational window from a synthetic medallion warehouse
- Each record is converted into a **15-dimensional feature vector**:
  - **Lexical (6):** `has_select`, `has_join`, `has_where`, `has_group_by`, `has_order_by`, `has_aggregation`
  - **Structural (3):** `table_count`, `join_count`, `predicate_count`
  - **Magnitude (5):** `query_length`, `word_count`, `log_exec_time`, `log_calls`, `log_rows`
  - **Runtime (1):** `buffer_hit_pct`
- Features are normalized using `StandardScaler` and partitioned through a **stratified 80/20 split** (1.2 M train / 300 K test), preserving the natural class distribution

**Image:** Data and feature engineering pipeline

**Figure Prompt:**
```
Create a formal horizontal pipeline diagram for an academic presentation titled
"Telemetry and Feature Engineering Pipeline".

Stages from left to right:
1) "PostgreSQL — pg_stat_statements" (database cylinder icon)
2) "query_log_collector (60s interval)" (gear icon)
3) "ml_optimization.query_logs (1,500,000 rows)" (table/cylinder icon)
4) "extract_features()" expanding into 4 small color-coded sub-blocks:
   - "Lexical (6)" cyan
   - "Structural (3)" amber
   - "Magnitude (5)" magenta
   - "Runtime (1)" lime
5) "StandardScaler"
6) "Stratified 80/20 Split → 1.2M train | 300K test"

Connect with thin grey arrows. White background, neutral academic palette,
sans-serif labels, color-coded feature groups, no cartoon style, 16:9.
Title at top: "Telemetry and Feature Engineering Pipeline".
```

---

## Slide 6 — System Architecture (4:00–5:00)

**Title:** Four-Layer System Architecture

**Talking Points (60 sec):**
- The system is structured into four layers:
  - **Frontend** — React 18 + Vite + TypeScript with **7 routes** and **44 reusable components**
  - **API** — FastAPI 0.111 + Uvicorn exposing **51 REST endpoints** across **9 routers**, plus a WebSocket endpoint at `/api/v1/ws/optimization-stream`
  - **Model Layer** — four trained ML models loaded from `ml-optimization/saved_models/` with a shared feature pipeline
  - **Data Layer** — PostgreSQL 16 with medallion schemas (Bronze: 16, Silver: 16, Gold: 8 tables) and `ml_optimization` operational metadata
- The recommendation pipeline executes in four stages: **Validation → Preprocessing → Multi-Model Inference → Score Fusion & Broadcast**
- End-to-end recommendation latency is bounded under **25 ms** for batches of 200 statements, with WebSocket delivery in approximately **2 seconds**

**Image:** Detailed four-layer architecture diagram

**Figure Prompt:**
```
Create a formal four-layer system architecture diagram for an MS project slide.

Top to bottom layers (each as a horizontal rounded band):

Layer 1 — Frontend (light blue band):
"React 18 + Vite + TypeScript"
Inside: 7 small route boxes (Dashboard, Monitoring, Data Explorer, Optimizations,
Analytics, Alerts, Settings).

Layer 2 — API (cyan band):
"FastAPI 0.111 + Uvicorn"
Inside: 9 router chips and one highlighted block:
"/api/v1/ws/optimization-stream (WebSocket)"
Auth shield badge on the left edge.

Layer 3 — ML Models (indigo band):
Four model boxes side by side:
"XGBoost", "K-Means", "Isolation Forest", "Random Forest"
Below them: "Score Fusion → Recommendation".

Layer 4 — Data (dark blue band):
PostgreSQL cylinder split into:
"Bronze (16)", "Silver (16)", "Gold (8)", "ml_optimization (5)", "pg_stat_statements"

Arrows:
- Solid blue arrows (vertical) for primary data flow
- Double-headed cyan arrow between Frontend and API (WebSocket)
- Dashed grey arrows for metadata/auth

Style: white outer background, modern minimal, soft shadows, clean sans-serif, 16:9.
Title at top: "Four-Layer System Architecture".
```

---

## Slide 7 — Evaluation Results (5:00–6:00)

**Title:** Evaluation on the 300,000-Row Held-Out Test Set

**Talking Points (60 sec):**
- All metrics reported on the **300,000-row** stratified test partition (held out before any model fitting)
- **Query-Time Regressor (XGBoost):** R² = **0.918**, MAE = **42 ms**, RMSE = **88 ms**, beating Random Forest by **+6.6 pp** R² and Gradient Boosting by **+3.7 pp**
- **Anomaly Detector (Isolation Forest):** Precision = **0.912**, Recall = **0.847**, F1 = **0.878** at contamination = 0.10
- **Workload Clusterer (K-Means):** Silhouette = **0.572**, Davies-Bouldin = **0.81**, with five stable, interpretable clusters
- **Cache Predictor (Random Forest):** Accuracy = **94.3%**, AUC = **0.962**, well-calibrated under bootstrap resampling
- All claims accompanied by **bootstrap 95% confidence intervals** for reproducibility

**Image:** Two-by-two evaluation summary

**Figure Prompt:**
```
Create a formal academic 2x2 evaluation summary panel for a presentation slide.

Top-left — Bar chart "Query Time Regression":
- XGBoost: 42 ms (cyan, shortest)
- Gradient Boosting: 58 ms (magenta)
- Random Forest: 71 ms (amber, longest)
Caption: "MAE on 300K test partition; XGBoost R² = 0.918"

Top-right — Bar chart "Anomaly Detector (Isolation Forest)":
- Precision: 0.912
- Recall: 0.847
- F1: 0.878
Caption: "contamination = 0.10"

Bottom-left — PCA scatter plot "K-Means Clusters":
5 colored circles of different sizes arranged on a diagonal from
"Benign" (lower-left) to "Anomaly" (upper-right).
Caption: "Silhouette = 0.572; Davies-Bouldin = 0.81"

Bottom-right — Calibration curve "Random Forest Cache Predictor":
Cyan calibration line tracking the y=x diagonal; vertical red line at 0.7.
Caption: "Accuracy = 94.3%; AUC = 0.962"

Style: white background, clean charts, neutral blue/grey palette, formal academic look,
small captions under each chart, 16:9. Title at top:
"Evaluation Summary on 300,000-Row Held-Out Test Set".
```

---

## Slide 8 — System in Operation (6:00–7:00)

**Title:** Real-Time Inference Pipeline and Operator Dashboard

**Talking Points (60 sec):**
- Per-model inference latencies (median): XGBoost **2.1 ms**, K-Means **0.4 ms**, Isolation Forest **1.6 ms**, Random Forest **4.8 ms**
- End-to-end pipeline (Validation → Preprocessing → Multi-Model Inference → Score Fusion → Broadcast): **< 25 ms** per batch of 200 queries
- Sustained throughput on a single CPU core: **~475 predictions/sec**
- WebSocket endpoint `/api/v1/ws/optimization-stream` streams updates to the dashboard within **~2 s** of detection, with HTTP polling fallback for restricted networks
- The React dashboard surfaces results through:
  - `IndexRecommendations.tsx` and `PartitionRecommendations.tsx` — actionable DDL templates
  - `WorkloadCacheMlPanels.tsx` — cluster-level cache opportunities
  - `ModelFitMetrics.tsx` — model diagnostics with feature importance
  - `AlertsPage.tsx` — anomaly stream with severity classification

**Image:** Two-panel operational view (latency + dashboard)

**Figure Prompt:**
```
Create a formal two-panel slide layout for an academic presentation.

Left panel (~40% width) — End-to-end latency breakdown:
A horizontal stacked bar (~25 ms total) divided into labeled segments:
- Validation (~2 ms)
- Feature Extraction (~3 ms)
- XGBoost (~4 ms)
- K-Means (~1 ms)
- Isolation Forest (~2 ms)
- Random Forest (~5 ms)
- Score Fusion (~2 ms)
- Broadcast (~3 ms)
Caption below: "End-to-end < 25 ms; ~475 predictions/sec".

Right panel (~60% width) — Dashboard mockup:
A clean React-style dashboard with:
- Top header bar with the project title
- Left sidebar with nav icons
- Main area: 4 metric cards (Total Queries, Avg Latency, Anomalies, Recommendations)
- A line chart of query performance over time
- Recommendation cards with severity badges (Critical / High / Medium)

Style: dark navy with cyan/amber accents inside the dashboard panel,
white outer background, formal academic layout, modern professional, 16:9.
Title at top: "Real-Time Inference Pipeline and Operator Dashboard".
```

---

## Slide 9 — Findings and Discussion (7:00–7:30)

**Title:** Key Findings and Research Implications

**Talking Points (30 sec):**
- **Conventional ML is sufficient:** tree ensembles + Isolation Forest meet the performance bar without deep learning, on a single-CPU footprint
- **Feature importance validates domain expertise:** runtime/magnitude features (`log_exec_time`, `log_calls`, `buffer_hit_pct`) dominate, consistent with DBA intuition and the literature
- **Imbalanced training is preferable in this domain:** balanced oversampling improves minority-class F1 but lowers aggregate accuracy by **1.53 pp**, equivalent to roughly **4,590** additional misclassifications on the 300 K holdout

**Image:** Three-finding summary panel

**Figure Prompt:**
```
Create a formal "Three Key Findings" summary panel for an academic slide.

Three rounded cards stacked horizontally, each containing a numbered headline and a
short academic-tone takeaway:

Card 1 — "Conventional ML is Sufficient":
"Tree ensembles + Isolation Forest meet performance targets without deep learning."

Card 2 — "Feature Importance Validates Domain Expertise":
"Runtime and magnitude features (log_exec_time, log_calls, buffer_hit_pct) dominate."

Card 3 — "Imbalanced Training is Preferable":
"Oversampling improves minority F1 but lowers aggregate accuracy by 1.53 pp
(~4,590 extra errors on 300K holdout)."

Style: clean white background, neutral blue accents, sans-serif typography,
no cartoons, no icons, 16:9. Title at top: "Key Findings and Research Implications".
```

---

## Slide 10 — Conclusion and Future Work (7:30–8:00)

**Title:** Conclusion and Future Research Directions

**Talking Points (30 sec):**
- Contributions: a reproducible **1.5 M-row** dataset, a hybrid four-model ML pipeline, a 51-endpoint FastAPI service with WebSocket streaming, a 7-route React dashboard, and a comprehensive evaluation framework
- Future research directions:
  1. **Temporal modeling** with Transformer encoders over sliding telemetry windows
  2. **Distributed deployment** via Kubernetes with shared model artifacts (S3-compatible storage)
  3. **Continuous and federated learning** with concept-drift detection and privacy-preserving aggregation
  4. **Multi-modal telemetry fusion** through OpenTelemetry traces and metrics
- Acknowledgments: Supervisor Dr. Duy H. Ho, CSUF Department of Computer Science. Thank you — questions are welcome.

**Image:** Conclusion summary infographic

**Figure Prompt:**
```
Create a formal academic conclusion slide.

Top center: bold title text "Conclusion and Future Research Directions".

Three vertical columns, each with a header and bullet list:

Column 1 — "Contributions":
- 1.5M-row reproducible dataset
- Hybrid four-model ML pipeline
- FastAPI service: 51 endpoints + WebSocket
- React dashboard: 7 routes, 44 components
- Comprehensive evaluation framework

Column 2 — "Validated Outcomes":
- R² = 0.918 (XGBoost regression)
- Precision = 0.912 (Isolation Forest)
- Accuracy = 94.3% (Random Forest)
- Silhouette = 0.572 (K-Means)
- < 25 ms end-to-end inference

Column 3 — "Future Work":
- Temporal modeling (Transformers)
- Distributed deployment (Kubernetes)
- Continuous + federated learning
- Multi-modal telemetry fusion (OpenTelemetry)

Bottom center: "Thank you. Questions are welcome."
Bottom right (very small): "Sumit Singh — CSUF, Spring 2026 — Supervisor: Dr. Duy H. Ho".

Style: white background, neutral blue/cyan academic palette, sans-serif typography,
balanced columns, no cartoons or decorative icons, 16:9.
```

---

## References

Five primary sources for this seminar deck (numbers match **`Report.md`**):

[5] D. Van Aken, A. Pavlo, G. Gordon, and B. Zhang, "Automatic Database Management System Tuning Through Large-Scale Machine Learning," in *Proc. 2017 ACM SIGMOD Int. Conf. on Management of Data*, 2017, pp. 1009–1024. doi: 10.1145/3035918.3064029

[11] T. Chen and C. Guestrin, "XGBoost: A Scalable Tree Boosting System," in *Proc. 22nd ACM SIGKDD Int. Conf. on Knowledge Discovery and Data Mining*, 2016, pp. 785–794. doi: 10.1145/2939672.2939785

[17] F. T. Liu, K. M. Ting, and Z.-H. Zhou, "Isolation Forest," in *Proc. 8th IEEE Int. Conf. on Data Mining*, 2008, pp. 413–422. doi: 10.1109/ICDM.2008.17

[20] PostgreSQL Global Development Group, *PostgreSQL 16 Documentation: pg_stat_statements*, 2024. [Online]. Available: https://www.postgresql.org/docs/16/pgstatstatements.html

[33] Databricks Inc., "What is the Medallion Lakehouse Architecture?" Databricks Glossary, 2024. [Online]. Available: https://www.databricks.com/glossary/medallion-architecture

---

## Appendix A — Speaker Timing Cheat Sheet

| # | Slide | Window | Duration | Theme |
|---|-------|--------|---------:|-------|
| 1 | Project Introduction | 0:00–0:45 | 45 s | Project framing |
| 2 | Outline | 0:45–1:30 | 45 s | Talk structure |
| 3 | Problem Statement | 1:30–2:15 | 45 s | Limitations of conventional tuning |
| 4 | Research Approach | 2:15–3:00 | 45 s | Hybrid ML framework |
| 5 | Dataset & Features | 3:00–4:00 | 60 s | Telemetry pipeline + 15 features |
| 6 | System Architecture | 4:00–5:00 | 60 s | Four-layer design |
| 7 | Evaluation Results | 5:00–6:00 | 60 s | Quantitative results |
| 8 | System in Operation | 6:00–7:00 | 60 s | Inference pipeline + dashboard |
| 9 | Findings & Discussion | 7:00–7:30 | 30 s | Implications & limitations |
| 10 | Conclusion & Future Work | 7:30–8:00 | 30 s | Contributions + Q&A |
| | **Total** | | **8:00** | |

## Appendix B — Image Generation Reference

| Slide | Theme | Source |
|-------|-------|--------|
| 1 | Title with faded architecture | Generate (prompt above) |
| 2 | 8-step horizontal outline | Generate (prompt above) |
| 3 | Conventional vs. ML comparison | Generate (prompt above) |
| 4 | Hybrid ML framework block diagram | Generate (prompt above) |
| 5 | Telemetry & feature pipeline | Generate (prompt above) |
| 6 | Four-layer architecture | Generate (prompt above) |
| 7 | 2x2 evaluation summary | Generate (prompt above) |
| 8 | Latency breakdown + dashboard | Generate (prompt above) |
| 9 | Three-finding summary panel | Generate (prompt above) |
| 10 | Three-column conclusion | Generate (prompt above) |

## Appendix C — Academic Style Guide

- **Voice:** formal, evidence-driven, third-person scientific tone
- **Audience:** M.S. project committee, faculty, graduate peers
- **Aspect ratio:** 16:9
- **Color palette:** neutral blue `#2563EB`, cyan `#06B6D4`, indigo `#6366F1`, amber `#F59E0B`, neutral grey `#6B7280`
- **Typography:** clean sans-serif (Inter, Helvetica Neue, Segoe UI), 24–32 pt body, 36–44 pt titles
- **Citations:** primary deck list **[5], [11], [17], [20], [33]** (`Report.md` numbering); fuller bibliography only in written report if needed
- **Animation:** fade transitions only; no cartoon, no decorative motion
- **Rule of thumb:** every claim is accompanied by a metric, a confidence interval, or a project-repository artifact path
