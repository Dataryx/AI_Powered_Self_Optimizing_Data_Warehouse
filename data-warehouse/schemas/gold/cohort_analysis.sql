-- Gold Layer: Cohort Analysis
-- Customer cohort analysis by registration month

CREATE TABLE IF NOT EXISTS gold.cohort_analysis (
    cohort_sk BIGSERIAL PRIMARY KEY,
    cohort_month DATE NOT NULL,
    period_number INTEGER NOT NULL CHECK (period_number >= 0),
    customers INTEGER NOT NULL DEFAULT 0,
    active_customers INTEGER NOT NULL DEFAULT 0,
    retention_rate DECIMAL(5,4) CHECK (retention_rate >= 0 AND retention_rate <= 1),
    revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
    cumulative_revenue DECIMAL(15,2) NOT NULL DEFAULT 0,
    average_order_value DECIMAL(10,2),
    orders INTEGER NOT NULL DEFAULT 0,
    cumulative_orders INTEGER NOT NULL DEFAULT 0,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_cohort_analysis_cohort_period UNIQUE (cohort_month, period_number)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gold_cohort_analysis_cohort_month ON gold.cohort_analysis(cohort_month);
CREATE INDEX IF NOT EXISTS idx_gold_cohort_analysis_cohort_period ON gold.cohort_analysis(cohort_month, period_number);
CREATE INDEX IF NOT EXISTS idx_gold_cohort_analysis_period_number ON gold.cohort_analysis(period_number);
CREATE INDEX IF NOT EXISTS idx_gold_cohort_analysis_retention_rate ON gold.cohort_analysis(retention_rate);

-- Comments
COMMENT ON TABLE gold.cohort_analysis IS 'Customer cohort analysis by registration month';
COMMENT ON COLUMN gold.cohort_analysis.cohort_month IS 'First purchase month for the cohort';
COMMENT ON COLUMN gold.cohort_analysis.period_number IS 'Period number (months since cohort month, 0 = first month)';
COMMENT ON COLUMN gold.cohort_analysis.retention_rate IS 'Retention rate (active_customers/customers)';
