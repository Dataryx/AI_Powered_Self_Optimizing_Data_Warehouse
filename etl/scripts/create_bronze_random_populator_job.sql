-- Create DB job definition for the manual/cron Bronze random populator.
--
-- This job can be launched from:
--  - Dashboard: "Run ETL Manually" (via POST /api/v1/monitoring/etl/run)
--  - Cron/scheduler: etl/scheduler/job_scheduler.py (via monitoring.etl_jobs.cron_pattern)
--
-- IMPORTANT:
-- - Do NOT run scripts/trim_etl_jobs_to_two.py after adding this job,
--   because it will delete job definitions not in its allow-list.

INSERT INTO monitoring.etl_jobs
  (job_id, job_name, job_type, tables, cron_pattern, active_status)
VALUES
  (
    'bronze_random_populator_100',
    'BRONZE - Random Bronze Tables Populator (100)',
    'ingestion',
    'bronze',
    '*/5 * * * *',
    'A'
  )
ON CONFLICT (job_id) DO NOTHING;

