-- Silver Layer: Orders Fact Table
-- Cleaned and validated orders with surrogate keys
-- Partitioned by month on order_date for performance

CREATE TABLE IF NOT EXISTS silver.orders (
    order_sk BIGSERIAL NOT NULL,
    order_id VARCHAR(50) NOT NULL,
    customer_sk BIGINT,
    order_date DATE NOT NULL,
    order_timestamp TIMESTAMP NOT NULL,
    status VARCHAR(50) NOT NULL,
    shipping_country VARCHAR(100),
    shipping_city VARCHAR(100),
    shipping_postal_code VARCHAR(20),
    shipping_address_line1 VARCHAR(255),
    shipping_address_line2 VARCHAR(255),
    total_amount DECIMAL(15,2) NOT NULL,
    discount_amount DECIMAL(15,2) DEFAULT 0,
    tax_amount DECIMAL(15,2) DEFAULT 0,
    shipping_cost DECIMAL(10,2) DEFAULT 0,
    payment_method VARCHAR(50),
    payment_status VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (order_sk, order_date),
    CONSTRAINT fk_orders_customer FOREIGN KEY (customer_sk) REFERENCES silver.customers(customer_sk)
) PARTITION BY RANGE (order_date);

-- Create default partition
CREATE TABLE IF NOT EXISTS silver.orders_default PARTITION OF silver.orders
    DEFAULT;

-- Indexes
-- Note: Unique constraint on order_id alone cannot be created on partitioned tables
-- in PostgreSQL. Unique constraints must include the partition key (order_date).
-- Application-level enforcement or a unique constraint on (order_id, order_date) should be used.
CREATE INDEX IF NOT EXISTS idx_silver_orders_order_id ON silver.orders(order_id);
CREATE INDEX IF NOT EXISTS idx_silver_orders_customer_sk ON silver.orders(customer_sk);
CREATE INDEX IF NOT EXISTS idx_silver_orders_order_date ON silver.orders(order_date);
CREATE INDEX IF NOT EXISTS idx_silver_orders_status ON silver.orders(status);
CREATE INDEX IF NOT EXISTS idx_silver_orders_shipping_country ON silver.orders(shipping_country);

-- Comments
COMMENT ON TABLE silver.orders IS 'Cleaned and validated orders fact table. Partitioned by month.';
COMMENT ON COLUMN silver.orders.order_sk IS 'Surrogate key for orders';
COMMENT ON COLUMN silver.orders.customer_sk IS 'Foreign key to customers dimension';
COMMENT ON COLUMN silver.orders.status IS 'Validated order status';
