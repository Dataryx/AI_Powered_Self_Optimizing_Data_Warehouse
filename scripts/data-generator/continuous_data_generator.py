#!/usr/bin/env python3
"""
Continuous Data Generator
Generates data/executes queries every minute to create real-time workload.
"""

import psycopg2
import os
import time
import logging
import random
from datetime import datetime
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def generate_queries(connection, interval_seconds: int = 60):
    """
    Generate and execute queries at regular intervals.
    
    Args:
        connection: Database connection
        interval_seconds: Time interval between query batches (default: 60 seconds = 1 minute)
    """
    cursor = connection.cursor()
    
    # Queries to execute regularly
    query_templates = [
        # Database/system queries
        "SELECT COUNT(*) FROM information_schema.tables",
        "SELECT COUNT(*) FROM information_schema.columns",
        "SELECT COUNT(*) FROM pg_database",
        "SELECT COUNT(*) FROM pg_namespace",
        "SELECT COUNT(*) FROM pg_class",
        "SELECT COUNT(*) FROM pg_attribute",
        "SELECT current_database(), current_user, version()",
        "SELECT NOW(), current_timestamp",
        
        # ML optimization schema queries
        "SELECT COUNT(*) FROM ml_optimization.query_logs",
        "SELECT COUNT(*) FROM ml_optimization.index_recommendations",
        "SELECT table_name FROM information_schema.tables WHERE table_schema = 'ml_optimization'",
        
        # Statistics queries
        "SELECT schemaname, COUNT(*) as table_count FROM pg_tables GROUP BY schemaname",
        "SELECT datname, pg_database_size(datname) FROM pg_database WHERE datname = current_database()",
    ]
    
    logger.info("=" * 60)
    logger.info("Starting Continuous Data Generator")
    logger.info("=" * 60)
    logger.info(f"Query interval: {interval_seconds} seconds ({interval_seconds/60:.1f} minutes)")
    logger.info(f"Queries per interval: {len(query_templates)}")
    logger.info("Press Ctrl+C to stop")
    logger.info("=" * 60)
    
    cycle_count = 0
    
    try:
        while True:
            cycle_count += 1
            logger.info(f"\n[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Generating query batch #{cycle_count}...")
            
            executed = 0
            total_time = 0.0
            
            # Execute each query
            for i, query in enumerate(query_templates, 1):
                try:
                    start_time = time.time()
                    cursor.execute(query)
                    result = cursor.fetchall()
                    elapsed = time.time() - start_time
                    total_time += elapsed
                    executed += 1
                    
                    logger.debug(f"  Query {i}/{len(query_templates)}: {elapsed:.3f}s - {len(result)} rows")
                    
                    # Small delay between queries
                    time.sleep(0.1)
                    
                except Exception as e:
                    logger.warning(f"  Query {i} failed: {e}")
            
            logger.info(f"  Executed {executed}/{len(query_templates)} queries in {total_time:.3f}s")
            logger.info(f"  Next batch in {interval_seconds} seconds...")
            
            # Wait for next interval
            time.sleep(interval_seconds)
            
    except KeyboardInterrupt:
        logger.info("\n" + "=" * 60)
        logger.info("Stopping continuous data generator...")
        logger.info(f"Total cycles completed: {cycle_count}")
        logger.info("=" * 60)
    finally:
        cursor.close()


def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Continuous Data Generator")
    parser.add_argument(
        "--interval",
        type=int,
        default=60,
        help="Interval between query batches in seconds (default: 60 = 1 minute)"
    )
    
    args = parser.parse_args()
    
    # Database connection
    db_conn_str = (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'datawarehouse')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASSWORD', 'postgres')}"
    )
    
    try:
        connection = psycopg2.connect(db_conn_str)
        connection.autocommit = True
        logger.info("Connected to database successfully")
        
        generate_queries(connection, interval_seconds=args.interval)
        
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
    finally:
        if 'connection' in locals():
            connection.close()


if __name__ == "__main__":
    main()

