"""
Silver to Gold Layer Aggregator
Aggregates Silver layer data into Gold layer analytics tables.
Updated to work with the actual schema: gold.agg_daily_sales, gold.agg_customer_lifetime, etc.
"""

import psycopg2
from datetime import datetime, date, timedelta
from typing import Any, Dict, List
import logging
import time

logger = logging.getLogger(__name__)


class SilverToGoldAggregator:
    """Aggregates Silver layer data to Gold layer."""
    
    def __init__(self, connection, tracker=None):
        """Initialize aggregator with database connection."""
        self.connection = connection
        self.cursor = connection.cursor()
        self.tracker = tracker
    
    def table_is_empty(self, schema: str, table: str) -> bool:
        """Check if a table is empty."""
        try:
            self.cursor.execute(f"SELECT 1 FROM {schema}.{table} LIMIT 1;")
            return self.cursor.fetchone() is None
        except Exception as e:
            logger.error(f"Error checking if {schema}.{table} is empty: {e}")
            return False
    
    def _ensure_dim_date_for_order_dates(self) -> None:
        """Ensure gold.dim_date contains every distinct order_date present in silver.orders."""
        logger.info(
            "Ensuring dim_date has all order dates (scanning silver.orders; "
            "this may take several minutes on very large tables)..."
        )
        t0 = time.time()
        self.cursor.execute("""
            WITH distinct_order_dates AS (
                SELECT DISTINCT order_date AS d
                FROM silver.orders
                WHERE order_date IS NOT NULL
            )
            SELECT d.d
            FROM distinct_order_dates d
            WHERE NOT EXISTS (
                SELECT 1 FROM gold.dim_date g WHERE g.full_date = d.d
            )
            ORDER BY 1
        """)
        missing_dates: List[Any] = [row[0] for row in self.cursor.fetchall()]
        elapsed = time.time() - t0
        logger.info(
            "  dim_date gap scan complete in %.1fs (%s dates missing from dim_date)",
            elapsed,
            f"{len(missing_dates):,}",
        )
        if not missing_dates:
            return
        logger.info(f"  Inserting {len(missing_dates):,} missing dim_date rows...")
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        month_names = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December']
        month_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        for order_date in missing_dates:
            date_key = int(order_date.strftime('%Y%m%d'))
            day_of_week = order_date.weekday() + 1
            quarter = (order_date.month - 1) // 3 + 1
            try:
                self.cursor.execute("""
                    INSERT INTO gold.dim_date (
                        date_key, full_date, day_of_week, day_name, day_of_month, day_of_year,
                        week_of_year, month_number, month_name, month_short_name,
                        quarter_number, quarter_name, year_number, is_weekend
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (date_key) DO NOTHING
                """, (
                    date_key, order_date, day_of_week, day_names[order_date.weekday()],
                    order_date.day, order_date.timetuple().tm_yday,
                    order_date.isocalendar()[1], order_date.month,
                    month_names[order_date.month - 1], month_short[order_date.month - 1],
                    quarter, f"Q{quarter}", order_date.year, order_date.weekday() >= 5
                ))
            except Exception as e:
                logger.warning(f"  Error inserting date {order_date}: {e}")
        self.connection.commit()
        logger.info(f"  Populated {len(missing_dates):,} missing dates in dim_date")
    
    def aggregate_daily_sales(self, target_date: date = None, force_refresh: bool = False):
        """Aggregate daily sales for a specific date into gold.agg_daily_sales."""
        if target_date is None:
            target_date = date.today() - timedelta(days=1)
        
        # Convert date to date_key (YYYYMMDD format)
        date_key = int(target_date.strftime('%Y%m%d'))
        
        # Check if data already exists for this date (unless force_refresh is True)
        if not force_refresh:
            self.cursor.execute(
                "SELECT 1 FROM gold.agg_daily_sales WHERE date_key = %s",
                (date_key,)
            )
            if self.cursor.fetchone():
                logger.debug(f"Daily sales data for {target_date} already exists; skipping.")
                return 0
        
        logger.info(f"Aggregating daily sales for {target_date}...")
        
        # Check if date dimension exists, create if not
        self.cursor.execute("SELECT 1 FROM gold.dim_date WHERE date_key = %s", (date_key,))
        if not self.cursor.fetchone():
            # Create date dimension entry
            day_of_week = target_date.weekday() + 1  # Monday = 1
            day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
            month_names = ['January', 'February', 'March', 'April', 'May', 'June',
                          'July', 'August', 'September', 'October', 'November', 'December']
            month_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                          'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
            
            self.cursor.execute("""
                INSERT INTO gold.dim_date (
                    date_key, full_date, day_of_week, day_name, day_of_month, day_of_year,
                    week_of_year, month_number, month_name, month_short_name,
                    quarter_number, quarter_name, year_number, is_weekend
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (date_key) DO NOTHING
            """, (
                date_key, target_date, day_of_week, day_names[target_date.weekday()],
                target_date.day, target_date.timetuple().tm_yday,
                target_date.isocalendar()[1], target_date.month,
                month_names[target_date.month - 1], month_short[target_date.month - 1],
                (target_date.month - 1) // 3 + 1, f"Q{(target_date.month - 1) // 3 + 1}",
                target_date.year, target_date.weekday() >= 5
            ))
            self.connection.commit()
        
        # Delete existing record for this date (if force_refresh or if we're updating)
        self.cursor.execute(
            "DELETE FROM gold.agg_daily_sales WHERE date_key = %s",
            (date_key,)
        )
        
        # Aggregate sales data from Silver layer
        aggregate_query = """
            INSERT INTO gold.agg_daily_sales (
                date_key, total_orders, total_customers, total_items_sold,
                gross_revenue, discount_given, net_revenue, avg_order_value
            )
            SELECT
                %s as date_key,
                COUNT(DISTINCT o.order_id) as total_orders,
                COUNT(DISTINCT o.customer_key) as total_customers,
                COALESCE(SUM(oi.quantity), 0) as total_items_sold,
                COALESCE(SUM(oi.line_total), 0) as gross_revenue,
                COALESCE(SUM(oi.discount_amount), 0) as discount_given,
                COALESCE(SUM(oi.net_amount), 0) as net_revenue,
                CASE WHEN COUNT(DISTINCT o.order_id) > 0
                    THEN COALESCE(SUM(oi.net_amount), 0) / COUNT(DISTINCT o.order_id)
                    ELSE 0
                END as avg_order_value
            FROM silver.orders o
            LEFT JOIN silver.order_item oi ON o.order_key = oi.order_key
            WHERE o.order_date = %s
        """
        
        try:
            self.cursor.execute(aggregate_query, (date_key, target_date))
            self.connection.commit()
            logger.info(f"Successfully aggregated daily sales for {target_date}")
            return 1
        except Exception as e:
            logger.error(f"Error aggregating daily sales: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def aggregate_customer_lifetime(self, force_refresh: bool = False):
        """Aggregate customer lifetime value into gold.agg_customer_lifetime."""
        if not force_refresh and not self.table_is_empty('gold', 'agg_customer_lifetime'):
            logger.info("[SKIP] gold.agg_customer_lifetime already has data; skipping. Use force_refresh=True to regenerate.")
            return 0
        
        # Check prerequisite tables
        try:
            self.connection.rollback()  # Ensure clean transaction
        except:
            pass
        
        self.cursor.execute("SELECT COUNT(*) FROM silver.customer WHERE is_valid = TRUE")
        customer_count = self.cursor.fetchone()[0]
        self.cursor.execute("SELECT COUNT(*) FROM silver.orders WHERE is_valid = TRUE")
        orders_count = self.cursor.fetchone()[0]
        logger.info(f"Aggregating customer lifetime data... (Found {customer_count:,} customers, {orders_count:,} orders in Silver)")
        
        if customer_count == 0 or orders_count == 0:
            logger.warning("[WARN] silver.customer or silver.orders is empty - cannot aggregate customer lifetime")
            logger.warning("  [WARN] Ensure silver.customer and silver.orders are populated first")
            return 0
        
        # Delete existing records only if force_refresh or if we're processing
        if force_refresh:
            self.cursor.execute("DELETE FROM gold.agg_customer_lifetime")
        
        aggregate_query = """
            INSERT INTO gold.agg_customer_lifetime (
                customer_key, first_order_date, last_order_date, customer_tenure_days,
                total_orders, total_items_purchased, lifetime_gross_value,
                lifetime_net_value, avg_order_value, avg_order_frequency_days,
                rfm_recency_score, rfm_frequency_score, rfm_monetary_score,
                rfm_segment, customer_tier
            )
            WITH customer_stats AS (
                SELECT
                    c.customer_key,
                    MIN(o.order_date) as first_order_date,
                    MAX(o.order_date) as last_order_date,
                    COUNT(DISTINCT o.order_id) as total_orders,
                    COALESCE(SUM(oi.quantity), 0) as total_items_purchased,
                    COALESCE(SUM(oi.line_total), 0) as lifetime_gross_value,
                    COALESCE(SUM(oi.net_amount), 0) as lifetime_net_value,
                    CASE WHEN COUNT(DISTINCT o.order_id) > 0
                        THEN COALESCE(SUM(oi.net_amount), 0) / COUNT(DISTINCT o.order_id)
                        ELSE 0
                    END as avg_order_value
                FROM silver.customer c
                LEFT JOIN silver.orders o ON c.customer_key = o.customer_key
                LEFT JOIN silver.order_item oi ON o.order_key = oi.order_key
                WHERE c.is_valid = TRUE
                GROUP BY c.customer_key
            ),
            rfm_scores AS (
                SELECT
                    cs.*,
                    CASE
                        WHEN (CURRENT_DATE - cs.last_order_date) <= 30 THEN 5
                        WHEN (CURRENT_DATE - cs.last_order_date) <= 60 THEN 4
                        WHEN (CURRENT_DATE - cs.last_order_date) <= 90 THEN 3
                        WHEN (CURRENT_DATE - cs.last_order_date) <= 180 THEN 2
                        ELSE 1
                    END as recency_score,
                    CASE
                        WHEN cs.total_orders >= 20 THEN 5
                        WHEN cs.total_orders >= 10 THEN 4
                        WHEN cs.total_orders >= 5 THEN 3
                        WHEN cs.total_orders >= 2 THEN 2
                        ELSE 1
                    END as frequency_score,
                    CASE
                        WHEN cs.lifetime_net_value >= 10000 THEN 5
                        WHEN cs.lifetime_net_value >= 5000 THEN 4
                        WHEN cs.lifetime_net_value >= 2000 THEN 3
                        WHEN cs.lifetime_net_value >= 500 THEN 2
                        ELSE 1
                    END as monetary_score
                FROM customer_stats cs
            )
            SELECT
                rfm.customer_key,
                rfm.first_order_date,
                rfm.last_order_date,
                CASE WHEN rfm.first_order_date IS NOT NULL
                    THEN (CURRENT_DATE - rfm.first_order_date)
                    ELSE 0
                END as customer_tenure_days,
                rfm.total_orders,
                rfm.total_items_purchased,
                rfm.lifetime_gross_value,
                rfm.lifetime_net_value,
                rfm.avg_order_value,
                CASE WHEN rfm.total_orders > 1 AND rfm.first_order_date IS NOT NULL AND rfm.last_order_date IS NOT NULL
                    THEN (rfm.last_order_date - rfm.first_order_date) / NULLIF(rfm.total_orders - 1, 0)
                    ELSE NULL
                END as avg_order_frequency_days,
                rfm.recency_score,
                rfm.frequency_score,
                rfm.monetary_score,
                CASE
                    WHEN rfm.recency_score >= 4 AND rfm.frequency_score >= 4 AND rfm.monetary_score >= 4 THEN 'Champions'
                    WHEN rfm.recency_score >= 3 AND rfm.frequency_score >= 3 AND rfm.monetary_score >= 3 THEN 'Loyal Customers'
                    WHEN rfm.recency_score >= 2 AND rfm.frequency_score >= 2 THEN 'Potential Loyalists'
                    WHEN rfm.recency_score >= 3 AND rfm.frequency_score <= 2 THEN 'New Customers'
                    WHEN rfm.recency_score <= 2 AND rfm.frequency_score >= 3 THEN 'At Risk'
                    WHEN rfm.recency_score <= 2 AND rfm.frequency_score <= 2 AND rfm.monetary_score >= 3 THEN 'Cannot Lose Them'
                    WHEN rfm.recency_score <= 2 AND rfm.frequency_score <= 2 AND rfm.monetary_score <= 2 THEN 'Lost'
                    ELSE 'Need Attention'
                END as rfm_segment,
                CASE
                    WHEN rfm.lifetime_net_value >= 10000 THEN 'PLATINUM'
                    WHEN rfm.lifetime_net_value >= 5000 THEN 'GOLD'
                    WHEN rfm.lifetime_net_value >= 2000 THEN 'SILVER'
                    ELSE 'BRONZE'
                END as customer_tier
            FROM rfm_scores rfm
        """
        
        try:
            self.cursor.execute(aggregate_query)
            count = self.cursor.rowcount
            self.connection.commit()
            if count == 0:
                logger.warning("[WARN] No records inserted into agg_customer_lifetime - check data quality")
            else:
                logger.info(f"Successfully aggregated {count:,} customer lifetime records")
            return count
        except Exception as e:
            logger.error(f"[ERROR] Error aggregating customer lifetime: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def aggregate_monthly_product_sales(self, force_refresh: bool = False):
        """Aggregate monthly product sales into gold.agg_monthly_product_sales."""
        if not force_refresh and not self.table_is_empty('gold', 'agg_monthly_product_sales'):
            logger.info("[SKIP] gold.agg_monthly_product_sales already has data; skipping. Use force_refresh=True to regenerate.")
            return 0
        
        # Check prerequisite tables
        try:
            self.connection.rollback()  # Ensure clean transaction
        except:
            pass
        
        self.cursor.execute("SELECT COUNT(*) FROM silver.orders WHERE is_valid = TRUE")
        orders_count = self.cursor.fetchone()[0]
        self.cursor.execute("SELECT COUNT(*) FROM silver.order_item WHERE is_valid = TRUE")
        items_count = self.cursor.fetchone()[0]
        logger.info(f"Aggregating monthly product sales... (Found {orders_count:,} orders, {items_count:,} order items in Silver)")
        
        if orders_count == 0 or items_count == 0:
            logger.warning("[WARN] silver.orders or silver.order_item is empty - cannot aggregate monthly product sales")
            logger.warning("  [WARN] Ensure silver.orders and silver.order_item are populated first")
            return 0
        
        # Delete existing records only if force_refresh or if we're processing
        if force_refresh:
            self.cursor.execute("DELETE FROM gold.agg_monthly_product_sales")
        
        aggregate_query = """
            INSERT INTO gold.agg_monthly_product_sales (
                year_number, month_number, category_name,
                total_quantity_sold, total_orders, gross_revenue,
                net_revenue, avg_unit_price, category_rank
            )
            WITH monthly_stats AS (
                SELECT
                    EXTRACT(YEAR FROM o.order_date)::INT as year_number,
                    EXTRACT(MONTH FROM o.order_date)::INT as month_number,
                    COALESCE(p.category_name, 'Unknown') as category_name,
                    SUM(oi.quantity) as total_quantity_sold,
                    COUNT(DISTINCT o.order_id) as total_orders,
                    SUM(oi.line_total) as gross_revenue,
                    SUM(oi.net_amount) as net_revenue,
                    CASE WHEN SUM(oi.quantity) > 0
                        THEN SUM(oi.line_total) / SUM(oi.quantity)
                        ELSE 0
                    END as avg_unit_price
                FROM silver.orders o
                JOIN silver.order_item oi ON o.order_key = oi.order_key
                JOIN silver.product p ON oi.product_key = p.product_key
                WHERE p.is_valid = TRUE
                GROUP BY EXTRACT(YEAR FROM o.order_date), EXTRACT(MONTH FROM o.order_date), p.category_name
            )
            SELECT
                ms.year_number,
                ms.month_number,
                ms.category_name,
                ms.total_quantity_sold,
                ms.total_orders,
                ms.gross_revenue,
                ms.net_revenue,
                ms.avg_unit_price,
                ROW_NUMBER() OVER (
                    PARTITION BY ms.year_number, ms.month_number
                    ORDER BY ms.net_revenue DESC
                ) as category_rank
            FROM monthly_stats ms
        """
        
        try:
            self.cursor.execute(aggregate_query)
            count = self.cursor.rowcount
            self.connection.commit()
            if count == 0:
                logger.warning("[WARN] No records inserted into agg_monthly_product_sales - check data quality")
            else:
                logger.info(f"Successfully aggregated {count:,} monthly product sales records")
            return count
        except Exception as e:
            logger.error(f"[ERROR] Error aggregating monthly product sales: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def populate_dim_date(self, start_date: date = None, end_date: date = None, force_refresh: bool = False):
        """Populate dim_date for all dates in the data range."""
        # Check if table is empty - if not empty and not force_refresh, skip
        if not force_refresh and not self.table_is_empty('gold', 'dim_date'):
            logger.info("[SKIP] gold.dim_date already has data; skipping.")
            return 0
        
        logger.info("Populating date dimension...")
        
        # Get date range from Silver orders if not provided
        if start_date is None or end_date is None:
            try:
                self.cursor.execute("""
                    SELECT MIN(order_date) as min_date, MAX(order_date) as max_date
                    FROM silver.orders
                    WHERE order_date IS NOT NULL
                """)
                result = self.cursor.fetchone()
                if result and result[0] and result[1]:
                    start_date = result[0] if start_date is None else start_date
                    end_date = result[1] if end_date is None else end_date
                else:
                    # Default to last 2 years if no orders
                    end_date = date.today()
                    start_date = date.today() - timedelta(days=730)
            except Exception as e:
                logger.warning(f"Could not determine date range from orders: {e}")
                end_date = date.today()
                start_date = date.today() - timedelta(days=730)
        
        if force_refresh:
            # Delete all dates in the range
            self.cursor.execute("DELETE FROM gold.dim_date WHERE full_date >= %s AND full_date <= %s", 
                              (start_date, end_date))
        else:
            # If not force_refresh, we're here because table is empty, so no need to delete
            pass
        
        day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
        month_names = ['January', 'February', 'March', 'April', 'May', 'June',
                      'July', 'August', 'September', 'October', 'November', 'December']
        month_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
        
        current_date = start_date
        inserted = 0
        while current_date <= end_date:
            date_key = int(current_date.strftime('%Y%m%d'))
            day_of_week = current_date.weekday() + 1
            quarter = (current_date.month - 1) // 3 + 1
            
            try:
                self.cursor.execute("""
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
                    quarter, f"Q{quarter}", current_date.year, current_date.weekday() >= 5
                ))
                if self.cursor.rowcount > 0:
                    inserted += 1
            except Exception as e:
                logger.warning(f"Error inserting date {current_date}: {e}")
            
            current_date += timedelta(days=1)
        
        self.connection.commit()
        logger.info(f"Populated {inserted:,} date dimension records")
        return inserted
    
    def populate_dim_customer(self, force_refresh: bool = False):
        """Populate dim_customer from silver.customer."""
        if not force_refresh and not self.table_is_empty('gold', 'dim_customer'):
            logger.info("[SKIP] gold.dim_customer already has data; skipping.")
            return 0
        
        # Check prerequisite tables
        try:
            self.connection.rollback()  # Ensure clean transaction
        except:
            pass
        
        self.cursor.execute("SELECT COUNT(*) FROM silver.customer WHERE is_valid = TRUE")
        customer_count = self.cursor.fetchone()[0]
        logger.info(f"Populating customer dimension... (Found {customer_count:,} valid customers in silver.customer)")
        
        if customer_count == 0:
            logger.warning("[WARN] silver.customer is empty - cannot populate dim_customer")
            logger.warning("  [WARN] Ensure silver.customer is populated first by running Bronze->Silver ETL")
            return 0
        
        if force_refresh:
            # Can't delete due to foreign key constraints, so we'll insert only missing ones
            logger.info("  Note: force_refresh=True but cannot delete due to FK constraints - will insert missing customers only")
        
        query = """
            INSERT INTO gold.dim_customer (
                customer_key, customer_id, first_name, last_name, full_name, gender,
                company_name, company_credit_limit, customer_type, income_level,
                income_bracket, account_manager_id, city, state_province,
                country_name, postal_code, is_current, effective_date
            )
            SELECT DISTINCT
                c.customer_key,
                c.customer_id,
                p.first_name,
                p.last_name,
                p.full_name,
                p.gender,
                cc.company_name,
                cc.credit_limit as company_credit_limit,
                c.customer_type,
                c.income_level,
                c.income_bracket,
                c.account_manager_id,
                loc.city,
                loc.state_province,
                co.country_name,
                loc.postal_code,
                TRUE as is_current,
                COALESCE(c.customer_since, CURRENT_DATE) as effective_date
            FROM silver.customer c
            LEFT JOIN silver.person p ON c.person_key = p.person_key
            LEFT JOIN silver.customer_employee ce ON c.customer_employee_key = ce.customer_employee_key
            LEFT JOIN silver.customer_company cc ON ce.company_key = cc.company_key
            LEFT JOIN silver.person_location pl ON p.person_key = pl.person_key AND pl.is_primary = TRUE
            LEFT JOIN silver.location loc ON pl.location_key = loc.location_key
            LEFT JOIN silver.country co ON loc.country_key = co.country_key
            WHERE c.is_valid = TRUE
                AND NOT EXISTS (SELECT 1 FROM gold.dim_customer dc WHERE dc.customer_key = c.customer_key)
            ON CONFLICT (customer_key) DO NOTHING
        """
        
        try:
            # First check how many would be inserted
            self.cursor.execute("""
                SELECT COUNT(DISTINCT c.customer_key)
                FROM silver.customer c
                WHERE c.is_valid = TRUE
                    AND NOT EXISTS (SELECT 1 FROM gold.dim_customer dc WHERE dc.customer_key = c.customer_key)
            """)
            to_insert = self.cursor.fetchone()[0]
            logger.info(f"  Found {to_insert:,} customers to insert into dim_customer")
            
            if to_insert == 0:
                logger.info("  All customers already in dim_customer")
                return 0
            
            # Get count before
            self.cursor.execute("SELECT COUNT(*) FROM gold.dim_customer")
            count_before = self.cursor.fetchone()[0]
            
            self.cursor.execute(query)
            self.connection.commit()
            
            # Get count after
            self.cursor.execute("SELECT COUNT(*) FROM gold.dim_customer")
            count_after = self.cursor.fetchone()[0]
            actual_inserted = count_after - count_before
            
            if actual_inserted == 0:
                logger.warning(f"[WARN] No records inserted into dim_customer despite {to_insert:,} candidates - check JOIN conditions and data quality")
            else:
                logger.info(f"Populated {actual_inserted:,} customer dimension records (total now: {count_after:,})")
            return actual_inserted
        except Exception as e:
            logger.error(f"[ERROR] Error populating customer dimension: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def populate_dim_product(self, force_refresh: bool = False):
        """Populate dim_product from silver.product."""
        if not force_refresh and not self.table_is_empty('gold', 'dim_product'):
            logger.info("[SKIP] gold.dim_product already has data; skipping.")
            return 0
        
        logger.info("Populating product dimension...")
        if force_refresh:
            self.cursor.execute("DELETE FROM gold.dim_product")
        
        query = """
            INSERT INTO gold.dim_product (
                product_key, product_id, product_name, description, category_id,
                category_name, weight_class, weight_class_description,
                warranty_period_months, list_price, minimum_price, price_currency,
                profit_margin, profit_margin_pct, product_status, is_active,
                supplier_id, is_current, effective_date
            )
            SELECT
                product_key,
                product_id,
                product_name,
                description,
                category_id,
                category_name,
                weight_class,
                weight_class_description,
                warranty_period_months,
                list_price,
                minimum_price,
                price_currency,
                profit_margin,
                profit_margin_pct,
                product_status,
                (product_status = 'Active') as is_active,
                supplier_id,
                TRUE as is_current,
                CURRENT_DATE as effective_date
            FROM silver.product
            WHERE is_valid = TRUE
        """
        
        try:
            self.cursor.execute(query)
            count = self.cursor.rowcount
            self.connection.commit()
            logger.info(f"Populated {count:,} product dimension records")
            return count
        except Exception as e:
            logger.error(f"Error populating product dimension: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def populate_dim_employee(self, force_refresh: bool = False):
        """Populate dim_employee from silver.employee."""
        if not force_refresh and not self.table_is_empty('gold', 'dim_employee'):
            logger.info("[SKIP] gold.dim_employee already has data; skipping.")
            return 0
        
        # Check prerequisite tables
        try:
            self.connection.rollback()  # Ensure clean transaction
        except:
            pass
        
        self.cursor.execute("SELECT COUNT(*) FROM silver.employee WHERE is_valid = TRUE")
        employee_count = self.cursor.fetchone()[0]
        logger.info(f"Populating employee dimension... (Found {employee_count:,} valid employees in silver.employee)")
        
        if employee_count == 0:
            logger.warning("[WARN] silver.employee is empty - cannot populate dim_employee")
            logger.warning("  [WARN] Ensure silver.employee is populated first by running Bronze->Silver ETL")
            return 0
        
        if force_refresh:
            self.cursor.execute("DELETE FROM gold.dim_employee")
        
        query = """
            INSERT INTO gold.dim_employee (
                employee_key, employee_id, first_name, last_name, full_name,
                job_title, department, hire_date, start_date, end_date,
                tenure_years, is_active, employment_status, salary,
                commission_percent, manager_employee_id, manager_name,
                country_name, is_current, effective_date
            )
            SELECT
                e.employee_key,
                e.employee_id,
                p.first_name,
                p.last_name,
                p.full_name,
                ej.job_title,
                NULL as department,  -- Not in schema, can be enhanced
                r.hire_date,
                e.start_date,
                e.end_date,
                e.tenure_years,
                e.is_active,
                e.employment_status,
                e.salary,
                e.commission_percent,
                e.manager_employee_key as manager_employee_id,
                mgr_p.full_name as manager_name,
                co.country_name,
                TRUE as is_current,
                e.start_date as effective_date
            FROM silver.employee e
            LEFT JOIN silver.person p ON e.person_key = p.person_key
            LEFT JOIN silver.employment_jobs ej ON e.job_key = ej.job_key
            LEFT JOIN silver.restricted_info r ON p.person_key = r.person_key
            LEFT JOIN silver.employee mgr ON e.manager_employee_key = mgr.employee_key
            LEFT JOIN silver.person mgr_p ON mgr.person_key = mgr_p.person_key
            LEFT JOIN silver.person_location pl ON p.person_key = pl.person_key AND pl.is_primary = TRUE
            LEFT JOIN silver.location loc ON pl.location_key = loc.location_key
            LEFT JOIN silver.country co ON loc.country_key = co.country_key
            WHERE e.is_valid = TRUE
        """
        
        try:
            self.cursor.execute(query)
            count = self.cursor.rowcount
            self.connection.commit()
            if count == 0:
                logger.warning("[WARN] No records inserted into dim_employee - check JOIN conditions and data quality")
            else:
                logger.info(f"Populated {count:,} employee dimension records")
            return count
        except Exception as e:
            logger.error(f"[ERROR] Error populating employee dimension: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def populate_dim_location(self, force_refresh: bool = False):
        """Populate dim_location from silver.location."""
        if not force_refresh and not self.table_is_empty('gold', 'dim_location'):
            logger.info("[SKIP] gold.dim_location already has data; skipping.")
            return 0
        
        logger.info("Populating location dimension...")
        if force_refresh:
            self.cursor.execute("DELETE FROM gold.dim_location")
        
        query = """
            INSERT INTO gold.dim_location (
                location_key, location_id, address_line_1, city, state_province,
                district, postal_code, country_id, country_name, country_code,
                currency_code, location_type, is_current, effective_date
            )
            SELECT
                l.location_key,
                l.location_id,
                l.address_line_1,
                l.city,
                l.state_province,
                l.district,
                l.postal_code,
                c.country_id,
                c.country_name,
                c.country_code,
                c.currency_code,
                l.location_type,
                TRUE as is_current,
                CURRENT_DATE as effective_date
            FROM silver.location l
            LEFT JOIN silver.country c ON l.country_key = c.country_key
            WHERE l.is_valid = TRUE
        """
        
        try:
            self.cursor.execute(query)
            count = self.cursor.rowcount
            self.connection.commit()
            logger.info(f"Populated {count:,} location dimension records")
            return count
        except Exception as e:
            logger.error(f"Error populating location dimension: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def populate_dim_warehouse(self, force_refresh: bool = False):
        """Populate dim_warehouse from silver.warehouse."""
        if not force_refresh and not self.table_is_empty('gold', 'dim_warehouse'):
            logger.info("[SKIP] gold.dim_warehouse already has data; skipping.")
            return 0
        
        logger.info("Populating warehouse dimension...")
        if force_refresh:
            self.cursor.execute("DELETE FROM gold.dim_warehouse")
        
        query = """
            INSERT INTO gold.dim_warehouse (
                warehouse_key, warehouse_id, warehouse_name, location_key,
                city, state_province, country_name, is_current, effective_date
            )
            SELECT
                w.warehouse_key,
                w.warehouse_id,
                w.warehouse_name,
                w.location_key,
                l.city,
                l.state_province,
                c.country_name,
                TRUE as is_current,
                CURRENT_DATE as effective_date
            FROM silver.warehouse w
            LEFT JOIN silver.location l ON w.location_key = l.location_key
            LEFT JOIN silver.country c ON l.country_key = c.country_key
            WHERE w.is_valid = TRUE
        """
        
        try:
            self.cursor.execute(query)
            count = self.cursor.rowcount
            self.connection.commit()
            logger.info(f"Populated {count:,} warehouse dimension records")
            return count
        except Exception as e:
            logger.error(f"Error populating warehouse dimension: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def populate_dim_promotion(self, force_refresh: bool = False):
        """Populate dim_promotion from unique promotion codes in orders."""
        if not force_refresh and not self.table_is_empty('gold', 'dim_promotion'):
            logger.info("[SKIP] gold.dim_promotion already has data; skipping.")
            return 0
        
        # Check prerequisite tables
        try:
            self.connection.rollback()  # Ensure clean transaction
        except:
            pass
        
        self.cursor.execute("SELECT COUNT(*) FROM silver.orders WHERE promotion_code IS NOT NULL AND promotion_code <> ''")
        promo_count = self.cursor.fetchone()[0]
        logger.info(f"Populating promotion dimension... (Found {promo_count:,} orders with promotion codes in silver.orders)")
        
        if promo_count == 0:
            logger.warning("[WARN] No orders with promotion codes found - dim_promotion will be empty")
            logger.warning("  [WARN] This is OK if no promotions exist in the data")
            # Still proceed to insert - will just insert 0 records
        
        if force_refresh:
            self.cursor.execute("DELETE FROM gold.dim_promotion")
        
        query = """
            INSERT INTO gold.dim_promotion (
                promotion_code, promotion_name, promotion_type,
                is_active
            )
            SELECT DISTINCT
                promotion_code,
                promotion_code as promotion_name,
                'DISCOUNT' as promotion_type,
                TRUE as is_active
            FROM silver.orders
            WHERE promotion_code IS NOT NULL
                AND promotion_code <> ''
            ON CONFLICT (promotion_code) DO NOTHING
        """
        
        try:
            self.cursor.execute(query)
            count = self.cursor.rowcount
            self.connection.commit()
            if count == 0:
                logger.warning("[WARN] No records inserted into dim_promotion - no promotion codes found in orders")
            else:
                logger.info(f"Populated {count:,} promotion dimension records")
            return count
        except Exception as e:
            logger.error(f"[ERROR] Error populating promotion dimension: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def populate_fact_sales(self, force_refresh: bool = False):
        """Populate fact_sales from silver orders and order_items.

        Always full-refresh from Silver when data exists (no one-time skip).
        Previously, non-empty fact_sales caused every later ETL run to skip this
        step, so dashboards showed stale daily_sales (e.g. last date frozen).
        """
        # Check prerequisite tables
        try:
            self.connection.rollback()  # Ensure clean transaction
        except:
            pass
        
        self.cursor.execute("SELECT COUNT(*) FROM silver.orders WHERE is_valid = TRUE")
        orders_count = self.cursor.fetchone()[0]
        self.cursor.execute("SELECT COUNT(*) FROM silver.order_item WHERE is_valid = TRUE")
        items_count = self.cursor.fetchone()[0]
        logger.info(f"Populating sales fact table... (Found {orders_count:,} orders, {items_count:,} order items in Silver)")
        
        if orders_count == 0 or items_count == 0:
            logger.warning("[WARN] silver.orders or silver.order_item is empty - cannot populate fact_sales")
            logger.warning("  [WARN] Ensure silver.orders and silver.order_item are populated first")
            return 0
        
        self._ensure_dim_date_for_order_dates()
        
        # Replace gold rows each run so order_date_key matches current silver.orders
        logger.info(
            "Replacing gold.fact_sales (DELETE + INSERT join orders/order_item; "
            "may take several minutes for millions of rows)..."
        )
        self.cursor.execute("DELETE FROM gold.fact_sales")
        
        query = """
            INSERT INTO gold.fact_sales (
                order_date_key, customer_key, product_key, employee_key,
                location_key, promotion_key, order_id, order_item_id,
                order_code, quantity, unit_price, discount_amount,
                gross_amount, net_amount, order_status, order_status_category
            )
            SELECT
                CAST(TO_CHAR(o.order_date, 'YYYYMMDD') AS INT) as order_date_key,
                o.customer_key,
                oi.product_key,
                o.sales_rep_key as employee_key,
                NULL as location_key,  -- Can be enhanced with shipping location
                (SELECT promotion_key FROM gold.dim_promotion 
                 WHERE promotion_code = o.promotion_code 
                 AND o.promotion_code IS NOT NULL 
                 AND o.promotion_code <> '' 
                 LIMIT 1) as promotion_key,
                o.order_id,
                oi.order_item_id,
                o.order_code,
                oi.quantity,
                oi.unit_price,
                COALESCE(oi.discount_amount, 0) as discount_amount,
                oi.line_total as gross_amount,
                oi.net_amount,
                o.order_status,
                o.order_status_category
            FROM silver.orders o
            INNER JOIN silver.order_item oi ON o.order_key = oi.order_key
            WHERE o.is_valid = TRUE
                AND oi.is_valid = TRUE
                AND o.order_date IS NOT NULL
        """
        
        try:
            t_ins = time.time()
            self.cursor.execute(query)
            ins_elapsed = time.time() - t_ins
            count = self.cursor.rowcount
            self.connection.commit()
            if count == 0:
                logger.warning("[WARN] No records inserted into fact_sales - check JOIN conditions and data quality")
            else:
                logger.info(
                    "Populated %s sales fact records (INSERT took %.1fs)",
                    f"{count:,}",
                    ins_elapsed,
                )
            return count
        except Exception as e:
            logger.error(f"[ERROR] Error populating sales fact: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def populate_fact_orders(self, force_refresh: bool = False):
        """Populate fact_orders from silver orders.

        Always full-refresh from Silver when data exists (same rationale as fact_sales).
        """
        # Check prerequisite tables
        try:
            self.connection.rollback()  # Ensure clean transaction
        except:
            pass
        
        self.cursor.execute("SELECT COUNT(*) FROM silver.orders WHERE is_valid = TRUE")
        orders_count = self.cursor.fetchone()[0]
        self.cursor.execute("SELECT COUNT(*) FROM silver.order_item WHERE is_valid = TRUE")
        items_count = self.cursor.fetchone()[0]
        logger.info(f"Populating orders fact table... (Found {orders_count:,} orders, {items_count:,} order items in Silver)")
        
        if orders_count == 0 or items_count == 0:
            logger.warning("[WARN] silver.orders or silver.order_item is empty - cannot populate fact_orders")
            logger.warning("  [WARN] Ensure silver.orders and silver.order_item are populated first")
            return 0
        
        self._ensure_dim_date_for_order_dates()
        
        logger.info(
            "Replacing gold.fact_orders (DELETE + grouped INSERT; "
            "may take several minutes for millions of rows)..."
        )
        self.cursor.execute("DELETE FROM gold.fact_orders")
        
        query = """
            INSERT INTO gold.fact_orders (
                order_date_key, customer_key, employee_key, promotion_key,
                order_id, order_code, total_quantity, total_items,
                distinct_products, gross_amount, discount_amount, net_amount,
                order_status, order_status_category, order_currency, has_promotion
            )
            SELECT
                CAST(TO_CHAR(o.order_date, 'YYYYMMDD') AS INT) as order_date_key,
                o.customer_key,
                o.sales_rep_key as employee_key,
                (SELECT promotion_key FROM gold.dim_promotion 
                 WHERE promotion_code = o.promotion_code 
                 AND o.promotion_code IS NOT NULL 
                 AND o.promotion_code <> '' 
                 LIMIT 1) as promotion_key,
                o.order_id,
                o.order_code,
                COALESCE(SUM(oi.quantity), 0) as total_quantity,
                COUNT(oi.order_item_id) as total_items,
                COUNT(DISTINCT oi.product_key) as distinct_products,
                COALESCE(SUM(oi.line_total), 0) as gross_amount,
                COALESCE(SUM(oi.discount_amount), 0) as discount_amount,
                COALESCE(SUM(oi.net_amount), 0) as net_amount,
                o.order_status,
                o.order_status_category,
                o.order_currency,
                (o.promotion_code IS NOT NULL AND o.promotion_code <> '') as has_promotion
            FROM silver.orders o
            INNER JOIN gold.dim_customer dc ON o.customer_key = dc.customer_key
            LEFT JOIN silver.order_item oi ON o.order_key = oi.order_key AND oi.is_valid = TRUE
            WHERE o.is_valid = TRUE
                AND o.order_date IS NOT NULL
            GROUP BY o.order_id, o.order_date, o.customer_key, o.sales_rep_key,
                     o.promotion_code, o.order_code, o.order_status,
                     o.order_status_category, o.order_currency
        """
        
        try:
            t_ins = time.time()
            self.cursor.execute(query)
            ins_elapsed = time.time() - t_ins
            count = self.cursor.rowcount
            self.connection.commit()
            if count == 0:
                logger.warning("[WARN] No records inserted into fact_orders - check JOIN conditions and data quality")
            else:
                logger.info(
                    "Populated %s orders fact records (INSERT took %.1fs)",
                    f"{count:,}",
                    ins_elapsed,
                )
            return count
        except Exception as e:
            logger.error(f"[ERROR] Error populating orders fact: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def populate_fact_inventory_snapshot(self, snapshot_date: date = None, force_refresh: bool = False):
        """Populate fact_inventory_snapshot from silver.inventory."""
        # Check if table is empty - if not empty and not force_refresh, skip
        if not force_refresh and not self.table_is_empty('gold', 'fact_inventory_snapshot'):
            logger.info("[SKIP] gold.fact_inventory_snapshot already has data; skipping.")
            return 0
        
        if snapshot_date is None:
            snapshot_date = date.today()
        
        date_key = int(snapshot_date.strftime('%Y%m%d'))
        
        logger.info(f"Populating inventory snapshot fact for {snapshot_date}...")
        
        # Ensure date dimension exists (populate_dim_date skips when table not empty, so insert single date if missing)
        self.cursor.execute("SELECT 1 FROM gold.dim_date WHERE date_key = %s", (date_key,))
        if not self.cursor.fetchone():
            self.populate_dim_date(snapshot_date, snapshot_date)
            # If dim_date had other rows, populate_dim_date may have skipped; ensure this date exists
            self.cursor.execute("SELECT 1 FROM gold.dim_date WHERE date_key = %s", (date_key,))
            if not self.cursor.fetchone():
                day_names = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
                month_names = ['January', 'February', 'March', 'April', 'May', 'June',
                              'July', 'August', 'September', 'October', 'November', 'December']
                month_short = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                              'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
                d = snapshot_date
                day_of_week = d.weekday() + 1
                quarter = (d.month - 1) // 3 + 1
                self.cursor.execute("""
                    INSERT INTO gold.dim_date (
                        date_key, full_date, day_of_week, day_name, day_of_month, day_of_year,
                        week_of_year, month_number, month_name, month_short_name,
                        quarter_number, quarter_name, year_number, is_weekend
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (date_key) DO NOTHING
                """, (
                    date_key, d, day_of_week, day_names[d.weekday()],
                    d.day, d.timetuple().tm_yday,
                    d.isocalendar()[1], d.month,
                    month_names[d.month - 1], month_short[d.month - 1],
                    quarter, f"Q{quarter}", d.year, d.weekday() >= 5
                ))
                self.connection.commit()
        
        # If force_refresh, delete existing snapshot for this date
        if force_refresh:
            self.cursor.execute(
                "DELETE FROM gold.fact_inventory_snapshot WHERE snapshot_date_key = %s",
                (date_key,)
            )
        
        query = """
            INSERT INTO gold.fact_inventory_snapshot (
                snapshot_date_key, product_key, warehouse_key,
                quantity_on_hand, quantity_available, quantity_reserved,
                stock_status
            )
            SELECT
                %s as snapshot_date_key,
                i.product_key,
                i.warehouse_key,
                i.quantity_on_hand,
                i.quantity_available,
                i.quantity_reserved,
                CASE
                    WHEN i.quantity_available <= 0 THEN 'OUT_OF_STOCK'
                    WHEN i.quantity_available < 10 THEN 'LOW_STOCK'
                    ELSE 'IN_STOCK'
                END as stock_status
            FROM silver.inventory i
            WHERE i.is_valid = TRUE
        """
        
        try:
            self.cursor.execute(query, (date_key,))
            count = self.cursor.rowcount
            self.connection.commit()
            logger.info(f"Populated {count:,} inventory snapshot records for {snapshot_date}")
            return count
        except Exception as e:
            logger.error(f"Error populating inventory snapshot: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def aggregate_sales_rep_performance(self, force_refresh: bool = False):
        """Aggregate sales rep performance into gold.agg_sales_rep_performance."""
        if not force_refresh and not self.table_is_empty('gold', 'agg_sales_rep_performance'):
            logger.info("[SKIP] gold.agg_sales_rep_performance already has data; skipping.")
            return 0
        
        # Check prerequisite tables
        try:
            self.connection.rollback()  # Ensure clean transaction
        except:
            pass
        
        self.cursor.execute("SELECT COUNT(*) FROM silver.orders WHERE is_valid = TRUE AND sales_rep_key IS NOT NULL")
        orders_count = self.cursor.fetchone()[0]
        self.cursor.execute("SELECT COUNT(*) FROM silver.order_item WHERE is_valid = TRUE")
        items_count = self.cursor.fetchone()[0]
        logger.info(f"Aggregating sales rep performance... (Found {orders_count:,} orders with sales reps, {items_count:,} order items in Silver)")
        
        if orders_count == 0 or items_count == 0:
            logger.warning("[WARN] silver.orders or silver.order_item is empty - cannot aggregate sales rep performance")
            logger.warning("  [WARN] Ensure silver.orders and silver.order_item are populated first")
            return 0
        
        if force_refresh:
            self.cursor.execute("DELETE FROM gold.agg_sales_rep_performance")
        
        query = """
            INSERT INTO gold.agg_sales_rep_performance (
                employee_key, year_number, month_number,
                total_orders, total_customers_served, new_customers_acquired,
                gross_sales, net_sales, total_commission, sales_rank
            )
            WITH monthly_sales AS (
                SELECT
                    o.sales_rep_key as employee_key,
                    EXTRACT(YEAR FROM o.order_date)::INT as year_number,
                    EXTRACT(MONTH FROM o.order_date)::INT as month_number,
                    COUNT(DISTINCT o.order_id) as total_orders,
                    COUNT(DISTINCT o.customer_key) as total_customers_served,
                    COUNT(DISTINCT CASE 
                        WHEN o.order_date = (SELECT MIN(o2.order_date) 
                                            FROM silver.orders o2 
                                            WHERE o2.customer_key = o.customer_key)
                        THEN o.customer_key 
                    END) as new_customers_acquired,
                    COALESCE(SUM(oi.line_total), 0) as gross_sales,
                    COALESCE(SUM(oi.net_amount), 0) as net_sales,
                    COALESCE(SUM(oi.net_amount * e.commission_percent / 100.0), 0) as total_commission
                FROM silver.orders o
                LEFT JOIN silver.order_item oi ON o.order_key = oi.order_key
                LEFT JOIN silver.employee e ON o.sales_rep_key = e.employee_key
                WHERE o.is_valid = TRUE
                    AND o.sales_rep_key IS NOT NULL
                    AND o.order_date IS NOT NULL
                GROUP BY o.sales_rep_key, EXTRACT(YEAR FROM o.order_date), EXTRACT(MONTH FROM o.order_date)
            )
            SELECT
                ms.employee_key,
                ms.year_number,
                ms.month_number,
                ms.total_orders,
                ms.total_customers_served,
                ms.new_customers_acquired,
                ms.gross_sales,
                ms.net_sales,
                ms.total_commission,
                ROW_NUMBER() OVER (
                    PARTITION BY ms.year_number, ms.month_number
                    ORDER BY ms.net_sales DESC
                ) as sales_rank
            FROM monthly_sales ms
        """
        
        try:
            self.cursor.execute(query)
            count = self.cursor.rowcount
            self.connection.commit()
            if count == 0:
                logger.warning("[WARN] No records inserted into agg_sales_rep_performance - check data quality")
            else:
                logger.info(f"Populated {count:,} sales rep performance records")
            return count
        except Exception as e:
            logger.error(f"[ERROR] Error aggregating sales rep performance: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def aggregate_all(self):
        """Aggregate all Gold layer tables (only empty ones)."""
        logger.info("=" * 80)
        logger.info("SILVER TO GOLD AGGREGATION - STARTING")
        logger.info("=" * 80)
        logger.info(f"Start Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        logger.info("")
        
        totals = {}
        aggregation_start = time.time()
        
        # Step 1: Populate Date Dimension (must be first)
        logger.info("-" * 80)
        logger.info("STEP 1/11: Populating Date Dimension")
        logger.info("-" * 80)
        logger.info("Creating date dimension for all dates in data range...")
        logger.info("")
        
        date_start = time.time()
        date_count = self.populate_dim_date()
        date_elapsed = time.time() - date_start
        totals['dim_date'] = date_count
        logger.info(f"[OK] Date Dimension Complete: {date_count:,} records in {date_elapsed:.2f}s")
        logger.info("")
        
        # Step 2: Populate Dimension Tables
        logger.info("-" * 80)
        logger.info("STEP 2/11: Populating Customer Dimension")
        logger.info("-" * 80)
        dim_customer_start = time.time()
        dim_customer_count = self.populate_dim_customer()
        dim_customer_elapsed = time.time() - dim_customer_start
        totals['dim_customer'] = dim_customer_count
        logger.info(f"[OK] Customer Dimension Complete: {dim_customer_count:,} records in {dim_customer_elapsed:.2f}s")
        logger.info("")
        
        logger.info("-" * 80)
        logger.info("STEP 3/11: Populating Product Dimension")
        logger.info("-" * 80)
        dim_product_start = time.time()
        dim_product_count = self.populate_dim_product()
        dim_product_elapsed = time.time() - dim_product_start
        totals['dim_product'] = dim_product_count
        logger.info(f"[OK] Product Dimension Complete: {dim_product_count:,} records in {dim_product_elapsed:.2f}s")
        logger.info("")
        
        logger.info("-" * 80)
        logger.info("STEP 4/11: Populating Employee Dimension")
        logger.info("-" * 80)
        dim_employee_start = time.time()
        dim_employee_count = self.populate_dim_employee()
        dim_employee_elapsed = time.time() - dim_employee_start
        totals['dim_employee'] = dim_employee_count
        logger.info(f"[OK] Employee Dimension Complete: {dim_employee_count:,} records in {dim_employee_elapsed:.2f}s")
        logger.info("")
        
        logger.info("-" * 80)
        logger.info("STEP 5/11: Populating Location Dimension")
        logger.info("-" * 80)
        dim_location_start = time.time()
        dim_location_count = self.populate_dim_location()
        dim_location_elapsed = time.time() - dim_location_start
        totals['dim_location'] = dim_location_count
        logger.info(f"[OK] Location Dimension Complete: {dim_location_count:,} records in {dim_location_elapsed:.2f}s")
        logger.info("")
        
        logger.info("-" * 80)
        logger.info("STEP 6/11: Populating Warehouse Dimension")
        logger.info("-" * 80)
        dim_warehouse_start = time.time()
        dim_warehouse_count = self.populate_dim_warehouse()
        dim_warehouse_elapsed = time.time() - dim_warehouse_start
        totals['dim_warehouse'] = dim_warehouse_count
        logger.info(f"[OK] Warehouse Dimension Complete: {dim_warehouse_count:,} records in {dim_warehouse_elapsed:.2f}s")
        logger.info("")
        
        logger.info("-" * 80)
        logger.info("STEP 7/11: Populating Promotion Dimension")
        logger.info("-" * 80)
        dim_promotion_start = time.time()
        dim_promotion_count = self.populate_dim_promotion()
        dim_promotion_elapsed = time.time() - dim_promotion_start
        totals['dim_promotion'] = dim_promotion_count
        logger.info(f"[OK] Promotion Dimension Complete: {dim_promotion_count:,} records in {dim_promotion_elapsed:.2f}s")
        logger.info("")
        
        # Step 3: Populate Fact Tables
        logger.info("-" * 80)
        logger.info("STEP 8/11: Populating Sales Fact Table")
        logger.info("-" * 80)
        fact_sales_start = time.time()
        fact_sales_count = self.populate_fact_sales()
        fact_sales_elapsed = time.time() - fact_sales_start
        totals['fact_sales'] = fact_sales_count
        logger.info(f"[OK] Sales Fact Complete: {fact_sales_count:,} records in {fact_sales_elapsed:.2f}s")
        logger.info("")
        
        logger.info("-" * 80)
        logger.info("STEP 9/11: Populating Orders Fact Table")
        logger.info("-" * 80)
        fact_orders_start = time.time()
        fact_orders_count = self.populate_fact_orders()
        fact_orders_elapsed = time.time() - fact_orders_start
        totals['fact_orders'] = fact_orders_count
        logger.info(f"[OK] Orders Fact Complete: {fact_orders_count:,} records in {fact_orders_elapsed:.2f}s")
        logger.info("")
        
        logger.info("-" * 80)
        logger.info("STEP 10/11: Populating Inventory Snapshot Fact Table")
        logger.info("-" * 80)
        fact_inv_start = time.time()
        fact_inv_count = self.populate_fact_inventory_snapshot()
        fact_inv_elapsed = time.time() - fact_inv_start
        totals['fact_inventory_snapshot'] = fact_inv_count
        logger.info(f"[OK] Inventory Snapshot Fact Complete: {fact_inv_count:,} records in {fact_inv_elapsed:.2f}s")
        logger.info("")
        
        # Step 4: Aggregate daily sales for all dates in data range
        logger.info("-" * 80)
        logger.info("STEP 11/11: Aggregating Daily Sales Summaries")
        logger.info("-" * 80)
        logger.info("Processing all dates in data range...")
        logger.info("")
        
        # Job tracking: only "Complete ETL Pipeline" is tracked at run_etl.py level.
        # Do not create extra jobs in monitoring.etl_jobs (only two jobs allowed).
        daily_job_id = None

        daily_start = time.time()
        daily_skipped = 0
        daily_processed = 0
        
        # Check which dates need processing
        # Ensure transaction is clean first
        try:
            self.connection.rollback()
        except:
            pass
        
        # Get date range from Silver orders
        logger.info("Determining date range from Silver orders...")
        try:
            self.cursor.execute("""
                SELECT MIN(order_date) as min_date, MAX(order_date) as max_date
                FROM silver.orders
                WHERE order_date IS NOT NULL
            """)
            result = self.cursor.fetchone()
            if result and result[0] and result[1]:
                start_date = result[0]
                end_date = result[1]
                logger.info(f"Date range: {start_date} to {end_date}")
            else:
                # Default to last 30 days if no orders
                end_date = date.today()
                start_date = date.today() - timedelta(days=30)
                logger.warning("No orders found in Silver layer, defaulting to last 30 days")
        except Exception as e:
            logger.warning(f"Could not determine date range from orders: {e}")
            end_date = date.today()
            start_date = date.today() - timedelta(days=30)
        
        logger.info("Checking which dates need processing...")
        dates_to_process = []
        current_date = start_date
        total_days = (end_date - start_date).days + 1
        
        while current_date <= end_date:
            date_key = int(current_date.strftime('%Y%m%d'))
            try:
                self.cursor.execute(
                    "SELECT 1 FROM gold.agg_daily_sales WHERE date_key = %s",
                    (date_key,)
                )
                if not self.cursor.fetchone():
                    dates_to_process.append(current_date)
            except Exception as e:
                logger.warning(f"Error checking date {current_date}: {e}")
                # Rollback and continue
                try:
                    self.connection.rollback()
                except:
                    pass
                # Assume date needs processing if check fails
                dates_to_process.append(current_date)
            
            current_date += timedelta(days=1)
        
        total_dates = len(dates_to_process)
        total_checked = total_days
        logger.info(f"Found {total_dates} dates that need processing (out of {total_checked} days in range)")
        
        if total_dates == 0:
            logger.info("  All dates already have data; skipping daily sales aggregation.")
        else:
            for i, target_date in enumerate(dates_to_process, 1):
                result = self.aggregate_daily_sales(target_date, force_refresh=False)
                if result > 0:
                    daily_processed += 1
                else:
                    daily_skipped += 1
                
                if i % 50 == 0 or i == total_dates:
                    logger.info(f"  Processed {i}/{total_dates} dates (processed: {daily_processed}, skipped: {daily_skipped})...")
                
                # Update progress
                if self.tracker and daily_job_id and total_dates > 0:
                    progress = int((i / total_dates) * 100)
                    self.tracker.update_progress(daily_job_id, progress, i)
        
        daily_skipped += (total_checked - total_dates)  # Add dates that were already in DB
        
        daily_elapsed = time.time() - daily_start
        totals['daily_sales'] = daily_processed
        
        logger.info("")
        logger.info(f"[OK] Daily Sales Aggregation Complete")
        logger.info(f"  Days processed: {daily_processed}")
        logger.info(f"  Days skipped (already exist): {daily_skipped}")
        logger.info(f"  Total dates checked: {total_checked}")
        logger.info(f"  Time taken: {daily_elapsed:.2f}s")
        logger.info("")
        
        # Aggregate customer lifetime
        logger.info("-" * 80)
        logger.info("Aggregating Customer Lifetime Value")
        logger.info("-" * 80)
        customer_start = time.time()
        customer_count = self.aggregate_customer_lifetime()
        customer_elapsed = time.time() - customer_start
        totals['agg_customer_lifetime'] = customer_count
        logger.info(f"[OK] Customer Lifetime Complete: {customer_count:,} records in {customer_elapsed:.2f}s")
        logger.info("")
        
        # Aggregate monthly product sales
        logger.info("-" * 80)
        logger.info("Aggregating Monthly Product Sales")
        logger.info("-" * 80)
        product_start = time.time()
        product_count = self.aggregate_monthly_product_sales()
        product_elapsed = time.time() - product_start
        totals['agg_monthly_product_sales'] = product_count
        logger.info(f"[OK] Monthly Product Sales Complete: {product_count:,} records in {product_elapsed:.2f}s")
        logger.info("")
        
        # Aggregate sales rep performance
        logger.info("-" * 80)
        logger.info("Aggregating Sales Rep Performance")
        logger.info("-" * 80)
        sales_rep_start = time.time()
        sales_rep_count = self.aggregate_sales_rep_performance()
        sales_rep_elapsed = time.time() - sales_rep_start
        totals['agg_sales_rep_performance'] = sales_rep_count
        logger.info(f"[OK] Sales Rep Performance Complete: {sales_rep_count:,} records in {sales_rep_elapsed:.2f}s")
        logger.info("")
        
        total_elapsed = time.time() - aggregation_start
        
        logger.info("=" * 80)
        logger.info("SILVER TO GOLD AGGREGATION COMPLETE!")
        logger.info("=" * 80)
        logger.info("Final Summary:")
        for key, value in sorted(totals.items()):
            logger.info(f"  {key.replace('_', ' ').title():30s}: {value:>15,} records")
        logger.info(f"Total Time: {total_elapsed:.2f}s ({total_elapsed/60:.2f} min)")
        logger.info("=" * 80)
        
        return totals
