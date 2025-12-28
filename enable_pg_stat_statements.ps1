# Enable pg_stat_statements in PostgreSQL container (PowerShell)

Write-Host "Enabling pg_stat_statements in PostgreSQL..." -ForegroundColor Yellow

# Create a temporary script file to run inside the container
$tempScript = @"
# Check if shared_preload_libraries is already set
if grep -q 'shared_preload_libraries' /var/lib/postgresql/data/postgresql.conf; then
    echo 'Updating existing shared_preload_libraries setting...'
    sed -i 's/^#shared_preload_libraries = .*/shared_preload_libraries = pg_stat_statements/' /var/lib/postgresql/data/postgresql.conf
    sed -i 's/^shared_preload_libraries = .*/shared_preload_libraries = pg_stat_statements/' /var/lib/postgresql/data/postgresql.conf
else
    echo 'Adding shared_preload_libraries setting...'
    echo '' >> /var/lib/postgresql/data/postgresql.conf
    echo '# Enable pg_stat_statements' >> /var/lib/postgresql/data/postgresql.conf
    echo 'shared_preload_libraries = pg_stat_statements' >> /var/lib/postgresql/data/postgresql.conf
    echo 'pg_stat_statements.track = all' >> /var/lib/postgresql/data/postgresql.conf
    echo 'pg_stat_statements.max = 10000' >> /var/lib/postgresql/data/postgresql.conf
fi

# Verify the setting
echo 'Current shared_preload_libraries setting:'
grep 'shared_preload_libraries' /var/lib/postgresql/data/postgresql.conf
"@

# Execute the script in the container
docker exec dw_postgres sh -c $tempScript

Write-Host ""
Write-Host "Configuration updated. Restarting PostgreSQL..." -ForegroundColor Yellow
docker restart dw_postgres

Write-Host "Waiting for PostgreSQL to start..." -ForegroundColor Yellow
Start-Sleep -Seconds 10

Write-Host "Creating pg_stat_statements extension..." -ForegroundColor Yellow
docker exec dw_postgres psql -U postgres -d datawarehouse -c "CREATE EXTENSION IF NOT EXISTS pg_stat_statements;"

Write-Host ""
Write-Host "pg_stat_statements is now enabled!" -ForegroundColor Green
Write-Host "You can now run: python scripts/ml-optimization/continuous_query_collection.py" -ForegroundColor Cyan

