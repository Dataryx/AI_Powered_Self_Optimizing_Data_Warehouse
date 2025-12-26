# Integration & Testing Guide

## Quick Start

### Start All Services
```bash
# Using Docker Compose
docker-compose -f docker-compose.yml -f docker-compose.integration.yml -f docker-compose.monitoring.yml up -d

# Or using Makefile
make start-all
```

### Run Tests
```bash
# All tests
make test

# Specific test types
make test-unit
make test-integration
make test-e2e
make test-performance

# With coverage
make test-coverage
```

### Health Check
```bash
make health-check-all
```

## Integration Architecture

### Service Dependencies
```
PostgreSQL → Redis
    ↓
ML Service → API Gateway → Dashboard
    ↓
Prometheus → Grafana
```

### Service Ports
- PostgreSQL: 5432
- Redis: 6379
- ML Service: 8001
- API Gateway: 8000
- Dashboard: 3000
- Grafana: 3001
- Prometheus: 9090
- Airflow: 8081 (optional)

## Testing Strategy

### Unit Tests
- Fast execution
- Isolated components
- Mock dependencies
- Target: >90% coverage

### Integration Tests
- Component interactions
- Database integration
- API endpoint testing
- Target: >80% coverage

### Performance Tests
- Query benchmarks
- Optimization effectiveness
- Load testing
- Resource utilization

### E2E Tests
- Complete workflows
- System validation
- Real service interactions

## Evaluation

### Evaluation Framework
The evaluation framework measures:
- Performance improvements
- Resource optimization
- ML model accuracy
- System effectiveness

### Running Evaluation
```bash
# Run evaluation tests
pytest tests/evaluation/ -v -m evaluation

# Generate report
python scripts/evaluation/generate_evaluation_report.py
```

### Evaluation Scenarios
1. Light OLTP workload
2. Heavy analytics workload
3. Mixed workload
4. Spike workload
5. Gradual growth workload

## CI/CD

### GitHub Actions
Automated testing runs on:
- Push to main/develop
- Pull requests
- Scheduled runs

### Pipeline Steps
1. Setup environment
2. Start test services
3. Run unit tests
4. Run integration tests
5. Generate coverage report
6. Upload artifacts

## Troubleshooting

### Services Not Starting
1. Check Docker is running
2. Verify ports are available
3. Check logs: `docker-compose logs`
4. Verify dependencies are met

### Test Failures
1. Ensure services are running
2. Check database connection
3. Verify test data setup
4. Check environment variables

### Performance Issues
1. Increase test timeouts
2. Reduce test data size
3. Use test markers for slow tests
4. Run tests in parallel where possible

## Documentation

- [Test Documentation](docs/testing/test-documentation.md)
- [Evaluation Methodology](docs/testing/evaluation-methodology.md)
- [Phase 4 Summary](PHASE4_SUMMARY.md)

