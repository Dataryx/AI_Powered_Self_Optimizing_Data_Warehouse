-- Gold Layer: Product Performance
-- Product performance metrics and analytics

CREATE TABLE IF NOT EXISTS gold.product_performance (
    product_sk BIGINT PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    product_name VARCHAR(255),
    category VARCHAR(100),
    total_units_sold INTEGER NOT NULL DEFAULT 0,
    total_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
    average_rating DECIMAL(3,2) CHECK (average_rating >= 1 AND average_rating <= 5),
    review_count INTEGER DEFAULT 0,
    return_rate DECIMAL(5,4) CHECK (return_rate >= 0 AND return_rate <= 1),
    inventory_turnover DECIMAL(10,2),
    days_since_last_sale INTEGER,
    category_rank INTEGER,
    total_reviews_5_star INTEGER DEFAULT 0,
    total_reviews_4_star INTEGER DEFAULT 0,
    total_reviews_3_star INTEGER DEFAULT 0,
    total_reviews_2_star INTEGER DEFAULT 0,
    total_reviews_1_star INTEGER DEFAULT 0,
    average_sentiment_score DECIMAL(3,2),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_performance_product FOREIGN KEY (product_sk) 
        REFERENCES silver.products(product_sk)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gold_product_performance_category_rank ON gold.product_performance(category_rank);
CREATE INDEX IF NOT EXISTS idx_gold_product_performance_total_revenue ON gold.product_performance(total_revenue);
CREATE INDEX IF NOT EXISTS idx_gold_product_performance_category ON gold.product_performance(category);
CREATE INDEX IF NOT EXISTS idx_gold_product_performance_average_rating ON gold.product_performance(average_rating);
CREATE INDEX IF NOT EXISTS idx_gold_product_performance_last_updated ON gold.product_performance(last_updated);

-- Comments
COMMENT ON TABLE gold.product_performance IS 'Product performance metrics and analytics';
COMMENT ON COLUMN gold.product_performance.return_rate IS 'Return rate from 0 to 1';
COMMENT ON COLUMN gold.product_performance.category_rank IS 'Rank within category by revenue';
