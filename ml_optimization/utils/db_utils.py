"""
Database Utilities
Common database connection and utility functions.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from contextlib import contextmanager
from typing import Optional
import os
import logging

logger = logging.getLogger(__name__)


def get_db_connection_string() -> str:
    """
    Get database connection string from environment variables.
    
    Returns:
        PostgreSQL connection string
    """
    user = os.getenv('POSTGRES_USER', 'postgres')
    password = os.getenv('POSTGRES_PASSWORD', 'postgres')
    host = os.getenv('POSTGRES_HOST', 'localhost')
    port = os.getenv('POSTGRES_PORT', '5432')
    database = os.getenv('POSTGRES_DB', 'datawarehouse')
    
    return f"postgresql://{user}:{password}@{host}:{port}/{database}"


@contextmanager
def get_db_connection(connection_string: Optional[str] = None):
    """
    Context manager for database connections.
    
    Usage:
        with get_db_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT 1")
    """
    if connection_string is None:
        connection_string = get_db_connection_string()
    
    conn = None
    try:
        conn = psycopg2.connect(connection_string)
        yield conn
        conn.commit()
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Database error: {e}")
        raise
    finally:
        if conn:
            conn.close()


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

