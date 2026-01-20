"""
ETL Pipeline Runner with detailed logging
Runs the complete ETL pipeline: Bronze → Silver → Gold
"""

import sys
import logging
import psycopg2
import os
from pathlib import Path
from datetime import datetime

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from etl.transformers.bronze_to_silver import BronzeToSilverTransformer
from etl.aggregators.silver_to_gold import SilverToGoldAggregator

# Configure logging to both console and file
log_file = Path(__file__).parent.parent / "etl_pipeline.log"
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler(log_file, mode='a'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)


def run_etl_pipeline():
    """Run the complete ETL pipeline."""
    
    logger.info("=" * 80)
    logger.info("ETL PIPELINE STARTED")
    logger.info(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("=" * 80)
    
    # Database connection
    connection = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "datawarehouse"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres")
    )
    
    try:
        # Step 1: Bronze → Silver
        logger.info("\n" + "=" * 80)
        logger.info("STEP 1: Bronze → Silver Transformation")
        logger.info("=" * 80)
        
        transformer = BronzeToSilverTransformer(connection)
        totals = transformer.transform_all(batch_size=1000)
        
        logger.info("\n" + "=" * 80)
        logger.info("Bronze → Silver Transformation Summary:")
        logger.info("=" * 80)
        for key, value in totals.items():
            logger.info(f"  {key.capitalize()}: {value:,} records")
        
        # Step 2: Silver → Gold
        logger.info("\n" + "=" * 80)
        logger.info("STEP 2: Silver → Gold Aggregation")
        logger.info("=" * 80)
        
        aggregator = SilverToGoldAggregator(connection)
        gold_totals = aggregator.aggregate_all()
        
        logger.info("\n" + "=" * 80)
        logger.info("Silver → Gold Aggregation Summary:")
        logger.info("=" * 80)
        for key, value in gold_totals.items():
            logger.info(f"  {key.replace('_', ' ').title()}: {value:,} records")
        
        logger.info("\n" + "=" * 80)
        logger.info("ETL PIPELINE COMPLETE!")
        logger.info(f"End Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"Error in ETL pipeline: {e}", exc_info=True)
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    run_etl_pipeline()

