-- Create All Data Warehouse Tables
-- This script is run after schema creation
-- Note: Actual table creation should be done using the create_schemas.py script
-- or by executing the individual SQL files, as this init script runs before
-- the application code is available

-- This file serves as a placeholder. Tables should be created using:
-- 1. make create-schemas (recommended)
-- 2. python scripts/data-warehouse/create_schemas.py
-- 3. Or manually execute SQL files in data-warehouse/schemas/

-- Tables will be created in the following order:
-- Bronze: raw_orders, raw_products, raw_customers, raw_inventory, raw_clickstream, raw_reviews, raw_sessions
-- Silver: customers, products, orders, order_items, inventory_snapshots, user_events, product_reviews
-- Gold: daily_sales_summary, customer_360, product_performance, inventory_health, conversion_funnel, cohort_analysis, real_time_dashboard

