"""
ETL Pipeline Runner
Runs the complete ETL pipeline: Bronze → Silver → Gold
"""

import sys
import logging
import psycopg2
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent.parent))

from etl.transformers.bronze_to_silver import BronzeToSilverTransformer
from etl.aggregators.silver_to_gold import SilverToGoldAggregator

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run_etl_pipeline():
    """Run the complete ETL pipeline."""
    
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
        logger.info("\n" + "=" * 60)
        logger.info("STEP 1: Bronze → Silver Transformation")
        logger.info("=" * 60)
        
        transformer = BronzeToSilverTransformer(connection)
        transformer.transform_all(batch_size=1000)
        
        # Step 2: Silver → Gold
        logger.info("\n" + "=" * 60)
        logger.info("STEP 2: Silver → Gold Aggregation")
        logger.info("=" * 60)
        
        aggregator = SilverToGoldAggregator(connection)
        aggregator.aggregate_all()
        
        logger.info("\n" + "=" * 60)
        logger.info("ETL Pipeline Complete!")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Error in ETL pipeline: {e}", exc_info=True)
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    run_etl_pipeline()

