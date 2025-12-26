-- Create All Data Warehouse Schemas
-- This script creates all Bronze, Silver, and Gold layer tables

-- Set search path
SET search_path TO public;

-- Create schemas if they don't exist
CREATE SCHEMA IF NOT EXISTS bronze;
CREATE SCHEMA IF NOT EXISTS silver;
CREATE SCHEMA IF NOT EXISTS gold;
CREATE SCHEMA IF NOT EXISTS ml_optimization;

-- Create Bronze Layer Tables
\i data-warehouse/schemas/bronze/raw_orders.sql
\i data-warehouse/schemas/bronze/raw_products.sql
\i data-warehouse/schemas/bronze/raw_customers.sql
\i data-warehouse/schemas/bronze/raw_inventory.sql
\i data-warehouse/schemas/bronze/raw_clickstream.sql
\i data-warehouse/schemas/bronze/raw_reviews.sql
\i data-warehouse/schemas/bronze/raw_sessions.sql

-- Create Silver Layer Tables
\i data-warehouse/schemas/silver/customers.sql
\i data-warehouse/schemas/silver/products.sql
\i data-warehouse/schemas/silver/orders.sql
\i data-warehouse/schemas/silver/order_items.sql
\i data-warehouse/schemas/silver/inventory_snapshots.sql
\i data-warehouse/schemas/silver/user_events.sql
\i data-warehouse/schemas/silver/product_reviews.sql

-- Create Gold Layer Tables
\i data-warehouse/schemas/gold/daily_sales_summary.sql
\i data-warehouse/schemas/gold/customer_360.sql
\i data-warehouse/schemas/gold/product_performance.sql
\i data-warehouse/schemas/gold/inventory_health.sql
\i data-warehouse/schemas/gold/conversion_funnel.sql
\i data-warehouse/schemas/gold/cohort_analysis.sql
\i data-warehouse/schemas/gold/real_time_dashboard.sql

-- Grant permissions (adjust as needed for your setup)
GRANT USAGE ON SCHEMA bronze TO public;
GRANT USAGE ON SCHEMA silver TO public;
GRANT USAGE ON SCHEMA gold TO public;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA bronze TO public;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA silver TO public;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA gold TO public;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA bronze TO public;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA silver TO public;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA gold TO public;

