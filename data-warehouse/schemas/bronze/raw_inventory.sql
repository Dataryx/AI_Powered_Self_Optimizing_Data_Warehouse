-- Bronze Layer: Raw Inventory Table
-- Stores raw inventory movement data
-- Partitioned by month on movement_date for performance

CREATE TABLE IF NOT EXISTS bronze.raw_inventory (
    inventory_id BIGSERIAL NOT NULL,
    product_id VARCHAR(50) NOT NULL,
    warehouse_id VARCHAR(50) NOT NULL,
    quantity INTEGER NOT NULL,
    movement_type VARCHAR(50) NOT NULL,  -- IN, OUT, ADJUSTMENT, TRANSFER
    movement_date TIMESTAMP NOT NULL,
    reference_number VARCHAR(100),
    source_system VARCHAR(50) NOT NULL,
    ingestion_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    raw_data JSONB,  -- Store complete raw record for audit
    PRIMARY KEY (inventory_id, movement_date)
) PARTITION BY RANGE (movement_date);

-- Create default partition (for current month)
CREATE TABLE IF NOT EXISTS bronze.raw_inventory_default PARTITION OF bronze.raw_inventory
    DEFAULT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_raw_inventory_product_id ON bronze.raw_inventory(product_id);
CREATE INDEX IF NOT EXISTS idx_raw_inventory_warehouse_id ON bronze.raw_inventory(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_raw_inventory_movement_date ON bronze.raw_inventory(movement_date);
CREATE INDEX IF NOT EXISTS idx_raw_inventory_movement_type ON bronze.raw_inventory(movement_type);
CREATE INDEX IF NOT EXISTS idx_raw_inventory_source_system ON bronze.raw_inventory(source_system);
CREATE INDEX IF NOT EXISTS idx_raw_inventory_ingestion_timestamp ON bronze.raw_inventory(ingestion_timestamp);

-- Comments
COMMENT ON TABLE bronze.raw_inventory IS 'Raw inventory movement data. Partitioned by month.';
COMMENT ON COLUMN bronze.raw_inventory.inventory_id IS 'Auto-increment inventory movement ID';
COMMENT ON COLUMN bronze.raw_inventory.quantity IS 'Movement quantity (positive for IN, negative for OUT)';
COMMENT ON COLUMN bronze.raw_inventory.movement_type IS 'Type of movement: IN, OUT, ADJUSTMENT, TRANSFER';
COMMENT ON COLUMN bronze.raw_inventory.source_system IS 'Source system identifier';
COMMENT ON COLUMN bronze.raw_inventory.ingestion_timestamp IS 'When data was ingested into data warehouse';
