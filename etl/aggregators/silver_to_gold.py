"""
Silver to Gold Layer Aggregator
Aggregates Silver layer data into Gold layer analytics tables.

Incremental ETL:
- Dimensions (dim_product, dim_location, dim_warehouse, dim_employee): insert rows for keys
  that exist in silver but not yet in gold (NOT EXISTS), so append-only bronze/silver loads extend gold.
- dim_customer / dim_promotion: already merge via NOT EXISTS or ON CONFLICT.
- fact_sales / fact_orders: full DELETE + INSERT from silver each run (current truth).
- fact_inventory_snapshot: DELETE for the snapshot date_key, then INSERT (refresh that day).
- agg_customer_lifetime, agg_monthly_product_sales, agg_sales_rep_performance: DELETE all then
  rebuild from silver each run so summaries match new orders/customers.
- agg_daily_sales: per-date inserts; missing dates are filled in aggregate_all().
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
                        quarter_number, quarter_name, year_number, is_weekend,
                        is_holiday, holiday_name, fiscal_year, fiscal_quarter, fiscal_month
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (date_key) DO NOTHING
                """, (
                    date_key, order_date, day_of_week, day_names[order_date.weekday()],
                    order_date.day, order_date.timetuple().tm_yday,
                    order_date.isocalendar()[1], order_date.month,
                    month_names[order_date.month - 1], month_short[order_date.month - 1],
                    quarter, f"Q{quarter}", order_date.year, order_date.weekday() >= 5,
                    False, '', order_date.year, quarter, order_date.month,
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
            
            qn = (target_date.month - 1) // 3 + 1
            self.cursor.execute("""
                INSERT INTO gold.dim_date (
                    date_key, full_date, day_of_week, day_name, day_of_month, day_of_year,
                    week_of_year, month_number, month_name, month_short_name,
                    quarter_number, quarter_name, year_number, is_weekend,
                    is_holiday, holiday_name, fiscal_year, fiscal_quarter, fiscal_month
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (date_key) DO NOTHING
            """, (
                date_key, target_date, day_of_week, day_names[target_date.weekday()],
                target_date.day, target_date.timetuple().tm_yday,
                target_date.isocalendar()[1], target_date.month,
                month_names[target_date.month - 1], month_short[target_date.month - 1],
                qn, f"Q{qn}",
                target_date.year, target_date.weekday() >= 5,
                False, '', target_date.year, qn, target_date.month,
            ))
            self.connection.commit()
        
        # Only delete when explicit refresh is requested.
        if force_refresh:
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
            LEFT JOIN silver.order_item oi ON o.order_key = oi.order_key AND oi.is_valid = TRUE
            WHERE o.order_date = %s
                AND o.is_valid = TRUE
            ON CONFLICT (date_key) DO NOTHING
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
        """Aggregate customer lifetime value into gold.agg_customer_lifetime.

        Always rebuilds from silver (DELETE + INSERT) so new customers/orders after
        incremental Bronze→Silver are reflected. force_refresh kept for API compatibility.
        """
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
            WHERE NOT EXISTS (
                SELECT 1
                FROM gold.agg_customer_lifetime g
                WHERE g.customer_key = rfm.customer_key
            )
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
        """Aggregate monthly product sales into gold.agg_monthly_product_sales.

        Rebuilt each pipeline run from silver so incremental loads update category/month metrics.
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
        logger.info(f"Aggregating monthly product sales... (Found {orders_count:,} orders, {items_count:,} order items in Silver)")
        
        if orders_count == 0 or items_count == 0:
            logger.warning("[WARN] silver.orders or silver.order_item is empty - cannot aggregate monthly product sales")
            logger.warning("  [WARN] Ensure silver.orders and silver.order_item are populated first")
            return 0
        
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
            ON CONFLICT (year_number, month_number, category_name) DO NOTHING
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
                        quarter_number, quarter_name, year_number, is_weekend,
                        is_holiday, holiday_name, fiscal_year, fiscal_quarter, fiscal_month
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (date_key) DO NOTHING
                """, (
                    date_key, current_date, day_of_week, day_names[current_date.weekday()],
                    current_date.day, current_date.timetuple().tm_yday,
                    current_date.isocalendar()[1], current_date.month,
                    month_names[current_date.month - 1], month_short[current_date.month - 1],
                    quarter, f"Q{quarter}", current_date.year, current_date.weekday() >= 5,
                    False, '', current_date.year, quarter, current_date.month,
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
        """Populate dim_customer from silver.customer (incremental: new customer_key only)."""
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
                income_bracket, account_manager_id, account_manager_name,
                city, state_province,
                country_name, postal_code, customer_segment, lifetime_value_tier,
                is_current, effective_date, expiration_date
            )
            SELECT DISTINCT
                c.customer_key,
                c.customer_id,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(p.first_name, '')), ''), 'Unknown') as first_name,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(p.last_name, '')), ''), 'Unknown') as last_name,
                COALESCE(
                    NULLIF(TRIM(BOTH FROM COALESCE(p.full_name, '')), ''),
                    TRIM(BOTH FROM CONCAT(
                        COALESCE(p.first_name, 'Unknown'), ' ', COALESCE(p.last_name, 'Unknown')
                    ))
                ) as full_name,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(p.gender, '')), ''), 'U') as gender,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(cc.company_name, '')), ''), 'Individual') as company_name,
                COALESCE(cc.credit_limit, 0) as company_credit_limit,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(c.customer_type, '')), ''), 'RETAIL') as customer_type,
                COALESCE(c.income_level, 0) as income_level,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(c.income_bracket, '')), ''), 'UNKNOWN') as income_bracket,
                COALESCE(c.account_manager_id, 0) as account_manager_id,
                CASE
                    WHEN c.account_manager_id IS NULL OR c.account_manager_id = 0 THEN 'Unassigned'
                    ELSE CONCAT('Manager ', c.account_manager_id::TEXT)
                END as account_manager_name,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(loc.city, '')), ''), '—') as city,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(loc.state_province, '')), ''), '—') as state_province,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(co.country_name, '')), ''), '—') as country_name,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(loc.postal_code, '')), ''), '00000') as postal_code,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(c.income_bracket, '')), ''), 'STANDARD') as customer_segment,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(c.income_bracket, '')), ''), 'STANDARD') as lifetime_value_tier,
                TRUE as is_current,
                COALESCE(c.customer_since, CURRENT_DATE) as effective_date,
                DATE '9999-12-31' as expiration_date
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
        """Populate dim_product from silver.product (incremental: new product_key only)."""
        logger.info("Populating product dimension...")
        if force_refresh:
            self.cursor.execute("DELETE FROM gold.dim_product")
        
        query = """
            INSERT INTO gold.dim_product (
                product_key, product_id, product_name, description, category_id,
                category_name, weight_class, weight_class_description,
                warranty_period_months, list_price, minimum_price, price_currency,
                profit_margin, profit_margin_pct, product_status, is_active,
                supplier_id, is_current, effective_date, expiration_date
            )
            SELECT
                p.product_key,
                p.product_id,
                COALESCE(NULLIF(TRIM(BOTH FROM p.product_name), ''), CONCAT('Product ', p.product_id::TEXT)),
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(p.description, '')), ''), 'No description') as description,
                COALESCE(p.category_id, 0) as category_id,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(p.category_name, '')), ''), 'General') as category_name,
                COALESCE(p.weight_class, 0) as weight_class,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(p.weight_class_description, '')), ''), 'Standard') as weight_class_description,
                COALESCE(p.warranty_period_months, 0) as warranty_period_months,
                COALESCE(p.list_price, 0) as list_price,
                COALESCE(p.minimum_price, 0) as minimum_price,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(p.price_currency, '')), ''), 'USD') as price_currency,
                COALESCE(p.profit_margin, 0) as profit_margin,
                COALESCE(p.profit_margin_pct, 0) as profit_margin_pct,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(p.product_status, '')), ''), 'Active') as product_status,
                (LOWER(TRIM(BOTH FROM COALESCE(p.product_status, 'Active'))) = 'active') as is_active,
                COALESCE(p.supplier_id, 0) as supplier_id,
                TRUE as is_current,
                CURRENT_DATE as effective_date,
                DATE '9999-12-31' as expiration_date
            FROM silver.product p
            WHERE p.is_valid = TRUE
              AND NOT EXISTS (
                  SELECT 1 FROM gold.dim_product d WHERE d.product_key = p.product_key
              )
        """
        
        try:
            self.cursor.execute(query)
            count = self.cursor.rowcount
            self.connection.commit()
            if count == 0:
                logger.info("No new dim_product rows (all product_keys already present).")
            else:
                logger.info(f"Populated {count:,} new product dimension records")
            return count
        except Exception as e:
            logger.error(f"Error populating product dimension: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def populate_dim_employee(self, force_refresh: bool = False):
        """Populate dim_employee from silver.employee (incremental: new employee_key only)."""
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
                country_name, is_current, effective_date, expiration_date
            )
            SELECT
                e.employee_key,
                e.employee_id,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(p.first_name, '')), ''), 'Unknown') as first_name,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(p.last_name, '')), ''), 'Unknown') as last_name,
                COALESCE(
                    NULLIF(TRIM(BOTH FROM COALESCE(p.full_name, '')), ''),
                    TRIM(BOTH FROM CONCAT(
                        COALESCE(p.first_name, 'Unknown'), ' ', COALESCE(p.last_name, 'Unknown')
                    ))
                ) as full_name,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(ej.job_title, '')), ''), 'Staff') as job_title,
                'General' as department,
                COALESCE(r.hire_date, e.start_date, CURRENT_DATE) as hire_date,
                COALESCE(e.start_date, CURRENT_DATE) as start_date,
                COALESCE(e.end_date, DATE '9999-12-31') as end_date,
                COALESCE(e.tenure_years, 0) as tenure_years,
                COALESCE(e.is_active, TRUE) as is_active,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(e.employment_status, '')), ''), 'ACTIVE') as employment_status,
                COALESCE(e.salary, 0) as salary,
                COALESCE(e.commission_percent, 0) as commission_percent,
                e.manager_employee_key as manager_employee_id,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(mgr_p.full_name, '')), ''), 'N/A') as manager_name,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(co.country_name, '')), ''), '—') as country_name,
                TRUE as is_current,
                COALESCE(e.start_date, CURRENT_DATE) as effective_date,
                DATE '9999-12-31' as expiration_date
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
              AND NOT EXISTS (
                  SELECT 1 FROM gold.dim_employee d WHERE d.employee_key = e.employee_key
              )
        """
        
        try:
            self.cursor.execute(query)
            count = self.cursor.rowcount
            self.connection.commit()
            if count == 0:
                logger.info("No new dim_employee rows (all employee_keys already present).")
            else:
                logger.info(f"Populated {count:,} new employee dimension records")
            return count
        except Exception as e:
            logger.error(f"[ERROR] Error populating employee dimension: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def populate_dim_location(self, force_refresh: bool = False):
        """Populate dim_location from silver.location (incremental: new location_key only)."""
        logger.info("Populating location dimension...")
        if force_refresh:
            self.cursor.execute("DELETE FROM gold.dim_location")
        
        query = """
            INSERT INTO gold.dim_location (
                location_key, location_id, address_line_1, city, state_province,
                district, postal_code, country_id, country_name, country_code,
                currency_code, region, sub_region, location_type, is_current, effective_date,
                expiration_date
            )
            SELECT
                l.location_key,
                l.location_id,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(l.address_line_1, '')), ''), '—') as address_line_1,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(l.city, '')), ''), '—') as city,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(l.state_province, '')), ''), '—') as state_province,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(l.district, '')), ''), '—') as district,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(l.postal_code, '')), ''), '00000') as postal_code,
                COALESCE(c.country_id, 0) as country_id,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(c.country_name, '')), ''), 'Unknown') as country_name,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(c.country_code, '')), ''), 'UNK') as country_code,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(c.currency_code, '')), ''), 'USD') as currency_code,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(c.country_name, '')), ''), 'General') as region,
                '—' as sub_region,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(l.location_type, '')), ''), 'OTHER') as location_type,
                TRUE as is_current,
                CURRENT_DATE as effective_date,
                DATE '9999-12-31' as expiration_date
            FROM silver.location l
            LEFT JOIN silver.country c ON l.country_key = c.country_key
            WHERE l.is_valid = TRUE
              AND NOT EXISTS (
                  SELECT 1 FROM gold.dim_location d WHERE d.location_key = l.location_key
              )
        """
        
        try:
            self.cursor.execute(query)
            count = self.cursor.rowcount
            self.connection.commit()
            if count == 0:
                logger.info("No new dim_location rows (all location_keys already present).")
            else:
                logger.info(f"Populated {count:,} new location dimension records")
            return count
        except Exception as e:
            logger.error(f"Error populating location dimension: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def populate_dim_warehouse(self, force_refresh: bool = False):
        """Populate dim_warehouse from silver.warehouse (incremental: new warehouse_key only)."""
        logger.info("Populating warehouse dimension...")
        if force_refresh:
            self.cursor.execute("DELETE FROM gold.dim_warehouse")
        
        query = """
            INSERT INTO gold.dim_warehouse (
                warehouse_key, warehouse_id, warehouse_name, location_key,
                city, state_province, country_name, warehouse_region, is_current, effective_date,
                expiration_date
            )
            SELECT
                w.warehouse_key,
                w.warehouse_id,
                COALESCE(NULLIF(TRIM(BOTH FROM w.warehouse_name), ''), CONCAT('Warehouse ', w.warehouse_id::TEXT)),
                w.location_key,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(l.city, '')), ''), '—') as city,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(l.state_province, '')), ''), '—') as state_province,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(c.country_name, '')), ''), '—') as country_name,
                COALESCE(NULLIF(TRIM(BOTH FROM COALESCE(l.state_province, '')), ''), '—') as warehouse_region,
                TRUE as is_current,
                CURRENT_DATE as effective_date,
                DATE '9999-12-31' as expiration_date
            FROM silver.warehouse w
            LEFT JOIN silver.location l ON w.location_key = l.location_key
            LEFT JOIN silver.country c ON l.country_key = c.country_key
            WHERE w.is_valid = TRUE
              AND NOT EXISTS (
                  SELECT 1 FROM gold.dim_warehouse d WHERE d.warehouse_key = w.warehouse_key
              )
              AND (w.location_key IS NULL OR EXISTS (
                  SELECT 1 FROM gold.dim_location dl WHERE dl.location_key = w.location_key
              ))
        """
        
        try:
            self.cursor.execute(query)
            count = self.cursor.rowcount
            self.connection.commit()
            if count == 0:
                logger.info("No new dim_warehouse rows (all warehouse_keys present or pending dim_location).")
            else:
                logger.info(f"Populated {count:,} new warehouse dimension records")
            return count
        except Exception as e:
            logger.error(f"Error populating warehouse dimension: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def populate_dim_promotion(self, force_refresh: bool = False):
        """Populate dim_promotion from promotion codes in silver.orders (ON CONFLICT merges new codes)."""
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
        
        self.cursor.execute(
            """
            INSERT INTO gold.dim_promotion (
                promotion_code, promotion_name, promotion_type,
                discount_percent, discount_amount, start_date, end_date, is_active
            ) VALUES (
                '', 'No promotion', 'NONE',
                0, 0, DATE '1970-01-01', DATE '9999-12-31', TRUE
            )
            ON CONFLICT (promotion_code) DO NOTHING
            """
        )
        
        query = """
            INSERT INTO gold.dim_promotion (
                promotion_code, promotion_name, promotion_type,
                discount_percent, discount_amount, start_date, end_date, is_active
            )
            SELECT DISTINCT
                o.promotion_code,
                o.promotion_code as promotion_name,
                'DISCOUNT' as promotion_type,
                10.0::DECIMAL(5,2) as discount_percent,
                0::DECIMAL(12,2) as discount_amount,
                (CURRENT_DATE - INTERVAL '365 days')::DATE as start_date,
                (CURRENT_DATE + INTERVAL '365 days')::DATE as end_date,
                TRUE as is_active
            FROM silver.orders o
            WHERE o.promotion_code IS NOT NULL
                AND TRIM(BOTH FROM o.promotion_code) <> ''
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
        
        # Incremental append-only load:
        # - Watermark by max(order_id) already in gold.fact_sales to avoid rescanning from the beginning.
        # - Still keep a NOT EXISTS guard on (order_id, order_item_id) to prevent duplicates.
        logger.info("Incrementally populating gold.fact_sales (insert new rows only; watermark by max order_id)...")

        try:
            self.connection.rollback()
        except Exception:
            pass
        self.cursor.execute("SELECT COALESCE(MAX(order_id), 0) FROM gold.fact_sales;")
        max_order_id = int(self.cursor.fetchone()[0] or 0)
        logger.info("  gold.fact_sales max(order_id) watermark: %s", f"{max_order_id:,}")
        
        query = """
            INSERT INTO gold.fact_sales (
                order_date_key, customer_key, product_key, employee_key,
                location_key, promotion_key, order_id, order_item_id,
                order_code, quantity, unit_price, discount_amount,
                gross_amount, net_amount, cost_amount, profit_amount,
                order_status, order_status_category
            )
            SELECT
                CAST(TO_CHAR(o.order_date, 'YYYYMMDD') AS INT) as order_date_key,
                o.customer_key,
                oi.product_key,
                o.sales_rep_key as employee_key,
                COALESCE(
                    (SELECT pl2.location_key
                     FROM silver.person_location pl2
                     WHERE pl2.person_key = cust.person_key
                     ORDER BY pl2.is_primary DESC NULLS LAST, pl2.person_location_key
                     LIMIT 1),
                    (SELECT MIN(dl.location_key) FROM gold.dim_location dl)
                ) as location_key,
                (SELECT dp.promotion_key
                 FROM gold.dim_promotion dp
                 WHERE dp.promotion_code = COALESCE(NULLIF(TRIM(BOTH FROM o.promotion_code), ''), '')
                 LIMIT 1) as promotion_key,
                o.order_id,
                oi.order_item_id,
                COALESCE(NULLIF(TRIM(BOTH FROM o.order_code), ''), CONCAT('ORD-', o.order_id::TEXT)),
                oi.quantity,
                oi.unit_price,
                COALESCE(oi.discount_amount, 0) as discount_amount,
                oi.line_total as gross_amount,
                oi.net_amount,
                ROUND(COALESCE(oi.line_total, 0) * 0.65, 2) as cost_amount,
                ROUND(COALESCE(oi.net_amount, 0) - COALESCE(oi.line_total, 0) * 0.65, 2) as profit_amount,
                COALESCE(NULLIF(TRIM(BOTH FROM o.order_status), ''), 'UNKNOWN') as order_status,
                COALESCE(NULLIF(TRIM(BOTH FROM o.order_status_category), ''), 'UNKNOWN') as order_status_category
            FROM silver.orders o
            INNER JOIN silver.order_item oi ON o.order_key = oi.order_key
            LEFT JOIN silver.customer cust ON o.customer_key = cust.customer_key
            WHERE o.is_valid = TRUE
                AND oi.is_valid = TRUE
                AND o.order_date IS NOT NULL
                AND o.order_id > %s
                AND NOT EXISTS (
                    SELECT 1
                    FROM gold.fact_sales fs
                    WHERE fs.order_id = o.order_id
                      AND fs.order_item_id = oi.order_item_id
                )
        """

        try:
            t_ins = time.time()
            self.cursor.execute(query, (max_order_id,))
            ins_elapsed = time.time() - t_ins
            inserted = self.cursor.rowcount
            self.connection.commit()
            if inserted == 0:
                logger.info("[OK] No new fact_sales rows to insert (already up to date).")
            else:
                logger.info(
                    "[OK] Inserted %s new fact_sales rows (INSERT took %.1fs)",
                    f"{inserted:,}",
                    ins_elapsed,
                )
            return inserted
        except Exception as e:
            self.connection.rollback()
            logger.error(f"[ERROR] Error incrementally populating fact_sales: {e}", exc_info=True)
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
        
        # Incremental append-only load:
        # - Watermark by max(order_id) already in gold.fact_orders to avoid rescanning from the beginning.
        # - gold.fact_orders has UNIQUE(order_id), so ON CONFLICT DO NOTHING prevents duplicates.
        logger.info("Incrementally populating gold.fact_orders (insert new orders only; watermark by max order_id)...")

        try:
            self.connection.rollback()
        except Exception:
            pass
        self.cursor.execute("SELECT COALESCE(MAX(order_id), 0) FROM gold.fact_orders;")
        max_order_id = int(self.cursor.fetchone()[0] or 0)
        logger.info("  gold.fact_orders max(order_id) watermark: %s", f"{max_order_id:,}")
        
        query = """
            INSERT INTO gold.fact_orders (
                order_date_key, customer_key, employee_key, promotion_key,
                order_id, order_code, total_quantity, total_items,
                distinct_products, gross_amount, discount_amount, net_amount,
                order_status, order_status_category, order_currency, has_promotion,
                created_date
            )
            SELECT
                CAST(TO_CHAR(o.order_date, 'YYYYMMDD') AS INT) as order_date_key,
                o.customer_key,
                o.sales_rep_key as employee_key,
                (SELECT dp.promotion_key
                 FROM gold.dim_promotion dp
                 WHERE dp.promotion_code = COALESCE(NULLIF(TRIM(BOTH FROM o.promotion_code), ''), '')
                 LIMIT 1) as promotion_key,
                o.order_id,
                COALESCE(NULLIF(TRIM(BOTH FROM o.order_code), ''), CONCAT('ORD-', o.order_id::TEXT)),
                COALESCE(SUM(oi.quantity), 0) as total_quantity,
                COUNT(oi.order_item_id)::INT as total_items,
                COUNT(DISTINCT oi.product_key)::INT as distinct_products,
                COALESCE(SUM(oi.line_total), 0) as gross_amount,
                COALESCE(SUM(oi.discount_amount), 0) as discount_amount,
                COALESCE(SUM(oi.net_amount), 0) as net_amount,
                COALESCE(NULLIF(TRIM(BOTH FROM o.order_status), ''), 'UNKNOWN') as order_status,
                COALESCE(NULLIF(TRIM(BOTH FROM o.order_status_category), ''), 'UNKNOWN') as order_status_category,
                COALESCE(NULLIF(TRIM(BOTH FROM o.order_currency), ''), 'USD') as order_currency,
                (NULLIF(TRIM(BOTH FROM COALESCE(o.promotion_code, '')), '') IS NOT NULL) as has_promotion,
                COALESCE(o._etl_timestamp, CURRENT_TIMESTAMP) as created_date
            FROM silver.orders o
            INNER JOIN gold.dim_customer dc ON o.customer_key = dc.customer_key
            LEFT JOIN silver.order_item oi ON o.order_key = oi.order_key AND oi.is_valid = TRUE
            WHERE o.is_valid = TRUE
                AND o.order_date IS NOT NULL
                AND o.order_id > %s
            GROUP BY o.order_id, o.order_date, o.customer_key, o.sales_rep_key,
                     o.promotion_code, o.order_code, o.order_status,
                     o.order_status_category, o.order_currency, o._etl_timestamp
            ON CONFLICT (order_id) DO NOTHING
        """

        try:
            t_ins = time.time()
            self.cursor.execute(query, (max_order_id,))
            ins_elapsed = time.time() - t_ins
            inserted = self.cursor.rowcount
            self.connection.commit()
            if inserted == 0:
                logger.info("[OK] No new fact_orders rows to insert (already up to date).")
            else:
                logger.info(
                    "[OK] Inserted %s new fact_orders rows (INSERT took %.1fs)",
                    f"{inserted:,}",
                    ins_elapsed,
                )
            return inserted
        except Exception as e:
            self.connection.rollback()
            logger.error(f"[ERROR] Error incrementally populating fact_orders: {e}", exc_info=True)
            return 0
    
    def populate_fact_inventory_snapshot(self, snapshot_date: date = None, force_refresh: bool = False):
        """Populate fact_inventory_snapshot from silver.inventory for one snapshot date.

        Replaces rows for that date_key each run so inventory changes are reflected.
        """
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
                        quarter_number, quarter_name, year_number, is_weekend,
                        is_holiday, holiday_name, fiscal_year, fiscal_quarter, fiscal_month
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (date_key) DO NOTHING
                """, (
                    date_key, d, day_of_week, day_names[d.weekday()],
                    d.day, d.timetuple().tm_yday,
                    d.isocalendar()[1], d.month,
                    month_names[d.month - 1], month_short[d.month - 1],
                    quarter, f"Q{quarter}", d.year, d.weekday() >= 5,
                    False, '', d.year, quarter, d.month,
                ))
                self.connection.commit()
        
        if force_refresh:
            self.cursor.execute(
                "DELETE FROM gold.fact_inventory_snapshot WHERE snapshot_date_key = %s",
                (date_key,),
            )
            logger.debug("populate_fact_inventory_snapshot: force_refresh=True (snapshot date cleared)")
        
        query = """
            INSERT INTO gold.fact_inventory_snapshot (
                snapshot_date_key, product_key, warehouse_key,
                quantity_on_hand, quantity_available, quantity_reserved,
                days_of_supply, stock_status, inventory_value
            )
            SELECT
                %s as snapshot_date_key,
                i.product_key,
                i.warehouse_key,
                COALESCE(i.quantity_on_hand, 0) as quantity_on_hand,
                COALESCE(i.quantity_available, 0) as quantity_available,
                COALESCE(i.quantity_reserved, 0) as quantity_reserved,
                CASE
                    WHEN COALESCE(i.quantity_available, 0) <= 0 THEN 0
                    ELSE LEAST(999, GREATEST(0, (i.quantity_on_hand / NULLIF(i.quantity_available, 0))::INT))
                END as days_of_supply,
                CASE
                    WHEN COALESCE(i.quantity_available, 0) <= 0 THEN 'OUT_OF_STOCK'
                    WHEN COALESCE(i.quantity_available, 0) < 10 THEN 'LOW_STOCK'
                    ELSE 'IN_STOCK'
                END as stock_status,
                ROUND(COALESCE(i.quantity_on_hand, 0) * COALESCE(p.list_price, 0), 2) as inventory_value
            FROM silver.inventory i
            LEFT JOIN silver.product p ON i.product_key = p.product_key AND p.is_valid = TRUE
            WHERE i.is_valid = TRUE
              AND NOT EXISTS (
                  SELECT 1
                  FROM gold.fact_inventory_snapshot f
                  WHERE f.snapshot_date_key = %s
                    AND f.product_key = i.product_key
                    AND f.warehouse_key = i.warehouse_key
              )
        """
        
        try:
            self.cursor.execute(query, (date_key, date_key))
            count = self.cursor.rowcount
            self.connection.commit()
            logger.info(f"Populated {count:,} inventory snapshot records for {snapshot_date}")
            return count
        except Exception as e:
            logger.error(f"Error populating inventory snapshot: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def aggregate_sales_rep_performance(self, force_refresh: bool = False):
        """Aggregate sales rep performance into gold.agg_sales_rep_performance.

        Rebuilt each pipeline run (DELETE + INSERT) so metrics match current silver.orders.
        """
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
            ON CONFLICT (employee_key, year_number, month_number) DO NOTHING
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
        
        # Incremental: only compute agg_daily_sales for dates missing from gold.agg_daily_sales.
        # (No deletes / no recompute from beginning.)
        logger.info("Collecting distinct order dates from silver.orders (valid orders only)...")
        try:
            self.cursor.execute(
                """
                SELECT DISTINCT order_date
                FROM silver.orders
                WHERE order_date IS NOT NULL AND is_valid = TRUE
                ORDER BY 1
                """
            )
            all_dates = [row[0] for row in self.cursor.fetchall()]
            self.cursor.execute("SELECT date_key FROM gold.agg_daily_sales;")
            existing_keys = {int(r[0]) for r in self.cursor.fetchall() if r and r[0] is not None}
            dates_to_process = [
                d for d in all_dates
                if int(d.strftime("%Y%m%d")) not in existing_keys
            ]
        except Exception as e:
            logger.warning(f"Could not list distinct order dates: {e}; falling back to calendar range")
            try:
                self.connection.rollback()
            except Exception:
                pass
            dates_to_process = []
            current_date = start_date
            while current_date <= end_date:
                dates_to_process.append(current_date)
                current_date += timedelta(days=1)

        total_dates = len(dates_to_process)
        total_checked = total_dates
        logger.info(
            "Inserting gold.agg_daily_sales for %s new date(s) (skip existing dates).",
            f"{total_dates:,}",
        )

        if total_dates == 0:
            logger.info("  No order dates in silver; skipping daily sales aggregation.")
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
        
        daily_elapsed = time.time() - daily_start
        totals['daily_sales'] = daily_processed
        
        logger.info("")
        logger.info(f"[OK] Daily Sales Aggregation Complete")
        logger.info(f"  Dates recomputed: {daily_processed}")
        logger.info(f"  Dates with no insert (errors/empty): {daily_skipped}")
        logger.info(f"  Distinct order dates in silver: {total_checked}")
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
