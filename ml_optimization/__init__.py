"""
ml_optimization package

This lightweight package exists so modules that import
`ml_optimization.utils.*` (including the ETL job tracker)
work correctly when running scripts directly (e.g. run_etl.py),
without needing any special bootstrapping.
"""

