-- Silver Layer: Products Dimension (SCD Type 2)
-- Product dimension with historical tracking
-- Tracks changes over time using valid_from/valid_to

CREATE TABLE IF NOT EXISTS silver.products (
    product_sk BIGSERIAL PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    product_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    subcategory VARCHAR(100),
    brand VARCHAR(100),
    price DECIMAL(10,2) CHECK (price >= 0),
    cost DECIMAL(10,2) CHECK (cost >= 0),
    currency VARCHAR(3) DEFAULT 'USD',
    supplier_id VARCHAR(50),
    sku VARCHAR(100),
    is_active BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP,
    is_current BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_silver_products_product_id_valid_to ON silver.products(product_id, valid_to);
CREATE INDEX IF NOT EXISTS idx_silver_products_category ON silver.products(category);
CREATE INDEX IF NOT EXISTS idx_silver_products_is_current ON silver.products(is_current);
CREATE INDEX IF NOT EXISTS idx_silver_products_brand ON silver.products(brand);
CREATE INDEX IF NOT EXISTS idx_silver_products_supplier_id ON silver.products(supplier_id);
-- Partial index for current records only
CREATE UNIQUE INDEX IF NOT EXISTS idx_silver_products_current ON silver.products(product_id) 
    WHERE is_current = TRUE;

-- Comments
COMMENT ON TABLE silver.products IS 'Product dimension with historical tracking (SCD Type 2)';
COMMENT ON COLUMN silver.products.product_sk IS 'Surrogate key';
COMMENT ON COLUMN silver.products.product_id IS 'Natural key from source system';
COMMENT ON COLUMN silver.products.valid_from IS 'Record validity start timestamp';
COMMENT ON COLUMN silver.products.valid_to IS 'Record validity end timestamp (NULL if current)';
COMMENT ON COLUMN silver.products.is_current IS 'Flag indicating if this is the current version';
