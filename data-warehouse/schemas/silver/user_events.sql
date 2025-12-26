-- Silver Layer: User Events Table
-- Cleaned and enriched clickstream events
-- Partitioned by day on event_timestamp for performance

CREATE TABLE IF NOT EXISTS silver.user_events (
    event_sk BIGSERIAL NOT NULL,
    session_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(50),
    event_type VARCHAR(50) NOT NULL,
    page_category VARCHAR(100),
    page_url TEXT,
    referrer_category VARCHAR(100),
    referrer_url TEXT,
    device_type VARCHAR(50),
    browser VARCHAR(100),
    operating_system VARCHAR(50),
    country VARCHAR(100),
    city VARCHAR(100),
    event_timestamp TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (event_sk, event_timestamp)
) PARTITION BY RANGE (event_timestamp);

-- Create default partition
CREATE TABLE IF NOT EXISTS silver.user_events_default PARTITION OF silver.user_events
    DEFAULT;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_silver_user_events_session_id ON silver.user_events(session_id);
CREATE INDEX IF NOT EXISTS idx_silver_user_events_user_id ON silver.user_events(user_id);
CREATE INDEX IF NOT EXISTS idx_silver_user_events_event_timestamp ON silver.user_events(event_timestamp);
CREATE INDEX IF NOT EXISTS idx_silver_user_events_event_type ON silver.user_events(event_type);
CREATE INDEX IF NOT EXISTS idx_silver_user_events_device_type ON silver.user_events(device_type);
CREATE INDEX IF NOT EXISTS idx_silver_user_events_country ON silver.user_events(country);
CREATE INDEX IF NOT EXISTS idx_silver_user_events_session_timestamp ON silver.user_events(session_id, event_timestamp);

-- Comments
COMMENT ON TABLE silver.user_events IS 'Cleaned and enriched clickstream events. Partitioned by day.';
COMMENT ON COLUMN silver.user_events.event_type IS 'Standardized event type (view, click, add_to_cart, purchase, etc.)';
COMMENT ON COLUMN silver.user_events.page_category IS 'Page category classification';
