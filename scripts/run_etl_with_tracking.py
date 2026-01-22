"""
Run ETL Pipeline with Real-Time Job Tracking
Demonstrates real-time ETL job tracking in the dashboard.
"""

import sys
import os
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from etl.scripts.run_etl import run_etl_pipeline

if __name__ == "__main__":
    print("=" * 60)
    print("Starting ETL Pipeline with Real-Time Job Tracking")
    print("=" * 60)
    print("Open the Monitoring Dashboard to see jobs in real-time!")
    print("Dashboard: http://localhost:3000/monitoring")
    print("=" * 60)
    print()
    
    run_etl_pipeline()


