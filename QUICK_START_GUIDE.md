# Quick Start Guide

This guide will get you up and running with the AI-Powered Self-Optimizing Data Warehouse in minutes.

## 🚀 Step-by-Step Setup

### Step 1: Start Core Services

```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Wait for services to be ready (about 10 seconds)
```

### Step 2: Create Database Schemas

```bash
python scripts/data-warehouse/create_schemas.py
```

### Step 3: Generate and Load Data

```bash
cd data-generator
python main.py --load
cd ..
```

This will generate and load:
- 10,000 customers
- 5,000 products
- 112,501 orders
- 337,563 order items
- Plus inventory, reviews, sessions, and clickstream data

### Step 4: Run ETL Pipeline

```bash
python etl/scripts/run_etl.py
```

This transforms:
- Bronze → Silver (cleaned data)
- Silver → Gold (aggregated analytics)

### Step 5: Generate Query Workload

```bash
python scripts/query-workloads/generate_workload.py
```

### Step 6: Collect Query Logs

**Windows PowerShell:**
```powershell
$env:PYTHONPATH="$PWD\ml-optimization;$env:PYTHONPATH"
python scripts/ml-optimization/run_query_collection.py
```

**Linux/Mac:**
```bash
export PYTHONPATH="$(pwd)/ml-optimization:$PYTHONPATH"
python scripts/ml-optimization/run_query_collection.py
```

### Step 7: Generate Recommendations

```bash
python scripts/ml-optimization/generate_recommendations.py
```

View recommendations:
```sql
docker-compose exec postgres psql -U postgres -d datawarehouse -c "
SELECT table_name, column_name, priority, estimated_improvement, query_count 
FROM ml_optimization.index_recommendations 
ORDER BY priority DESC;"
```

### Step 8: Train ML Models

```bash
python scripts/ml-optimization/train_models_simple.py
```

### Step 9: Run Performance Tests

```bash
python scripts/performance_testing/run_performance_tests.py
```

### Step 10: Approve and Apply Recommendations (Optional)

1. **Create approval file** (`approvals.json`):
   ```json
   [
     {
       "recommendation_id": 2,
       "approved_by": "admin",
       "notes": "Approved for testing"
     },
     {
       "recommendation_id": 3,
       "approved_by": "admin",
       "notes": "Approved for testing"
     }
   ]
   ```

2. **Apply approved recommendations**:
   ```bash
   python scripts/ml-optimization/approve_and_apply_recommendations.py --approval-file approvals.json
   ```

## ✅ Verification

### Check Data Warehouse Status

```sql
-- Bronze Layer
SELECT COUNT(*) FROM bronze.raw_customers;      -- Should be 10,000
SELECT COUNT(*) FROM bronze.raw_products;       -- Should be 5,000
SELECT COUNT(*) FROM bronze.raw_orders;         -- Should be 112,501

-- Silver Layer
SELECT COUNT(*) FROM silver.customers;          -- Should be 10,000
SELECT COUNT(*) FROM silver.products;           -- Should be 5,000
SELECT COUNT(*) FROM silver.orders;             -- Should be 112,501

-- Gold Layer
SELECT COUNT(*) FROM gold.daily_sales_summary;  -- Should be 30
SELECT COUNT(*) FROM gold.customer_360;         -- Should be 10,000
SELECT COUNT(*) FROM gold.product_performance;  -- Should be 5,000
```

### Check ML Optimization Status

```sql
-- Query Logs
SELECT COUNT(*) FROM ml_optimization.query_logs;  -- Should be 893+

-- Recommendations
SELECT COUNT(*) FROM ml_optimization.index_recommendations;  -- Should be 4

-- Performance Tests
SELECT COUNT(*) FROM ml_optimization.performance_test_results;  -- Should be 5+
```

### Check ML Models

```bash
ls ml-optimization/saved_models/
# Should see:
# - workload_clustering_simple.pkl
# - query_time_predictor_simple.pkl
```

## 🎯 Common Commands

### View Recommendations
```bash
docker-compose exec postgres psql -U postgres -d datawarehouse -c "
SELECT recommendation_id, table_name, column_name, priority, estimated_improvement 
FROM ml_optimization.index_recommendations 
ORDER BY priority DESC, query_count DESC;"
```

### View Performance Test Results
```sql
SELECT 
    test_name,
    AVG(execution_time_ms) as avg_time_ms,
    MIN(execution_time_ms) as min_time_ms,
    MAX(execution_time_ms) as max_time_ms,
    test_run_id
FROM ml_optimization.performance_test_results
GROUP BY test_name, test_run_id
ORDER BY test_run_id DESC;
```

### View Approved Recommendations
```sql
SELECT 
    r.recommendation_id,
    r.table_name,
    r.column_name,
    a.status,
    a.approved_by,
    a.approved_at,
    a.applied_at
FROM ml_optimization.index_recommendations r
LEFT JOIN ml_optimization.recommendation_approvals a 
    ON r.recommendation_id = a.recommendation_id
ORDER BY a.approved_at DESC;
```

## 🔧 Troubleshooting

### Services Not Starting

```bash
# Check service status
docker-compose ps

# View logs
docker-compose logs postgres
docker-compose logs redis

# Restart services
docker-compose restart
```

### Python Import Errors

**Windows:**
```powershell
$env:PYTHONPATH="$PWD\ml-optimization;$env:PYTHONPATH"
```

**Linux/Mac:**
```bash
export PYTHONPATH="$(pwd)/ml-optimization:$PYTHONPATH"
```

### Database Connection Issues

```bash
# Check if PostgreSQL is running
docker-compose exec postgres pg_isready -U postgres

# Test connection
docker-compose exec postgres psql -U postgres -d datawarehouse -c "SELECT 1;"
```

### No Query Logs

Ensure `pg_stat_statements` is enabled:
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```

Run queries first before collecting logs.

## 📊 Next Steps

1. **Explore the Dashboard**: Start the monitoring dashboard (when configured)
2. **Generate More Recommendations**: Run more query workloads and collect logs
3. **Fine-tune ML Models**: Train models with more data for better predictions
4. **Monitor Performance**: Set up continuous performance monitoring
5. **Customize Recommendations**: Adjust recommendation algorithms for your use case

## 🎉 Success!

If you've completed all steps, you now have:
- ✅ Fully populated data warehouse (7.3M+ records)
- ✅ Complete ETL pipeline working
- ✅ Query logs collected (893+ records)
- ✅ ML models trained (clustering, prediction)
- ✅ Optimization recommendations generated (4 recommendations)
- ✅ Performance tests completed

**Your AI-Powered Self-Optimizing Data Warehouse is ready!**

---

For detailed documentation, see:
- `README.md` - Full documentation
- `PROJECT_STATUS_COMPLETE.md` - Project status
- `docs/` - Detailed guides

