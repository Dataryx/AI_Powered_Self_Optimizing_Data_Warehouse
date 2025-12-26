@echo off
REM Start All Services - Windows Batch Script
REM Starts the entire AI-Powered Self-Optimizing Data Warehouse system

echo ============================================================
echo Starting AI-Powered Self-Optimizing Data Warehouse
echo ============================================================
echo.

REM Start core services
echo [1/4] Starting core services (PostgreSQL, Redis)...
docker-compose up -d postgres redis adminer pgadmin
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to start core services
    pause
    exit /b 1
)
echo ✓ Core services started
echo.

REM Wait for services
echo Waiting for services to be ready...
timeout /t 10 /nobreak > nul

REM Start monitoring stack
echo [2/4] Starting monitoring stack (Prometheus, Grafana)...
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml up -d
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to start monitoring stack
    pause
    exit /b 1
)
echo ✓ Monitoring stack started
echo.

REM Wait for monitoring
timeout /t 5 /nobreak > nul

REM Start API Gateway
echo [3/4] Starting API Gateway...
cd api-gateway
start "API Gateway" cmd /k "python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload"
cd ..
timeout /t 5 /nobreak > nul
echo ✓ API Gateway starting (separate window)
echo.

REM Start Dashboard
echo [4/4] Starting Monitoring Dashboard...
cd monitoring-dashboard
start "Dashboard" cmd /k "npm run dev"
cd ..
echo ✓ Dashboard starting (separate window)
echo.

echo ============================================================
echo All Services Started!
echo ============================================================
echo.
echo Service URLs:
echo   - Dashboard: http://localhost:5173
echo   - API Gateway: http://localhost:8000
echo   - API Docs: http://localhost:8000/docs
echo   - Grafana: http://localhost:3001 (admin/admin)
echo   - Prometheus: http://localhost:9090
echo   - Adminer: http://localhost:8080
echo   - pgAdmin: http://localhost:5050
echo.
echo Press any key to view service status...
pause > nul

docker-compose ps
docker-compose -f docker-compose.yml -f docker-compose.monitoring.yml ps

pause

