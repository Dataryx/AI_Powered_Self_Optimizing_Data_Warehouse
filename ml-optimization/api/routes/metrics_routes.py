"""
Metrics Routes
API routes for performance metrics.
"""

from fastapi import APIRouter

router = APIRouter()


@router.get("/")
async def get_metrics():
    """Get performance metrics."""
    return {
        "message": "Metrics endpoint",
        "metrics": []
    }


@router.get("/query-performance")
async def get_query_performance():
    """Get query performance metrics."""
    return {
        "message": "Query performance metrics",
        "data": []
    }
