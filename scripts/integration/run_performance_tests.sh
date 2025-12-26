#!/bin/bash
# Performance Test Runner Script

set -e

echo "=== Running Performance Benchmarks ==="

# Set environment variables
export TEST_DB_CONNECTION_STRING="postgresql://postgres:postgres@localhost:5432/datawarehouse_test"

# Create test database if needed
psql -h localhost -U postgres -c "CREATE DATABASE IF NOT EXISTS datawarehouse_test;" || true

# Run performance tests
echo "Running performance benchmarks..."
pytest tests/performance/ -v -m benchmark --benchmark-json=benchmarks/results/benchmark_results.json

echo "=== Performance Tests Complete ==="
echo "Results saved to benchmarks/results/benchmark_results.json"

