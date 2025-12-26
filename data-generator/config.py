"""
Data Generator Configuration
Configuration settings for synthetic data generation.
"""

from pydantic_settings import BaseSettings
from typing import Optional
import os


class DataGeneratorConfig(BaseSettings):
    """Configuration for data generator."""
    
    # Database connection
    db_host: str = os.getenv("POSTGRES_HOST", "localhost")
    db_port: int = int(os.getenv("POSTGRES_PORT", "5432"))
    db_name: str = os.getenv("POSTGRES_DB", "datawarehouse")
    db_user: str = os.getenv("POSTGRES_USER", "postgres")
    db_password: str = os.getenv("POSTGRES_PASSWORD", "postgres")
    
    # Data volumes
    num_customers: int = 10000
    num_products: int = 5000
    num_orders: int = 50000
    orders_per_day_range: tuple = (100, 500)  # Min and max orders per day
    days_of_data: int = 365  # Generate data for this many days
    
    # Order configuration
    items_per_order_range: tuple = (1, 5)  # Min and max items per order
    min_order_amount: float = 10.0
    max_order_amount: float = 5000.0
    
    # Reviews configuration
    reviews_per_product_range: tuple = (5, 50)  # Min and max reviews per product
    review_probability: float = 0.3  # Probability a customer writes a review
    
    # Clickstream configuration
    events_per_session_range: tuple = (5, 30)  # Min and max events per session
    sessions_per_day: int = 1000
    
    # Inventory configuration
    num_warehouses: int = 5
    initial_inventory_per_product: int = 1000
    
    # Source system
    source_system: str = "ecommerce_platform"
    
    # Batch size for loading
    batch_size: int = 1000
    
    # Seed for reproducibility
    random_seed: Optional[int] = 42
    
    class Config:
        env_file = ".env"
        case_sensitive = False
