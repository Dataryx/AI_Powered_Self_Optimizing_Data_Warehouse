-- Stored procedures for generating order-focused workload/report output.
-- Run this file once against your warehouse database.

CREATE SCHEMA IF NOT EXISTS ml_optimization;

CREATE OR REPLACE PROCEDURE ml_optimization.sp_generate_orders_report(IN p_days INTEGER DEFAULT 30)
LANGUAGE plpgsql
AS $$
DECLARE
    v_days INTEGER := GREATEST(1, COALESCE(p_days, 30));
BEGIN
    IF to_regclass('gold.fact_sales') IS NULL THEN
        RAISE EXCEPTION 'Required table gold.fact_sales not found';
    END IF;

    CREATE TEMP TABLE IF NOT EXISTS tmp_orders_report (
        metric TEXT,
        value NUMERIC
    ) ON COMMIT DROP;

    TRUNCATE TABLE tmp_orders_report;

    INSERT INTO tmp_orders_report(metric, value)
    SELECT 'orders_count', COUNT(*)::NUMERIC
    FROM gold.fact_sales fs
    LEFT JOIN gold.dim_date d ON fs.order_date_key = d.date_key
    WHERE d.full_date >= CURRENT_DATE - v_days;

    INSERT INTO tmp_orders_report(metric, value)
    SELECT 'sales_amount', COALESCE(SUM(fs.net_amount), 0)::NUMERIC
    FROM gold.fact_sales fs
    LEFT JOIN gold.dim_date d ON fs.order_date_key = d.date_key
    WHERE d.full_date >= CURRENT_DATE - v_days;

    INSERT INTO tmp_orders_report(metric, value)
    SELECT 'units_sold', COALESCE(SUM(fs.quantity), 0)::NUMERIC
    FROM gold.fact_sales fs
    LEFT JOIN gold.dim_date d ON fs.order_date_key = d.date_key
    WHERE d.full_date >= CURRENT_DATE - v_days;

    RAISE NOTICE 'tmp_orders_report generated for last % days', v_days;
END;
$$;


CREATE OR REPLACE PROCEDURE ml_optimization.sp_generate_orders_workload(IN p_runs INTEGER DEFAULT 25)
LANGUAGE plpgsql
AS $$
DECLARE
    i INTEGER;
    v_runs INTEGER := GREATEST(1, COALESCE(p_runs, 25));
BEGIN
    IF to_regclass('gold.fact_sales') IS NULL THEN
        RAISE EXCEPTION 'Required table gold.fact_sales not found';
    END IF;

    FOR i IN 1..v_runs LOOP
        -- Typical order trend query
        PERFORM d.full_date, SUM(fs.net_amount)
        FROM gold.fact_sales fs
        LEFT JOIN gold.dim_date d ON fs.order_date_key = d.date_key
        WHERE d.full_date >= CURRENT_DATE - 30
        GROUP BY d.full_date
        ORDER BY d.full_date DESC
        LIMIT 90;

        -- Typical top products query
        PERFORM p.product_name, SUM(fs.net_amount)
        FROM gold.fact_sales fs
        LEFT JOIN gold.dim_product p ON fs.product_key = p.product_key
        LEFT JOIN gold.dim_date d ON fs.order_date_key = d.date_key
        WHERE d.full_date >= CURRENT_DATE - 30
        GROUP BY p.product_name
        ORDER BY SUM(fs.net_amount) DESC
        LIMIT 20;
    END LOOP;

    RAISE NOTICE 'Generated % order workload runs', v_runs;
END;
$$;
