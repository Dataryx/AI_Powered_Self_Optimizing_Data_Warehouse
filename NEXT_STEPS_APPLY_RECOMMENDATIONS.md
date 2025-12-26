# Next Steps: Apply Recommendations

## Overview

The system has generated 4 optimization recommendations. This document shows how to review and apply them.

## Generated Recommendations

### High Priority (2 recommendations)

1. **silver.orders.order_date**
   - Priority: High
   - Estimated Improvement: 56.26ms reduction
   - Based on: 120 queries
   - SQL: `CREATE INDEX IF NOT EXISTS idx_orders_order_date ON silver.orders(order_date)`

2. **silver.customers.customer_id**
   - Priority: High
   - Estimated Improvement: 59.65ms reduction
   - Based on: 118 queries
   - SQL: `CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON silver.customers(customer_id)`

### Medium Priority (2 recommendations)

3. **silver.products.product_id**
   - Priority: Medium
   - Estimated Improvement: 0.04ms reduction
   - Based on: 337,563 queries
   - SQL: `CREATE INDEX IF NOT EXISTS idx_products_product_id ON silver.products(product_id)`

4. **silver.products.category**
   - Priority: Medium
   - Estimated Improvement: 10.63ms reduction
   - Based on: 16 queries
   - SQL: `CREATE INDEX IF NOT EXISTS idx_products_category ON silver.products(category)`

## Apply Recommendations

### Option 1: Dry Run (Preview)

Preview what would be applied without making changes:

```bash
python scripts/ml-optimization/apply_recommendations.py
```

Or preview only high-priority recommendations:

```bash
python scripts/ml-optimization/apply_recommendations.py --priority high
```

### Option 2: Apply Recommendations

Actually apply the recommendations:

```bash
# Apply all recommendations
python scripts/ml-optimization/apply_recommendations.py --apply

# Apply only high-priority recommendations
python scripts/ml-optimization/apply_recommendations.py --apply --priority high
```

### Option 3: Manual Application

Apply recommendations manually via SQL:

```sql
-- Connect to database
docker-compose exec postgres psql -U postgres -d datawarehouse

-- View recommendations
SELECT sql_statement, priority, estimated_improvement 
FROM ml_optimization.index_recommendations
ORDER BY priority DESC;

-- Apply high-priority recommendations
CREATE INDEX IF NOT EXISTS idx_orders_order_date ON silver.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_customers_customer_id ON silver.customers(customer_id);
```

## Verify Indexes

After applying, verify indexes were created:

```sql
-- Check indexes on silver schema
SELECT 
    tablename, 
    indexname, 
    indexdef
FROM pg_indexes 
WHERE schemaname = 'silver'
ORDER BY tablename, indexname;
```

## Monitor Performance

After applying recommendations:

1. **Run Query Workload Again**
   ```bash
   python scripts/query-workloads/generate_workload.py
   ```

2. **Collect Query Logs**
   ```powershell
   $env:PYTHONPATH="C:\Indominus\College (CSUF)\4th Semester\Final Project\AI-Powered-Self_Optimizing_Data_Warehouse\ml-optimization;$env:PYTHONPATH"
   python scripts/ml-optimization/run_query_collection.py
   ```

3. **Compare Performance**
   ```sql
   -- Compare before/after execution times
   SELECT 
       query_template,
       calls,
       mean_exec_time_ms,
       collected_at
   FROM ml_optimization.query_logs
   WHERE query_template LIKE '%order_date%'
   ORDER BY collected_at DESC;
   ```

## Recommendation Status

Track recommendation status in the database:

```sql
-- View recommendation status
SELECT 
    recommendation_id,
    table_name,
    column_name,
    priority,
    status,
    applied_at,
    estimated_improvement
FROM ml_optimization.index_recommendations
ORDER BY priority DESC, query_count DESC;
```

## Next Steps After Applying

1. **Measure Performance Impact**
   - Run benchmarks before/after
   - Compare query execution times
   - Monitor system resource usage

2. **Generate More Recommendations**
   - Collect more query logs
   - Run recommendation generator again
   - Identify new optimization opportunities

3. **Train ML Models**
   - Use collected query logs
   - Train clustering models
   - Train prediction models
   - Generate advanced recommendations

4. **Start Monitoring Dashboard**
   - Launch React dashboard
   - View real-time metrics
   - Monitor optimization effectiveness

## Notes

- **Index Creation**: Indexes are created with `IF NOT EXISTS` to avoid errors if already present
- **Performance Impact**: Creating indexes may take time on large tables
- **Storage**: Indexes require additional disk space
- **Maintenance**: Indexes are automatically maintained by PostgreSQL

## Status

✅ Recommendations Generated: 4 recommendations
⏳ Recommendations Applied: Ready to apply
📊 Performance Monitoring: Ready to measure

---

**Recommendation**: Start with high-priority recommendations and measure the impact before applying medium-priority ones.

