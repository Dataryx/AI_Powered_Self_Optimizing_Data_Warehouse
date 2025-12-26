#!/bin/bash
# Start All Services
# Starts all services for the AI-Powered Self-Optimizing Data Warehouse

echo "=========================================="
echo "Starting All Services"
echo "=========================================="

# Start core services (PostgreSQL, Redis)
echo "Starting core services (PostgreSQL, Redis)..."
docker-compose up -d postgres redis

# Wait for services to be ready
echo "Waiting for services to be ready..."
sleep 5

# Check PostgreSQL
echo "Checking PostgreSQL..."
until docker-compose exec -T postgres pg_isready -U postgres > /dev/null 2>&1; do
    echo "Waiting for PostgreSQL..."
    sleep 2
done
echo "✓ PostgreSQL is ready"

# Check Redis
echo "Checking Redis..."
until docker-compose exec -T redis redis-cli ping > /dev/null 2>&1; do
    echo "Waiting for Redis..."
    sleep 2
done
echo "✓ Redis is ready"

# Start ML Optimization Service (if configured)
if [ -f "ml-optimization/Dockerfile" ]; then
    echo "Starting ML Optimization Service..."
    docker-compose up -d ml-service
    echo "✓ ML Service starting"
fi

# Start API Gateway (if configured)
if [ -f "api-gateway/Dockerfile" ]; then
    echo "Starting API Gateway..."
    docker-compose up -d api-gateway
    echo "✓ API Gateway starting"
fi

# Start Monitoring Dashboard (if configured)
if [ -f "monitoring-dashboard/Dockerfile" ]; then
    echo "Starting Monitoring Dashboard..."
    docker-compose up -d dashboard
    echo "✓ Dashboard starting"
fi

# Start Monitoring Stack (if configured)
if docker-compose config | grep -q "prometheus:"; then
    echo "Starting Monitoring Stack (Prometheus, Grafana)..."
    docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d prometheus grafana
    echo "✓ Monitoring stack starting"
fi

echo ""
echo "=========================================="
echo "Service Status"
echo "=========================================="
docker-compose ps

echo ""
echo "=========================================="
echo "Service URLs"
echo "=========================================="
echo "PostgreSQL: localhost:5432"
echo "Redis: localhost:6379"
if docker-compose ps | grep -q "ml-service"; then
    echo "ML Optimization API: http://localhost:8001"
fi
if docker-compose ps | grep -q "api-gateway"; then
    echo "API Gateway: http://localhost:8000"
fi
if docker-compose ps | grep -q "dashboard"; then
    echo "Monitoring Dashboard: http://localhost:3000"
fi
if docker-compose ps | grep -q "grafana"; then
    echo "Grafana: http://localhost:3001"
fi
if docker-compose ps | grep -q "prometheus"; then
    echo "Prometheus: http://localhost:9090"
fi

echo ""
echo "=========================================="
echo "All services started!"
echo "=========================================="

