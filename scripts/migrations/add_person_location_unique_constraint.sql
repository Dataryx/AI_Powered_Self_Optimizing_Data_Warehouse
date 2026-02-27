-- Migration: Add Unique Constraint to silver.person_location
-- This prevents duplicate (person_key, location_key) combinations
-- Date: 2024

-- First, remove any existing duplicates before adding the constraint
-- Keep the first record (lowest person_location_key) for each (person_key, location_key) combination
DELETE FROM silver.person_location
WHERE person_location_key NOT IN (
    SELECT MIN(person_location_key)
    FROM silver.person_location
    GROUP BY person_key, location_key
);

-- Add unique constraint to prevent future duplicates
-- Note: If the constraint already exists, this will fail gracefully
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'uk_person_location_unique'
        AND conrelid = 'silver.person_location'::regclass
    ) THEN
        ALTER TABLE silver.person_location 
        ADD CONSTRAINT uk_person_location_unique 
        UNIQUE (person_key, location_key);
        
        RAISE NOTICE 'Unique constraint uk_person_location_unique added successfully';
    ELSE
        RAISE NOTICE 'Unique constraint uk_person_location_unique already exists';
    END IF;
END $$;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_person_location_keys 
ON silver.person_location(person_key, location_key);

-- Log the result
DO $$
DECLARE
    duplicate_count INTEGER;
    total_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_count FROM silver.person_location;
    
    SELECT COUNT(*) INTO duplicate_count
    FROM (
        SELECT person_key, location_key, COUNT(*) as cnt
        FROM silver.person_location
        GROUP BY person_key, location_key
        HAVING COUNT(*) > 1
    ) duplicates;
    
    RAISE NOTICE 'Migration complete. Total records: %, Duplicates remaining: %', total_count, duplicate_count;
END $$;













