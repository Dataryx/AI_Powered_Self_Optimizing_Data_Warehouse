"""
Workload Analysis Runner
Analyzes collected query logs and generates workload insights.
"""

import sys
import logging
import psycopg2
import os
from pathlib import Path

# Add parent directory to path
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "ml-optimization"))

try:
    from analyzers.workload_analyzer import WorkloadAnalyzer
except ImportError:
    import importlib.util
    spec = importlib.util.spec_from_file_location(
        "workload_analyzer",
        project_root / "ml-optimization" / "analyzers" / "workload_analyzer.py"
    )
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    WorkloadAnalyzer = module.WorkloadAnalyzer

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run_workload_analysis():
    """Run workload analysis on collected query logs."""
    
    # Database connection string
    db_conn_str = (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'datawarehouse')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASSWORD', 'postgres')}"
    )
    
    try:
        logger.info("=" * 60)
        logger.info("Starting Workload Analysis")
        logger.info("=" * 60)
        
        # Initialize analyzer
        analyzer = WorkloadAnalyzer(db_conn_str, schema="ml_optimization")
        
        # Get recent query logs (last 1000 queries)
        connection = psycopg2.connect(db_conn_str)
        cursor = connection.cursor()
        
        cursor.execute("""
            SELECT query_text, mean_exec_time_ms, calls, rows_affected
            FROM ml_optimization.query_logs
            ORDER BY collected_at DESC
            LIMIT 1000
        """)
        
        query_logs = cursor.fetchall()
        cursor.close()
        connection.close()
        
        if not query_logs:
            logger.warning("No query logs found. Run query collection first.")
            return
        
        logger.info(f"Analyzing {len(query_logs)} query logs...")
        
        # Extract features from queries
        queries = [log[0] for log in query_logs]
        features = []
        
        for query in queries:
            if query:
                query_features = analyzer.extract_query_features(query)
                features.append(query_features)
        
        if features:
            # Identify patterns
            patterns = analyzer.identify_patterns(features)
            logger.info(f"Identified {len(patterns)} query patterns")
            
            # Classify workload
            workload_type = analyzer.classify_workload(features)
            logger.info(f"Workload classification: {workload_type}")
            
            # Generate summary
            summary = analyzer.generate_summary(features)
            logger.info("\nWorkload Summary:")
            for key, value in summary.items():
                logger.info(f"  {key}: {value}")
        
        logger.info("=" * 60)
        logger.info("Workload Analysis Complete!")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Error in workload analysis: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    run_workload_analysis()

