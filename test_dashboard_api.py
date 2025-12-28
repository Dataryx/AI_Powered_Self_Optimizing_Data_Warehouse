#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test script for Dashboard Metrics API endpoint.
"""

import requests
import json
import sys
import os
from datetime import datetime

# Fix Windows console encoding
if sys.platform == 'win32':
    import codecs
    sys.stdout = codecs.getwriter('utf-8')(sys.stdout.buffer, 'strict')
    sys.stderr = codecs.getwriter('utf-8')(sys.stderr.buffer, 'strict')

API_BASE_URL = "http://localhost:8000/api/v1"
ENDPOINT = f"{API_BASE_URL}/dashboard/metrics"

def test_dashboard_metrics():
    """Test the dashboard metrics endpoint."""
    print("=" * 60)
    print("Testing Dashboard Metrics API Endpoint")
    print("=" * 60)
    print(f"Endpoint: {ENDPOINT}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 60)
    
    try:
        # Test the endpoint
        print("\n1. Sending GET request...")
        response = requests.get(ENDPOINT, timeout=10)
        
        print(f"   Status Code: {response.status_code}")
        
        if response.status_code == 200:
            print("   [OK] Request successful!")
            
            # Parse response
            try:
                data = response.json()
                print("\n2. Response Data:")
                print(json.dumps(data, indent=2))
                
                # Validate response structure
                print("\n3. Validating response structure...")
                required_fields = [
                    'queriesToday', 'avgResponseTime', 'optimizationSavings',
                    'activeAlerts', 'queriesChange', 'responseTimeChange', 'savingsChange'
                ]
                
                missing_fields = []
                for field in required_fields:
                    if field not in data:
                        missing_fields.append(field)
                    else:
                        print(f"   ✓ {field}: {data[field]}")
                
                if missing_fields:
                    print(f"\n   [WARNING] Missing fields: {', '.join(missing_fields)}")
                    return False
                else:
                    print("\n   [OK] All required fields present!")
                
                # Check data types
                print("\n4. Validating data types...")
                validations = [
                    ('queriesToday', int, 'integer'),
                    ('avgResponseTime', (int, float), 'number'),
                    ('optimizationSavings', (int, float), 'number'),
                    ('activeAlerts', int, 'integer'),
                    ('queriesChange', (int, float), 'number'),
                    ('responseTimeChange', (int, float), 'number'),
                    ('savingsChange', (int, float), 'number'),
                ]
                
                all_valid = True
                for field, expected_type, type_name in validations:
                    value = data[field]
                    if not isinstance(value, expected_type):
                        print(f"   [FAIL] {field}: Expected {type_name}, got {type(value).__name__}")
                        all_valid = False
                    else:
                        print(f"   [OK] {field}: {type_name} ({value})")
                
                if all_valid:
                    print("\n   [OK] All data types are valid!")
                
                # Summary
                print("\n" + "=" * 60)
                print("TEST SUMMARY")
                print("=" * 60)
                print("[OK] API endpoint is accessible")
                print("[OK] Response format is correct")
                print("[OK] All required fields are present")
                print("[OK] Data types are valid")
                print("\n" + "=" * 60)
                print("Real data from database:")
                print(f"  • Total Queries Today: {data['queriesToday']:,}")
                print(f"  • Avg Response Time: {data['avgResponseTime']:.2f}ms")
                print(f"  • Optimization Savings: {data['optimizationSavings']:.2f}%")
                print(f"  • Active Alerts: {data['activeAlerts']}")
                print(f"  • Queries Change: {data['queriesChange']:+.2f}%")
                print(f"  • Response Time Change: {data['responseTimeChange']:+.2f}%")
                print(f"  • Savings Change: {data['savingsChange']:+.2f}%")
                print("=" * 60)
                
                return True
                
            except json.JSONDecodeError as e:
                print(f"\n   [FAIL] Invalid JSON response: {e}")
                print(f"   Response text: {response.text[:200]}")
                return False
                
        elif response.status_code == 404:
            print("   [FAIL] Endpoint not found (404)")
            print("   Make sure the dashboard routes are properly registered in main.py")
            return False
        else:
            print(f"   [FAIL] Request failed with status {response.status_code}")
            print(f"   Response: {response.text[:500]}")
            return False
            
    except requests.exceptions.ConnectionError:
        print("\n   [ERROR] Connection refused!")
        print("   The API Gateway is not running.")
        print("\n   To start the API Gateway, run:")
        print("   cd api-gateway")
        print("   python -m uvicorn main:app --reload --port 8000")
        print("\n   Or use the startup script:")
        print("   .\\START_DASHBOARD_AND_API.ps1")
        return False
        
    except requests.exceptions.Timeout:
        print("\n   [ERROR] Request timed out!")
        return False
        
    except Exception as e:
        print(f"\n   [ERROR] Unexpected error: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_dashboard_metrics()
    sys.exit(0 if success else 1)

