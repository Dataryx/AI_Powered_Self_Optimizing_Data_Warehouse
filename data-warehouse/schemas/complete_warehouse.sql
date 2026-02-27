-- ============================================================================
-- DATA WAREHOUSE - Bronze, Silver, and Gold Layers
-- PostgreSQL Version (Converted from SQL Server)
-- ============================================================================
-- This script creates a complete data warehouse with:
--   - Bronze Layer: Raw data from source systems (1:1 copy)
--   - Silver Layer: Cleaned, validated, and standardized data
--   - Gold Layer: Business-level aggregates (Star Schema for Analytics)
-- ============================================================================

-- ============================================================================
-- CREATE SCHEMAS
-- ============================================================================

CREATE SCHEMA IF NOT EXISTS bronze;
CREATE SCHEMA IF NOT EXISTS silver;
CREATE SCHEMA IF NOT EXISTS gold;

-- ============================================================================
-- ============================================================================
-- BRONZE LAYER - Raw Source Data (Staging Area)
-- ============================================================================
-- Purpose: Store raw data exactly as received from source systems
-- Characteristics:
--   - No transformations applied
--   - Includes metadata columns for auditing
--   - Preserves data types from source
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Reference/Lookup Tables
-- ----------------------------------------------------------------------------

CREATE TABLE bronze.country (
    country_id INT,
    country_name VARCHAR(50),
    country_code VARCHAR(3),
    nat_lang_code INT,
    currency_code VARCHAR(10),
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

CREATE TABLE bronze.location (
    location_id INT,
    country_id INT,
    address_line_1 VARCHAR(100),
    address_line_2 VARCHAR(100),
    city VARCHAR(50),
    state VARCHAR(50),
    district VARCHAR(50),
    postal_code VARCHAR(20),
    location_type_code INT,
    description VARCHAR(256),
    shipping_notes VARCHAR(512),
    countries_country_id INT,
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

CREATE TABLE bronze.warehouse (
    warehouse_id INT,
    location_id INT,
    warehouse_name VARCHAR(100),
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

-- ----------------------------------------------------------------------------
-- Product & Inventory Tables
-- ----------------------------------------------------------------------------

CREATE TABLE bronze.product (
    product_id INT,
    product_name VARCHAR(100),
    description TEXT,
    category INT,
    weight_class INT,
    warranty_period INT,
    supplier_id INT,
    status VARCHAR(20),
    list_price DECIMAL(12,2),
    minimum_price DECIMAL(12,2),
    price_currency VARCHAR(5),
    catalog_url VARCHAR(256),
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

CREATE TABLE bronze.inventory (
    inventory_id INT,
    product_id INT,
    warehouse_id INT,
    quantity_on_hand INT,
    quantity_available INT,
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

-- ----------------------------------------------------------------------------
-- Person & Contact Tables
-- ----------------------------------------------------------------------------

CREATE TABLE bronze.person (
    person_id INT,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    middle_names VARCHAR(100),
    nickname VARCHAR(50),
    nat_lang_code INT,
    culture_code INT,
    gender VARCHAR(20),
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

CREATE TABLE bronze.restricted_info (
    person_id INT,
    date_of_birth DATE,
    date_of_death DATE,
    government_id VARCHAR(50),
    passport_id VARCHAR(50),
    hire_date DATE,
    seniority_code INT,
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

CREATE TABLE bronze.person_location (
    persons_person_id INT,
    locations_location_id INT,
    sub_address VARCHAR(100),
    location_usage VARCHAR(50),
    notes TEXT,
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

CREATE TABLE bronze.phone_number (
    phone_number_id INT,
    persons_person_id INT,
    locations_location_id INT,
    phone_number VARCHAR(20),
    country_code VARCHAR(5),
    phone_type_id INT,
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

-- ----------------------------------------------------------------------------
-- Customer Tables
-- ----------------------------------------------------------------------------

CREATE TABLE bronze.customer_company (
    company_id INT,
    company_name VARCHAR(100),
    company_credit_limit DECIMAL(15,2),
    credit_limit_currency VARCHAR(5),
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

CREATE TABLE bronze.customer_employee (
    customer_employee_id INT,
    company_id INT,
    badge_number VARCHAR(30),
    job_title VARCHAR(100),
    department VARCHAR(100),
    credit_limit DECIMAL(12,2),
    credit_limit_currency VARCHAR(5),
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

CREATE TABLE bronze.customer (
    customer_id INT,
    person_id INT,
    customer_employee_id INT,
    accountmgr_id INT,
    income_level INT,
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

-- ----------------------------------------------------------------------------
-- Employment Tables
-- ----------------------------------------------------------------------------

CREATE TABLE bronze.employment_jobs (
    hr_job_id INT,
    countries_country_id INT,
    job_title VARCHAR(100),
    min_salary DECIMAL(12,2),
    max_salary DECIMAL(12,2),
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

CREATE TABLE bronze.employment (
    employee_id INT,
    person_id INT,
    hr_job_id INT,
    manager_employee_id INT,
    start_date DATE,
    end_date DATE,
    salary DECIMAL(12,2),
    commission_percent DECIMAL(5,2),
    employment_status VARCHAR(20),
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

-- ----------------------------------------------------------------------------
-- Order Tables
-- ----------------------------------------------------------------------------

CREATE TABLE bronze.orders (
    order_id INT,
    customer_id INT,
    sales_rep_id INT,
    order_date DATE,
    order_code VARCHAR(20),
    order_status VARCHAR(20),
    order_total DECIMAL(15,2),
    order_currency VARCHAR(5),
    promotion_code VARCHAR(50),
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

CREATE TABLE bronze.order_item (
    order_item_id INT,
    order_id INT,
    product_id INT,
    unit_price DECIMAL(12,2),
    quantity DECIMAL(10,2),
    -- Metadata columns
    _source_system VARCHAR(50) DEFAULT 'OLTP',
    _load_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    _batch_id INT
);

-- ============================================================================
-- ============================================================================
-- SILVER LAYER - Cleaned & Standardized Data
-- ============================================================================
-- Purpose: Apply data quality rules, standardization, and business logic
-- Characteristics:
--   - Data type enforcement and validation
--   - Null handling and default values
--   - Standardized naming conventions
--   - Primary and foreign key constraints
--   - Surrogate keys for SCD support
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Reference/Lookup Tables
-- ----------------------------------------------------------------------------

CREATE TABLE silver.country (
    country_key BIGSERIAL PRIMARY KEY,
    country_id INT NOT NULL UNIQUE,
    country_name VARCHAR(50) NOT NULL,
    country_code CHAR(3) NOT NULL,
    national_language_code INT,
    currency_code VARCHAR(10),
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59',
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE silver.location (
    location_key BIGSERIAL PRIMARY KEY,
    location_id INT NOT NULL UNIQUE,
    country_key BIGINT,
    address_line_1 VARCHAR(100),
    address_line_2 VARCHAR(100),
    city VARCHAR(50),
    state_province VARCHAR(50),
    district VARCHAR(50),
    postal_code VARCHAR(20),
    location_type VARCHAR(50),
    description VARCHAR(256),
    shipping_notes VARCHAR(512),
    full_address TEXT, -- Computed during ETL
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59',
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_silver_location_country FOREIGN KEY (country_key) REFERENCES silver.country(country_key)
);

CREATE TABLE silver.warehouse (
    warehouse_key BIGSERIAL PRIMARY KEY,
    warehouse_id INT NOT NULL UNIQUE,
    location_key BIGINT,
    warehouse_name VARCHAR(100) NOT NULL,
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59',
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_silver_warehouse_location FOREIGN KEY (location_key) REFERENCES silver.location(location_key)
);

-- ----------------------------------------------------------------------------
-- Product & Inventory Tables
-- ----------------------------------------------------------------------------

CREATE TABLE silver.product (
    product_key BIGSERIAL PRIMARY KEY,
    product_id INT NOT NULL UNIQUE,
    product_name VARCHAR(100) NOT NULL,
    description TEXT,
    category_id INT,
    category_name VARCHAR(50),
    weight_class INT,
    weight_class_description VARCHAR(50),
    warranty_period_months INT,
    supplier_id INT,
    product_status VARCHAR(20) NOT NULL DEFAULT 'Active',
    list_price DECIMAL(12,2),
    minimum_price DECIMAL(12,2),
    price_currency CHAR(3) DEFAULT 'USD',
    catalog_url VARCHAR(256),
    profit_margin DECIMAL(12,2) GENERATED ALWAYS AS (list_price - minimum_price) STORED,
    profit_margin_pct DECIMAL(5,2) GENERATED ALWAYS AS (
        CASE WHEN list_price > 0 THEN ((list_price - minimum_price) / list_price) * 100 ELSE 0 END
    ) STORED,
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59',
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE silver.inventory (
    inventory_key BIGSERIAL PRIMARY KEY,
    inventory_id INT NOT NULL UNIQUE,
    product_key BIGINT NOT NULL,
    warehouse_key BIGINT NOT NULL,
    quantity_on_hand INT DEFAULT 0,
    quantity_available INT DEFAULT 0,
    quantity_reserved INT GENERATED ALWAYS AS (quantity_on_hand - quantity_available) STORED,
    last_stock_date DATE,
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_silver_inventory_product FOREIGN KEY (product_key) REFERENCES silver.product(product_key),
    CONSTRAINT fk_silver_inventory_warehouse FOREIGN KEY (warehouse_key) REFERENCES silver.warehouse(warehouse_key)
);

-- ----------------------------------------------------------------------------
-- Person & Contact Tables
-- ----------------------------------------------------------------------------

CREATE TABLE silver.person (
    person_key BIGSERIAL PRIMARY KEY,
    person_id INT NOT NULL UNIQUE,
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    middle_names VARCHAR(100),
    nickname VARCHAR(50),
    full_name VARCHAR(200), -- Computed during ETL
    display_name VARCHAR(150), -- Computed during ETL
    national_language_code INT,
    culture_code INT,
    gender VARCHAR(20),
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59',
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE silver.restricted_info (
    restricted_info_key BIGSERIAL PRIMARY KEY,
    person_key BIGINT NOT NULL UNIQUE,
    date_of_birth DATE,
    date_of_death DATE,
    age INT, -- Calculated during ETL
    is_deceased BOOLEAN GENERATED ALWAYS AS (date_of_death IS NOT NULL) STORED,
    government_id_hash BYTEA, -- Hashed for security
    passport_id_hash BYTEA,   -- Hashed for security
    hire_date DATE,
    years_of_service INT, -- Calculated during ETL
    seniority_code INT,
    seniority_level VARCHAR(20),
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_silver_restricted_person FOREIGN KEY (person_key) REFERENCES silver.person(person_key)
);

CREATE TABLE silver.person_location (
    person_location_key BIGSERIAL PRIMARY KEY,
    person_key BIGINT NOT NULL,
    location_key BIGINT NOT NULL,
    sub_address VARCHAR(100),
    location_usage VARCHAR(50),
    location_usage_type VARCHAR(20), -- HOME, WORK, SHIPPING, BILLING
    notes TEXT,
    is_primary BOOLEAN DEFAULT FALSE,
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59',
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_silver_personloc_person FOREIGN KEY (person_key) REFERENCES silver.person(person_key),
    CONSTRAINT fk_silver_personloc_location FOREIGN KEY (location_key) REFERENCES silver.location(location_key),
    CONSTRAINT uk_person_location_unique UNIQUE (person_key, location_key)
);

CREATE TABLE silver.phone_number (
    phone_key BIGSERIAL PRIMARY KEY,
    phone_id INT NOT NULL UNIQUE,
    person_key BIGINT,
    location_key BIGINT,
    phone_number VARCHAR(20),
    country_code VARCHAR(5),
    full_phone_number VARCHAR(30), -- Computed during ETL
    phone_type VARCHAR(20), -- MOBILE, HOME, WORK, FAX
    is_primary BOOLEAN DEFAULT FALSE,
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59',
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_silver_phone_person FOREIGN KEY (person_key) REFERENCES silver.person(person_key),
    CONSTRAINT fk_silver_phone_location FOREIGN KEY (location_key) REFERENCES silver.location(location_key)
);

-- ----------------------------------------------------------------------------
-- Customer Tables
-- ----------------------------------------------------------------------------

CREATE TABLE silver.customer_company (
    company_key BIGSERIAL PRIMARY KEY,
    company_id INT NOT NULL UNIQUE,
    company_name VARCHAR(100) NOT NULL,
    credit_limit DECIMAL(15,2),
    credit_limit_currency CHAR(3) DEFAULT 'USD',
    credit_tier VARCHAR(20), -- PLATINUM, GOLD, SILVER, BRONZE
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59',
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE silver.customer_employee (
    customer_employee_key BIGSERIAL PRIMARY KEY,
    customer_employee_id INT NOT NULL UNIQUE,
    company_key BIGINT,
    badge_number VARCHAR(30),
    job_title VARCHAR(100),
    department VARCHAR(100),
    credit_limit DECIMAL(12,2),
    credit_limit_currency CHAR(3) DEFAULT 'USD',
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59',
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_silver_custemp_company FOREIGN KEY (company_key) REFERENCES silver.customer_company(company_key)
);

CREATE TABLE silver.customer (
    customer_key BIGSERIAL PRIMARY KEY,
    customer_id INT NOT NULL UNIQUE,
    person_key BIGINT NOT NULL,
    customer_employee_key BIGINT,
    account_manager_id INT,
    income_level INT,
    income_bracket VARCHAR(30), -- LOW, MEDIUM, HIGH, PREMIUM
    customer_type VARCHAR(20), -- INDIVIDUAL, CORPORATE
    customer_since DATE,
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59',
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_silver_customer_person FOREIGN KEY (person_key) REFERENCES silver.person(person_key),
    CONSTRAINT fk_silver_customer_employee FOREIGN KEY (customer_employee_key) REFERENCES silver.customer_employee(customer_employee_key)
);

-- ----------------------------------------------------------------------------
-- Employment Tables
-- ----------------------------------------------------------------------------

CREATE TABLE silver.employment_jobs (
    job_key BIGSERIAL PRIMARY KEY,
    hr_job_id INT NOT NULL UNIQUE,
    country_key BIGINT,
    job_title VARCHAR(100) NOT NULL,
    min_salary DECIMAL(12,2),
    max_salary DECIMAL(12,2),
    salary_range DECIMAL(12,2) GENERATED ALWAYS AS (max_salary - min_salary) STORED,
    mid_point_salary DECIMAL(12,2) GENERATED ALWAYS AS ((min_salary + max_salary) / 2) STORED,
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59',
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_silver_jobs_country FOREIGN KEY (country_key) REFERENCES silver.country(country_key)
);

CREATE TABLE silver.employee (
    employee_key BIGSERIAL PRIMARY KEY,
    employee_id INT NOT NULL UNIQUE,
    person_key BIGINT NOT NULL,
    job_key BIGINT,
    manager_employee_key BIGINT,
    start_date DATE NOT NULL,
    end_date DATE,
    tenure_days INT, -- Calculated during ETL
    tenure_years INT, -- Calculated during ETL
    is_active BOOLEAN, -- Calculated during ETL (TRUE if end_date IS NULL OR end_date > CURRENT_DATE)
    salary DECIMAL(12,2),
    commission_percent DECIMAL(5,2),
    total_compensation DECIMAL(15,2) GENERATED ALWAYS AS (
        salary * (1 + COALESCE(commission_percent, 0) / 100)
    ) STORED,
    employment_status VARCHAR(20), -- ACTIVE, TERMINATED, ON_LEAVE
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    valid_from TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    valid_to TIMESTAMP DEFAULT '9999-12-31 23:59:59',
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_silver_employee_person FOREIGN KEY (person_key) REFERENCES silver.person(person_key),
    CONSTRAINT fk_silver_employee_job FOREIGN KEY (job_key) REFERENCES silver.employment_jobs(job_key),
    CONSTRAINT fk_silver_employee_manager FOREIGN KEY (manager_employee_key) REFERENCES silver.employee(employee_key)
);

-- ----------------------------------------------------------------------------
-- Order Tables
-- ----------------------------------------------------------------------------

CREATE TABLE silver.orders (
    order_key BIGSERIAL PRIMARY KEY,
    order_id INT NOT NULL UNIQUE,
    customer_key BIGINT NOT NULL,
    sales_rep_key BIGINT,
    order_date DATE NOT NULL,
    order_code VARCHAR(20),
    order_status VARCHAR(20) NOT NULL,
    order_status_category VARCHAR(20), -- PENDING, PROCESSING, COMPLETED, CANCELLED
    order_total DECIMAL(15,2),
    order_currency CHAR(3) DEFAULT 'USD',
    promotion_code VARCHAR(50),
    has_promotion BOOLEAN GENERATED ALWAYS AS (
        CASE WHEN promotion_code IS NOT NULL AND promotion_code <> '' THEN TRUE ELSE FALSE END
    ) STORED,
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_silver_orders_customer FOREIGN KEY (customer_key) REFERENCES silver.customer(customer_key),
    CONSTRAINT fk_silver_orders_salesrep FOREIGN KEY (sales_rep_key) REFERENCES silver.employee(employee_key)
);

CREATE TABLE silver.order_item (
    order_item_key BIGSERIAL PRIMARY KEY,
    order_item_id INT NOT NULL UNIQUE,
    order_key BIGINT NOT NULL,
    product_key BIGINT NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    quantity DECIMAL(10,2) NOT NULL,
    line_total DECIMAL(15,2) GENERATED ALWAYS AS (unit_price * quantity) STORED,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    net_amount DECIMAL(15,2) GENERATED ALWAYS AS (
        unit_price * quantity - COALESCE(discount_amount, 0)
    ) STORED,
    -- Data quality columns
    is_valid BOOLEAN DEFAULT TRUE,
    _etl_timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_silver_orderitem_order FOREIGN KEY (order_key) REFERENCES silver.orders(order_key),
    CONSTRAINT fk_silver_orderitem_product FOREIGN KEY (product_key) REFERENCES silver.product(product_key)
);

-- Create indexes for Silver Layer
CREATE INDEX idx_silver_location_country ON silver.location(country_key);
CREATE INDEX idx_silver_warehouse_location ON silver.warehouse(location_key);
CREATE INDEX idx_silver_inventory_product ON silver.inventory(product_key);
CREATE INDEX idx_silver_inventory_warehouse ON silver.inventory(warehouse_key);
CREATE INDEX idx_silver_person_name ON silver.person(last_name, first_name);
CREATE INDEX idx_silver_customer_person ON silver.customer(person_key);
CREATE INDEX idx_silver_employee_person ON silver.employee(person_key);
CREATE INDEX idx_silver_orders_customer ON silver.orders(customer_key);
CREATE INDEX idx_silver_orders_date ON silver.orders(order_date);
CREATE INDEX idx_silver_orderitem_order ON silver.order_item(order_key);
CREATE INDEX idx_silver_orderitem_product ON silver.order_item(product_key);


-- ============================================================================
-- GOLD LAYER - Business Analytics (Star Schema)
-- See gold_layer_complete.sql for full Gold layer implementation
-- ============================================================================

-- Note: Gold layer tables will be created by running the complete_warehouse.sql script
-- which combines both this file and gold_layer_complete.sql



-- ============================================================================
-- GOLD LAYER - Business Analytics (Star Schema)
-- ============================================================================
-- Purpose: Provide denormalized, aggregated data optimized for analytics
-- Characteristics:
--   - Star schema design (Facts + Dimensions)
--   - Pre-calculated metrics and KPIs
--   - Aggregated tables for common queries
--   - Optimized for reporting and BI tools
-- ============================================================================

-- ----------------------------------------------------------------------------
-- DIMENSION TABLES
-- ----------------------------------------------------------------------------

-- Date Dimension (essential for any data warehouse)
CREATE TABLE gold.dim_date (
    date_key INT PRIMARY KEY,  -- YYYYMMDD format
    full_date DATE NOT NULL UNIQUE,
    day_of_week SMALLINT NOT NULL,
    day_name VARCHAR(10) NOT NULL,
    day_of_month SMALLINT NOT NULL,
    day_of_year SMALLINT NOT NULL,
    week_of_year SMALLINT NOT NULL,
    month_number SMALLINT NOT NULL,
    month_name VARCHAR(10) NOT NULL,
    month_short_name CHAR(3) NOT NULL,
    quarter_number SMALLINT NOT NULL,
    quarter_name VARCHAR(10) NOT NULL,
    year_number SMALLINT NOT NULL,
    is_weekend BOOLEAN NOT NULL,
    is_holiday BOOLEAN DEFAULT FALSE,
    holiday_name VARCHAR(50),
    fiscal_year SMALLINT,
    fiscal_quarter SMALLINT,
    fiscal_month SMALLINT
);

-- Customer Dimension
CREATE TABLE gold.dim_customer (
    customer_key BIGINT PRIMARY KEY,
    customer_id INT NOT NULL,
    -- Person details
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    full_name VARCHAR(150),
    gender VARCHAR(20),
    -- Company details (for corporate customers)
    company_name VARCHAR(100),
    company_credit_limit DECIMAL(15,2),
    -- Customer attributes
    customer_type VARCHAR(20),
    income_level INT,
    income_bracket VARCHAR(30),
    -- Account manager
    account_manager_id INT,
    account_manager_name VARCHAR(150),
    -- Location details
    city VARCHAR(50),
    state_province VARCHAR(50),
    country_name VARCHAR(50),
    postal_code VARCHAR(20),
    -- Derived attributes
    customer_segment VARCHAR(50),
    lifetime_value_tier VARCHAR(20),
    -- SCD Type 2 columns
    is_current BOOLEAN DEFAULT TRUE,
    effective_date DATE,
    expiration_date DATE DEFAULT '9999-12-31'
);

-- Product Dimension
CREATE TABLE gold.dim_product (
    product_key BIGINT PRIMARY KEY,
    product_id INT NOT NULL,
    product_name VARCHAR(100) NOT NULL,
    description TEXT,
    -- Category hierarchy
    category_id INT,
    category_name VARCHAR(50),
    -- Product attributes
    weight_class INT,
    weight_class_description VARCHAR(50),
    warranty_period_months INT,
    -- Pricing
    list_price DECIMAL(12,2),
    minimum_price DECIMAL(12,2),
    price_currency CHAR(3),
    profit_margin DECIMAL(12,2),
    profit_margin_pct DECIMAL(5,2),
    -- Status
    product_status VARCHAR(20),
    is_active BOOLEAN,
    -- Supplier
    supplier_id INT,
    -- SCD Type 2 columns
    is_current BOOLEAN DEFAULT TRUE,
    effective_date DATE,
    expiration_date DATE DEFAULT '9999-12-31'
);

-- Employee/Sales Rep Dimension
CREATE TABLE gold.dim_employee (
    employee_key BIGINT PRIMARY KEY,
    employee_id INT NOT NULL,
    -- Person details
    first_name VARCHAR(50),
    last_name VARCHAR(50),
    full_name VARCHAR(150),
    -- Job details
    job_title VARCHAR(100),
    department VARCHAR(100),
    -- Employment details
    hire_date DATE,
    start_date DATE,
    end_date DATE,
    tenure_years INT,
    is_active BOOLEAN,
    employment_status VARCHAR(20),
    -- Compensation
    salary DECIMAL(12,2),
    commission_percent DECIMAL(5,2),
    -- Manager hierarchy
    manager_employee_id INT,
    manager_name VARCHAR(150),
    -- Location
    country_name VARCHAR(50),
    -- SCD Type 2 columns
    is_current BOOLEAN DEFAULT TRUE,
    effective_date DATE,
    expiration_date DATE DEFAULT '9999-12-31'
);

-- Location/Geography Dimension
CREATE TABLE gold.dim_location (
    location_key BIGINT PRIMARY KEY,
    location_id INT NOT NULL,
    -- Address details
    address_line_1 VARCHAR(100),
    city VARCHAR(50),
    state_province VARCHAR(50),
    district VARCHAR(50),
    postal_code VARCHAR(20),
    -- Country details
    country_id INT,
    country_name VARCHAR(50),
    country_code CHAR(3),
    currency_code VARCHAR(10),
    -- Geographic hierarchy
    region VARCHAR(50),
    sub_region VARCHAR(50),
    -- Location type
    location_type VARCHAR(50),
    -- SCD Type 2 columns
    is_current BOOLEAN DEFAULT TRUE,
    effective_date DATE,
    expiration_date DATE DEFAULT '9999-12-31'
);

-- Warehouse Dimension
CREATE TABLE gold.dim_warehouse (
    warehouse_key BIGINT PRIMARY KEY,
    warehouse_id INT NOT NULL,
    warehouse_name VARCHAR(100),
    -- Location details
    location_key BIGINT,
    city VARCHAR(50),
    state_province VARCHAR(50),
    country_name VARCHAR(50),
    -- Derived attributes
    warehouse_region VARCHAR(50),
    -- SCD Type 2 columns
    is_current BOOLEAN DEFAULT TRUE,
    effective_date DATE,
    expiration_date DATE DEFAULT '9999-12-31'
);

-- Promotion Dimension
CREATE TABLE gold.dim_promotion (
    promotion_key BIGSERIAL PRIMARY KEY,
    promotion_code VARCHAR(50) NOT NULL UNIQUE,
    promotion_name VARCHAR(100),
    promotion_type VARCHAR(50),
    discount_percent DECIMAL(5,2),
    discount_amount DECIMAL(12,2),
    start_date DATE,
    end_date DATE,
    is_active BOOLEAN DEFAULT TRUE
);

-- ----------------------------------------------------------------------------
-- FACT TABLES
-- ----------------------------------------------------------------------------

-- Sales Fact Table (Transaction grain - one row per order line item)
CREATE TABLE gold.fact_sales (
    sales_key BIGSERIAL PRIMARY KEY,
    -- Dimension keys
    order_date_key INT NOT NULL,
    customer_key BIGINT NOT NULL,
    product_key BIGINT NOT NULL,
    employee_key BIGINT,  -- Sales rep
    location_key BIGINT,  -- Shipping location
    promotion_key BIGINT,
    -- Degenerate dimensions
    order_id INT NOT NULL,
    order_item_id INT NOT NULL,
    order_code VARCHAR(20),
    -- Measures
    quantity DECIMAL(10,2) NOT NULL,
    unit_price DECIMAL(12,2) NOT NULL,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    gross_amount DECIMAL(15,2) NOT NULL,
    net_amount DECIMAL(15,2) NOT NULL,
    cost_amount DECIMAL(15,2),
    profit_amount DECIMAL(15,2),
    -- Order status
    order_status VARCHAR(20),
    order_status_category VARCHAR(20),
    -- Foreign keys to dimensions
    CONSTRAINT fk_fact_sales_date FOREIGN KEY (order_date_key) REFERENCES gold.dim_date(date_key),
    CONSTRAINT fk_fact_sales_customer FOREIGN KEY (customer_key) REFERENCES gold.dim_customer(customer_key),
    CONSTRAINT fk_fact_sales_product FOREIGN KEY (product_key) REFERENCES gold.dim_product(product_key),
    CONSTRAINT fk_fact_sales_employee FOREIGN KEY (employee_key) REFERENCES gold.dim_employee(employee_key)
);

-- Inventory Snapshot Fact Table (Periodic snapshot - daily inventory levels)
CREATE TABLE gold.fact_inventory_snapshot (
    inventory_snapshot_key BIGSERIAL PRIMARY KEY,
    -- Dimension keys
    snapshot_date_key INT NOT NULL,
    product_key BIGINT NOT NULL,
    warehouse_key BIGINT NOT NULL,
    -- Measures
    quantity_on_hand INT NOT NULL,
    quantity_available INT NOT NULL,
    quantity_reserved INT NOT NULL,
    -- Calculated measures
    days_of_supply INT,
    stock_status VARCHAR(20), -- IN_STOCK, LOW_STOCK, OUT_OF_STOCK
    inventory_value DECIMAL(15,2),
    -- Foreign keys
    CONSTRAINT fk_fact_inv_date FOREIGN KEY (snapshot_date_key) REFERENCES gold.dim_date(date_key),
    CONSTRAINT fk_fact_inv_product FOREIGN KEY (product_key) REFERENCES gold.dim_product(product_key),
    CONSTRAINT fk_fact_inv_warehouse FOREIGN KEY (warehouse_key) REFERENCES gold.dim_warehouse(warehouse_key)
);

-- Order Fact Table (Order grain - one row per order header)
CREATE TABLE gold.fact_orders (
    order_fact_key BIGSERIAL PRIMARY KEY,
    -- Dimension keys
    order_date_key INT NOT NULL,
    customer_key BIGINT NOT NULL,
    employee_key BIGINT,  -- Sales rep
    promotion_key BIGINT,
    -- Degenerate dimension
    order_id INT NOT NULL UNIQUE,
    order_code VARCHAR(20),
    -- Measures
    total_quantity DECIMAL(12,2),
    total_items INT,
    distinct_products INT,
    gross_amount DECIMAL(15,2),
    discount_amount DECIMAL(15,2),
    net_amount DECIMAL(15,2),
    -- Order attributes
    order_status VARCHAR(20),
    order_status_category VARCHAR(20),
    order_currency CHAR(3),
    has_promotion BOOLEAN,
    -- Timestamps
    created_date TIMESTAMP,
    -- Foreign keys
    CONSTRAINT fk_fact_orders_date FOREIGN KEY (order_date_key) REFERENCES gold.dim_date(date_key),
    CONSTRAINT fk_fact_orders_customer FOREIGN KEY (customer_key) REFERENCES gold.dim_customer(customer_key),
    CONSTRAINT fk_fact_orders_employee FOREIGN KEY (employee_key) REFERENCES gold.dim_employee(employee_key)
);

-- ----------------------------------------------------------------------------
-- AGGREGATE TABLES (For faster querying)
-- ----------------------------------------------------------------------------

-- Daily Sales Summary
CREATE TABLE gold.agg_daily_sales (
    daily_sales_key BIGSERIAL PRIMARY KEY,
    date_key INT NOT NULL,
    -- Measures
    total_orders INT,
    total_customers INT,
    total_items_sold DECIMAL(15,2),
    gross_revenue DECIMAL(18,2),
    discount_given DECIMAL(18,2),
    net_revenue DECIMAL(18,2),
    avg_order_value DECIMAL(12,2),
    -- Comparisons (for easy trending)
    prev_day_net_revenue DECIMAL(18,2),
    revenue_change_pct DECIMAL(8,2),
    CONSTRAINT fk_agg_daily_date FOREIGN KEY (date_key) REFERENCES gold.dim_date(date_key)
);

-- Monthly Sales by Product Category
CREATE TABLE gold.agg_monthly_product_sales (
    monthly_product_key BIGSERIAL PRIMARY KEY,
    year_number SMALLINT NOT NULL,
    month_number SMALLINT NOT NULL,
    category_name VARCHAR(50),
    -- Measures
    total_quantity_sold DECIMAL(15,2),
    total_orders INT,
    gross_revenue DECIMAL(18,2),
    net_revenue DECIMAL(18,2),
    avg_unit_price DECIMAL(12,2),
    -- Rankings
    category_rank INT
);

-- Customer Lifetime Value Summary
CREATE TABLE gold.agg_customer_lifetime (
    customer_ltv_key BIGSERIAL PRIMARY KEY,
    customer_key BIGINT NOT NULL UNIQUE,
    -- Lifetime measures
    first_order_date DATE,
    last_order_date DATE,
    customer_tenure_days INT,
    total_orders INT,
    total_items_purchased DECIMAL(15,2),
    lifetime_gross_value DECIMAL(18,2),
    lifetime_net_value DECIMAL(18,2),
    avg_order_value DECIMAL(12,2),
    avg_order_frequency_days INT,
    -- Segmentation
    rfm_recency_score INT,
    rfm_frequency_score INT,
    rfm_monetary_score INT,
    rfm_segment VARCHAR(50),
    customer_tier VARCHAR(20),
    CONSTRAINT fk_agg_cust_customer FOREIGN KEY (customer_key) REFERENCES gold.dim_customer(customer_key)
);

-- Sales Rep Performance Summary
CREATE TABLE gold.agg_sales_rep_performance (
    performance_key BIGSERIAL PRIMARY KEY,
    employee_key BIGINT NOT NULL,
    year_number SMALLINT NOT NULL,
    month_number SMALLINT NOT NULL,
    -- Measures
    total_orders INT,
    total_customers_served INT,
    new_customers_acquired INT,
    gross_sales DECIMAL(18,2),
    net_sales DECIMAL(18,2),
    total_commission DECIMAL(15,2),
    quota_amount DECIMAL(18,2),
    quota_attainment_pct DECIMAL(8,2),
    -- Rankings
    sales_rank INT,
    CONSTRAINT fk_agg_perf_employee FOREIGN KEY (employee_key) REFERENCES gold.dim_employee(employee_key)
);

-- Create indexes for Gold Layer
CREATE INDEX idx_fact_sales_date ON gold.fact_sales(order_date_key);
CREATE INDEX idx_fact_sales_customer ON gold.fact_sales(customer_key);
CREATE INDEX idx_fact_sales_product ON gold.fact_sales(product_key);
CREATE INDEX idx_fact_sales_employee ON gold.fact_sales(employee_key);
CREATE INDEX idx_fact_inv_date ON gold.fact_inventory_snapshot(snapshot_date_key);
CREATE INDEX idx_fact_inv_product ON gold.fact_inventory_snapshot(product_key);
CREATE INDEX idx_fact_orders_date ON gold.fact_orders(order_date_key);
CREATE INDEX idx_fact_orders_customer ON gold.fact_orders(customer_key);
CREATE INDEX idx_dim_customer_name ON gold.dim_customer(last_name, first_name);
CREATE INDEX idx_dim_product_category ON gold.dim_product(category_name);
CREATE INDEX idx_dim_location_country ON gold.dim_location(country_name);

