"""
Legacy alias: GET /api/v1/recommendations → same payload as /api/v1/optimization/recommendations.

Uses path "" (not "/") so requests without a trailing slash avoid a 307 redirect to .../recommendations/.
"""

import logging
from typing import Optional

from fastapi import APIRouter, Query

from ml_optimization.utils.db_utils import get_db_connection

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("")
def get_recommendations(
    type: Optional[str] = Query(None, description="Filter by type (index, partition, cache)"),
    status: Optional[str] = Query(
        None,
        description="Same as /optimization/recommendations: pending (default), applied, rejected, or all",
    ),
    limit: int = Query(100, ge=1, le=250, description="Max recommendations after merge"),
):
    """Same behavior as GET /api/v1/optimization/recommendations (single code path)."""
    # Local import avoids any circular import at startup
    from ml_optimization.api.routes import optimization_routes

    try:
        with get_db_connection() as conn:
            eff = optimization_routes._coerce_api_recommendation_status_query(status)
            return optimization_routes._build_optimization_recommendations_payload(
                conn,
                type_filter=type,
                limit=limit,
                status_filter=eff,
            )
    except Exception as e:
        logger.error("Error fetching recommendations (legacy path): %s", e, exc_info=True)
        return {"recommendations": [], "total": 0}
