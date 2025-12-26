#!/bin/bash
# Start All Services Script
# Starts all services with proper dependency ordering

set -e

echo "=== Starting All Services ==="

# Start base services first
echo "Starting base services (PostgreSQL, Redis)..."
docker-compose up -d postgres redis

# Wait for base services to be healthy
echo "Waiting for base services..."
sleep 10

# Start monitoring services
echo "Starting monitoring services..."
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Wait for monitoring
sleep 5

# Start ML service
echo "Starting ML optimization service..."
docker-compose -f docker-compose.yml -f docker-compose.integration.yml up -d ml-service

# Wait for ML service
sleep 10

# Start API gateway
echo "Starting API gateway..."
docker-compose -f docker-compose.yml -f docker-compose.integration.yml up -d api-gateway

# Wait for API gateway
sleep 5

# Start dashboard
echo "Starting monitoring dashboard..."
docker-compose -f docker-compose.yml -f docker-compose.integration.yml up -d dashboard

# Start Airflow (optional, for ETL)
if [ "$1" == "--with-etl" ]; then
    echo "Starting Airflow services..."
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d airflow-init
    sleep 10
    docker-compose -f docker-compose.yml -f docker-compose.dev.yml up -d airflow-webserver airflow-scheduler
fi

echo "=== All Services Started ==="
echo ""
echo "Services are available at:"
echo "  - Dashboard: http://localhost:3000"
echo "  - API Gateway: http://localhost:8000"
echo "  - ML Service: http://localhost:8001"
echo "  - Grafana: http://localhost:3001"
echo "  - Prometheus: http://localhost:9090"
echo "  - Airflow: http://localhost:8081 (if started with --with-etl)"

docker-compose ps

