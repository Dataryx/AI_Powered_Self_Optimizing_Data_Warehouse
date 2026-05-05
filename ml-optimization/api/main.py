"""
ML Optimization API
FastAPI application for ML optimization engine endpoints.
"""

import asyncio
import sys

# Windows: ProactorEventLoop can raise OSError 64 / "network name is no longer available" on accept
# under load; Selector policy matches Unix behavior and reduces noisy accept failures.
if sys.platform == "win32":
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from starlette.requests import Request
from contextlib import asynccontextmanager
import logging
import os
import time
import warnings

# Before routes: they import sklearn/xgboost and may trigger joblib/sklearn parallel warnings.
warnings.filterwarnings("ignore", category=UserWarning, module=r"sklearn\.utils\.parallel")

from ml_optimization.api.routes import optimization_routes, metrics_routes, recommendation_routes, warehouse_routes, monitoring_routes, storage_routes, alert_routes, websocket_routes, system_logs_routes

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    # Startup
    logger.info("Starting ML Optimization API")
    # Initialize connections, load models, etc.
    yield
    # Shutdown
    logger.info("Shutting down ML Optimization API")
    # Cleanup connections, save state, etc.


app = FastAPI(
    title="ML Optimization API",
    description="API for AI-Powered Self-Optimizing Data Warehouse",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_slow_requests(request: Request, call_next):
    """Log requests that take a long time (helps find slow DB-heavy routes)."""
    threshold = float(os.getenv("API_SLOW_REQUEST_LOG_SEC", "2.0"))
    t0 = time.perf_counter()
    response = await call_next(request)
    dt = time.perf_counter() - t0
    if threshold > 0 and dt >= threshold:
        logger.warning("Slow request %.2fs %s %s", dt, request.method, request.url.path)
    return response


# Include routers
app.include_router(optimization_routes.router, prefix="/api/v1/optimization", tags=["Optimization"])
app.include_router(metrics_routes.router, prefix="/api/v1/metrics", tags=["Metrics"])
app.include_router(recommendation_routes.router, prefix="/api/v1/recommendations", tags=["Recommendations"])
app.include_router(warehouse_routes.router, prefix="/api/v1/warehouse", tags=["Data Warehouse"])
app.include_router(monitoring_routes.router, prefix="/api/v1/monitoring", tags=["Monitoring"])
app.include_router(storage_routes.router, prefix="/api/v1/storage", tags=["Storage"])
app.include_router(alert_routes.router, prefix="/api/v1/alerts", tags=["Alerts"])
app.include_router(websocket_routes.router, prefix="/api/v1", tags=["WebSocket"])
app.include_router(system_logs_routes.router, prefix="/api/v1/system-logs", tags=["System Logs"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "ML Optimization API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
def health_check(
    lite: bool = Query(
        False,
        description="If true, only runs SELECT 1 (fast). Default runs catalog queries (slower on large DBs).",
    ),
):
    """Health check endpoint with database connection test."""
    try:
        from ml_optimization.utils.db_utils import get_db_connection

        with get_db_connection() as conn:
            cursor = conn.cursor()
            if lite:
                cursor.execute("SELECT 1")
                cursor.fetchone()
                return {
                    "status": "healthy",
                    "service": "ML Optimization API",
                    "lite": True,
                    "database": {"connected": True},
                }

            cursor.execute("SELECT current_database(), version()")
            db_name, version = cursor.fetchone()

            cursor.execute("""
                SELECT schemaname, COUNT(*) as table_count
                FROM pg_tables
                WHERE schemaname IN ('bronze', 'silver', 'gold')
                GROUP BY schemaname
                ORDER BY schemaname
            """)
            schemas = {row[0]: row[1] for row in cursor.fetchall()}

            return {
                "status": "healthy",
                "service": "ML Optimization API",
                "database": {
                    "name": db_name,
                    "version": version.split(",")[0] if version else "Unknown",
                    "connected": True,
                    "schemas": schemas,
                },
            }
    except Exception as e:
        return {
            "status": "unhealthy",
            "service": "ML Optimization API",
            "error": str(e),
            "database": {
                "connected": False
            }
        }


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("ML_SERVICE_PORT", "8001"))
    uvicorn.run(app, host="0.0.0.0", port=port)


