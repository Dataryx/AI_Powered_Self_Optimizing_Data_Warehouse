#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Populate Data Warehouse with Large-Scale E-Commerce Data
Generates and loads comprehensive e-commerce data into Bronze, Silver, and Gold layers.
"""

import sys
import os
import logging
from pathlib import Path
from datetime import datetime, timedelta

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)
logger = logging.getLogger(__name__)

def main():
    """Main function to populate the warehouse."""
    
    logger.info("=" * 80)
    logger.info("LARGE-SCALE E-COMMERCE DATA WAREHOUSE POPULATION")
    logger.info("=" * 80)
    
    # Large-scale configuration for big e-commerce data warehouse
    config_params = {
        'num_customers': 100000,      # 100K customers
        'num_products': 50000,        # 50K products
        'days_of_data': 730,          # 2 years of data
        'orders_per_day_range': (500, 2000),  # 500-2000 orders per day
        'sessions_per_day': 10000,    # 10K sessions per day
        'events_per_session_range': (10, 50),  # 10-50 events per session
        'batch_size': 5000,           # Larger batches for performance
    }
    
    logger.info("\nConfiguration:")
    logger.info(f"  Customers: {config_params['num_customers']:,}")
    logger.info(f"  Products: {config_params['num_products']:,}")
    logger.info(f"  Days of Data: {config_params['days_of_data']}")
    logger.info(f"  Orders per Day: {config_params['orders_per_day_range'][0]}-{config_params['orders_per_day_range'][1]}")
    logger.info(f"  Sessions per Day: {config_params['sessions_per_day']:,}")
    logger.info(f"  Expected Total Orders: ~{sum(config_params['orders_per_day_range']) // 2 * config_params['days_of_data']:,}")
    
    try:
        # Step 1: Generate and load Bronze layer data
        logger.info("\n" + "=" * 80)
        logger.info("STEP 1: GENERATING AND LOADING BRONZE LAYER DATA")
        logger.info("=" * 80)
        
        # Import data generator
        sys.path.insert(0, str(Path(__file__).parent / "data-generator"))
        from config import DataGeneratorConfig
        from main import generate_data
        
        # Create config with large-scale parameters
        config = DataGeneratorConfig(
            num_customers=config_params['num_customers'],
            num_products=config_params['num_products'],
            days_of_data=config_params['days_of_data'],
            orders_per_day_range=config_params['orders_per_day_range'],
            sessions_per_day=config_params['sessions_per_day'],
            events_per_session_range=config_params['events_per_session_range'],
            batch_size=config_params['batch_size'],
            random_seed=42
        )
        
        # Generate and load data
        generate_data(config, load=True)
        
        logger.info("\n" + "=" * 80)
        logger.info("BRONZE LAYER DATA LOADED SUCCESSFULLY")
        logger.info("=" * 80)
        
        # Step 2: Transform Bronze to Silver
        logger.info("\n" + "=" * 80)
        logger.info("STEP 2: TRANSFORMING BRONZE TO SILVER LAYER")
        logger.info("=" * 80)
        
        sys.path.insert(0, str(Path(__file__).parent / "etl"))
        from transformers.bronze_to_silver import BronzeToSilverTransformer
        import psycopg2
        
        conn = psycopg2.connect(
            host=os.getenv("POSTGRES_HOST", "localhost"),
            port=int(os.getenv("POSTGRES_PORT", "5432")),
            database=os.getenv("POSTGRES_DB", "datawarehouse"),
            user=os.getenv("POSTGRES_USER", "postgres"),
            password=os.getenv("POSTGRES_PASSWORD", "postgres")
        )
        
        transformer = BronzeToSilverTransformer(conn)
        transformer.transform_all(batch_size=5000)  # Larger batches
        
        logger.info("\n" + "=" * 80)
        logger.info("SILVER LAYER TRANSFORMATION COMPLETE")
        logger.info("=" * 80)
        
        # Step 3: Aggregate Silver to Gold
        logger.info("\n" + "=" * 80)
        logger.info("STEP 3: AGGREGATING SILVER TO GOLD LAYER")
        logger.info("=" * 80)
        
        from aggregators.silver_to_gold import SilverToGoldAggregator
        
        aggregator = SilverToGoldAggregator(conn)
        aggregator.aggregate_all()
        
        conn.close()
        
        logger.info("\n" + "=" * 80)
        logger.info("GOLD LAYER AGGREGATION COMPLETE")
        logger.info("=" * 80)
        
        # Step 4: Verify data
        logger.info("\n" + "=" * 80)
        logger.info("STEP 4: VERIFYING DATA WAREHOUSE POPULATION")
        logger.info("=" * 80)
        
        verify_data_warehouse()
        
        logger.info("\n" + "=" * 80)
        logger.info("DATA WAREHOUSE POPULATION COMPLETE!")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"\nError populating data warehouse: {e}", exc_info=True)
        sys.exit(1)


def verify_data_warehouse():
    """Verify data warehouse has been populated."""
    import psycopg2
    from psycopg2.extras import RealDictCursor
    
    conn = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "datawarehouse"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres")
    )
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Check Bronze layer
        logger.info("\nBronze Layer:")
        tables = [
            ('bronze', 'raw_customers'),
            ('bronze', 'raw_products'),
            ('bronze', 'raw_orders'),
            ('bronze', 'raw_inventory'),
            ('bronze', 'raw_reviews'),
            ('bronze', 'raw_sessions'),
            ('bronze', 'raw_clickstream'),
        ]
        
        for schema, table in tables:
            cur.execute(f"SELECT COUNT(*) as count FROM {schema}.{table}")
            result = cur.fetchone()
            count = result['count'] if result else 0
            logger.info(f"  {schema}.{table}: {count:,} records")
        
        # Check Silver layer
        logger.info("\nSilver Layer:")
        silver_tables = [
            ('silver', 'customers'),
            ('silver', 'products'),
            ('silver', 'orders'),
            ('silver', 'order_items'),
            ('silver', 'inventory_snapshots'),
            ('silver', 'user_events'),
            ('silver', 'product_reviews'),
        ]
        
        for schema, table in silver_tables:
            cur.execute(f"SELECT COUNT(*) as count FROM {schema}.{table}")
            result = cur.fetchone()
            count = result['count'] if result else 0
            logger.info(f"  {schema}.{table}: {count:,} records")
        
        # Check Gold layer
        logger.info("\nGold Layer:")
        gold_tables = [
            ('gold', 'daily_sales_summary'),
            ('gold', 'customer_360'),
            ('gold', 'product_performance'),
        ]
        
        for schema, table in gold_tables:
            cur.execute(f"SELECT COUNT(*) as count FROM {schema}.{table}")
            result = cur.fetchone()
            count = result['count'] if result else 0
            logger.info(f"  {schema}.{table}: {count:,} records")
        
    except Exception as e:
        logger.error(f"Error verifying data: {e}")
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    main()

