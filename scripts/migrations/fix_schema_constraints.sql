-- Fix schema constraints to match ETL requirements
-- This ensures Silver and Gold layer schemas are correct for ETL processing

-- ============================================================================
-- SILVER LAYER FIXES
-- ============================================================================

-- 1. Fix silver.customer.person_key to be NOT NULL (already in schema file, but ensure DB matches)
DO $$
BEGIN
    -- Check if column is nullable
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'silver' 
        AND table_name = 'customer' 
        AND column_name = 'person_key'
        AND is_nullable = 'YES'
    ) THEN
        -- Only alter if there are no NULL values
        IF NOT EXISTS (SELECT 1 FROM silver.customer WHERE person_key IS NULL) THEN
            ALTER TABLE silver.customer ALTER COLUMN person_key SET NOT NULL;
            RAISE NOTICE 'Fixed: silver.customer.person_key is now NOT NULL';
        ELSE
            RAISE WARNING 'Cannot set NOT NULL: silver.customer has NULL person_key values';
        END IF;
    ELSE
        RAISE NOTICE 'silver.customer.person_key is already NOT NULL';
    END IF;
END $$;

-- 2. Verify silver.employee.start_date is NOT NULL (should already be)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'silver' 
        AND table_name = 'employee' 
        AND column_name = 'start_date'
        AND is_nullable = 'YES'
    ) THEN
        IF NOT EXISTS (SELECT 1 FROM silver.employee WHERE start_date IS NULL) THEN
            ALTER TABLE silver.employee ALTER COLUMN start_date SET NOT NULL;
            RAISE NOTICE 'Fixed: silver.employee.start_date is now NOT NULL';
        ELSE
            RAISE WARNING 'Cannot set NOT NULL: silver.employee has NULL start_date values';
        END IF;
    ELSE
        RAISE NOTICE 'silver.employee.start_date is already NOT NULL';
    END IF;
END $$;

-- 3. Verify silver.orders.order_date is NOT NULL (should already be)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'silver' 
        AND table_name = 'orders' 
        AND column_name = 'order_date'
        AND is_nullable = 'YES'
    ) THEN
        IF NOT EXISTS (SELECT 1 FROM silver.orders WHERE order_date IS NULL) THEN
            ALTER TABLE silver.orders ALTER COLUMN order_date SET NOT NULL;
            RAISE NOTICE 'Fixed: silver.orders.order_date is now NOT NULL';
        ELSE
            RAISE WARNING 'Cannot set NOT NULL: silver.orders has NULL order_date values';
        END IF;
    ELSE
        RAISE NOTICE 'silver.orders.order_date is already NOT NULL';
    END IF;
END $$;

-- 4. Verify silver.orders.order_status is NOT NULL (should already be)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'silver' 
        AND table_name = 'orders' 
        AND column_name = 'order_status'
        AND is_nullable = 'YES'
    ) THEN
        IF NOT EXISTS (SELECT 1 FROM silver.orders WHERE order_status IS NULL) THEN
            ALTER TABLE silver.orders ALTER COLUMN order_status SET NOT NULL;
            RAISE NOTICE 'Fixed: silver.orders.order_status is now NOT NULL';
        ELSE
            RAISE WARNING 'Cannot set NOT NULL: silver.orders has NULL order_status values';
        END IF;
    ELSE
        RAISE NOTICE 'silver.orders.order_status is already NOT NULL';
    END IF;
END $$;

-- 5. Verify silver.order_item.unit_price is NOT NULL (should already be)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'silver' 
        AND table_name = 'order_item' 
        AND column_name = 'unit_price'
        AND is_nullable = 'YES'
    ) THEN
        IF NOT EXISTS (SELECT 1 FROM silver.order_item WHERE unit_price IS NULL) THEN
            ALTER TABLE silver.order_item ALTER COLUMN unit_price SET NOT NULL;
            RAISE NOTICE 'Fixed: silver.order_item.unit_price is now NOT NULL';
        ELSE
            RAISE WARNING 'Cannot set NOT NULL: silver.order_item has NULL unit_price values';
        END IF;
    ELSE
        RAISE NOTICE 'silver.order_item.unit_price is already NOT NULL';
    END IF;
END $$;

-- 6. Verify silver.order_item.quantity is NOT NULL (should already be)
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'silver' 
        AND table_name = 'order_item' 
        AND column_name = 'quantity'
        AND is_nullable = 'YES'
    ) THEN
        IF NOT EXISTS (SELECT 1 FROM silver.order_item WHERE quantity IS NULL) THEN
            ALTER TABLE silver.order_item ALTER COLUMN quantity SET NOT NULL;
            RAISE NOTICE 'Fixed: silver.order_item.quantity is now NOT NULL';
        ELSE
            RAISE WARNING 'Cannot set NOT NULL: silver.order_item has NULL quantity values';
        END IF;
    ELSE
        RAISE NOTICE 'silver.order_item.quantity is already NOT NULL';
    END IF;
END $$;

-- ============================================================================
-- VERIFY CONSTRAINTS
-- ============================================================================

-- Show current NOT NULL constraints for critical columns
SELECT 
    table_schema,
    table_name,
    column_name,
    is_nullable,
    data_type
FROM information_schema.columns
WHERE table_schema IN ('silver', 'gold')
    AND table_name IN ('customer', 'employee', 'orders', 'order_item')
    AND column_name IN ('person_key', 'start_date', 'order_date', 'order_status', 'unit_price', 'quantity')
ORDER BY table_schema, table_name, column_name;









