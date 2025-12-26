# AI-Powered Self-Optimizing Data Warehouse

An intelligent data warehouse system that automatically analyzes query patterns, generates optimization recommendations, and applies them with admin approval. Built with PostgreSQL, Redis, FastAPI, React, and ML-powered optimization.

## 🚀 Features

### Data Warehouse Architecture
- **Medallion Architecture** (Bronze → Silver → Gold)
- **7.3M+ records** across all layers
- **SCD Type 2** dimensions for historical tracking
- **Partitioned tables** for performance
- **Comprehensive ETL pipeline**

### ML-Powered Optimization
- **Query Log Collection** from `pg_stat_statements`
- **Workload Analysis** and pattern identification
- **Index Recommendations** based on query patterns
- **Admin Approval System** for safe optimization
- **ML Models**: Workload clustering and query time prediction
- **Performance Testing** and effectiveness measurement

### Monitoring & Observability
- **React Dashboard** with real-time metrics
- **FastAPI Backend** with WebSocket support
- **Prometheus & Grafana** monitoring stack
- **Query performance tracking**

## 📊 System Overview

```
┌─────────────────┐
│   Data Sources  │
└────────┬────────┘
         │
         ▼
┌─────────────────┐     ┌─────────────────┐
│  Bronze Layer   │────▶│  Silver Layer   │
│  (Raw Data)     │     │  (Cleaned)      │
└─────────────────┘     └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │   Gold Layer    │
                        │  (Aggregated)   │
                        └────────┬────────┘
                                 │
                                 ▼
                        ┌─────────────────┐
                        │ ML Optimization │
                        │    Engine       │
                        └─────────────────┘
```

## 🏗️ Architecture

### Data Layers

1. **Bronze Layer**: Raw, unprocessed data
   - 7 tables (customers, products, orders, inventory, reviews, sessions, clickstream)
   - 7.3M+ records

2. **Silver Layer**: Cleaned and validated data
   - 7 tables with SCD Type 2 dimensions
   - 460K+ records
   - Referential integrity enforced

3. **Gold Layer**: Business-ready aggregations
   - 7 analytics tables
   - 15K+ aggregated records
   - Pre-calculated metrics

### ML Optimization Components

1. **Query Log Collector**: Collects statistics from `pg_stat_statements`
2. **Workload Analyzer**: Identifies patterns and classifies workloads
3. **Recommendation Generator**: Creates index and optimization recommendations
4. **Admin Approval System**: Requires approval before applying changes
5. **ML Models**: Clustering and prediction models
6. **Performance Testing**: Measures optimization effectiveness

## 🛠️ Quick Start

### Prerequisites

- Docker and Docker Compose
- Python 3.10+
- PostgreSQL 15+ (via Docker)
- Redis 7+ (via Docker)

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd AI-Powered-Self_Optimizing_Data_Warehouse
   ```

2. **Set up environment variables**
   ```bash
   cp ENV_TEMPLATE.md .env
   # Edit .env with your configuration
   ```

3. **Start core services**
   ```bash
   docker-compose up -d postgres redis
   ```

4. **Create database schemas**
   ```bash
   python scripts/data-warehouse/create_schemas.py
   ```

5. **Generate and load data**
   ```bash
   cd data-generator
   python main.py --load
   ```

6. **Run ETL pipeline**
   ```bash
   python etl/scripts/run_etl.py
   ```

### Generate Query Workload

```bash
python scripts/query-workloads/generate_workload.py
```

### Collect Query Logs

**Windows PowerShell:**
```powershell
$env:PYTHONPATH="$PWD\ml-optimization;$env:PYTHONPATH"
python scripts/ml-optimization/run_query_collection.py
```

**Linux/Mac:**
```bash
export PYTHONPATH="$(pwd)/ml-optimization:$PYTHONPATH"
python scripts/ml-optimization/run_query_collection.py
```

### Generate Recommendations

```bash
python scripts/ml-optimization/generate_recommendations.py
```

### Approve and Apply Recommendations

1. **Create approval file** (`approvals.json`):
   ```json
   [
     {
       "recommendation_id": 2,
       "approved_by": "admin",
       "notes": "Approved for testing"
     }
   ]
   ```

2. **Apply approved recommendations**:
   ```bash
   python scripts/ml-optimization/approve_and_apply_recommendations.py --approval-file approvals.json
   ```

### Train ML Models

```bash
python scripts/ml-optimization/train_models_simple.py
```

### Run Performance Tests

```bash
python scripts/performance_testing/run_performance_tests.py
```

### Start All Services

```bash
bash scripts/start_all_services.sh
# Or
docker-compose up -d
```

## 📁 Project Structure

```
AI-Powered-Self_Optimizing_Data_Warehouse/
├── data-warehouse/          # Schema definitions
│   └── schemas/
│       ├── bronze/         # 7 raw data tables
│       ├── silver/         # 7 cleaned/transformed tables
│       └── gold/           # 7 aggregated analytics tables
├── data-generator/          # Synthetic data generation
├── etl/                     # ETL pipeline
│   ├── transformers/       # Bronze → Silver
│   ├── aggregators/        # Silver → Gold
│   └── scripts/            # ETL runners
├── ml-optimization/         # ML optimization engine
│   ├── collectors/         # Query log collection
│   ├── analyzers/          # Workload analysis
│   ├── models/             # ML models
│   ├── optimizers/         # Optimization advisors
│   ├── api/                # ML optimization API
│   └── saved_models/       # Trained ML models
├── monitoring-dashboard/    # React dashboard
├── api-gateway/            # Backend API
├── scripts/                # Utility scripts
│   ├── query-workloads/    # Query generation
│   ├── ml-optimization/    # ML scripts
│   └── performance_testing/ # Performance tests
└── tests/                  # Test suite
```

## 📈 Current System Statistics

### Data Warehouse
- **Bronze Layer**: 7,286,454 records
- **Silver Layer**: 460,064+ records
- **Gold Layer**: 15,030+ records

### ML Optimization
- **Query Logs**: 893 records collected
- **Recommendations Generated**: 4 index recommendations
- **ML Models Trained**: 2 models (clustering, prediction)
- **Performance Tests**: 5 comprehensive tests

## 🔧 Configuration

### Environment Variables

See `ENV_TEMPLATE.md` for all configuration options:

- Database connections (PostgreSQL)
- Redis configuration
- API ports
- ML service settings

### Database Connections

- **PostgreSQL**: `localhost:5432`
- **Database**: `datawarehouse`
- **Schemas**: `bronze`, `silver`, `gold`, `ml_optimization`
- **Redis**: `localhost:6379`

## 📊 Monitoring

### Available Services

- **PostgreSQL**: `localhost:5432`
- **Redis**: `localhost:6379`
- **Adminer**: `http://localhost:8080`
- **pgAdmin**: `http://localhost:5050`
- **ML Optimization API**: `http://localhost:8001` (when started)
- **API Gateway**: `http://localhost:8000` (when started)
- **Monitoring Dashboard**: `http://localhost:3000` (when started)
- **Grafana**: `http://localhost:3001` (when started)
- **Prometheus**: `http://localhost:9090` (when started)

## 🧪 Testing

### Performance Tests

```bash
python scripts/performance_testing/run_performance_tests.py
```

### View Test Results

```sql
SELECT 
    test_name,
    AVG(execution_time_ms) as avg_time,
    test_run_id
FROM ml_optimization.performance_test_results
GROUP BY test_name, test_run_id
ORDER BY test_run_id DESC, test_name;
```

## 📝 Documentation

- `PROJECT_STATUS_COMPLETE.md` - Complete project status
- `ETL_PIPELINE_COMPLETE.md` - ETL pipeline documentation
- `ML_OPTIMIZATION_WORKFLOW_COMPLETE.md` - ML workflow guide
- `FINAL_IMPLEMENTATION_COMPLETE.md` - Final implementation summary
- `docs/` - Detailed documentation

## 🎯 Key Features

### 1. Admin Approval System
- Requires explicit approval before applying recommendations
- Tracks approval history and status
- JSON-based approval workflow

### 2. ML Model Training
- Workload clustering (KMeans)
- Query time prediction (Random Forest)
- Feature extraction from query logs

### 3. Performance Testing
- Comprehensive test suite
- Statistical analysis
- Baseline comparison
- Results tracking

### 4. Service Management
- Automated service startup
- Health checks
- Dependency management

## 🔄 Typical Workflow

1. **Generate Data** → Load into Bronze layer
2. **Run ETL** → Transform to Silver and Gold
3. **Generate Workload** → Execute realistic queries
4. **Collect Logs** → Gather query statistics
5. **Generate Recommendations** → AI-powered suggestions
6. **Review & Approve** → Admin approval workflow
7. **Apply Optimizations** → Safe application of changes
8. **Test Performance** → Measure effectiveness
9. **Train Models** → Improve recommendations over time

## 🛡️ Best Practices

1. **Always review recommendations** before approval
2. **Test in development** before production
3. **Monitor performance** after applying changes
4. **Train models regularly** with new query data
5. **Maintain backup** before major changes

## 📞 Support

For issues, questions, or contributions:
- Review documentation in `docs/`
- Check existing issues
- Create detailed issue reports

## 📄 License

[Your License Here]

## 🙏 Acknowledgments

- Built with PostgreSQL, Redis, FastAPI, React
- ML models using scikit-learn
- Docker for containerization

---

**Status**: ✅ Fully Operational
**Last Updated**: December 25, 2025

🎉 **The AI-Powered Self-Optimizing Data Warehouse is ready for use!**
