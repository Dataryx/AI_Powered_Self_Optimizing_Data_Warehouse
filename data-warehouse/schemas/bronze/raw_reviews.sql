-- Bronze Layer: Raw Reviews Table
-- Stores raw product review data

CREATE TABLE IF NOT EXISTS bronze.raw_reviews (
    review_id VARCHAR(50) NOT NULL PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    customer_id VARCHAR(50),
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    review_title VARCHAR(255),
    review_date TIMESTAMP,
    helpful_count INTEGER DEFAULT 0,
    verified_purchase BOOLEAN DEFAULT FALSE,
    source_system VARCHAR(50) NOT NULL,
    ingestion_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    raw_data JSONB  -- Store complete raw record for audit
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_raw_reviews_product_id ON bronze.raw_reviews(product_id);
CREATE INDEX IF NOT EXISTS idx_raw_reviews_customer_id ON bronze.raw_reviews(customer_id);
CREATE INDEX IF NOT EXISTS idx_raw_reviews_review_date ON bronze.raw_reviews(review_date);
CREATE INDEX IF NOT EXISTS idx_raw_reviews_rating ON bronze.raw_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_raw_reviews_source_system ON bronze.raw_reviews(source_system);
CREATE INDEX IF NOT EXISTS idx_raw_reviews_ingestion_timestamp ON bronze.raw_reviews(ingestion_timestamp);
-- Full text search index on review_text
CREATE INDEX IF NOT EXISTS idx_raw_reviews_review_text_fts ON bronze.raw_reviews USING GIN(to_tsvector('english', review_text));

-- Comments
COMMENT ON TABLE bronze.raw_reviews IS 'Raw product review data';
COMMENT ON COLUMN bronze.raw_reviews.review_id IS 'Unique review identifier';
COMMENT ON COLUMN bronze.raw_reviews.rating IS 'Rating from 1 to 5';
COMMENT ON COLUMN bronze.raw_reviews.verified_purchase IS 'Whether the review is from a verified purchase';
COMMENT ON COLUMN bronze.raw_reviews.source_system IS 'Source system identifier';
COMMENT ON COLUMN bronze.raw_reviews.ingestion_timestamp IS 'When data was ingested into data warehouse';
