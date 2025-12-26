"""
Data Generator Main Entry Point
Generates and loads realistic e-commerce data into Bronze layer.
"""

import sys
import logging
import argparse
from datetime import datetime
from pathlib import Path

# Add parent directory to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from config import DataGeneratorConfig
from generators.customer_generator import CustomerGenerator
from generators.product_generator import ProductGenerator
from generators.order_generator import OrderGenerator
from generators.inventory_generator import InventoryGenerator
from generators.review_generator import ReviewGenerator
from generators.session_generator import SessionGenerator
from generators.clickstream_generator import ClickstreamGenerator
from loaders.batch_loader import BatchLoader

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def generate_data(config: DataGeneratorConfig, load: bool = False):
    """Generate and optionally load data into Bronze layer."""
    
    logger.info("=" * 60)
    logger.info("Starting Data Generation")
    logger.info("=" * 60)
    
    # Initialize loader if loading
    loader = None
    if load:
        loader = BatchLoader(config)
        loader.connect()
    
    try:
        # 1. Generate Customers
        logger.info("\n[1/7] Generating customers...")
        logger.info(f"  Target: {config.num_customers} customers")
        customer_gen = CustomerGenerator(config, seed=config.random_seed)
        customers = customer_gen.generate(config.num_customers)
        logger.info(f"  Generated: {len(customers)} customers")
        
        if load:
            logger.info(f"  Loading {len(customers)} customers into bronze.raw_customers...")
            loader.load_customers(customers)
            logger.info(f"  [SUCCESS] Loaded {len(customers)} customers")
        
        # 2. Generate Products
        logger.info("\n[2/7] Generating products...")
        logger.info(f"  Target: {config.num_products} products")
        product_gen = ProductGenerator(config, seed=config.random_seed)
        products = product_gen.generate(config.num_products)
        logger.info(f"  Generated: {len(products)} products")
        
        if load:
            logger.info(f"  Loading {len(products)} products into bronze.raw_products...")
            loader.load_products(products)
            logger.info(f"  [SUCCESS] Loaded {len(products)} products")
        
        # 3. Generate Orders
        logger.info("\n[3/7] Generating orders...")
        logger.info(f"  Date range: {config.days_of_data} days")
        logger.info(f"  Orders per day: {config.orders_per_day_range[0]}-{config.orders_per_day_range[1]}")
        order_gen = OrderGenerator(config, customers, products, seed=config.random_seed)
        from datetime import timedelta
        start_date = datetime.now() - timedelta(days=config.days_of_data)
        end_date = datetime.now()
        orders, order_items = order_gen.generate_for_date_range(start_date, end_date)
        logger.info(f"  Generated: {len(orders)} orders with {len(order_items)} order items")
        
        if load:
            logger.info(f"  Loading {len(orders)} orders into bronze.raw_orders...")
            loader.load_orders(orders)
            logger.info(f"  [SUCCESS] Loaded {len(orders)} orders")
        
        # 4. Generate Inventory Movements
        logger.info("\n[4/7] Generating inventory movements...")
        inventory_gen = InventoryGenerator(config, products, seed=config.random_seed)
        
        # Initial inventory
        logger.info("  Generating initial inventory movements...")
        initial_inventory = inventory_gen.generate_initial_inventory()
        logger.info(f"  Generated: {len(initial_inventory)} initial inventory movements (IN)")
        
        # OUT movements from orders
        logger.info("  Generating OUT movements from orders...")
        out_movements = inventory_gen.generate_movements_from_orders(orders, order_items)
        logger.info(f"  Generated: {len(out_movements)} OUT inventory movements")
        
        # Adjustments
        logger.info("  Generating inventory adjustments...")
        adjustments = inventory_gen.generate_adjustments(count=500)
        logger.info(f"  Generated: {len(adjustments)} inventory adjustments")
        
        all_inventory = initial_inventory + out_movements + adjustments
        logger.info(f"  Total: {len(all_inventory)} inventory movements")
        
        if load:
            logger.info(f"  Loading {len(all_inventory)} inventory movements into bronze.raw_inventory...")
            loader.load_inventory(all_inventory)
            logger.info(f"  [SUCCESS] Loaded {len(all_inventory)} inventory movements")
        
        # 5. Generate Reviews
        logger.info("\n[5/7] Generating reviews...")
        logger.info(f"  Reviews per product: {config.reviews_per_product_range[0]}-{config.reviews_per_product_range[1]}")
        review_gen = ReviewGenerator(config, customers, products, orders, seed=config.random_seed)
        reviews = review_gen.generate()
        logger.info(f"  Generated: {len(reviews)} reviews")
        
        if load:
            logger.info(f"  Loading {len(reviews)} reviews into bronze.raw_reviews...")
            loader.load_reviews(reviews)
            logger.info(f"  [SUCCESS] Loaded {len(reviews)} reviews")
        
        # 6. Generate Sessions
        logger.info("\n[6/7] Generating sessions...")
        total_sessions = config.sessions_per_day * config.days_of_data
        logger.info(f"  Target: {total_sessions} sessions ({config.sessions_per_day} per day x {config.days_of_data} days)")
        session_gen = SessionGenerator(config, customers, seed=config.random_seed)
        sessions = session_gen.generate()
        logger.info(f"  Generated: {len(sessions)} sessions")
        
        if load:
            logger.info(f"  Loading {len(sessions)} sessions into bronze.raw_sessions...")
            loader.load_sessions(sessions)
            logger.info(f"  [SUCCESS] Loaded {len(sessions)} sessions")
        
        # 7. Generate Clickstream Events
        logger.info("\n[7/7] Generating clickstream events...")
        logger.info(f"  Events per session: {config.events_per_session_range[0]}-{config.events_per_session_range[1]}")
        clickstream_gen = ClickstreamGenerator(config, sessions, products, customers, seed=config.random_seed)
        events = clickstream_gen.generate()
        logger.info(f"  Generated: {len(events)} clickstream events")
        
        if load:
            logger.info(f"  Loading {len(events)} clickstream events into bronze.raw_clickstream...")
            loader.load_clickstream(events)
            logger.info(f"  [SUCCESS] Loaded {len(events)} clickstream events")
        
        # Summary
        logger.info("\n" + "=" * 60)
        logger.info("Data Generation Complete!")
        logger.info("=" * 60)
        logger.info(f"Customers: {len(customers)}")
        logger.info(f"Products: {len(products)}")
        logger.info(f"Orders: {len(orders)}")
        logger.info(f"Order Items: {len(order_items)}")
        logger.info(f"Inventory Movements: {len(all_inventory)}")
        logger.info(f"Reviews: {len(reviews)}")
        logger.info(f"Sessions: {len(sessions)}")
        logger.info(f"Clickstream Events: {len(events)}")
        logger.info("=" * 60)
        
        if not load:
            logger.info("\nTo load data into database, use: python -m data_generator.main --load")
            logger.info("Or: cd data-generator && python main.py --load")
        
    except Exception as e:
        logger.error(f"Error during data generation: {e}", exc_info=True)
        raise
    finally:
        if loader:
            loader.disconnect()


def main():
    """Main entry point."""
    parser = argparse.ArgumentParser(description='Generate realistic e-commerce data')
    parser.add_argument('--load', action='store_true', help='Load data into Bronze layer')
    parser.add_argument('--customers', type=int, help='Number of customers to generate')
    parser.add_argument('--products', type=int, help='Number of products to generate')
    parser.add_argument('--days', type=int, help='Number of days of historical data')
    
    args = parser.parse_args()
    
    # Load configuration
    config = DataGeneratorConfig()
    
    # Override with command line arguments if provided
    if args.customers:
        config.num_customers = args.customers
    if args.products:
        config.num_products = args.products
    if args.days:
        config.days_of_data = args.days
    
    # Generate and optionally load data
    generate_data(config, load=args.load)


if __name__ == "__main__":
    main()
