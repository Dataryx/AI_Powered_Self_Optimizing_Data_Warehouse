# Data Model Documentation

## Overview

This document describes the complete data model for the AI-Powered Self-Optimizing Data Warehouse. The system uses a medallion architecture with three layers: Bronze (raw), Silver (cleansed), and Gold (aggregated).

## Schema Design Principles

1. **Medallion Architecture**: Three-layer approach (Bronze → Silver → Gold)
2. **SCD Type 2**: Track historical changes in dimension tables
3. **Denormalization**: Strategic denormalization in Gold layer for performance
4. **Partitioning**: Time-based partitioning for large fact tables
5. **Indexing**: Comprehensive indexing strategy for query performance

## Bronze Layer Schema

### Purpose
Store raw, unprocessed data exactly as received from source systems. No transformations applied.

### Design Principles
- **As-is storage**: Preserve original data structure
- **Full history**: Never update, only append
- **Metadata tracking**: Source system, ingestion timestamp
- **JSONB support**: Flexible schema for varying structures

### Tables

#### bronze.raw_orders
Raw order data from e-commerce platform.

| Column | Type | Description |
|--------|------|-------------|
| order_id | VARCHAR(50) | Unique order identifier from source |
| customer_id | VARCHAR(50) | Customer identifier |
| order_date | TIMESTAMP | Order creation timestamp |
| status | VARCHAR(50) | Order status (pending, completed, cancelled) |
| shipping_address | JSONB | Shipping address details |
| total_amount | DECIMAL(15,2) | Total order amount |
| source_system | VARCHAR(50) | Source system identifier |
| ingestion_timestamp | TIMESTAMP | When data was ingested |

**Partitioning**: Monthly partitions on order_date
**Indexes**: 
- Primary key on order_id
- Index on customer_id
- Index on order_date

#### bronze.raw_products
Raw product catalog data.

| Column | Type | Description |
|--------|------|-------------|
| product_id | VARCHAR(50) | Unique product identifier |
| name | TEXT | Product name |
| description | TEXT | Product description |
| category | VARCHAR(100) | Product category |
| price | DECIMAL(10,2) | Product price |
| cost | DECIMAL(10,2) | Product cost |
| attributes | JSONB | Additional product attributes |
| supplier_id | VARCHAR(50) | Supplier identifier |
| source_system | VARCHAR(50) | Source system identifier |
| ingestion_timestamp | TIMESTAMP | When data was ingested |

**Indexes**: 
- Primary key on product_id
- Index on category
- GIN index on attributes (JSONB)

#### bronze.raw_customers
Raw customer data.

| Column | Type | Description |
|--------|------|-------------|
| customer_id | VARCHAR(50) | Unique customer identifier |
| email | VARCHAR(255) | Customer email |
| name | VARCHAR(255) | Customer name |
| address | JSONB | Customer address details |
| registration_date | TIMESTAMP | Customer registration date |
| source_system | VARCHAR(50) | Source system identifier |
| ingestion_timestamp | TIMESTAMP | When data was ingested |

**Indexes**: 
- Primary key on customer_id
- Index on email
- Index on registration_date

#### bronze.raw_inventory
Raw inventory movement data.

| Column | Type | Description |
|--------|------|-------------|
| inventory_id | BIGSERIAL | Auto-increment ID |
| product_id | VARCHAR(50) | Product identifier |
| warehouse_id | VARCHAR(50) | Warehouse identifier |
| quantity | INTEGER | Movement quantity (positive or negative) |
| movement_type | VARCHAR(50) | Type (IN, OUT, ADJUSTMENT) |
| movement_date | TIMESTAMP | Movement timestamp |
| source_system | VARCHAR(50) | Source system identifier |
| ingestion_timestamp | TIMESTAMP | When data was ingested |

**Partitioning**: Monthly partitions on movement_date
**Indexes**: 
- Primary key on inventory_id
- Index on product_id
- Index on warehouse_id
- Index on movement_date

#### bronze.raw_clickstream
Raw clickstream/event data.

| Column | Type | Description |
|--------|------|-------------|
| event_id | BIGSERIAL | Auto-increment ID |
| session_id | VARCHAR(100) | Session identifier |
| user_id | VARCHAR(50) | User identifier (nullable) |
| event_type | VARCHAR(50) | Event type (view, click, add_to_cart, purchase) |
| page_url | TEXT | Page URL |
| referrer | TEXT | Referrer URL |
| device_info | JSONB | Device and browser information |
| event_timestamp | TIMESTAMP | Event timestamp |
| source_system | VARCHAR(50) | Source system identifier |
| ingestion_timestamp | TIMESTAMP | When data was ingested |

**Partitioning**: Daily partitions on event_timestamp
**Indexes**: 
- Primary key on event_id
- Index on session_id
- Index on user_id
- Index on event_timestamp
- Index on event_type

#### bronze.raw_reviews
Raw product review data.

| Column | Type | Description |
|--------|------|-------------|
| review_id | VARCHAR(50) | Unique review identifier |
| product_id | VARCHAR(50) | Product identifier |
| customer_id | VARCHAR(50) | Customer identifier |
| rating | INTEGER | Rating (1-5) |
| review_text | TEXT | Review text |
| review_date | TIMESTAMP | Review submission date |
| source_system | VARCHAR(50) | Source system identifier |
| ingestion_timestamp | TIMESTAMP | When data was ingested |

**Indexes**: 
- Primary key on review_id
- Index on product_id
- Index on customer_id
- Index on review_date

#### bronze.raw_sessions
Raw user session data.

| Column | Type | Description |
|--------|------|-------------|
| session_id | VARCHAR(100) | Unique session identifier |
| user_id | VARCHAR(50) | User identifier (nullable) |
| start_time | TIMESTAMP | Session start time |
| end_time | TIMESTAMP | Session end time (nullable) |
| device_type | VARCHAR(50) | Device type (desktop, mobile, tablet) |
| browser | VARCHAR(100) | Browser information |
| location | JSONB | Geographic location data |
| source_system | VARCHAR(50) | Source system identifier |
| ingestion_timestamp | TIMESTAMP | When data was ingested |

**Indexes**: 
- Primary key on session_id
- Index on user_id
- Index on start_time

## Silver Layer Schema

### Purpose
Store cleaned, validated, and conformed data. Enforce data quality rules and maintain referential integrity.

### Design Principles
- **Data Quality**: Validation and cleaning applied
- **SCD Type 2**: Track historical changes in dimensions
- **Conformed Dimensions**: Standardized categories and codes
- **Referential Integrity**: Foreign key constraints enforced
- **Surrogate Keys**: Use integer surrogate keys for performance

### Tables

#### silver.orders
Cleaned and validated orders fact table.

| Column | Type | Description |
|--------|------|-------------|
| order_sk | BIGSERIAL | Surrogate key |
| order_id | VARCHAR(50) | Natural key from source |
| customer_sk | BIGINT | Foreign key to customers |
| order_date | DATE | Order date |
| order_timestamp | TIMESTAMP | Order timestamp |
| status | VARCHAR(50) | Validated order status |
| shipping_country | VARCHAR(100) | Extracted from address |
| shipping_city | VARCHAR(100) | Extracted from address |
| shipping_postal_code | VARCHAR(20) | Extracted from address |
| total_amount | DECIMAL(15,2) | Total order amount |
| discount_amount | DECIMAL(15,2) | Discount applied |
| tax_amount | DECIMAL(15,2) | Tax amount |
| shipping_cost | DECIMAL(10,2) | Shipping cost |
| created_at | TIMESTAMP | Record creation timestamp |
| updated_at | TIMESTAMP | Record update timestamp |

**Partitioning**: Monthly partitions on order_date
**Indexes**: 
- Primary key on order_sk
- Unique index on order_id
- Index on customer_sk
- Index on order_date
- Index on status

#### silver.order_items
Order line items fact table.

| Column | Type | Description |
|--------|------|-------------|
| order_item_sk | BIGSERIAL | Surrogate key |
| order_sk | BIGINT | Foreign key to orders |
| product_sk | BIGINT | Foreign key to products (current) |
| quantity | INTEGER | Quantity ordered |
| unit_price | DECIMAL(10,2) | Price at time of purchase |
| discount_amount | DECIMAL(10,2) | Line item discount |
| total_amount | DECIMAL(15,2) | Total line amount |
| created_at | TIMESTAMP | Record creation timestamp |

**Indexes**: 
- Primary key on order_item_sk
- Index on order_sk
- Index on product_sk

#### silver.products (SCD Type 2)
Product dimension with historical tracking.

| Column | Type | Description |
|--------|------|-------------|
| product_sk | BIGSERIAL | Surrogate key |
| product_id | VARCHAR(50) | Natural key from source |
| product_name | VARCHAR(255) | Product name |
| description | TEXT | Product description |
| category | VARCHAR(100) | Standardized category |
| subcategory | VARCHAR(100) | Subcategory |
| price | DECIMAL(10,2) | Current price |
| cost | DECIMAL(10,2) | Current cost |
| supplier_id | VARCHAR(50) | Supplier identifier |
| is_active | BOOLEAN | Active status |
| valid_from | TIMESTAMP | Record validity start |
| valid_to | TIMESTAMP | Record validity end (NULL if current) |
| is_current | BOOLEAN | Current version flag |
| created_at | TIMESTAMP | Record creation timestamp |

**Indexes**: 
- Primary key on product_sk
- Index on product_id, valid_to (for current record lookup)
- Index on category
- Index on is_current

#### silver.customers (SCD Type 2)
Customer dimension with historical tracking.

| Column | Type | Description |
|--------|------|-------------|
| customer_sk | BIGSERIAL | Surrogate key |
| customer_id | VARCHAR(50) | Natural key from source |
| email | VARCHAR(255) | Email address |
| first_name | VARCHAR(100) | First name |
| last_name | VARCHAR(100) | Last name |
| country | VARCHAR(100) | Country |
| city | VARCHAR(100) | City |
| postal_code | VARCHAR(20) | Postal code |
| registration_date | DATE | Registration date |
| customer_segment | VARCHAR(50) | Customer segment |
| valid_from | TIMESTAMP | Record validity start |
| valid_to | TIMESTAMP | Record validity end (NULL if current) |
| is_current | BOOLEAN | Current version flag |
| created_at | TIMESTAMP | Record creation timestamp |

**Indexes**: 
- Primary key on customer_sk
- Index on customer_id, valid_to (for current record lookup)
- Index on email
- Index on country
- Index on is_current

#### silver.inventory_snapshots
Daily inventory snapshot table.

| Column | Type | Description |
|--------|------|-------------|
| snapshot_sk | BIGSERIAL | Surrogate key |
| product_sk | BIGINT | Foreign key to products |
| warehouse_id | VARCHAR(50) | Warehouse identifier |
| snapshot_date | DATE | Snapshot date |
| quantity_on_hand | INTEGER | Quantity available |
| quantity_reserved | INTEGER | Quantity reserved |
| quantity_available | INTEGER | Quantity available for sale |
| reorder_level | INTEGER | Reorder point |
| safety_stock | INTEGER | Safety stock level |
| created_at | TIMESTAMP | Record creation timestamp |

**Partitioning**: Monthly partitions on snapshot_date
**Indexes**: 
- Primary key on snapshot_sk
- Unique index on (product_sk, warehouse_id, snapshot_date)
- Index on snapshot_date

#### silver.user_events
Cleaned and enriched clickstream events.

| Column | Type | Description |
|--------|------|-------------|
| event_sk | BIGSERIAL | Surrogate key |
| session_id | VARCHAR(100) | Session identifier |
| user_id | VARCHAR(50) | User identifier (nullable) |
| event_type | VARCHAR(50) | Event type (standardized) |
| page_category | VARCHAR(100) | Page category |
| page_url | TEXT | Page URL |
| referrer_category | VARCHAR(100) | Referrer category |
| device_type | VARCHAR(50) | Device type |
| browser | VARCHAR(100) | Browser |
| operating_system | VARCHAR(50) | Operating system |
| country | VARCHAR(100) | Country (from IP) |
| event_timestamp | TIMESTAMP | Event timestamp |
| created_at | TIMESTAMP | Record creation timestamp |

**Partitioning**: Daily partitions on event_timestamp
**Indexes**: 
- Primary key on event_sk
- Index on session_id
- Index on user_id
- Index on event_timestamp
- Index on event_type

#### silver.product_reviews
Cleaned product reviews.

| Column | Type | Description |
|--------|------|-------------|
| review_sk | BIGSERIAL | Surrogate key |
| review_id | VARCHAR(50) | Natural key |
| product_sk | BIGINT | Foreign key to products |
| customer_sk | BIGINT | Foreign key to customers |
| rating | INTEGER | Rating (1-5) |
| review_text | TEXT | Review text |
| sentiment_score | DECIMAL(3,2) | Sentiment analysis score (-1 to 1) |
| is_verified_purchase | BOOLEAN | Verified purchase flag |
| review_date | DATE | Review date |
| created_at | TIMESTAMP | Record creation timestamp |

**Indexes**: 
- Primary key on review_sk
- Unique index on review_id
- Index on product_sk
- Index on customer_sk
- Index on rating
- Index on review_date

## Gold Layer Schema

### Purpose
Store business-ready aggregated and analytics tables. Optimized for reporting and analytics.

### Design Principles
- **Denormalization**: Strategic denormalization for performance
- **Pre-aggregation**: Pre-calculated metrics
- **Materialized Views**: For frequently accessed aggregations
- **Daily Refresh**: Incremental updates where possible

### Tables

#### gold.daily_sales_summary
Daily sales aggregations.

| Column | Type | Description |
|--------|------|-------------|
| date_key | DATE | Date (primary key) |
| total_orders | INTEGER | Total orders |
| total_revenue | DECIMAL(15,2) | Total revenue |
| total_items_sold | INTEGER | Total items sold |
| average_order_value | DECIMAL(10,2) | Average order value |
| unique_customers | INTEGER | Unique customers |
| new_customers | INTEGER | New customers |
| returning_customers | INTEGER | Returning customers |
| top_category | VARCHAR(100) | Top selling category |
| top_product_sk | BIGINT | Top selling product |
| last_updated | TIMESTAMP | Last update timestamp |

**Indexes**: 
- Primary key on date_key
- Index on last_updated

#### gold.customer_360
Comprehensive customer analytics.

| Column | Type | Description |
|--------|------|-------------|
| customer_sk | BIGINT | Customer surrogate key (primary key) |
| customer_id | VARCHAR(50) | Customer identifier |
| lifetime_value | DECIMAL(15,2) | Total lifetime value |
| total_orders | INTEGER | Total number of orders |
| average_order_value | DECIMAL(10,2) | Average order value |
| purchase_frequency | DECIMAL(10,2) | Orders per month |
| days_since_last_purchase | INTEGER | Days since last purchase |
| customer_segment | VARCHAR(50) | Customer segment |
| churn_risk_score | DECIMAL(3,2) | Churn risk (0-1) |
| favorite_category | VARCHAR(100) | Most purchased category |
| total_returns | INTEGER | Total returns |
| registration_date | DATE | Registration date |
| first_purchase_date | DATE | First purchase date |
| last_purchase_date | DATE | Last purchase date |
| last_updated | TIMESTAMP | Last update timestamp |

**Indexes**: 
- Primary key on customer_sk
- Index on customer_segment
- Index on churn_risk_score
- Index on last_updated

#### gold.product_performance
Product performance metrics.

| Column | Type | Description |
|--------|------|-------------|
| product_sk | BIGINT | Product surrogate key (primary key) |
| product_id | VARCHAR(50) | Product identifier |
| total_units_sold | INTEGER | Total units sold |
| total_revenue | DECIMAL(15,2) | Total revenue |
| average_rating | DECIMAL(3,2) | Average rating |
| review_count | INTEGER | Number of reviews |
| return_rate | DECIMAL(5,4) | Return rate (0-1) |
| inventory_turnover | DECIMAL(10,2) | Inventory turnover ratio |
| days_since_last_sale | INTEGER | Days since last sale |
| category_rank | INTEGER | Rank within category |
| last_updated | TIMESTAMP | Last update timestamp |

**Indexes**: 
- Primary key on product_sk
- Index on category_rank
- Index on total_revenue
- Index on last_updated

#### gold.inventory_health
Inventory health metrics.

| Column | Type | Description |
|--------|------|-------------|
| inventory_health_sk | BIGSERIAL | Surrogate key |
| product_sk | BIGINT | Product surrogate key |
| warehouse_id | VARCHAR(50) | Warehouse identifier |
| current_stock | INTEGER | Current stock level |
| days_of_supply | INTEGER | Days of supply based on sales velocity |
| stockout_frequency | INTEGER | Number of stockouts |
| overstock_flag | BOOLEAN | Overstock indicator |
| reorder_point | INTEGER | Recommended reorder point |
| safety_stock | INTEGER | Safety stock level |
| snapshot_date | DATE | Snapshot date |
| last_updated | TIMESTAMP | Last update timestamp |

**Indexes**: 
- Primary key on inventory_health_sk
- Unique index on (product_sk, warehouse_id, snapshot_date)
- Index on overstock_flag
- Index on snapshot_date

#### gold.conversion_funnel
Conversion funnel metrics.

| Column | Type | Description |
|--------|------|-------------|
| funnel_sk | BIGSERIAL | Surrogate key |
| date_key | DATE | Date |
| channel | VARCHAR(100) | Marketing channel |
| visitors | INTEGER | Unique visitors |
| page_views | INTEGER | Page views |
| add_to_carts | INTEGER | Add to cart events |
| checkouts | INTEGER | Checkout events |
| purchases | INTEGER | Completed purchases |
| conversion_rate | DECIMAL(5,4) | Overall conversion rate |
| cart_abandonment_rate | DECIMAL(5,4) | Cart abandonment rate |
| last_updated | TIMESTAMP | Last update timestamp |

**Indexes**: 
- Primary key on funnel_sk
- Unique index on (date_key, channel)
- Index on date_key

#### gold.cohort_analysis
Customer cohort analysis.

| Column | Type | Description |
|--------|------|-------------|
| cohort_sk | BIGSERIAL | Surrogate key |
| cohort_month | DATE | Cohort month (first purchase month) |
| period_number | INTEGER | Period number (months since cohort) |
| customers | INTEGER | Customers in cohort |
| active_customers | INTEGER | Active customers in period |
| retention_rate | DECIMAL(5,4) | Retention rate |
| revenue | DECIMAL(15,2) | Revenue from cohort in period |
| cumulative_revenue | DECIMAL(15,2) | Cumulative revenue |
| last_updated | TIMESTAMP | Last update timestamp |

**Indexes**: 
- Primary key on cohort_sk
- Unique index on (cohort_month, period_number)
- Index on cohort_month

#### gold.real_time_dashboard
Real-time dashboard metrics (updated hourly).

| Column | Type | Description |
|--------|------|-------------|
| dashboard_sk | BIGSERIAL | Surrogate key |
| metric_date | DATE | Date |
| metric_hour | INTEGER | Hour (0-23) |
| orders_today | INTEGER | Orders today |
| revenue_today | DECIMAL(15,2) | Revenue today |
| active_users | INTEGER | Active users (current hour) |
| cart_abandonment_rate | DECIMAL(5,4) | Cart abandonment rate |
| top_product_sk | BIGINT | Top product (current hour) |
| last_updated | TIMESTAMP | Last update timestamp |

**Indexes**: 
- Primary key on dashboard_sk
- Unique index on (metric_date, metric_hour)
- Index on metric_date

## Entity Relationship Diagram (ERD)

### Bronze Layer
```
[raw_orders]    [raw_customers]    [raw_products]
     │                 │                  │
     │                 │                  │
     └─────────────────┴──────────────────┘
                       │
                  [raw_order_items]
```

### Silver Layer
```
[customers] ──┐
              │
[products] ───┼──→ [orders] ──→ [order_items]
              │
[inventory_snapshots] ──→ [products]
              │
[user_events] │
              │
[product_reviews] ───→ [products]
              │
              └──→ [customers]
```

### Gold Layer
```
[daily_sales_summary] ← Aggregated from [orders]
[customer_360] ← Aggregated from [customers] + [orders]
[product_performance] ← Aggregated from [products] + [orders] + [reviews]
[inventory_health] ← Aggregated from [inventory_snapshots]
[conversion_funnel] ← Aggregated from [user_events]
[cohort_analysis] ← Aggregated from [customers] + [orders]
[real_time_dashboard] ← Real-time aggregations
```

## Partitioning Strategy

### Time-Based Partitioning
- **bronze.raw_orders**: Monthly partitions on `order_date`
- **bronze.raw_inventory**: Monthly partitions on `movement_date`
- **bronze.raw_clickstream**: Daily partitions on `event_timestamp`
- **silver.orders**: Monthly partitions on `order_date`
- **silver.inventory_snapshots**: Monthly partitions on `snapshot_date`
- **silver.user_events**: Daily partitions on `event_timestamp`

### Benefits
- Improved query performance (partition pruning)
- Easier data archival
- Faster maintenance operations (VACUUM, ANALYZE)

## Indexing Strategy

### Primary Indexes
- All tables have primary keys (surrogate keys where applicable)

### Foreign Key Indexes
- All foreign keys are indexed for join performance

### Composite Indexes
- (product_id, valid_to) for SCD Type 2 current record lookups
- (customer_id, valid_to) for SCD Type 2 current record lookups
- (product_sk, warehouse_id, snapshot_date) for inventory snapshots

### Filtered Indexes
- Partial indexes on `is_current = true` for dimension tables

### JSONB Indexes
- GIN indexes on JSONB columns for efficient JSON queries

### Date Indexes
- Indexes on all date columns used in WHERE clauses
- Indexes on date columns used in partitioning keys

## Data Dictionary

A comprehensive data dictionary will be maintained separately with:
- Detailed column descriptions
- Data types and constraints
- Sample values
- Business rules
- Data quality rules
- Update frequencies


