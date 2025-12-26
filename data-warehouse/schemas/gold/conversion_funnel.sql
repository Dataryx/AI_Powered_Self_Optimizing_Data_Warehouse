-- Gold Layer: Conversion Funnel
-- Conversion funnel metrics by channel and date

CREATE TABLE IF NOT EXISTS gold.conversion_funnel (
    funnel_sk BIGSERIAL PRIMARY KEY,
    date_key DATE NOT NULL,
    channel VARCHAR(100) NOT NULL,
    visitors INTEGER NOT NULL DEFAULT 0,
    page_views INTEGER NOT NULL DEFAULT 0,
    add_to_carts INTEGER NOT NULL DEFAULT 0,
    checkouts INTEGER NOT NULL DEFAULT 0,
    purchases INTEGER NOT NULL DEFAULT 0,
    conversion_rate DECIMAL(5,4) CHECK (conversion_rate >= 0 AND conversion_rate <= 1),
    cart_abandonment_rate DECIMAL(5,4) CHECK (cart_abandonment_rate >= 0 AND cart_abandonment_rate <= 1),
    visitors_to_cart_rate DECIMAL(5,4),
    cart_to_checkout_rate DECIMAL(5,4),
    checkout_to_purchase_rate DECIMAL(5,4),
    average_session_duration_seconds INTEGER,
    bounce_rate DECIMAL(5,4),
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_conversion_funnel_date_channel UNIQUE (date_key, channel)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_gold_conversion_funnel_date_key ON gold.conversion_funnel(date_key);
CREATE INDEX IF NOT EXISTS idx_gold_conversion_funnel_channel ON gold.conversion_funnel(channel);
CREATE INDEX IF NOT EXISTS idx_gold_conversion_funnel_date_channel ON gold.conversion_funnel(date_key, channel);
CREATE INDEX IF NOT EXISTS idx_gold_conversion_funnel_conversion_rate ON gold.conversion_funnel(conversion_rate);

-- Comments
COMMENT ON TABLE gold.conversion_funnel IS 'Conversion funnel metrics by channel and date';
COMMENT ON COLUMN gold.conversion_funnel.channel IS 'Marketing channel (organic, paid, email, social, etc.)';
COMMENT ON COLUMN gold.conversion_funnel.conversion_rate IS 'Overall conversion rate (purchases/visitors)';
