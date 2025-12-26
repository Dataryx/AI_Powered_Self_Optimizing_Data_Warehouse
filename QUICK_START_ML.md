# Quick Start: ML Optimization Workflow

## Prerequisites

1. **PostgreSQL running** with `pg_stat_statements` extension enabled
2. **Data loaded** in Bronze, Silver, and Gold layers
3. **Python dependencies** installed

## Step-by-Step Workflow

### Step 1: Generate Query Workload

Generate and execute realistic query workloads to populate query statistics:

```bash
python scripts/query-workloads/generate_workload.py
```

This will:
- Generate 180 queries (simple, analytical, join)
- Execute queries against the database
- Populate `pg_stat_statements` with statistics

### Step 2: Collect Query Logs

Collect query statistics from PostgreSQL:

**Option A: Using PYTHONPATH**
```powershell
$env:PYTHONPATH="C:\Indominus\College (CSUF)\4th Semester\Final Project\AI-Powered-Self_Optimizing_Data_Warehouse\ml-optimization;$env:PYTHONPATH"
python scripts/ml-optimization/run_query_collection.py
```

**Option B: From ml-optimization directory**
```bash
cd ml-optimization
python -m collectors.query_log_collector
```

This will:
- Collect statistics from `pg_stat_statements`
- Store in `ml_optimization.query_logs` table
- Extract query features

### Step 3: Analyze Workload

Analyze collected query logs:

```powershell
$env:PYTHONPATH="C:\Indominus\College (CSUF)\4th Semester\Final Project\AI-Powered-Self_Optimizing_Data_Warehouse\ml-optimization;$env:PYTHONPATH"
python scripts/ml-optimization/run_workload_analysis.py
```

This will:
- Extract query features
- Identify patterns
- Classify workload types
- Generate summary

### Step 4: Verify Data Collection

Check collected query logs:

```sql
-- Connect to database
docker-compose exec postgres psql -U postgres -d datawarehouse

-- Check query logs
SELECT COUNT(*) FROM ml_optimization.query_logs;
SELECT * FROM ml_optimization.query_logs LIMIT 10;
```

## Troubleshooting

### Module Import Errors

If you get `ModuleNotFoundError: No module named 'ml_optimization'`:

1. Set PYTHONPATH:
   ```powershell
   $env:PYTHONPATH="C:\Indominus\College (CSUF)\4th Semester\Final Project\AI-Powered-Self_Optimizing_Data_Warehouse\ml-optimization;$env:PYTHONPATH"
   ```

2. Or run from project root with module path:
   ```bash
   python -m ml_optimization.collectors.query_log_collector
   ```

### Schema Not Found

If `ml_optimization.query_logs` doesn't exist:
- The schema and tables are created automatically by `QueryLogCollector`
- Run the collection script once to initialize

### No Query Statistics

If `pg_stat_statements` is empty:
- Ensure extension is enabled: `CREATE EXTENSION pg_stat_statements;`
- Run queries first to populate statistics
- Check PostgreSQL configuration

## Next Steps

After collecting query logs:

1. **Train ML Models**
   - Workload clustering
   - Query time prediction
   - Anomaly detection

2. **Generate Recommendations**
   - Index recommendations
   - Partition recommendations
   - Cache recommendations

3. **Start ML Optimization API**
   - Serve recommendations
   - Real-time analysis
   - Integration with dashboard

## Status

✅ Query workload generator: Working
✅ Query log collection: Ready (requires PYTHONPATH)
✅ Workload analysis: Ready (requires PYTHONPATH)
⏳ ML model training: Next step

