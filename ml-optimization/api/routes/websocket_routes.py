"""
WebSocket Routes
Real-time updates for ETL jobs and monitoring data.
"""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from typing import List
import asyncio
import json
import logging
from datetime import datetime
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

