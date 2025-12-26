#!/bin/bash
# Health Check All Services Script

set -e

echo "=== Health Check All Services ==="

check_service() {
    local name=$1
    local url=$2
    
    echo -n "Checking $name... "
    if curl -f -s "$url" > /dev/null 2>&1; then
        echo "✓ Healthy"
        return 0
    else
        echo "✗ Unhealthy"
        return 1
    fi
}

# Check services
ERRORS=0

check_service "PostgreSQL" "http://localhost:5432" || ERRORS=$((ERRORS + 1))
check_service "Redis" "http://localhost:6379" || ERRORS=$((ERRORS + 1))
check_service "API Gateway" "http://localhost:8000/health" || ERRORS=$((ERRORS + 1))
check_service "ML Service" "http://localhost:8001/health" || ERRORS=$((ERRORS + 1))
check_service "Dashboard" "http://localhost:3000" || ERRORS=$((ERRORS + 1))
check_service "Prometheus" "http://localhost:9090/-/healthy" || ERRORS=$((ERRORS + 1))
check_service "Grafana" "http://localhost:3001/api/health" || ERRORS=$((ERRORS + 1))

echo ""
if [ $ERRORS -eq 0 ]; then
    echo "=== All Services Healthy ==="
    exit 0
else
    echo "=== $ERRORS Service(s) Unhealthy ==="
    exit 1
fi

