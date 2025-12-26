-- Bronze Layer: Raw Products Table
-- Stores raw product catalog data

CREATE TABLE IF NOT EXISTS bronze.raw_products (
    product_id VARCHAR(50) NOT NULL PRIMARY KEY,
    product_name TEXT,
    description TEXT,
    category VARCHAR(100),
    subcategory VARCHAR(100),
    price DECIMAL(10,2),
    cost DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    attributes JSONB,
    supplier_id VARCHAR(50),
    brand VARCHAR(100),
    sku VARCHAR(100),
    source_system VARCHAR(50) NOT NULL,
    ingestion_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    raw_data JSONB  -- Store complete raw record for audit
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_raw_products_category ON bronze.raw_products(category);
CREATE INDEX IF NOT EXISTS idx_raw_products_supplier_id ON bronze.raw_products(supplier_id);
CREATE INDEX IF NOT EXISTS idx_raw_products_brand ON bronze.raw_products(brand);
CREATE INDEX IF NOT EXISTS idx_raw_products_source_system ON bronze.raw_products(source_system);
CREATE INDEX IF NOT EXISTS idx_raw_products_ingestion_timestamp ON bronze.raw_products(ingestion_timestamp);
-- GIN index for JSONB attributes for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_raw_products_attributes ON bronze.raw_products USING GIN(attributes);

-- Comments
COMMENT ON TABLE bronze.raw_products IS 'Raw product catalog data';
COMMENT ON COLUMN bronze.raw_products.product_id IS 'Unique product identifier';
COMMENT ON COLUMN bronze.raw_products.product_name IS 'Product name';
COMMENT ON COLUMN bronze.raw_products.attributes IS 'Additional product attributes in JSON format';
COMMENT ON COLUMN bronze.raw_products.source_system IS 'Source system identifier';
COMMENT ON COLUMN bronze.raw_products.ingestion_timestamp IS 'When data was ingested into data warehouse';
