# Store Procedure Utilities

This folder contains:

- `order_report_procedures.sql`
  - `ml_optimization.sp_generate_orders_report(p_days)`
  - `ml_optimization.sp_generate_orders_workload(p_runs)`
- `run_query_or_procedure.py`
  - Runs any SQL text N times, then executes one query-log collection pass.

## 1) Create procedures

Run `order_report_procedures.sql` against your warehouse DB.

## 2) Run SQL/procedure repeatedly and capture logs

```powershell
python "store procedure/run_query_or_procedure.py" --sql "CALL ml_optimization.sp_generate_orders_workload(50);" --times 5
```

or:

```powershell
python "store procedure/run_query_or_procedure.py" --sql "SELECT COUNT(*) FROM gold.fact_sales;" --times 100
```

The script runs:
1. your SQL N times,
2. `scripts/ml-optimization/run_query_collection.py` once,
so statements get written into `ml_optimization.query_logs`.
