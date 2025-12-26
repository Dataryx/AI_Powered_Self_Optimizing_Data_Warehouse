"""
Order Data Generator
Generates realistic order data with order items.
"""

from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta
import random
from .base_generator import BaseGenerator


class OrderGenerator(BaseGenerator):
    """Generator for order data."""
    
    ORDER_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled', 'returned']
    PAYMENT_METHODS = ['credit_card', 'debit_card', 'paypal', 'apple_pay', 'google_pay']
    PAYMENT_STATUSES = ['pending', 'completed', 'failed', 'refunded']
    
    def __init__(self, config, customers: List[Dict], products: List[Dict], seed: int = None):
        """Initialize order generator."""
        super().__init__(config, seed)
        self.customers = customers
        self.products = products
        self.order_ids = set()
    
    def generate(self, count: int, start_date: datetime = None, end_date: datetime = None) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Generate order records and order items.
        
        Returns:
            Tuple of (orders list, order_items list)
        """
        if not self.customers or not self.products:
            raise ValueError("Customers and products must be provided")
        
        if start_date is None:
            start_date = datetime.now() - timedelta(days=self.config.days_of_data)
        if end_date is None:
            end_date = datetime.now()
        
        orders = []
        order_items = []
        
        for i in range(count):
            order_id = f"ORD{str(i+1).zfill(10)}"
            while order_id in self.order_ids:
                order_id = f"ORD{str(random.randint(1000000000, 9999999999))}"
            self.order_ids.add(order_id)
            
            # Select random customer and order date
            customer = random.choice(self.customers)
            order_date = self.fake.date_time_between(start_date=start_date, end_date=end_date)
            
            # Generate order items
            num_items = random.randint(
                self.config.items_per_order_range[0],
                self.config.items_per_order_range[1]
            )
            
            items = []
            total_amount = 0.0
            discount_amount = 0.0
            
            for _ in range(num_items):
                product = random.choice(self.products)
                quantity = random.randint(1, 5)
                unit_price = float(product['price'])
                
                # Apply random discount occasionally
                discount_pct = random.choices([0, 0.1, 0.15, 0.2, 0.25], weights=[70, 15, 8, 5, 2])[0]
                item_discount = unit_price * quantity * discount_pct
                item_total = (unit_price * quantity) - item_discount
                
                items.append({
                    'product_id': product['product_id'],
                    'quantity': quantity,
                    'unit_price': round(unit_price, 2),
                    'discount_amount': round(item_discount, 2),
                    'total_amount': round(item_total, 2)
                })
                
                total_amount += item_total
                discount_amount += item_discount
            
            # Add shipping and tax
            shipping_cost = random.uniform(0, 25.0)
            tax_amount = total_amount * random.uniform(0.05, 0.12)  # 5-12% tax
            
            final_total = total_amount + shipping_cost + tax_amount
            
            # Ensure minimum order amount
            if final_total < self.config.min_order_amount:
                final_total = self.config.min_order_amount
                total_amount = final_total - shipping_cost - tax_amount
            
            status = random.choice(self.ORDER_STATUSES)
            
            order = {
                'order_id': order_id,
                'customer_id': customer['customer_id'],
                'order_date': order_date,
                'status': status,
                'shipping_address': customer.get('address', {}),
                'total_amount': round(final_total, 2),
                'source_system': self.get_source_system(),
                'ingestion_timestamp': datetime.now(),
                'raw_data': {}
            }
            
            # Store complete record in raw_data
            order['raw_data'] = order.copy()
            order['raw_data']['items'] = items
            order['raw_data']['shipping_cost'] = round(shipping_cost, 2)
            order['raw_data']['tax_amount'] = round(tax_amount, 2)
            order['raw_data']['discount_amount'] = round(discount_amount, 2)
            order['raw_data']['payment_method'] = random.choice(self.PAYMENT_METHODS)
            order['raw_data']['payment_status'] = random.choice(self.PAYMENT_STATUSES)
            
            orders.append(order)
            
            # Create order items (for Silver layer processing)
            for item in items:
                order_items.append({
                    'order_id': order_id,
                    'product_id': item['product_id'],
                    'quantity': item['quantity'],
                    'unit_price': item['unit_price'],
                    'discount_amount': item['discount_amount'],
                    'total_amount': item['total_amount']
                })
        
        return orders, order_items
    
    def generate_for_date_range(self, start_date: datetime, end_date: datetime) -> Tuple[List[Dict], List[Dict]]:
        """Generate orders distributed across date range."""
        from datetime import timedelta
        current_date = start_date.date()
        end_date_only = end_date.date()
        all_orders = []
        all_items = []
        
        while current_date <= end_date_only:
            # Generate orders for this day
            orders_per_day = random.randint(
                self.config.orders_per_day_range[0],
                self.config.orders_per_day_range[1]
            )
            
            day_start = datetime.combine(current_date, datetime.min.time())
            day_end = datetime.combine(current_date, datetime.max.time())
            
            orders, items = self.generate(orders_per_day, day_start, day_end)
            all_orders.extend(orders)
            all_items.extend(items)
            
            current_date += timedelta(days=1)
        
        return all_orders, all_items
