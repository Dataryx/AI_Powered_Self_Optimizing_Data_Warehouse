-- Fix: Make person_key NOT NULL in silver.customer
-- This matches the ETL logic which requires person_key for all customers

-- First, check if there are any NULL values
SELECT COUNT(*) as null_count
FROM silver.customer
WHERE person_key IS NULL;

-- If null_count > 0, you need to fix the data first
-- Otherwise, apply the constraint:

ALTER TABLE silver.customer 
ALTER COLUMN person_key SET NOT NULL;

-- Verify the change
SELECT 
    column_name, 
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_schema = 'silver' 
    AND table_name = 'customer' 
    AND column_name = 'person_key';
