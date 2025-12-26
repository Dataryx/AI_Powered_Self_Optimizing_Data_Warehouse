# Data Generator

Generates realistic synthetic e-commerce data for the data warehouse Bronze layer.

## Features

- Generates realistic customer, product, order, inventory, review, session, and clickstream data
- Maintains referential integrity between entities
- Configurable data volumes and parameters
- Batch loading into PostgreSQL Bronze layer
- Reproducible with seed option

## Installation

```bash
pip install -r data-generator/requirements.txt
```

## Configuration

Configuration is managed via environment variables or `config.py`. Key settings:

- `num_customers`: Number of customers to generate (default: 10,000)
- `num_products`: Number of products to generate (default: 5,000)
- `num_orders`: Target number of orders (default: 50,000)
- `days_of_data`: Days of historical data (default: 365)
- Database connection settings

## Usage

### Generate Data Only (No Database)

```bash
python -m data_generator.main
```

### Generate and Load Data

```bash
python -m data_generator.main --load
```

### Custom Volumes

```bash
python -m data_generator.main --load --customers 50000 --products 10000 --days 730
```

### Using Makefile

```bash
# Generate data only
make generate-data

# Generate and load data
make load-data
```

## Generated Data

### Customers (10,000 default)
- Customer IDs, names, emails, addresses
- Registration dates, demographics
- Realistic geographic distribution

### Products (5,000 default)
- Products across 8 categories
- Realistic pricing and costs
- Brand information and SKUs
- Product attributes (size, color, dimensions)

### Orders (50,000+ default)
- Orders distributed across date range
- Multiple items per order
- Realistic pricing, discounts, taxes, shipping
- Order statuses and payment information

### Inventory Movements
- Initial inventory (IN movements)
- Sales-driven OUT movements
- Adjustments and corrections

### Reviews
- Product reviews with ratings
- Review text and titles
- Verified purchase flags
- Linked to customers who ordered products

### Sessions
- User sessions with timing
- Device and browser information
- Geographic location data
- 60% with logged-in users

### Clickstream Events
- Page views, clicks, cart events
- Purchase events
- Linked to sessions and products
- Realistic event sequences

## Data Relationships

The generator maintains realistic relationships:

- Orders reference existing customers and products
- Reviews are linked to customers who ordered products
- Clickstream events are linked to sessions
- Inventory movements reflect order patterns
- All data maintains temporal consistency

## Database Schema

Data is loaded into Bronze layer tables:

- `bronze.raw_customers`
- `bronze.raw_products`
- `bronze.raw_orders`
- `bronze.raw_inventory`
- `bronze.raw_reviews`
- `bronze.raw_sessions`
- `bronze.raw_clickstream`

## Performance

- Batch loading with configurable batch sizes
- Uses PostgreSQL batch insert operations
- Handles large data volumes efficiently
- Progress logging for monitoring

## Examples

### Small Dataset (Testing)

```bash
python -m data_generator.main --load --customers 1000 --products 500 --days 30
```

### Medium Dataset (Development)

```bash
python -m data_generator.main --load --customers 10000 --products 5000 --days 365
```

### Large Dataset (Production-like)

```bash
python -m data_generator.main --load --customers 100000 --products 50000 --days 730
```

## Notes

- Ensure database schemas are created before loading
- Use `ON CONFLICT DO NOTHING` to allow re-running
- Data generation is deterministic with seed=42
- Adjust volumes based on available resources

