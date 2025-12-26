# Test Documentation

## Overview

This document describes the testing strategy and test suites for the AI-Powered Self-Optimizing Data Warehouse.

## Test Structure

### Unit Tests (`tests/unit/`)
- Test individual components in isolation
- Fast execution
- Mock external dependencies
- Target: >90% coverage

### Integration Tests (`tests/integration/`)
- Test component interactions
- Use test database
- Verify data flow
- Target: >80% coverage

### Performance Tests (`tests/performance/`)
- Benchmark query performance
- Measure optimization effectiveness
- Stress testing
- Load testing

### End-to-End Tests (`tests/e2e/`)
- Test complete workflows
- Real service interactions
- Full system validation

### Evaluation Tests (`tests/evaluation/`)
- Comprehensive evaluation framework
- Scenario-based testing
- Metrics collection

## Running Tests

### Run All Tests
```bash
pytest tests/ -v
```

### Run Specific Test Types
```bash
# Unit tests
pytest tests/unit/ -v -m unit

# Integration tests
pytest tests/integration/ -v -m integration

# Performance tests
pytest tests/performance/ -v -m performance

# E2E tests
pytest tests/e2e/ -v -m e2e
```

### Run with Coverage
```bash
pytest tests/ --cov=. --cov-report=html --cov-report=term-missing
```

### Run Performance Benchmarks
```bash
pytest tests/performance/ -v -m benchmark --benchmark-json=benchmarks/results/benchmark_results.json
```

## Test Configuration

### Environment Variables
- `TEST_DB_CONNECTION_STRING` - Test database connection
- `TEST_API_URL` - API base URL for integration tests
- `TEST_REDIS_URL` - Redis connection for tests

### Pytest Configuration
See `pytest.ini` for complete configuration:
- Test discovery patterns
- Markers for test categorization
- Coverage requirements (>80%)
- Output formatting

## Test Data

### Fixtures
- `db_connection` - Database connection fixture
- `test_schema` - Temporary test schema
- `redis_client` - Redis client fixture
- `api_base_url` - API endpoint fixture

### Test Data Management
- Tests use isolated schemas
- Automatic cleanup after tests
- No production data contamination

## Continuous Integration

### GitHub Actions
Automated testing on:
- Push to main/develop branches
- Pull requests
- Scheduled runs

### CI Pipeline Steps
1. Setup Python environment
2. Install dependencies
3. Start test services (PostgreSQL, Redis)
4. Run unit tests with coverage
5. Run integration tests
6. Upload coverage reports

## Performance Benchmarks

### Benchmark Types
1. **Simple Queries** - Point lookups
2. **Complex Queries** - Analytical queries
3. **Concurrent Load** - Multi-threaded queries
4. **Optimization Impact** - Before/after comparison

### Benchmark Metrics
- Average execution time
- P50, P95, P99 latencies
- Throughput (queries/second)
- Resource utilization

## Evaluation Framework

### Evaluation Metrics
- Performance improvements
- Resource optimization
- ML model accuracy
- System effectiveness

### Evaluation Scenarios
1. Light OLTP workload
2. Heavy analytics workload
3. Mixed workload
4. Spike workload
5. Gradual growth workload

## Best Practices

1. **Isolation**: Each test should be independent
2. **Cleanup**: Always clean up test data
3. **Naming**: Use descriptive test names
4. **Documentation**: Document complex test logic
5. **Performance**: Keep tests fast (use appropriate markers)
6. **Mocking**: Mock external services in unit tests

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure PostgreSQL is running
   - Check connection string
   - Verify test database exists

2. **Test Timeouts**
   - Increase timeout for slow tests
   - Use `@pytest.mark.slow` marker

3. **Import Errors**
   - Check PYTHONPATH
   - Verify package installation
   - Check relative imports

## Test Coverage Goals

- Overall: >80%
- Critical components: >90%
- Utility functions: >85%
- API endpoints: >80%

## Reporting

Test results are available in:
- Terminal output
- HTML coverage report (`htmlcov/index.html`)
- XML coverage report (`coverage.xml`)
- Benchmark JSON (`benchmarks/results/benchmark_results.json`)

