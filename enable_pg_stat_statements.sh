#!/bin/bash
# Enable pg_stat_statements in PostgreSQL container

echo "Enabling pg_stat_statements in PostgreSQL..."

# Update postgresql.conf in the container
docker exec -i dw_postgres sh << 'EOF'
# Check if shared_preload_libraries is already set
if grep -q "shared_preload_libraries" /var/lib/postgresql/data/postgresql.conf; then
    echo "Updating existing shared_preload_libraries setting..."
    sed -i "s/^#shared_preload_libraries = .*/shared_preload_libraries = 'pg_stat_statements'/" /var/lib/postgresql/data/postgresql.conf
    sed -i "s/^shared_preload_libraries = .*/shared_preload_libraries = 'pg_stat_statements'/" /var/lib/postgresql/data/postgresql.conf
else
    echo "Adding shared_preload_libraries setting..."
    echo "" >> /var/lib/postgresql/data/postgresql.conf
    echo "# Enable pg_stat_statements" >> /var/lib/postgresql/data/postgresql.conf
    echo "shared_preload_libraries = 'pg_stat_statements'" >> /var/lib/postgresql/data/postgresql.conf
    echo "pg_stat_statements.track = all" >> /var/lib/postgresql/data/postgresql.conf
    echo "pg_stat_statements.max = 10000" >> /var/lib/postgresql/data/postgresql.conf
fi

# Verify the setting
echo "Current shared_preload_libraries setting:"
grep "shared_preload_libraries" /var/lib/postgresql/data/postgresql.conf
EOF

echo ""
echo "Configuration updated. PostgreSQL needs to be restarted for changes to take effect."
echo "Run: docker restart dw_postgres"

