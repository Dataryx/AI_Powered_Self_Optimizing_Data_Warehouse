"""
Silver to Gold Layer Aggregator
Aggregates Silver layer data into Gold layer analytics tables.
"""

import psycopg2
from datetime import datetime, date, timedelta
from typing import Dict, Any
import logging

logger = logging.getLogger(__name__)


class SilverToGoldAggregator:
    """Aggregates Silver layer data to Gold layer."""
    
    def __init__(self, connection):
        """Initialize aggregator with database connection."""
        self.connection = connection
        self.cursor = connection.cursor()
    
    def aggregate_daily_sales_summary(self, target_date: date = None):
        """Aggregate daily sales summary for a specific date."""
        if target_date is None:
            target_date = date.today() - timedelta(days=1)
        
        logger.info(f"Aggregating daily sales summary for {target_date}...")
        
        # Delete existing record for this date
        self.cursor.execute(
            "DELETE FROM gold.daily_sales_summary WHERE date_key = %s",
            (target_date,)
        )
        
        # Aggregate sales data
        aggregate_query = """
            INSERT INTO gold.daily_sales_summary (
                date_key, total_orders, total_revenue, total_items_sold,
                average_order_value, unique_customers, new_customers,
                returning_customers, top_category, top_product_sk,
                top_category_revenue, average_items_per_order,
                total_discount_amount, total_tax_amount, total_shipping_cost
            )
            WITH daily_stats AS (
                SELECT
                    COUNT(DISTINCT o.order_sk) as total_orders,
                    COALESCE(SUM(o.total_amount), 0) as total_revenue,
                    COALESCE(SUM(oi.quantity), 0) as total_items_sold,
                    COALESCE(AVG(o.total_amount), 0) as average_order_value,
                    COUNT(DISTINCT o.customer_sk) as unique_customers,
                    COUNT(DISTINCT CASE WHEN c.registration_date = %s THEN c.customer_sk END) as new_customers,
                    COUNT(DISTINCT CASE WHEN c.registration_date < %s THEN o.customer_sk END) as returning_customers,
                    COALESCE(AVG(item_counts.items_per_order), 0) as average_items_per_order,
                    COALESCE(SUM(o.discount_amount), 0) as total_discount_amount,
                    COALESCE(SUM(o.tax_amount), 0) as total_tax_amount,
                    COALESCE(SUM(o.shipping_cost), 0) as total_shipping_cost
                FROM silver.orders o
                LEFT JOIN silver.customers c ON o.customer_sk = c.customer_sk AND c.is_current = TRUE
                LEFT JOIN (
                    SELECT order_sk, SUM(quantity) as items_per_order
                    FROM silver.order_items
                    GROUP BY order_sk
                ) item_counts ON o.order_sk = item_counts.order_sk
                LEFT JOIN silver.order_items oi ON o.order_sk = oi.order_sk
                WHERE o.order_date = %s
            ),
            top_category_info AS (
                SELECT category
                FROM silver.products p
                JOIN silver.order_items oi2 ON p.product_sk = oi2.product_sk
                JOIN silver.orders o2 ON oi2.order_sk = o2.order_sk
                WHERE o2.order_date = %s
                GROUP BY p.category
                ORDER BY SUM(oi2.total_amount) DESC
                LIMIT 1
            ),
            top_product_info AS (
                SELECT p.product_sk
                FROM silver.products p
                JOIN silver.order_items oi3 ON p.product_sk = oi3.product_sk
                JOIN silver.orders o3 ON oi3.order_sk = o3.order_sk
                WHERE o3.order_date = %s
                GROUP BY p.product_sk
                ORDER BY SUM(oi3.total_amount) DESC
                LIMIT 1
            ),
            top_category_revenue_info AS (
                SELECT COALESCE(SUM(oi4.total_amount), 0) as revenue
                FROM silver.order_items oi4
                JOIN silver.orders o4 ON oi4.order_sk = o4.order_sk
                JOIN silver.products p4 ON oi4.product_sk = p4.product_sk
                WHERE o4.order_date = %s
                AND EXISTS (SELECT 1 FROM top_category_info tci WHERE tci.category = p4.category)
            )
            SELECT
                %s as date_key,
                ds.total_orders,
                ds.total_revenue,
                ds.total_items_sold,
                ds.average_order_value,
                ds.unique_customers,
                ds.new_customers,
                ds.returning_customers,
                tci.category as top_category,
                tpi.product_sk as top_product_sk,
                tcr.revenue as top_category_revenue,
                ds.average_items_per_order,
                ds.total_discount_amount,
                ds.total_tax_amount,
                ds.total_shipping_cost
            FROM daily_stats ds
            CROSS JOIN LATERAL (SELECT category FROM top_category_info LIMIT 1) tci
            CROSS JOIN LATERAL (SELECT product_sk FROM top_product_info LIMIT 1) tpi
            CROSS JOIN LATERAL (SELECT revenue FROM top_category_revenue_info LIMIT 1) tcr
        """
        
        try:
            self.cursor.execute(aggregate_query, (
                target_date, target_date, target_date, target_date,
                target_date, target_date, target_date
            ))
            self.connection.commit()
            logger.info(f"Successfully aggregated daily sales summary for {target_date}")
            return 1
        except Exception as e:
            logger.error(f"Error aggregating daily sales summary: {e}")
            self.connection.rollback()
            return 0
    
    def aggregate_customer_360(self, customer_sk: int = None):
        """Aggregate customer 360 view for a specific customer or all customers."""
        logger.info("Aggregating customer 360 data...")
        
        if customer_sk:
            where_clause = "WHERE c.customer_sk = %s"
            params = (customer_sk,)
        else:
            where_clause = ""
            params = None
        
        # Delete existing records
        if customer_sk:
            self.cursor.execute(
                "DELETE FROM gold.customer_360 WHERE customer_sk = %s",
                (customer_sk,)
            )
        else:
            self.cursor.execute("DELETE FROM gold.customer_360")
        
        aggregate_query = f"""
            INSERT INTO gold.customer_360 (
                customer_sk, customer_id, lifetime_value, total_orders,
                average_order_value, purchase_frequency, days_since_last_purchase,
                days_since_first_purchase, customer_segment, favorite_category,
                favorite_brand, registration_date, first_purchase_date, last_purchase_date
            )
            SELECT
                c.customer_sk,
                c.customer_id,
                COALESCE(SUM(o.total_amount), 0) as lifetime_value,
                COUNT(DISTINCT o.order_sk) as total_orders,
                COALESCE(AVG(o.total_amount), 0) as average_order_value,
                CASE
                    WHEN (MAX(o.order_date) - MIN(o.order_date)) > 0
                    THEN COUNT(DISTINCT o.order_sk)::DECIMAL / 
                         GREATEST(EXTRACT(EPOCH FROM (MAX(o.order_date)::timestamp - MIN(o.order_date)::timestamp)) / 2592000, 1)
                    ELSE 0
                END as purchase_frequency,
                CASE WHEN MAX(o.order_date) IS NOT NULL
                    THEN (CURRENT_DATE - MAX(o.order_date))
                    ELSE NULL
                END as days_since_last_purchase,
                CASE WHEN MIN(o.order_date) IS NOT NULL
                    THEN (CURRENT_DATE - MIN(o.order_date))
                    ELSE NULL
                END as days_since_first_purchase,
                c.customer_segment,
                (SELECT p.category FROM silver.products p
                 JOIN silver.order_items oi ON p.product_sk = oi.product_sk
                 JOIN silver.orders o2 ON oi.order_sk = o2.order_sk
                 WHERE o2.customer_sk = c.customer_sk
                 GROUP BY p.category
                 ORDER BY SUM(oi.quantity) DESC
                 LIMIT 1) as favorite_category,
                (SELECT p.brand FROM silver.products p
                 JOIN silver.order_items oi ON p.product_sk = oi.product_sk
                 JOIN silver.orders o2 ON oi.order_sk = o2.order_sk
                 WHERE o2.customer_sk = c.customer_sk
                 GROUP BY p.brand
                 ORDER BY SUM(oi.quantity) DESC
                 LIMIT 1) as favorite_brand,
                c.registration_date,
                MIN(o.order_date) as first_purchase_date,
                MAX(o.order_date) as last_purchase_date
            FROM silver.customers c
            LEFT JOIN silver.orders o ON c.customer_sk = o.customer_sk
            WHERE c.is_current = TRUE {where_clause}
            GROUP BY c.customer_sk, c.customer_id, c.customer_segment, c.registration_date
        """
        
        try:
            if params:
                self.cursor.execute(aggregate_query, params)
            else:
                self.cursor.execute(aggregate_query)
            
            count = self.cursor.rowcount
            self.connection.commit()
            logger.info(f"Successfully aggregated {count} customer 360 records")
            return count
        except Exception as e:
            logger.error(f"Error aggregating customer 360: {e}")
            self.connection.rollback()
            return 0
    
    def aggregate_product_performance(self, product_sk: int = None):
        """Aggregate product performance metrics."""
        logger.info("Aggregating product performance data...")
        
        if product_sk:
            where_clause = "WHERE p.product_sk = %s"
            params = (product_sk,)
        else:
            where_clause = ""
            params = None
        
        # Delete existing records
        if product_sk:
            self.cursor.execute(
                "DELETE FROM gold.product_performance WHERE product_sk = %s",
                (product_sk,)
            )
        else:
            self.cursor.execute("DELETE FROM gold.product_performance")
        
        aggregate_query = f"""
            INSERT INTO gold.product_performance (
                product_sk, product_id, product_name, category,
                total_units_sold, total_revenue, average_rating,
                review_count, days_since_last_sale
            )
            SELECT
                p.product_sk,
                p.product_id,
                p.product_name,
                p.category,
                COALESCE(SUM(oi.quantity), 0) as total_units_sold,
                COALESCE(SUM(oi.total_amount), 0) as total_revenue,
                CASE WHEN COUNT(DISTINCT pr.review_sk) > 0 
                    THEN AVG(pr.rating)
                    ELSE NULL
                END as average_rating,
                COUNT(DISTINCT pr.review_sk) as review_count,
                CASE WHEN MAX(o.order_date) IS NOT NULL
                    THEN (CURRENT_DATE - MAX(o.order_date))
                    ELSE NULL
                END as days_since_last_sale
            FROM silver.products p
            LEFT JOIN silver.order_items oi ON p.product_sk = oi.product_sk
            LEFT JOIN silver.orders o ON oi.order_sk = o.order_sk
            LEFT JOIN silver.product_reviews pr ON p.product_sk = pr.product_sk
            WHERE p.is_current = TRUE {where_clause}
            GROUP BY p.product_sk, p.product_id, p.product_name, p.category
        """
        
        try:
            if params:
                self.cursor.execute(aggregate_query, params)
            else:
                self.cursor.execute(aggregate_query)
            
            count = self.cursor.rowcount
            self.connection.commit()
            logger.info(f"Successfully aggregated {count} product performance records")
            return count
        except Exception as e:
            logger.error(f"Error aggregating product performance: {e}")
            self.connection.rollback()
            return 0
    
    def aggregate_all(self):
        """Aggregate all Gold layer tables."""
        logger.info("=" * 60)
        logger.info("Starting Silver to Gold Aggregation")
        logger.info("=" * 60)
        
        # Aggregate daily sales for last 30 days
        logger.info("\nAggregating daily sales summaries...")
        for i in range(30):
            target_date = date.today() - timedelta(days=i+1)
            self.aggregate_daily_sales_summary(target_date)
        
        # Aggregate customer 360
        logger.info("\nAggregating customer 360...")
        self.aggregate_customer_360()
        
        # Aggregate product performance
        logger.info("\nAggregating product performance...")
        self.aggregate_product_performance()
        
        logger.info("=" * 60)
        logger.info("Silver to Gold Aggregation Complete!")
        logger.info("=" * 60)

