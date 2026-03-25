# Logs for Both ETL Jobs

## 1. Complete ETL Pipeline

| Where | Path / Source |
|-------|----------------|
| **Log file** | `etl/scripts/etl_pipeline.log` |
| **Console** | Same messages go to stdout when you run `python etl/scripts/run_etl.py` |
| **DB run history** | `monitoring.job_runs` (job_name from `monitoring.etl_jobs`; run_id, started_at, completed_at, status, records_processed, error_message) |

View recent pipeline log lines (PowerShell):

```powershell
Get-Content "etl\scripts\etl_pipeline.log" -Tail 100
```

---

## 2. BRONZE - Shopping Orders Ingestion

| Where | Path / Source |
|-------|----------------|
| **Log file** | `etl/scripts/shopping_ingestion.log` |
| **Console** | Same messages when you run `python etl/scripts/populate_bronze_shopping_every_minute.py` or `... --once` |
| **DB run history** | `monitoring.job_runs` (same table; filter by job_id for this job) |

View recent shopping log lines (PowerShell):

```powershell
Get-Content "etl\scripts\shopping_ingestion.log" -Tail 100
```

---

## 3. Job scheduler (when you run it)

When you run `python etl/scheduler/job_scheduler.py`, it writes to:

- **Log file:** `etl/scheduler/logs/job_scheduler.log`  
  (scheduler ticks, which jobs were dispatched, errors)

---

## 4. Dashboard / API (run history for both jobs)

- **Recent ETL Runs** on the Monitoring dashboard uses `GET /api/v1/monitoring/etl/jobs`, which reads from `monitoring.job_runs` joined with `monitoring.etl_jobs`.
- So both jobs’ run history (start time, end time, status, records) is visible there when the tracker writes to `job_runs`.

---

## Quick reference

| Job | Log file |
|-----|----------|
| Complete ETL Pipeline | `etl/scripts/etl_pipeline.log` |
| BRONZE - Shopping Orders Ingestion | `etl/scripts/shopping_ingestion.log` |
| Scheduler (if used) | `etl/scheduler/logs/job_scheduler.log` |
