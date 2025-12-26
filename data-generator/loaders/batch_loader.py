"""
Batch Loader
Loads generated data into Bronze layer tables in batches.
"""

import psycopg2
from psycopg2.extras import execute_batch, Json
from typing import List, Dict, Any
import logging
from datetime import datetime, date
import json

logger = logging.getLogger(__name__)


def serialize_datetime(obj):
    """Custom JSON serializer for datetime objects."""
    if isinstance(obj, (datetime, date)):
        return obj.isoformat()
    raise TypeError(f"Type {type(obj)} not serializable")


def prepare_jsonb_data(data: Dict[str, Any]) -> Dict[str, Any]:
    """Prepare data for JSONB storage by serializing datetime objects."""
    if not data:
        return {}
    
    # Convert to JSON string and back to ensure datetime serialization
    json_str = json.dumps(data, default=serialize_datetime)
    return json.loads(json_str)


class BatchLoader:
    """Batch loader for inserting data into Bronze layer."""
    
    def __init__(self, config):
        """Initialize batch loader with database configuration."""
        self.config = config
        self.connection = None
        self.cursor = None
    
    def connect(self):
        """Establish database connection."""
        try:
            self.connection = psycopg2.connect(
                host=self.config.db_host,
                port=self.config.db_port,
                database=self.config.db_name,
                user=self.config.db_user,
                password=self.config.db_password
            )
            self.cursor = self.connection.cursor()
            logger.info("Database connection established")
        except Exception as e:
            logger.error(f"Failed to connect to database: {e}")
            raise
    
    def disconnect(self):
        """Close database connection."""
        if self.cursor:
            self.cursor.close()
        if self.connection:
            self.connection.close()
        logger.info("Database connection closed")
    
    def load_customers(self, customers: List[Dict[str, Any]]):
        """Load customer data into bronze.raw_customers."""
        logger.info(f"Loading {len(customers)} customers...")
        
        insert_query = """
            INSERT INTO bronze.raw_customers (
                customer_id, email, customer_name, first_name, last_name, phone,
                address, registration_date, date_of_birth, gender,
                source_system, ingestion_timestamp, raw_data
            ) VALUES (
                %(customer_id)s, %(email)s, %(customer_name)s, %(first_name)s, %(last_name)s,
                %(phone)s, %(address)s, %(registration_date)s, %(date_of_birth)s,
                %(gender)s, %(source_system)s, %(ingestion_timestamp)s, %(raw_data)s
            )
            ON CONFLICT (customer_id) DO NOTHING
        """
        
        records = []
        for customer in customers:
            records.append({
                'customer_id': customer['customer_id'],
                'email': customer['email'],
                'customer_name': customer['customer_name'],
                'first_name': customer['first_name'],
                'last_name': customer['last_name'],
                'phone': customer.get('phone'),
                'address': Json(customer.get('address', {})),
                'registration_date': customer.get('registration_date'),
                'date_of_birth': customer.get('date_of_birth'),
                'gender': customer.get('gender'),
                'source_system': customer['source_system'],
                'ingestion_timestamp': customer['ingestion_timestamp'],
                'raw_data': Json(prepare_jsonb_data(customer.get('raw_data', {})))
            })
        
        execute_batch(self.cursor, insert_query, records, page_size=self.config.batch_size)
        self.connection.commit()
        logger.info(f"Successfully loaded {len(customers)} customers")
    
    def load_products(self, products: List[Dict[str, Any]]):
        """Load product data into bronze.raw_products."""
        logger.info(f"Loading {len(products)} products...")
        
        insert_query = """
            INSERT INTO bronze.raw_products (
                product_id, product_name, description, category, subcategory,
                price, cost, currency, attributes, supplier_id, brand, sku,
                source_system, ingestion_timestamp, raw_data
            ) VALUES (
                %(product_id)s, %(product_name)s, %(description)s, %(category)s,
                %(subcategory)s, %(price)s, %(cost)s, %(currency)s, %(attributes)s,
                %(supplier_id)s, %(brand)s, %(sku)s, %(source_system)s,
                %(ingestion_timestamp)s, %(raw_data)s
            )
            ON CONFLICT (product_id) DO NOTHING
        """
        
        records = []
        for product in products:
            records.append({
                'product_id': product['product_id'],
                'product_name': product['product_name'],
                'description': product.get('description'),
                'category': product.get('category'),
                'subcategory': product.get('subcategory'),
                'price': product.get('price'),
                'cost': product.get('cost'),
                'currency': product.get('currency', 'USD'),
                'attributes': Json(product.get('attributes', {})),
                'supplier_id': product.get('supplier_id'),
                'brand': product.get('brand'),
                'sku': product.get('sku'),
                'source_system': product['source_system'],
                'ingestion_timestamp': product['ingestion_timestamp'],
                'raw_data': Json(prepare_jsonb_data(product.get('raw_data', {})))
            })
        
        execute_batch(self.cursor, insert_query, records, page_size=self.config.batch_size)
        self.connection.commit()
        logger.info(f"Successfully loaded {len(products)} products")
    
    def load_orders(self, orders: List[Dict[str, Any]]):
        """Load order data into bronze.raw_orders."""
        logger.info(f"Loading {len(orders)} orders...")
        
        insert_query = """
            INSERT INTO bronze.raw_orders (
                order_id, customer_id, order_date, status, shipping_address,
                total_amount, source_system, ingestion_timestamp, raw_data
            ) VALUES (
                %(order_id)s, %(customer_id)s, %(order_date)s, %(status)s,
                %(shipping_address)s, %(total_amount)s, %(source_system)s,
                %(ingestion_timestamp)s, %(raw_data)s
            )
            ON CONFLICT (order_id, order_date) DO NOTHING
        """
        
        records = []
        for order in orders:
            records.append({
                'order_id': order['order_id'],
                'customer_id': order['customer_id'],
                'order_date': order['order_date'],
                'status': order['status'],
                'shipping_address': Json(order.get('shipping_address', {})),
                'total_amount': order['total_amount'],
                'source_system': order['source_system'],
                'ingestion_timestamp': order['ingestion_timestamp'],
                'raw_data': Json(prepare_jsonb_data(order.get('raw_data', {})))
            })
        
        execute_batch(self.cursor, insert_query, records, page_size=self.config.batch_size)
        self.connection.commit()
        logger.info(f"Successfully loaded {len(orders)} orders")
    
    def load_inventory(self, inventory_movements: List[Dict[str, Any]]):
        """Load inventory movement data into bronze.raw_inventory."""
        logger.info(f"Loading {len(inventory_movements)} inventory movements...")
        
        insert_query = """
            INSERT INTO bronze.raw_inventory (
                product_id, warehouse_id, quantity, movement_type, movement_date,
                reference_number, source_system, ingestion_timestamp, raw_data
            ) VALUES (
                %(product_id)s, %(warehouse_id)s, %(quantity)s, %(movement_type)s,
                %(movement_date)s, %(reference_number)s, %(source_system)s,
                %(ingestion_timestamp)s, %(raw_data)s
            )
        """
        
        records = []
        for movement in inventory_movements:
            records.append({
                'product_id': movement['product_id'],
                'warehouse_id': movement['warehouse_id'],
                'quantity': movement['quantity'],
                'movement_type': movement['movement_type'],
                'movement_date': movement['movement_date'],
                'reference_number': movement.get('reference_number'),
                'source_system': movement['source_system'],
                'ingestion_timestamp': movement['ingestion_timestamp'],
                'raw_data': Json(prepare_jsonb_data(movement.get('raw_data', {})))
            })
        
        execute_batch(self.cursor, insert_query, records, page_size=self.config.batch_size)
        self.connection.commit()
        logger.info(f"Successfully loaded {len(inventory_movements)} inventory movements")
    
    def load_reviews(self, reviews: List[Dict[str, Any]]):
        """Load review data into bronze.raw_reviews."""
        logger.info(f"Loading {len(reviews)} reviews...")
        
        insert_query = """
            INSERT INTO bronze.raw_reviews (
                review_id, product_id, customer_id, rating, review_text,
                review_title, review_date, helpful_count, verified_purchase,
                source_system, ingestion_timestamp, raw_data
            ) VALUES (
                %(review_id)s, %(product_id)s, %(customer_id)s, %(rating)s,
                %(review_text)s, %(review_title)s, %(review_date)s,
                %(helpful_count)s, %(verified_purchase)s, %(source_system)s,
                %(ingestion_timestamp)s, %(raw_data)s
            )
            ON CONFLICT (review_id) DO NOTHING
        """
        
        records = []
        for review in reviews:
            records.append({
                'review_id': review['review_id'],
                'product_id': review['product_id'],
                'customer_id': review.get('customer_id'),
                'rating': review['rating'],
                'review_text': review.get('review_text'),
                'review_title': review.get('review_title'),
                'review_date': review['review_date'],
                'helpful_count': review.get('helpful_count', 0),
                'verified_purchase': review.get('verified_purchase', False),
                'source_system': review['source_system'],
                'ingestion_timestamp': review['ingestion_timestamp'],
                'raw_data': Json(prepare_jsonb_data(review.get('raw_data', {})))
            })
        
        execute_batch(self.cursor, insert_query, records, page_size=self.config.batch_size)
        self.connection.commit()
        logger.info(f"Successfully loaded {len(reviews)} reviews")
    
    def load_sessions(self, sessions: List[Dict[str, Any]]):
        """Load session data into bronze.raw_sessions."""
        logger.info(f"Loading {len(sessions)} sessions...")
        
        insert_query = """
            INSERT INTO bronze.raw_sessions (
                session_id, user_id, start_time, end_time, duration_seconds,
                device_type, browser, operating_system, location, ip_address,
                is_mobile, source_system, ingestion_timestamp, raw_data
            ) VALUES (
                %(session_id)s, %(user_id)s, %(start_time)s, %(end_time)s,
                %(duration_seconds)s, %(device_type)s, %(browser)s,
                %(operating_system)s, %(location)s, %(ip_address)s,
                %(is_mobile)s, %(source_system)s, %(ingestion_timestamp)s, %(raw_data)s
            )
            ON CONFLICT (session_id) DO NOTHING
        """
        
        records = []
        for session in sessions:
            records.append({
                'session_id': session['session_id'],
                'user_id': session.get('user_id'),
                'start_time': session['start_time'],
                'end_time': session.get('end_time'),
                'duration_seconds': session.get('duration_seconds'),
                'device_type': session.get('device_type'),
                'browser': session.get('browser'),
                'operating_system': session.get('operating_system'),
                'location': Json(session.get('location', {})),
                'ip_address': session.get('ip_address'),
                'is_mobile': session.get('is_mobile', False),
                'source_system': session['source_system'],
                'ingestion_timestamp': session['ingestion_timestamp'],
                'raw_data': Json(prepare_jsonb_data(session.get('raw_data', {})))
            })
        
        execute_batch(self.cursor, insert_query, records, page_size=self.config.batch_size)
        self.connection.commit()
        logger.info(f"Successfully loaded {len(sessions)} sessions")
    
    def load_clickstream(self, events: List[Dict[str, Any]]):
        """Load clickstream event data into bronze.raw_clickstream."""
        logger.info(f"Loading {len(events)} clickstream events...")
        
        insert_query = """
            INSERT INTO bronze.raw_clickstream (
                session_id, user_id, event_type, page_url, referrer,
                device_info, event_timestamp, source_system, ingestion_timestamp, raw_data
            ) VALUES (
                %(session_id)s, %(user_id)s, %(event_type)s, %(page_url)s,
                %(referrer)s, %(device_info)s, %(event_timestamp)s,
                %(source_system)s, %(ingestion_timestamp)s, %(raw_data)s
            )
        """
        
        records = []
        for event in events:
            records.append({
                'session_id': event['session_id'],
                'user_id': event.get('user_id'),
                'event_type': event['event_type'],
                'page_url': event.get('page_url'),
                'referrer': event.get('referrer'),
                'device_info': Json(event.get('device_info', {})),
                'event_timestamp': event['event_timestamp'],
                'source_system': event['source_system'],
                'ingestion_timestamp': event['ingestion_timestamp'],
                'raw_data': Json(prepare_jsonb_data(event.get('raw_data', {})))
            })
        
        execute_batch(self.cursor, insert_query, records, page_size=self.config.batch_size)
        self.connection.commit()
        logger.info(f"Successfully loaded {len(events)} clickstream events")
