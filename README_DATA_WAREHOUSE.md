# Data Warehouse Setup Guide

## Overview

This guide describes how to set up and populate the data warehouse with realistic data before optimization work begins.

## Architecture

The data warehouse uses a **Medallion Architecture** with three layers:

- **Bronze Layer**: Raw, unprocessed data from source systems
- **Silver Layer**: Cleaned, validated data with SCD Type 2 dimensions
- **Gold Layer**: Pre-aggregated business-ready analytics tables

## Schema Creation

### Automatic Setup

Create all schemas automatically:

```bash
# Using Python script
make create-schemas

# Or using psql
make create-schemas-psql
```

### Manual Setup

If you prefer to create schemas manually:

1. **Create schemas**:
   ```sql
   CREATE SCHEMA IF NOT EXISTS bronze;
   CREATE SCHEMA IF NOT EXISTS silver;
   CREATE SCHEMA IF NOT EXISTS gold;
   ```

2. **Execute schema files in order**:
   - Bronze layer: `data-warehouse/schemas/bronze/*.sql`
   - Silver layer: `data-warehouse/schemas/silver/*.sql` (order matters due to foreign keys)
   - Gold layer: `data-warehouse/schemas/gold/*.sql`

## Tables Overview

### Bronze Layer (7 tables)
- `raw_orders` - Raw order data (partitioned by month)
- `raw_products` - Raw product catalog
- `raw_customers` - Raw customer data
- `raw_inventory` - Raw inventory movements (partitioned by month)
- `raw_clickstream` - Raw clickstream events (partitioned by day)
- `raw_reviews` - Raw product reviews
- `raw_sessions` - Raw user sessions

### Silver Layer (7 tables)
- `customers` - Customer dimension (SCD Type 2)
- `products` - Product dimension (SCD Type 2)
- `orders` - Orders fact table (partitioned by month)
- `order_items` - Order line items
- `inventory_snapshots` - Daily inventory snapshots (partitioned by month)
- `user_events` - Cleaned clickstream events (partitioned by day)
- `product_reviews` - Cleaned product reviews

### Gold Layer (7 tables)
- `daily_sales_summary` - Daily sales aggregations
- `customer_360` - Comprehensive customer analytics
- `product_performance` - Product performance metrics
- `inventory_health` - Inventory health metrics
- `conversion_funnel` - Conversion funnel metrics
- `cohort_analysis` - Customer cohort analysis
- `real_time_dashboard` - Real-time dashboard metrics

## Data Generation

### Generate Sample Data

The data generator creates realistic e-commerce data:

```bash
# Generate data (configure in data-generator/config.py)
make generate-data

# Or directly
python -m data_generator.main
```

### Data Volumes

Recommended initial data volumes:
- **Customers**: 10,000 - 100,000
- **Products**: 1,000 - 10,000
- **Orders**: 100,000 - 1,000,000
- **Order Items**: 300,000 - 3,000,000
- **Clickstream Events**: 1,000,000 - 10,000,000

## ETL Pipeline

### Load Bronze Data

Load raw data into Bronze layer:

```bash
# Using ETL scripts
python -m etl.loaders.bronze_loader
```

### Transform Bronze to Silver

Transform and clean Bronze data to Silver:

```bash
# Using Airflow DAGs
# Or directly
python -m etl.transformers.bronze_to_silver
```

### Aggregate Silver to Gold

Aggregate Silver data to Gold:

```bash
# Using Airflow DAGs
# Or directly
python -m etl.aggregators.silver_to_gold
```

## Verification

### Check Schema Creation

```sql
-- List all tables
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname IN ('bronze', 'silver', 'gold')
ORDER BY schemaname, tablename;

-- Check row counts
SELECT 
    'bronze' as layer,
    schemaname || '.' || tablename as table_name,
    (SELECT COUNT(*) FROM information_schema.tables t 
     WHERE t.table_schema = schemaname 
     AND t.table_name = tablename) as row_count
FROM pg_tables
WHERE schemaname = 'bronze';
```

### Verify Data Quality

```sql
-- Check for NULL values in critical columns
SELECT COUNT(*) as null_count
FROM silver.orders
WHERE customer_sk IS NULL OR total_amount IS NULL;

-- Check data ranges
SELECT 
    MIN(order_date) as earliest_order,
    MAX(order_date) as latest_order,
    COUNT(DISTINCT customer_sk) as unique_customers
FROM silver.orders;
```

## Partitioning

Several tables are partitioned for performance:

- **Monthly partitions**: `raw_orders`, `raw_inventory`, `orders`, `inventory_snapshots`
- **Daily partitions**: `raw_clickstream`, `user_events`

Partitions are created automatically when data is loaded. To manually create partitions:

```sql
-- Example: Create monthly partition for orders
CREATE TABLE silver.orders_2024_01 PARTITION OF silver.orders
    FOR VALUES FROM ('2024-01-01') TO ('2024-02-01');
```

## Indexes

Indexes are created automatically with the schemas. Key indexes:

- **Primary keys**: All tables
- **Foreign keys**: All foreign key columns
- **Date columns**: All date/timestamp columns used in WHERE clauses
- **SCD Type 2**: Composite indexes on (natural_key, valid_to) for current record lookups
- **JSONB columns**: GIN indexes on JSONB columns
- **Full-text search**: GIN indexes on text columns for full-text search

## Next Steps

Once the data warehouse is set up with realistic data:

1. **Run Sample Queries**: Test query performance
2. **Generate Query Patterns**: Run various analytical queries
3. **Begin Optimization**: Start ML optimization work
4. **Monitor Performance**: Track query execution times

## Troubleshooting

### Schema Creation Errors

If you encounter errors during schema creation:

1. Check PostgreSQL version (requires 12+)
2. Verify extensions are installed:
   ```sql
   CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
   CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
   ```
3. Check for existing tables and drop if needed:
   ```sql
   DROP SCHEMA IF EXISTS bronze CASCADE;
   DROP SCHEMA IF EXISTS silver CASCADE;
   DROP SCHEMA IF EXISTS gold CASCADE;
   ```

### Partition Errors

If partition creation fails:

1. Ensure the parent table exists
2. Check partition key data types match
3. Verify date ranges don't overlap

### Foreign Key Errors

If foreign key constraints fail:

1. Ensure dimension tables (customers, products) are created before fact tables
2. Verify surrogate keys exist before inserting references
3. Check that current records (is_current = TRUE) exist in dimensions

## Documentation

- [Data Model Documentation](docs/architecture/data-model.md)
- [ETL Documentation](docs/etl/README.md)
- [Data Generator Documentation](data-generator/README.md)

