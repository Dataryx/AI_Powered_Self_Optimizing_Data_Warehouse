-- Bronze Layer: Raw Sessions Table
-- Stores raw user session data

CREATE TABLE IF NOT EXISTS bronze.raw_sessions (
    session_id VARCHAR(100) NOT NULL PRIMARY KEY,
    user_id VARCHAR(50),
    start_time TIMESTAMP NOT NULL,
    end_time TIMESTAMP,
    duration_seconds INTEGER,
    device_type VARCHAR(50),  -- desktop, mobile, tablet
    browser VARCHAR(100),
    operating_system VARCHAR(100),
    location JSONB,
    ip_address VARCHAR(45),  -- IPv6 compatible
    is_mobile BOOLEAN,
    source_system VARCHAR(50) NOT NULL,
    ingestion_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    raw_data JSONB  -- Store complete raw record for audit
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_raw_sessions_user_id ON bronze.raw_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_raw_sessions_start_time ON bronze.raw_sessions(start_time);
CREATE INDEX IF NOT EXISTS idx_raw_sessions_device_type ON bronze.raw_sessions(device_type);
CREATE INDEX IF NOT EXISTS idx_raw_sessions_operating_system ON bronze.raw_sessions(operating_system);
CREATE INDEX IF NOT EXISTS idx_raw_sessions_source_system ON bronze.raw_sessions(source_system);
CREATE INDEX IF NOT EXISTS idx_raw_sessions_ingestion_timestamp ON bronze.raw_sessions(ingestion_timestamp);
-- GIN index for JSONB location for efficient JSON queries
CREATE INDEX IF NOT EXISTS idx_raw_sessions_location ON bronze.raw_sessions USING GIN(location);
-- Composite index for user session queries
CREATE INDEX IF NOT EXISTS idx_raw_sessions_user_start_time ON bronze.raw_sessions(user_id, start_time);

-- Comments
COMMENT ON TABLE bronze.raw_sessions IS 'Raw user session data';
COMMENT ON COLUMN bronze.raw_sessions.session_id IS 'Unique session identifier';
COMMENT ON COLUMN bronze.raw_sessions.duration_seconds IS 'Session duration in seconds';
COMMENT ON COLUMN bronze.raw_sessions.location IS 'Geographic location data in JSON format';
COMMENT ON COLUMN bronze.raw_sessions.source_system IS 'Source system identifier';
COMMENT ON COLUMN bronze.raw_sessions.ingestion_timestamp IS 'When data was ingested into data warehouse';
