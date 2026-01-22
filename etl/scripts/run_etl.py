"""
ETL Pipeline Runner
Runs the complete ETL pipeline: Bronze → Silver → Gold
With real-time job tracking
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

# Try to import ETLJobTracker
try:
    from ml_optimization.utils.etl_job_tracker import ETLJobTracker
    TRACKER_AVAILABLE = True
except ImportError:
    TRACKER_AVAILABLE = False
    logger = logging.getLogger(__name__)
    logger.warning("ETLJobTracker not available. Jobs will not be tracked.")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run_etl_pipeline():
    """Run the complete ETL pipeline with job tracking."""
    
    # Database connection
    connection = psycopg2.connect(
        host=os.getenv("POSTGRES_HOST", "localhost"),
        port=int(os.getenv("POSTGRES_PORT", "5432")),
        database=os.getenv("POSTGRES_DB", "datawarehouse"),
        user=os.getenv("POSTGRES_USER", "postgres"),
        password=os.getenv("POSTGRES_PASSWORD", "postgres")
    )
    
    tracker = None
    if TRACKER_AVAILABLE:
        try:
            tracker = ETLJobTracker(connection)
            tracker.ensure_table_exists()
        except Exception as e:
            logger.warning(f"Could not initialize job tracker: {e}")
            tracker = None
    
    try:
        # Overall pipeline job
        pipeline_job_id = None
        if tracker:
            pipeline_job_id = tracker.start_job(
                "Complete ETL Pipeline",
                "pipeline",
                None,
                None
            )
            tracker.update_progress(pipeline_job_id, 0)
        
        # Step 1: Bronze → Silver
        logger.info("\n" + "=" * 60)
        logger.info("STEP 1: Bronze → Silver Transformation")
        logger.info("=" * 60)
        
        transformer = BronzeToSilverTransformer(connection, tracker=tracker)
        transformer.transform_all(batch_size=1000)
        
        if tracker and pipeline_job_id:
            tracker.update_progress(pipeline_job_id, 50)
        
        # Step 2: Silver → Gold
        logger.info("\n" + "=" * 60)
        logger.info("STEP 2: Silver → Gold Aggregation")
        logger.info("=" * 60)
        
        aggregator = SilverToGoldAggregator(connection, tracker=tracker)
        aggregator.aggregate_all()
        
        if tracker and pipeline_job_id:
            tracker.update_progress(pipeline_job_id, 100)
            tracker.complete_job(pipeline_job_id)
        
        logger.info("\n" + "=" * 60)
        logger.info("ETL Pipeline Complete!")
        logger.info("=" * 60)
        
    except Exception as e:
        if tracker and pipeline_job_id:
            tracker.fail_job(pipeline_job_id, str(e))
        logger.error(f"Error in ETL pipeline: {e}", exc_info=True)
        raise
    finally:
        connection.close()


if __name__ == "__main__":
    run_etl_pipeline()

