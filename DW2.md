# DW2.md — Exhaustive UI Reference (Dashboard → Settings)

This document is a **component-by-component, behavior-by-behavior** description of the Vite/React dashboard: **what renders**, **what state and hooks power it**, **which API calls run**, **when updates happen**, and **how to answer professor-style questions** (how / when / why / implementation / logic / ML linkage).

**Source root:** `dashboard/src/`  
**API client:** `dashboard/src/services/api.ts` (`VITE_API_BASE_URL`, default `http://localhost:8000/api/v1`)  
**Cross-cutting prefs:** `dashboard/src/settings/monitoringPreferences.ts` (`localStorage` key `dw-monitoring-settings`)

---

## Table of contents

1. [Shared infrastructure](#1-shared-infrastructure)  
2. [Dashboard page (`/`)](#2-dashboard-page-)  
3. [Monitoring page (`/monitoring`)](#3-monitoring-page-monitoring)  
4. [Data Explorer page (`/data-explorer`)](#4-data-explorer-page-data-explorer)  
5. [Optimizations page (`/optimizations`)](#5-optimizations-page-optimizations)  
6. [Analytics page (`/analytics`)](#6-analytics-page-analytics)  
7. [Alerts page (`/alerts`)](#7-alerts-page-alerts)  
8. [Settings page (`/settings`)](#8-settings-page-settings)  
9. [ML / backend logic the UI depends on](#9-ml--backend-logic-the-ui-depends-on)

---

## 1. Shared infrastructure

### 1.1 Routing (`App.tsx`)

| Item | Detail |
|------|--------|
| **Routes** | `/` Dashboard; `/monitoring`; `/data-explorer`; `/optimizations`; `/analytics`; `/alerts`; `/settings`. |
| **Redirect** | `/storage` → `/` (storage UI exists as components but is not a separate route in the current router). |
| **Code splitting** | Each page is `React.lazy()` + `Suspense` with a minimal “Loading…” fallback so unused pages are not in the initial JS bundle. |
| **Global bridge** | `ActivityLoggerBridge` mounts `useSystemActivityLogger()` once for the whole app. |

### 1.2 `useSystemActivityLogger` (`hooks/useSystemActivityLogger.ts`)

| Event | When | API |
|--------|------|-----|
| `page_load` | Once on mount | `api.logSystemEvent` with pathname + `userAgent`. |
| `route_change` | Every `location.pathname` / `search` change | Same, with query details. |
| **Click logging** | Captures clicks with a **safe selector** (`#id`, `data-testid`, or tag + first classes) | Batches or sends activity events (see implementation in file). |

**Why:** Demonstrates **observability** and auditability—not core ML, but part of “production thinking.”

### 1.3 Sidebar & page chrome

| Piece | File | Behavior |
|-------|------|----------|
| **Nav groups** | `Sidebar.tsx` | Overview → Data & Ops → Insights → System; uses `useSidebarStore` (collapse + mobile drawer) and `useMediaQuery('(min-width: 1024px)')`. |
| **Page wrapper** | `SidebarPageShell.tsx` | Consistent layout with sidebar for all pages **except** the home Dashboard (which uses full-width `TopBar` only). |
| **Mobile menu** | `MobileMenuButton.tsx` | Opens/closes sidebar on small screens. |

### 1.4 Monitoring preferences (localStorage)

`loadMonitoringPreferences()` returns:

| Field | Default | Used by |
|-------|---------|---------|
| `dashboardRefreshSec` | 30 | `useDashboardRefreshIntervalMs`, `useMonitoringData` poll interval |
| `alertPollSec` | 60 | `useAlertPollIntervalMs` → `useAlertsData` |
| `retentionDays` | 90 | Analytics long window, Optimizations time-range default, `SalesTrend` initial range |
| `metricsAggregation` | `'1 hour'` | `WorkloadPatterns` / analytics aggregation label |

Changes dispatch `dw-monitoring-preferences-changed` so hooks can react in the same tab; `storage` event covers other tabs.

**Professor Q&A:** *Why localStorage?* → Fast iteration without a user account table; **server** settings are separate (alert rules API).

---

## 2. Dashboard page (`/`)

**File:** `pages/DashboardPage.tsx`  
**Layout:** No sidebar—`min-h-screen bg-base topo-bg`, full-width narrative suitable for a “landing” executive view.

### 2.1 Data pipeline: `useDashboardData`

| Step | Behavior |
|------|----------|
| **Primary path** | `api.getHomeDashboard()` once via `loadHomeDashboardOnce()`—**dedupes concurrent promises** (important under React StrictMode double mount). |
| **404 fallback** | If bundle returns “Not Found”, falls back to **parallel** `getWarehouseSummary`, `getSalesStats`, `getCustomerStats`, `getActiveAlerts`, `getHealth` with `Promise.allSettled`. |
| **Error fallback** | On other errors, still tries legacy parallel fetch before giving up. |
| **Polling** | `setInterval(..., pollIntervalMs)` from `useDashboardRefreshIntervalMs()`; silent refetch uses `{ silent: true }` to avoid flashing the global loading state. |
| **Empty check** | If `summary`, `sales`, and `customers` are all null after success path, sets error string `Failed to load dashboard data`. |

**Type `DashboardData`:**

- `summary`: `{ warehouse_summary?, database? }` — medallion counts/sizes.  
- `sales`: `SalesStats` — `total_sales`, `daily_sales`, `top_products`.  
- `customers`: `{ total_customers? }`.  
- `alerts`: `{ alerts?: [...] }` for TopBar notifications.  
- `health`: arbitrary JSON (uptime, latency_ms, etc.) for Footer.

### 2.2 `TopBar` (`components/TopBar.tsx`)

| Concern | Implementation |
|---------|----------------|
| **Props** | `data`, `loading`, `connectionError` — drives “online vs offline” feel. |
| **Gateway check** | `hasGatewayData` true if any of summary/health/sales/customers/alerts is non-null. |
| **Alerts dropdown** | Uses `data.alerts.alerts`; **stable keys** via `stableNotificationKey` (alert_id, id, or hash of title+message+timestamp+type+severity). |
| **Acknowledge** | `canAcknowledgeOnServer` only if key is not the synthetic `ctx:...` fallback. |
| **Navigation** | `mobileNav` mirrors main sidebar routes; desktop may show compass brand + notifications. |
| **Deep link** | `hrefForDashboardAlert` maps alert context to `/alerts`, `/monitoring#...`, etc. |
| **Time** | `formatLocalDate`, `formatLocalTime`, `formatLocalDateTime`, `formatTimeAgo` for human-readable timestamps. |

**When:** Renders on every Dashboard paint; notifications re-resolve when `data` poll updates.

### 2.3 `HeroSection` (`components/HeroSection.tsx`)

| Detail | Value |
|--------|--------|
| **Purpose** | Purely **presentational**—badges (“Overview”, “3 Layers”, “Online”), large title “Data Warehouse Dashboard”, decorative SVG curves. |
| **Data** | None; no API. |
| **Motion** | Framer Motion fade/slide on title. |

### 2.4 `KeyMetrics` (`components/KeyMetrics.tsx`)

| Detail | Value |
|--------|--------|
| **Purpose** | Six KPI cards: Total Records, Total Tables, Total Sales, Total Revenue, Avg Sale Value, Total Customers. |
| **Logic** | `buildMetrics(data)`: if no `warehouse_summary` and no sales/customers → **`DEFAULT_METRICS`** (large demo numbers). Otherwise: sums `bronze+silver+gold` `estimated_rows` and `table_count`; reads `total_sales.count/revenue/avg_sale`; `total_customers`. |
| **Formatting** | `formatRevenue` uses B/M/K suffixes. |
| **Loading** | Skeleton pulse grid until first real `summary`/`sales`/`customers` arrives. |
| **Change badges** | Static strings like `+2.4%` (cosmetic trend hints unless wired to API). |

**Professor Q&A:** *Are KPI deltas real?* → **Percent change chips are static** in current code; **absolute values** come from API when available.

### 2.5 `MedallionTiers` (`components/MedallionTiers.tsx`)

| Detail | Value |
|--------|--------|
| **Purpose** | Three cards: Bronze, Silver, Gold with table counts, row counts, **distribution bar** (% of total rows). |
| **Logic** | `buildTiers`: if no `warehouse_summary`, uses `DEFAULT_TIERS`; else maps API counts to each tier. |
| **Visual** | “Elevation” labels (metaphor); `ArrowRight` connectors between columns on `md+`. |
| **Animation** | Staggered `motion.div`; bar width animated after mount. |

### 2.6 `SalesTrend` (`components/SalesTrend.tsx`)

| Detail | Value |
|--------|--------|
| **Purpose** | Time-series chart of sales/revenue; range presets (this month daily, 60/180/365/730 days, all time). |
| **Initial range** | `initialRangeFromRetention()` reads `retentionDays` from monitoring preferences (clamped, special case `0` → all time). |
| **Data sources** | Uses bundled `daily_sales` from dashboard data when possible; may call API for longer ranges (see `api` usage and `daysLookbackForCurrentMonth`). |
| **Parsing** | Robust date parsing (`parseChartDay`) for `YYYY-MM-DD`, ISO, `YYYYMMDD` to avoid UTC bugs. |
| **Export** | `downloadSalesDailyAsExcel` from `utils/salesTrendExcelExport`. |

**When:** User changes preset or when parent `data` updates from poll.

### 2.7 `TopProducts` (`components/TopProducts.tsx`)

| Detail | Value |
|--------|--------|
| **Purpose** | Top **10** products by revenue—horizontal bar chart. |
| **Logic** | `normalizeProducts`: maps `product` or `product_name`, filters `revenue > 0`, slices10. |
| **Empty state** | Message to run ETL and populate `gold.fact_sales`. |
| **Colors** | Rotating `barColors` per rank. |

### 2.8 `Footer` (`components/Footer.tsx`)

| Detail | Value |
|--------|--------|
| **Props** | `health` from `footerHealthFromDashboard(data, loading)` in `DashboardPage`. |
| **Logic** | `healthy = data.health != null`; `pending = loading && !healthy`; uptime default `99.97%`, latency default `< 2 ms` or from `health.latency_ms`. |
| **Disclaimer** | Static text “All data simulated” in footer—**align your demo narrative** with whether you use real or seed data. |

---

## 3. Monitoring page (`/monitoring`)

**File:** `pages/MonitoringPage.tsx`  
**Shell:** `SidebarPageShell` with dark background `#0a0d18` and radial gradient ambience.

### 3.1 Hash deep-linking

`useEffect` depends on `location.hash`, `pathname`, `loading`. After 100ms, `document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth' })`.

**Anchors:**

| `id` | Section |
|------|---------|
| `monitoring-lineage` | Lineage |
| `monitoring-etl` | Recent runs + manual runner |
| `monitoring-freshness` | Data freshness |
| `monitoring-data-quality` | Data quality |

### 3.2 Data: `useMonitoringData` (`hooks/useMonitoringData.ts`)

**Goal:** Prefer **one** request; degrade gracefully.

| Order | Call | On success |
|-------|------|------------|
| 1 | `api.getETLMonitoringPage(bustCache)` | Merges `jobs`, `jobDefinitions`, `pipeline`, `errors`, `throughput`, `freshness`, `dataQuality`. |
| 2 (404) | `api.getETLMonitoringDashboardBundle` + parallel `getDataFreshness`, `getDataQualityMetrics` | Partial merge + fills freshness/quality with empty defaults on failure. |
| 3 (404 again) | `legacyParallel`: `getETLJobs`, `getETLJobDefinitions`, `getPipelineDAG`, `getDataFreshness`, `getETLErrors`, `getDataQualityMetrics`, `getThroughputMetrics` | Each `.catch` merges safe empties. |

**Concurrency guard:** `genRef` increments per fetch; stale responses ignored.

**Polling:** Same `useDashboardRefreshIntervalMs` as home dashboard.  
**Silent refresh:** Sets `refreshing` true; initial load sets `loading` true.

**Refetch:** `fetchAll({ bustCache: true })` for user-triggered hard refresh.

### 3.3 `MonitoringHeader` (`monitoring/MonitoringHeader.tsx`)

Typically shows refresh / title context—pairs with `refreshing` prop (file not re-opened here; behavior is header chrome).

### 3.4 `ETLStats` (`monitoring/ETLStats.tsx`)

| Stat | Derivation |
|------|------------|
| Active Pipelines | Count of jobs with `status` in `running` / `pending`. |
| Failed Runs (24h) | `errors` array length (naming is approximate vs true24h window—depends on API). |
| Data Freshness SLA | `freshness.sla_met` / `freshness.sla_total` (with badge “On time” if total). |
| Avg ETL Duration | Mean of `duration_seconds` over `jobs`. |
| ML-Detected Anomalies | **Hardcoded `0`** in `buildStats` today—extend `buildStats` to read e.g. `data.anomaly_count` when the API exposes it. |

**Loading:** Five pulse cards when loading and no jobs/errors yet.

### 3.5 `LineageVisualization` (`monitoring/LineageVisualization.tsx`)

Renders **pipeline DAG** from `data.pipeline` (nodes/edges from API). Purely visual + interactive affordances as implemented in file.

### 3.6 `RecentETLRuns` (`monitoring/RecentETLRuns.tsx`)

Lists recent job runs from `data.jobs`; `onRefetch` after actions. (See file for row layout, status chips, timestamps.)

### 3.7 `ManualETLJobRunner` (`monitoring/ManualETLJobRunner.tsx`)

| Concept | Detail |
|---------|--------|
| **Props** | `jobs`, `jobDefinitions`, loading flags, `onAfterDispatch`. |
| **Status semantics** | `classifyStatus` maps strings to success / failure / running / neutral. |
| **Pipeline UI** | `PIPELINE_STEPS = Extract / Transform / Load`; `pipelineStageUi` maps run + job type to stage emphasis. |
| **Dispatch** | `api` POST to trigger a job (exact method in file); on success calls `onAfterDispatch` → parent `refetch`. |

**Professor Q&A:** *Is this safe?* → In production you’d add **authz**, rate limits, and audit logging on the API.

### 3.8 `DataFreshness` (`monitoring/DataFreshness.tsx`)

Shows dataset freshness vs SLA using `data.freshness` (datasets, on_time, at_risk, sla_breach, etc.). `onRefetch` for manual refresh. Loading true if `freshness === undefined`.

### 3.9 `DataQuality` (`monitoring/DataQuality.tsx`)

Shows **quality metrics** from `data.dataQuality` (`layers`, `quality_metrics`, etc.). Same refetch pattern.

### 3.10 `ThroughputBanner` (component not mounted on `MonitoringPage`)

`components/monitoring/ThroughputBanner.tsx` reads `data.throughput` (`overall_throughput` or summed `records_per_second`). **`MonitoringPage.tsx` does not import it** as of this doc—throughput still surfaces where `ETLStats` or other panels use `data.throughput`. You can drop `<ThroughputBanner data={data} loading={loading} />` beside the stats row if you want a dedicated banner.

---

## 4. Data Explorer page (`/data-explorer`)

**File:** `pages/DataExplorerPage.tsx`

### 4.1 Static catalog + live enrichment

| Layer | Source |
|-------|--------|
| **Table list** | In-file `allTables: TableInfo[]` — curated Bronze (16), Silver (16), Gold (14) table names with placeholder `columns` count and `updated: 'Unknown'`. |
| **Live updates** | On load, effect can fetch real metadata from API to override counts/updated (see `loading` / `tables` state in file). |

**Why both:** UI remains usable **offline**; with API it becomes **live**.

### 4.2 Layer UX

`layers = ['Bronze','Silver','Gold']`; `layerConfig` supplies icon, accent colors, borders, badges per layer.  
`activeLayer` state filters `tables` to that tier.  
`layerCounts` computed per layer for tab badges.

### 4.3 Search

Controlled `search` string; `filtered` = tables in active layer whose **name** (and optionally column metadata if wired) matches query. Clear button resets.

### 4.4 Table grid

Card per table: name, layer badge, column count, updated time, **column density bar** (`columns / 15`).`AnimatePresence` + `layout` for smooth reordering.

### 4.5 Detail modal

`handleOpenTable` sets `selectedTable` and `loadTableDetails`:

- Fetches **stats** and **columns** via `api` + `Promise.allSettled`-style handling.  
- `copyQualifiedName` copies `bronze.table` style FQN to clipboard; `copiedFqn` feedback2s.

**Professor Q&A:** *Is this the same as information_schema?* → **Yes conceptually**—backend should expose schema introspection consistent with PostgreSQL.

---

## 5. Optimizations page (`/optimizations`)

**File:** `pages/OptimizationsPage.tsx`

### 5.1 State & time window

| State | Role |
|-------|------|
| `timeRange` | `'Last 7 days' \| 'Last 30 days' \| 'Last 90 days'` — initialized from `closestTimeRangeLabel(loadMonitoringPreferences().retentionDays)`. |
| `performanceDays` | `useMemo` from `daysFromLabel(timeRange)` → passed into `useOptimizationsData(performanceDays)`. |
| `recTab` | `'index' \| 'partition'` — toggles recommendation panel. |
| `clock` | Updates every 1s for header clock display. |
| `isOnline` | `navigator.onLine` + window online/offline listeners. |

### 5.2 Live data: `useOptimizationsData` → `useOptimizationRealtimeWebSocket`

| Piece | Detail |
|-------|--------|
| **Merge** | `recommendations` = index rows + partition rows (from snapshot or HTTP). |
| **Limits** | `REC_LIMIT = 100`; HTTP prefetch may request up to `min(max(rec*2, rec), 250)` recommendations. |
| **Performance** | `api.getQueryPerformance({ start_date, end_date, limit })` with `utcPerformanceDateRange(performanceDays)`. |
| **WebSocket** | URL from `buildOptimizationStreamWebSocketUrl`; reconnect with backoff (`reconnectAttemptsRef`). |
| **Fallback** | If WS fails, `usingFallback` + interval `fetchSnapshotViaHttp` at `fallbackIntervalMs` (default 2000). |
| **Normalize** | `normalizeQueryPerformance` for consistent slow-query rows. |

**Stream badge on page:**

- Offline → red “Offline”.  
- `wsConnected` → “Live” (green/cyan styling).  
- `usingFallback` → “Polling” (amber).  
- Else “Connecting”.

### 5.3 KPI strip (three cards)

1. **Recommendations** — `indexCount + partitionCount`; subtitle splits index vs partition.  
2. **Slow queries** — `data.queryPerformance.length` when array non-empty.  
3. **Update mode** — textual “Live / Polling / Idle” from stream state.

### 5.4 Recommendations card (tabbed)

**Index tab:** `IndexRecommendations`  
**Partition tab:** `PartitionRecommendations`

**Counts** in tab buttons from filtered `data.recommendations` by `type`.

### 5.5 `IndexRecommendations` (`optimizations/IndexRecommendations.tsx`)

| Feature | Detail |
|---------|--------|
| **Filter** | Rows where `type === 'index'` **or** `type` missing (defaults to index). |
| **Source badges** | `recommendationSourceBadge` maps `recommendation_source`: `ml_query_logs`, `ml_pg_stat`, `ml_mixed`, `persisted_db`, `pg_stat_heuristic`, `workload_partition`, etc. |
| **Implement** | `api.applyOptimization(id, false, recommendationApplySnapshot(rec))`. |
| **Outcomes** | `already_satisfied` → `409`-style semantics surfaced as success message; `persisted !== true` → error copy; success sets optimistic applied state. |
| **Errors** | `formatOptimizationApplyError` maps `ApiError` status to human headlines (403/409/422/…). |

**Partition panel** mirrors apply semantics with partition DDL templates (see `PartitionRecommendations.tsx`).

### 5.6 `QueryPerformance` (`optimizations/QueryPerformance.tsx`)

| Props | `data`, `loading`, `timeRange`, `onTimeRangeChange`, `timeRangeOptions` |
|-------|--------------------------------------------------------------------------|
| **Role** | Lists slow / expensive queries in selected window; ties narrative to recommendations. |

### 5.7 `OptimizationHistory` (`optimizations/OptimizationHistory.tsx`)

Shows historical apply events / recommendation lifecycle from `data.history` (populated via WS snapshot or `getOptimizationHistory` in HTTP fallback).

---

## 6. Analytics page (`/analytics`)

**File:** `pages/AnalyticsPage.tsx`

### 6.1 Header & navigation

Sticky header: back to home, title “Analytics”, **last updated** from `useAnalyticsData`’s `lastUpdatedAt`, **Refresh** button calls `refetch()` + `refetchWc()` in parallel.

**Jump links** scroll to section ids:

| `id` | Label |
|------|-------|
| `analytics-overview` | Overview |
| `analytics-ml-workload-cache` | Smart insights |
| `analytics-queries` | Slow queries |
| `analytics-workload` | Busy times |

Hash in URL triggers `useEffect` scroll (~150ms delay after load).

### 6.2 Data: `useAnalyticsData` (`hooks/useAnalyticsData.ts`)

**Purpose:** Build `AnalyticsPageData`:

- Multiple **query performance** slices: long window, 7d, 1d (from analytics bundle or composed endpoints).  
- **`queryLogRollup1d` / `queryLogRollup7d`:** exact Σ `calls` rollups from `ml_optimization.query_logs` (see `utils/analyticsDerived.ts`).  
- **`hourlyCallsUtc7d`:**24-vector of call sums by UTC hour.  
- **Peaks** | `peakUtcHour7d`, `peakHourTotalCalls7d`, `peakSampleLogId7d` | for “busy hour” storytelling.  
- **Aux** | `optimizationHistory`, `recommendations`, `storageUtilization`, `costTracking` | with **15s timeout** helper `withTimeout` so one slow endpoint doesn’t hang the page.  
- **`longWindowDays`** | from `useRetentionDays()` | ties charts to Settings retention.

### 6.3 Workload + cache insights: `useWorkloadCacheInsights`

Feeds **`WorkloadCacheMlPanels`** with ML-oriented workload/cache text or scores from dedicated API routes (implementation in hook file).

### 6.4 `metricsAggregation`

From `useMetricsAggregation()` — passes into **`WorkloadPatterns`** so bin width matches user preference (e.g. 1 hour vs coarser).

### 6.5 Section components

| Component | Role |
|-----------|------|
| `AnalyticsStats` | Top-level stats cards from `AnalyticsPageData`. |
| `WorkloadCacheMlPanels` | Combined workload + cache “smart insights” with refresh. |
| `QueryPerformanceImpact` | Comparative / impact visualization for slow queries. |
| `WorkloadPatterns` | Temporal “busy times” / pattern chart using rollups + aggregation preference. |

**Note:** Other files exist under `components/analytics/` (e.g. `OptimizationROI`, `ModelFitMetrics`)—they may be used by `AnalyticsStats` or future sections; extend this doc if you wire them into `AnalyticsPage.tsx`.

---

## 7. Alerts page (`/alerts`)

**File:** `pages/AlertsPage.tsx` (large single file)

### 7.1 Data: `useAlertsData` (`hooks/useAlertsData.ts`)

| Path | Behavior |
|------|----------|
| **Primary** | `api.getAlertsPageBundle()` → `active.alerts`, `anomalies.anomalies`, `incidents.incidents` + `meta` counts. |
| **Fallback** | On 404 or5xx/408/502/503: split calls `getActiveAlerts`, `getAnomalies`, `getIncidents`; builds synthetic `meta.by_severity` for alerts. |
| **Polling** | `useAlertPollIntervalMs()` from monitoring preferences (`alertPollSec`). |

### 7.2 Tabs & hash

`alertsTabFromHash`: `#inbox`, `#anomalies`, `#incidents` (default inbox).

### 7.3 Severity model

`SEVERITY_ORDER` for sorting: `critical`, `high`, `medium`, `low`, `info`, `warning`.  
Visual helpers: `severityPillClass`, `severityBarClass`, `severityIconWrapClass`, `SeverityGlyph`.

### 7.4 Pagination

Constants: `INBOX_PAGE_SIZE`, `ANOM_PAGE_SIZE`, `INC_PAGE_SIZE` = 5 each (adjust in file if needed).

### 7.5 Formatting helpers

- `formatAnomalyLine` — human text for anomaly type (`insert_rate_drop`, `unusual_row_size`, etc.).  
- `inboxDetailRows` / `anomalyDetailRows` / `incidentDetailRows` — key/label pairs for expandable detail panels.

### 7.6 Direct `api` usage

Page may call additional endpoints for acknowledge/dismiss actions (search `api.` in file for exact methods).

**ML link:** Anomalies may be driven by **Isolation Forest** or rule detectors in backend; UI only renders payloads.

---

## 8. Settings page (`/settings`)

**File:** `pages/SettingsPage.tsx`

### 8.1 Chrome

Dark theme aligned with Monitoring (`#0a0d18`, `#0c0f1a` header). Sticky header with mobile menu, back to home, live pill (decorative on sm+), local clock `formatLocalTime`.

### 8.2 Tabs (`role="tablist"`)

| `id` | Label | Component | Scope |
|------|-------|-----------|--------|
| `alerts` | Alert rules | `AlertSettings` | **Server** thresholds via API |
| `monitoring` | Monitoring | `MonitoringSettings` | **localStorage** refresh + retention + aggregation |
| `system` | Preferences | `SystemSettings` | **Local** feature flags |

`AnimatePresence` cross-fades tab content.

### 8.3 `MonitoringSettings` (`settings/MonitoringSettings.tsx`)

Writes rows into `MONITORING_SETTINGS_STORAGE_KEY` with labels matching `FIELD_LABELS` in `monitoringPreferences.ts`; dispatches `MONITORING_PREFS_CHANGED_EVENT`.

### 8.4 `AlertSettings` (`settings/AlertSettings.tsx`)

Loads/saves alert rule configuration through **`api`** (exact routes in component + `api.ts`).

### 8.5 `SystemSettings` (`settings/SystemSettings.tsx`)

Local toggles (theme/UX/feature flags as implemented)—no DB.

### 8.6 `SettingsSwitch` (`settings/SettingsSwitch.tsx`)

Reusable accessible toggle for boolean prefs.

---

## 9. ML / backend logic the UI depends on

The React app **does not train** models. It displays outcomes of:

| Backend capability | UI surface |
|--------------------|------------|
| **Query time regression** (XGBoost / sklearn) | Optimizations ranking, analytics “impact” narratives |
| **Isolation Forest anomaly detection** | Alerts / anomalies; ETL “ML anomalies” stat when wired |
| **KMeans / DBSCAN workload clustering** | Analytics / workload panels when API exposes cluster summaries |
| **SQL + catalog heuristics** | Index vs partition recommendation typing |
| **`pg_stat_statements` + `query_logs`** | Everything in Optimizations & Analytics |

**Recommendation sources** (see badges in `IndexRecommendations`):`ml_query_logs`, `ml_pg_stat`, `ml_mixed`, `persisted_db`, `pg_stat_heuristic`, `workload_partition`.

---

## Quick professor map: “Which file do I open?”

| Question | Answer |
|----------|--------|
| Where is routing? | `App.tsx` |
| Where is the dashboard API merge? | `hooks/useDashboardData.ts` |
| Where is ETL bundle fallback? | `hooks/useMonitoringData.ts` |
| Where is optimization WebSocket? | `hooks/useOptimizationRealtimeWebSocket.ts` |
| Where is apply index DDL? | `components/optimizations/IndexRecommendations.tsx` + `api.applyOptimization` |
| Where are local poll intervals? | `settings/monitoringPreferences.ts` + `hooks/useMonitoringPreferences.ts` |

---

## 10. Defense narrative per page section (Why / Data Source / Logic / What it does)

Use this section directly in viva/demo when a professor asks: “Why did you include this block?”

### 10.1 Dashboard

#### Key Statistics (`KeyMetrics`)

I show the Key Statistics section because it is the quickest way to communicate two things a professor will immediately ask about: the **scale of the warehouse** (records and tables) and the **business output** the warehouse enables (sales, revenue, customers). The numbers shown here are produced by the dashboard data pipeline in `useDashboardData.ts`, which prefers a single bundled endpoint (`api.getHomeDashboard()`) and, if that bundle is unavailable, falls back to merging the outputs of `getWarehouseSummary`, `getSalesStats`, and `getCustomerStats`. Inside the UI, `KeyMetrics.tsx` computes the displayed values through `buildMetrics(data)` by aggregating medallion row counts across Bronze + Silver + Gold, summing table counts, and reading commerce KPIs such as total sales count, revenue, and average sale value from the sales payload, plus total customers from the customer payload. If the backend does not return values, the component intentionally renders `DEFAULT_METRICS` so the dashboard still demonstrates correct structure and UX during an offline demo. Functionally, this block converts raw backend telemetry into business-friendly KPI cards so a non-technical stakeholder can understand the platform state in seconds, while a technical evaluator can trace each KPI back to a specific warehouse summary or Gold-layer metric.

#### Medallion Architecture (`MedallionTiers`)

I show the Medallion Architecture section because it proves the system follows an industry-standard warehouse organization and gives a clear story of how raw data becomes analytics-ready data. This is important in a defense because it answers “how is your warehouse structured?” and it connects ETL operations to analytics outputs in a way that is easy to explain. The tier numbers come from `summary.warehouse_summary` in the dashboard payload. In `MedallionTiers.tsx`, the `buildTiers` logic maps the backend table count and estimated row count into Bronze, Silver, and Gold cards, and then computes the distribution bars as percentages of total estimated rows so the viewer can see where the volume is concentrated. If the summary is missing, it uses `DEFAULT_TIERS` so the medallion narrative remains visible during a demo. Functionally, this block visualizes the data lifecycle: Bronze holds ingested raw data, Silver holds cleaned and conformed data, and Gold holds business-ready facts and dimensions, which helps justify why ETL and data quality practices matter.

#### Sales Trend (`SalesTrend`)

I show Sales Trend because a warehouse should answer time-based questions, not just show static totals. Trends reveal stability versus volatility, identify spikes or dips, and demonstrate that the system can support analytical monitoring over time. The chart reads `daily_sales` from the dashboard bundle when available and supports longer windows through range-aware fetching. The logic in `SalesTrend.tsx` includes date-range presets, defensive parsing that accepts `YYYY-MM-DD`, ISO timestamps, and compact date formats to avoid common timezone/format issues, and an initial range that is tied to the system’s retention policy (`retentionDays`) from Settings so the dashboard window is consistent with overall monitoring policy. This component also includes an Excel export via `utils/salesTrendExcelExport`, which is included because exporting results is a realistic business workflow. Functionally, Sales Trend turns Gold-layer facts into an interpretable narrative about demand and performance over time, and it provides an artifact (Excel) that can be shared outside the app.

#### Top Products (`TopProducts`)

I show Top Products because it directly connects warehouse data to a business question that is easy to validate: which items drive revenue. This makes the demo concrete and shows that the Gold layer can support BI-style aggregations. The data comes from `sales.top_products` in the dashboard dataset. The logic in `TopProducts.tsx` normalizes payload differences (`product` vs `product_name`), filters out invalid or zero revenue entries, and shows the top 10 so the visualization stays readable. Functionally, this panel transforms fact outputs into rank-based business intelligence, demonstrating that the warehouse is producing usable aggregates rather than only operational metrics.

### 10.2 Monitoring

#### ETL Stats (`ETLStats`)

I show ETL Stats because monitoring starts with a small set of health indicators that tell you whether the system is safe to trust before you dive into logs. This section is populated from the monitoring payload produced by `useMonitoringData.ts`, which prefers a monitoring bundle endpoint and falls back to multiple endpoints if necessary. In `ETLStats.tsx`, the logic computes active pipelines by counting job runs with statuses like `running` or `pending`, computes a failed run indicator from the errors list, derives average ETL duration from `duration_seconds`, and expresses data freshness as an SLA met/total ratio using freshness metrics. It also treats throughput presence as a signal that the monitoring dataset is populated. Functionally, ETL Stats provides at-a-glance pipeline reliability KPIs that support operational decisions such as whether to re-run a job, investigate failures, or pause downstream analytics because freshness is compromised.

#### Lineage Visualization (`LineageVisualization`)

I show lineage because traceability and governance are fundamental warehouse requirements. When asked “where does this metric come from?” lineage is the formal answer, and when a pipeline fails, lineage helps you understand upstream/downstream impact. The visualization is built from `data.pipeline` in the monitoring payload. The component renders a node/edge graph representing the ETL DAG so a viewer can see how data flows from ingestion through transformations into curated outputs. Functionally, this helps root-cause failures faster and communicate blast radius clearly—for example, showing that a Silver-stage failure affects multiple Gold facts and therefore will affect dashboard numbers until recovery.

#### Recent ETL Runs + Manual Runner

I show Recent ETL Runs together with a Manual Runner because monitoring is incomplete without both observability and controlled intervention. Recent runs provide execution history (status, duration, timestamps), while the manual runner provides a safe UI for triggering ETL jobs when recovery or an urgent refresh is required. Both are fed by `jobs` and `jobDefinitions` from the monitoring dataset, and dispatch actions go through the backend run endpoint. The UI logic classifies statuses into understandable categories (running/success/failed), maps jobs to pipeline stages (Extract/Transform/Load) so the operator understands where work is happening, and refetches after dispatch so the page reflects new state quickly. Functionally, these panels support incident workflows: you can identify the last failed run, re-run it, and verify the system returns to a healthy state without leaving the UI.

#### Data Freshness + Data Quality

I show Data Freshness and Data Quality because “ETL succeeded” is not equivalent to “data is usable.” Freshness ensures datasets are updated within expected SLA windows, and quality ensures the content meets trust requirements (for example, low null rates, consistent keys, and no obvious integrity issues, depending on what the backend reports). These panels load from the bundle when present or from dedicated endpoints such as `getDataFreshness` and `getDataQualityMetrics` in the fallback strategy. The UI logic displays SLA met/total ratios, dataset freshness states (on-time/at-risk/breach), and layer-level indicators so you can communicate not only operational success but also readiness for analytics. Functionally, these checks prevent downstream dashboards and analytics from using stale or dirty data and provide the justification for generating alerts/incidents when SLAs are violated.

### 10.3 Data Explorer

#### Layer Tabs + Search + Table Detail Modal

I show the Data Explorer layer tabs, search, and table detail modal because discoverability is one of the biggest friction points in real warehouses. A user should not have to query metadata tables just to learn what exists; a catalog-like UI reduces onboarding time and reduces mistakes. This page intentionally uses a hybrid data model: it has a curated catalog so the app is usable even without a live backend during a demo, and it can also enrich the selected table with live API metadata such as columns and statistics. The logic filters tables by the active medallion layer (Bronze/Silver/Gold), applies a search string to narrow results, fetches detail only when a table is selected (which avoids loading every schema detail up front), and offers a copy-to-clipboard fully qualified name so the UI connects to real SQL usage. Functionally, this page behaves like a lightweight data catalog that makes the medallion architecture browseable and makes it easy for analysts to move from discovery to querying.

### 10.4 Optimizations

#### Recommendations (Index / Partition)

I show Index and Partition recommendations because they represent the core “self-optimizing” promise: the system should not only detect performance problems but also propose specific, implementable improvements. Recommendations arrive via a real-time WebSocket stream when available and fall back to periodic HTTP snapshots through `getOptimizationRecommendations` when streaming is unavailable. The UI logic separates the recommendation list into Index and Partition categories, labels recommendations with their provenance (for example `ml_query_logs`, `ml_pg_stat`, or heuristic sources) so you can defend how the system generated them, and provides an apply workflow using `api.applyOptimization`. That apply workflow is explicit about outcomes: it can report “already satisfied” when the system determines the optimization is already in place, and it checks for persistence so the UI does not claim success without backend confirmation. Functionally, this block closes the loop between diagnosis and action by turning telemetry and ML/heuristic analysis into actionable changes with auditable outcomes.

#### Query Performance + Optimization History

I show Query Performance and Optimization History because recommendations are only credible when they are backed by evidence and an audit trail. Query performance provides measurable proof of bottlenecks, and optimization history provides accountability for what was recommended and what was applied. The data comes from endpoints such as `getQueryPerformance` and `getOptimizationHistory`, aligned to a selectable time window so a user can analyze recent regressions versus longer-term behavior. The UI logic normalizes slow-query rows to maintain consistent display even when backend payload shapes differ, and it renders lifecycle history so you can explain how recommendations evolved and whether they were applied successfully. Functionally, these panels quantify the impact of optimizations and increase trust by making the system’s decisions explainable and verifiable.

### 10.5 Analytics

#### Analytics Stats

I show Analytics Stats because this is where the system moves from “operations” to “strategy.” Instead of only answering whether something is failing now, analytics answers whether performance and usage are changing over time and where the warehouse is being used most. The data comes from `useAnalyticsData.ts`, which composes an analytics dataset using a bundle endpoint where possible and falls back to multiple endpoints with timeout guards so one slow service does not block the page. The derivation logic produces multi-window rollups (for example 1 day, 7 days, and a long retention-based window), computes exact call aggregations from query log rollups, and derives summary indicators that can be shown in compact cards. Functionally, this provides trend visibility for capacity planning, cost/performance trade-off discussions, and validation that the warehouse is meeting performance objectives over time.

#### Workload/Cache ML Panels (`WorkloadCacheMlPanels`)

I show the Workload/Cache ML panels because they make the system’s intelligence visible without requiring the viewer to interpret raw charts. These panels summarize what the system believes is happening with workload and caching behavior in human-readable terms, which is useful both for non-technical stakeholders and for technical reviewers who want to understand the model outputs. The data is fetched through `useWorkloadCacheInsights`, and it is intentionally loaded independently from the main analytics dataset so an error in the insights service does not break the rest of the page. The logic keeps its own loading/error states and supports refresh so you can demonstrate that insights can be updated. Functionally, these panels bridge technical telemetry and model outputs into actionable recommendations and explanations that support optimization planning.

#### Query Performance Impact + Workload Patterns

I show Query Performance Impact and Workload Patterns because the best analytics explains both “what is slow” and “when/why it becomes slow.” Performance impact panels connect slow-query behavior to system and user impact, while workload patterns reveal temporal demand structure such as peak hours or recurring daily cycles. These panels consume query logs and performance slices from the analytics dataset, and they respect the monitoring preference `metricsAggregation` so the charts can adjust granularity for readability versus detail. The logic includes peak-hour detection based on UTC hourly rollups, which provides a reproducible method for identifying busiest periods. Functionally, these insights support capacity planning, help schedule ETL or maintenance outside peak windows, and guide targeted tuning efforts toward the queries and times that matter most.

### 10.6 Alerts

#### Inbox / Anomalies / Incidents

I show separate views for Inbox, Anomalies, and Incidents because these objects represent different operational workflows. Inbox alerts usually require immediate triage, anomalies represent unusual detected behavior that might require analysis, and incidents represent grouped events that may require coordinated response. The data is fetched through `getAlertsPageBundle` when available, and it falls back to `getActiveAlerts`, `getAnomalies`, and `getIncidents` so the UI remains functional even if the bundle endpoint is missing. The UI logic orders items by severity, synchronizes the active tab with the URL hash so the view is deep-linkable, paginates results to keep the page readable, and maps details by entity type so each class displays relevant fields. Functionally, this page centralizes response: it provides prioritization signals and context so operators can act quickly and consistently.

### 10.7 Settings

#### Monitoring Settings

I show Monitoring Settings because operational parameters like refresh intervals, retention, and aggregation should be tunable without code changes. In a defense, this also shows that the system design anticipates real operational needs: different environments may require different polling rates, and retention directly affects analytics windows. These settings are stored in client `localStorage` under `dw-monitoring-settings` so the application can run without authentication or a user profile database. The logic persists changes and broadcasts a custom event (`dw-monitoring-preferences-changed`) so hooks across the app react immediately, while browser `storage` events support cross-tab synchronization. Functionally, these preferences govern polling cadence, retention windows, and analytics aggregation globally across Dashboard, Monitoring, Analytics, and Alerts.

#### Alert Settings

I show Alert Settings because alerting only works when it matches the organization’s SLA and tolerance for noise. Hardcoded thresholds usually lead to either alert fatigue (too noisy) or missed incidents (too quiet). This section reads and writes alert rules through backend alert rule APIs, which is the correct layer for operational policy because it should apply consistently across clients. The logic loads the existing rules, allows edits, and saves them back to the server so the alerting behavior changes system-wide. Functionally, this aligns alert sensitivity to business expectations and reduces alert fatigue as workloads evolve.

#### System Settings

I show System Settings because some preferences are purely about usability and environment compatibility rather than “data semantics.” Keeping these separate prevents UI customization from changing warehouse meaning or monitoring policy. These preferences are stored locally and are implemented using reusable toggles (`SettingsSwitch`) within a scalable tabbed settings structure. Functionally, System Settings improves usability and adaptability per user and per environment while keeping monitoring and alert logic consistent.

---

*End of DW2.md — companion to `DW.md` (shorter Q&A) and `README.md` (system architecture).*
