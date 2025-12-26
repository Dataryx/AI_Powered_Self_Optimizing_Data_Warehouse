"""
Train All ML Models
Trains all ML optimization models using collected query logs.
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

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

try:
    from models.workload_clustering import WorkloadClusterer
    from models.query_time_predictor import QueryTimePredictor
    from models.anomaly_detector import QueryAnomalyDetector
except ImportError:
    logger.error("Failed to import ML models. Check PYTHONPATH.")
    sys.exit(1)


def train_all_models():
    """Train all ML optimization models."""
    
    # Database connection string
    db_conn_str = (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'datawarehouse')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASSWORD', 'postgres')}"
    )
    
    models_dir = project_root / "ml-optimization" / "saved_models"
    models_dir.mkdir(exist_ok=True)
    
    try:
        logger.info("=" * 60)
        logger.info("Training All ML Models")
        logger.info("=" * 60)
        
        # Get query logs
        connection = psycopg2.connect(db_conn_str)
        cursor = connection.cursor()
        
        cursor.execute("""
            SELECT query_text, mean_exec_time_ms, calls, rows_affected,
                   shared_blks_hit, shared_blks_read, extracted_features
            FROM ml_optimization.query_logs
            WHERE query_text IS NOT NULL
            AND mean_exec_time_ms > 0
            ORDER BY collected_at DESC
            LIMIT 1000
        """)
        
        query_data = cursor.fetchall()
        cursor.close()
        connection.close()
        
        if len(query_data) < 10:
            logger.error("Not enough query logs for training. Need at least 10 records.")
            return
        
        logger.info(f"Loaded {len(query_data)} query records for training")
        
        # Prepare data
        queries = [row[0] for row in query_data]
        execution_times = [row[1] for row in query_data]
        
        # 1. Train Workload Clustering Model
        logger.info("\n" + "=" * 60)
        logger.info("Training Workload Clustering Model")
        logger.info("=" * 60)
        
        try:
            clusterer = WorkloadClusterer(n_clusters=5)
            
            # Prepare features from queries
            features_list = []
            for query in queries:
                if query:
                    # Simple feature extraction (word count, length, etc.)
                    features = {
                        'query_length': len(query),
                        'word_count': len(query.split()),
                        'has_select': 'SELECT' in query.upper(),
                        'has_join': 'JOIN' in query.upper(),
                        'has_where': 'WHERE' in query.upper(),
                        'has_group_by': 'GROUP BY' in query.upper(),
                        'has_order_by': 'ORDER BY' in query.upper(),
                    }
                    features_list.append(features)
            
            if features_list:
                clusterer.fit(queries)
                cluster_path = models_dir / "workload_clustering.pkl"
                clusterer.save(str(cluster_path))
                logger.info(f"Workload clustering model saved to {cluster_path}")
            
        except Exception as e:
            logger.error(f"Error training workload clustering: {e}", exc_info=True)
        
        # 2. Train Query Time Predictor
        logger.info("\n" + "=" * 60)
        logger.info("Training Query Time Predictor Model")
        logger.info("=" * 60)
        
        try:
            predictor = QueryTimePredictor()
            
            # Prepare training data
            training_data = []
            for i, query in enumerate(queries):
                if query and i < len(execution_times):
                    training_data.append({
                        'query': query,
                        'execution_time_ms': execution_times[i]
                    })
            
            if len(training_data) >= 10:
                predictor.train(training_data)
                predictor_path = models_dir / "query_time_predictor.pkl"
                predictor.save(str(predictor_path))
                logger.info(f"Query time predictor model saved to {predictor_path}")
            else:
                logger.warning("Not enough training data for query time predictor")
                
        except Exception as e:
            logger.error(f"Error training query time predictor: {e}", exc_info=True)
        
        # 3. Train Anomaly Detector
        logger.info("\n" + "=" * 60)
        logger.info("Training Anomaly Detector Model")
        logger.info("=" * 60)
        
        try:
            detector = QueryAnomalyDetector()
            
            # Prepare features for anomaly detection
            feature_data = []
            for i, row in enumerate(query_data):
                if row[0] and i < len(execution_times):
                    feature_data.append({
                        'query': row[0],
                        'execution_time_ms': execution_times[i],
                        'calls': row[2] if row[2] else 1,
                        'rows_affected': row[3] if row[3] else 0,
                    })
            
            if len(feature_data) >= 10:
                detector.train(feature_data)
                detector_path = models_dir / "anomaly_detector.pkl"
                detector.save(str(detector_path))
                logger.info(f"Anomaly detector model saved to {detector_path}")
            else:
                logger.warning("Not enough training data for anomaly detector")
                
        except Exception as e:
            logger.error(f"Error training anomaly detector: {e}", exc_info=True)
        
        logger.info("\n" + "=" * 60)
        logger.info("Model Training Complete!")
        logger.info("=" * 60)
        logger.info(f"Models saved to: {models_dir}")
        
    except Exception as e:
        logger.error(f"Error in model training: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    train_all_models()

