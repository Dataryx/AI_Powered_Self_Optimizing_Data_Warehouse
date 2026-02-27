"""
Duplicate Detection and Validation Utilities
Checks for duplicate records in Silver and Gold layers after ETL runs
"""

import psycopg2
import logging
from typing import Dict, List, Tuple

logger = logging.getLogger(__name__)


def check_duplicates_by_id(connection, schema: str, table: str, id_column: str) -> int:
    """
    Check for duplicate records based on a single ID column.
    
    Returns:
        Number of duplicate records found
    """
    cursor = connection.cursor()
    try:
        query = f"""
            SELECT COUNT(*) - COUNT(DISTINCT {id_column}) as duplicates
            FROM {schema}.{table}
        """
        cursor.execute(query)
        result = cursor.fetchone()
        return result[0] if result else 0
    except Exception as e:
        logger.error(f"Error checking duplicates in {schema}.{table}: {e}")
        # Rollback on error to allow subsequent queries
        try:
            connection.rollback()
        except:
            pass
        return -1
    finally:
        cursor.close()


def check_duplicates_by_composite_key(connection, schema: str, table: str, 
                                      columns: List[str]) -> int:
    """
    Check for duplicate records based on composite key columns.
    
    Returns:
        Number of duplicate records found
    """
    cursor = connection.cursor()
    try:
        columns_str = ', '.join(columns)
        query = f"""
            SELECT COUNT(*) - COUNT(DISTINCT ({columns_str})) as duplicates
            FROM {schema}.{table}
        """
        cursor.execute(query)
        result = cursor.fetchone()
        return result[0] if result else 0
    except Exception as e:
        logger.error(f"Error checking duplicates in {schema}.{table}: {e}")
        # Rollback on error to allow subsequent queries
        try:
            connection.rollback()
        except:
            pass
        return -1
    finally:
        cursor.close()


def validate_silver_layer(connection) -> Dict[str, Tuple[int, bool]]:
    """
    Validate Silver layer for duplicates.
    
    Returns:
        Dictionary mapping table names to (duplicate_count, has_duplicates)
    """
    results = {}
    
    # Tables with single ID column
    single_id_tables = {
        'country': 'country_id',
        'location': 'location_id',
        'warehouse': 'warehouse_id',
        'product': 'product_id',
        'inventory': 'inventory_id',
        'person': 'person_id',
        'customer_company': 'company_id',
        'customer_employee': 'customer_employee_id',
        'employment_jobs': 'hr_job_id',
        'employee': 'employee_id',
        'customer': 'customer_id',
        'orders': 'order_id',
        'order_item': 'order_item_id',
        'phone_number': 'phone_id',
    }
    
    # Tables with composite keys or special handling
    composite_key_tables = {
        'person_location': ['person_key', 'location_key'],
    }
    
    logger.info("")
    logger.info("=" * 80)
    logger.info("VALIDATING SILVER LAYER FOR DUPLICATES")
    logger.info("=" * 80)
    
    # Check single ID tables
    for table, id_column in single_id_tables.items():
        duplicates = check_duplicates_by_id(connection, 'silver', table, id_column)
        has_duplicates = duplicates > 0
        results[table] = (duplicates, has_duplicates)
        
        if has_duplicates:
            logger.warning(f"[WARN] {table:30s}: {duplicates:>15,} duplicates found!")
        else:
            logger.info(f"  [OK] {table:30s}: No duplicates")
    
    # Check composite key tables
    for table, columns in composite_key_tables.items():
        duplicates = check_duplicates_by_composite_key(connection, 'silver', table, columns)
        has_duplicates = duplicates > 0
        results[table] = (duplicates, has_duplicates)
        
        if has_duplicates:
            logger.warning(f"[WARN] {table:30s}: {duplicates:>15,} duplicates found!")
        else:
            logger.info(f"  [OK] {table:30s}: No duplicates")
    
    # Summary
    total_duplicates = sum(count for count, _ in results.values() if count > 0)
    tables_with_duplicates = sum(1 for _, has_dup in results.values() if has_dup)
    
    logger.info("")
    logger.info("-" * 80)
    if total_duplicates > 0:
        logger.warning(f"[WARN] VALIDATION FAILED: {tables_with_duplicates} table(s) have duplicates")
        logger.warning(f"  Total duplicate records: {total_duplicates:,}")
    else:
        logger.info(f"[OK] VALIDATION PASSED: No duplicates found in any table")
    logger.info("-" * 80)
    
    return results


def validate_gold_layer(connection) -> Dict[str, Tuple[int, bool]]:
    """
    Validate Gold layer for duplicates.
    
    Returns:
        Dictionary mapping table names to (duplicate_count, has_duplicates)
    """
    results = {}
    
    # Gold layer tables with their unique key columns
    gold_tables = {
        'agg_daily_sales': ['date_key'],
        'agg_customer_lifetime': ['customer_key'],
        'agg_monthly_product_sales': ['year_number', 'month_number', 'category_name'],
    }
    
    logger.info("")
    logger.info("=" * 80)
    logger.info("VALIDATING GOLD LAYER FOR DUPLICATES")
    logger.info("=" * 80)
    
    for table, columns in gold_tables.items():
        if len(columns) == 1:
            duplicates = check_duplicates_by_id(connection, 'gold', table, columns[0])
        else:
            duplicates = check_duplicates_by_composite_key(connection, 'gold', table, columns)
        
        has_duplicates = duplicates > 0
        results[table] = (duplicates, has_duplicates)
        
        if has_duplicates:
            logger.warning(f"[WARN] {table:30s}: {duplicates:>15,} duplicates found!")
        else:
            logger.info(f"  [OK] {table:30s}: No duplicates")
    
    # Summary
    total_duplicates = sum(count for count, _ in results.values() if count > 0)
    tables_with_duplicates = sum(1 for _, has_dup in results.values() if has_dup)
    
    logger.info("")
    logger.info("-" * 80)
    if total_duplicates > 0:
        logger.warning(f"[WARN] VALIDATION FAILED: {tables_with_duplicates} table(s) have duplicates")
        logger.warning(f"  Total duplicate records: {total_duplicates:,}")
    else:
        logger.info(f"[OK] VALIDATION PASSED: No duplicates found in any table")
    logger.info("-" * 80)
    
    return results

