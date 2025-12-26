# Environment Variables Template

Copy this file to `.env` and update the values as needed.

```env
# PostgreSQL Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_DB=datawarehouse
POSTGRES_PORT=5432

# Redis Configuration
REDIS_PORT=6379

# Adminer (Database UI)
ADMINER_PORT=8080

# pgAdmin Configuration
PGADMIN_EMAIL=admin@example.com
PGADMIN_PASSWORD=admin
PGADMIN_PORT=5050

# Airflow Configuration (Development)
AIRFLOW_UID=50000
AIRFLOW_GID=50000

# API Gateway Configuration (Phase 2)
API_GATEWAY_PORT=8000
API_GATEWAY_HOST=0.0.0.0

# ML Service Configuration (Phase 2)
ML_SERVICE_PORT=8001

# Monitoring Dashboard (Phase 2)
DASHBOARD_PORT=3000
```

**Important**: 
- Change default passwords in production
- Never commit `.env` file to version control
- Use environment-specific values for different environments

