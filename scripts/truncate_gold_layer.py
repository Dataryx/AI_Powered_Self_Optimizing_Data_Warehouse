#!/usr/bin/env python3
"""
Truncate Gold Layer Tables
This script truncates all tables in the Gold layer only.
Tables are truncated in reverse dependency order to handle foreign keys properly.
"""

import sys
import logging
import psycopg2
import os
from pathlib import Path
from datetime import datetime

# Configure logging
log_file = Path(__file__).parent / "truncate_gold_layer.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def get_table_counts(connection, schema, tables):
    """Get record counts for tables before truncation."""
    counts = {}
    cursor = connection.cursor()
    for table in tables:
        try:
            cursor.execute(f"SELECT COUNT(*) FROM {schema}.{table};")
            counts[table] = cursor.fetchone()[0]
        except Exception as e:
            logger.warning(f"Could not get count for {schema}.{table}: {e}")
            counts[table] = 0
    cursor.close()
    return counts


def truncate_gold_layer(connection):
    """Truncate all tables in Gold layer."""
    cursor = connection.cursor()
    
    # Gold layer tables (in reverse dependency order - aggregates first, then facts, then dimensions)
    # This order ensures foreign key constraints are respected
    gold_tables = [
        # Aggregates (depend on facts and dimensions)
        'agg_sales_rep_performance',  # References dim_employee
        'agg_customer_lifetime',      # References dim_customer
        'agg_monthly_product_sales',  # Standalone aggregate
        'agg_daily_sales',            # References dim_date
        
        # Facts (depend on dimensions)
        'fact_orders',                # References dim_customer, dim_employee, dim_date, dim_location, dim_warehouse
        'fact_inventory_snapshot',    # References dim_product, dim_warehouse, dim_date
        'fact_sales',                 # References dim_customer, dim_product, dim_employee, dim_date, dim_location, dim_warehouse, dim_promotion
        
        # Dimensions (may depend on other dimensions)
        'dim_promotion',              # Standalone dimension
        'dim_warehouse',              # References dim_location
        'dim_location',               # Standalone dimension
        'dim_employee',               # References dim_location
        'dim_product',                # Standalone dimension
        'dim_customer',               # References dim_location
        'dim_date',                   # Root dimension (no dependencies)
    ]
    
    start_time = datetime.now()
    
    logger.info("=" * 80)
    logger.info("TRUNCATING GOLD LAYER TABLES")
    logger.info("=" * 80)
    logger.info(f"Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("")
    logger.info(f"This will truncate {len(gold_tables)} tables in the Gold layer:")
    for i, table in enumerate(gold_tables, 1):
        logger.info(f"  {i:2d}. gold.{table}")
    logger.info("")
    logger.info("=" * 80)
    logger.info("")
    
    # Get counts before truncation
    logger.info("Getting record counts before truncation...")
    counts_before = get_table_counts(connection, 'gold', gold_tables)
    total_records_before = sum(counts_before.values())
    
    logger.info("")
    logger.info("Current Gold Layer Record Counts:")
    logger.info("-" * 80)
    for table in gold_tables:
        count = counts_before.get(table, 0)
        logger.info(f"  {table:30s}: {count:>15,} records")
    logger.info("-" * 80)
    logger.info(f"  {'TOTAL':30s}: {total_records_before:>15,} records")
    logger.info("")
    
    # Truncate tables
    logger.info("=" * 80)
    logger.info("TRUNCATING TABLES")
    logger.info("=" * 80)
    logger.info("")
    
    truncated = 0
    errors = 0
    error_details = []
    
    for table in gold_tables:
        try:
            # Get count before truncation for logging
            count_before = counts_before.get(table, 0)
            
            # Truncate with CASCADE to handle any dependent objects
            cursor.execute(f"TRUNCATE TABLE gold.{table} CASCADE;")
            connection.commit()
            
            logger.info(f"  [OK] Truncated gold.{table:30s} ({count_before:>15,} records removed)")
            truncated += 1
            
        except Exception as e:
            logger.error(f"  [FAIL] Could not truncate gold.{table}: {e}")
            errors += 1
            error_details.append((table, str(e)))
            connection.rollback()
    
    # Verify truncation
    logger.info("")
    logger.info("=" * 80)
    logger.info("VERIFYING TRUNCATION")
    logger.info("=" * 80)
    logger.info("")
    
    counts_after = get_table_counts(connection, 'gold', gold_tables)
    total_records_after = sum(counts_after.values())
    
    all_empty = True
    for table in gold_tables:
        count_after = counts_after.get(table, 0)
        if count_after > 0:
            logger.warning(f"  [WARN] gold.{table:30s}: {count_after:>15,} records remaining (should be 0)")
            all_empty = False
        else:
            logger.info(f"  [OK] gold.{table:30s}: {count_after:>15,} records (empty)")
    
    logger.info("")
    logger.info("-" * 80)
    logger.info(f"  {'TOTAL AFTER':30s}: {total_records_after:>15,} records")
    logger.info("-" * 80)
    
    # Final Summary
    end_time = datetime.now()
    duration = (end_time - start_time).total_seconds()
    
    logger.info("")
    logger.info("=" * 80)
    logger.info("TRUNCATION SUMMARY")
    logger.info("=" * 80)
    logger.info(f"Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"End Time: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Duration: {duration:.2f} seconds ({duration/60:.2f} minutes)")
    logger.info("")
    logger.info("Results:")
    logger.info(f"  Tables truncated: {truncated}/{len(gold_tables)}")
    logger.info(f"  Errors: {errors}")
    logger.info(f"  Records removed: {total_records_before:,}")
    logger.info(f"  Records remaining: {total_records_after:,}")
    logger.info("")
    
    if all_empty and errors == 0:
        logger.info("[OK] All Gold layer tables successfully truncated!")
    elif errors > 0:
        logger.warning(f"[WARN] {errors} error(s) occurred during truncation:")
        for table, error in error_details:
            logger.warning(f"  - gold.{table}: {error}")
    elif not all_empty:
        logger.warning("[WARN] Some tables still have records. Please check manually.")
    
    logger.info("=" * 80)
    logger.info("")
    
    cursor.close()
    
    return {
        'tables_truncated': truncated,
        'tables_errors': errors,
        'records_removed': total_records_before,
        'records_remaining': total_records_after,
        'duration': duration,
        'all_empty': all_empty
    }


def main():
    """Main function."""
    logger.info("=" * 80)
    logger.info("TRUNCATE GOLD LAYER SCRIPT")
    logger.info("=" * 80)
    logger.info("")
    logger.info("This script will truncate ALL tables in the Gold layer.")
    logger.info("This action cannot be undone!")
    logger.info("")
    logger.info("[WARN] WARNING: This will delete all aggregated data in the Gold layer.")
    logger.info("   Bronze layer data will NOT be affected.")
    logger.info("   Silver layer data will NOT be affected.")
    logger.info("")
    
    # Database connection
    try:
        connection = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", "5432")),
            database=os.getenv("POSTGRES_DB", "datawarehouse"),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "postgres")
        )
        logger.info("[OK] Connected to database")
        logger.info("")
    except Exception as e:
        logger.error(f"[FAIL] Failed to connect to database: {e}")
        sys.exit(1)
    
    try:
        # Truncate Gold layer
        summary = truncate_gold_layer(connection)
        
        logger.info("")
        logger.info("Script completed!")
        logger.info(f"Log file saved to: {log_file}")
        
        if summary['tables_errors'] > 0:
            logger.warning(f"[WARN] Warning: {summary['tables_errors']} error(s) occurred during truncation.")
            logger.warning("Please review the log file for details.")
            sys.exit(1)
        elif not summary['all_empty']:
            logger.warning("[WARN] Warning: Some tables still contain records.")
            logger.warning("Please review the verification section above.")
            sys.exit(1)
        else:
            logger.info("[OK] All Gold layer tables truncated successfully!")
            logger.info(f"  Removed {summary['records_removed']:,} records")
            sys.exit(0)
            
    except Exception as e:
        logger.error(f"Error during truncation: {e}", exc_info=True)
        sys.exit(1)
    finally:
        connection.close()
        logger.info("\nDatabase connection closed.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\nProcess interrupted by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)













