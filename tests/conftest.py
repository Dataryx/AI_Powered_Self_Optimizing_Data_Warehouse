"""
Pytest Configuration
Shared fixtures and configuration for all tests.
"""

import pytest
import psycopg2
import os
from typing import Generator
import sys

# Add project root to path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))


@pytest.fixture(scope="session")
def db_connection_string() -> str:
    """Database connection string for tests."""
    return os.getenv(
        "TEST_DB_CONNECTION_STRING",
        "postgresql://postgres:postgres@localhost:5432/datawarehouse_test"
    )


@pytest.fixture(scope="function")
def db_connection(db_connection_string: str) -> Generator:
    """Database connection fixture."""
    conn = psycopg2.connect(db_connection_string)
    conn.autocommit = True
    yield conn
    conn.close()


@pytest.fixture(scope="function")
def test_schema(db_connection):
    """Create test schema and clean up after."""
    cursor = db_connection.cursor()
    cursor.execute("CREATE SCHEMA IF NOT EXISTS test_schema")
    yield "test_schema"
    cursor.execute("DROP SCHEMA IF EXISTS test_schema CASCADE")
    cursor.close()


@pytest.fixture(scope="session")
def api_base_url() -> str:
    """API base URL for integration tests."""
    return os.getenv("TEST_API_URL", "http://localhost:8000/api/v1")


@pytest.fixture(scope="session")
def redis_client():
    """Redis client fixture."""
    import redis
    redis_url = os.getenv("TEST_REDIS_URL", "redis://localhost:6379")
    client = redis.from_url(redis_url)
    yield client
    client.close()


