# Database Naming Conventions

## Overview

This document defines the naming conventions used throughout the data warehouse schemas to ensure consistency, clarity, and maintainability.

## General Principles

1. **Use snake_case**: All identifiers use lowercase with underscores
2. **Be descriptive**: Column names should clearly indicate their purpose
3. **Be consistent**: Use the same naming pattern across similar entities
4. **Avoid abbreviations**: Except for well-known abbreviations (id, sk, url, etc.)
5. **Avoid reserved words**: Do not use SQL reserved words as identifiers

## Table Naming

### Pattern
- **Bronze Layer**: `raw_<entity_name>` (e.g., `raw_orders`, `raw_products`)
- **Silver Layer**: `<entity_name>` (e.g., `orders`, `products`, `customers`)
- **Gold Layer**: `<entity_name>` (e.g., `daily_sales_summary`, `customer_360`)

### Examples
- ✅ `raw_orders`, `raw_customers`, `raw_products`
- ✅ `orders`, `customers`, `products`
- ✅ `daily_sales_summary`, `customer_360`, `product_performance`
- ❌ `rawOrders`, `RawOrders`, `ORDERS`

## Column Naming

### Primary Keys
- **Surrogate Keys**: `<entity>_sk` (e.g., `order_sk`, `customer_sk`, `product_sk`)
- **Natural Keys**: `<entity>_id` (e.g., `order_id`, `customer_id`, `product_id`)

### Foreign Keys
- Use the same name as the referenced primary key (e.g., `customer_sk` references `silver.customers.customer_sk`)
- If clarity is needed, prefix with table name (e.g., `order_customer_sk`)

### Common Patterns

#### Identifiers
- `*_id` - Natural identifier (VARCHAR)
- `*_sk` - Surrogate key (BIGSERIAL/BIGINT)

#### Names
- `*_name` - Full name (e.g., `product_name`, `customer_name`)
- `first_name` - First name
- `last_name` - Last name
- `full_name` - Concatenated full name

#### Dates and Timestamps
- `*_date` - DATE column (e.g., `order_date`, `registration_date`)
- `*_timestamp` - TIMESTAMP column (e.g., `order_timestamp`, `event_timestamp`)
- `*_time` - TIMESTAMP column (e.g., `start_time`, `end_time`)
- `created_at` - Record creation timestamp
- `updated_at` - Record update timestamp
- `ingestion_timestamp` - Data ingestion timestamp (Bronze layer)
- `valid_from` - SCD Type 2 validity start
- `valid_to` - SCD Type 2 validity end

#### Amounts and Quantities
- `*_amount` - Monetary amount (e.g., `total_amount`, `discount_amount`)
- `*_cost` - Cost value (e.g., `shipping_cost`, `unit_cost`)
- `*_price` - Price value (e.g., `unit_price`, `sale_price`)
- `*_quantity` - Count or quantity (e.g., `quantity`, `quantity_on_hand`)
- `total_*` - Aggregated totals (e.g., `total_revenue`, `total_orders`)

#### Flags and Status
- `is_*` - Boolean flags (e.g., `is_active`, `is_current`, `is_verified`)
- `*_status` - Status value (e.g., `order_status`, `payment_status`)
- `*_flag` - Boolean flags (e.g., `overstock_flag`, `verified_purchase`)

#### Rates and Percentages
- `*_rate` - Rate value (e.g., `conversion_rate`, `return_rate`)
- `*_percentage` - Percentage value (e.g., `discount_percentage`)

#### Address Fields
- `*_country` - Country name
- `*_city` - City name
- `*_state_province` - State or province
- `*_postal_code` - Postal/ZIP code
- `address_line1` - First address line
- `address_line2` - Second address line
- `shipping_*` - Shipping address fields (e.g., `shipping_country`)

#### Device and System Information
- `device_type` - Device type (desktop, mobile, tablet)
- `operating_system` - Operating system name (NOT `os`)
- `browser` - Browser name
- `ip_address` - IP address
- `user_agent` - User agent string

#### JSONB Columns
- `*_address` - Address JSONB (e.g., `shipping_address`, `address`)
- `*_info` - Information JSONB (e.g., `device_info`, `location`)
- `*_attributes` - Attributes JSONB (e.g., `attributes`)
- `raw_data` - Complete raw record JSONB (Bronze layer)

## Index Naming

### Pattern
`idx_<schema>_<table>_<column(s)>`

### Examples
- `idx_raw_orders_order_date`
- `idx_silver_customers_customer_id_valid_to`
- `idx_gold_product_performance_category_rank`

### Special Cases
- Partial indexes: `idx_silver_products_current`
- Composite indexes: `idx_silver_customers_customer_id_valid_to`
- GIN indexes: `idx_raw_products_attributes` (using GIN)

## Constraint Naming

### Foreign Keys
Pattern: `fk_<table>_<referenced_table>`
Example: `fk_orders_customer`, `fk_order_items_product`

### Unique Constraints
Pattern: `uq_<table>_<column(s)>`
Example: `uq_inventory_snapshots_product_warehouse_date`

### Check Constraints
Pattern: `chk_<table>_<column>`
Example: `chk_reviews_rating` (rating >= 1 AND rating <= 5)

## Schema Naming

- `bronze` - Raw, unprocessed data
- `silver` - Cleaned and validated data
- `gold` - Aggregated analytics data
- `ml_optimization` - ML optimization metrics and recommendations
- `etl` - ETL utility schema

## Abbreviations

Standard abbreviations used:
- `sk` - Surrogate Key
- `id` - Identifier
- `url` - Uniform Resource Locator
- `ip` - Internet Protocol (as in `ip_address`)
- `os` - Operating System (avoid, use `operating_system`)
- `jsonb` - JSON Binary (PostgreSQL type, not in column names)
- `fts` - Full Text Search (in index names)

## Reserved Words to Avoid

Do NOT use these SQL reserved words as identifiers:
- `order`, `user`, `group`, `select`, `from`, `where`, `index`, `key`, `primary`, `foreign`, `default`, `null`, `not`, `and`, `or`, `is`, `in`, `like`, `between`, `exists`, `all`, `any`, `some`, `distinct`, `limit`, `offset`, `as`, `union`, `intersect`, `except`, `join`, `inner`, `outer`, `left`, `right`, `full`, `on`, `using`, `natural`, `cross`

If you must reference a concept that is a reserved word, use a prefix or suffix:
- ✅ `order_sk`, `order_id`, `order_date` (instead of just `order`)
- ✅ `user_id`, `user_name` (instead of just `user`)

## Examples of Good Naming

### ✅ Good Examples
```sql
-- Clear and descriptive
customer_sk, customer_id, customer_name
order_date, order_timestamp, order_status
total_amount, discount_amount, tax_amount
is_active, is_current, is_verified
shipping_country, shipping_city, shipping_postal_code
device_type, operating_system, browser
created_at, updated_at, ingestion_timestamp
valid_from, valid_to
```

### ❌ Bad Examples
```sql
-- Too generic
id, name, date, amount

-- Abbreviations
cust_sk, ord_id, prod_name, os

-- Reserved words
order, user, group, index

-- Inconsistent casing
CustomerID, order_date, ProductName

-- Missing context
date (should be order_date)
name (should be product_name or customer_name)
```

## Layer-Specific Conventions

### Bronze Layer
- Prefix tables with `raw_`
- Include `source_system` column
- Include `ingestion_timestamp` column
- Include `raw_data` JSONB column for audit

### Silver Layer
- No table prefix
- Use surrogate keys (`*_sk`)
- Include `created_at` and `updated_at`
- SCD Type 2 dimensions: `valid_from`, `valid_to`, `is_current`

### Gold Layer
- No table prefix
- Use `date_key` for date columns
- Use `last_updated` instead of `updated_at`
- Pre-aggregated metrics with descriptive names

## Consistency Checklist

When creating new tables or columns, ensure:
- [ ] Uses snake_case
- [ ] No reserved words
- [ ] Consistent with similar entities
- [ ] Clear and descriptive
- [ ] Follows layer-specific conventions
- [ ] Proper foreign key naming
- [ ] Proper index naming

