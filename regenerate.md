# Regenerated Project Data, Code, and Tables (Verified)

This file contains corrected, repo-verified content for report regeneration.
All values below are sourced from current project artifacts and code.

## 1) Verified Training Data Amount Used

### Full training run
- Source file: `ml-optimization/saved_models/training_metrics_full.json`
- `n_rows_loaded`: **1,980,014**
- `limit_applied`: **0** (no SQL limit; full filtered dataset)
- Timestamp: `2026-05-01T23:43:44.149867+00:00`

### Smoke training run
- Source file: `ml-optimization/saved_models/training_metrics_smoke.json`
- `n_rows_loaded`: **5,000**
- `limit_applied`: **5,000**
- Timestamp: `2026-05-01T23:41:48.797601+00:00`

## 2) Verified Model Performance Table (Full Run)

Source: `ml-optimization/saved_models/training_metrics_full.json`

| Model | Train Metric | Test Metric | Notes |
|---|---:|---:|---|
| XGBoost predictor | train_r2 = 0.1159 | test_r2 = 0.0786 | train_rmse_ms = 1348.48, test_rmse_ms = 1563.95 |
| Random Forest predictor | train_r2 = 0.1124 | test_r2 = 0.0792 | **Best by test_r2** in this artifact |
| Gradient Boosting predictor | train_r2 = 0.1157 | test_r2 = 0.0791 | Similar to RF/XGB in this run |
| Workload clustering (KMeans) | n_train = 1,980,014 | silhouette = 0.6381 | davies_bouldin = 0.6716 |
| Anomaly detector | n_train = 1,584,011 | n_test = 396,003 | precision_weak = 0.1005, recall_weak = 1.0 |
| Cache predictor | n_train = 319 | n_test = 80 | test_accuracy = 0.9875, test_auc = 0.9937 |

## 3) Verified Model Performance Table (Smoke Run)

Source: `ml-optimization/saved_models/training_metrics_smoke.json`

| Model | Train Metric | Test Metric | Notes |
|---|---:|---:|---|
| XGBoost predictor | train_r2 = 0.4201 | test_r2 = 0.1231 | test_rmse_ms = 7368.75 |
| Random Forest predictor | train_r2 = 0.4070 | test_r2 = 0.1271 | **Best by test_r2** in this artifact |
| Gradient Boosting predictor | train_r2 = 0.4201 | test_r2 = 0.1228 | Near XGB/RF in smoke run |
| Workload clustering (KMeans) | n_train = 5,000 | silhouette = 0.7112 | |
| Anomaly detector | n_train = 4,000 | n_test = 1,000 | precision_weak = 0.0935 |
| Cache predictor | n_train = 99 | n_test = 25 | test_accuracy = 0.92, test_auc = 1.0 |

## 4) Correct Training Pipeline Description

The all-model training script loads query logs with this filtered query shape:

- `query_text IS NOT NULL`
- `trim(query_text) <> ''`
- `(COALESCE(mean_exec_time_ms, 0) > 0 OR COALESCE(calls, 0) > 0)`
- Ordered by `collected_at DESC`
- Uses `LIMIT` only if `--limit` is passed or env limit is positive

Reference: `scripts/ml-optimization/train_all_models.py`

## 5) Correct Saved Model Filenames (Current Scripts)

From `scripts/ml-optimization/train_all_models.py`, the saved filenames are:

- `workload_clustering.pkl`
- `query_time_predictor.pkl`
- `anomaly_detector.pkl`
- `cache_predictor.pkl`

Note: if report text currently uses names like `cache_predictor_random_forest.pkl` or `anomaly_detector_isolation_forest.pkl`, update it to match current script behavior above.

## 6) Correct API/WebSocket Code Description

Current frontend uses native browser WebSocket with derived URL from API base, not Socket.IO syntax.

### Correct behavior
- API base defaults to: `http://localhost:8000/api/v1`
- WebSocket base inferred from API base (`http -> ws`, `https -> wss`)
- Stream endpoint: `/api/v1/ws/optimization-stream`
- Fallback: HTTP polling when WS reconnect attempts fail

References:
- `dashboard/src/services/api.ts`
- `dashboard/src/hooks/useOptimizationRealtimeWebSocket.ts`

## 7) Correct Report Text (Drop-in)

Use the paragraph below to replace mismatched metric claims:

> Model evaluation was regenerated from the committed artifacts in `ml-optimization/saved_models/`. In the full run (`training_metrics_full.json`), the predictor variants achieved test R² in the range 0.0786 to 0.0792 (best: Random Forest 0.0792), clustering reached silhouette 0.6381 on 1,980,014 rows, anomaly weak-label precision was 0.1005 with recall 1.0, and the cache predictor achieved 98.75% test accuracy with AUC 0.9937 (n_test=80 grouped samples). A smoke run on 5,000 rows (`training_metrics_smoke.json`) is also available for quick verification.

## 8) Data Amount Statement for Methodology Section

Use this exact statement:

> The regenerated training artifacts were produced from **1,980,014 query-log rows** in the full run (`limit_applied=0`) and **5,000 rows** in the smoke run (`limit_applied=5000`), as recorded in `training_metrics_full.json` and `training_metrics_smoke.json`.

## 9) Regeneration Checklist (Before Final PDF)

- Replace all outdated metric values with Section 2/3 values above.
- Replace any inconsistent dataset-size statements with Section 1 and Section 8.
- Replace outdated file names with Section 5 names.
- Replace Socket.IO-style snippet with native WebSocket description in Section 6.
- Fill missing figure captions and ensure all tables use the regenerated values.

