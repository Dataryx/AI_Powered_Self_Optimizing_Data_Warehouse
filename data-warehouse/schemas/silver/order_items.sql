-- Silver Layer: Order Items Fact Table
-- Order line items with product references

CREATE TABLE IF NOT EXISTS silver.order_items (
    order_item_sk BIGSERIAL PRIMARY KEY,
    order_sk BIGINT NOT NULL,
    product_sk BIGINT NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),
    unit_price DECIMAL(10,2) NOT NULL CHECK (unit_price >= 0),
    discount_amount DECIMAL(10,2) DEFAULT 0 CHECK (discount_amount >= 0),
    total_amount DECIMAL(15,2) NOT NULL CHECK (total_amount >= 0),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    -- Note: Foreign key to orders is not enforced due to partitioning
    -- Referential integrity should be maintained at application level
    CONSTRAINT fk_order_items_product FOREIGN KEY (product_sk) REFERENCES silver.products(product_sk)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_silver_order_items_order_sk ON silver.order_items(order_sk);
CREATE INDEX IF NOT EXISTS idx_silver_order_items_product_sk ON silver.order_items(product_sk);
CREATE INDEX IF NOT EXISTS idx_silver_order_items_created_at ON silver.order_items(created_at);

-- Comments
COMMENT ON TABLE silver.order_items IS 'Order line items fact table';
COMMENT ON COLUMN silver.order_items.order_sk IS 'Foreign key to orders';
COMMENT ON COLUMN silver.order_items.product_sk IS 'Foreign key to products (current version)';
COMMENT ON COLUMN silver.order_items.unit_price IS 'Price at time of purchase';
