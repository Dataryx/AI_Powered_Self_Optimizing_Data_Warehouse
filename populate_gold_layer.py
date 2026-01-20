"""
Populate Gold Layer from Silver Layer
This script aggregates data from Silver to Gold layer with detailed logging
for each aggregation step.
"""

import sys
import logging
import psycopg2
import os
import time
from pathlib import Path
from datetime import datetime, date, timedelta

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from etl.aggregators.silver_to_gold import SilverToGoldAggregator

# Configure logging
log_file = Path(__file__).parent / "populate_gold.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - [%(levelname)s] - %(message)s',
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def get_table_count(connection, schema, table):
    """Get count of records in a table."""
    try:
        cursor = connection.cursor()
        cursor.execute(f"SELECT COUNT(*) FROM {schema}.{table};")
        count = cursor.fetchone()[0]
        cursor.close()
        return count
    except Exception as e:
        logger.warning(f"Could not get count for {schema}.{table}: {e}")
        return 0


def get_date_range_from_silver(connection):
    """Get the date range of orders in silver.orders."""
    try:
        cursor = connection.cursor()
        cursor.execute("""
            SELECT MIN(order_date) as min_date, MAX(order_date) as max_date
            FROM silver.orders
        """)
        result = cursor.fetchone()
        cursor.close()
        if result and result[0] and result[1]:
            return result[0], result[1]
        return None, None
    except Exception as e:
        logger.warning(f"Could not get date range: {e}")
        return None, None


def populate_gold_layer(days_to_aggregate=30, force_repopulate=False):
    """
    Populate Gold layer from Silver layer.
    
    Args:
        days_to_aggregate: Number of days to aggregate for daily sales (default: 30)
        force_repopulate: If True, truncate and repopulate all tables (default: False)
    """
    start_time = datetime.now()
    
    logger.info("=" * 80)
    logger.info("POPULATE GOLD LAYER FROM SILVER LAYER")
    logger.info("=" * 80)
    logger.info(f"Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Days to Aggregate: {days_to_aggregate}")
    logger.info(f"Force Repopulate: {force_repopulate}")
    logger.info("")
    
    # Database connection
    connection = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "datawarehouse"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres")
    )
    
    try:
        # Check Silver layer prerequisites
        logger.info("-" * 80)
        logger.info("PREREQUISITE CHECKS")
        logger.info("-" * 80)
        
        silver_orders = get_table_count(connection, "silver", "orders")
        silver_order_items = get_table_count(connection, "silver", "order_item")
        silver_customers = get_table_count(connection, "silver", "customer")
        silver_products = get_table_count(connection, "silver", "product")
        
        logger.info(f"Silver Orders:           {silver_orders:>15,} records")
        logger.info(f"Silver Order Items:     {silver_order_items:>15,} records")
        logger.info(f"Silver Customers:       {silver_customers:>15,} records")
        logger.info(f"Silver Products:        {silver_products:>15,} records")
        logger.info("")
        
        if silver_orders == 0:
            logger.error("ERROR: silver.orders table is empty. Cannot aggregate Gold layer.")
            logger.error("Please populate Silver layer first.")
            return
        
        # Get date range
        min_date, max_date = get_date_range_from_silver(connection)
        if min_date and max_date:
            logger.info(f"Order Date Range:       {min_date} to {max_date}")
            logger.info("")
        
        # Check current Gold layer status
        logger.info("-" * 80)
        logger.info("CURRENT GOLD LAYER STATUS")
        logger.info("-" * 80)
        
        gold_daily_sales = get_table_count(connection, "gold", "agg_daily_sales")
        gold_customer_lifetime = get_table_count(connection, "gold", "agg_customer_lifetime")
        gold_monthly_product = get_table_count(connection, "gold", "agg_monthly_product_sales")
        
        logger.info(f"Gold Daily Sales:        {gold_daily_sales:>15,} records")
        logger.info(f"Gold Customer Lifetime:  {gold_customer_lifetime:>15,} records")
        logger.info(f"Gold Monthly Product:    {gold_monthly_product:>15,} records")
        logger.info("")
        
        # Force repopulate if requested
        if force_repopulate:
            logger.info("-" * 80)
            logger.info("TRUNCATING GOLD LAYER TABLES")
            logger.info("-" * 80)
            cursor = connection.cursor()
            try:
                cursor.execute("TRUNCATE TABLE gold.agg_daily_sales CASCADE")
                logger.info("  Truncated gold.agg_daily_sales")
                cursor.execute("TRUNCATE TABLE gold.agg_customer_lifetime CASCADE")
                logger.info("  Truncated gold.agg_customer_lifetime")
                cursor.execute("TRUNCATE TABLE gold.agg_monthly_product_sales CASCADE")
                logger.info("  Truncated gold.agg_monthly_product_sales")
                connection.commit()
                logger.info("")
            except Exception as e:
                logger.error(f"Error truncating tables: {e}")
                connection.rollback()
                cursor.close()
                return
            finally:
                cursor.close()
        
        # Initialize aggregator
        aggregator = SilverToGoldAggregator(connection)
        
        # ========================================================================
        # STEP 1: Aggregate Daily Sales
        # ========================================================================
        logger.info("=" * 80)
        logger.info("STEP 1/3: AGGREGATING DAILY SALES")
        logger.info("=" * 80)
        logger.info(f"Processing last {days_to_aggregate} days of sales data...")
        logger.info("")
        
        daily_start = time.time()
        daily_before = get_table_count(connection, "gold", "agg_daily_sales")
        daily_processed = 0
        daily_success = 0
        
        # Determine date range to process
        if min_date and max_date:
            # Process from max_date backwards
            end_date = max_date
            start_date = max(end_date - timedelta(days=days_to_aggregate - 1), min_date)
            current_date = end_date
            total_days = (end_date - start_date).days + 1
        else:
            # Fallback: process last N days from today
            end_date = date.today() - timedelta(days=1)
            start_date = end_date - timedelta(days=days_to_aggregate - 1)
            current_date = end_date
            total_days = days_to_aggregate
        
        logger.info(f"Date Range: {start_date} to {end_date} ({total_days} days)")
        logger.info("")
        
        while current_date >= start_date:
            day_start = time.time()
            result = aggregator.aggregate_daily_sales(current_date)
            day_elapsed = time.time() - day_start
            
            daily_processed += 1
            if result > 0:
                daily_success += 1
            
            if daily_processed % 5 == 0 or daily_processed == total_days:
                progress_pct = (daily_processed / total_days) * 100
                logger.info(f"  Processed {daily_processed}/{total_days} days ({progress_pct:.1f}%) - "
                          f"Last: {current_date} ({day_elapsed:.2f}s)")
            
            current_date -= timedelta(days=1)
        
        daily_elapsed = time.time() - daily_start
        daily_after = get_table_count(connection, "gold", "agg_daily_sales")
        daily_added = daily_after - daily_before
        
        logger.info("")
        logger.info(f"✓ Daily Sales Aggregation Complete")
        logger.info(f"  Days Processed:        {daily_processed:,}")
        logger.info(f"  Days with Data:        {daily_success:,}")
        logger.info(f"  Records Before:       {daily_before:,}")
        logger.info(f"  Records After:        {daily_after:,}")
        logger.info(f"  Records Added:         {daily_added:,}")
        logger.info(f"  Time Taken:            {daily_elapsed:.2f}s ({daily_elapsed/60:.2f} min)")
        if daily_processed > 0:
            logger.info(f"  Average per Day:       {daily_elapsed/daily_processed:.2f}s")
        logger.info("")
        
        # ========================================================================
        # STEP 2: Aggregate Customer Lifetime Value
        # ========================================================================
        logger.info("=" * 80)
        logger.info("STEP 2/3: AGGREGATING CUSTOMER LIFETIME VALUE")
        logger.info("=" * 80)
        logger.info("Calculating RFM scores, customer segments, and lifetime metrics...")
        logger.info("")
        
        customer_start = time.time()
        customer_before = get_table_count(connection, "gold", "agg_customer_lifetime")
        
        # Check if table has data and we're not forcing repopulate
        if customer_before > 0 and not force_repopulate:
            logger.info(f"⚠ Table already has {customer_before:,} records. Skipping.")
            logger.info("  Use force_repopulate=True to repopulate.")
            customer_count = 0
        else:
            customer_count = aggregator.aggregate_customer_lifetime()
        
        customer_elapsed = time.time() - customer_start
        customer_after = get_table_count(connection, "gold", "agg_customer_lifetime")
        customer_added = customer_after - customer_before
        
        logger.info("")
        logger.info(f"✓ Customer Lifetime Aggregation Complete")
        logger.info(f"  Records Before:        {customer_before:,}")
        logger.info(f"  Records After:         {customer_after:,}")
        logger.info(f"  Records Added:         {customer_added:,}")
        logger.info(f"  Time Taken:            {customer_elapsed:.2f}s ({customer_elapsed/60:.2f} min)")
        if customer_count > 0:
            logger.info(f"  Average Speed:          {customer_count/customer_elapsed:,.0f} records/second")
        logger.info("")
        
        # ========================================================================
        # STEP 3: Aggregate Monthly Product Sales
        # ========================================================================
        logger.info("=" * 80)
        logger.info("STEP 3/3: AGGREGATING MONTHLY PRODUCT SALES")
        logger.info("=" * 80)
        logger.info("Calculating monthly sales by product category...")
        logger.info("")
        
        product_start = time.time()
        product_before = get_table_count(connection, "gold", "agg_monthly_product_sales")
        
        # Check if table has data and we're not forcing repopulate
        if product_before > 0 and not force_repopulate:
            logger.info(f"⚠ Table already has {product_before:,} records. Skipping.")
            logger.info("  Use force_repopulate=True to repopulate.")
            product_count = 0
        else:
            product_count = aggregator.aggregate_monthly_product_sales()
        
        product_elapsed = time.time() - product_start
        product_after = get_table_count(connection, "gold", "agg_monthly_product_sales")
        product_added = product_after - product_before
        
        logger.info("")
        logger.info(f"✓ Monthly Product Sales Aggregation Complete")
        logger.info(f"  Records Before:        {product_before:,}")
        logger.info(f"  Records After:         {product_after:,}")
        logger.info(f"  Records Added:         {product_added:,}")
        logger.info(f"  Time Taken:            {product_elapsed:.2f}s ({product_elapsed/60:.2f} min)")
        if product_count > 0:
            logger.info(f"  Average Speed:          {product_count/product_elapsed:,.0f} records/second")
        logger.info("")
        
        # ========================================================================
        # FINAL SUMMARY
        # ========================================================================
        end_time = datetime.now()
        total_elapsed = (end_time - start_time).total_seconds()
        
        logger.info("")
        logger.info("=" * 80)
        logger.info("GOLD LAYER POPULATION COMPLETE")
        logger.info("=" * 80)
        logger.info("FINAL SUMMARY:")
        logger.info("-" * 80)
        logger.info(f"Daily Sales Records:     {daily_after:>15,} records")
        logger.info(f"Customer Lifetime:       {customer_after:>15,} records")
        logger.info(f"Monthly Product Sales:   {product_after:>15,} records")
        logger.info("")
        logger.info(f"Total Time:              {total_elapsed:>15.2f} seconds ({total_elapsed/60:.2f} minutes)")
        logger.info(f"End Time:                {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("=" * 80)
        
        # Verify completion
        logger.info("")
        logger.info("VERIFICATION:")
        logger.info("-" * 80)
        if daily_success > 0:
            logger.info(f"✓ Daily sales aggregated for {daily_success} days")
        else:
            logger.warning("⚠ No daily sales data aggregated")
        
        if customer_after > 0:
            logger.info(f"✓ Customer lifetime data aggregated for {customer_after:,} customers")
        else:
            logger.warning("⚠ No customer lifetime data aggregated")
        
        if product_after > 0:
            logger.info(f"✓ Monthly product sales aggregated for {product_after:,} category-month combinations")
        else:
            logger.warning("⚠ No monthly product sales data aggregated")
        
        logger.info("")
        
    except Exception as e:
        logger.error(f"Error during aggregation: {e}", exc_info=True)
        connection.rollback()
        raise
    finally:
        connection.close()
        logger.info("Database connection closed.")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Populate Gold layer from Silver layer")
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of days to aggregate for daily sales (default: 30)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force repopulate all tables (truncate and repopulate)"
    )
    
    args = parser.parse_args()
    
    try:
        populate_gold_layer(days_to_aggregate=args.days, force_repopulate=args.force)
    except KeyboardInterrupt:
        logger.info("")
        logger.info("Aggregation interrupted by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)





