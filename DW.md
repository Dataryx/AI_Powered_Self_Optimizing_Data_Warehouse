# DW.md — Dashboard & UI Deep Dive (Professor Q&A Guide)

This document describes **every primary screen** from **Dashboard** through **Settings**: what it shows, **how** it is wired to the backend, **when** data refreshes, **why** it exists, and **what a professor might ask**—including how this connects to **ML models and algorithms** in `ml-optimization`.

**Stack (frontend):** React 18 + Vite + TypeScript, React Router, Tailwind-style utility classes, Framer Motion for motion, Lucide icons.

**Stack (backend consumed by UI):** FastAPI “ML Optimization API” (`start_services.py`), base URL `VITE_API_BASE_URL` (default `http://localhost:8000/api/v1`).  
**Persistence:** PostgreSQL (warehouse + `ml_optimization` schema for logs, recommendations, alerts).

---

## 1. Global application shell (all pages)

### 1.1 Routing & code splitting (`App.tsx`)

| Aspect | Detail |
|--------|--------|
| **What** | `BrowserRouter` + `Routes`: `/`, `/monitoring`, `/data-explorer`, `/optimizations`, `/analytics`, `/alerts`, `/settings`. `/storage` redirects to `/`. |
| **How** | Each page is `lazy(() => import(...))` inside `Suspense` so only the chunk for the visited route loads. |
| **Why** | Faster first paint; final-year projects still need to show awareness of **performance budgets**. |
| **Professor may ask** | *Why lazy routes?* → Smaller initial JS bundle; routes load on demand. |

### 1.2 Activity logging (`useSystemActivityLogger`)

| Aspect | Detail |
|--------|--------|
| **What** | On mount: logs `page_load`. On every route change: `route_change`. Optional click logging with safe CSS selector hints. |
| **How** | Calls `api.logSystemEvent(...)` (REST). |
| **Why** | Audit trail / demo narrative: “we observe user and system interaction,” aligned with **observability**. |
| **Professor may ask** | *Is this analytics or security?* → Primarily **observability**; extend with auth if production-hardening. |

### 1.3 Sidebar & layout (`Sidebar.tsx`, `SidebarPageShell.tsx`, `SidebarLayout.tsx`)

| Aspect | Detail |
|--------|--------|
| **What** | Grouped nav: **Overview** (Dashboard), **Data & Ops** (Monitoring, Data Explorer), **Insights** (Optimizations, Analytics, Alerts), **System** (Settings). Collapsible / mobile drawer via `sidebarStore`. |
| **How** | `useLocation` highlights active route; `useNavigate` for transitions. |
| **Why** | Mirrors how operators think: **run → explore → optimize → explain → alert → configure**. |

### 1.4 API client (`services/api.ts`)

| Aspect | Detail |
|--------|--------|
| **What** | Typed fetch wrapper, `ApiError`, helpers for optimization **apply** errors (403/409/422). |
| **How** | `VITE_API_BASE_URL`; WebSocket origin from same host or `VITE_WS_BASE_URL`. |
| **Why** | Single place for **base URL**, error shaping, and WS URL construction for live optimization stream. |

---

## 2. Dashboard page (`/` — `DashboardPage.tsx`)

### 2.1 Purpose

**Executive / operator view:** warehouse scale (medallion), sales KPIs, trends, top products, API health.

### 2.2 Components

| Component | Role |
|-----------|------|
| `TopBar` | Status, connection errors, quick context. |
| `HeroSection` | Landing hero / branding. |
| `KeyMetrics` | High-level KPIs from bundle. |
| `MedallionTiers` | Bronze / Silver / Gold counts or sizes from `warehouse_summary`. |
| `SalesTrend` | Time series of sales / revenue. |
| `TopProducts` | Ranked products by revenue or volume. |
| `Footer` | Health snippet (`getHealth` / bundle health): uptime, latency hint. |

### 2.3 Data hook: `useDashboardData`

| Question | Answer |
|----------|--------|
| **How?** | Prefers **single** `api.getHomeDashboard()` bundle; falls back to parallel `getWarehouseSummary`, `getSalesStats`, `getCustomerStats`, `getActiveAlerts`, `getHealth` if needed. |
| **When?** | Initial load + polling interval from **`useMonitoringPreferences`** (`useDashboardRefreshIntervalMs`). |
| **Why bundle?** | Fewer round-trips, consistent snapshot for demos. |
| **Failure behavior** | Sets `error`, still allows partial UI; user can **Retry**. |

### 2.4 Professor Q&A (Dashboard)

- **Q: Where does “medallion” data come from?**  
  **A:** Backend aggregates PostgreSQL catalog / stats per schema tier and returns `warehouse_summary`.

- **Q: Is this real-time?**  
  **A:** **Polling**-based unless you add push; health and metrics refresh on an interval.

- **Q: How does this relate to ML?**  
  **A:** Indirectly—Dashboard establishes **business context**; ML optimization uses **query logs** and stats (Optimizations / Analytics pages).

---

## 3. Monitoring page (`/monitoring` — `MonitoringPage.tsx`)

### 3.1 Purpose

**Pipeline operations:** ETL health, lineage, recent runs, manual jobs, freshness SLAs, data quality.

### 3.2 Components

| Component | Role |
|-----------|------|
| `MonitoringHeader` | Page chrome / refresh context. |
| `ETLStats` | Aggregate ETL metrics. |
| `LineageVisualization` | DAG-style or flow view of bronze → silver → gold dependencies. |
| `RecentETLRuns` | History of runs, status, durations. |
| `ManualETLJobRunner` | Trigger jobs from UI; `onAfterDispatch` → `refetch`. |
| `DataFreshness` | Staleness vs expected schedule / SLA. |
| `DataQuality` | Rule-based or metric-based quality scores. |

### 3.3 Data hook: `useMonitoringData`

| Question | Answer |
|----------|--------|
| **How?** | Central hook aggregating monitoring endpoints (exact routes in `api.ts`). |
| **When?** | Poll / refresh; exposes `refreshing` for UX. |
| **Why?** | Separates **pipeline reliability** from **query optimization**—professors often ask for this distinction. |

### 3.4 Deep links

`useEffect` scrolls to `#monitoring-lineage`, `#monitoring-etl`, `#monitoring-freshness`, `#monitoring-data-quality` when `location.hash` is set—useful for **demo scripts** and cross-links from Alerts.

### 3.5 Professor Q&A (Monitoring)

- **Q: How is lineage implemented?**  
  **A:** UI consumes a **structured lineage payload** from the API (tables + edges); rendering is presentational.

- **Q: What triggers “manual ETL”?**  
  **A:** POST-style dispatch via API; backend must enforce **auth** in production.

---

## 4. Data Explorer page (`/data-explorer` — `DataExplorerPage.tsx`)

### 4.1 Purpose

**Semantic discovery:** browse medallion tables, columns, layers; optional API-backed metadata.

### 4.2 Implementation notes

- Ships with a **curated catalog** (`allTables`) listing Bronze / Silver / Gold table names for demos.
- Uses `api` for **live** details (e.g. column lists) when fetching table schema from backend.
- **Why hybrid?** Guarantees the UI works in **offline / partial backend** scenarios while still demonstrating **live catalog** integration.

### 4.3 Professor Q&A (Data Explorer)

- **Q: Is this a SQL IDE?**  
  **A:** **Explorer**, not a full query editor—focus is **governance and orientation** in the medallion model.

- **Q: How does this help ML?**  
  **A:** Validates **real table/column names** that later appear in `query_logs` and recommendation targets.

---

## 5. Optimizations page (`/optimizations` — `OptimizationsPage.tsx`)

### 5.1 Purpose

**Core “self-optimizing” UX:** index and partition recommendations, slow-query context, history, optional **Implement** workflow.

### 5.2 Components

| Component | Role |
|-----------|------|
| `IndexRecommendations` | List/cards for `type === 'index'`. |
| `PartitionRecommendations` | List for `type === 'partition'`. |
| `QueryPerformance` | Slow / expensive queries driving recommendations. |
| `OptimizationHistory` | Past suggestions / outcomes. |

### 5.3 Data hook: `useOptimizationsData`

| Question | Answer |
|----------|--------|
| **How?** | Delegates to `useOptimizationRealtimeWebSocket`: **WebSocket** to `/api/v1/ws/optimization-stream` (via `buildOptimizationStreamWebSocketUrl`), with **HTTP polling fallback** if WS fails. |
| **When?** | Default tick ~2s (`wsIntervalMs` / `fallbackIntervalMs`); manual `refetch` bumps `refreshKey`. |
| **Why WS?** | Near–real-time recommendations without hammering REST; good **system design** story. |

### 5.4 Time range

`timeRange` (7 / 30 / 90 days) maps to `performanceDays`; initial default can align with **`loadMonitoringPreferences().retentionDays`**.

### 5.5 Professor Q&A (Optimizations)

- **Q: Where do recommendations come from?**  
  **A:** Backend merges **live ML scoring** over `query_logs` / `pg_stat_statements`, **rule-based** parsing of SQL for (table, column), **catalog validation**, and optionally **persisted** rows in `ml_optimization.index_recommendations`.

- **Q: What ML algorithms drive the ranking?**  
  **A:** See **Section 10**—regression (XGBoost / ensembles), **Isolation Forest** anomalies, optional **clustering** for workload cohorts.

- **Q: Why hybrid rules + ML?**  
  **A:** ML finds **non-obvious** hotspots; rules enforce **safety** (real columns, allowlisted schemas, no nonsense DDL).

---

## 6. Analytics page (`/analytics` — `AnalyticsPage.tsx`)

### 6.1 Purpose

**Explainability:** tie workload shape, query latency trends, and ML-oriented panels (workload + cache insights) to business-readable stats.

### 6.2 Components

| Component | Role |
|-----------|------|
| `AnalyticsStats` | Summary KPIs / cards. |
| `WorkloadCacheMlPanels` | ML-flavored workload + cache insight copy from dedicated endpoints. |
| `QueryPerformanceImpact` | Before/after or comparative latency narrative. |
| `WorkloadPatterns` | Busy times / patterns; respects `metricsAggregation` preference. |

### 6.3 Data hooks

| Hook | Role |
|------|------|
| `useAnalyticsData` | Main analytics bundle / endpoints. |
| `useWorkloadCacheInsights` | Workload + cache ML panels. |
| `useMetricsAggregation` | User preference from monitoring settings (how numbers are rolled up). |

### 6.4 Professor Q&A (Analytics)

- **Q: Difference between Analytics and Optimizations?**  
  **A:** **Optimizations** = *what to change* (indexes/partitions). **Analytics** = *why the system believes the workload looks this way* (trends, impact, patterns).

- **Q: Is this supervised learning visualization?**  
  **A:** Partially—panels may show **model fit metrics** or workload scores when API exposes them; the learning itself is trained **offline** (see `scripts/ml-optimization`, `saved_models`).

---

## 7. Alerts page (`/alerts` — `AlertsPage.tsx`)

### 7.1 Purpose

**Incident-style UX:** inbox, anomalies, incidents; severity ordering; pagination.

### 7.2 Implementation highlights

- Tabs driven by URL hash (`#inbox`, `#anomalies`, `#incidents`).
- Severity ordering constant (`SEVERITY_ORDER`).
- Uses `useAlertsData` + direct `api` calls where needed for actions.

### 7.3 Professor Q&A (Alerts)

- **Q: Are alerts ML or rules?**  
  **A:** **Both**—rules on thresholds + **anomaly detector** can feed “unusual query” class alerts when wired in the API.

- **Q: How do you avoid alert fatigue?**  
  **A:** Pagination, severity filters, dedupe on server (ideal); UI focuses **critical** paths first.

---

## 8. Settings page (`/settings` — `SettingsPage.tsx`)

### 8.1 Purpose

**Configuration surface:** server-oriented alert rules, monitoring refresh behavior, **local** preferences.

### 8.2 Tabs

| Tab | Component | Scope |
|-----|-----------|--------|
| **Alert rules** | `AlertSettings` | Server thresholds / API-backed. |
| **Monitoring** | `MonitoringSettings` | Polling intervals, aggregation, retention hints. |
| **Preferences** | `SystemSettings` | **Local** feature flags / UX toggles (`localStorage`). |

### 8.3 Shared UI primitive

`SettingsSwitch` — consistent toggles.

### 8.4 Professor Q&A (Settings)

- **Q: Why mix server and local settings?**  
  **A:** **Server** = source of truth for alerting and shared behavior. **Local** = per-analyst UI without DB writes.

- **Q: Does changing refresh interval change ML?**  
  **A:** It changes **how often** the UI observes the API; ML training is still **batch** unless you add online learning.

---

## 9. Storage-related code (note on routing)

`StoragePage.tsx` and `components/storage/*` exist for **storage analytics** (utilization, cost, cache, growth). In `App.tsx`, `/storage` **redirects to `/`**, so the main student narrative is **Dashboard-as-home**; storage widgets may still be reused elsewhere or re-enabled by adding a route.

**If asked:** *“You have storage components—where is the page?”*  
**Answer:** Implemented but **not mounted** on a dedicated route in the current router; easy extension point.

---

## 10. ML models & algorithms (backend) — maps to UI

This is what professors often drill into. The **UI does not train** models; it **consumes** API payloads built from artifacts in `ml-optimization/saved_models/`.

| Model (Python module) | Learning paradigm | Algorithm(s) | Problem solved | Typical features |
|----------------------|-------------------|--------------|----------------|------------------|
| `query_time_predictor.py` | **Supervised** | **XGBoost** regressor, sklearn **RandomForest** / **GradientBoosting** (config-driven) | Predict **execution time** (ms) from query/log features | Table/join/agg flags, filter counts, `calls`, log-scaled plan estimates, etc. |
| `anomaly_detector.py` | **Unsupervised** | **IsolationForest** + **StandardScaler** | Flag **outlier** queries / metric vectors | Latency, calls, rows, buffer read/hit ratios |
| `workload_clustering.py` | **Unsupervised** | **KMeans**, **DBSCAN**, optional **PCA** | Discover **workload clusters** (ETL vs interactive) | Normalized execution time, row/log features, join complexity, filters |
| `cache_predictor.py` | **Supervised** (typical) | Ensemble / regression (per implementation) | Cache hit / benefit estimation | Cache-related signals from logs |
| `resource_allocator_rl.py` | **Reinforcement learning** (if trained/used) | RL-style allocator | Explore **resource allocation** policies | Environment-specific state/action (extension / advanced demo) |

### 10.1 Why these choices?

- **Gradient boosting (XGBoost):** Strong **tabular** performance; handles mixed discrete “query shape” features and continuous timings.  
- **Isolation Forest:** Classic **unsupervised** anomaly baseline; no need for labeled “bad queries” at scale.  
- **KMeans / DBSCAN:** Interpretable **cohorts**; DBSCAN can find arbitrary-shaped clusters and noise points.

### 10.2 Training & evaluation (how to answer orally)

- **Training data:** `ml_optimization.query_logs` populated from **pg_stat_statements** via collector scripts.  
- **Process:** Extract features → train/validate (holdout or CV) → save `*.pkl` / XGBoost JSON.  
- **Metrics:** MAE/RMSE for regression; review **top-k recommendations** with EXPLAIN; before/after latency on canonical queries.

### 10.3 Recommendation logic (high level)

1. **Parse** SQL text for candidate **(schema.table, column)** (qualified names, WHERE heuristics, broad hints).  
2. **Partition candidates** = time-like columns (`order_date`, `created_at`, `*_ts`, etc.).  
3. **Score** with **predictor residual** and/or **anomaly score**; aggregate by key.  
4. **Validate** against PostgreSQL catalog; merge with persisted recommendations.  
5. **Expose** via REST + WebSocket to **Optimizations** page.

---

## 11. “Professor rapid fire” cheat sheet

| Question | Short answer |
|----------|----------------|
| **How does data reach the Dashboard?** | React hooks → REST (`getHomeDashboard` or parallel endpoints) → JSON props → presentational components. |
| **When do Optimizations update live?** | WebSocket stream ~2s; else polling fallback. |
| **Why lazy routes?** | Code splitting / performance. |
| **Why medallion UI?** | Communicates **governance layers** bronze/silver/gold. |
| **What ML is supervised vs not?** | **Supervised:** query time prediction. **Unsupervised:** anomalies, clustering. |
| **What if the API is down?** | Error banners, retries, some pages use **static fallbacks** (Data Explorer list). |
| **Human in the loop?** | Recommendations can be reviewed; **Implement** may execute DDL server-side with policy checks (403/409/422). |

---

## 12. Two-minute demo talk track (UI-focused)

1. **Dashboard (30 s):** “Single bundle shows warehouse health and sales reality—this is the business face of the warehouse.”  
2. **Monitoring (30 s):** “Here we separate **pipeline reliability** from SQL tuning—freshness and lineage explain trust in gold tables.”  
3. **Optimizations (45 s):** “This is the self-optimizing loop surfaced to users: ML + rules rank **indexes and partitions**; WebSocket keeps it live.”  
4. **Analytics + Alerts (30 s):** “Analytics explains **patterns and impact**; Alerts operationalize thresholds and anomalies.”  
5. **Settings (15 s):** “Operators control polling and rules; local prefs keep UX flexible without touching the DB.”

---

*File: `DW.md` — companion to `README.md` (system-level) with emphasis on **per-page engineering** and **defensible ML mapping**.*
