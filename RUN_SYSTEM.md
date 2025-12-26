# Run Entire System - Quick Guide

## 🚀 Start All Services Including Dashboard

### Method 1: Automated Script (Windows)

**Double-click:** `START_SYSTEM.bat`

This will:
1. Start PostgreSQL, Redis, Adminer, pgAdmin
2. Start Prometheus and Grafana
3. Open API Gateway in a new window
4. Open Dashboard in a new window

### Method 2: Manual Step-by-Step

#### Terminal 1: Core Services & Monitoring

```powershell
# Start core services
docker-compose up -d postgres redis adminer pgadmin

# Start monitoring stack
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# Check status
docker-compose ps
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml ps
```

#### Terminal 2: API Gateway

```powershell
cd api-gateway

# Install dependencies (first time only)
pip install -r requirements.txt

# Start API Gateway
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

#### Terminal 3: Dashboard

```powershell
cd monitoring-dashboard

# Install dependencies (first time only)
npm install

# Start Dashboard
npm run dev
```

## 🔗 Access URLs

Once all services are running:

| Service | URL | Credentials |
|---------|-----|-------------|
| **Monitoring Dashboard** | http://localhost:5173 | - |
| API Gateway | http://localhost:8000 | - |
| API Documentation | http://localhost:8000/docs | - |
| Grafana | http://localhost:3001 | admin / admin |
| Prometheus | http://localhost:9090 | - |
| Adminer | http://localhost:8080 | postgres / postgres |
| pgAdmin | http://localhost:5050 | admin@example.com / admin |

## ✅ Verification

### Check Services

```powershell
# Docker services
docker-compose ps

# Check API Gateway
curl http://localhost:8000/health
# Or visit: http://localhost:8000/docs

# Check Dashboard
# Visit: http://localhost:5173
```

### Quick Health Check

```powershell
# PostgreSQL
docker-compose exec postgres pg_isready -U postgres

# Redis
docker-compose exec redis redis-cli ping

# Prometheus
curl http://localhost:9090/-/healthy

# Grafana
curl http://localhost:3001/api/health
```

## 🛑 Stop All Services

```powershell
# Stop API Gateway and Dashboard (close their windows or Ctrl+C)

# Stop Docker services
docker-compose down
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml down
```

## 📝 Notes

- **First Time Setup**: Run `npm install` in `monitoring-dashboard/` and `pip install -r requirements.txt` in `api-gateway/`
- **Port Conflicts**: If ports are in use, stop conflicting services or change ports in docker-compose files
- **Dashboard Port**: Vite uses port 5173 by default (may vary)
- **API Gateway**: Auto-reloads on code changes (--reload flag)

## 🎯 Expected Behavior

1. **Docker Services**: Should show "Up" and "healthy" status
2. **API Gateway**: Should display "Application startup complete" in terminal
3. **Dashboard**: Should display "Local: http://localhost:5173" in terminal
4. **Browser**: Dashboard should load at http://localhost:5173

---

**Ready to go! Start the services and access the dashboard at http://localhost:5173**

