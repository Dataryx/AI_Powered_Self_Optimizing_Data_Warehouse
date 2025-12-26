-- Silver Layer: Customers Dimension (SCD Type 2)
-- Customer dimension with historical tracking
-- Tracks changes over time using valid_from/valid_to

CREATE TABLE IF NOT EXISTS silver.customers (
    customer_sk BIGSERIAL PRIMARY KEY,
    customer_id VARCHAR(50) NOT NULL,
    email VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    full_name VARCHAR(255),
    phone VARCHAR(50),
    country VARCHAR(100),
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    address_line1 VARCHAR(255),
    address_line2 VARCHAR(255),
    registration_date DATE,
    date_of_birth DATE,
    gender VARCHAR(20),
    customer_segment VARCHAR(50),
    valid_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_silver_customers_customer_id_valid_to ON silver.customers(customer_id, valid_to);
CREATE INDEX IF NOT EXISTS idx_silver_customers_email ON silver.customers(email);
CREATE INDEX IF NOT EXISTS idx_silver_customers_country ON silver.customers(country);
CREATE INDEX IF NOT EXISTS idx_silver_customers_is_current ON silver.customers(is_current);
CREATE INDEX IF NOT EXISTS idx_silver_customers_customer_segment ON silver.customers(customer_segment);
CREATE INDEX IF NOT EXISTS idx_silver_customers_registration_date ON silver.customers(registration_date);
-- Partial index for current records only
CREATE UNIQUE INDEX IF NOT EXISTS idx_silver_customers_current ON silver.customers(customer_id) 
    WHERE is_current = TRUE;

-- Comments
COMMENT ON TABLE silver.customers IS 'Customer dimension with historical tracking (SCD Type 2)';
COMMENT ON COLUMN silver.customers.customer_sk IS 'Surrogate key';
COMMENT ON COLUMN silver.customers.customer_id IS 'Natural key from source system';
COMMENT ON COLUMN silver.customers.valid_from IS 'Record validity start timestamp';
COMMENT ON COLUMN silver.customers.valid_to IS 'Record validity end timestamp (NULL if current)';
COMMENT ON COLUMN silver.customers.is_current IS 'Flag indicating if this is the current version';
