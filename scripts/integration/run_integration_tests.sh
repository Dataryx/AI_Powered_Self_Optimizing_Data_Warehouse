#!/bin/bash
# Integration Test Runner Script

set -e

echo "=== Running Integration Tests ==="

# Set environment variables
export TEST_DB_CONNECTION_STRING="postgresql://postgres:postgres@localhost:5432/datawarehouse_test"
export TEST_API_URL="http://localhost:8000/api/v1"
export TEST_REDIS_URL="redis://localhost:6379"

# Create test database
echo "Creating test database..."
psql -h localhost -U postgres -c "DROP DATABASE IF EXISTS datawarehouse_test;"
psql -h localhost -U postgres -c "CREATE DATABASE datawarehouse_test;"

# Run integration tests
echo "Running integration tests..."
pytest tests/integration/ -v --tb=short

# Run E2E tests
echo "Running E2E tests..."
pytest tests/e2e/ -v --tb=short

echo "=== Integration Tests Complete ==="

