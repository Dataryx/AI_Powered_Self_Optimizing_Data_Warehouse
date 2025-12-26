-- Create PostgreSQL extensions
-- This script installs necessary extensions for the data warehouse

-- UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- JSON/JSONB operations
CREATE EXTENSION IF NOT EXISTS "btree_gin";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- Statistics and monitoring
CREATE EXTENSION IF NOT EXISTS "pg_stat_statements";
COMMENT ON EXTENSION pg_stat_statements IS 'Track execution statistics of all SQL statements';

-- Advanced indexing (if available)
-- CREATE EXTENSION IF NOT EXISTS "pg_trgm"; -- Trigram matching for text search
-- CREATE EXTENSION IF NOT EXISTS "btree_gin"; -- GIN indexes for btree
-- CREATE EXTENSION IF NOT EXISTS "btree_gist"; -- GiST indexes for btree

SELECT 'Extensions created successfully' AS status;


