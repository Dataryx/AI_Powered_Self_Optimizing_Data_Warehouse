# """
# Populate Silver Layer from Bronze Layer
# This script transforms data from Bronze to Silver layer, one table at a time,
# with detailed logging of counts and progress.
# """

# import sys
# import logging
# import psycopg2
# import os
# import time
# from pathlib import Path
# from datetime import datetime

# # Add parent directory to path
# sys.path.insert(0, str(Path(__file__).parent))

# from etl.transformers.bronze_to_silver import BronzeToSilverTransformer

# # Configure logging
# log_file = Path(__file__).parent / "populate_silver.log"
# logging.basicConfig(
#     level=logging.INFO,
#     format='%(asctime)s - [%(levelname)s] - %(message)s',
#     handlers=[
#         logging.FileHandler(log_file),
#         logging.StreamHandler()
#     ]
# )
# logger = logging.getLogger(__name__)


# def get_table_count(connection, schema, table):
#     """Get count of records in a table."""
#     try:
#         cursor = connection.cursor()
#         cursor.execute(f"SELECT COUNT(*) FROM {schema}.{table};")
#         count = cursor.fetchone()[0]
#         cursor.close()
#         return count
#     except Exception as e:
#         logger.warning(f"Could not get count for {schema}.{table}: {e}")
#         return 0


# def log_table_status(connection, table_name, step_num, total_steps):
#     """Log detailed status for a table before and after transformation."""
#     logger.info("")
#     logger.info("=" * 80)
#     logger.info(f"TABLE {step_num}/{total_steps}: {table_name.upper().replace('_', ' ')}")
#     logger.info("=" * 80)
    
#     bronze_count = get_table_count(connection, 'bronze', table_name)
#     silver_before = get_table_count(connection, 'silver', table_name)
#     records_to_process = bronze_count - silver_before
    
#     logger.info(f"Bronze Layer Count:     {bronze_count:>15,} records")
#     logger.info(f"Silver Layer (Before):  {silver_before:>15,} records")
#     logger.info(f"Records to Transform:   {records_to_process:>15,} records")
#     logger.info(f"Start Time:             {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
#     logger.info("-" * 80)
    
#     return bronze_count, silver_before, records_to_process


# def populate_silver_layer(connection, batch_size=5000):
#     """Populate Silver layer from Bronze layer, one table at a time."""
#     start_time = datetime.now()
    
#     logger.info("=" * 80)
#     logger.info("POPULATE SILVER LAYER FROM BRONZE LAYER")
#     logger.info("=" * 80)
#     logger.info(f"Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
#     logger.info(f"Batch Size: {batch_size:,} records per batch")
#     logger.info("")
    
#     # Initialize transformer
#     transformer = BronzeToSilverTransformer(connection)
    
#     # Define transformation order (must follow dependency order)
#     transformation_order = [
#         ('country', 'transform_countries', 'country'),
#         ('location', 'transform_locations', 'location'),
#         ('warehouse', 'transform_warehouses', 'warehouse'),
#         ('product', 'transform_products', 'product'),
#         ('inventory', 'transform_inventory', 'inventory'),
#         ('person', 'transform_persons', 'person'),
#         ('restricted_info', 'transform_restricted_info', 'restricted_info'),
#         ('person_location', 'transform_person_locations', 'person_location'),
#         ('phone_number', 'transform_phone_numbers', 'phone_number'),
#         ('customer_company', 'transform_customer_companies', 'customer_company'),
#         ('customer_employee', 'transform_customer_employees', 'customer_employee'),
#         ('employment_jobs', 'transform_employment_jobs', 'employment_jobs'),
#         ('employee', 'transform_employees', 'employment'),
#         ('customer', 'transform_customers', 'customer'),
#         ('orders', 'transform_orders', 'orders'),
#         ('order_item', 'transform_order_items', 'order_item'),
#     ]
    
#     total_steps = len(transformation_order)
#     summary = {}
    
#     # Process each table one at a time
#     for step_num, (table_name, method_name, bronze_table) in enumerate(transformation_order, 1):
#         table_start_time = time.time()
        
#         # Log initial status
#         bronze_count, silver_before, records_to_process = log_table_status(
#             connection, table_name, step_num, total_steps
#         )
        
#         if records_to_process == 0:
#             logger.info("")
#             logger.info("No records to transform. Table is already up to date.")
#             silver_after = silver_before
#             summary[table_name] = 0
#         else:
#             # Get the transformation method
#             transform_method = getattr(transformer, method_name)
            
#             # Transform in batches until complete
#             batch_num = 0
#             total_transformed = 0
            
#             logger.info("")
#             logger.info("Starting transformation batches...")
#             logger.info("-" * 80)
            
#             while True:
#                 batch_start = time.time()
#                 batch_count = transform_method(batch_size)
#                 batch_elapsed = time.time() - batch_start
                
#                 if batch_count == 0:
#                     break
                
#                 batch_num += 1
#                 total_transformed += batch_count
                
#                 # Get current silver count
#                 silver_current = get_table_count(connection, 'silver', table_name)
#                 progress_pct = (silver_current - silver_before) / records_to_process * 100 if records_to_process > 0 else 100
                
#                 logger.info(f"  Batch {batch_num:>4d}: {batch_count:>8,} records | "
#                           f"Speed: {batch_count/batch_elapsed:>8,.0f} rec/s | "
#                           f"Time: {batch_elapsed:>6.2f}s | "
#                           f"Progress: {progress_pct:>6.2f}% | "
#                           f"Total Silver: {silver_current:>12,}")
            
#             # Get final count
#             silver_after = get_table_count(connection, 'silver', table_name)
#             summary[table_name] = total_transformed
        
#         # Log completion status
#         table_elapsed = time.time() - table_start_time
#         logger.info("")
#         logger.info("-" * 80)
#         logger.info(f"TABLE {step_num}/{total_steps} COMPLETE: {table_name.upper().replace('_', ' ')}")
#         logger.info("-" * 80)
#         logger.info(f"Bronze Layer Count:     {bronze_count:>15,} records")
#         logger.info(f"Silver Layer (Before):  {silver_before:>15,} records")
#         logger.info(f"Silver Layer (After):   {silver_after:>15,} records")
#         logger.info(f"Records Transformed:    {summary[table_name]:>15,} records")
#         logger.info(f"Time Taken:             {table_elapsed:>15.2f} seconds ({table_elapsed/60:.2f} minutes)")
#         if summary[table_name] > 0:
#             logger.info(f"Average Speed:          {summary[table_name]/table_elapsed:>15,.0f} records/second")
#         logger.info(f"End Time:               {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
#         logger.info("=" * 80)
#         logger.info("")
    
#     # Final summary
#     end_time = datetime.now()
#     total_duration = (end_time - start_time).total_seconds()
    
#     logger.info("")
#     logger.info("=" * 80)
#     logger.info("SILVER LAYER POPULATION COMPLETE!")
#     logger.info("=" * 80)
#     logger.info(f"Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
#     logger.info(f"End Time: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
#     logger.info(f"Total Duration: {total_duration:.2f} seconds ({total_duration/60:.2f} minutes)")
#     logger.info("")
#     logger.info("FINAL TABLE COUNTS:")
#     logger.info("-" * 80)
#     logger.info(f"{'Table Name':<30} {'Bronze Count':>15} {'Silver Count':>15} {'Transformed':>15}")
#     logger.info("-" * 80)
    
#     total_bronze = 0
#     total_silver = 0
#     total_transformed = 0
    
#     for table_name, method_name, bronze_table in transformation_order:
#         bronze_count = get_table_count(connection, 'bronze', bronze_table)
#         silver_count = get_table_count(connection, 'silver', table_name)
#         transformed = summary.get(table_name, 0)
        
#         logger.info(f"{table_name:<30} {bronze_count:>15,} {silver_count:>15,} {transformed:>15,}")
        
#         total_bronze += bronze_count
#         total_silver += silver_count
#         total_transformed += transformed
    
#     logger.info("-" * 80)
#     logger.info(f"{'TOTALS':<30} {total_bronze:>15,} {total_silver:>15,} {total_transformed:>15,}")
#     logger.info("=" * 80)
    
#     return summary


# def main():
#     """Main function."""
#     logger.info("=" * 80)
#     logger.info("SILVER LAYER POPULATION SCRIPT")
#     logger.info("=" * 80)
#     logger.info("")
#     logger.info("This script will populate the Silver layer from Bronze layer data.")
#     logger.info("Each table will be processed one at a time until completion.")
#     logger.info("")
    
#     # Database connection
#     connection = psycopg2.connect(
#         host=os.getenv("POSTGRES_HOST", "localhost"),
#         port=int(os.getenv("POSTGRES_PORT", "5432")),
#         database=os.getenv("POSTGRES_DB", "datawarehouse"),
#         user=os.getenv("POSTGRES_USER", "postgres"),
#         password=os.getenv("POSTGRES_PASSWORD", "postgres")
#     )
    
#     try:
#         # Populate Silver layer
#         summary = populate_silver_layer(connection, batch_size=5000)
        
#         logger.info("")
#         logger.info("Script completed successfully!")
#         logger.info(f"Log file saved to: {log_file}")
        
#     except Exception as e:
#         logger.error(f"Error during Silver layer population: {e}", exc_info=True)
#         raise
#     finally:
#         connection.close()
#         logger.info("\nDatabase connection closed.")


# if __name__ == "__main__":
#     try:
#         main()
#     except KeyboardInterrupt:
#         logger.info("\nProcess interrupted by user.")
#     except Exception as e:
#         logger.error(f"Fatal error: {e}", exc_info=True)
#         sys.exit(1)


"""
Populate Silver Layer from Bronze Layer (Duplicate-Safe Driver)
This script transforms data from Bronze to Silver layer one table at a time,
with detailed logging and guardrails to avoid duplicate-producing re-runs.

Key guardrails:
- Skips table when silver count >= bronze count (default behavior)
- Stops a table if transformer reports inserts but silver count doesn't increase
- Optional: warns if silver table has no PK/unique index (duplication risk)
"""

import sys
import logging
import psycopg2
import os
import time
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from etl.transformers.bronze_to_silver import BronzeToSilverTransformer

# Configure logging
log_file = Path(__file__).parent / "populate_silver.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - [%(levelname)s] - %(message)s",
    handlers=[
        logging.FileHandler(log_file),
        logging.StreamHandler()
    ],
)
logger = logging.getLogger(__name__)


def get_table_count(connection, schema, table):
    """Get count of records in a table."""
    try:
        with connection.cursor() as cursor:
            cursor.execute(f"SELECT COUNT(*) FROM {schema}.{table};")
            return cursor.fetchone()[0]
    except Exception as e:
        logger.warning(f"Could not get count for {schema}.{table}: {e}")
        return 0


def silver_has_pk_or_unique(connection, table, schema="silver"):
    """
    Returns True if the table has a PRIMARY KEY or any UNIQUE constraint/index.
    This does not guarantee perfect dedupe, but it is a strong signal that
    reruns can be made idempotent with ON CONFLICT/NOT EXISTS.
    """
    sql = """
    SELECT EXISTS (
      SELECT 1
      FROM pg_constraint c
      JOIN pg_class t ON t.oid = c.conrelid
      JOIN pg_namespace n ON n.oid = t.relnamespace
      WHERE n.nspname = %s
        AND t.relname = %s
        AND c.contype IN ('p','u')
    );
    """
    try:
        with connection.cursor() as cursor:
            cursor.execute(sql, (schema, table))
            return bool(cursor.fetchone()[0])
    except Exception as e:
        logger.warning(f"Could not inspect constraints for {schema}.{table}: {e}")
        return False


def log_table_status(connection, table_name, step_num, total_steps, bronze_table=None):
    """Log detailed status for a table before transformation."""
    bronze_table = bronze_table or table_name

    logger.info("")
    logger.info("=" * 80)
    logger.info(f"TABLE {step_num}/{total_steps}: {table_name.upper().replace('_', ' ')}")
    logger.info("=" * 80)

    bronze_count = get_table_count(connection, "bronze", bronze_table)
    silver_before = get_table_count(connection, "silver", table_name)

    logger.info(f"Bronze Layer Count:     {bronze_count:>15,} records (bronze.{bronze_table})")
    logger.info(f"Silver Layer (Before):  {silver_before:>15,} records (silver.{table_name})")

    # Stronger gating: if silver already has >= bronze, we assume no work needed.
    # (This avoids re-running when counts match or when silver is already ahead.)
    if silver_before >= bronze_count:
        records_to_process = 0
    else:
        records_to_process = bronze_count - silver_before

    logger.info(f"Planned Records:        {records_to_process:>15,} records")
    logger.info(f"Start Time:             {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("-" * 80)

    # Constraint warning
    if not silver_has_pk_or_unique(connection, table_name, schema="silver"):
        logger.warning(
            f"WARNING: silver.{table_name} appears to have no PRIMARY KEY or UNIQUE constraint. "
            "Idempotent loads are difficult without constraints or UPSERT logic in the transformer."
        )

    return bronze_count, silver_before, records_to_process


def populate_silver_layer(connection, batch_size=5000, max_batches_without_growth=1):
    """
    Populate Silver layer from Bronze layer, one table at a time.

    max_batches_without_growth:
      Number of consecutive batches allowed where transformer reports >0 but silver count doesn't grow.
      Set to 0 for strictest behavior; default 1 allows for edge cases where commit timing delays visibility.
    """
    start_time = datetime.now()

    logger.info("=" * 80)
    logger.info("POPULATE SILVER LAYER FROM BRONZE LAYER (GUARDED)")
    logger.info("=" * 80)
    logger.info(f"Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Batch Size: {batch_size:,} records per batch")
    logger.info("")

    transformer = BronzeToSilverTransformer(connection)

    transformation_order = [
        ("country", "transform_countries", "country"),
        ("location", "transform_locations", "location"),
        ("warehouse", "transform_warehouses", "warehouse"),
        ("product", "transform_products", "product"),
        ("inventory", "transform_inventory", "inventory"),
        ("person", "transform_persons", "person"),
        ("restricted_info", "transform_restricted_info", "restricted_info"),
        ("person_location", "transform_person_locations", "person_location"),
        ("phone_number", "transform_phone_numbers", "phone_number"),
        ("customer_company", "transform_customer_companies", "customer_company"),
        ("customer_employee", "transform_customer_employees", "customer_employee"),
        ("employment_jobs", "transform_employment_jobs", "employment_jobs"),
        ("employee", "transform_employees", "employment"),
        ("customer", "transform_customers", "customer"),
        ("orders", "transform_orders", "orders"),
        ("order_item", "transform_order_items", "order_item"),
    ]

    total_steps = len(transformation_order)
    summary = {}

    for step_num, (table_name, method_name, bronze_table) in enumerate(transformation_order, 1):
        table_start_time = time.time()

        bronze_count, silver_before, records_to_process = log_table_status(
            connection, table_name, step_num, total_steps, bronze_table=bronze_table
        )

        if records_to_process == 0:
            logger.info("")
            logger.info("No records to transform (silver count >= bronze count). Skipping.")
            summary[table_name] = 0

            table_elapsed = time.time() - table_start_time
            logger.info("")
            logger.info("-" * 80)
            logger.info(f"TABLE {step_num}/{total_steps} COMPLETE: {table_name.upper().replace('_', ' ')}")
            logger.info("-" * 80)
            logger.info(f"Time Taken:             {table_elapsed:>15.2f} seconds")
            logger.info("=" * 80)
            logger.info("")
            continue

        transform_method = getattr(transformer, method_name)

        logger.info("")
        logger.info("Starting transformation batches...")
        logger.info("-" * 80)

        batch_num = 0
        total_transformed_reported = 0

        prev_silver_count = silver_before
        stagnant_batches = 0

        while True:
            batch_start = time.time()
            batch_reported = transform_method(batch_size)
            batch_elapsed = time.time() - batch_start

            # Always refresh silver count after each batch to measure real growth
            silver_current = get_table_count(connection, "silver", table_name)

            if batch_reported == 0:
                # Transformer says it is done
                break

            batch_num += 1
            total_transformed_reported += batch_reported

            # Guardrail: if transformer claims it inserted rows but count didn't grow,
            # we stop to avoid infinite loops or hidden conflicts.
            if silver_current <= prev_silver_count:
                stagnant_batches += 1
            else:
                stagnant_batches = 0  # reset on growth

            if stagnant_batches > max_batches_without_growth:
                logger.error(
                    f"Guardrail triggered for silver.{table_name}: "
                    f"Transformer reported {batch_reported} rows, but silver count did not grow "
                    f"for {stagnant_batches} consecutive batch(es). "
                    "Stopping this table to prevent potential duplication or infinite looping."
                )
                break

            progress_pct = (
                (silver_current - silver_before) / records_to_process * 100
                if records_to_process > 0 else 100
            )

            logger.info(
                f"  Batch {batch_num:>4d}: reported={batch_reported:>8,} | "
                f"speed={batch_reported / batch_elapsed:>8,.0f} rec/s | "
                f"time={batch_elapsed:>6.2f}s | "
                f"progress={progress_pct:>6.2f}% | "
                f"silver_now={silver_current:>12,}"
            )

            prev_silver_count = silver_current

        silver_after = get_table_count(connection, "silver", table_name)

        # "Transformed" in summary is what transformer reported; actual growth may differ
        actual_growth = max(0, silver_after - silver_before)
        summary[table_name] = actual_growth

        table_elapsed = time.time() - table_start_time
        logger.info("")
        logger.info("-" * 80)
        logger.info(f"TABLE {step_num}/{total_steps} COMPLETE: {table_name.upper().replace('_', ' ')}")
        logger.info("-" * 80)
        logger.info(f"Bronze Layer Count:     {bronze_count:>15,} records")
        logger.info(f"Silver Layer (Before):  {silver_before:>15,} records")
        logger.info(f"Silver Layer (After):   {silver_after:>15,} records")
        logger.info(f"Actual Growth:          {actual_growth:>15,} records")
        logger.info(f"Time Taken:             {table_elapsed:>15.2f} seconds ({table_elapsed/60:.2f} minutes)")
        if actual_growth > 0 and table_elapsed > 0:
            logger.info(f"Average Speed:          {actual_growth/table_elapsed:>15,.0f} records/second")
        logger.info(f"End Time:               {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("=" * 80)
        logger.info("")

    end_time = datetime.now()
    total_duration = (end_time - start_time).total_seconds()

    logger.info("")
    logger.info("=" * 80)
    logger.info("SILVER LAYER POPULATION COMPLETE!")
    logger.info("=" * 80)
    logger.info(f"Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"End Time: {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Total Duration: {total_duration:.2f} seconds ({total_duration/60:.2f} minutes)")
    logger.info("")

    return summary


def main():
    logger.info("=" * 80)
    logger.info("SILVER LAYER POPULATION SCRIPT (GUARDED)")
    logger.info("=" * 80)
    logger.info("")
    logger.info("This script populates the Silver layer from Bronze layer data.")
    logger.info("Guardrails are enabled to reduce duplication risk on reruns.")
    logger.info("")

    connection = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "datawarehouse"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres"),
    )

    try:
        populate_silver_layer(connection, batch_size=5000)
        logger.info("")
        logger.info("Script completed successfully!")
        logger.info(f"Log file saved to: {log_file}")

    except Exception as e:
        logger.error(f"Error during Silver layer population: {e}", exc_info=True)
        raise
    finally:
        connection.close()
        logger.info("\nDatabase connection closed.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        logger.info("\nProcess interrupted by user.")
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
