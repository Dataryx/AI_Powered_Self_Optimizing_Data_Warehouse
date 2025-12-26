# Schema Naming Updates

## Summary

All database schemas and table columns have been updated to follow consistent naming conventions. This document summarizes the changes made.

## Changes Made

### 1. Bronze Layer - raw_products
**Changed:**
- `name` → `product_name`
- **Reason**: Consistency with Silver layer and clarity

### 2. Bronze Layer - raw_customers
**Changed:**
- `name` → `customer_name`
- **Reason**: Clarity and consistency

### 3. Bronze Layer - raw_sessions
**Changed:**
- `os` → `operating_system`
- **Reason**: Avoid abbreviation, improve clarity
- Added index: `idx_raw_sessions_operating_system`

### 4. Silver Layer - orders
**Fixed:**
- Unique index on `order_id` - Updated comment explaining partition constraint limitation
- **Reason**: PostgreSQL partitioned tables require partition key in unique constraints

## Naming Conventions Applied

All schemas now follow these conventions:

1. **snake_case** for all identifiers
2. **Descriptive names** (e.g., `product_name` not `name`)
3. **Full words** instead of abbreviations (e.g., `operating_system` not `os`)
4. **Consistent patterns** across layers
5. **No reserved words** used as identifiers

## Column Name Patterns

### Identifiers
- `*_id` - Natural identifier (VARCHAR)
- `*_sk` - Surrogate key (BIGSERIAL/BIGINT)

### Names
- `product_name`, `customer_name` - Full names
- `first_name`, `last_name`, `full_name` - Name components

### Dates/Timestamps
- `*_date` - DATE columns
- `*_timestamp` - TIMESTAMP columns
- `created_at`, `updated_at`, `ingestion_timestamp`

### Amounts
- `*_amount`, `*_cost`, `*_price`
- `total_*` for aggregates

### Flags
- `is_*` for boolean flags (e.g., `is_active`, `is_current`)

## Documentation

Complete naming conventions are documented in:
- [docs/architecture/naming-conventions.md](docs/architecture/naming-conventions.md)

## Verification

All schema files have been reviewed and updated to ensure:
- ✅ Consistent naming across all layers
- ✅ No reserved words used
- ✅ Clear and descriptive names
- ✅ Proper abbreviations only where standard
- ✅ Layer-specific conventions followed

## Next Steps

When creating new tables or columns, refer to the naming conventions document to maintain consistency.

