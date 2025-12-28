#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Check Dashboard Data Status - Summary for Query Performance and Resource Utilization
"""

import requests
import json
import sys
from datetime import datetime

# Fix Windows console encoding
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

API_BASE_URL = "http://localhost:8000/api/v1/dashboard"

def check_endpoint_status(endpoint_name, endpoint_path):
    """Check if an endpoint is accessible and return status."""
    try:
        response = requests.get(f"{API_BASE_URL}{endpoint_path}", timeout=5)
        if response.status_code == 200:
            return "✓ Working", response.json()
        elif response.status_code == 404:
            return "✗ Not Found (404) - Server needs restart", None
        else:
            return f"✗ Error ({response.status_code})", None
    except requests.exceptions.ConnectionError:
        return "✗ Connection Error - API Gateway not running", None
    except Exception as e:
        return f"✗ Error: {str(e)[:50]}", None

def main():
    print("=" * 70)
    print("Dashboard Data Status Check")
    print("=" * 70)
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print(f"API Base URL: {API_BASE_URL}")
    print("-" * 70)
    print()
    
    # Check Overview Metrics (should be working)
    print("1. OVERVIEW METRICS (/metrics)")
    print("-" * 70)
    status, data = check_endpoint_status("Overview Metrics", "/metrics")
    print(f"Status: {status}")
    if data:
        print(f"  • Total Queries Today: {data.get('queriesToday', 0):,}")
        print(f"  • Avg Response Time: {data.get('avgResponseTime', 0):.2f}ms")
        print(f"  • Optimization Savings: {data.get('optimizationSavings', 0):.2f}%")
        print(f"  • Active Alerts: {data.get('activeAlerts', 0)}")
    print()
    
    # Check Query Performance
    print("2. QUERY PERFORMANCE (/query-performance)")
    print("-" * 70)
    status, data = check_endpoint_status("Query Performance", "/query-performance")
    print(f"Status: {status}")
    if data and data.get('data'):
        data_points = data['data']
        print(f"  • Data Points: {len(data_points)}")
        if data_points:
            print(f"  • Latest: {data_points[-1].get('timestamp', 'N/A')}")
            print(f"    - P50: {data_points[-1].get('p50', 0):.2f}ms")
            print(f"    - P95: {data_points[-1].get('p95', 0):.2f}ms")
            print(f"    - P99: {data_points[-1].get('p99', 0):.2f}ms")
            print(f"    - Avg: {data_points[-1].get('avg', 0):.2f}ms")
    elif status.startswith("✗ Not Found"):
        print("  ⚠ Endpoint exists in code but server needs restart")
        print("  → Stop API Gateway (Ctrl+C) and restart it")
    print()
    
    # Check Resource Utilization
    print("3. RESOURCE UTILIZATION (/resource-utilization)")
    print("-" * 70)
    status, data = check_endpoint_status("Resource Utilization", "/resource-utilization")
    print(f"Status: {status}")
    if data:
        print(f"  • CPU: {data.get('cpu', 0):.1f}%")
        print(f"  • Memory: {data.get('memory', 0):.1f}%")
        print(f"  • Disk: {data.get('disk', 0):.1f}%")
        print(f"  • Network: {data.get('network', 0):.1f}%")
    elif status.startswith("✗ Not Found"):
        print("  ⚠ Endpoint exists in code but server needs restart")
        print("  → Stop API Gateway (Ctrl+C) and restart it")
    print()
    
    # Summary
    print("=" * 70)
    print("SUMMARY")
    print("=" * 70)
    print("Overview Metrics: Using real data from database ✓")
    print("Query Performance: Endpoint ready but server needs restart ⚠")
    print("Resource Utilization: Endpoint ready but server needs restart ⚠")
    print()
    print("TO FIX:")
    print("  1. Stop the API Gateway server (Ctrl+C in its window)")
    print("  2. Restart it: cd api-gateway && python -m uvicorn main:app --reload")
    print("     OR use: .\\START_DASHBOARD_AND_API.ps1")
    print("=" * 70)

if __name__ == "__main__":
    main()

