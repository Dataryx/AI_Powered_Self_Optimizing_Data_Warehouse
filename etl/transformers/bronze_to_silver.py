"""
Bronze to Silver Layer Transformer
Transforms raw Bronze data into cleaned Silver layer data.
"""

import psycopg2
from psycopg2.extras import Json
from typing import Dict, Any, Optional
from datetime import datetime, date
import logging
import json

logger = logging.getLogger(__name__)


class BronzeToSilverTransformer:
    """Transforms Bronze layer data to Silver layer."""
    
    def __init__(self, connection):
        """Initialize transformer with database connection."""
        self.connection = connection
        self.cursor = connection.cursor()
    
    def transform_customers(self, batch_size: int = 1000):
        """Transform bronze.raw_customers to silver.customers (SCD Type 2)."""
        logger.info("Starting customer transformation...")
        
        # Get customers from bronze that haven't been processed
        select_query = """
            SELECT DISTINCT ON (customer_id) *
            FROM bronze.raw_customers
            WHERE customer_id NOT IN (
                SELECT DISTINCT customer_id FROM silver.customers
            )
            ORDER BY customer_id, ingestion_timestamp DESC
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        raw_customers = self.cursor.fetchall()
        column_names = [desc[0] for desc in self.cursor.description]
        customers = [dict(zip(column_names, row)) for row in raw_customers]
        
        if not customers:
            logger.info("No new customers to transform")
            return 0
        
        logger.info(f"Transforming {len(customers)} customers...")
        
        insert_query = """
            INSERT INTO silver.customers (
                customer_id, email, first_name, last_name, full_name, phone,
                country, city, state_province, postal_code, address_line1, address_line2,
                registration_date, date_of_birth, gender, customer_segment,
                valid_from, valid_to, is_current
            ) VALUES (
                %(customer_id)s, %(email)s, %(first_name)s, %(last_name)s, %(full_name)s,
                %(phone)s, %(country)s, %(city)s, %(state_province)s, %(postal_code)s,
                %(address_line1)s, %(address_line2)s, %(registration_date)s,
                %(date_of_birth)s, %(gender)s, %(customer_segment)s,
                %(valid_from)s, %(valid_to)s, %(is_current)s
            )
        """
        
        transformed = []
        for customer in customers:
            # Extract address from JSONB
            address = customer.get('address', {})
            if isinstance(address, str):
                address = json.loads(address) if address else {}
            elif address is None:
                address = {}
            
            # Extract name components
            first_name = customer.get('first_name') or ''
            last_name = customer.get('last_name') or ''
            full_name = customer.get('customer_name') or f"{first_name} {last_name}".strip()
            
            # Determine customer segment (simple logic - can be enhanced)
            registration_date = customer.get('registration_date')
            if registration_date:
                days_since_reg = (datetime.now().date() - registration_date.date()).days if isinstance(registration_date, datetime) else 0
                if days_since_reg < 30:
                    segment = 'new'
                elif days_since_reg < 365:
                    segment = 'active'
                else:
                    segment = 'established'
            else:
                segment = 'unknown'
            
            transformed.append({
                'customer_id': customer['customer_id'],
                'email': customer.get('email'),
                'first_name': first_name,
                'last_name': last_name,
                'full_name': full_name,
                'phone': customer.get('phone'),
                'country': address.get('country'),
                'city': address.get('city'),
                'state_province': address.get('state'),
                'postal_code': address.get('postal_code'),
                'address_line1': address.get('street'),
                'address_line2': None,
                'registration_date': registration_date.date() if isinstance(registration_date, datetime) else registration_date,
                'date_of_birth': customer.get('date_of_birth'),
                'gender': customer.get('gender'),
                'customer_segment': segment,
                'valid_from': datetime.now(),
                'valid_to': None,
                'is_current': True
            })
        
        # Batch insert
        for record in transformed:
            self.cursor.execute(insert_query, record)
        
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} customers")
        return len(transformed)
    
    def transform_products(self, batch_size: int = 1000):
        """Transform bronze.raw_products to silver.products (SCD Type 2)."""
        logger.info("Starting product transformation...")
        
        select_query = """
            SELECT DISTINCT ON (product_id) *
            FROM bronze.raw_products
            WHERE product_id NOT IN (
                SELECT DISTINCT product_id FROM silver.products WHERE is_current = TRUE
            )
            ORDER BY product_id, ingestion_timestamp DESC
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        raw_products = self.cursor.fetchall()
        column_names = [desc[0] for desc in self.cursor.description]
        products = [dict(zip(column_names, row)) for row in raw_products]
        
        if not products:
            logger.info("No new products to transform")
            return 0
        
        logger.info(f"Transforming {len(products)} products...")
        
        insert_query = """
            INSERT INTO silver.products (
                product_id, product_name, description, category, subcategory,
                brand, price, cost, currency, supplier_id, sku, is_active,
                valid_from, valid_to, is_current
            ) VALUES (
                %(product_id)s, %(product_name)s, %(description)s, %(category)s,
                %(subcategory)s, %(brand)s, %(price)s, %(cost)s, %(currency)s,
                %(supplier_id)s, %(sku)s, %(is_active)s,
                %(valid_from)s, %(valid_to)s, %(is_current)s
            )
        """
        
        transformed = []
        for product in products:
            transformed.append({
                'product_id': product['product_id'],
                'product_name': product.get('product_name', 'Unknown Product'),
                'description': product.get('description'),
                'category': product.get('category'),
                'subcategory': product.get('subcategory'),
                'brand': product.get('brand'),
                'price': product.get('price', 0),
                'cost': product.get('cost', 0),
                'currency': product.get('currency', 'USD'),
                'supplier_id': product.get('supplier_id'),
                'sku': product.get('sku'),
                'is_active': True,
                'valid_from': datetime.now(),
                'valid_to': None,
                'is_current': True
            })
        
        for record in transformed:
            self.cursor.execute(insert_query, record)
        
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} products")
        return len(transformed)
    
    def transform_orders(self, batch_size: int = 1000):
        """Transform bronze.raw_orders to silver.orders."""
        logger.info("Starting order transformation...")
        
        # Get orders that haven't been transformed
        select_query = """
            SELECT DISTINCT ON (ro.order_id) ro.*, c.customer_sk
            FROM bronze.raw_orders ro
            LEFT JOIN silver.customers c ON ro.customer_id = c.customer_id AND c.is_current = TRUE
            WHERE ro.order_id NOT IN (
                SELECT order_id FROM silver.orders
            )
            ORDER BY ro.order_id, ro.ingestion_timestamp DESC
            LIMIT %s
        """
        
        self.cursor.execute(select_query, (batch_size,))
        raw_orders = self.cursor.fetchall()
        column_names = [desc[0] for desc in self.cursor.description]
        orders = [dict(zip(column_names, row)) for row in raw_orders]
        
        if not orders:
            logger.info("No new orders to transform")
            return 0
        
        logger.info(f"Transforming {len(orders)} orders...")
        
        insert_query = """
            INSERT INTO silver.orders (
                order_id, customer_sk, order_date, order_timestamp, status,
                shipping_country, shipping_city, shipping_postal_code,
                shipping_address_line1, shipping_address_line2,
                total_amount, discount_amount, tax_amount, shipping_cost,
                payment_method, payment_status
            ) VALUES (
                %(order_id)s, %(customer_sk)s, %(order_date)s, %(order_timestamp)s,
                %(status)s, %(shipping_country)s, %(shipping_city)s,
                %(shipping_postal_code)s, %(shipping_address_line1)s,
                %(shipping_address_line2)s, %(total_amount)s, %(discount_amount)s,
                %(tax_amount)s, %(shipping_cost)s, %(payment_method)s, %(payment_status)s
            )
        """
        
        transformed = []
        for order in orders:
            order_date = order['order_date']
            if isinstance(order_date, datetime):
                order_date_only = order_date.date()
                order_timestamp = order_date
            else:
                order_date_only = order_date
                order_timestamp = datetime.combine(order_date, datetime.min.time())
            
            # Extract shipping address
            shipping_address = order.get('shipping_address', {})
            if isinstance(shipping_address, str):
                shipping_address = json.loads(shipping_address) if shipping_address else {}
            elif shipping_address is None:
                shipping_address = {}
            
            # Extract additional data from raw_data if available
            raw_data = order.get('raw_data', {})
            if isinstance(raw_data, str):
                raw_data = json.loads(raw_data) if raw_data else {}
            elif raw_data is None:
                raw_data = {}
            
            transformed.append({
                'order_id': order['order_id'],
                'customer_sk': order.get('customer_sk'),
                'order_date': order_date_only,
                'order_timestamp': order_timestamp,
                'status': order.get('status', 'pending'),
                'shipping_country': shipping_address.get('country'),
                'shipping_city': shipping_address.get('city'),
                'shipping_postal_code': shipping_address.get('postal_code'),
                'shipping_address_line1': shipping_address.get('street'),
                'shipping_address_line2': None,
                'total_amount': order.get('total_amount', 0),
                'discount_amount': raw_data.get('discount_amount', 0),
                'tax_amount': raw_data.get('tax_amount', 0),
                'shipping_cost': raw_data.get('shipping_cost', 0),
                'payment_method': raw_data.get('payment_method'),
                'payment_status': raw_data.get('payment_status')
            })
        
        for record in transformed:
            self.cursor.execute(insert_query, record)
        
        self.connection.commit()
        logger.info(f"Successfully transformed {len(transformed)} orders")
        
        # Also transform order items
        self.transform_order_items(orders, batch_size)
        
        return len(transformed)
    
    def transform_order_items(self, orders: list, batch_size: int = 1000):
        """Transform order items from bronze.raw_orders to silver.order_items."""
        logger.info("Transforming order items...")
        
        items_transformed = 0
        
        for order in orders:
            # Get order_sk
            self.cursor.execute(
                "SELECT order_sk FROM silver.orders WHERE order_id = %s",
                (order['order_id'],)
            )
            result = self.cursor.fetchone()
            if not result:
                continue
            
            order_sk = result[0]
            
            # Extract items from raw_data
            raw_data = order.get('raw_data', {})
            if isinstance(raw_data, str):
                raw_data = json.loads(raw_data) if raw_data else {}
            elif raw_data is None:
                raw_data = {}
            
            items = raw_data.get('items', [])
            if not items:
                continue
            
            # Get product_sk for each item
            insert_query = """
                INSERT INTO silver.order_items (
                    order_sk, product_sk, quantity, unit_price,
                    discount_amount, total_amount
                )
                SELECT %s, p.product_sk, %s, %s, %s, %s
                FROM silver.products p
                WHERE p.product_id = %s AND p.is_current = TRUE
                LIMIT 1
            """
            
            for item in items:
                try:
                    self.cursor.execute(insert_query, (
                        order_sk,
                        item.get('quantity', 1),
                        item.get('unit_price', 0),
                        item.get('discount_amount', 0),
                        item.get('total_amount', 0),
                        item.get('product_id')
                    ))
                    items_transformed += 1
                except Exception as e:
                    logger.warning(f"Error transforming order item: {e}")
                    continue
        
        self.connection.commit()
        logger.info(f"Successfully transformed {items_transformed} order items")
        return items_transformed
    
    def transform_all(self, batch_size: int = 1000):
        """Transform all Bronze data to Silver layer."""
        logger.info("=" * 60)
        logger.info("Starting Bronze to Silver Transformation")
        logger.info("=" * 60)
        
        total_customers = 0
        total_products = 0
        total_orders = 0
        
        # Transform in order: customers, products, orders
        while True:
            customers = self.transform_customers(batch_size)
            if customers == 0:
                break
            total_customers += customers
        
        while True:
            products = self.transform_products(batch_size)
            if products == 0:
                break
            total_products += products
        
        while True:
            orders = self.transform_orders(batch_size)
            if orders == 0:
                break
            total_orders += orders
        
        logger.info("=" * 60)
        logger.info("Bronze to Silver Transformation Complete!")
        logger.info(f"Customers transformed: {total_customers}")
        logger.info(f"Products transformed: {total_products}")
        logger.info(f"Orders transformed: {total_orders}")
        logger.info("=" * 60)
        
        return {
            'customers': total_customers,
            'products': total_products,
            'orders': total_orders
        }

