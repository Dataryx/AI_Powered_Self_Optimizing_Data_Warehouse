"""
WebSocket Routes
Real-time updates for ETL jobs and monitoring data.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import asyncio
import json
import logging
from datetime import datetime, timezone
import os
import time
from psycopg2.extras import RealDictCursor
from ml_optimization.utils.db_utils import get_db_connection
from concurrent.futures import ThreadPoolExecutor

router = APIRouter()
logger = logging.getLogger(__name__)

# Store active WebSocket connections
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []
    
    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)
        logger.info(f"WebSocket connected. Total connections: {len(self.active_connections)}")
    
    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        logger.info(f"WebSocket disconnected. Total connections: {len(self.active_connections)}")
    
    async def broadcast(self, message: dict):
        """Broadcast message to all connected clients."""
        if not self.active_connections:
            return
        
        message_json = json.dumps(message)
        disconnected = []
        
        for connection in self.active_connections:
            try:
                await connection.send_text(message_json)
            except Exception as e:
                logger.error(f"Error sending WebSocket message: {e}")
                disconnected.append(connection)
        
        # Remove disconnected connections
        for conn in disconnected:
            self.disconnect(conn)

manager = ConnectionManager()

optimization_manager = ConnectionManager()
optimization_snapshot_cache = {}  # key -> {"built_at": float, "data": dict}
optimization_snapshot_lock = None  # lazily initialized in async context


def _snapshot_cache_key(*, performance_days: int, performance_limit: int, recommendations_limit: int, history_limit: int) -> str:
    return f"days={performance_days}|plim={performance_limit}|rlim={recommendations_limit}|hlim={history_limit}"


def _optimization_snapshot_payload_ok(data: object) -> bool:
    """Reject stale/malformed cache entries so clients never get `{}` or partial shapes."""
    if not isinstance(data, dict):
        return False
    if data.get("type") != "optimization_snapshot":
        return False
    for key in ("index", "partition", "history", "performance"):
        if key not in data:
            return False
    return True


async def _send_optimization_snapshot_ws(websocket: WebSocket, snapshot: dict) -> None:
    """Send JSON that survives Decimal/numpy/datetime values from psycopg2 / pandas."""
    await websocket.send_text(json.dumps(snapshot, default=str, ensure_ascii=False))


def _build_optimization_snapshot_sync(
    *, performance_days: int, performance_limit: int, recommendations_limit: int, history_limit: int
) -> dict:
    """
    Build a single optimization snapshot payload (blocking DB work — run in a thread pool).
    """
    from ml_optimization.api.routes import optimization_routes

    now = datetime.now(timezone.utc)
    # Match dashboard ``utcPerformanceDateRange`` / REST query-performance (UTC calendar bounds).
    start_date, end_date = optimization_routes._utc_analytics_date_window(performance_days)

    rec_cap = min(max(recommendations_limit * 2, recommendations_limit), 250)
    with get_db_connection() as conn:
        combined = optimization_routes._build_optimization_recommendations_payload(
            conn,
            type_filter=None,
            limit=rec_cap,
            status_filter="pending",
        )
        recs = list(combined.get("recommendations") or [])
        index_rows = [
            r
            for r in recs
            if str(r.get("type", "index") or "index").lower() != "partition"
        ]
        partition_rows = [r for r in recs if str(r.get("type", "")).lower() == "partition"]
        optimization_routes._sort_recommendations_by_priority(index_rows)
        optimization_routes._sort_recommendations_by_priority(partition_rows)
        index_payload = {
            "recommendations": index_rows[:recommendations_limit],
            "total": len(index_rows),
        }
        partition_payload = {
            "recommendations": partition_rows[:recommendations_limit],
            "total": len(partition_rows),
        }
        history_payload = optimization_routes._build_optimization_history_payload(
            conn,
            limit=history_limit,
        )
        performance_payload = optimization_routes._build_query_performance_payload(
            conn,
            start_date=start_date,
            end_date=end_date,
            query_id=None,
            limit=performance_limit,
        )

    return {
        "type": "optimization_snapshot",
        "timestamp": now.isoformat(),
        "index": index_payload,
        "partition": partition_payload,
        "history": history_payload,
        "performance": performance_payload,
    }


async def _build_optimization_snapshot(*, performance_days: int, performance_limit: int, recommendations_limit: int, history_limit: int) -> dict:
    """Async wrapper so snapshot DB work does not block the event loop."""
    return await asyncio.to_thread(
        _build_optimization_snapshot_sync,
        performance_days=performance_days,
        performance_limit=performance_limit,
        recommendations_limit=recommendations_limit,
        history_limit=history_limit,
    )


async def _get_optimization_snapshot_cached(*, performance_days: int, performance_limit: int, recommendations_limit: int, history_limit: int) -> dict:
    """
    Return a cached snapshot if built recently; otherwise rebuild once per cache key.
    """
    # Snapshot caching disabled for now: always return a fresh payload.
    return await _build_optimization_snapshot(
        performance_days=performance_days,
        performance_limit=performance_limit,
        recommendations_limit=recommendations_limit,
        history_limit=history_limit,
    )

    cache_key = _snapshot_cache_key(
        performance_days=performance_days,
        performance_limit=performance_limit,
        recommendations_limit=recommendations_limit,
        history_limit=history_limit,
    )

    interval_ms = int(os.environ.get("OPTIMIZATION_WS_INTERVAL_MS", "2000"))
    interval_s = max(0.1, interval_ms / 1000.0)
    now_ts = time.time()

    cached = optimization_snapshot_cache.get(cache_key)
    if cached:
        built_at = cached.get("built_at", 0.0)
        if (now_ts - built_at) < interval_s:
            data = cached.get("data")
            if _optimization_snapshot_payload_ok(data):
                return data

    global optimization_snapshot_lock
    if optimization_snapshot_lock is None:
        optimization_snapshot_lock = asyncio.Lock()

    async with optimization_snapshot_lock:
        # Re-check after acquiring lock
        cached = optimization_snapshot_cache.get(cache_key)
        if cached:
            built_at = cached.get("built_at", 0.0)
            if (now_ts - built_at) < interval_s:
                data = cached.get("data")
                if _optimization_snapshot_payload_ok(data):
                    return data

        data = await _build_optimization_snapshot(
            performance_days=performance_days,
            performance_limit=performance_limit,
            recommendations_limit=recommendations_limit,
            history_limit=history_limit,
        )
        optimization_snapshot_cache[cache_key] = {"built_at": time.time(), "data": data}
        return data


@router.websocket("/ws/etl-jobs")
async def websocket_etl_jobs(websocket: WebSocket):
    """WebSocket endpoint for real-time ETL job updates."""
    try:
        await manager.connect(websocket)
        logger.info("WebSocket client connected")
    except Exception as e:
        logger.error(f"Error accepting WebSocket connection: {e}", exc_info=True)
        return
    
    try:
        # Send initial data
        await send_etl_jobs_update(websocket)
        
        # Keep connection alive and send periodic updates
        while True:
            await asyncio.sleep(2)  # Update every 2 seconds
            try:
                await send_etl_jobs_update(websocket)
            except Exception as e:
                logger.error(f"Error sending update: {e}", exc_info=True)
                # Try to send error message, but don't break the connection
                try:
                    await websocket.send_json({
                        "type": "error",
                        "message": str(e),
                        "timestamp": datetime.now().isoformat()
                    })
                except:
                    # If we can't send, connection is probably dead
                    break
            
    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected normally")
        manager.disconnect(websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}", exc_info=True)
        try:
            manager.disconnect(websocket)
        except:
            pass


@router.websocket("/ws/optimization-stream")
async def websocket_optimization_stream(websocket: WebSocket):
    """
    WebSocket endpoint for real-time dashboard optimization updates.

    Client query params (all optional):
    - performance_days: int (default 7) for QueryPerformance
    - performance_limit: int (default 100)
    - recommendations_limit: int (default 100)
    - history_limit: int (default 100)

    Server env: OPTIMIZATION_WS_INTERVAL_MS (default 2000) — snapshot rebuild cadence.
    Optional pg_stat merge: OPTIMIZATION_MERGE_PG_STAT_LIVE=1 (default off).
    """
    try:
        await optimization_manager.connect(websocket)

        performance_days = int(websocket.query_params.get("performance_days", "7"))
        performance_limit = int(websocket.query_params.get("performance_limit", "100"))
        recommendations_limit = int(websocket.query_params.get("recommendations_limit", "100"))
        history_limit = int(websocket.query_params.get("history_limit", "100"))

        interval_ms = int(os.environ.get("OPTIMIZATION_WS_INTERVAL_MS", "2000"))
        interval_s = max(0.1, interval_ms / 1000.0)

        # Send initial payload immediately
        snapshot = await _get_optimization_snapshot_cached(
            performance_days=performance_days,
            performance_limit=performance_limit,
            recommendations_limit=recommendations_limit,
            history_limit=history_limit,
        )
        await _send_optimization_snapshot_ws(websocket, snapshot)

        while True:
            await asyncio.sleep(interval_s)
            snapshot = await _get_optimization_snapshot_cached(
                performance_days=performance_days,
                performance_limit=performance_limit,
                recommendations_limit=recommendations_limit,
                history_limit=history_limit,
            )
            await _send_optimization_snapshot_ws(websocket, snapshot)
    except WebSocketDisconnect:
        optimization_manager.disconnect(websocket)
        logger.info("Optimization WS client disconnected")
    except Exception as e:
        logger.error(f"Optimization WS error: {e}", exc_info=True)
        try:
            await websocket.send_json({"type": "error", "message": str(e), "timestamp": datetime.now().isoformat()})
        except Exception:
            pass
        optimization_manager.disconnect(websocket)

async def send_etl_jobs_update(websocket: WebSocket):
    """Send current ETL jobs status."""
    import asyncio
    from concurrent.futures import ThreadPoolExecutor
    
    def fetch_jobs():
        """Fetch jobs synchronously in a thread."""
        try:
            with get_db_connection() as conn:
                cursor = conn.cursor(cursor_factory=RealDictCursor)
                
                # Check if table exists
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT 1 FROM information_schema.tables 
                        WHERE table_schema = 'monitoring' AND table_name = 'etl_jobs'
                    )
                """)
                table_exists = cursor.fetchone().get('exists', False)
                
                if not table_exists:
                    return {"jobs": [], "total": 0}
                
                # Get recent jobs
                cursor.execute("""
                    SELECT 
                        job_id,
                        job_name,
                        job_type,
                        status,
                        progress,
                        layer,
                        table_name as table,
                        started_at,
                        completed_at,
                        records_processed,
                        records_total,
                        error_message
                    FROM monitoring.etl_jobs
                    WHERE started_at >= CURRENT_TIMESTAMP - INTERVAL '24 hours'
                    ORDER BY started_at DESC
                    LIMIT 50
                """)
                
                jobs = []
                for row in cursor.fetchall():
                    job = {
                        "job_id": row.get('job_id'),
                        "job_name": row.get('job_name'),
                        "status": row.get('status', 'pending'),
                        "progress": int(row.get('progress', 0)),
                        "started_at": row.get('started_at').isoformat() if row.get('started_at') else None,
                        "completed_at": row.get('completed_at').isoformat() if row.get('completed_at') else None,
                        "records_processed": int(row.get('records_processed', 0) or 0),
                        "layer": row.get('layer'),
                        "table": row.get('table'),
                    }
                    jobs.append(job)
                
                return {"jobs": jobs, "total": len(jobs)}
        except Exception as e:
            logger.error(f"Error fetching jobs: {e}", exc_info=True)
            raise
    
    try:
        # Run database query in thread pool to avoid blocking
        loop = asyncio.get_event_loop()
        executor = ThreadPoolExecutor(max_workers=1)
        result = await loop.run_in_executor(executor, fetch_jobs)
        
        await websocket.send_json({
            "type": "etl_jobs",
            "jobs": result.get("jobs", []),
            "total": result.get("total", 0),
            "timestamp": datetime.now().isoformat()
        })
        
    except Exception as e:
        logger.error(f"Error sending ETL jobs update: {e}", exc_info=True)
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e),
                "timestamp": datetime.now().isoformat()
            })
        except:
            pass
        raise


# Background task to broadcast updates
async def broadcast_etl_updates():
    """Background task to broadcast ETL job updates to all connected clients."""
    while True:
        try:
            if manager.active_connections:
                with get_db_connection() as conn:
                    cursor = conn.cursor(cursor_factory=RealDictCursor)
                    
                    cursor.execute("""
                        SELECT EXISTS (
                            SELECT 1 FROM information_schema.tables 
                            WHERE table_schema = 'monitoring' AND table_name = 'etl_jobs'
                        )
                    """)
                    table_exists = cursor.fetchone().get('exists', False)
                    
                    if table_exists:
                        cursor.execute("""
                            SELECT 
                                job_id,
                                job_name,
                                status,
                                progress,
                                layer,
                                table_name as table,
                                started_at,
                                completed_at,
                                records_processed
                            FROM monitoring.etl_jobs
                            WHERE status = 'running' OR updated_at >= CURRENT_TIMESTAMP - INTERVAL '1 minute'
                            ORDER BY started_at DESC
                            LIMIT 50
                        """)
                        
                        jobs = []
                        for row in cursor.fetchall():
                            job = {
                                "job_id": row.get('job_id'),
                                "job_name": row.get('job_name'),
                                "status": row.get('status', 'pending'),
                                "progress": int(row.get('progress', 0)),
                                "started_at": row.get('started_at').isoformat() if row.get('started_at') else None,
                                "completed_at": row.get('completed_at').isoformat() if row.get('completed_at') else None,
                                "records_processed": int(row.get('records_processed', 0) or 0),
                                "layer": row.get('layer'),
                                "table": row.get('table'),
                            }
                            jobs.append(job)
                        
                        await manager.broadcast({
                            "type": "etl_jobs",
                            "jobs": jobs,
                            "total": len(jobs),
                            "timestamp": datetime.now().isoformat()
                        })
        except Exception as e:
            logger.error(f"Error in broadcast task: {e}")
        
        await asyncio.sleep(2)  # Check every 2 seconds

