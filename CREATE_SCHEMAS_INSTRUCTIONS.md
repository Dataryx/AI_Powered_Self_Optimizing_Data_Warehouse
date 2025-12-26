# Instructions to Create Database Schemas

## Step 1: Start PostgreSQL

You need PostgreSQL running before creating schemas. Choose one option:

### Option A: Using Docker Compose (if you have docker-compose.yml)

```powershell
# Navigate to project root
cd "C:\Indominus\College (CSUF)\4th Semester\Final Project\AI-Powered-Self_Optimizing_Data_Warehouse"

# Start PostgreSQL
docker-compose up -d postgres

# Wait a few seconds for it to start
Start-Sleep -Seconds 10
```

### Option B: If PostgreSQL is installed locally

Ensure PostgreSQL service is running:
```powershell
# Check if PostgreSQL service is running
Get-Service postgresql*

# If not running, start it (adjust service name if needed)
Start-Service postgresql-x64-15
```

### Option C: If PostgreSQL is on a different host/port

Update the connection settings in the script or set environment variables:
```powershell
$env:POSTGRES_HOST="your-host"
$env:POSTGRES_PORT="5432"
$env:POSTGRES_DB="datawarehouse"
$env:POSTGRES_USER="postgres"
$env:POSTGRES_PASSWORD="postgres"
```

## Step 2: Create Database (if it doesn't exist)

```powershell
# Connect to PostgreSQL and create database
psql -U postgres -h localhost
CREATE DATABASE datawarehouse;
\q
```

Or if using Docker:
```powershell
docker-compose exec postgres psql -U postgres -c "CREATE DATABASE datawarehouse;"
```

## Step 3: Run Schema Creation Script

```powershell
# Navigate to project root
cd "C:\Indominus\College (CSUF)\4th Semester\Final Project\AI-Powered-Self_Optimizing_Data_Warehouse"

# Run the schema creation script
python scripts\data-warehouse\create_schemas.py
```

## Expected Output

You should see output like:

```
Connecting to database...
Creating schemas...
✓ Schemas created
Creating bronze.raw_orders...
  ✓ raw_orders
Creating bronze.raw_products...
  ✓ raw_products
... (continues for all 21 tables)
✓ All schemas created successfully!
```

## Step 4: Verify Schemas Created

```powershell
# Connect to database
psql -U postgres -d datawarehouse

# Or using Docker
docker-compose exec postgres psql -U postgres -d datawarehouse
```

Then run:
```sql
-- List all tables
SELECT schemaname, tablename 
FROM pg_tables 
WHERE schemaname IN ('bronze', 'silver', 'gold')
ORDER BY schemaname, tablename;

-- Should show 21 tables:
-- 7 bronze tables
-- 7 silver tables  
-- 7 gold tables
```

## Troubleshooting

### "Connection refused" error
- Ensure PostgreSQL is running (see Step 1)
- Check if port 5432 is accessible
- Verify connection credentials

### "Database does not exist" error
- Create the database first (see Step 2)

### "Permission denied" error
- Ensure user has CREATE privileges
- Check database user permissions

### Script file not found
- Ensure you're in the project root directory
- Check that `scripts/data-warehouse/create_schemas.py` exists

## Next Steps

After schemas are successfully created:

1. Generate and load data:
   ```powershell
   cd data-generator
   python main.py --load
   ```

2. Or use the Makefile:
   ```powershell
   make load-data
   ```

