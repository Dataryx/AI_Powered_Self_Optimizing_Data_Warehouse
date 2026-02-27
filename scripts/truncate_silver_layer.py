#!/usr/bin/env python3
"""
Truncate Silver Layer Tables
This script truncates all tables in the Silver layer only.
Tables are truncated in reverse dependency order to handle foreign keys properly.
"""

import sys
import logging
import psycopg2
import os
from pathlib import Path
from datetime import datetime

# Configure logging
log_file = Path(__file__).parent / "truncate_silver_layer.log"
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


def truncate_silver_layer(connection):
    """Truncate all tables in Silver layer."""
    cursor = connection.cursor()
    
    # Silver layer tables (in reverse dependency order - child tables first)
    # This order ensures foreign key constraints are respected
    silver_tables = [
        'order_item',           # Child of orders (references order_key)
        'orders',               # Child of customer, employee (references customer_key, sales_rep_key)
        'customer',             # Child of person, customer_employee (references person_key, customer_employee_key)
        'employee',             # Child of person, employment_jobs (references person_key, job_key)
        'customer_employee',    # Child of customer_company (references company_key)
        'person_location',      # Child of person, location (references person_key, location_key)
        'phone_number',         # Child of person, location (references person_key, location_key)
        'restricted_info',      # Child of person (references person_key)
        'inventory',            # Child of product, warehouse (references product_key, warehouse_key)
        'warehouse',            # Child of location (references location_key)
        'product',              # Standalone (no foreign keys to other silver tables)
        'location',             # Child of country (references country_key)
        'person',               # Standalone (no foreign keys to other silver tables)
        'customer_company',     # Standalone (no foreign keys to other silver tables)
        'employment_jobs',      # Child of country (references country_key)
        'country',              # Root table (no dependencies)
    ]
    
    start_time = datetime.now()
    
    logger.info("=" * 80)
    logger.info("TRUNCATING SILVER LAYER TABLES")
    logger.info("=" * 80)
    logger.info(f"Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("")
    logger.info(f"This will truncate {len(silver_tables)} tables in the Silver layer:")
    for i, table in enumerate(silver_tables, 1):
        logger.info(f"  {i:2d}. silver.{table}")
    logger.info("")
    logger.info("=" * 80)
    logger.info("")
    
    # Get counts before truncation
    logger.info("Getting record counts before truncation...")
    counts_before = get_table_counts(connection, 'silver', silver_tables)
    total_records_before = sum(counts_before.values())
    
    logger.info("")
    logger.info("Current Silver Layer Record Counts:")
    logger.info("-" * 80)
    for table in silver_tables:
        count = counts_before.get(table, 0)
        logger.info(f"  {table:25s}: {count:>15,} records")
    logger.info("-" * 80)
    logger.info(f"  {'TOTAL':25s}: {total_records_before:>15,} records")
    logger.info("")
    
    # Truncate tables
    logger.info("=" * 80)
    logger.info("TRUNCATING TABLES")
    logger.info("=" * 80)
    logger.info("")
    
    truncated = 0
    errors = 0
    error_details = []
    
    for table in silver_tables:
        try:
            # Get count before truncation for logging
            count_before = counts_before.get(table, 0)
            
            # Truncate with CASCADE to handle any dependent objects
            cursor.execute(f"TRUNCATE TABLE silver.{table} CASCADE;")
            connection.commit()
            
            logger.info(f"  ✓ Truncated silver.{table:25s} ({count_before:>15,} records removed)")
            truncated += 1
            
        except Exception as e:
            logger.error(f"  ✗ Could not truncate silver.{table}: {e}")
            errors += 1
            error_details.append((table, str(e)))
            connection.rollback()
    
    # Verify truncation
    logger.info("")
    logger.info("=" * 80)
    logger.info("VERIFYING TRUNCATION")
    logger.info("=" * 80)
    logger.info("")
    
    counts_after = get_table_counts(connection, 'silver', silver_tables)
    total_records_after = sum(counts_after.values())
    
    all_empty = True
    for table in silver_tables:
        count_after = counts_after.get(table, 0)
        if count_after > 0:
            logger.warning(f"  ⚠ silver.{table:25s}: {count_after:>15,} records remaining (should be 0)")
            all_empty = False
        else:
            logger.info(f"  ✓ silver.{table:25s}: {count_after:>15,} records (empty)")
    
    logger.info("")
    logger.info("-" * 80)
    logger.info(f"  {'TOTAL AFTER':25s}: {total_records_after:>15,} records")
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
    logger.info(f"  Tables truncated: {truncated}/{len(silver_tables)}")
    logger.info(f"  Errors: {errors}")
    logger.info(f"  Records removed: {total_records_before:,}")
    logger.info(f"  Records remaining: {total_records_after:,}")
    logger.info("")
    
    if all_empty and errors == 0:
        logger.info("✓ All Silver layer tables successfully truncated!")
    elif errors > 0:
        logger.warning(f"⚠ {errors} error(s) occurred during truncation:")
        for table, error in error_details:
            logger.warning(f"  - silver.{table}: {error}")
    elif not all_empty:
        logger.warning("⚠ Some tables still have records. Please check manually.")
    
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
    logger.info("TRUNCATE SILVER LAYER SCRIPT")
    logger.info("=" * 80)
    logger.info("")
    logger.info("This script will truncate ALL tables in the Silver layer.")
    logger.info("This action cannot be undone!")
    logger.info("")
    logger.info("⚠ WARNING: This will delete all transformed data in the Silver layer.")
    logger.info("   Bronze layer data will NOT be affected.")
    logger.info("   Gold layer data will NOT be affected.")
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
        logger.info("✓ Connected to database")
        logger.info("")
    except Exception as e:
        logger.error(f"✗ Failed to connect to database: {e}")
        sys.exit(1)
    
    try:
        # Truncate Silver layer
        summary = truncate_silver_layer(connection)
        
        logger.info("")
        logger.info("Script completed!")
        logger.info(f"Log file saved to: {log_file}")
        
        if summary['tables_errors'] > 0:
            logger.warning(f"⚠ Warning: {summary['tables_errors']} error(s) occurred during truncation.")
            logger.warning("Please review the log file for details.")
            sys.exit(1)
        elif not summary['all_empty']:
            logger.warning("⚠ Warning: Some tables still contain records.")
            logger.warning("Please review the verification section above.")
            sys.exit(1)
        else:
            logger.info("✓ All Silver layer tables truncated successfully!")
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













