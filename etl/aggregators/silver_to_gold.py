"""
Silver to Gold Layer Aggregator
Aggregates Silver layer data into Gold layer analytics tables.
Updated to work with the actual schema: gold.agg_daily_sales, gold.agg_customer_lifetime, etc.
"""

import psycopg2
from datetime import datetime, date, timedelta
from typing import Dict, Any
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
    
    def aggregate_daily_sales(self, target_date: date = None):
        """Aggregate daily sales for a specific date into gold.agg_daily_sales."""
        if target_date is None:
            target_date = date.today() - timedelta(days=1)
        
        logger.info(f"Aggregating daily sales for {target_date}...")
        
        # Convert date to date_key (YYYYMMDD format)
        date_key = int(target_date.strftime('%Y%m%d'))
        
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
            """, (
                date_key, target_date, day_of_week, day_names[target_date.weekday()],
                target_date.day, target_date.timetuple().tm_yday,
                target_date.isocalendar()[1], target_date.month,
                month_names[target_date.month - 1], month_short[target_date.month - 1],
                (target_date.month - 1) // 3 + 1, f"Q{(target_date.month - 1) // 3 + 1}",
                target_date.year, target_date.weekday() >= 5
            ))
            self.connection.commit()
        
        # Delete existing record for this date
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
    
    def aggregate_customer_lifetime(self):
        """Aggregate customer lifetime value into gold.agg_customer_lifetime."""
        if not self.table_is_empty('gold', 'agg_customer_lifetime'):
            logger.info("⏭️  gold.agg_customer_lifetime already has data; skipping.")
            return 0
        
        logger.info("Aggregating customer lifetime data...")
        
        # Delete existing records
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
            logger.info(f"Successfully aggregated {count:,} customer lifetime records")
            return count
        except Exception as e:
            logger.error(f"Error aggregating customer lifetime: {e}", exc_info=True)
            self.connection.rollback()
            return 0
    
    def aggregate_monthly_product_sales(self):
        """Aggregate monthly product sales into gold.agg_monthly_product_sales."""
        if not self.table_is_empty('gold', 'agg_monthly_product_sales'):
            logger.info("⏭️  gold.agg_monthly_product_sales already has data; skipping.")
            return 0
        
        logger.info("Aggregating monthly product sales...")
        
        # Delete existing records
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
            logger.info(f"Successfully aggregated {count:,} monthly product sales records")
            return count
        except Exception as e:
            logger.error(f"Error aggregating monthly product sales: {e}", exc_info=True)
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
        
        # Aggregate daily sales for last 30 days
        logger.info("-" * 80)
        logger.info("STEP 1/3: Aggregating Daily Sales Summaries")
        logger.info("-" * 80)
        logger.info("Processing last 30 days of sales data...")
        logger.info("")
        
        daily_job_id = None
        if self.tracker:
            daily_job_id = self.tracker.start_job(
                "GOLD - Daily Sales Aggregation",
                "aggregation",
                "gold",
                "daily_sales_summary",
                30
            )
            self.tracker.update_progress(daily_job_id, 0)
        
        daily_start = time.time()
        daily_count = 0
        for i in range(30):
            target_date = date.today() - timedelta(days=i+1)
            result = self.aggregate_daily_sales(target_date)
            if result > 0:
                daily_count += 1
                if daily_count % 5 == 0:
                    logger.info(f"  Processed {daily_count}/30 days...")
            
            # Update progress
            if self.tracker and daily_job_id:
                progress = int((daily_count / 30) * 100)
                self.tracker.update_progress(daily_job_id, progress, daily_count)
        
        daily_elapsed = time.time() - daily_start
        totals['daily_sales'] = daily_count
        
        if self.tracker and daily_job_id:
            self.tracker.update_progress(daily_job_id, 100, daily_count)
            self.tracker.complete_job(daily_job_id, daily_count)
        
        logger.info("")
        logger.info(f"✓ Daily Sales Aggregation Complete")
        logger.info(f"  Days aggregated: {daily_count}/30")
        logger.info(f"  Time taken: {daily_elapsed:.2f}s")
        logger.info("")
        
        # Aggregate customer lifetime
        logger.info("-" * 80)
        logger.info("STEP 2/3: Aggregating Customer Lifetime Value")
        logger.info("-" * 80)
        logger.info("Calculating RFM scores and customer segments...")
        logger.info("")
        
        customer_job_id = None
        if self.tracker:
            # Get customer count for progress tracking
            try:
                self.cursor.execute("SELECT COUNT(*) FROM silver.customer WHERE is_valid = TRUE;")
                customer_total = self.cursor.fetchone()[0]
            except:
                customer_total = None
            
            customer_job_id = self.tracker.start_job(
                "GOLD - Customer Lifetime Aggregation",
                "aggregation",
                "gold",
                "agg_customer_lifetime",
                customer_total
            )
            self.tracker.update_progress(customer_job_id, 0)
        
        customer_start = time.time()
        customer_count = self.aggregate_customer_lifetime()
        customer_elapsed = time.time() - customer_start
        totals['customer_lifetime'] = customer_count
        
        if self.tracker and customer_job_id:
            self.tracker.update_progress(customer_job_id, 100, customer_count)
            self.tracker.complete_job(customer_job_id, customer_count)
        
        logger.info("")
        logger.info(f"✓ Customer Lifetime Aggregation Complete")
        logger.info(f"  Customers aggregated: {customer_count:,}")
        logger.info(f"  Time taken: {customer_elapsed:.2f}s ({customer_elapsed/60:.2f} min)")
        logger.info("")
        
        # Aggregate monthly product sales
        logger.info("-" * 80)
        logger.info("STEP 3/3: Aggregating Monthly Product Sales")
        logger.info("-" * 80)
        logger.info("Calculating monthly sales by product category...")
        logger.info("")
        
        product_job_id = None
        if self.tracker:
            product_job_id = self.tracker.start_job(
                "GOLD - Monthly Product Sales Aggregation",
                "aggregation",
                "gold",
                "agg_monthly_product_sales",
                None
            )
            self.tracker.update_progress(product_job_id, 0)
        
        product_start = time.time()
        product_count = self.aggregate_monthly_product_sales()
        product_elapsed = time.time() - product_start
        totals['monthly_product_sales'] = product_count
        
        if self.tracker and product_job_id:
            self.tracker.update_progress(product_job_id, 100, product_count)
            self.tracker.complete_job(product_job_id, product_count)
        
        logger.info("")
        logger.info(f"✓ Monthly Product Sales Aggregation Complete")
        logger.info(f"  Monthly records aggregated: {product_count:,}")
        logger.info(f"  Time taken: {product_elapsed:.2f}s ({product_elapsed/60:.2f} min)")
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
