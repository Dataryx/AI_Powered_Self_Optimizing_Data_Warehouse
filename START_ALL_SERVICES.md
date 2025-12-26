# Start All Services Guide

This guide shows how to start the entire AI-Powered Self-Optimizing Data Warehouse system including the dashboard.

## 🚀 Quick Start (All Services)

### Option 1: Using Docker Compose (Recommended)

```bash
# 1. Start core services (PostgreSQL, Redis)
docker-compose up -d postgres redis adminer pgadmin

# 2. Start monitoring stack (Prometheus, Grafana)
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# 3. Start API Gateway and Dashboard (separate terminals)
# Terminal 1: API Gateway
cd api-gateway
pip install -r requirements.txt
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload

# Terminal 2: Dashboard
cd monitoring-dashboard
npm install  # First time only
npm run dev
```

### Option 2: Using Start Script (Windows)

```powershell
# Start dashboard and API (runs in same terminal)
python scripts/start_dashboard.py
```

## 📋 Service Startup Order

1. **Core Services** (Docker)
   - PostgreSQL
   - Redis
   - Adminer (optional)
   - pgAdmin (optional)

2. **Monitoring Stack** (Docker)
   - Prometheus
   - Grafana
   - PostgreSQL Exporter
   - Redis Exporter

3. **Backend Services** (Python)
   - API Gateway (port 8000)

4. **Frontend Services** (Node.js)
   - Monitoring Dashboard (port 5173)

## 🔗 Service URLs

After starting all services:

| Service | URL | Description |
|---------|-----|-------------|
| **Monitoring Dashboard** | http://localhost:5173 | React dashboard (Vite dev server) |
| API Gateway | http://localhost:8000 | FastAPI backend |
| API Docs | http://localhost:8000/docs | Swagger UI |
| Grafana | http://localhost:3001 | Monitoring visualization |
| Prometheus | http://localhost:9090 | Metrics collection |
| Adminer | http://localhost:8080 | Database management |
| pgAdmin | http://localhost:5050 | Database management |
| PostgreSQL | localhost:5432 | Database connection |
| Redis | localhost:6379 | Cache connection |

## ✅ Verification Steps

### 1. Check Docker Services

```bash
docker-compose ps
```

Expected output: postgres, redis, adminer, pgadmin should be "Up"

### 2. Check Monitoring Services

```bash
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml ps
```

Expected output: prometheus, grafana should be "Up"

### 3. Check API Gateway

```bash
curl http://localhost:8000/health
# Or visit: http://localhost:8000/docs
```

Expected: API documentation page

### 4. Check Dashboard

```bash
# Visit: http://localhost:5173
# Should show React dashboard
```

## 🔧 Manual Startup (Step by Step)

### Step 1: Start Core Services

```bash
docker-compose up -d postgres redis
```

Wait for services to be healthy:
```bash
docker-compose ps
```

### Step 2: Start Monitoring Stack

```bash
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
```

Verify:
```bash
curl http://localhost:9090/-/healthy  # Prometheus
curl http://localhost:3001/api/health  # Grafana
```

### Step 3: Start API Gateway

**Terminal 1:**
```bash
cd api-gateway

# Install dependencies (first time)
pip install -r requirements.txt

# Start API Gateway
python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

Verify:
- Visit http://localhost:8000/docs
- Should see Swagger UI

### Step 4: Start Dashboard

**Terminal 2:**
```bash
cd monitoring-dashboard

# Install dependencies (first time)
npm install

# Start development server
npm run dev
```

Verify:
- Visit http://localhost:5173
- Should see React dashboard

## 🐛 Troubleshooting

### API Gateway Won't Start

1. **Check dependencies:**
   ```bash
   cd api-gateway
   pip install -r requirements.txt
   ```

2. **Check port availability:**
   ```bash
   # Windows
   netstat -ano | findstr :8000
   
   # Linux/Mac
   lsof -i :8000
   ```

3. **Check PostgreSQL connection:**
   ```bash
   docker-compose exec postgres psql -U postgres -d datawarehouse -c "SELECT 1;"
   ```

### Dashboard Won't Start

1. **Install dependencies:**
   ```bash
   cd monitoring-dashboard
   npm install
   ```

2. **Check Node.js version:**
   ```bash
   node --version  # Should be 18+
   ```

3. **Clear cache and reinstall:**
   ```bash
   rm -rf node_modules package-lock.json
   npm install
   ```

### Services Not Connecting

1. **Check API Gateway is running:**
   ```bash
   curl http://localhost:8000/health
   ```

2. **Check dashboard environment:**
   - Verify `.env` file in `monitoring-dashboard/`:
   ```env
   VITE_API_BASE_URL=http://localhost:8000/api/v1
   VITE_WS_BASE_URL=ws://localhost:8000
   ```

3. **Check CORS settings:**
   - API Gateway should allow CORS from dashboard origin

## 📝 Environment Setup

### API Gateway Environment

Create `api-gateway/.env` (optional, uses defaults):
```env
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=datawarehouse
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
REDIS_HOST=localhost
REDIS_PORT=6379
```

### Dashboard Environment

Create `monitoring-dashboard/.env`:
```env
VITE_API_BASE_URL=http://localhost:8000/api/v1
VITE_WS_BASE_URL=ws://localhost:8000
```

## 🎯 Quick Commands

```bash
# Start everything (core + monitoring)
docker-compose up -d
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d

# View logs
docker-compose logs -f postgres
docker-compose logs -f prometheus

# Stop everything
docker-compose down
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml down

# Restart services
docker-compose restart postgres redis
```

## 🎉 Success Indicators

When everything is running correctly:

✅ PostgreSQL: `docker-compose ps` shows "healthy"  
✅ Redis: `docker-compose ps` shows "Up"  
✅ Prometheus: http://localhost:9090 shows UI  
✅ Grafana: http://localhost:3001 shows login (admin/admin)  
✅ API Gateway: http://localhost:8000/docs shows Swagger UI  
✅ Dashboard: http://localhost:5173 shows React app  

---

**Ready to run! Follow the steps above to start all services.**

