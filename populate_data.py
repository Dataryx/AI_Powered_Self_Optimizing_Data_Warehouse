#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Populate Data Warehouse with Large-Scale E-Commerce Data
Generates and loads comprehensive e-commerce data into Bronze, Silver, and Gold layers.

EDITED BEHAVIOR:
- Only populates tables that have NO DATA (empty tables).
- Skips steps safely to avoid duplicating data in non-empty tables.
- If a layer is partially populated (some tables empty, some not) and the underlying
  generator/ETL is "all-or-nothing", this script will SKIP that step and log a warning.
"""

import sys
import os
import logging
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)


BRONZE_TABLES = [
    ('bronze', 'raw_customers'),
    ('bronze', 'raw_products'),
    ('bronze', 'raw_orders'),
    ('bronze', 'raw_inventory'),
    ('bronze', 'raw_reviews'),
    ('bronze', 'raw_sessions'),
    ('bronze', 'raw_clickstream'),
]

SILVER_TABLES = [
    ('silver', 'customers'),
    ('silver', 'products'),
    ('silver', 'orders'),
    ('silver', 'order_items'),
    ('silver', 'inventory_snapshots'),
    ('silver', 'user_events'),
    ('silver', 'product_reviews'),
]

GOLD_TABLES = [
    ('gold', 'daily_sales_summary'),
    ('gold', 'customer_360'),
    ('gold', 'product_performance'),
]


def get_conn():
    import psycopg2
    return psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "datawarehouse"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres")
    )


def table_is_empty(cur, schema: str, table: str) -> bool:
    # Fast emptiness check (doesn't count full table)
    cur.execute(f"SELECT 1 FROM {schema}.{table} LIMIT 1;")
    return cur.fetchone() is None


def get_table_emptiness(conn, tables):
    """
    Returns:
      empty: list[(schema, table)] that are empty
      non_empty: list[(schema, table)] that have at least one row
    """
    empty, non_empty = [], []
    with conn.cursor() as cur:
        for schema, table in tables:
            if table_is_empty(cur, schema, table):
                empty.append((schema, table))
            else:
                non_empty.append((schema, table))
    return empty, non_empty


def log_table_state(layer_name: str, empty, non_empty):
    logger.info(f"\n{layer_name} table state:")
    if empty:
        logger.info("  Empty:")
        for s, t in empty:
            logger.info(f"    - {s}.{t}")
    else:
        logger.info("  Empty: None")

    if non_empty:
        logger.info("  Non-empty:")
        for s, t in non_empty:
            logger.info(f"    - {s}.{t}")
    else:
        logger.info("  Non-empty: None")


def main():
    """Main function to populate the warehouse."""

    logger.info("=" * 80)
    logger.info("LARGE-SCALE E-COMMERCE DATA WAREHOUSE POPULATION (EMPTY-TABLES ONLY)")
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

    conn = None
    try:
        # Connect once and reuse (also used for checks)
        conn = get_conn()

        # Determine emptiness by layer
        empty_bronze, non_empty_bronze = get_table_emptiness(conn, BRONZE_TABLES)
        empty_silver, non_empty_silver = get_table_emptiness(conn, SILVER_TABLES)
        empty_gold, non_empty_gold = get_table_emptiness(conn, GOLD_TABLES)

        log_table_state("BRONZE", empty_bronze, non_empty_bronze)
        log_table_state("SILVER", empty_silver, non_empty_silver)
        log_table_state("GOLD", empty_gold, non_empty_gold)

        # ---------------------------------------------------------------------
        # STEP 1: Bronze generation/load
        # NOTE: Your generate_data(config, load=True) appears to load ALL bronze tables.
        # To avoid duplicating data, we ONLY run it if ALL bronze tables are empty.
        # ---------------------------------------------------------------------
        logger.info("\n" + "=" * 80)
        logger.info("STEP 1: BRONZE LAYER (EMPTY TABLES ONLY)")
        logger.info("=" * 80)

        if not empty_bronze:
            logger.info("All Bronze tables already have data; skipping Bronze generation/load.")
        elif non_empty_bronze:
            # This should not happen because empty_bronze is non-empty and non_empty_bronze is non-empty.
            # But keeping the logic explicit for clarity.
            logger.warning(
                "Bronze is PARTIALLY populated (some empty, some non-empty). "
                "Skipping generate_data() to avoid duplicating existing Bronze data. "
                "To populate only missing Bronze tables, the generator must support selective loading."
            )
        else:
            # All Bronze tables empty -> safe to run full generator/load
            logger.info("All Bronze tables are empty; generating/loading Bronze data.")

            sys.path.insert(0, str(Path(__file__).parent / "data-generator"))
            from config import DataGeneratorConfig
            from main import generate_data

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

            generate_data(config, load=True)

            logger.info("\n" + "=" * 80)
            logger.info("BRONZE LAYER DATA LOADED SUCCESSFULLY")
            logger.info("=" * 80)

        # Refresh emptiness after Bronze step (in case we loaded it)
        empty_bronze, non_empty_bronze = get_table_emptiness(conn, BRONZE_TABLES)

        # ---------------------------------------------------------------------
        # STEP 2: Bronze -> Silver
        # We will attempt per-table transforms if methods exist on the transformer.
        # If only transform_all() exists, we only run it if ALL Silver tables are empty
        # (otherwise it would likely duplicate data).
        # ---------------------------------------------------------------------
        logger.info("\n" + "=" * 80)
        logger.info("STEP 2: TRANSFORMING BRONZE TO SILVER (EMPTY TABLES ONLY)")
        logger.info("=" * 80)

        # Recompute silver emptiness just before transform (in case something changed)
        empty_silver, non_empty_silver = get_table_emptiness(conn, SILVER_TABLES)

        if not empty_silver:
            logger.info("All Silver tables already have data; skipping Bronze→Silver transformation.")
        else:
            if empty_bronze:
                logger.warning(
                    "Some Bronze tables are still empty. Silver transformation may fail "
                    "if required Bronze sources are missing."
                )

            sys.path.insert(0, str(Path(__file__).parent / "etl"))
            from transformers.bronze_to_silver import BronzeToSilverTransformer

            transformer = BronzeToSilverTransformer(conn)
            missing = {t for _, t in empty_silver}

            # Attempt per-table methods if they exist; otherwise fall back safely.
            per_table_capable = any(
                hasattr(transformer, m) for m in (
                    "transform_customers",
                    "transform_products",
                    "transform_orders",
                    "transform_order_items",
                    "transform_inventory_snapshots",
                    "transform_user_events",
                    "transform_product_reviews",
                    "transform_orders_and_items",
                )
            )

            if per_table_capable:
                logger.info("Transformer supports per-table methods; transforming missing Silver tables only.")

                if "customers" in missing and hasattr(transformer, "transform_customers"):
                    transformer.transform_customers(batch_size=5000)

                if "products" in missing and hasattr(transformer, "transform_products"):
                    transformer.transform_products(batch_size=5000)

                # Orders / items often coupled
                if ("orders" in missing or "order_items" in missing):
                    if hasattr(transformer, "transform_orders_and_items"):
                        transformer.transform_orders_and_items(batch_size=5000)
                    else:
                        if "orders" in missing and hasattr(transformer, "transform_orders"):
                            transformer.transform_orders(batch_size=5000)
                        if "order_items" in missing and hasattr(transformer, "transform_order_items"):
                            transformer.transform_order_items(batch_size=5000)

                if "inventory_snapshots" in missing and hasattr(transformer, "transform_inventory_snapshots"):
                    transformer.transform_inventory_snapshots(batch_size=5000)

                if "user_events" in missing and hasattr(transformer, "transform_user_events"):
                    transformer.transform_user_events(batch_size=5000)

                if "product_reviews" in missing and hasattr(transformer, "transform_product_reviews"):
                    transformer.transform_product_reviews(batch_size=5000)

            else:
                # Fallback: only run transform_all if ALL Silver tables are empty
                if non_empty_silver:
                    logger.warning(
                        "Silver is PARTIALLY populated and transformer does not expose per-table methods. "
                        "Skipping transform_all() to avoid duplicating data. "
                        "If you want gap-filling, implement per-table transforms or upsert semantics."
                    )
                else:
                    logger.info("All Silver tables are empty; running transformer.transform_all().")
                    transformer.transform_all(batch_size=5000)

            logger.info("\n" + "=" * 80)
            logger.info("SILVER LAYER TRANSFORMATION STEP COMPLETE")
            logger.info("=" * 80)

        # ---------------------------------------------------------------------
        # STEP 3: Silver -> Gold
        # Same approach: per-table aggregation if methods exist; else aggregate_all only if ALL Gold empty.
        # ---------------------------------------------------------------------
        logger.info("\n" + "=" * 80)
        logger.info("STEP 3: AGGREGATING SILVER TO GOLD (EMPTY TABLES ONLY)")
        logger.info("=" * 80)

        empty_gold, non_empty_gold = get_table_emptiness(conn, GOLD_TABLES)

        if not empty_gold:
            logger.info("All Gold tables already have data; skipping Silver→Gold aggregation.")
        else:
            from aggregators.silver_to_gold import SilverToGoldAggregator

            aggregator = SilverToGoldAggregator(conn)
            missing = {t for _, t in empty_gold}

            per_table_capable = any(
                hasattr(aggregator, m) for m in (
                    "aggregate_daily_sales_summary",
                    "aggregate_customer_360",
                    "aggregate_product_performance",
                )
            )

            if per_table_capable:
                logger.info("Aggregator supports per-table methods; aggregating missing Gold tables only.")

                if "daily_sales_summary" in missing and hasattr(aggregator, "aggregate_daily_sales_summary"):
                    aggregator.aggregate_daily_sales_summary()

                if "customer_360" in missing and hasattr(aggregator, "aggregate_customer_360"):
                    aggregator.aggregate_customer_360()

                if "product_performance" in missing and hasattr(aggregator, "aggregate_product_performance"):
                    aggregator.aggregate_product_performance()

            else:
                if non_empty_gold:
                    logger.warning(
                        "Gold is PARTIALLY populated and aggregator does not expose per-table methods. "
                        "Skipping aggregate_all() to avoid duplicating data. "
                        "Implement per-table aggregation or upsert semantics to fill gaps safely."
                    )
                else:
                    logger.info("All Gold tables are empty; running aggregator.aggregate_all().")
                    aggregator.aggregate_all()

            logger.info("\n" + "=" * 80)
            logger.info("GOLD LAYER AGGREGATION STEP COMPLETE")
            logger.info("=" * 80)

        # ---------------------------------------------------------------------
        # STEP 4: Verify
        # ---------------------------------------------------------------------
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
    finally:
        if conn is not None:
            conn.close()


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
        for schema, table in BRONZE_TABLES:
            cur.execute(f"SELECT COUNT(*) as count FROM {schema}.{table}")
            result = cur.fetchone()
            count = result['count'] if result else 0
            logger.info(f"  {schema}.{table}: {count:,} records")

        # Check Silver layer
        logger.info("\nSilver Layer:")
        for schema, table in SILVER_TABLES:
            cur.execute(f"SELECT COUNT(*) as count FROM {schema}.{table}")
            result = cur.fetchone()
            count = result['count'] if result else 0
            logger.info(f"  {schema}.{table}: {count:,} records")

        # Check Gold layer
        logger.info("\nGold Layer:")
        for schema, table in GOLD_TABLES:
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
