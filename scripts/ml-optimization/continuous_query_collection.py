#!/usr/bin/env python3
"""
Continuous Query Collection Service
Continuously collects query statistics from pg_stat_statements and stores them.
"""

import sys
import logging
import psycopg2
import os
import time
from pathlib import Path
from datetime import datetime

# Add parent directory to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "ml-optimization"))

try:
    from collectors.query_log_collector import QueryLogCollector
except ImportError:
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


def run_continuous_collection(interval_seconds: int = 300):
    """
    Run continuous query collection.
    
    Args:
        interval_seconds: Time interval between collections (default: 5 minutes)
    """
    # Database connection string
    db_conn_str = (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'datawarehouse')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASSWORD', 'postgres')}"
    )
    
    logger.info("=" * 60)
    logger.info("Starting Continuous Query Collection Service")
    logger.info("=" * 60)
    logger.info(f"Collection interval: {interval_seconds} seconds ({interval_seconds/60:.1f} minutes)")
    logger.info("Press Ctrl+C to stop")
    logger.info("=" * 60)
    
    try:
        # Initialize collector
        collector = QueryLogCollector(db_conn_str, schema="ml_optimization")
        
        collection_count = 0
        
        while True:
            try:
                logger.info(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Starting collection cycle #{collection_count + 1}...")
                
                # Collect and store query statistics
                count = collector.collect_and_store()
                
                collection_count += 1
                
                if count > 0:
                    logger.info(f"  Collected {count} query log records")
                else:
                    logger.warning("  No new query statistics collected (pg_stat_statements may not be enabled)")
                
                logger.info(f"  Next collection in {interval_seconds} seconds...")
                
            except KeyboardInterrupt:
                logger.info("\n" + "=" * 60)
                logger.info("Stopping continuous collection service...")
                logger.info(f"Total collections performed: {collection_count}")
                logger.info("=" * 60)
                break
                
            except Exception as e:
                logger.error(f"Error during collection cycle: {e}", exc_info=True)
                logger.info(f"Retrying in {interval_seconds} seconds...")
            
            # Wait for next collection
            time.sleep(interval_seconds)
            
    except Exception as e:
        logger.error(f"Fatal error in continuous collection service: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Continuous Query Collection Service")
    parser.add_argument(
        "--interval",
        type=int,
        default=300,
        help="Collection interval in seconds (default: 300 = 5 minutes)"
    )
    
    args = parser.parse_args()
    
    run_continuous_collection(interval_seconds=args.interval)

