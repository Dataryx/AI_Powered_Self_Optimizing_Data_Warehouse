-- Bronze Layer: Raw Customers Table
-- Stores raw customer data

CREATE TABLE IF NOT EXISTS bronze.raw_customers (
    customer_id VARCHAR(50) NOT NULL PRIMARY KEY,
    email VARCHAR(255),
    customer_name VARCHAR(255),
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    phone VARCHAR(50),
    address JSONB,
    registration_date TIMESTAMP,
    date_of_birth DATE,
    gender VARCHAR(20),
    source_system VARCHAR(50) NOT NULL,
    ingestion_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    raw_data JSONB  -- Store complete raw record for audit
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_raw_customers_email ON bronze.raw_customers(email);
CREATE INDEX IF NOT EXISTS idx_raw_customers_registration_date ON bronze.raw_customers(registration_date);
CREATE INDEX IF NOT EXISTS idx_raw_customers_source_system ON bronze.raw_customers(source_system);
CREATE INDEX IF NOT EXISTS idx_raw_customers_ingestion_timestamp ON bronze.raw_customers(ingestion_timestamp);
-- GIN index for JSONB address for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_raw_customers_address ON bronze.raw_customers USING GIN(address);

-- Comments
COMMENT ON TABLE bronze.raw_customers IS 'Raw customer data';
COMMENT ON COLUMN bronze.raw_customers.customer_id IS 'Unique customer identifier';
COMMENT ON COLUMN bronze.raw_customers.customer_name IS 'Full customer name';
COMMENT ON COLUMN bronze.raw_customers.address IS 'Customer address details in JSON format';
COMMENT ON COLUMN bronze.raw_customers.source_system IS 'Source system identifier';
COMMENT ON COLUMN bronze.raw_customers.ingestion_timestamp IS 'When data was ingested into data warehouse';
