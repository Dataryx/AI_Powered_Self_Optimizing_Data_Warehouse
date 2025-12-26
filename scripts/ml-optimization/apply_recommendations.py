"""
Apply Optimization Recommendations
Applies generated index recommendations to the database.
"""

import sys
import logging
import psycopg2
import os
from pathlib import Path

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def apply_recommendations(dry_run: bool = True, priority: str = None):
    """Apply optimization recommendations to the database."""
    
    db_conn_str = (
        f"host={os.getenv('POSTGRES_HOST', 'localhost')} "
        f"port={os.getenv('POSTGRES_PORT', '5432')} "
        f"dbname={os.getenv('POSTGRES_DB', 'datawarehouse')} "
        f"user={os.getenv('POSTGRES_USER', 'postgres')} "
        f"password={os.getenv('POSTGRES_PASSWORD', 'postgres')}"
    )
    
    connection = psycopg2.connect(db_conn_str)
    cursor = connection.cursor()
    
    try:
        logger.info("=" * 60)
        if dry_run:
            logger.info("DRY RUN: Preview of Recommendations to Apply")
        else:
            logger.info("Applying Optimization Recommendations")
        logger.info("=" * 60)
        
        # Get recommendations
        query = """
            SELECT 
                recommendation_id,
                table_name,
                column_name,
                priority,
                sql_statement,
                estimated_improvement,
                query_count
            FROM ml_optimization.index_recommendations
            WHERE 1=1
        """
        
        params = []
        if priority:
            query += " AND priority = %s"
            params.append(priority)
        
        query += " ORDER BY priority DESC, query_count DESC"
        
        cursor.execute(query, params)
        recommendations = cursor.fetchall()
        
        if not recommendations:
            logger.info("No recommendations found to apply.")
            return
        
        logger.info(f"\nFound {len(recommendations)} recommendations to apply:")
        logger.info("-" * 60)
        
        applied_count = 0
        failed_count = 0
        
        for rec_id, table_name, column_name, priority, sql_stmt, improvement, query_count in recommendations:
            logger.info(f"\nRecommendation {rec_id}:")
            logger.info(f"  Table: {table_name}.{column_name}")
            logger.info(f"  Priority: {priority}")
            logger.info(f"  Estimated Improvement: {improvement}")
            logger.info(f"  Based on: {query_count} queries")
            logger.info(f"  SQL: {sql_stmt}")
            
            if not dry_run:
                try:
                    cursor.execute(sql_stmt)
                    connection.commit()
                    logger.info(f"  ✅ Successfully applied!")
                    
                    # Update recommendation status
                    cursor.execute("""
                        UPDATE ml_optimization.index_recommendations
                        SET applied_at = CURRENT_TIMESTAMP,
                            status = 'applied'
                        WHERE recommendation_id = %s
                    """, (rec_id,))
                    connection.commit()
                    applied_count += 1
                    
                except Exception as e:
                    logger.error(f"  ❌ Failed to apply: {e}")
                    connection.rollback()
                    
                    # Update recommendation status
                    try:
                        cursor.execute("""
                            UPDATE ml_optimization.index_recommendations
                            SET status = 'failed',
                                error_message = %s
                            WHERE recommendation_id = %s
                        """, (str(e)[:500], rec_id))
                        connection.commit()
                    except:
                        pass
                    
                    failed_count += 1
            else:
                logger.info(f"  [DRY RUN - Would apply]")
        
        logger.info("\n" + "=" * 60)
        if dry_run:
            logger.info("DRY RUN Complete - No changes made")
            logger.info(f"Would apply {len(recommendations)} recommendations")
        else:
            logger.info("Recommendation Application Complete!")
            logger.info(f"Successfully applied: {applied_count}")
            logger.info(f"Failed: {failed_count}")
        logger.info("=" * 60)
        
    except Exception as e:
        logger.error(f"Error applying recommendations: {e}", exc_info=True)
        connection.rollback()
    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Apply optimization recommendations')
    parser.add_argument('--apply', action='store_true', help='Actually apply recommendations (default is dry-run)')
    parser.add_argument('--priority', choices=['high', 'medium', 'low'], help='Filter by priority')
    
    args = parser.parse_args()
    
    apply_recommendations(dry_run=not args.apply, priority=args.priority)

