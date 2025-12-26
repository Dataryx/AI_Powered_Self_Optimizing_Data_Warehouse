-- Gold Layer: Real-Time Dashboard
-- Real-time dashboard metrics (updated hourly)

CREATE TABLE IF NOT EXISTS gold.real_time_dashboard (
    dashboard_sk BIGSERIAL PRIMARY KEY,
    metric_date DATE NOT NULL,
    metric_hour INTEGER NOT NULL CHECK (metric_hour >= 0 AND metric_hour <= 23),
    orders_today INTEGER NOT NULL DEFAULT 0,
    revenue_today DECIMAL(15,2) NOT NULL DEFAULT 0,
    active_users INTEGER NOT NULL DEFAULT 0,
    cart_abandonment_rate DECIMAL(5,4),
    top_product_sk BIGINT,
    top_product_revenue DECIMAL(15,2),
    top_category VARCHAR(100),
    top_category_revenue DECIMAL(15,2),
    average_order_value DECIMAL(10,2),
    conversion_rate DECIMAL(5,4),
    page_views INTEGER DEFAULT 0,
    unique_visitors INTEGER DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_real_time_dashboard_product FOREIGN KEY (top_product_sk) 
        REFERENCES silver.products(product_sk),
    CONSTRAINT uq_real_time_dashboard_date_hour UNIQUE (metric_date, metric_hour)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gold_real_time_dashboard_metric_date ON gold.real_time_dashboard(metric_date);
CREATE INDEX IF NOT EXISTS idx_gold_real_time_dashboard_date_hour ON gold.real_time_dashboard(metric_date, metric_hour);
CREATE INDEX IF NOT EXISTS idx_gold_real_time_dashboard_last_updated ON gold.real_time_dashboard(last_updated);

-- Comments
COMMENT ON TABLE gold.real_time_dashboard IS 'Real-time dashboard metrics (updated hourly)';
COMMENT ON COLUMN gold.real_time_dashboard.metric_hour IS 'Hour of the day (0-23)';
COMMENT ON COLUMN gold.real_time_dashboard.orders_today IS 'Total orders today (as of this hour)';
