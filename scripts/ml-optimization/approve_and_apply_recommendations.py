"""
Approve and Apply Recommendations
Requires admin approval before applying recommendations.
"""

import sys
import logging
import psycopg2
import os
from pathlib import Path
import json
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def approve_and_apply_recommendations(approval_file: str = None):
    """Apply recommendations only after admin approval."""
    
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
        logger.info("Recommendation Approval System")
        logger.info("=" * 60)
        
        # Create approval tracking table if it doesn't exist
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS ml_optimization.recommendation_approvals (
                approval_id BIGSERIAL PRIMARY KEY,
                recommendation_id BIGINT REFERENCES ml_optimization.index_recommendations(recommendation_id),
                approved_by VARCHAR(255),
                approved_at TIMESTAMP,
                status VARCHAR(50) DEFAULT 'pending',
                notes TEXT,
                applied_at TIMESTAMP
            )
        """)
        connection.commit()
        
        # Get pending recommendations
        cursor.execute("""
            SELECT 
                r.recommendation_id,
                r.table_name,
                r.column_name,
                r.priority,
                r.sql_statement,
                r.estimated_improvement,
                r.query_count,
                COALESCE(a.status, 'pending') as approval_status
            FROM ml_optimization.index_recommendations r
            LEFT JOIN ml_optimization.recommendation_approvals a 
                ON r.recommendation_id = a.recommendation_id
            WHERE COALESCE(a.status, 'pending') != 'applied'
            ORDER BY r.priority DESC, r.query_count DESC
        """)
        
        recommendations = cursor.fetchall()
        
        if not recommendations:
            logger.info("No pending recommendations found.")
            return
        
        logger.info(f"\nFound {len(recommendations)} pending recommendations:")
        logger.info("-" * 60)
        
        # Display recommendations
        pending_recs = []
        for rec in recommendations:
            rec_id, table, col, priority, sql, improvement, query_count, approval_status = rec
            if approval_status == 'pending':
                pending_recs.append({
                    'id': rec_id,
                    'table': table,
                    'column': col,
                    'priority': priority,
                    'sql': sql,
                    'improvement': improvement,
                    'query_count': query_count
                })
                
                logger.info(f"\nRecommendation ID: {rec_id}")
                logger.info(f"  Table: {table}.{col}")
                logger.info(f"  Priority: {priority}")
                logger.info(f"  Estimated Improvement: {improvement}")
                logger.info(f"  Based on: {query_count} queries")
                logger.info(f"  SQL: {sql}")
                logger.info(f"  Status: {approval_status}")
        
        if not pending_recs:
            logger.info("\nAll recommendations have been processed.")
            return
        
        # Check for approval file
        if approval_file and os.path.exists(approval_file):
            with open(approval_file, 'r') as f:
                approvals = json.load(f)
            
            logger.info("\n" + "=" * 60)
            logger.info("Processing Approved Recommendations")
            logger.info("=" * 60)
            
            applied_count = 0
            for approval in approvals:
                rec_id = approval.get('recommendation_id')
                approved_by = approval.get('approved_by', 'admin')
                notes = approval.get('notes', '')
                
                # Find the recommendation
                rec = next((r for r in pending_recs if r['id'] == rec_id), None)
                if not rec:
                    logger.warning(f"Recommendation ID {rec_id} not found in pending recommendations")
                    continue
                
                # Record approval
                cursor.execute("""
                    INSERT INTO ml_optimization.recommendation_approvals
                    (recommendation_id, approved_by, approved_at, status, notes)
                    VALUES (%s, %s, %s, %s, %s)
                """, (rec_id, approved_by, datetime.now(), 'approved', notes))
                
                # Apply the recommendation
                try:
                    cursor.execute(rec['sql'])
                    connection.commit()
                    logger.info(f"✅ Applied recommendation {rec_id}: {rec['table']}.{rec['column']}")
                    
                    # Mark as applied
                    cursor.execute("""
                        UPDATE ml_optimization.recommendation_approvals
                        SET status = 'applied', applied_at = %s
                        WHERE recommendation_id = %s
                    """, (datetime.now(), rec_id))
                    connection.commit()
                    applied_count += 1
                    
                except Exception as e:
                    logger.error(f"❌ Failed to apply recommendation {rec_id}: {e}")
                    connection.rollback()
                    
                    cursor.execute("""
                        UPDATE ml_optimization.recommendation_approvals
                        SET status = 'failed', notes = %s
                        WHERE recommendation_id = %s
                    """, (str(e)[:500], rec_id))
                    connection.commit()
            
            logger.info("\n" + "=" * 60)
            logger.info(f"Applied {applied_count} approved recommendations")
            logger.info("=" * 60)
        
        else:
            logger.info("\n" + "=" * 60)
            logger.info("ADMIN APPROVAL REQUIRED")
            logger.info("=" * 60)
            logger.info("\nTo approve and apply recommendations:")
            logger.info("1. Create an approval file (JSON format):")
            logger.info("   [")
            logger.info('     {"recommendation_id": 2, "approved_by": "admin", "notes": "Approved for testing"}')
            logger.info('     {"recommendation_id": 3, "approved_by": "admin", "notes": "Approved for testing"}')
            logger.info("   ]")
            logger.info("\n2. Run: python scripts/ml-optimization/approve_and_apply_recommendations.py --approval-file approvals.json")
            logger.info("\nOr use the interactive approval:")
            logger.info("   python scripts/ml-optimization/approve_and_apply_recommendations.py --interactive")
            
            # Generate sample approval file
            sample_file = "sample_approvals.json"
            sample_data = [
                {
                    "recommendation_id": rec['id'],
                    "approved_by": "admin",
                    "notes": f"Approved for {rec['priority']} priority recommendation"
                }
                for rec in pending_recs[:2]  # Sample first 2
            ]
            with open(sample_file, 'w') as f:
                json.dump(sample_data, f, indent=2)
            logger.info(f"\n📝 Sample approval file created: {sample_file}")
            logger.info("   Review and rename to 'approvals.json' to use")
        
    except Exception as e:
        logger.error(f"Error: {e}", exc_info=True)
        connection.rollback()
    finally:
        cursor.close()
        connection.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description='Approve and apply recommendations')
    parser.add_argument('--approval-file', help='JSON file with approved recommendation IDs')
    parser.add_argument('--interactive', action='store_true', help='Interactive approval mode')
    
    args = parser.parse_args()
    
    if args.interactive:
        # Interactive mode would prompt for each recommendation
        logger.info("Interactive mode not yet implemented. Use --approval-file instead.")
    else:
        approve_and_apply_recommendations(args.approval_file)

