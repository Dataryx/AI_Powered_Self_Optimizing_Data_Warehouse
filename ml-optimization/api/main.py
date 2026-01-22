"""
ML Optimization API
FastAPI application for ML optimization engine endpoints.
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

from ml_optimization.api.routes import optimization_routes, metrics_routes, recommendation_routes, warehouse_routes, monitoring_routes, storage_routes, alert_routes, websocket_routes

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

# Include routers
app.include_router(optimization_routes.router, prefix="/api/v1/optimization", tags=["Optimization"])
app.include_router(metrics_routes.router, prefix="/api/v1/metrics", tags=["Metrics"])
app.include_router(recommendation_routes.router, prefix="/api/v1/recommendations", tags=["Recommendations"])
app.include_router(warehouse_routes.router, prefix="/api/v1/warehouse", tags=["Data Warehouse"])
app.include_router(monitoring_routes.router, prefix="/api/v1/monitoring", tags=["Monitoring"])
app.include_router(storage_routes.router, prefix="/api/v1/storage", tags=["Storage"])
app.include_router(alert_routes.router, prefix="/api/v1/alerts", tags=["Alerts"])
app.include_router(websocket_routes.router, prefix="/api/v1", tags=["WebSocket"])


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "ML Optimization API",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """Health check endpoint with database connection test."""
    try:
        from ml_optimization.utils.db_utils import get_db_connection
        
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT current_database(), version()")
            db_name, version = cursor.fetchone()
            
            # Check for data warehouse schemas
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
                    "version": version.split(',')[0] if version else "Unknown",
                    "connected": True,
                    "schemas": schemas
                }
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


