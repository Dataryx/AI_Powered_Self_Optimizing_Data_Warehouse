#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test script for Query Performance and Resource Utilization API endpoints.
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

def test_query_performance():
    """Test the query performance endpoint."""
    print("=" * 60)
    print("Testing Query Performance API Endpoint")
    print("=" * 60)
    endpoint = f"{API_BASE_URL}/query-performance"
    print(f"Endpoint: {endpoint}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)

    try:
        response = requests.get(endpoint, timeout=10)
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            data_points = data.get('data', [])
            print(f"\n[OK] Request successful!")
            print(f"Data points returned: {len(data_points)}")
            
            if data_points:
                print("\nSample data points:")
                for i, point in enumerate(data_points[:5]):
                    print(f"  {i+1}. {point.get('timestamp', 'N/A')}")
                    print(f"     P50: {point.get('p50', 0):.2f}ms")
                    print(f"     P95: {point.get('p95', 0):.2f}ms")
                    print(f"     P99: {point.get('p99', 0):.2f}ms")
                    print(f"     Avg: {point.get('avg', 0):.2f}ms")
            else:
                print("\n[WARNING] No data points returned (empty array)")
            return True
        else:
            print(f"\n[FAIL] Request failed with status {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False

    except requests.exceptions.ConnectionError:
        print("\n[ERROR] Connection refused!")
        print("The API Gateway is not running.")
        return False
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}")
        return False

def test_resource_utilization():
    """Test the resource utilization endpoint."""
    print("\n" + "=" * 60)
    print("Testing Resource Utilization API Endpoint")
    print("=" * 60)
    endpoint = f"{API_BASE_URL}/resource-utilization"
    print(f"Endpoint: {endpoint}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)

    try:
        response = requests.get(endpoint, timeout=10)
        print(f"Status Code: {response.status_code}")

        if response.status_code == 200:
            data = response.json()
            print(f"\n[OK] Request successful!")
            print("\nResource Utilization:")
            print(f"  CPU: {data.get('cpu', 0):.1f}%")
            print(f"  Memory: {data.get('memory', 0):.1f}%")
            print(f"  Disk: {data.get('disk', 0):.1f}%")
            print(f"  Network: {data.get('network', 0):.1f}%")
            return True
        else:
            print(f"\n[FAIL] Request failed with status {response.status_code}")
            print(f"Response: {response.text[:500]}")
            return False

    except requests.exceptions.ConnectionError:
        print("\n[ERROR] Connection refused!")
        print("The API Gateway is not running.")
        return False
    except Exception as e:
        print(f"\n[ERROR] Unexpected error: {e}")
        return False

if __name__ == "__main__":
    success1 = test_query_performance()
    success2 = test_resource_utilization()
    
    print("\n" + "=" * 60)
    print("TEST SUMMARY")
    print("=" * 60)
    print(f"Query Performance: {'[OK]' if success1 else '[FAIL]'}")
    print(f"Resource Utilization: {'[OK]' if success2 else '[FAIL]'}")
    print("=" * 60)
    
    sys.exit(0 if (success1 and success2) else 1)

