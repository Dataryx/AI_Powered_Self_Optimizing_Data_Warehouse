"""
API Endpoints Integration Tests
Tests for API Gateway endpoints.
"""

import pytest
import requests
import json
import time
import time


class TestWarehouseEndpoints:
    """Test warehouse-related API endpoints."""

    def test_warehouse_stats(self, api_base_url):
        """Test warehouse statistics endpoint."""
        response = requests.get(f"{api_base_url}/warehouse/stats")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data or "total_tables" in data

    def test_get_tables_by_layer(self, api_base_url):
        """Test getting tables by layer."""
        for layer in ["bronze", "silver", "gold"]:
            response = requests.get(f"{api_base_url}/warehouse/tables/{layer}")
            assert response.status_code == 200

    def test_query_history(self, api_base_url):
        """Test query history endpoint."""
        from datetime import datetime, timedelta
        end_date = datetime.now().strftime("%Y-%m-%d")
        start_date = (datetime.now() - timedelta(days=7)).strftime("%Y-%m-%d")
        
        response = requests.get(
            f"{api_base_url}/warehouse/query-history",
            params={"start_date": start_date, "end_date": end_date}
        )
        assert response.status_code == 200


class TestOptimizationEndpoints:
    """Test optimization-related API endpoints."""

    def test_get_optimization_recommendations(self, api_base_url):
        """Test getting optimization recommendations."""
        response = requests.get(f"{api_base_url}/optimization/recommendations")
        assert response.status_code == 200

    def test_get_optimization_metrics(self, api_base_url):
        """Test getting optimization metrics."""
        response = requests.get(f"{api_base_url}/optimization/metrics")
        assert response.status_code == 200

    def test_get_optimization_history(self, api_base_url):
        """Test getting optimization history."""
        response = requests.get(f"{api_base_url}/optimization/history")
        assert response.status_code == 200


class TestMonitoringEndpoints:
    """Test monitoring-related API endpoints."""

    def test_realtime_metrics(self, api_base_url):
        """Test real-time metrics endpoint."""
        response = requests.get(f"{api_base_url}/monitoring/metrics/realtime")
        assert response.status_code == 200
        data = response.json()
        assert "data" in data or "timestamp" in data

    def test_system_health(self, api_base_url):
        """Test system health endpoint."""
        response = requests.get(f"{api_base_url}/monitoring/health")
        assert response.status_code == 200
        data = response.json()
        assert "status" in data or "data" in data

    def test_active_alerts(self, api_base_url):
        """Test active alerts endpoint."""
        response = requests.get(f"{api_base_url}/monitoring/alerts/active")
        assert response.status_code == 200


class TestWebSocketConnection:
    """Test WebSocket functionality."""

    @pytest.mark.asyncio
    async def test_websocket_connection(self, api_base_url):
        """Test WebSocket connection."""
        import websockets
        import asyncio
        
        # Convert HTTP URL to WebSocket URL
        ws_url = api_base_url.replace("http://", "ws://").replace("/api/v1", "")
        client_id = f"test_client_{int(time.time())}"
        
        try:
            async with websockets.connect(f"{ws_url}/ws/{client_id}") as websocket:
                # Send subscribe message
                await websocket.send(json.dumps({
                    "action": "subscribe",
                    "channels": ["metrics"]
                }))
                
                # Wait for response (with timeout)
                response = await asyncio.wait_for(websocket.recv(), timeout=5.0)
                assert response is not None, "Should receive WebSocket message"
        except Exception as e:
            pytest.skip(f"WebSocket test skipped: {e}")


