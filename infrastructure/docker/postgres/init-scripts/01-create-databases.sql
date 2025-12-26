-- Create databases for data warehouse and Airflow
-- This script runs automatically when the PostgreSQL container is first initialized

-- Create Airflow database
CREATE DATABASE airflow;

-- Ensure databases are created
SELECT 'Databases created successfully' AS status;


