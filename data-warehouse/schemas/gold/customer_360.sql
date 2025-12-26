-- Gold Layer: Customer 360
-- Comprehensive customer analytics view

CREATE TABLE IF NOT EXISTS gold.customer_360 (
    customer_sk BIGINT PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    lifetime_value DECIMAL(15,2) NOT NULL DEFAULT 0,
    total_orders INTEGER NOT NULL DEFAULT 0,
    average_order_value DECIMAL(10,2),
    purchase_frequency DECIMAL(10,2),
    days_since_last_purchase INTEGER,
    days_since_first_purchase INTEGER,
    customer_segment VARCHAR(50),
    churn_risk_score DECIMAL(3,2) CHECK (churn_risk_score >= 0 AND churn_risk_score <= 1),
    favorite_category VARCHAR(100),
    favorite_brand VARCHAR(100),
    total_returns INTEGER DEFAULT 0,
    total_reviews INTEGER DEFAULT 0,
    average_rating DECIMAL(3,2),
    registration_date DATE,
    first_purchase_date DATE,
    last_purchase_date DATE,
    last_order_amount DECIMAL(15,2),
    preferred_payment_method VARCHAR(50),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_customer_360_customer FOREIGN KEY (customer_sk) 
        REFERENCES silver.customers(customer_sk)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gold_customer_360_customer_segment ON gold.customer_360(customer_segment);
CREATE INDEX IF NOT EXISTS idx_gold_customer_360_churn_risk_score ON gold.customer_360(churn_risk_score);
CREATE INDEX IF NOT EXISTS idx_gold_customer_360_lifetime_value ON gold.customer_360(lifetime_value);
CREATE INDEX IF NOT EXISTS idx_gold_customer_360_last_updated ON gold.customer_360(last_updated);
CREATE INDEX IF NOT EXISTS idx_gold_customer_360_days_since_last_purchase ON gold.customer_360(days_since_last_purchase);

-- Comments
COMMENT ON TABLE gold.customer_360 IS 'Comprehensive customer analytics';
COMMENT ON COLUMN gold.customer_360.churn_risk_score IS 'Churn risk score from 0 (low) to 1 (high)';
COMMENT ON COLUMN gold.customer_360.purchase_frequency IS 'Average orders per month';
