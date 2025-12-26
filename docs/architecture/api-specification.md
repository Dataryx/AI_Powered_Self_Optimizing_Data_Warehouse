# API Specification

This document defines the RESTful API endpoints for the AI-Powered Self-Optimizing Data Warehouse. The API will be implemented in Phase 2, but this specification serves as the design foundation.

## Base URL

```
Development: http://localhost:8000/api/v1
Production: https://api.example.com/api/v1
```

## Authentication

All API endpoints (except health checks) require authentication using JWT tokens.

### Authentication Headers

```
Authorization: Bearer <jwt_token>
```

## Common Response Format

### Success Response

```json
{
  "status": "success",
  "data": { ... },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

### Error Response

```json
{
  "status": "error",
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": { ... }
  },
  "timestamp": "2024-01-15T10:30:00Z"
}
```

## Warehouse Data Endpoints

### Get Daily Sales Summary

**GET** `/warehouse/daily-sales`

Get daily sales summary for a date range.

**Query Parameters**:
- `start_date` (required): Start date (YYYY-MM-DD)
- `end_date` (required): End date (YYYY-MM-DD)
- `limit`: Maximum number of results (default: 100)
- `offset`: Pagination offset (default: 0)

**Response**:
```json
{
  "status": "success",
  "data": {
    "results": [
      {
        "date_key": "2024-01-15",
        "total_orders": 1500,
        "total_revenue": 125000.50,
        "total_items_sold": 3200,
        "average_order_value": 83.33,
        "unique_customers": 1200,
        "new_customers": 150,
        "returning_customers": 1050,
        "top_category": "Electronics",
        "top_product_sk": 12345
      }
    ],
    "total": 365,
    "limit": 100,
    "offset": 0
  }
}
```

### Get Customer 360

**GET** `/warehouse/customers/{customer_sk}`

Get comprehensive customer analytics.

**Response**:
```json
{
  "status": "success",
  "data": {
    "customer_sk": 12345,
    "customer_id": "CUST001",
    "lifetime_value": 2500.75,
    "total_orders": 15,
    "average_order_value": 166.72,
    "purchase_frequency": 1.25,
    "days_since_last_purchase": 5,
    "customer_segment": "VIP",
    "churn_risk_score": 0.15,
    "favorite_category": "Electronics",
    "total_returns": 1,
    "registration_date": "2023-01-15",
    "first_purchase_date": "2023-01-20",
    "last_purchase_date": "2024-01-10"
  }
}
```

### Get Product Performance

**GET** `/warehouse/products/{product_sk}`

Get product performance metrics.

**Response**:
```json
{
  "status": "success",
  "data": {
    "product_sk": 67890,
    "product_id": "PROD001",
    "total_units_sold": 5000,
    "total_revenue": 125000.00,
    "average_rating": 4.5,
    "review_count": 250,
    "return_rate": 0.02,
    "inventory_turnover": 12.5,
    "days_since_last_sale": 1,
    "category_rank": 5,
    "last_updated": "2024-01-15T10:00:00Z"
  }
}
```

### Get Inventory Health

**GET** `/warehouse/inventory-health`

Get inventory health metrics.

**Query Parameters**:
- `warehouse_id` (optional): Filter by warehouse
- `overstock_only` (optional): Show only overstocked items (true/false)
- `low_stock_only` (optional): Show only low stock items (true/false)

**Response**:
```json
{
  "status": "success",
  "data": {
    "results": [
      {
        "product_sk": 67890,
        "warehouse_id": "WH001",
        "current_stock": 150,
        "days_of_supply": 30,
        "stockout_frequency": 0,
        "overstock_flag": false,
        "reorder_point": 100,
        "safety_stock": 50,
        "snapshot_date": "2024-01-15"
      }
    ],
    "total": 1500
  }
}
```

## Optimization Endpoints

### Get Optimization Recommendations

**GET** `/optimization/recommendations`

Get ML-generated optimization recommendations.

**Query Parameters**:
- `type` (optional): Filter by type (index, partition, cache)
- `status` (optional): Filter by status (pending, applied, rejected)

**Response**:
```json
{
  "status": "success",
  "data": {
    "recommendations": [
      {
        "recommendation_id": "REC001",
        "type": "index",
        "table": "silver.orders",
        "columns": ["customer_sk", "order_date"],
        "estimated_improvement": 0.35,
        "cost": 0.15,
        "priority": "high",
        "status": "pending",
        "created_at": "2024-01-15T10:00:00Z"
      }
    ],
    "total": 25
  }
}
```

### Apply Optimization Recommendation

**POST** `/optimization/recommendations/{recommendation_id}/apply`

Apply an optimization recommendation.

**Response**:
```json
{
  "status": "success",
  "data": {
    "recommendation_id": "REC001",
    "status": "applied",
    "applied_at": "2024-01-15T10:30:00Z",
    "actual_improvement": 0.32
  }
}
```

### Get Query Performance Metrics

**GET** `/optimization/query-performance`

Get query performance metrics.

**Query Parameters**:
- `start_date` (required): Start date
- `end_date` (required): End date
- `query_id` (optional): Filter by query ID
- `limit` (optional): Maximum results

**Response**:
```json
{
  "status": "success",
  "data": {
    "metrics": [
      {
        "query_id": "Q001",
        "query_hash": "abc123...",
        "execution_count": 1500,
        "avg_execution_time": 0.125,
        "p50_execution_time": 0.110,
        "p95_execution_time": 0.250,
        "p99_execution_time": 0.500,
        "total_execution_time": 187.5,
        "cache_hit_rate": 0.75,
        "last_executed": "2024-01-15T10:00:00Z"
      }
    ],
    "total": 500
  }
}
```

## Monitoring Endpoints

### Get System Health

**GET** `/monitoring/health`

Get overall system health status.

**Response**:
```json
{
  "status": "success",
  "data": {
    "overall_status": "healthy",
    "services": {
      "database": {
        "status": "healthy",
        "response_time_ms": 5,
        "connections": 45,
        "max_connections": 200
      },
      "redis": {
        "status": "healthy",
        "response_time_ms": 1,
        "memory_used_mb": 128,
        "memory_limit_mb": 256
      },
      "api": {
        "status": "healthy",
        "uptime_seconds": 86400,
        "requests_per_minute": 150
      }
    },
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Get Real-Time Metrics

**GET** `/monitoring/metrics/realtime`

Get real-time dashboard metrics.

**Response**:
```json
{
  "status": "success",
  "data": {
    "orders_today": 1250,
    "revenue_today": 105000.50,
    "active_users": 450,
    "cart_abandonment_rate": 0.35,
    "top_product_sk": 67890,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

### Get Alerts

**GET** `/monitoring/alerts`

Get active alerts.

**Query Parameters**:
- `severity` (optional): Filter by severity (low, medium, high, critical)
- `status` (optional): Filter by status (active, resolved)

**Response**:
```json
{
  "status": "success",
  "data": {
    "alerts": [
      {
        "alert_id": "ALERT001",
        "type": "slow_query",
        "severity": "high",
        "message": "Query Q001 exceeded threshold",
        "details": {
          "query_id": "Q001",
          "execution_time": 5.5,
          "threshold": 5.0
        },
        "created_at": "2024-01-15T10:25:00Z",
        "status": "active"
      }
    ],
    "total": 5
  }
}
```

## WebSocket Endpoints

### Real-Time Updates

**WS** `/ws/realtime`

WebSocket connection for real-time updates.

**Message Format**:
```json
{
  "type": "metric_update",
  "data": {
    "metric": "orders_today",
    "value": 1250,
    "timestamp": "2024-01-15T10:30:00Z"
  }
}
```

**Subscribe to Channels**:
- `metrics`: Real-time metric updates
- `alerts`: Alert notifications
- `optimizations`: Optimization recommendations

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `VALIDATION_ERROR` | 400 | Request validation failed |
| `UNAUTHORIZED` | 401 | Authentication required |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `NOT_FOUND` | 404 | Resource not found |
| `CONFLICT` | 409 | Resource conflict |
| `INTERNAL_ERROR` | 500 | Internal server error |
| `SERVICE_UNAVAILABLE` | 503 | Service temporarily unavailable |

## Rate Limiting

- **Default**: 100 requests per minute per API key
- **Burst**: 20 requests per second
- Rate limit headers:
  - `X-RateLimit-Limit`: Request limit
  - `X-RateLimit-Remaining`: Remaining requests
  - `X-RateLimit-Reset`: Reset time (Unix timestamp)

## Pagination

All list endpoints support pagination:

**Query Parameters**:
- `limit`: Number of results per page (default: 100, max: 1000)
- `offset`: Number of results to skip (default: 0)

**Response Headers**:
- `X-Total-Count`: Total number of results
- `X-Page-Size`: Number of results per page
- `X-Page-Number`: Current page number

## Versioning

API version is specified in the URL path: `/api/v1/...`

Breaking changes will increment the version number (v2, v3, etc.).

## Implementation Notes

This API specification will be implemented in Phase 2 of the project. The endpoints will use:
- **Framework**: FastAPI (Python)
- **Database**: PostgreSQL (via SQLAlchemy)
- **Caching**: Redis
- **Authentication**: JWT tokens
- **Documentation**: OpenAPI/Swagger (auto-generated)


