# Running the Project

## Quick Start

The project is now running! All services have been started.

## Running Services

### Docker Services
All Docker services are managed via `docker-compose.yml`:

```powershell
# Start all services
docker-compose up -d

# Stop all services
docker-compose down

# View service status
docker-compose ps

# View logs
docker-compose logs -f [service_name]
```

### Services Status

#### ✅ Core Services
- **PostgreSQL** (Port 5432)
  - Database: `datawarehouse`
  - Username: `postgres`
  - Password: `postgres`
  
- **Redis** (Port 6379)
  - Caching layer

#### ✅ Management UIs
- **Adminer** (Port 8080)
  - URL: http://localhost:8080
  - System: PostgreSQL
  - Server: `postgres`
  - Username: `postgres`
  - Password: `postgres`
  - Database: `datawarehouse`

- **pgAdmin** (Port 5050)
  - URL: http://localhost:5050
  - Email: `admin@example.com`
  - Password: `admin`

#### ✅ Monitoring Services
- **Prometheus** (Port 9090)
  - URL: http://localhost:9090
  - Metrics collection and storage

- **Grafana** (Port 3000)
  - URL: http://localhost:3000
  - Default username: `admin`
  - Default password: `admin`

#### ✅ Application Services
- **API Gateway** (Port 8000)
  - URL: http://localhost:8000
  - API Docs: http://localhost:8000/docs
  - FastAPI application

- **Monitoring Dashboard** (Port 5173)
  - URL: http://localhost:5173
  - React/Vite application

## Starting Services Manually

### Start Docker Services
```powershell
docker-compose up -d
```

### Start API Gateway
```powershell
cd api-gateway
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### Start Monitoring Dashboard
```powershell
cd monitoring-dashboard
npm run dev
```

## Service URLs Summary

| Service | URL | Credentials |
|---------|-----|-------------|
| Adminer | http://localhost:8080 | postgres/postgres |
| pgAdmin | http://localhost:5050 | admin@example.com/admin |
| Prometheus | http://localhost:9090 | - |
| Grafana | http://localhost:3000 | admin/admin |
| API Gateway | http://localhost:8000 | - |
| API Docs | http://localhost:8000/docs | - |
| Dashboard | http://localhost:5173 | - |

## Troubleshooting

### Check Service Status
```powershell
docker-compose ps
```

### View Service Logs
```powershell
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f postgres
docker-compose logs -f redis
```

### Restart Services
```powershell
docker-compose restart
```

### Stop All Services
```powershell
docker-compose down
```

### Clean Restart (removes volumes)
```powershell
docker-compose down -v
docker-compose up -d
```

## Database Connection

### Connection String
```
postgresql://postgres:postgres@localhost:5432/datawarehouse
```

### Using psql
```powershell
docker-compose exec postgres psql -U postgres -d datawarehouse
```

### Using Python
```python
import psycopg2
conn = psycopg2.connect(
    host="localhost",
    port=5432,
    database="datawarehouse",
    user="postgres",
    password="postgres"
)
```

## Next Steps

1. Access the **Monitoring Dashboard** at http://localhost:5173
2. Check **API Gateway** documentation at http://localhost:8000/docs
3. View **Database** using Adminer at http://localhost:8080
4. Monitor metrics in **Grafana** at http://localhost:3000

