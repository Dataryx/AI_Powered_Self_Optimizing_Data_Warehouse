# Quick Start: Creating Database Schemas

## Prerequisites

1. **PostgreSQL must be running**
   ```bash
   # Check if running
   docker-compose ps postgres
   
   # If not running, start it
   docker-compose up -d postgres
   ```

2. **Python dependencies installed**
   ```bash
   pip install psycopg2-binary
   ```

## Method 1: Using Python Script (Recommended)

From the project root directory:

```bash
# Navigate to project root
cd "C:\Indominus\College (CSUF)\4th Semester\Final Project\AI-Powered-Self_Optimizing_Data_Warehouse"

# Run the schema creation script
python scripts/data-warehouse/create_schemas.py
```

Or if you need to specify connection details:

```bash
# Set environment variables
$env:POSTGRES_HOST="localhost"
$env:POSTGRES_PORT="5432"
$env:POSTGRES_DB="datawarehouse"
$env:POSTGRES_USER="postgres"
$env:POSTGRES_PASSWORD="postgres"

# Run script
python scripts/data-warehouse/create_schemas.py
```

## Method 2: Using psql Directly

If you have psql installed:

```bash
# Connect to database
psql -h localhost -U postgres -d datawarehouse

# Then run:
CREATE SCHEMA IF NOT EXISTS bronze;
CREATE SCHEMA IF NOT EXISTS silver;
CREATE SCHEMA IF NOT EXISTS gold;
CREATE SCHEMA IF NOT EXISTS ml_optimization;

# Then execute each SQL file in order:
\i data-warehouse/schemas/bronze/raw_orders.sql
\i data-warehouse/schemas/bronze/raw_products.sql
\i data-warehouse/schemas/bronze/raw_customers.sql
\i data-warehouse/schemas/bronze/raw_inventory.sql
\i data-warehouse/schemas/bronze/raw_clickstream.sql
\i data-warehouse/schemas/bronze/raw_reviews.sql
\i data-warehouse/schemas/bronze/raw_sessions.sql

\i data-warehouse/schemas/silver/customers.sql
\i data-warehouse/schemas/silver/products.sql
\i data-warehouse/schemas/silver/orders.sql
\i data-warehouse/schemas/silver/order_items.sql
\i data-warehouse/schemas/silver/inventory_snapshots.sql
\i data-warehouse/schemas/silver/user_events.sql
\i data-warehouse/schemas/silver/product_reviews.sql

\i data-warehouse/schemas/gold/daily_sales_summary.sql
\i data-warehouse/schemas/gold/customer_360.sql
\i data-warehouse/schemas/gold/product_performance.sql
\i data-warehouse/schemas/gold/inventory_health.sql
\i data-warehouse/schemas/gold/conversion_funnel.sql
\i data-warehouse/schemas/gold/cohort_analysis.sql
\i data-warehouse/schemas/gold/real_time_dashboard.sql
```

## Method 3: Using Docker Exec

If PostgreSQL is running in Docker:

```bash
# Execute SQL files directly
docker-compose exec postgres psql -U postgres -d datawarehouse -f /path/to/sql/file.sql

# Or connect to container and run commands
docker-compose exec postgres psql -U postgres -d datawarehouse
```

## Verification

After creating schemas, verify they were created:

```sql
-- List all tables
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname IN ('bronze', 'silver', 'gold')
ORDER BY schemaname, tablename;

-- Should show 21 tables total (7 bronze + 7 silver + 7 gold)
```

## Troubleshooting

### Connection Error
- Ensure PostgreSQL is running: `docker-compose ps postgres`
- Check connection settings match your environment
- Verify database exists: `docker-compose exec postgres psql -U postgres -l`

### Permission Error
- Ensure you're using the correct user (postgres)
- Check user has CREATE privileges

### File Not Found
- Ensure you're running from the project root directory
- Check that SQL files exist in `data-warehouse/schemas/`

## Next Steps

After schemas are created:

1. Generate and load data:
   ```bash
   make load-data
   ```

2. Or manually:
   ```bash
   cd data-generator
   python main.py --load
   ```

