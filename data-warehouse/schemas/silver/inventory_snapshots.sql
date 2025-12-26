-- Silver Layer: Inventory Snapshots Table
-- Daily inventory snapshot table
-- Partitioned by month on snapshot_date for performance

CREATE TABLE IF NOT EXISTS silver.inventory_snapshots (
    snapshot_sk BIGSERIAL NOT NULL,
    product_sk BIGINT NOT NULL,
    warehouse_id VARCHAR(50) NOT NULL,
    snapshot_date DATE NOT NULL,
    quantity_on_hand INTEGER NOT NULL DEFAULT 0,
    quantity_reserved INTEGER NOT NULL DEFAULT 0,
    quantity_available INTEGER NOT NULL DEFAULT 0,
    reorder_level INTEGER,
    safety_stock INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (snapshot_sk, snapshot_date),
    CONSTRAINT fk_inventory_snapshots_product FOREIGN KEY (product_sk) REFERENCES silver.products(product_sk),
    CONSTRAINT uq_inventory_snapshots_product_warehouse_date UNIQUE (product_sk, warehouse_id, snapshot_date)
) PARTITION BY RANGE (snapshot_date);

-- Create default partition
CREATE TABLE IF NOT EXISTS silver.inventory_snapshots_default PARTITION OF silver.inventory_snapshots
    DEFAULT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_silver_inventory_snapshots_product_sk ON silver.inventory_snapshots(product_sk);
CREATE INDEX IF NOT EXISTS idx_silver_inventory_snapshots_warehouse_id ON silver.inventory_snapshots(warehouse_id);
CREATE INDEX IF NOT EXISTS idx_silver_inventory_snapshots_snapshot_date ON silver.inventory_snapshots(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_silver_inventory_snapshots_product_warehouse_date ON silver.inventory_snapshots(product_sk, warehouse_id, snapshot_date);

-- Comments
COMMENT ON TABLE silver.inventory_snapshots IS 'Daily inventory snapshot table. Partitioned by month.';
COMMENT ON COLUMN silver.inventory_snapshots.quantity_available IS 'Quantity available for sale (on_hand - reserved)';
COMMENT ON COLUMN silver.inventory_snapshots.snapshot_date IS 'Date of the snapshot';
