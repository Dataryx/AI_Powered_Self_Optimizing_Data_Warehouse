"""
Inventory Data Generator
Generates realistic inventory movement data.
"""

from typing import List, Dict, Any
from datetime import datetime, timedelta
import random
from .base_generator import BaseGenerator


class InventoryGenerator(BaseGenerator):
    """Generator for inventory movement data."""
    
    MOVEMENT_TYPES = ['IN', 'OUT', 'ADJUSTMENT', 'TRANSFER']
    
    def __init__(self, config, products: List[Dict], seed: int = None):
        """Initialize inventory generator."""
        super().__init__(config, seed)
        self.products = products
        self.warehouses = [f"WH{i:03d}" for i in range(1, config.num_warehouses + 1)]
    
    def generate(self, count: int) -> List[Dict[str, Any]]:
        """Generate inventory movements (not used - use specialized methods instead)."""
        # This method is required by BaseGenerator but InventoryGenerator uses specialized methods
        return []
    
    def generate_initial_inventory(self) -> List[Dict[str, Any]]:
        """Generate initial inventory movements (IN type)."""
        movements = []
        start_date = datetime.now() - timedelta(days=self.config.days_of_data)
        
        for product in self.products:
            for warehouse in self.warehouses:
                movement_date = self.fake.date_time_between(
                    start_date=start_date,
                    end_date=start_date + timedelta(days=7)
                )
                
                movement = {
                    'product_id': product['product_id'],
                    'warehouse_id': warehouse,
                    'quantity': self.config.initial_inventory_per_product,
                    'movement_type': 'IN',
                    'movement_date': movement_date,
                    'reference_number': f"INIT-{warehouse}-{product['product_id']}",
                    'source_system': self.get_source_system(),
                    'ingestion_timestamp': datetime.now(),
                    'raw_data': {}
                }
                
                movement['raw_data'] = movement.copy()
                movements.append(movement)
        
        return movements
    
    def generate_movements_from_orders(self, orders: List[Dict], order_items: List[Dict]) -> List[Dict[str, Any]]:
        """Generate OUT movements based on orders."""
        movements = []
        
        # Group order items by order_id
        items_by_order = {}
        for item in order_items:
            if item['order_id'] not in items_by_order:
                items_by_order[item['order_id']] = []
            items_by_order[item['order_id']].append(item)
        
        # Create OUT movements for each order
        for order in orders:
            if order['order_id'] in items_by_order:
                items = items_by_order[order['order_id']]
                warehouse = random.choice(self.warehouses)
                
                for item in items:
                    movement = {
                        'product_id': item['product_id'],
                        'warehouse_id': warehouse,
                        'quantity': -item['quantity'],  # Negative for OUT
                        'movement_type': 'OUT',
                        'movement_date': order['order_date'],
                        'reference_number': order['order_id'],
                        'source_system': self.get_source_system(),
                        'ingestion_timestamp': datetime.now(),
                        'raw_data': {}
                    }
                    
                    movement['raw_data'] = movement.copy()
                    movements.append(movement)
        
        return movements
    
    def generate_adjustments(self, count: int = 100) -> List[Dict[str, Any]]:
        """Generate inventory adjustment movements."""
        movements = []
        start_date = datetime.now() - timedelta(days=self.config.days_of_data)
        
        for _ in range(count):
            product = random.choice(self.products)
            warehouse = random.choice(self.warehouses)
            
            # Small adjustments (-10 to +10)
            quantity = random.randint(-10, 10)
            if quantity == 0:
                quantity = random.choice([-1, 1])
            
            movement_date = self.fake.date_time_between(
                start_date=start_date,
                end_date='now'
            )
            
            movement = {
                'product_id': product['product_id'],
                'warehouse_id': warehouse,
                'quantity': quantity,
                'movement_type': 'ADJUSTMENT',
                'movement_date': movement_date,
                'reference_number': f"ADJ-{self.fake.bothify(text='####-???').upper()}",
                'source_system': self.get_source_system(),
                'ingestion_timestamp': datetime.now(),
                'raw_data': {}
            }
            
            movement['raw_data'] = movement.copy()
            movements.append(movement)
        
        return movements
