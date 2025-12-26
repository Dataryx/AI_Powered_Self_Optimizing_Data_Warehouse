-- Bronze Layer: Raw Clickstream Table
-- Stores raw clickstream/event data
-- Partitioned by day on event_timestamp for performance

CREATE TABLE IF NOT EXISTS bronze.raw_clickstream (
    event_id BIGSERIAL NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(50),
    event_type VARCHAR(50) NOT NULL,  -- view, click, add_to_cart, purchase, etc.
    page_url TEXT,
    referrer TEXT,
    device_info JSONB,
    event_timestamp TIMESTAMP NOT NULL,
    source_system VARCHAR(50) NOT NULL,
    ingestion_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    raw_data JSONB,  -- Store complete raw record for audit
    PRIMARY KEY (event_id, event_timestamp)
) PARTITION BY RANGE (event_timestamp);

-- Create default partition (for current day)
CREATE TABLE IF NOT EXISTS bronze.raw_clickstream_default PARTITION OF bronze.raw_clickstream
    DEFAULT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_raw_clickstream_session_id ON bronze.raw_clickstream(session_id);
CREATE INDEX IF NOT EXISTS idx_raw_clickstream_user_id ON bronze.raw_clickstream(user_id);
CREATE INDEX IF NOT EXISTS idx_raw_clickstream_event_timestamp ON bronze.raw_clickstream(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_raw_clickstream_event_type ON bronze.raw_clickstream(event_type);
CREATE INDEX IF NOT EXISTS idx_raw_clickstream_source_system ON bronze.raw_clickstream(source_system);
CREATE INDEX IF NOT EXISTS idx_raw_clickstream_ingestion_timestamp ON bronze.raw_clickstream(ingestion_timestamp);
-- GIN index for JSONB device_info for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_raw_clickstream_device_info ON bronze.raw_clickstream USING GIN(device_info);

-- Comments
COMMENT ON TABLE bronze.raw_clickstream IS 'Raw clickstream/event data. Partitioned by day.';
COMMENT ON COLUMN bronze.raw_clickstream.event_id IS 'Auto-increment event ID';
COMMENT ON COLUMN bronze.raw_clickstream.event_type IS 'Type of event: view, click, add_to_cart, purchase, etc.';
COMMENT ON COLUMN bronze.raw_clickstream.device_info IS 'Device and browser information in JSON format';
COMMENT ON COLUMN bronze.raw_clickstream.source_system IS 'Source system identifier';
COMMENT ON COLUMN bronze.raw_clickstream.ingestion_timestamp IS 'When data was ingested into data warehouse';
