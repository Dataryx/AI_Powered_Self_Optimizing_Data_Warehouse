-- Silver Layer: Product Reviews Table
-- Cleaned product reviews with sentiment analysis

CREATE TABLE IF NOT EXISTS silver.product_reviews (
    review_sk BIGSERIAL PRIMARY KEY,
    review_id VARCHAR(50) NOT NULL UNIQUE,
    product_sk BIGINT NOT NULL,
    customer_sk BIGINT,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    review_text TEXT,
    review_title VARCHAR(255),
    sentiment_score DECIMAL(3,2) CHECK (sentiment_score >= -1 AND sentiment_score <= 1),
    is_verified_purchase BOOLEAN DEFAULT FALSE,
    helpful_count INTEGER DEFAULT 0,
    review_date DATE NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_product_reviews_product FOREIGN KEY (product_sk) REFERENCES silver.products(product_sk),
    CONSTRAINT fk_product_reviews_customer FOREIGN KEY (customer_sk) REFERENCES silver.customers(customer_sk)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_silver_product_reviews_product_sk ON silver.product_reviews(product_sk);
CREATE INDEX IF NOT EXISTS idx_silver_product_reviews_customer_sk ON silver.product_reviews(customer_sk);
CREATE INDEX IF NOT EXISTS idx_silver_product_reviews_rating ON silver.product_reviews(rating);
CREATE INDEX IF NOT EXISTS idx_silver_product_reviews_review_date ON silver.product_reviews(review_date);
CREATE INDEX IF NOT EXISTS idx_silver_product_reviews_sentiment_score ON silver.product_reviews(sentiment_score);
-- Full text search index on review_text
CREATE INDEX IF NOT EXISTS idx_silver_product_reviews_review_text_fts ON silver.product_reviews 
    USING GIN(to_tsvector('english', COALESCE(review_text, '')));

-- Comments
COMMENT ON TABLE silver.product_reviews IS 'Cleaned product reviews with sentiment analysis';
COMMENT ON COLUMN silver.product_reviews.sentiment_score IS 'Sentiment analysis score from -1 (negative) to 1 (positive)';
COMMENT ON COLUMN silver.product_reviews.is_verified_purchase IS 'Whether the review is from a verified purchase';
