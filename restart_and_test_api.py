#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Restart API Gateway and test endpoints
"""

import requests
import time
import sys
import subprocess
import os
from pathlib import Path

# Fix Windows console encoding
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

def test_endpoint(url, name):
    """Test an endpoint and return status."""
    try:
        response = requests.get(url, timeout=5)
        if response.status_code == 200:
            return True, response.json()
        else:
            return False, f"Status {response.status_code}"
    except requests.exceptions.ConnectionError:
        return False, "Connection refused"
    except Exception as e:
        return False, str(e)

def main():
    print("=" * 70)
    print("API Gateway Restart and Test")
    print("=" * 70)
    print()
    
    # Check current status
    print("1. Checking current endpoint status...")
    print("-" * 70)
    
    base_url = "http://localhost:8000/api/v1/dashboard"
    endpoints = {
        "Metrics": f"{base_url}/metrics",
        "Query Performance": f"{base_url}/query-performance",
        "Resource Utilization": f"{base_url}/resource-utilization",
    }
    
    results = {}
    for name, url in endpoints.items():
        success, data = test_endpoint(url, name)
        status = "[OK] Working" if success else f"[FAIL] {data}"
        results[name] = (success, data)
        print(f"  {name}: {status}")
    
    print()
    
    # Check if all endpoints are working
    all_working = all(success for success, _ in results.values())
    
    if not all_working:
        print("2. Some endpoints are not working.")
        print("-" * 70)
        print("Please manually restart the API Gateway:")
        print("  1. Find the API Gateway PowerShell window")
        print("  2. Press Ctrl+C to stop it")
        print("  3. Run: cd api-gateway")
        print("  4. Run: python -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload")
        print()
        print("Or use the startup script:")
        print("  .\\START_DASHBOARD_AND_API.ps1")
        print()
        return
    
    # If all working, show the data
    print("2. All endpoints are working! Showing data...")
    print("=" * 70)
    
    # Metrics
    if results["Metrics"][0]:
        print("\nOVERVIEW METRICS:")
        print("-" * 70)
        data = results["Metrics"][1]
        print(f"  Total Queries Today: {data.get('queriesToday', 0):,}")
        print(f"  Avg Response Time: {data.get('avgResponseTime', 0):.2f}ms")
        print(f"  Optimization Savings: {data.get('optimizationSavings', 0):.2f}%")
        print(f"  Active Alerts: {data.get('activeAlerts', 0)}")
    
    # Query Performance
    if results["Query Performance"][0]:
        print("\nQUERY PERFORMANCE:")
        print("-" * 70)
        data = results["Query Performance"][1]
        data_points = data.get('data', [])
        print(f"  Data Points: {len(data_points)}")
        if data_points:
            print("\n  Latest 5 data points:")
            for i, point in enumerate(data_points[-5:], 1):
                timestamp = point.get('timestamp', 'N/A')[:19] if len(point.get('timestamp', '')) > 19 else point.get('timestamp', 'N/A')
                print(f"    {i}. {timestamp}")
                print(f"       P50: {point.get('p50', 0):.2f}ms, P95: {point.get('p95', 0):.2f}ms, P99: {point.get('p99', 0):.2f}ms")
                print(f"       Avg: {point.get('avg', 0):.2f}ms")
        else:
            print("  No data points available")
    
    # Resource Utilization
    if results["Resource Utilization"][0]:
        print("\nRESOURCE UTILIZATION:")
        print("-" * 70)
        data = results["Resource Utilization"][1]
        print(f"  CPU: {data.get('cpu', 0):.1f}%")
        print(f"  Memory: {data.get('memory', 0):.1f}%")
        print(f"  Disk: {data.get('disk', 0):.1f}%")
        print(f"  Network: {data.get('network', 0):.1f}%")
    
    print("\n" + "=" * 70)
    print("[OK] All endpoints are working with real data!")
    print("=" * 70)

if __name__ == "__main__":
    main()

