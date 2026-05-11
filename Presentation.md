# AI-Powered Self-Optimizing Data Warehouse
## Presentation Slide Deck (Detailed)

**Sumit Singh**
CPSC-597: Project (Seminar) | California State University, Fullerton | Spring 2026
Supervisor: Dr. Duy H. Ho

---

## Slide 1: Title Slide

**Title:** AI-Powered Self-Optimizing Data Warehouse
**Subtitle:** Hybrid ML-Driven Real-Time Optimization for PostgreSQL Warehouses

**Talking Points:**
- Master of Science Project, CPSC-597
- Spring 2026, California State University, Fullerton
- Supervisor: Dr. Duy H. Ho

**Image:** System Architecture Diagram (4-layer overview)

**Figure Prompt:**
```
Create a clean, minimal title-slide background for an academic presentation. Show a faded, 
semi-transparent four-layer architecture diagram (Frontend → API → ML Models → Database) 
in the background with subtle blue/cyan tech tones. The foreground should have clear space 
for title text. White background, modern, professional, no clutter. 16:9 aspect ratio.
```

---

## Slide 2: Agenda / Outline

**Content:**
1. Problem Statement & Motivation
2. Research Objectives
3. System Architecture
4. Data Warehouse Design (Medallion)
5. Data Pipeline & Feature Engineering
6. ML Model Architecture & Results
7. Real-Time Inference & API
8. Frontend Dashboard Demo
9. Imbalanced vs. Balanced Training Experiment
10. Key Findings & Insights
11. Limitations & Future Work
12. Conclusion & Q&A

**Image:** None (text-only slide with numbered list)

---

## Slide 3: Problem Statement

**Title:** Why Self-Optimizing Warehouses?

**Talking Points:**
- PostgreSQL deployments manage **41+ zettabytes** globally (IDC 2024), growing at 22%/year
- **73%** of DB performance incidents trace to untuned query plans (Gartner 2024)
- Annual global DBA cost exceeds **USD $204 billion**
- DBAs leave **47–60%** of available throughput on the table (Pavlo et al., OtterTune)
- Rule-based advisors (pgBadger, auto_explain) suffer **35–60% false-positive rates**
- Manual tuning cannot keep pace with evolving medallion workloads

**Key Quote:**
> "Yesterday's optimal index becomes today's wasted disk page."

**Image:** Problem landscape infographic

**Figure Prompt:**
```
Create a professional infographic showing the "Database Optimization Crisis." Left side: 
icons representing manual DBA work (wrench, clock, warning triangle) with statistics 
"73% untuned incidents", "$204B annual cost", "35-60% false positives". Right side: 
growing data volume wave (41 ZB label) overwhelming a small human figure. Use red/amber 
warning tones on left, blue/cyan tech tones on right. Clean white background, modern 
flat style, no photos, publication quality. 16:9 ratio.
```

---

## Slide 4: Healthcare.gov Case Study

**Title:** Real-World Impact of Unoptimized Databases

**Talking Points:**
- **October 1, 2013:** Healthcare.gov launch on PostgreSQL backend
- Load-tested for ~50,000 concurrent users; Day 1 brought **4.7 million visitors**
- Only **6 users** could simultaneously complete registration
- System unusable for **6 weeks**; remediation cost exceeded **USD $1.7 billion**
- Root cause: unoptimized queries → cascading lock contention
- No tooling to rank which queries to fix first
- A self-optimizing system would have surfaced worst statements within minutes

**Image:** Healthcare.gov timeline/impact infographic

**Figure Prompt:**
```
Create a timeline infographic for a presentation slide. Left: "Oct 1, 2013 Launch" with 
a server icon. Center: "4.7M visitors vs 50K tested" with an overwhelmed server visual 
(heat/overload indicator). Right: "$1.7B remediation cost" with a dollar sign. Below: 
a small callout "Root cause: unoptimized queries, no automated ranking." Use red/amber 
for crisis indicators, neutral grey background area, clean modern flat design. 16:9.
```

---

## Slide 5: Four Challenges

**Title:** Problem Decomposition

**Content (4-quadrant layout):**

| Challenge | Problem | Solution |
|-----------|---------|----------|
| 1. Unknown Query Patterns | Signature-based tools miss novel shapes | Isolation Forest + K-Means |
| 2. High False Positives | 35–60% noise in existing tools | Two-stage ML + pg_catalog filter |
| 3. Explainability Gap | Regulatory pressure (SOC 2, HIPAA, GDPR) | XGBoost feature importances |
| 4. Real-Time Constraint | Must respond < 100 ms per query | WebSocket streaming, < 25 ms batch |

**Image:** 4-quadrant challenge diagram

**Figure Prompt:**
```
Create a 2×2 grid diagram for a presentation. Four quadrants with subtle color coding:
- Top-left (red): "Unknown Patterns" with a question mark icon
- Top-right (amber): "False Positives" with a warning icon  
- Bottom-left (blue): "Explainability" with a magnifying glass icon
- Bottom-right (green): "Real-Time" with a clock/speed icon
Each quadrant has a short 2-word label and icon only. Clean, minimal, white background, 
rounded corners on each quadrant. Professional academic style. 16:9.
```

---

## Slide 6: Research Objectives

**Title:** Five Primary Objectives

**Content:**
1. **Query Time Prediction** — XGBoost regressor targeting R² > 0.90
2. **Anomaly Detection** — Isolation Forest on same 15-feature space (no labels)
3. **Workload Segmentation** — K-Means into 5 operational cohorts
4. **Cache Classification** — Random Forest binary predictor (cache-worthy vs not)
5. **Operator Interface** — React dashboard with real-time WebSocket delivery

**Image:** Objective-to-model-to-component mapping diagram

**Figure Prompt:**
```
Create a horizontal flow diagram for 5 research objectives. Left column: numbered 
objectives (1-5) in blue boxes. Center column: corresponding ML model names (XGBoost, 
Isolation Forest, K-Means, Random Forest, WebSocket) in cyan boxes. Right column: 
dashboard components (IndexRecommendations, AlertsPage, WorkloadCacheMlPanels, 
ModelFitMetrics, OptimizationsPage) in green boxes. Connect with thin arrows left→right. 
Clean white background, minimal, professional. 16:9.
```

---

## Slide 7: Five Contributions

**Title:** Key Contributions

**Content:**
1. **Five-Category Recommendation Taxonomy** — Index, Partition, Cache, Anomaly, Benign
2. **Reproducible 1.5M-Sample Dataset** — query_log_collector + 3 traffic generators
3. **Hybrid Multi-Task ML Pipeline** — 4 models, shared feature space, single orchestrator
4. **Sub-100 ms Real-Time Inference** — 0.4–5.5 ms per model, < 25 ms end-to-end
5. **Production-Grade React Dashboard** — 7 routes, 44 components, WebSocket + polling

**Image:** Contribution summary table or icon grid

**Figure Prompt:**
```
Create a vertical stack of 5 contribution cards for a presentation. Each card is a 
rounded rectangle with a number (1-5), a short title, and a small relevant icon 
(taxonomy tree, database cylinder, neural network, stopwatch, monitor screen). 
Cards are stacked vertically with slight overlap. Use blue gradient backgrounds. 
Clean, modern, professional. 16:9.
```

---

## Slide 8: System Architecture

**Title:** Four-Layer Architecture

**Talking Points:**
- **Frontend:** React 18 + TypeScript 5.5 + Vite 5.4 (7 routes, 44 components)
- **API:** FastAPI 0.111 + Uvicorn (51 endpoints, 9 routers, WebSocket)
- **ML Models:** XGBoost, K-Means, Isolation Forest, Random Forest (shared feature space)
- **Database:** PostgreSQL 16 (Bronze/Silver/Gold + ml_optimization + monitoring schemas)
- Bidirectional data flow: REST polling + WebSocket push
- End-to-end: < 25 ms inference, ~2 s dashboard updates

**Image:** Full System Architecture Diagram

**Figure Prompt:**
```
Create a polished, publication-quality system architecture diagram with 4 horizontal 
layers stacked vertically:

TOP LAYER (Frontend): Large rounded box labeled "React 18 + TypeScript + Vite" containing 
7 small route boxes (Dashboard, Monitoring, Data Explorer, Optimizations, Analytics, 
Alerts, Settings). Show WebSocket icon and REST icon connecting downward.

SECOND LAYER (API): Rounded box labeled "FastAPI 0.111 + Uvicorn" containing grouped 
blocks for "9 Routers / 51 Endpoints" and a WebSocket endpoint block 
"/api/v1/ws/optimization-stream". Auth middleware badge on side.

THIRD LAYER (ML Models): 4 model boxes side by side: "XGBoost (Regression)", 
"K-Means (Clustering)", "Isolation Forest (Anomaly)", "Random Forest (Cache)". 
A "Feature Extraction" block feeds all 4. Output arrow labeled "Score Fusion → Recommendation".

BOTTOM LAYER (PostgreSQL): Database cylinder with internal schema sections: 
"Bronze (16)", "Silver (16)", "Gold (8)", "ml_optimization (5 tables)", 
"pg_stat_statements". Arrow labeled "Telemetry" going up.

ARROWS: Solid blue arrows for primary data flow (up/down). Dashed grey for metadata. 
Double-headed cyan arrow for WebSocket bidirectional.

STYLE: White background, blue/cyan/indigo palette, subtle shadows, clean sans-serif 
font. No clutter. Balanced spacing. 16:9 ratio. Title: "System Architecture".
```

---

## Slide 9: Medallion Data Warehouse

**Title:** Bronze → Silver → Gold Architecture

**Talking Points:**
- **Bronze (16 tables):** Raw, source-aligned ingestion (country, location, warehouse, product, inventory, person, restricted_info, person_location, phone_number, customer_company, customer_employee, customer, employment_jobs, employment, orders, order_item)
- **Silver (16 tables):** Cleaned, standardized, SCD-ready, surrogate keys
- **Gold (8 tables):** Aggregated analytics marts (daily_sales, customer_360, etc.)
- 22 SQL schema files define the complete warehouse
- ETL pipeline transforms Bronze → Silver → Gold

**Image:** Medallion architecture flow diagram

**Figure Prompt:**
```
Create a horizontal 3-stage medallion architecture diagram. 

LEFT: Bronze box (copper/bronze color) containing "16 Raw Tables" with small table icons 
stacked inside. Label: "Source-Aligned, Append-First".

CENTER: Silver box (silver/grey color) containing "16 Cleaned Tables" with data quality 
checkmark icons. Label: "Standardized, SCD-Ready". Arrow from Bronze → Silver labeled "ETL".

RIGHT: Gold box (gold/amber color) containing "8 Analytical Tables" with chart icons. 
Label: "Aggregated, Analytics-Ready". Arrow from Silver → Gold labeled "Aggregation".

Below all three: a thin bar labeled "PostgreSQL 16" connecting all boxes.

Clean white background, metallic color accents for each tier, modern minimal style. 16:9.
```

---

## Slide 10: Bronze Layer ERD

**Title:** Bronze Schema — 16 Tables, Full Relational Structure

**Talking Points:**
- 16 source-aligned tables with explicit FK constraints
- Domain groups: Geography, Product/Inventory, Person/Contact, Customer, Employment, Orders
- Composite PKs on junction tables (person_location)
- Self-referencing FK (employment.manager_employee_id)
- Every table carries lineage columns (_source_system, _load_timestamp, _batch_id)

**Image:** Bronze Layer Entity Relationship Diagram (16 tables)

**Figure Prompt:**
```
Create a clean ERD for PostgreSQL bronze schema with exactly 16 tables:
bronze.country, bronze.location, bronze.warehouse, bronze.product, bronze.inventory,
bronze.person, bronze.restricted_info, bronze.person_location, bronze.phone_number,
bronze.customer_company, bronze.customer_employee, bronze.customer,
bronze.employment_jobs, bronze.employment, bronze.orders, bronze.order_item.

Show PK/FK columns in each table box. Use crow's-foot notation. Group into zones:
- Geography (country/location/warehouse) top-left
- Product/Inventory top-right  
- Person/Contact center-left
- Customer center-right
- Employment bottom-left
- Orders bottom-right

White background, neutral grey + subtle bronze accent, minimal, academic quality. 16:9.
```

---

## Slide 11: Data Pipeline & Feature Engineering

**Title:** From pg_stat_statements to 15-Feature Vectors

**Talking Points:**
- `query_log_collector.py` snapshots `pg_stat_statements` every 60 seconds
- Dataset: **1,500,000** normalized query records (90-day window)
- 15 features extracted per query:
  - **Lexical (6):** has_select, has_join, has_where, has_group_by, has_order_by, has_aggregation
  - **Structural (3):** table_count, join_count, predicate_count
  - **Magnitude (4):** query_length, word_count, log_exec_time, log_calls, log_rows
  - **Runtime (1):** buffer_hit_pct
- StandardScaler normalization, stratified 80/20 split
- Train: 1,200,000 | Test: 300,000

**Image:** Feature engineering pipeline diagram

**Figure Prompt:**
```
Create a horizontal pipeline diagram with 5 stages:

1) "pg_stat_statements" (database cylinder icon) 
2) "query_log_collector" (gear/cog icon) with arrow labeled "every 60s"
3) "extract_features()" (function box) expanding into 4 feature category groups:
   - Lexical (6 features) in cyan
   - Structural (3 features) in amber
   - Magnitude (4 features) in magenta
   - Runtime (1 feature) in lime
4) "StandardScaler" (normalize icon)
5) "80/20 Split" box showing "1.2M Train | 300K Test"

Horizontal flow left→right with thin arrows. Clean white background, color-coded 
feature groups, modern flat style. 16:9.
```

---

## Slide 12: Class Distribution

**Title:** Per-Cluster Workload Profile (N = 1,500,000)

**Content Table:**

| Cluster | Profile | Count | % | Avg Latency |
|---------|---------|------:|--:|------------:|
| 0 | Benign (read-mostly) | 1,177,500 | 78.5% | 18 ms |
| 1 | Index Candidate | 153,000 | 10.2% | 142 ms |
| 2 | Aggregation-Heavy | 102,000 | 6.8% | 387 ms |
| 3 | Partition Candidate | 52,500 | 3.5% | 612 ms |
| 4 | Anomalous | 15,000 | 1.0% | 2,184 ms |

**Talking Points:**
- Extreme class imbalance reflects real warehouse conditions
- Benign queries dominate (78.5%) — this drives the imbalanced-training decision
- Anomalous class is only 1% but has 120× higher latency than benign

**Image:** Stacked bar or pie chart of class distribution

**Figure Prompt:**
```
Create a horizontal stacked bar chart showing class distribution of 1.5M queries.
Single horizontal bar divided into 5 segments with labels and percentages:
- Benign: 78.5% (cyan/light blue, largest)
- Index Candidate: 10.2% (amber)
- Aggregation-Heavy: 6.8% (magenta)
- Partition Candidate: 3.5% (green)
- Anomalous: 1.0% (red, smallest)

Below the bar: a secondary axis showing average latency per cluster (18, 142, 387, 
612, 2184 ms). Clean white background, clear labels, professional. 16:9.
```

---

## Slide 13: ML Model Architecture — Overview

**Title:** Four-Model Hybrid Ensemble

**Content:**

| Model | Algorithm | Task | Why This Algorithm |
|-------|-----------|------|-------------------|
| QueryTimePredictor | XGBoost | Regression | Best R² + fastest inference on tabular data |
| WorkloadClusterer | K-Means | Clustering | Interpretable cohorts, maps to 5 categories |
| AnomalyDetector | Isolation Forest | Anomaly | No labels needed, scales linearly |
| CachePredictor | Random Forest | Classification | Robust binary decision, well-calibrated |

**Key Design Principle:** Supervised + Unsupervised complement each other. Isolation Forest catches novel patterns the supervised models miss (~18% of disagreement cases).

**Image:** Model ensemble pipeline diagram

**Figure Prompt:**
```
Create a diagram showing 4 ML models operating in parallel on shared input.

TOP: Single input box "15-Feature Vector (from extract_features)" with an arrow splitting 
into 4 parallel paths.

MIDDLE (4 parallel boxes):
- "XGBoost" (blue) → output: "Predicted Latency (ms)"
- "K-Means" (cyan) → output: "Cluster ID (0-4)"
- "Isolation Forest" (amber) → output: "Anomaly Score"
- "Random Forest" (green) → output: "Cache Probability"

BOTTOM: All 4 outputs converge into "Score Fusion" box → final output: 
"Severity Level + Recommendation Category"

Clean white background, color-coded model boxes, thin arrows, professional. 16:9.
```

---

## Slide 14: XGBoost — Results

**Title:** Query Time Prediction Performance

**Content:**

| Algorithm | MAE (ms) | RMSE (ms) | R² | Inference |
|-----------|------:|-------:|-----:|----------:|
| **XGBoost** (default) | **42** | **88** | **0.918** | 2.1–4.8 ms |
| Random Forest | 71 | 138 | 0.852 | 4.2–5.5 ms |
| Gradient Boosting | 58 | 112 | 0.881 | 6.4–9.1 ms |

**Talking Points:**
- XGBoost beats RF by +6.6 pp R², GB by +3.7 pp
- Also has the lowest inference latency (dual advantage)
- MAPE = 15.8%, within [14%, 19%] band from Sun et al.
- Hyperparameters: n_estimators=100, max_depth=6, lr=0.1

**Image:** Figure 5.1 — MAE comparison horizontal bar chart

**Figure Prompt:**
```
Create a horizontal bar chart comparing 3 algorithms on Mean Absolute Error (MAE).
Y-axis: algorithm names (XGBoost, Gradient Boosting, Random Forest).
X-axis: MAE in ms (0 to 80).

Bars:
- XGBoost: 42 ms (cyan, shortest bar) with bold "42 ms" label
- Gradient Boosting: 58 ms (magenta)  with "58 ms" label
- Random Forest: 71 ms (amber, longest bar) with "71 ms" label

Clean white background, clear axis labels, professional chart style. 
Title: "MAE Comparison on 300K Test Partition". 16:9.
```

---

## Slide 15: Predicted vs. Actual Latency

**Title:** XGBoost Prediction Quality (300K Test Queries)

**Talking Points:**
- Log-scaled scatter: predicted vs actual `mean_exec_time_ms`
- ~90% of 300,000 test points within ±20% error band
- Residual distribution centered near 0 (σ ≈ 38 ms)
- Outliers above diagonal = under-predictions in long-tail (>1s) region
- Outlier root cause: lock-wait time (not in current feature space)

**Image:** Figure 5.2 — Predicted vs Actual scatter plot

**Figure Prompt:**
```
Create a log-log scatter plot. X-axis: "Predicted mean_exec_time_ms" (1 ms to 10,000 ms, 
log scale). Y-axis: "Actual mean_exec_time_ms" (same range, log scale).

Plot ~300,000 semi-transparent cyan dots clustered tightly around a grey dashed y=x 
diagonal line. Add light red shading for the ±20% error band around the diagonal.

Inset in upper-left corner: small histogram of residuals centered at 0 ms with 
σ ≈ 38 ms annotation.

Clean white background, clear axis labels, professional academic chart. 
Title: "Predicted vs. Actual Query Latency (XGBoost, R² = 0.918)". 16:9.
```

---

## Slide 16: Feature Importance

**Title:** What Drives Query Latency Predictions?

**Talking Points:**
- Top feature: `log_exec_time` (0.412 gain) — historical runtime autocorrelation
- #2: `log_calls` (0.139) — temporal recency (higher than DBA intuition expects)
- #3: `buffer_hit_pct` (0.087) — cache behavior
- #4: `log_rows` (0.061) — data volume
- #5: `predicate_count` (0.044) — query complexity
- Lexical flags (has_join, has_where, etc.) at bottom — structural > lexical
- **Insight:** Model elevates temporal-recency features above human DBA priority

**Image:** Figure 5.3 — Top-15 feature importance horizontal bar chart

**Figure Prompt:**
```
Create a horizontal bar chart of top-15 XGBoost feature importances (gain-based).

Features (top to bottom, longest bar first):
1. log_exec_time: 0.412 (magenta - magnitude)
2. log_calls: 0.139 (lime - runtime)
3. buffer_hit_pct: 0.087 (lime - runtime)
4. log_rows: 0.061 (magenta - magnitude)
5. predicate_count: 0.044 (amber - structural)
6. query_length: 0.038 (magenta - magnitude)
7. word_count: 0.035 (magenta - magnitude)
8. table_count: 0.032 (amber - structural)
9. join_count: 0.028 (amber - structural)
10. has_aggregation: 0.024 (cyan - lexical)
11. has_join: 0.022 (cyan - lexical)
12. has_order_by: 0.020 (cyan - lexical)
13. has_group_by: 0.018 (cyan - lexical)
14. has_where: 0.015 (cyan - lexical)
15. has_select: 0.012 (cyan - lexical)

Color-code bars by category: magenta=magnitude, lime=runtime, amber=structural, 
cyan=lexical. Add a small legend. White background, professional. 16:9.
```

---

## Slide 17: Anomaly Detection

**Title:** Isolation Forest — Catching Unknown Threats

**Talking Points:**
- Unsupervised: no labels required
- Production threshold: contamination = 0.10
- **Precision: 0.912**, Recall: 0.847, F1: 0.878
- Bootstrap 95% CIs: precision [0.881, 0.939], recall [0.812, 0.881]
- Bimodal score distribution confirms theory (normal cluster near 0, anomalies below -0.10)
- Validated on manually-labeled audit set of 200 pathological queries

| Contamination | Precision | Recall | F1 |
|--------------:|----------:|-------:|---:|
| 0.05 | 0.943 | 0.793 | 0.861 |
| **0.10** | **0.912** | **0.847** | **0.878** |
| 0.15 | 0.881 | 0.882 | 0.881 |
| 0.20 | 0.842 | 0.901 | 0.870 |

**Image:** Figure 5.4 — Anomaly score histogram with threshold

**Figure Prompt:**
```
Create a histogram of Isolation Forest anomaly scores.

X-axis: Anomaly Score (from -0.30 to +0.15).
Y-axis: Count (frequency).

Main distribution: tall cyan bars clustered in [-0.05, +0.05] range (normal queries).
Left tail: shorter amber bars below -0.10 (flagged anomalies).

Vertical lines:
- Red dashed line at x = -0.10 labeled "Production Threshold"
- Green dashed line at x = -0.15 labeled "Strict Threshold"

Small black tick marks along x-axis below -0.10 representing audited true-positive 
anomalies.

White background, clear labels, professional. Title: "Isolation Forest Score Distribution 
(300K Test Partition)". 16:9.
```

---

## Slide 18: Workload Clustering

**Title:** K-Means — Five Operational Cohorts

**Talking Points:**
- Silhouette score: 0.572 (95% CI [0.527, 0.617])
- Davies-Bouldin index: 0.81
- Clear diagonal structure in PCA space (complexity ↔ latency)
- Benign cluster largest and well-separated from Anomaly cluster
- Unsupervised clustering recovers same structure as supervised classifier

**Image:** Figure 5.5 — 2D PCA projection of 5 cluster centroids

**Figure Prompt:**
```
Create a 2D scatter plot showing K-Means cluster centroids projected via PCA.

X-axis: "PC1 (dominated by log_exec_time, log_rows)"
Y-axis: "PC2 (dominated by predicate_count, join_count)"

5 filled circles (sized proportionally to cluster population):
- Cluster 0 "Benign" (cyan, largest): lower-left position
- Cluster 1 "Index Candidate" (amber, medium): center-left
- Cluster 2 "Aggregation-Heavy" (magenta, medium-small): center
- Cluster 3 "Partition Candidate" (green, small): center-right
- Cluster 4 "Anomalous" (red, smallest): upper-right, isolated

Draw a faint diagonal arrow from lower-left to upper-right labeled 
"Increasing Latency & Complexity →"

Each circle labeled with cluster name. White background, clean, professional. 16:9.
```

---

## Slide 19: Cache Predictor

**Title:** Random Forest Cache Classification

**Talking Points:**
- Test accuracy: **94.3%**, AUC: **0.962**
- Precision: 0.918, Recall: 0.871
- Production threshold: `cache_threshold = 0.7`
- Well-calibrated: predicted probabilities match empirical fractions
- Bootstrap CIs: accuracy [0.929, 0.957], AUC [0.951, 0.972]
- Used in `WorkloadCacheMlPanels.tsx` for cache opportunity scoring

**Image:** Figure 5.6 — Calibration curve

**Figure Prompt:**
```
Create a calibration plot (reliability diagram).

X-axis: "Predicted Probability" (0.0 to 1.0, 10 bins).
Y-axis: "Empirical Fraction of Cache-Beneficial Queries" (0.0 to 1.0).

Plot:
- Grey dashed diagonal line (y = x, perfect calibration reference)
- Cyan line with circle markers showing the actual calibration curve, tracking 
  close to diagonal with slight under-confidence in 0.4–0.7 region
- Vertical red dashed line at x = 0.7 labeled "Production Threshold"

White background, clear axis labels, professional chart. 
Title: "Random Forest Cache Predictor Calibration (AUC = 0.962)". 16:9.
```

---

## Slide 20: Imbalanced vs. Balanced Training

**Title:** Why We Keep Natural Class Distribution

**Content — Aggregate Table:**

| Metric | Imbalanced | Balanced | Δ |
|--------|-----------|----------|---|
| Cluster Accuracy | 98.71% | 97.18% | −1.53 pp |
| XGBoost R² × 100 | 91.80% | 89.20% | −2.60 pp |
| Anomaly Precision | 91.20% | 87.90% | −3.30 pp |

**Content — Per-Cluster F1:**

| Cluster | Imbalanced F1 | Balanced F1 | Δ |
|---------|------------:|----------:|---|
| Benign | 0.991 | 0.953 | −3.8 pp |
| Index Candidate | 0.948 | 0.919 | −2.9 pp |
| Aggregation-Heavy | 0.892 | 0.911 | +1.9 pp |
| Partition Candidate | 0.847 | 0.881 | +3.4 pp |
| Anomalous | 0.812 | 0.873 | +6.1 pp |

**Key Insight:** Balanced helps minority, but −1.53 pp on 300K holdout = **~4,590 extra misclassifications**. Since Benign dominates real traffic (78.5%), imbalanced training wins.

**Image:** Slope chart or paired comparison

**Figure Prompt:**
```
Create a slope chart (slopegraph) comparing Imbalanced vs Balanced training.

Left axis: "Imbalanced Training" with 5 dots (one per cluster F1 score).
Right axis: "Balanced Training" with 5 corresponding dots.
Connect each pair with a line:
- Benign: 0.991 → 0.953 (red line, declining)
- Index Candidate: 0.948 → 0.919 (red line, declining)
- Aggregation-Heavy: 0.892 → 0.911 (green line, rising)
- Partition Candidate: 0.847 → 0.881 (green line, rising)
- Anomalous: 0.812 → 0.873 (green line, rising)

Label each dot with cluster name and F1 value. Add annotation box:
"Overall accuracy: 98.71% → 97.18% (−1.53 pp = ~4,590 extra errors on 300K holdout)"

White background, clean minimal style. 16:9.
```

---

## Slide 21: Real-Time Inference Architecture

**Title:** Sub-25 ms End-to-End Recommendation Pipeline

**Talking Points:**
- Request pipeline: Validate → Preprocess → Multi-Model Inference → Score Fusion → Broadcast
- Per-model latency:
  - XGBoost: 2.1 ms (median)
  - K-Means: 0.4 ms
  - Isolation Forest: 1.6 ms
  - Random Forest: 4.8 ms
- End-to-end batch (200 queries): < 25 ms
- Throughput: ~475 predictions/sec on single CPU core
- WebSocket pushes to dashboard within ~2 seconds of detection
- HTTP polling fallback (2,000 ms) for restricted networks

**Image:** Inference latency breakdown

**Figure Prompt:**
```
Create a stacked horizontal bar showing end-to-end inference pipeline timing.

Single horizontal bar (total ~25 ms) divided into labeled segments:
- "Validation" (2 ms, grey)
- "Feature Extraction" (3 ms, cyan)
- "XGBoost" (4 ms, blue)
- "K-Means" (1 ms, cyan)
- "Isolation Forest" (2 ms, amber)
- "Random Forest" (5 ms, green)
- "Score Fusion" (2 ms, magenta)
- "Broadcast" (3 ms, grey)

Total labeled "< 25 ms end-to-end". Below: throughput annotation "~475 pred/sec".

White background, clean, color-coded segments, professional. 16:9.
```

---

## Slide 22: API Design

**Title:** FastAPI Backend — 51 Endpoints, 9 Routers

**Talking Points:**
- FastAPI 0.111 + Uvicorn on Python 3.11
- 9 versioned routers under `/api/v1/`:
  - optimization, metrics, recommendations, warehouse, monitoring, storage, alerts, system-logs, websocket
- WebSocket: `/api/v1/ws/optimization-stream` (2s update cadence)
- Auth: `@require_api_key(level)` — read/write/admin roles
- Severity classification: Critical (≥0.85), High (0.65–0.85), Medium (0.40–0.65), Low (0.15–0.40), None (<0.15)
- Priority-based model loading with graceful degradation
- Slow-request middleware logging (configurable threshold)

**Server-Side WebSocket Code:**
```python
@router.websocket("/ws/optimization-stream")
async def websocket_optimization_stream(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            snapshot = await _build_optimization_snapshot(...)
            await websocket.send_json(snapshot)
            await asyncio.sleep(2)
    except WebSocketDisconnect:
        pass
```

**Image:** API router diagram or Swagger UI screenshot

**Figure Prompt:**
```
Create an API architecture diagram. Central "FastAPI" box with 9 router boxes arranged 
in a grid around it, each labeled: optimization, metrics, recommendations, warehouse, 
monitoring, storage, alerts, system-logs, websocket. Each box shows endpoint count.
A WebSocket icon on the websocket router. Auth middleware shield icon on top.
Clean blue/white style, professional. 16:9.
```

---

## Slide 23: Frontend Dashboard

**Title:** React 18 Operator Dashboard

**Talking Points:**
- 7 lazy-loaded routes: Dashboard, Monitoring, Data Explorer, Optimizations, Analytics, Alerts, Settings
- 44 reusable components across 5 domains
- Real-time updates via `useOptimizationRealtimeWebSocket` hook
- HTTP polling fallback (2,000 ms) when WebSocket fails
- Tailwind CSS + Framer Motion animations
- Key components:
  - `MedallionTiers.tsx` — Bronze/Silver/Gold overview
  - `IndexRecommendations.tsx` — DDL template cards with "Implement" action
  - `PartitionRecommendations.tsx` — Partition strategy suggestions
  - `ModelFitMetrics.tsx` — R², MAE, feature importance
  - `LineageVisualization.tsx` — DAG-style data lineage
  - `WorkloadCacheMlPanels.tsx` — Cache opportunity scores
  - `OptimizationROI.tsx` — Before/after impact analysis

**Image:** Dashboard screenshot(s)

**Figure Prompt:**
```
Create a modern, dark-themed dashboard mockup showing a data warehouse monitoring UI.

Layout:
- Left sidebar with nav icons (Dashboard, Monitoring, Analytics, Optimizations, Alerts, Settings)
- Top header bar with "AI-Powered Data Warehouse" title and status indicators
- Main content area with:
  - Top row: 4 stat cards (Total Queries, Avg Latency, Anomalies Detected, Recommendations)
  - Middle: Line chart showing query performance over time
  - Bottom-left: Recommendation cards with severity badges (Critical/High/Medium)
  - Bottom-right: Feature importance horizontal bars

Use dark navy background, cyan/amber accent colors, rounded corners, modern flat design.
Professional, clean, realistic UI mockup. 16:9.
```

---

## Slide 24: Live Demo / Screenshots

**Title:** System in Action

**Content (3-panel layout):**
- **Panel 1:** Dashboard home — Medallion tier overview with row counts
- **Panel 2:** Optimization recommendations — DDL templates with implement buttons
- **Panel 3:** Real-time alerts — WebSocket-driven anomaly stream

**Image:** 2–3 actual screenshots from running dashboard (capture from `npm run dev`)

**Figure Prompt (if generating mockup instead):**
```
Create a 3-panel presentation layout showing dashboard screenshots:

Panel 1 (left): "Medallion Overview" showing Bronze/Silver/Gold tiers as colored bars 
with table counts (16/16/8) and row counts.

Panel 2 (center): "Recommendations" showing 3 recommendation cards stacked vertically,
each with a severity badge (Critical in red, High in amber, Medium in blue), 
a SQL DDL snippet, and an "Apply" button.

Panel 3 (right): "Live Alerts" showing a real-time feed of alert entries with 
timestamps, anomaly scores, and query snippets.

Light grey background connecting the panels, modern rounded style. 16:9.
```

---

## Slide 25: Testing & Validation

**Title:** Comprehensive Test Coverage

**Talking Points:**
- **30 pytest tests** across 6 test files:
  - `test_api_endpoints.py` (12 tests)
  - `test_etl_pipeline.py` (4 tests)
  - `test_optimization_flow.py` (4 tests)
  - `test_full_workflow.py` (e2e)
  - `test_query_benchmarks.py` (performance)
  - `test_evaluation_framework.py` (3 tests, model metrics)
- Overall code coverage: **87.4%** (critical paths: **94.2%**)
- Traffic generators for realistic workload simulation
- OpenAPI contract verification at `/docs`
- Bootstrap 95% CIs on all key metrics
- Direct SQL probes in `docs/analytics_validation.sql`

**Image:** Test summary / coverage visualization

**Figure Prompt:**
```
Create a test coverage infographic. Center: large circular progress indicator showing 
"87.4%" overall coverage. Around it: 4 smaller badges showing test categories:
- "Integration: 20 tests" (blue badge)
- "E2E: 4 tests" (green badge)
- "Performance: 3 tests" (amber badge)
- "Evaluation: 3 tests" (magenta badge)

Below: horizontal bar showing "Critical Path Coverage: 94.2%" (nearly full green bar).

Clean white background, professional infographic style. 16:9.
```

---

## Slide 26: Key Findings

**Title:** Five Findings That Matter

**Content:**
1. **Conventional ML is sufficient** — No deep learning needed; XGBoost + tree ensembles solve the problem at production quality
2. **XGBoost wins on both accuracy AND speed** — R² 0.918 at 2.1 ms; eliminates accuracy-latency trade-off
3. **Temporal recency features matter more than expected** — `log_calls` ranks #2, higher than DBA intuition
4. **10% stratified sampling preserves accuracy** — Within 0.3 pp R² of full-corpus training
5. **Imbalanced training outperforms balanced** — Natural distribution reflects real workload; balancing hurts majority class

**Image:** Key findings summary visual

**Figure Prompt:**
```
Create a "5 Key Findings" infographic with 5 horizontal rows, each containing:
- A number (1-5) in a circle
- A short bold title
- A key metric or insight in smaller text

Row 1: "Conventional ML Sufficient" — "No deep learning needed"
Row 2: "XGBoost Dual Advantage" — "R² 0.918 + 2.1 ms inference"
Row 3: "Temporal Features Dominate" — "log_calls ranks #2 (unexpected)"
Row 4: "10% Sampling Works" — "Within 0.3 pp of full training"
Row 5: "Keep Imbalanced Data" — "−1.53 pp = 4,590 extra errors if balanced"

Use alternating light blue/white row backgrounds. Professional, clean. 16:9.
```

---

## Slide 27: Deployment Strategy

**Title:** From Lab to Production — Phased Rollout

**Talking Points:**
- All evaluation on synthetic e-commerce warehouse (not live production)
- WebSocket challenge: silent disconnects behind corporate proxies → dual-transport solution
- Recommended phased deployment:
  - **Phase 1 (2 weeks):** Shadow mode — observe only, emit recommendations, no DDL authority
  - **Phase 2 (1 month):** Low-risk DDL — only CREATE INDEX with human approval
  - **Phase 3:** Full production — all recommendation types, audit trail via `optimization_history`
- Monitor for distribution drift (KS-test on 15-feature space)
- Site-specific fine-tuning: 2 weeks of local `pg_stat_statements` → re-fit with reduced LR

**Image:** Phased deployment timeline

**Figure Prompt:**
```
Create a horizontal timeline diagram with 3 phases:

Phase 1 (leftmost, blue): "Shadow Mode" — 2 weeks duration. Icon: eye/observe.
Label: "Recommendations only, no DDL changes"

Phase 2 (center, amber): "Low-Risk DDL" — 1 month duration. Icon: shield/approval.
Label: "CREATE INDEX with human approval"

Phase 3 (rightmost, green): "Full Production" — ongoing. Icon: rocket/deploy.
Label: "All recommendations, audit trail active"

Connect phases with arrows. Below timeline: "Monitor drift (KS-test) → Re-train if needed"

White background, clean timeline style, professional. 16:9.
```

---

## Slide 28: Limitations

**Title:** Acknowledged Limitations

**Content:**
1. **Single-Domain Training** — Synthetic e-commerce only; not validated on HR, finance, geospatial
2. **Encrypted Traffic** — ~94% of DB traffic is TLS-encrypted; system depends on server-side telemetry
3. **Coarse Taxonomy** — 5 categories only; no Level-3 sub-types (B-tree vs partial vs GIN)
4. **Single-Node Scalability** — Caps at ~475 pred/sec; enterprise needs distributed architecture
5. **No Live Production Testing** — Lab-generated workloads only; missing diurnal patterns, traffic spikes, multi-tenant effects

**Image:** Limitations gap analysis

**Figure Prompt:**
```
Create a limitations diagram with 5 items arranged as horizontal cards with red/amber 
warning indicators. Each card shows:
- Icon (globe for domain, lock for encryption, layers for taxonomy, server for scaling, 
  lab flask for testing)
- Short title
- Brief description (one line)

Cards stacked vertically with slight separation. Use subtle red accent borders.
Clean white background, professional. 16:9.
```

---

## Slide 29: Future Work

**Title:** Research Directions

**Content:**
1. **Deep Learning Integration** — Transformer encoder on 60-min sliding windows for temporal patterns
2. **Distributed Deployment** — Kubernetes Helm chart, S3 model artifacts, Patroni HA PostgreSQL
3. **Continuous Learning** — `partial_fit` + KS-test drift detection + active learning (confidence 0.40–0.60)
4. **Multi-Modal Fusion** — OpenTelemetry integration (app traces + DB metrics in same pipeline)
5. **Hierarchical Taxonomy** — Level 1 (binary) → Level 2 (5-class) → Level 3 (fine-grained sub-types)
6. **Federated Learning** — Cross-site model improvement without sharing raw query text (FedAvg + DP)

**Image:** Future architecture vision diagram

**Figure Prompt:**
```
Create an "expanded future architecture" diagram building on the current 4-layer system.

Show the existing architecture (simplified) in the center, with 5 new extension blocks 
connected around it:
- Top: "Transformer Temporal Encoder" (neural network icon)
- Left: "Kubernetes / Distributed" (container/pods icon)
- Right: "OpenTelemetry Fusion" (traces icon)
- Bottom-left: "Continuous Learning Pipeline" (circular arrow icon)
- Bottom-right: "Federated Cross-Site" (distributed nodes icon)

Use dashed lines connecting extensions to the core system. Extensions have a subtle 
glow/highlight effect. Clean white background, professional. 16:9.
```

---

## Slide 30: Technology Stack

**Title:** Complete Technology Stack

**Content:**

| Layer | Technology | Version |
|-------|-----------|---------|
| Frontend | React, TypeScript, Vite, Tailwind, Framer Motion | 18.3, 5.5, 5.4 |
| Backend | FastAPI, Uvicorn, Python | 0.111, -, 3.11 |
| ML | XGBoost, scikit-learn (KMeans, IsolationForest, RF) | 2.0, 1.5 |
| Database | PostgreSQL, pg_stat_statements | 16 |
| Training | Google Colab (12.7 GB RAM, CPU-only) | Free tier |
| Testing | pytest, pytest-cov, React Testing Library | - |
| Real-time | WebSocket (native), HTTP polling fallback | - |
| DevOps | Git, GitHub, Docker, venv | - |

**Image:** Tech stack logo grid

**Figure Prompt:**
```
Create a technology stack grid diagram. 6 rows of technology logos/icons arranged neatly:

Row 1 (Frontend): React logo, TypeScript logo, Vite logo, Tailwind logo
Row 2 (Backend): FastAPI logo, Python logo, Uvicorn text
Row 3 (ML): XGBoost logo, scikit-learn logo
Row 4 (Database): PostgreSQL elephant logo, "pg_stat_statements" text badge
Row 5 (Training): Google Colab logo
Row 6 (DevOps): Git logo, GitHub logo, Docker logo

Arrange in a clean grid with labels on left. White background, colored logos on 
white cards. Professional, balanced. 16:9.
```

---

## Slide 31: Conclusion

**Title:** Summary & Impact

**Talking Points:**
- Hybrid four-model ensemble solves multi-task warehouse optimization
- Production-grade accuracy:
  - R² = 0.918 (regression)
  - Precision = 0.912 (anomaly)
  - Accuracy = 94.3% (cache)
  - Silhouette = 0.572 (clustering)
- Production-grade latency: 0.4–5.5 ms per model, < 25 ms end-to-end
- Fully interpretable via feature importance + per-recommendation reasoning
- Complete system: 51 endpoints, 7 routes, 22 schemas, 30 tests, 44 components
- Bridges the gap between academic ML research and operational deployment
- Conventional ML is sufficient — no deep learning needed for this problem class

**Image:** Final summary infographic or architecture + metrics combined

**Figure Prompt:**
```
Create a conclusion summary infographic with 3 columns:

Column 1 "Accuracy": 
- R² = 0.918
- Precision = 0.912
- Accuracy = 94.3%
- Silhouette = 0.572
(shown as bold numbers with metric labels)

Column 2 "Speed":
- Per-model: 0.4–5.5 ms
- End-to-end: < 25 ms
- Throughput: 475 pred/sec
- Dashboard: ~2s updates
(shown as bold numbers)

Column 3 "Scale":
- 51 API endpoints
- 7 dashboard routes
- 1.5M training rows
- 44 UI components
(shown as bold numbers)

Header: "Production-Grade Self-Optimizing Warehouse"
Footer: "No deep learning required. Fully interpretable. Reproducible."

Clean blue/white professional design. 16:9.
```

---

## Slide 32: Q&A

**Title:** Thank You — Questions?

**Content:**
- Project: AI-Powered Self-Optimizing Data Warehouse
- Author: Sumit Singh
- Supervisor: Dr. Duy H. Ho
- University: California State University, Fullerton
- Semester: Spring 2026
- Repository: [GitHub Link]

**Image:** Clean closing slide with project title

**Figure Prompt:**
```
Create a minimal closing slide with centered text layout. Light blue gradient background 
fading to white. Center: "Thank You" in large elegant font. Below: "Questions?" in 
smaller text. Bottom: subtle silhouette of the 4-layer architecture diagram (very 
faded/transparent). Professional, elegant, academic. 16:9.
```

---

## Appendix A: Image Generation Reference

| Slide | Figure/Image | Source |
|-------|-------------|--------|
| 1 | Title background | Generate (prompt above) |
| 3 | Problem infographic | Generate |
| 4 | Healthcare.gov timeline | Generate |
| 5 | 4-quadrant challenges | Generate |
| 6 | Objective mapping | Generate |
| 7 | Contribution cards | Generate |
| 8 | System Architecture Diagram | Generate (detailed prompt above) |
| 9 | Medallion flow | Generate |
| 10 | Bronze ERD | Generate (use corrected ERD prompt from earlier) |
| 11 | Feature pipeline | Generate |
| 12 | Class distribution bar | Generate |
| 13 | Model ensemble pipeline | Generate |
| 14 | MAE comparison (Fig 5.1) | Generate or plot from data |
| 15 | Pred vs Actual (Fig 5.2) | Generate or plot from data |
| 16 | Feature importance (Fig 5.3) | Generate or plot from data |
| 17 | Anomaly histogram (Fig 5.4) | Generate or plot from data |
| 18 | PCA clusters (Fig 5.5) | Generate or plot from data |
| 19 | Calibration curve (Fig 5.6) | Generate or plot from data |
| 20 | Imbalanced vs balanced slope | Generate |
| 21 | Inference latency breakdown | Generate |
| 22 | API router diagram | Generate |
| 23 | Dashboard mockup | Generate or screenshot |
| 24 | Live demo panels | Screenshot from running app |
| 25 | Test coverage infographic | Generate |
| 26 | Key findings visual | Generate |
| 27 | Deployment timeline | Generate |
| 28 | Limitations cards | Generate |
| 29 | Future vision diagram | Generate |
| 30 | Tech stack grid | Generate |
| 31 | Conclusion summary | Generate |
| 32 | Closing slide | Generate |

## Appendix B: Presentation Metadata

- **Total slides:** 32
- **Estimated duration:** 25–30 minutes + Q&A
- **Target audience:** Graduate committee, faculty, peers
- **Recommended tool:** PowerPoint, Google Slides, or Keynote
- **Aspect ratio:** 16:9
- **Font:** Clean sans-serif (Inter, Helvetica Neue, or Segoe UI)
- **Color palette:** Primary blue (#2563EB), Cyan (#06B6D4), Amber (#F59E0B), Magenta (#EC4899), Neutral grey (#6B7280)
