"""
Query Log Collection Runner
Runs the ML optimization query log collection and analysis.
"""

import sys
import logging
import psycopg2
import os
from pathlib import Path

# Add parent directory to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "ml-optimization"))

# Try to import - adjust path if needed
try:
    from collectors.query_log_collector import QueryLogCollector
except ImportError:
    # Fallback: try absolute import
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "query_log_collector",
        project_root / "ml-optimization" / "collectors" / "query_log_collector.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    QueryLogCollector = module.QueryLogCollector

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run_query_collection():
    """Run query log collection from pg_stat_statements."""
    
    # Database connection string
    db_conn_str = (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'datawarehouse')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASSWORD', 'postgres')}"
    )
    
    try:
        logger.info("=" * 60)
        logger.info("Starting Query Log Collection")
        logger.info("=" * 60)
        
        # Initialize collector
        collector = QueryLogCollector(db_conn_str, schema="ml_optimization")
        
        # Collect and store query statistics
        count = collector.collect_and_store()
        
        logger.info("=" * 60)
        logger.info(f"Query Log Collection Complete!")
        logger.info(f"Collected {count} query log records")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Error in query log collection: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    run_query_collection()

