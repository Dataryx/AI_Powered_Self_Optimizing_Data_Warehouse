-- Bronze Layer: Raw Orders Table
-- Stores raw order data from e-commerce platform
-- Partitioned by month on order_date for performance

CREATE TABLE IF NOT EXISTS bronze.raw_orders (
    order_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50),
    order_date TIMESTAMP NOT NULL,
    status VARCHAR(50),
    shipping_address JSONB,
    total_amount DECIMAL(15,2),
    source_system VARCHAR(50) NOT NULL,
    ingestion_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    raw_data JSONB,  -- Store complete raw record for audit
    PRIMARY KEY (order_id, order_date)
) PARTITION BY RANGE (order_date);

-- Create default partition (for current month)
CREATE TABLE IF NOT EXISTS bronze.raw_orders_default PARTITION OF bronze.raw_orders
    DEFAULT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_raw_orders_customer_id ON bronze.raw_orders(customer_id);
CREATE INDEX IF NOT EXISTS idx_raw_orders_order_date ON bronze.raw_orders(order_date);
CREATE INDEX IF NOT EXISTS idx_raw_orders_status ON bronze.raw_orders(status);
CREATE INDEX IF NOT EXISTS idx_raw_orders_source_system ON bronze.raw_orders(source_system);
CREATE INDEX IF NOT EXISTS idx_raw_orders_ingestion_timestamp ON bronze.raw_orders(ingestion_timestamp);

-- Comments
COMMENT ON TABLE bronze.raw_orders IS 'Raw order data from e-commerce platform. Partitioned by month.';
COMMENT ON COLUMN bronze.raw_orders.order_id IS 'Unique order identifier from source system';
COMMENT ON COLUMN bronze.raw_orders.customer_id IS 'Customer identifier';
COMMENT ON COLUMN bronze.raw_orders.order_date IS 'Order creation timestamp';
COMMENT ON COLUMN bronze.raw_orders.shipping_address IS 'JSONB containing shipping address details';
COMMENT ON COLUMN bronze.raw_orders.total_amount IS 'Total order amount';
COMMENT ON COLUMN bronze.raw_orders.source_system IS 'Source system identifier';
COMMENT ON COLUMN bronze.raw_orders.ingestion_timestamp IS 'When data was ingested into data warehouse';
COMMENT ON COLUMN bronze.raw_orders.raw_data IS 'Complete raw record stored for audit and reprocessing';
