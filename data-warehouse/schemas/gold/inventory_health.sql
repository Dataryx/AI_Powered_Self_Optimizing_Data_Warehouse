-- Gold Layer: Inventory Health
-- Inventory health metrics and analytics

CREATE TABLE IF NOT EXISTS gold.inventory_health (
    inventory_health_sk BIGSERIAL PRIMARY KEY,
    product_sk BIGINT NOT NULL,
    warehouse_id VARCHAR(50) NOT NULL,
    current_stock INTEGER NOT NULL DEFAULT 0,
    days_of_supply INTEGER,
    stockout_frequency INTEGER DEFAULT 0,
    overstock_flag BOOLEAN DEFAULT FALSE,
    understock_flag BOOLEAN DEFAULT FALSE,
    reorder_point INTEGER,
    safety_stock INTEGER,
    optimal_stock_level INTEGER,
    average_daily_demand DECIMAL(10,2),
    stock_velocity DECIMAL(10,2),
    snapshot_date DATE NOT NULL,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_inventory_health_product FOREIGN KEY (product_sk) 
        REFERENCES silver.products(product_sk),
    CONSTRAINT uq_inventory_health_product_warehouse_date UNIQUE (product_sk, warehouse_id, snapshot_date)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gold_inventory_health_overstock_flag ON gold.inventory_health(overstock_flag);
CREATE INDEX IF NOT EXISTS idx_gold_inventory_health_understock_flag ON gold.inventory_health(understock_flag);
CREATE INDEX IF NOT EXISTS idx_gold_inventory_health_snapshot_date ON gold.inventory_health(snapshot_date);
CREATE INDEX IF NOT EXISTS idx_gold_inventory_health_product_warehouse_date ON gold.inventory_health(product_sk, warehouse_id, snapshot_date);
CREATE INDEX IF NOT EXISTS idx_gold_inventory_health_days_of_supply ON gold.inventory_health(days_of_supply);

-- Comments
COMMENT ON TABLE gold.inventory_health IS 'Inventory health metrics and analytics';
COMMENT ON COLUMN gold.inventory_health.days_of_supply IS 'Days of supply based on sales velocity';
COMMENT ON COLUMN gold.inventory_health.stockout_frequency IS 'Number of stockouts in the period';
