# ETL Cron Job and Dashboard Monitoring

This document explains how to run the ETL pipeline on a schedule (cron or Task Scheduler) and how the **Data Warehouse Dashboard** shows **Recent ETL Runs**, **ETL metrics**, and **Errors & Retries**.

---

## How It Works

1. **ETL runs** (manually or via cron) execute `etl/scripts/run_etl.py`. The pipeline uses `ETLJobTracker` from `ml_optimization` to write each job’s status (start, progress, completion/failure) into the **`monitoring.etl_jobs`** table in PostgreSQL.
2. The **ML Optimization API** exposes:
   - `GET /api/v1/monitoring/etl/jobs` → recent jobs (Recent ETL Runs)
   - `GET /api/v1/monitoring/etl/throughput` → throughput metrics
   - `GET /api/v1/monitoring/etl/errors` → failed jobs and errors (Errors & Retries)
3. The **Dashboard** (Monitoring page) calls these endpoints and displays:
   - **Recent ETL Runs** – last 24 hours of jobs (status, type)
   - **ETL metrics** – stats, duration, throughput
   - **Errors & Retries** – failed runs and error messages

So: **schedule the ETL with cron (or Task Scheduler), keep the API and DB running, and the dashboard will show live ETL data.**

---

## 1. Run ETL as a Scheduled Job (Cron / Task Scheduler)

### Option A: Linux / macOS (cron)

1. Make the script executable:
   ```bash
   chmod +x etl/scripts/run_etl_cron.sh
   ```

2. From the **project root**, run once to test:
   ```bash
   ./etl/scripts/run_etl_cron.sh
   ```
   Optional: `./etl/scripts/run_etl_cron.sh --batch-size 2000`

3. Add a cron job (edit with `crontab -e`). Use the **absolute path** to the project and script.

   Every 5 minutes:
   ```cron
   */5 * * * * /absolute/path/to/AI-Powered-Self_Optimizing_Data_Warehouse/etl/scripts/run_etl_cron.sh >> /var/log/etl_cron.log 2>&1
   ```

   Every hour at minute 0:
   ```cron
   0 * * * * /absolute/path/to/AI-Powered-Self_Optimizing_Data_Warehouse/etl/scripts/run_etl_cron.sh >> /var/log/etl_cron.log 2>&1
   ```

   Replace `/absolute/path/to/AI-Powered-Self_Optimizing_Data_Warehouse` with your real project path.

### Option B: Windows (Task Scheduler)

1. Open **Task Scheduler** → Create Basic Task.
2. Set trigger (e.g. every 5 minutes or daily).
3. Action: **Start a program**
   - **Program:** `powershell.exe`
   - **Arguments:**  
     `-NoProfile -ExecutionPolicy Bypass -File "C:\path\to\AI-Powered-Self_Optimizing_Data_Warehouse\etl\scripts\run_etl_cron.ps1"`
   - Use the real path to `run_etl_cron.ps1`.
4. Optional: set “Start in” to the project root.

You can also run the PowerShell script manually from the project root:
```powershell
.\etl\scripts\run_etl_cron.ps1
.\etl\scripts\run_etl_cron.ps1 -BatchSize 2000
```

### Option C: In-process scheduler (no cron)

To run ETL every 5 minutes in a single long-lived process (any OS):

```bash
# From project root
python -m etl.scripts.run_etl_every_5_minutes
```

Or:
```bash
python etl/scripts/run_etl_every_5_minutes.py
```

This loop runs the full ETL every 5 minutes; each run is still written to `monitoring.etl_jobs` and shown on the dashboard.

### Option D: Table-driven scheduler (both jobs from monitoring.etl_jobs)

Jobs and schedules are stored in **`monitoring.etl_jobs`** (cron_pattern, active_status). There is **no 60-second background check**. You run the scheduler once per tick (e.g. via Task Scheduler every 1 or 2 minutes); it checks which jobs are due and starts them, then exits:

```bash
# From project root – run once (e.g. from Task Scheduler every 1–2 minutes)
python etl/scheduler/run_scheduler_loop.py
```

- **Complete ETL Pipeline** (active, cron e.g. `*/2 * * * *`) → runs `run_etl.py` when the tick matches.
- **BRONZE - Shopping Orders Ingestion** (active, cron `*/1 * * * *`) → runs one shopping insert when the tick matches.

Set **active_status = 'I'** to stop a job completely. Child processes run without opening console windows on Windows.

---

## 2. What the Dashboard Shows

- **Recent ETL Runs**  
  Data from `GET /api/v1/monitoring/etl/jobs` (last 24 hours from `monitoring.etl_jobs`). Shows job type, status (running/completed/failed).

- **ETL metrics (stats row)**  
  Same jobs plus freshness and errors: active pipelines, failed runs in last 24h, freshness SLA, average ETL duration, etc.

- **Throughput**  
  From `GET /api/v1/monitoring/etl/throughput` (records per second from completed jobs in `monitoring.etl_jobs`).

- **Errors & Retries**  
  From `GET /api/v1/monitoring/etl/errors`: failed jobs in the last 7 days, with error message and time (`occurred_at`).

---

## 3. Requirements for Data to Appear

1. **Database**  
   PostgreSQL must be running with the data warehouse schemas (bronze, silver, gold) and the **monitoring** schema. The ETL script (via `ETLJobTracker`) creates `monitoring.etl_jobs` if it does not exist.

2. **ML Optimization API**  
   The FastAPI app that serves `/api/v1/monitoring/...` must be running (e.g. `uvicorn` from the `ml-optimization` project) and configured to use the same database.

3. **Dashboard**  
   The dashboard must be configured with the API base URL (e.g. `VITE_API_BASE_URL=http://localhost:8000/api/v1`). It polls the monitoring endpoints; no extra setup is needed for Recent ETL Runs, ETL metrics, or Errors & Retries once the API and ETL are running.

---

## 4. Quick Checklist

| Step | Action |
|------|--------|
| 1 | Ensure PostgreSQL is up and the warehouse + monitoring schemas exist. |
| 2 | Run ETL at least once: `./etl/scripts/run_etl_cron.sh` or `python etl/scripts/run_etl.py`. |
| 3 | Start the ML Optimization API (e.g. from `ml-optimization`: `uvicorn api.main:app --reload`). |
| 4 | Open the Dashboard Monitoring page; you should see Recent ETL Runs, ETL metrics, and Errors & Retries. |
| 5 | Add cron or Task Scheduler to run `run_etl_cron.sh` / `run_etl_cron.ps1` on your desired schedule. |

After that, each scheduled ETL run will be recorded and reflected on the dashboard automatically.
