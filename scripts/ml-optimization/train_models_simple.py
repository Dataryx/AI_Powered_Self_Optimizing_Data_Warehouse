"""
Train ML Models (Simplified)
Trains ML models using collected query logs.
"""

import sys
import logging
import psycopg2
import pandas as pd
import numpy as np
import os
from pathlib import Path
import json

# Add paths
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))
sys.path.insert(0, str(project_root / "ml-optimization"))

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def train_workload_clustering():
    """Train workload clustering model."""
    
    db_conn_str = (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'datawarehouse')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASSWORD', 'postgres')}"
    )
    
    try:
        logger.info("=" * 60)
        logger.info("Training Workload Clustering Model")
        logger.info("=" * 60)
        
        # Get query logs
        connection = psycopg2.connect(db_conn_str)
        
        query = """
            SELECT 
                query_hash,
                query_text,
                mean_exec_time_ms,
                calls,
                rows_affected,
                extracted_features
            FROM ml_optimization.query_logs
            WHERE query_text IS NOT NULL
            AND mean_exec_time_ms > 0
            ORDER BY calls DESC
            LIMIT 500
        """
        
        df = pd.read_sql(query, connection)
        connection.close()
        
        if len(df) < 10:
            logger.warning("Not enough query logs for training. Need at least 10 records.")
            return False
        
        logger.info(f"Loaded {len(df)} query records for training")
        
        # Extract simple features
        features = []
        for _, row in df.iterrows():
            query_text = row['query_text'] or ''
            query_upper = query_text.upper()
            
            # Simple feature extraction
            feature = {
                'query_length': len(query_text),
                'word_count': len(query_text.split()),
                'has_select': 1 if 'SELECT' in query_upper else 0,
                'has_join': 1 if 'JOIN' in query_upper else 0,
                'has_where': 1 if 'WHERE' in query_upper else 0,
                'has_group_by': 1 if 'GROUP BY' in query_upper else 0,
                'has_order_by': 1 if 'ORDER BY' in query_upper else 0,
                'has_aggregation': 1 if any(x in query_upper for x in ['SUM', 'COUNT', 'AVG', 'MAX', 'MIN']) else 0,
                'mean_exec_time_log': np.log1p(float(row['mean_exec_time_ms']) or 0),
                'calls_log': np.log1p(int(row['calls']) or 0),
            }
            
            # Try to parse extracted_features if available
            if row.get('extracted_features'):
                try:
                    ext_features = json.loads(row['extracted_features']) if isinstance(row['extracted_features'], str) else row['extracted_features']
                    feature['table_count'] = ext_features.get('table_count', 0)
                    feature['join_count'] = ext_features.get('join_count', 0)
                except:
                    feature['table_count'] = 0
                    feature['join_count'] = 0
            else:
                feature['table_count'] = 0
                feature['join_count'] = 0
            
            features.append(feature)
        
        features_df = pd.DataFrame(features)
        logger.info(f"Extracted features from {len(features_df)} queries")
        logger.info(f"Feature columns: {list(features_df.columns)}")
        
        # Simple clustering using k-means (scikit-learn)
        try:
            from sklearn.cluster import KMeans
            from sklearn.preprocessing import StandardScaler
            
            # Scale features
            scaler = StandardScaler()
            features_scaled = scaler.fit_transform(features_df)
            
            # Train k-means (3-5 clusters)
            n_clusters = min(5, max(3, len(features_df) // 20))
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            clusters = kmeans.fit_predict(features_scaled)
            
            logger.info(f"Trained KMeans model with {n_clusters} clusters")
            
            # Analyze clusters
            features_df['cluster'] = clusters
            cluster_stats = features_df.groupby('cluster').agg({
                'mean_exec_time_log': 'mean',
                'calls_log': 'mean',
                'has_join': 'mean',
                'has_aggregation': 'mean',
            }).round(3)
            
            logger.info("\nCluster Statistics:")
            logger.info(cluster_stats.to_string())
            
            # Save model info (simplified - just save cluster info)
            models_dir = project_root / "ml-optimization" / "saved_models"
            models_dir.mkdir(exist_ok=True)
            
            model_info = {
                'n_clusters': n_clusters,
                'n_samples': len(features_df),
                'cluster_centers': kmeans.cluster_centers_.tolist(),
                'cluster_stats': cluster_stats.to_dict(),
                'feature_names': list(features_df.columns[:-1])  # Exclude 'cluster'
            }
            
            import joblib
            model_file = models_dir / "workload_clustering_simple.pkl"
            joblib.dump({
                'model': kmeans,
                'scaler': scaler,
                'features_df': features_df,
                'info': model_info
            }, model_file)
            
            logger.info(f"Model saved to: {model_file}")
            return True
            
        except ImportError:
            logger.error("scikit-learn not available. Install with: pip install scikit-learn")
            return False
        except Exception as e:
            logger.error(f"Error training model: {e}", exc_info=True)
            return False
        
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return False


def train_query_predictor():
    """Train query execution time predictor."""
    
    db_conn_str = (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'datawarehouse')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASSWORD', 'postgres')}"
    )
    
    try:
        logger.info("\n" + "=" * 60)
        logger.info("Training Query Time Predictor Model")
        logger.info("=" * 60)
        
        connection = psycopg2.connect(db_conn_str)
        
        query = """
            SELECT 
                query_text,
                mean_exec_time_ms,
                calls,
                rows_affected,
                extracted_features
            FROM ml_optimization.query_logs
            WHERE query_text IS NOT NULL
            AND mean_exec_time_ms > 0
            AND calls > 0
            ORDER BY calls DESC
            LIMIT 300
        """
        
        df = pd.read_sql(query, connection)
        connection.close()
        
        if len(df) < 20:
            logger.warning("Not enough data for training query predictor")
            return False
        
        logger.info(f"Loaded {len(df)} records for training")
        
        # Extract features and target
        X = []
        y = []
        
        for _, row in df.iterrows():
            query_text = row['query_text'] or ''
            query_upper = query_text.upper()
            
            features = [
                len(query_text),  # query_length
                len(query_text.split()),  # word_count
                1 if 'SELECT' in query_upper else 0,
                1 if 'JOIN' in query_upper else 0,
                1 if 'WHERE' in query_upper else 0,
                1 if 'GROUP BY' in query_upper else 0,
                1 if any(x in query_upper for x in ['SUM', 'COUNT', 'AVG']) else 0,
                np.log1p(int(row['calls']) or 1),
            ]
            
            X.append(features)
            y.append(float(row['mean_exec_time_ms']))
        
        X = np.array(X)
        y = np.array(y)
        
        # Train simple regression model
        try:
            from sklearn.ensemble import RandomForestRegressor
            from sklearn.model_selection import train_test_split
            from sklearn.metrics import mean_absolute_error, r2_score
            
            X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
            
            model = RandomForestRegressor(n_estimators=50, random_state=42, max_depth=10)
            model.fit(X_train, y_train)
            
            # Evaluate
            y_pred = model.predict(X_test)
            mae = mean_absolute_error(y_test, y_pred)
            r2 = r2_score(y_test, y_pred)
            
            logger.info(f"Model Performance:")
            logger.info(f"  MAE: {mae:.2f}ms")
            logger.info(f"  R² Score: {r2:.3f}")
            
            # Save model
            models_dir = project_root / "ml-optimization" / "saved_models"
            models_dir.mkdir(exist_ok=True)
            
            import joblib
            model_file = models_dir / "query_time_predictor_simple.pkl"
            joblib.dump({
                'model': model,
                'feature_names': ['query_length', 'word_count', 'has_select', 'has_join', 
                                'has_where', 'has_group_by', 'has_aggregation', 'calls_log'],
                'metrics': {'mae': mae, 'r2': r2}
            }, model_file)
            
            logger.info(f"Model saved to: {model_file}")
            return True
            
        except ImportError:
            logger.error("scikit-learn not available")
            return False
        except Exception as e:
            logger.error(f"Error training predictor: {e}", exc_info=True)
            return False
        
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        return False


if __name__ == "__main__":
    logger.info("=" * 60)
    logger.info("Training ML Models")
    logger.info("=" * 60)
    
    success1 = train_workload_clustering()
    success2 = train_query_predictor()
    
    logger.info("\n" + "=" * 60)
    if success1 and success2:
        logger.info("✅ All models trained successfully!")
    elif success1 or success2:
        logger.info("⚠️  Some models trained successfully")
    else:
        logger.info("❌ Model training failed")
    logger.info("=" * 60)

