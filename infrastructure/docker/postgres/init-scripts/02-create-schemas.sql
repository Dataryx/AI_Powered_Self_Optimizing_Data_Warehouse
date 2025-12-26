-- Create schemas for medallion architecture
-- This script creates the Bronze, Silver, and Gold schemas

-- Bronze Schema: Raw, unprocessed data
CREATE SCHEMA IF NOT EXISTS bronze;
COMMENT ON SCHEMA bronze IS 'Bronze layer: Raw, unprocessed data from source systems';

-- Silver Schema: Cleaned and validated data
CREATE SCHEMA IF NOT EXISTS silver;
COMMENT ON SCHEMA silver IS 'Silver layer: Cleaned, validated, and conformed data';

-- Gold Schema: Aggregated and analytics-ready data
CREATE SCHEMA IF NOT EXISTS gold;
COMMENT ON SCHEMA gold IS 'Gold layer: Business-ready aggregated and analytics tables';

-- Utility schema for ETL operations
CREATE SCHEMA IF NOT EXISTS etl;
COMMENT ON SCHEMA etl IS 'ETL utility schema for staging and processing';

-- ML Optimization schema for metrics and recommendations
CREATE SCHEMA IF NOT EXISTS ml_optimization;
COMMENT ON SCHEMA ml_optimization IS 'ML optimization metrics, query logs, and recommendations';

-- Grant privileges
GRANT ALL PRIVILEGES ON SCHEMA bronze TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA silver TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA gold TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA etl TO postgres;
GRANT ALL PRIVILEGES ON SCHEMA ml_optimization TO postgres;

SELECT 'Schemas created successfully' AS status;


