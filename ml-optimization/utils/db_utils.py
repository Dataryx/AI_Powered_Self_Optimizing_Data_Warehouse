"""
Database Utilities
Common database connection and utility functions.
"""

import logging
import os
import sys
import threading
from contextlib import contextmanager
from typing import Optional

import psycopg2
from psycopg2 import pool
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

_threaded_pool: Optional[pool.ThreadedConnectionPool] = None
_pool_lock = threading.Lock()


def resolve_postgres_host() -> str:
    """
    Host for PostgreSQL connections.

    On Windows, ``localhost`` often resolves to ``::1`` first while many local
    PostgreSQL installs listen only on ``127.0.0.1``, which can produce
    "server closed the connection unexpectedly". Override with ``POSTGRES_HOST``.
    """
    raw = (os.getenv("POSTGRES_HOST") or "").strip()
    host = raw or "localhost"
    if sys.platform == "win32" and host.lower() == "localhost":
        return "127.0.0.1"
    return host


def get_psycopg2_connection_string(
    *,
    connect_timeout_sec: int = 15,
) -> str:
    """
    libpq key=value DSN for ``psycopg2.connect(...)``.

    Uses the same env vars as the rest of the project.
    """
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    host = resolve_postgres_host()
    port = os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("POSTGRES_DB", "datawarehouse")
    return (
        f"host={host} "
        f"port={port} "
        f"dbname={database} "
        f"user={user} "
        f"password={password} "
        f"connect_timeout={max(1, int(connect_timeout_sec))}"
    )


def get_db_connection_string() -> str:
    """
    Get database connection string from environment variables.

    Returns:
        PostgreSQL connection string
    """
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    host = resolve_postgres_host()
    port = os.getenv("POSTGRES_PORT", "5432")
    database = os.getenv("POSTGRES_DB", "datawarehouse")

    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


def _pool_enabled() -> bool:
    v = os.getenv("DB_POOL_ENABLED", "1").strip().lower()
    return v not in ("0", "false", "no")


def _get_threaded_pool() -> pool.ThreadedConnectionPool:
    global _threaded_pool
    if _threaded_pool is not None:
        return _threaded_pool
    with _pool_lock:
        if _threaded_pool is not None:
            return _threaded_pool
        minconn = max(1, int(os.getenv("DB_POOL_MIN_CONN", "2")))
        maxconn = max(minconn, int(os.getenv("DB_POOL_MAX_CONN", "32")))
        dsn = get_db_connection_string()
        _threaded_pool = pool.ThreadedConnectionPool(minconn, maxconn, dsn)
        logger.info("PostgreSQL pool ready (min=%s max=%s)", minconn, maxconn)
        return _threaded_pool


@contextmanager
def get_db_connection(connection_string: Optional[str] = None):
    """
    Context manager for database connections.

    Uses a process-wide ThreadedConnectionPool when DB_POOL_ENABLED=1 (default).
    Set DB_POOL_MIN_CONN / DB_POOL_MAX_CONN to tune. Set DB_POOL_ENABLED=0 to use
    a fresh connection per call (legacy behavior).

    Usage:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
    """
    if connection_string is not None:
        conn = psycopg2.connect(connection_string)
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error("Database error: %s", e)
            raise
        finally:
            conn.close()
        return

    dsn = get_db_connection_string()
    if not _pool_enabled():
        conn = psycopg2.connect(dsn)
        try:
            yield conn
            conn.commit()
        except Exception as e:
            conn.rollback()
            logger.error("Database error: %s", e)
            raise
        finally:
            conn.close()
        return

    pl = _get_threaded_pool()
    conn = pl.getconn()
    try:
        yield conn
        conn.commit()
    except Exception as e:
        conn.rollback()
        logger.error("Database error: %s", e)
        raise
    finally:
        pl.putconn(conn)


def get_db_cursor(connection_string: Optional[str] = None, dict_cursor: bool = True):
    """
    Get database cursor with optional dictionary cursor.

    Args:
        connection_string: Optional connection string
        dict_cursor: If True, use RealDictCursor

    Returns:
        Tuple of (connection, cursor)
    """
    if connection_string is None:
        connection_string = get_db_connection_string()

    conn = psycopg2.connect(connection_string)
    cursor_class = RealDictCursor if dict_cursor else None
    cursor = conn.cursor(cursor_factory=cursor_class)
    return conn, cursor
