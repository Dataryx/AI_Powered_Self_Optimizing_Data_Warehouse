"""
Populate All Gold Layer Tables
This script populates all Gold layer tables from Silver layer:
- Dimensions (dim_date, dim_customer, dim_product, dim_employee, dim_location, dim_warehouse, dim_promotion)
- Facts (fact_sales, fact_inventory_snapshot, fact_orders)
- Aggregations (agg_daily_sales, agg_monthly_product_sales, agg_customer_lifetime, agg_sales_rep_performance)
"""

import sys
import logging
import psycopg2
import os
import time
from pathlib import Path
from datetime import datetime, date, timedelta
from psycopg2.extras import execute_batch

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent))

from etl.aggregators.silver_to_gold import SilverToGoldAggregator

# Configure logging
log_file = Path(__file__).parent / "populate_all_gold.log"
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


def populate_dim_date(connection, start_date, end_date):
    """Populate date dimension for a date range."""
    cursor = connection.cursor()
    day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
    month_names = ['January', 'February', 'March', 'April', 'May', 'June',
                  'July', 'August', 'September', 'October', 'November', 'December']
    month_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    
    current_date = start_date
    inserted = 0
    
    while current_date <= end_date:
        date_key = int(current_date.strftime('%Y%m%d'))
        
        # Check if exists
        cursor.execute("SELECT 1 FROM gold.dim_date WHERE date_key = %s", (date_key,))
        if cursor.fetchone():
            current_date += timedelta(days=1)
            continue
        
        day_of_week = current_date.weekday() + 1  # Monday = 1
        cursor.execute("""
            INSERT INTO gold.dim_date (
                date_key, full_date, day_of_week, day_name, day_of_month, day_of_year,
                week_of_year, month_number, month_name, month_short_name,
                quarter_number, quarter_name, year_number, is_weekend
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (date_key) DO NOTHING
        """, (
            date_key, current_date, day_of_week, day_names[current_date.weekday()],
            current_date.day, current_date.timetuple().tm_yday,
            current_date.isocalendar()[1], current_date.month,
            month_names[current_date.month - 1], month_short[current_date.month - 1],
            (current_date.month - 1) // 3 + 1, f"Q{(current_date.month - 1) // 3 + 1}",
            current_date.year, current_date.weekday() >= 5
        ))
        inserted += 1
        current_date += timedelta(days=1)
    
    connection.commit()
    cursor.close()
    return inserted


def populate_dim_customer(connection):
    """Populate customer dimension from silver.customer."""
    cursor = connection.cursor()
    
    # Get customers from silver
    cursor.execute("""
        SELECT c.customer_key, c.customer_id, p.first_name, p.last_name,
               p.full_name, p.gender, cc.company_name, cc.credit_limit,
               c.customer_type, c.income_level, c.income_bracket,
               c.account_manager_id, c.person_key
        FROM silver.customer c
        LEFT JOIN silver.person p ON c.person_key = p.person_key
        LEFT JOIN silver.customer_employee ce ON c.customer_employee_key = ce.customer_employee_key
        LEFT JOIN silver.customer_company cc ON ce.company_key = cc.company_key
        WHERE c.is_valid = TRUE
    """)
    
    customers = cursor.fetchall()
    
    insert_query = """
        INSERT INTO gold.dim_customer (
            customer_key, customer_id, first_name, last_name, full_name, gender,
            company_name, company_credit_limit, customer_type, income_level,
            income_bracket, account_manager_id
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (customer_key) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            full_name = EXCLUDED.full_name,
            gender = EXCLUDED.gender,
            company_name = EXCLUDED.company_name,
            company_credit_limit = EXCLUDED.company_credit_limit,
            customer_type = EXCLUDED.customer_type,
            income_level = EXCLUDED.income_level,
            income_bracket = EXCLUDED.income_bracket,
            account_manager_id = EXCLUDED.account_manager_id
    """
    
    transformed = []
    for row in customers:
        transformed.append((
            row[0], row[1], row[2], row[3], row[4], row[5],
            row[6], row[7], row[8], row[9], row[10], row[11]
        ))
    
    execute_batch(cursor, insert_query, transformed)
    connection.commit()
    cursor.close()
    return len(transformed)


def populate_dim_product(connection):
    """Populate product dimension from silver.product."""
    cursor = connection.cursor()
    
    cursor.execute("""
        SELECT product_key, product_id, product_name, description,
               category_id, category_name, weight_class, weight_class_description,
               warranty_period_months, list_price, minimum_price, price_currency,
               product_status, is_valid
        FROM silver.product
        WHERE is_valid = TRUE
    """)
    
    products = cursor.fetchall()
    
    insert_query = """
        INSERT INTO gold.dim_product (
            product_key, product_id, product_name, description,
            category_id, category_name, weight_class, weight_class_description,
            warranty_period_months, list_price, minimum_price, price_currency,
            product_status, is_active
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (product_key) DO UPDATE SET
            product_name = EXCLUDED.product_name,
            description = EXCLUDED.description,
            category_id = EXCLUDED.category_id,
            category_name = EXCLUDED.category_name,
            list_price = EXCLUDED.list_price,
            minimum_price = EXCLUDED.minimum_price,
            product_status = EXCLUDED.product_status,
            is_active = EXCLUDED.is_active
    """
    
    transformed = []
    for row in products:
        # Calculate profit margin if we have both prices
        profit_margin = None
        profit_margin_pct = None
        if row[9] and row[10]:  # list_price and minimum_price
            profit_margin = row[9] - row[10]
            if row[9] > 0:
                profit_margin_pct = (profit_margin / row[9]) * 100
        
        transformed.append((
            row[0], row[1], row[2], row[3], row[4], row[5],
            row[6], row[7], row[8], row[9], row[10], row[11],
            row[12], row[13]
        ))
    
    execute_batch(cursor, insert_query, transformed)
    connection.commit()
    cursor.close()
    return len(transformed)


def populate_dim_employee(connection):
    """Populate employee dimension from silver.employee."""
    cursor = connection.cursor()
    
    cursor.execute("""
        SELECT e.employee_key, e.employee_id, p.first_name, p.last_name, p.full_name,
               ej.job_title, e.start_date, e.end_date, e.tenure_years,
               e.is_active, e.employment_status, e.salary, e.commission_percent,
               m.employee_id as manager_employee_id, c.country_name
        FROM silver.employee e
        LEFT JOIN silver.person p ON e.person_key = p.person_key
        LEFT JOIN silver.employment_jobs ej ON e.job_key = ej.job_key
        LEFT JOIN silver.country c ON ej.country_key = c.country_key
        LEFT JOIN silver.employee m ON e.manager_employee_key = m.employee_key
        WHERE e.is_valid = TRUE
    """)
    
    employees = cursor.fetchall()
    
    insert_query = """
        INSERT INTO gold.dim_employee (
            employee_key, employee_id, first_name, last_name, full_name,
            job_title, start_date, end_date, tenure_years,
            is_active, employment_status, salary, commission_percent,
            manager_employee_id, country_name
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (employee_key) DO UPDATE SET
            first_name = EXCLUDED.first_name,
            last_name = EXCLUDED.last_name,
            full_name = EXCLUDED.full_name,
            job_title = EXCLUDED.job_title,
            is_active = EXCLUDED.is_active,
            employment_status = EXCLUDED.employment_status
    """
    
    execute_batch(cursor, insert_query, employees)
    connection.commit()
    cursor.close()
    return len(employees)


def populate_dim_location(connection):
    """Populate location dimension from silver.location."""
    cursor = connection.cursor()
    
    cursor.execute("""
        SELECT l.location_key, l.location_id, l.address_line_1, l.city,
               l.state_province, l.district, l.postal_code,
               c.country_id, c.country_name, c.country_code, c.currency_code,
               l.location_type
        FROM silver.location l
        LEFT JOIN silver.country c ON l.country_key = c.country_key
        WHERE l.is_valid = TRUE
    """)
    
    locations = cursor.fetchall()
    
    insert_query = """
        INSERT INTO gold.dim_location (
            location_key, location_id, address_line_1, city,
            state_province, district, postal_code,
            country_id, country_name, country_code, currency_code,
            location_type
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (location_key) DO UPDATE SET
            address_line_1 = EXCLUDED.address_line_1,
            city = EXCLUDED.city,
            state_province = EXCLUDED.state_province,
            country_name = EXCLUDED.country_name
    """
    
    execute_batch(cursor, insert_query, locations)
    connection.commit()
    cursor.close()
    return len(locations)


def populate_dim_warehouse(connection):
    """Populate warehouse dimension from silver.warehouse."""
    cursor = connection.cursor()
    
    cursor.execute("""
        SELECT w.warehouse_key, w.warehouse_id, w.warehouse_name,
               l.location_key, l.city, l.state_province, c.country_name
        FROM silver.warehouse w
        LEFT JOIN silver.location l ON w.location_key = l.location_key
        LEFT JOIN silver.country c ON l.country_key = c.country_key
        WHERE w.is_valid = TRUE
    """)
    
    warehouses = cursor.fetchall()
    
    insert_query = """
        INSERT INTO gold.dim_warehouse (
            warehouse_key, warehouse_id, warehouse_name,
            location_key, city, state_province, country_name
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (warehouse_key) DO UPDATE SET
            warehouse_name = EXCLUDED.warehouse_name,
            city = EXCLUDED.city,
            state_province = EXCLUDED.state_province
    """
    
    execute_batch(cursor, insert_query, warehouses)
    connection.commit()
    cursor.close()
    return len(warehouses)


def populate_dim_promotion(connection):
    """Populate promotion dimension from unique promotion codes in orders."""
    cursor = connection.cursor()
    
    cursor.execute("""
        SELECT DISTINCT promotion_code
        FROM silver.orders
        WHERE promotion_code IS NOT NULL AND promotion_code != ''
    """)
    
    promo_codes = cursor.fetchall()
    
    insert_query = """
        INSERT INTO gold.dim_promotion (
            promotion_code, promotion_name, promotion_type, is_active
        )
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (promotion_code) DO NOTHING
    """
    
    transformed = []
    for row in promo_codes:
        promo_code = row[0]
        transformed.append((
            promo_code,
            f"Promotion {promo_code}",
            "DISCOUNT",  # Default type
            True
        ))
    
    execute_batch(cursor, insert_query, transformed)
    connection.commit()
    cursor.close()
    return len(transformed)


def populate_fact_sales(connection, batch_size=10000):
    """Populate sales fact table from silver orders and order_items."""
    cursor = connection.cursor()
    
    # Get order items that don't already exist in fact_sales
    cursor.execute("""
        SELECT 
            o.order_date,
            oi.order_key,
            oi.order_item_id,
            o.customer_key,
            oi.product_key,
            o.sales_rep_key,
            o.order_id,
            o.order_code,
            oi.quantity,
            oi.unit_price,
            COALESCE(oi.discount_amount, 0),
            COALESCE(oi.unit_price * oi.quantity, 0) as gross_amount,
            COALESCE(oi.net_amount, 0),
            o.order_status,
            o.order_status_category
        FROM silver.order_item oi
        JOIN silver.orders o ON oi.order_key = o.order_key
        LEFT JOIN gold.fact_sales fs ON o.order_id = fs.order_id AND oi.order_item_id = fs.order_item_id
        WHERE o.is_valid = TRUE
          AND fs.order_id IS NULL
        ORDER BY o.order_date, o.order_id, oi.order_item_id
        LIMIT %s
    """, (batch_size,))
    
    order_items = cursor.fetchall()
    
    if not order_items:
        cursor.close()
        return 0
    
    # Get date keys
    dates = set(row[0] for row in order_items if row[0])
    date_keys = {}
    for d in dates:
        date_key = int(d.strftime('%Y%m%d'))
        date_keys[d] = date_key
    
    insert_query = """
        INSERT INTO gold.fact_sales (
            order_date_key, customer_key, product_key, employee_key,
            order_id, order_item_id, order_code,
            quantity, unit_price, discount_amount, gross_amount, net_amount,
            order_status, order_status_category
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    """
    
    transformed = []
    for row in order_items:
        order_date = row[0]
        date_key = date_keys.get(order_date)
        if not date_key:
            continue
        
        transformed.append((
            date_key, row[3], row[4], row[5],  # dimension keys
            row[6], row[2], row[7],  # degenerate dimensions
            row[8], row[9], row[10], row[11], row[12],  # measures
            row[13], row[14]  # status
        ))
    
    execute_batch(cursor, insert_query, transformed)
    connection.commit()
    cursor.close()
    return len(transformed)


def populate_fact_orders(connection, batch_size=10000):
    """Populate order fact table from silver.orders."""
    cursor = connection.cursor()
    
    cursor.execute("""
        SELECT 
            o.order_date,
            o.customer_key,
            o.sales_rep_key,
            o.order_id,
            o.order_code,
            o.order_status,
            o.order_status_category,
            o.order_total,
            o.order_currency,
            o.promotion_code
        FROM silver.orders o
        LEFT JOIN gold.fact_orders fo ON o.order_id = fo.order_id
        WHERE o.is_valid = TRUE
          AND fo.order_id IS NULL
        ORDER BY o.order_date, o.order_id
        LIMIT %s
    """, (batch_size,))
    
    orders = cursor.fetchall()
    
    if not orders:
        cursor.close()
        return 0
    
    # Get order item counts and totals
    order_ids = [row[3] for row in orders]
    placeholders = ','.join(['%s'] * len(order_ids))
    
    cursor.execute(f"""
        SELECT 
            o.order_id,
            COUNT(oi.order_item_id) as total_items,
            COUNT(DISTINCT oi.product_key) as distinct_products,
            SUM(oi.quantity) as total_quantity,
            SUM(COALESCE(oi.discount_amount, 0)) as total_discount,
            SUM(COALESCE(oi.net_amount, 0)) as net_amount
        FROM silver.orders o
        LEFT JOIN silver.order_item oi ON o.order_key = oi.order_key
        WHERE o.order_id IN ({placeholders})
        GROUP BY o.order_id
    """, order_ids)
    
    order_stats = {row[0]: row[1:] for row in cursor.fetchall()}
    
    # Get promotion keys
    promo_codes = set(row[9] for row in orders if row[9])
    promo_keys = {}
    if promo_codes:
        placeholders = ','.join(['%s'] * len(promo_codes))
        cursor.execute(f"""
            SELECT promotion_code, promotion_key
            FROM gold.dim_promotion
            WHERE promotion_code IN ({placeholders})
        """, list(promo_codes))
        promo_keys = {row[0]: row[1] for row in cursor.fetchall()}
    
    insert_query = """
        INSERT INTO gold.fact_orders (
            order_date_key, customer_key, employee_key, promotion_key,
            order_id, order_code,
            total_quantity, total_items, distinct_products,
            gross_amount, discount_amount, net_amount,
            order_status, order_status_category, order_currency, has_promotion
        )
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (order_id) DO NOTHING
    """
    
    transformed = []
    for row in orders:
        order_date = row[0]
        date_key = int(order_date.strftime('%Y%m%d'))
        
        stats = order_stats.get(row[3], (0, 0, 0, 0, 0))
        
        transformed.append((
            date_key, row[1], row[2], promo_keys.get(row[9]),  # dimension keys
            row[3], row[4],  # degenerate dimension
            stats[2], stats[0], stats[1],  # quantity measures
            row[7] or 0, stats[3], stats[4],  # amount measures
            row[5], row[6], row[8], bool(row[9])  # attributes
        ))
    
    execute_batch(cursor, insert_query, transformed)
    connection.commit()
    cursor.close()
    return len(transformed)


def populate_agg_sales_rep_performance(connection):
    """Populate sales rep performance aggregation."""
    cursor = connection.cursor()
    
    # Delete existing
    cursor.execute("DELETE FROM gold.agg_sales_rep_performance")
    
    aggregate_query = """
        INSERT INTO gold.agg_sales_rep_performance (
            employee_key, year_number, month_number,
            total_orders, total_customers_served, new_customers_acquired,
            gross_sales, net_sales, total_commission
        )
        SELECT
            o.sales_rep_key as employee_key,
            EXTRACT(YEAR FROM o.order_date)::INT as year_number,
            EXTRACT(MONTH FROM o.order_date)::INT as month_number,
            COUNT(DISTINCT o.order_id) as total_orders,
            COUNT(DISTINCT o.customer_key) as total_customers_served,
            COUNT(DISTINCT CASE WHEN o.order_date = (
                SELECT MIN(o2.order_date) 
                FROM silver.orders o2 
                WHERE o2.customer_key = o.customer_key
            ) THEN o.customer_key END) as new_customers_acquired,
            SUM(COALESCE(oi.line_total, 0)) as gross_sales,
            SUM(COALESCE(oi.net_amount, 0)) as net_sales,
            SUM(COALESCE(oi.net_amount, 0) * COALESCE(e.commission_percent, 0) / 100) as total_commission
        FROM silver.orders o
        LEFT JOIN silver.order_item oi ON o.order_key = oi.order_key
        LEFT JOIN silver.employee e ON o.sales_rep_key = e.employee_key
        WHERE o.sales_rep_key IS NOT NULL AND o.is_valid = TRUE
        GROUP BY o.sales_rep_key, EXTRACT(YEAR FROM o.order_date), EXTRACT(MONTH FROM o.order_date)
    """
    
    cursor.execute(aggregate_query)
    count = cursor.rowcount
    
    # Add rankings
    cursor.execute("""
        UPDATE gold.agg_sales_rep_performance p
        SET sales_rank = sub.rank
        FROM (
            SELECT performance_key,
                   ROW_NUMBER() OVER (
                       PARTITION BY year_number, month_number
                       ORDER BY net_sales DESC
                   ) as rank
            FROM gold.agg_sales_rep_performance
        ) sub
        WHERE p.performance_key = sub.performance_key
    """)
    
    connection.commit()
    cursor.close()
    return count


def populate_all_gold_tables(days_to_aggregate=30, force_repopulate=False):
    """Populate all Gold layer tables."""
    start_time = datetime.now()
    
    logger.info("=" * 80)
    logger.info("POPULATE ALL GOLD LAYER TABLES")
    logger.info("=" * 80)
    logger.info(f"Start Time: {start_time.strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info(f"Days to Aggregate: {days_to_aggregate}")
    logger.info(f"Force Repopulate: {force_repopulate}")
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
        # Check prerequisites
        logger.info("-" * 80)
        logger.info("PREREQUISITE CHECKS")
        logger.info("-" * 80)
        
        silver_orders = get_table_count(connection, "silver", "orders")
        silver_customers = get_table_count(connection, "silver", "customer")
        silver_products = get_table_count(connection, "silver", "product")
        
        logger.info(f"Silver Orders:           {silver_orders:>15,} records")
        logger.info(f"Silver Customers:       {silver_customers:>15,} records")
        logger.info(f"Silver Products:        {silver_products:>15,} records")
        logger.info("")
        
        if silver_orders == 0:
            logger.error("ERROR: silver.orders table is empty. Cannot populate Gold layer.")
            return
        
        # Get date range
        cursor = connection.cursor()
        cursor.execute("SELECT MIN(order_date), MAX(order_date) FROM silver.orders")
        result = cursor.fetchone()
        min_date = result[0] if result[0] else date.today() - timedelta(days=days_to_aggregate)
        max_date = result[1] if result[1] else date.today()
        cursor.close()
        
        logger.info(f"Order Date Range:       {min_date} to {max_date}")
        logger.info("")
        
        # Force repopulate if requested
        if force_repopulate:
            logger.info("-" * 80)
            logger.info("TRUNCATING GOLD LAYER TABLES")
            logger.info("-" * 80)
            cursor = connection.cursor()
            tables = [
                'agg_sales_rep_performance', 'agg_customer_lifetime',
                'agg_monthly_product_sales', 'agg_daily_sales',
                'fact_orders', 'fact_inventory_snapshot', 'fact_sales',
                'dim_promotion', 'dim_warehouse', 'dim_location',
                'dim_employee', 'dim_product', 'dim_customer', 'dim_date'
            ]
            for table in tables:
                try:
                    cursor.execute(f"TRUNCATE TABLE gold.{table} CASCADE")
                    logger.info(f"  Truncated gold.{table}")
                except Exception as e:
                    logger.warning(f"  Could not truncate gold.{table}: {e}")
            connection.commit()
            cursor.close()
            logger.info("")
        
        totals = {}
        
        # ========================================================================
        # DIMENSIONS
        # ========================================================================
        logger.info("=" * 80)
        logger.info("PHASE 1: POPULATING DIMENSIONS")
        logger.info("=" * 80)
        
        # Date Dimension
        logger.info("-" * 80)
        logger.info("1.1: Date Dimension")
        logger.info("-" * 80)
        dim_date_start = time.time()
        date_count = populate_dim_date(connection, min_date, max_date)
        dim_date_elapsed = time.time() - dim_date_start
        totals['dim_date'] = date_count
        logger.info(f"  Inserted: {date_count:,} date records in {dim_date_elapsed:.2f}s")
        logger.info("")
        
        # Customer Dimension
        logger.info("-" * 80)
        logger.info("1.2: Customer Dimension")
        logger.info("-" * 80)
        dim_cust_start = time.time()
        cust_count = populate_dim_customer(connection)
        dim_cust_elapsed = time.time() - dim_cust_start
        totals['dim_customer'] = cust_count
        logger.info(f"  Inserted: {cust_count:,} customer records in {dim_cust_elapsed:.2f}s")
        logger.info("")
        
        # Product Dimension
        logger.info("-" * 80)
        logger.info("1.3: Product Dimension")
        logger.info("-" * 80)
        dim_prod_start = time.time()
        prod_count = populate_dim_product(connection)
        dim_prod_elapsed = time.time() - dim_prod_start
        totals['dim_product'] = prod_count
        logger.info(f"  Inserted: {prod_count:,} product records in {dim_prod_elapsed:.2f}s")
        logger.info("")
        
        # Employee Dimension
        logger.info("-" * 80)
        logger.info("1.4: Employee Dimension")
        logger.info("-" * 80)
        dim_emp_start = time.time()
        emp_count = populate_dim_employee(connection)
        dim_emp_elapsed = time.time() - dim_emp_start
        totals['dim_employee'] = emp_count
        logger.info(f"  Inserted: {emp_count:,} employee records in {dim_emp_elapsed:.2f}s")
        logger.info("")
        
        # Location Dimension
        logger.info("-" * 80)
        logger.info("1.5: Location Dimension")
        logger.info("-" * 80)
        dim_loc_start = time.time()
        loc_count = populate_dim_location(connection)
        dim_loc_elapsed = time.time() - dim_loc_start
        totals['dim_location'] = loc_count
        logger.info(f"  Inserted: {loc_count:,} location records in {dim_loc_elapsed:.2f}s")
        logger.info("")
        
        # Warehouse Dimension
        logger.info("-" * 80)
        logger.info("1.6: Warehouse Dimension")
        logger.info("-" * 80)
        dim_wh_start = time.time()
        wh_count = populate_dim_warehouse(connection)
        dim_wh_elapsed = time.time() - dim_wh_start
        totals['dim_warehouse'] = wh_count
        logger.info(f"  Inserted: {wh_count:,} warehouse records in {dim_wh_elapsed:.2f}s")
        logger.info("")
        
        # Promotion Dimension
        logger.info("-" * 80)
        logger.info("1.7: Promotion Dimension")
        logger.info("-" * 80)
        dim_promo_start = time.time()
        promo_count = populate_dim_promotion(connection)
        dim_promo_elapsed = time.time() - dim_promo_start
        totals['dim_promotion'] = promo_count
        logger.info(f"  Inserted: {promo_count:,} promotion records in {dim_promo_elapsed:.2f}s")
        logger.info("")
        
        # ========================================================================
        # FACTS
        # ========================================================================
        logger.info("=" * 80)
        logger.info("PHASE 2: POPULATING FACT TABLES")
        logger.info("=" * 80)
        
        # Fact Sales
        logger.info("-" * 80)
        logger.info("2.1: Fact Sales")
        logger.info("-" * 80)
        fact_sales_start = time.time()
        fact_sales_before = get_table_count(connection, "gold", "fact_sales")
        
        # Process in batches
        batch_size = 10000
        fact_sales_total = 0
        while True:
            count = populate_fact_sales(connection, batch_size)
            if count == 0:
                break
            fact_sales_total += count
            logger.info(f"  Processed batch: {count:,} records (Total: {fact_sales_total:,})")
        
        fact_sales_elapsed = time.time() - fact_sales_start
        totals['fact_sales'] = fact_sales_total
        logger.info(f"  Total: {fact_sales_total:,} sales fact records in {fact_sales_elapsed:.2f}s")
        logger.info("")
        
        # Fact Orders
        logger.info("-" * 80)
        logger.info("2.2: Fact Orders")
        logger.info("-" * 80)
        fact_orders_start = time.time()
        fact_orders_before = get_table_count(connection, "gold", "fact_orders")
        
        fact_orders_total = 0
        while True:
            count = populate_fact_orders(connection, batch_size)
            if count == 0:
                break
            fact_orders_total += count
            logger.info(f"  Processed batch: {count:,} records (Total: {fact_orders_total:,})")
        
        fact_orders_elapsed = time.time() - fact_orders_start
        totals['fact_orders'] = fact_orders_total
        logger.info(f"  Total: {fact_orders_total:,} order fact records in {fact_orders_elapsed:.2f}s")
        logger.info("")
        
        # ========================================================================
        # AGGREGATIONS
        # ========================================================================
        logger.info("=" * 80)
        logger.info("PHASE 3: POPULATING AGGREGATION TABLES")
        logger.info("=" * 80)
        
        aggregator = SilverToGoldAggregator(connection)
        
        # Daily Sales
        logger.info("-" * 80)
        logger.info("3.1: Daily Sales Aggregation")
        logger.info("-" * 80)
        agg_daily_start = time.time()
        daily_count = 0
        current_date = max_date
        end_date = max(max_date - timedelta(days=days_to_aggregate - 1), min_date)
        while current_date >= end_date:
            result = aggregator.aggregate_daily_sales(current_date)
            if result > 0:
                daily_count += 1
            current_date -= timedelta(days=1)
        agg_daily_elapsed = time.time() - agg_daily_start
        totals['agg_daily_sales'] = daily_count
        logger.info(f"  Aggregated: {daily_count} days in {agg_daily_elapsed:.2f}s")
        logger.info("")
        
        # Customer Lifetime
        logger.info("-" * 80)
        logger.info("3.2: Customer Lifetime Aggregation")
        logger.info("-" * 80)
        agg_cust_start = time.time()
        cust_ltv_count = aggregator.aggregate_customer_lifetime()
        agg_cust_elapsed = time.time() - agg_cust_start
        totals['agg_customer_lifetime'] = cust_ltv_count
        logger.info(f"  Aggregated: {cust_ltv_count:,} customers in {agg_cust_elapsed:.2f}s")
        logger.info("")
        
        # Monthly Product Sales
        logger.info("-" * 80)
        logger.info("3.3: Monthly Product Sales Aggregation")
        logger.info("-" * 80)
        agg_prod_start = time.time()
        monthly_prod_count = aggregator.aggregate_monthly_product_sales()
        agg_prod_elapsed = time.time() - agg_prod_start
        totals['agg_monthly_product_sales'] = monthly_prod_count
        logger.info(f"  Aggregated: {monthly_prod_count:,} records in {agg_prod_elapsed:.2f}s")
        logger.info("")
        
        # Sales Rep Performance
        logger.info("-" * 80)
        logger.info("3.4: Sales Rep Performance Aggregation")
        logger.info("-" * 80)
        agg_perf_start = time.time()
        perf_count = populate_agg_sales_rep_performance(connection)
        agg_perf_elapsed = time.time() - agg_perf_start
        totals['agg_sales_rep_performance'] = perf_count
        logger.info(f"  Aggregated: {perf_count:,} records in {agg_perf_elapsed:.2f}s")
        logger.info("")
        
        # ========================================================================
        # FINAL SUMMARY
        # ========================================================================
        end_time = datetime.now()
        total_elapsed = (end_time - start_time).total_seconds()
        
        logger.info("")
        logger.info("=" * 80)
        logger.info("ALL GOLD LAYER TABLES POPULATED")
        logger.info("=" * 80)
        logger.info("FINAL SUMMARY:")
        logger.info("-" * 80)
        logger.info("Dimensions:")
        logger.info(f"  dim_date:                    {totals.get('dim_date', 0):>15,}")
        logger.info(f"  dim_customer:                {totals.get('dim_customer', 0):>15,}")
        logger.info(f"  dim_product:                 {totals.get('dim_product', 0):>15,}")
        logger.info(f"  dim_employee:                {totals.get('dim_employee', 0):>15,}")
        logger.info(f"  dim_location:                {totals.get('dim_location', 0):>15,}")
        logger.info(f"  dim_warehouse:               {totals.get('dim_warehouse', 0):>15,}")
        logger.info(f"  dim_promotion:               {totals.get('dim_promotion', 0):>15,}")
        logger.info("")
        logger.info("Facts:")
        logger.info(f"  fact_sales:                  {totals.get('fact_sales', 0):>15,}")
        logger.info(f"  fact_orders:                 {totals.get('fact_orders', 0):>15,}")
        logger.info("")
        logger.info("Aggregations:")
        logger.info(f"  agg_daily_sales:             {totals.get('agg_daily_sales', 0):>15,} days")
        logger.info(f"  agg_customer_lifetime:      {totals.get('agg_customer_lifetime', 0):>15,}")
        logger.info(f"  agg_monthly_product_sales:  {totals.get('agg_monthly_product_sales', 0):>15,}")
        logger.info(f"  agg_sales_rep_performance:  {totals.get('agg_sales_rep_performance', 0):>15,}")
        logger.info("")
        logger.info(f"Total Time:                    {total_elapsed:>15.2f} seconds ({total_elapsed/60:.2f} minutes)")
        logger.info(f"End Time:                      {end_time.strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("=" * 80)
        
    except Exception as e:
        logger.error(f"Error during population: {e}", exc_info=True)
        connection.rollback()
        raise
    finally:
        connection.close()
        logger.info("")
        logger.info("Database connection closed.")


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Populate all Gold layer tables")
    parser.add_argument(
        "--days",
        type=int,
        default=30,
        help="Number of days to aggregate for daily sales (default: 30)"
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Force repopulate all tables (truncate and repopulate)"
    )
    
    args = parser.parse_args()
    
    try:
        populate_all_gold_tables(days_to_aggregate=args.days, force_repopulate=args.force)
    except KeyboardInterrupt:
        logger.info("")
        logger.info("Population interrupted by user.")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Fatal error: {e}", exc_info=True)
        sys.exit(1)

