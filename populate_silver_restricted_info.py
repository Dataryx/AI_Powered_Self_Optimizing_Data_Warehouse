"""
Populate Silver Layer: Restricted Info Table
This script transforms data from bronze.restricted_info to silver.restricted_info
with detailed logging of every batch and data count.
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
log_file = Path(__file__).parent / "populate_restricted_info.log"
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


def populate_restricted_info(batch_size=5000):
    """
    Populate silver.restricted_info from bronze.restricted_info.
    
    Args:
        batch_size: Number of records to process per batch
    """
    start_time = datetime.now()
    
    logger.info("=" * 80)
    logger.info("POPULATE SILVER LAYER: RESTRICTED INFO TABLE")
    logger.info("=" * 80)
    logger.info(f"Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Batch Size: {batch_size:,} records per batch")
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
        # Get initial counts
        bronze_count = get_table_count(connection, "bronze", "restricted_info")
        silver_before = get_table_count(connection, "silver", "restricted_info")
        records_to_process = bronze_count - silver_before
        
        logger.info("-" * 80)
        logger.info("INITIAL STATUS")
        logger.info("-" * 80)
        logger.info(f"Bronze Layer Count:     {bronze_count:>15,} records")
        logger.info(f"Silver Layer (Before):  {silver_before:>15,} records")
        logger.info(f"Records to Transform:   {records_to_process:>15,} records")
        logger.info("")
        
        if records_to_process == 0:
            logger.info("No new records to process. Silver layer is up to date.")
            return
        
        # Check if person table has data (required dependency)
        person_count = get_table_count(connection, "silver", "person")
        logger.info(f"Silver Person Count:    {person_count:>15,} records (required dependency)")
        logger.info("")
        
        if person_count == 0:
            logger.error("ERROR: silver.person table is empty. Restricted info requires person records.")
            logger.error("Please populate silver.person first.")
            return
        
        # Check how many bronze.restricted_info records have matching person records
        cursor = connection.cursor()
        cursor.execute("""
            SELECT COUNT(DISTINCT r.person_id) as total_person_ids,
                   COUNT(DISTINCT CASE WHEN p.person_key IS NOT NULL THEN r.person_id END) as matching_person_ids
            FROM bronze.restricted_info r
            LEFT JOIN silver.person p ON r.person_id = p.person_id
        """)
        match_result = cursor.fetchone()
        total_person_ids = match_result[0] or 0
        matching_person_ids = match_result[1] or 0
        missing_person_ids = total_person_ids - matching_person_ids
        
        logger.info("-" * 80)
        logger.info("PERSON KEY MATCHING ANALYSIS")
        logger.info("-" * 80)
        logger.info(f"Unique person_id in bronze.restricted_info: {total_person_ids:,}")
        logger.info(f"Person IDs with matching silver.person:      {matching_person_ids:,}")
        logger.info(f"Person IDs WITHOUT matching silver.person:  {missing_person_ids:,}")
        if total_person_ids > 0:
            match_pct = (matching_person_ids / total_person_ids) * 100
            logger.info(f"Match Percentage:                        {match_pct:.2f}%")
        logger.info("")
        
        if matching_person_ids == 0:
            logger.error("ERROR: No person_id values in bronze.restricted_info match silver.person!")
            logger.error("You need to populate silver.person first with matching person_id values.")
            cursor.close()
            return
        
        if missing_person_ids > 0:
            logger.warning(f"WARNING: {missing_person_ids:,} person_id values don't have matches in silver.person.")
            logger.warning("These records will be skipped during transformation.")
            logger.info("")
        
        cursor.close()
        
        # Initialize transformer
        transformer = BronzeToSilverTransformer(connection)
        
        logger.info("-" * 80)
        logger.info("STARTING TRANSFORMATION")
        logger.info("-" * 80)
        logger.info("Processing batches...")
        logger.info("")
        
        batch_num = 0
        total_transformed = 0
        total_skipped = 0
        
        # Track skipped records by checking how many were selected vs transformed
        cursor = connection.cursor()
        
        while True:
            batch_start = time.time()
            
            # Get count before batch
            silver_before_batch = get_table_count(connection, "silver", "restricted_info")
            
            # Note: We can't easily check available count here without duplicating the transform logic
            # The transformer handles the query internally
            
            # Transform batch
            batch_count = transformer.transform_restricted_info(batch_size)
            
            batch_elapsed = time.time() - batch_start
            
            if batch_count == 0:
                logger.info("")
                logger.info("No more records to transform.")
                break
            
            batch_num += 1
            total_transformed += batch_count
            
            # Get count after batch
            silver_after_batch = get_table_count(connection, "silver", "restricted_info")
            silver_current = silver_after_batch
            
            # Estimate skipped records (this is approximate)
            # The transformer processes batch_size records but may skip some due to missing person_key
            estimated_skipped = batch_size - batch_count if batch_count < batch_size else 0
            total_skipped += estimated_skipped
            
            # Calculate progress
            progress_pct = (silver_current / matching_person_ids * 100) if matching_person_ids > 0 else 0
            remaining = matching_person_ids - silver_current if matching_person_ids > silver_current else 0
            
            # Calculate speed
            safe_elapsed = max(batch_elapsed, 0.001)
            speed = batch_count / safe_elapsed
            
            # Log batch details
            logger.info(f"Batch {batch_num:>4d}:")
            logger.info(f"  Transformed:        {batch_count:>8,} records")
            if estimated_skipped > 0:
                logger.info(f"  Estimated Skipped:   {estimated_skipped:>8,} records (missing person_key)")
            logger.info(f"  Time:               {batch_elapsed:>8.2f} seconds")
            logger.info(f"  Speed:              {speed:>8,.0f} records/second")
            logger.info(f"  Silver Total:       {silver_current:>12,} records")
            logger.info(f"  Progress:           {progress_pct:>6.2f}% ({silver_current:,}/{matching_person_ids:,} matchable)")
            logger.info(f"  Remaining:          {remaining:>12,} records")
            logger.info("")
        
        cursor.close()
        
        # Final counts
        silver_final = get_table_count(connection, "silver", "restricted_info")
        end_time = datetime.now()
        total_elapsed = (end_time - start_time).total_seconds()
        
        logger.info("")
        logger.info("=" * 80)
        logger.info("TRANSFORMATION COMPLETE")
        logger.info("=" * 80)
        logger.info(f"Bronze Layer Count:     {bronze_count:>15,} records")
        logger.info(f"Silver Layer (Before):  {silver_before:>15,} records")
        logger.info(f"Silver Layer (After):   {silver_final:>15,} records")
        logger.info(f"Records Transformed:    {total_transformed:>15,} records")
        if total_skipped > 0:
            logger.info(f"Estimated Skipped:      {total_skipped:>15,} records (missing person_key)")
        logger.info(f"Total Batches:          {batch_num:>15,} batches")
        logger.info(f"Total Time:             {total_elapsed:>15.2f} seconds ({total_elapsed/60:.2f} minutes)")
        if total_transformed > 0:
            logger.info(f"Average Speed:          {total_transformed/total_elapsed:>15,.0f} records/second")
        logger.info(f"End Time:               {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("=" * 80)
        
        # Verify completion
        logger.info("")
        logger.info("COMPLETION ANALYSIS:")
        logger.info("-" * 80)
        logger.info(f"Total bronze.restricted_info records:       {bronze_count:,}")
        logger.info(f"Person IDs with matching silver.person:      {matching_person_ids:,}")
        logger.info(f"Person IDs WITHOUT matching silver.person:   {missing_person_ids:,}")
        logger.info(f"Silver.restricted_info records created:      {silver_final:,}")
        logger.info("")
        
        if silver_final >= matching_person_ids:
            logger.info("[SUCCESS] All matchable records have been transformed!")
        elif silver_final < matching_person_ids:
            missing = matching_person_ids - silver_final
            logger.warning(f"[WARNING] {missing:,} matchable records were not transformed.")
        
        if missing_person_ids > 0:
            logger.warning("")
            logger.warning(f"[INFO] {missing_person_ids:,} records in bronze.restricted_info cannot be transformed")
            logger.warning("because their person_id values don't exist in silver.person.")
            logger.warning("To transform these records, you need to:")
            logger.warning("  1. Populate bronze.person with the missing person_id values")
            logger.warning("  2. Transform bronze.person to silver.person")
            logger.warning("  3. Re-run this script")
        
    except Exception as e:
        logger.error(f"Error during transformation: {e}", exc_info=True)
        connection.rollback()
        raise
    finally:
        connection.close()
        logger.info("")
        logger.info("Database connection closed.")


if __name__ == "__main__":
    try:
        # Use larger batch size for better performance with 360k records
        populate_restricted_info(batch_size=5000)
    except KeyboardInterrupt:
        logger.info("")
        logger.info("Transformation interrupted by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)
