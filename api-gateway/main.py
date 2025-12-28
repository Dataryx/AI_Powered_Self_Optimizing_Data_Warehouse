"""
API Gateway
Main FastAPI application for the Data Warehouse Optimization API.
"""

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import logging
import os

try:
    # Try absolute import (when run from parent directory)
    from api_gateway.routes import warehouse_routes, optimization_routes, monitoring_routes, dashboard_routes
    from api_gateway.websocket import realtime_handler
except ImportError:
    # Fall back to relative imports (when run from api-gateway directory)
    from routes import warehouse_routes, optimization_routes, monitoring_routes, dashboard_routes
    from websocket import realtime_handler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan context manager for startup and shutdown."""
    # Startup
    logger.info("Starting API Gateway")
    
    # Initialize WebSocket handler
    handler = realtime_handler.RealtimeHandler()
    app.state.websocket_handler = handler
    
    # Start background tasks
    import asyncio
    asyncio.create_task(handler.stream_metrics())
    asyncio.create_task(handler.stream_optimizations())
    asyncio.create_task(handler.stream_alerts())
    
    yield
    
    # Shutdown
    logger.info("Shutting down API Gateway")
    await handler.cleanup()


app = FastAPI(
    title="Data Warehouse Optimization API",
    description="API Gateway for AI-Powered Self-Optimizing Data Warehouse",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(
    warehouse_routes.router,
    prefix="/api/v1/warehouse",
    tags=["Warehouse"]
)
app.include_router(
    optimization_routes.router,
    prefix="/api/v1/optimization",
    tags=["Optimization"]
)
app.include_router(
    monitoring_routes.router,
    prefix="/api/v1/monitoring",
    tags=["Monitoring"]
)

# Include dashboard routes
app.include_router(
    dashboard_routes.router,
    prefix="/api/v1/dashboard",
    tags=["Dashboard"]
)


@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "Data Warehouse Optimization API Gateway",
        "version": "1.0.0",
        "status": "running",
        "endpoints": {
            "warehouse": "/api/v1/warehouse",
            "optimization": "/api/v1/optimization",
            "monitoring": "/api/v1/monitoring",
            "dashboard": "/api/v1/dashboard",
            "websocket": "/ws/{client_id}",
            "docs": "/docs",
        }
    }


@app.get("/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "service": "API Gateway"
    }


@app.websocket("/ws/{client_id}")
async def websocket_endpoint(websocket: WebSocket, client_id: str):
    """WebSocket endpoint for real-time updates."""
    handler = app.state.websocket_handler
    
    await handler.connect(websocket, client_id)
    
    try:
        while True:
            data = await websocket.receive_json()
            await handler.handle_message(client_id, data)
    except WebSocketDisconnect:
        await handler.disconnect(client_id)
        logger.info(f"Client {client_id} disconnected")


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("API_GATEWAY_PORT", "8000"))
    uvicorn.run(app, host="0.0.0.0", port=port)


