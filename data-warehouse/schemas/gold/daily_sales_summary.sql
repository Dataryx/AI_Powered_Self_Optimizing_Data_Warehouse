-- Gold Layer: Daily Sales Summary
-- Pre-aggregated daily sales metrics for fast reporting

CREATE TABLE IF NOT EXISTS gold.daily_sales_summary (
    date_key DATE PRIMARY KEY,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_items_sold INTEGER NOT NULL DEFAULT 0,
    average_order_value DECIMAL(10,2),
    unique_customers INTEGER NOT NULL DEFAULT 0,
    new_customers INTEGER NOT NULL DEFAULT 0,
    returning_customers INTEGER NOT NULL DEFAULT 0,
    top_category VARCHAR(100),
    top_product_sk BIGINT,
    top_category_revenue DECIMAL(15,2),
    average_items_per_order DECIMAL(5,2),
    total_discount_amount DECIMAL(15,2) DEFAULT 0,
    total_tax_amount DECIMAL(15,2) DEFAULT 0,
    total_shipping_cost DECIMAL(15,2) DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_daily_sales_summary_product FOREIGN KEY (top_product_sk) 
        REFERENCES silver.products(product_sk)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gold_daily_sales_summary_last_updated ON gold.daily_sales_summary(last_updated);
CREATE INDEX IF NOT EXISTS idx_gold_daily_sales_summary_top_category ON gold.daily_sales_summary(top_category);

-- Comments
COMMENT ON TABLE gold.daily_sales_summary IS 'Daily sales aggregations for fast reporting';
COMMENT ON COLUMN gold.daily_sales_summary.date_key IS 'Date (primary key)';
COMMENT ON COLUMN gold.daily_sales_summary.top_product_sk IS 'Top selling product surrogate key';
